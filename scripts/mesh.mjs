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
// --ref REF                           also render each call at that commit (a worktree on port
//                                     5178, with today's preview page): OUT/NAME-N.ref.jpg and
//                                     OUT/NAME-N.compare.jpg (ref above, now below). A --material
//                                     the ref doesn't have fails there: leave it out
// --focus head                        frame side, front and 3/4 on the front 15% (the head:
//                                     animals face +x) to judge eyes, nostrils, mouths, bills
// --sun DEG                           the sun's height (default about 50): 8 for low sun,
//                                     where a tiny tilt or a flat facet shows
//   node scripts/mesh.mjs --material 'props/seaIce#rubbleMaterial(0.8)' --scale 1.2,0.3,1 --sun 8 'props/seaIce#slabGeometry($rng)'

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

import { parseArgs, requireServer, watchPage } from './lib.mjs'
import { serveRef } from './refServer.mjs'

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
const focus = option('focus', null)
const ref = option('ref', null)
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
// --ref: the old commit's props through today's preview page.
const old = ref == null ? null : await serveRef(ref, 5178, ['src/meshPreview.ts', 'tools/mesh.html'])
if (old != null) {
  process.on('exit', old.close)
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(130))
  console.log(`[mesh] also rendering ${ref} (${old.sha})`)
}
const browser = await chromium.launch({ channel: 'chrome', args: ['--ignore-gpu-blocklist', '--enable-gpu', '--use-angle=metal'] })
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) } })
const messages = await watchPage(page)

const used = new Map()
for (const call of args) {
  const name = /#(\w+)/.exec(call)?.[1] ?? 'mesh'
  const n = (used.get(name) ?? 0) + 1
  used.set(name, n)
  const shoot = async (server, suffix) => {
    const url = new URL('tools/mesh.html', server)
    for (const [k, v] of Object.entries({ call, seed, eye, w: width, h: height, material, scale, sun, focus })) if (v != null) url.searchParams.set(k, v)
    await page.goto(url.toString())
    await page.waitForFunction(() => window.__preview != null)
    try {
      const info = await page.evaluate(() => window.__preview.ready)
      const image = await page.locator('canvas').screenshot({ type: 'jpeg', quality: 90 })
      const file = join(outDir, `${name}-${n}${suffix}.jpg`)
      await writeFile(file, image)
      console.log(`${file}  size ${info.size.join(' × ')} m  ${info.triangles} tris  ${call}`)
      for (const m of messages.gl()) console.log(`  ⚠ GL: ${m}`)
      return image
    } catch (error) {
      console.log(`✗ ${suffix === '' ? '' : `(${ref}) `}${call}: ${error.message.split('\n')[0]}`)
      return null
    }
  }
  const now = await shoot(baseUrl, '')
  if (old == null) continue
  const before = await shoot(old.url, '.ref')
  if (now == null || before == null) continue
  // Stacked: the ref above, now below, labelled.
  const src = b => `data:image/jpeg;base64,${b.toString('base64')}`
  await page.setViewportSize({ width: Number(width), height: Number(height) * 2 })
  await page.setContent(`<body style="margin:0;background:#222;font:600 22px system-ui;color:#fff"><div style="position:relative"><img src="${src(before)}" style="display:block"><span style="position:absolute;left:12px;top:8px;text-shadow:0 0 4px #000">${ref}</span></div><div style="position:relative"><img src="${src(now)}" style="display:block"><span style="position:absolute;left:12px;top:8px;text-shadow:0 0 4px #000">now</span></div></body>`)
  const file = join(outDir, `${name}-${n}.compare.jpg`)
  await writeFile(file, await page.screenshot({ type: 'jpeg', quality: 88, fullPage: true }))
  await page.setViewportSize({ width: Number(width), height: Number(height) })
  console.log(file)
}
await browser.close()
