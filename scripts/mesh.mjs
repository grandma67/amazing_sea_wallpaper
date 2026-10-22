// Render one mesh on its own, from four sides (tools/mesh.html), to judge
// shape and colour in a second instead of a whole beach render.
//
//   node scripts/mesh.mjs [--url http://localhost:5174/] [--out out/mesh]
//        [--seed S] [--eye 20] [--w 1600 --h 1000] CALL [CALL...]
//
// CALL is MODULE#FUNCTION(ARGS): a builder under src/ and its arguments as
// JSON, with $rng for a seeded Random. Quote it for the shell:
//   node scripts/mesh.mjs 'props/wildlife#hippoGeometry($rng, 0)' \
//                         'props/wildlife#crocodileGeometry($rng, "nile", 0.4)'
// Each saves <out>/<FUNCTION>-<n>.jpg: side, front, 3/4 from above (top
// row), and at eye height --eye metres off (bottom right), on sand-coloured
// ground with a 1 m ruler (10 cm bars); prints size (m) and triangles.
// Needs the dev server (the page imports the builder through Vite).

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return fallback
  const [, value] = args.splice(i, 2)
  return value
}
const baseUrl = option('url', 'http://localhost:5174/')
const outDir = option('out', 'out/mesh')
const seed = option('seed', 'preview')
const eye = option('eye', '20')
const width = option('w', '1600')
const height = option('h', '1000')
if (args.length === 0) {
  console.log("usage: node scripts/mesh.mjs 'props/wildlife#hippoGeometry($rng, 0)' …")
  process.exit(1)
}
setTimeout(() => {
  console.log('[mesh] gave up after 120 s')
  process.exit(2)
}, 120_000).unref()

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal'] })
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } })
page.on('console', msg => {
  if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[browser ${msg.type()}]`, msg.text())
})
page.on('pageerror', error => console.log('[page error]', error.message))

const used = new Map()
for (const call of args) {
  const name = /#(\w+)/.exec(call)?.[1] ?? 'mesh'
  const n = (used.get(name) ?? 0) + 1
  used.set(name, n)
  const url = new URL('tools/mesh.html', baseUrl)
  for (const [k, v] of Object.entries({ call, seed, eye, w: width, h: height })) url.searchParams.set(k, v)
  await page.goto(url.toString())
  await page.waitForFunction(() => window.__preview != null)
  try {
    const info = await page.evaluate(() => window.__preview.ready)
    const file = join(outDir, `${name}-${n}.jpg`)
    await writeFile(file, await page.locator('canvas').screenshot({ type: 'jpeg', quality: 90 }))
    console.log(`${file}  size ${info.size.join(' × ')} m  ${info.triangles} tris  ${call}`)
  } catch (error) {
    console.log(`✗ ${call}: ${error.message.split('\n')[0]}`)
  }
}
await browser.close()
