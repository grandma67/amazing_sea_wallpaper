// One mesh alone (tools/mesh.html): side, front, 3/4 above, and at --eye m
// off, on sand-coloured ground with a 1 m ruler (10 cm bars). Prints size (m)
// and triangles; saves OUT/FUNCTION-N.jpg. Needs the dev server.
//
//   node scripts/mesh.mjs [--out out/mesh] [--seed S] [--eye 20] [--w 1600 --h 1000]
//        [--url http://localhost:5174/] 'MODULE#FUNCTION(ARGS)'...
//
// MODULE is under src/; ARGS are JSON, $rng a seeded Random:
//   node scripts/mesh.mjs 'props/wildlife#hippoGeometry($rng, 0)'
//
// To judge a look as the scene draws it, not just the shape:
// --material 'MODULE#FUNCTION(ARGS)'  the prop's own material for a BufferGeometry
//                                     (its onBeforeCompile runs: world-position shaders show)
// --scale X,Y,Z                       real size for a unit mesh (a slab's thickness)
// --sun DEG                           the sun's height (default about 50): 8 for low sun,
//                                     where a tiny tilt or a flat facet shows
//   node scripts/mesh.mjs --material 'props/seaIce#rubbleMaterial(0.8)' --scale 1.2,0.3,1 --sun 8 'props/seaIce#slabGeometry($rng)'

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

import { parseArgs, requireServer, watchPage } from './lib.mjs'

const { args, option, rejectUnknown } = parseArgs()
const baseUrl = option('url', 'http://localhost:5174/')
const outDir = option('out', 'out/mesh')
const seed = option('seed', 'preview')
const eye = option('eye', '20')
const width = option('w', '1600')
const height = option('h', '1000')
const material = option('material', null)
const scale = option('scale', null)
const sun = option('sun', null)
rejectUnknown()
if (args.length === 0) {
  console.log("usage: node scripts/mesh.mjs 'props/wildlife#hippoGeometry($rng, 0)' …")
  process.exit(1)
}
setTimeout(() => {
  console.log('[mesh] gave up after 120 s')
  process.exit(2)
}, 120_000).unref()

await mkdir(outDir, { recursive: true })
await requireServer(baseUrl)
const browser = await chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal'] })
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } })
const messages = await watchPage(page)

const used = new Map()
for (const call of args) {
  const name = /#(\w+)/.exec(call)?.[1] ?? 'mesh'
  const n = (used.get(name) ?? 0) + 1
  used.set(name, n)
  const url = new URL('tools/mesh.html', baseUrl)
  for (const [k, v] of Object.entries({ call, seed, eye, w: width, h: height, material, scale, sun })) if (v != null) url.searchParams.set(k, v)
  await page.goto(url.toString())
  await page.waitForFunction(() => window.__preview != null)
  try {
    const info = await page.evaluate(() => window.__preview.ready)
    const file = join(outDir, `${name}-${n}.jpg`)
    await writeFile(file, await page.locator('canvas').screenshot({ type: 'jpeg', quality: 90 }))
    console.log(`${file}  size ${info.size.join(' × ')} m  ${info.triangles} tris  ${call}`)
    for (const m of messages.gl()) console.log(`  ⚠ GL: ${m}`)
  } catch (error) {
    console.log(`✗ ${call}: ${error.message.split('\n')[0]}`)
  }
}
await browser.close()
