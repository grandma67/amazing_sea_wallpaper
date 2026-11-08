// How does the frame haze these objects? Renders a spec twice: as is, and with
// the haze off (aerial perspective and the sea haze; the clouds and their light
// stay), probes each world point in both, and solves pixel = T·raw + w·H for the
// haze colour H each point implies, under two weightings of the inscatter:
// w = 1 − T (the textbook) and w = (1 − T)² (takram's sea haze mixes an
// opacity-scaled colour by its opacity again). T is Koschmieder's (3.912/V,
// with the air's colours: seaHaze.ts) over the camera → point distance. The
// right weighting is the one that gives every point the same H. Use it before
// writing anything that must match the frame's haze (a reflection, a sprite,
// a far mesh). Guide: knowledge/tools/RENDER.md.
//
//   node scripts/haze.mjs --scene SPEC --points '[[x,y,z],…]' [--sky '{"az":0,"el":1}']
//
// --points  world points (m) on the objects, near and far: params.mjs --project
//           KIND --above 20 prints x, y (above) and z. At least two distances.
// --sky     a sky probe for reference (default 1° above the horizon, straight
//           ahead): the colour a fully hazed object should reach.
// --out DIR (out/haze)  --w --h --frames --url   passed to snapshot.mjs (1080p, 16)
//
// Caveats: Koschmieder's T assumes the haze's sea-level density along the
// whole path (takram thins it with height over a 1 km scale height: fine for
// points under ~100 m); the air's extinction is Bruneton's sea-level value.

import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'

import { merge, parseArgs, readJson, readSpecs } from './lib.mjs'

const { option, rejectUnknown, rejectPositional } = parseArgs()
const sceneArg = option('scene', null)
const pointsArg = option('points', null)
const skyArg = option('sky', '{"az":0,"el":1}')
const outDir = resolve(option('out', 'out/haze'))
const defaults = { w: '1920', h: '1080', frames: '16' }
const render = ['w', 'h', 'frames', 'url'].flatMap(k => {
  const v = option(k, defaults[k] ?? null)
  return v == null ? [] : [`--${k}`, v]
})
rejectUnknown()
rejectPositional('haze.mjs takes only options')
if (sceneArg == null || pointsArg == null) throw new Error('give --scene SPEC and --points [[x,y,z],…]')

const { specs } = await readSpecs(sceneArg)
if (specs.length !== 1) throw new Error('haze.mjs takes one spec')
const points = JSON.parse(pointsArg)
if (!Array.isArray(points) || points.length === 0 || !points.every(p => Array.isArray(p) && p.length === 3)) throw new Error('--points is a list of [x, y, z]')
const sky = JSON.parse(skyArg)

const server = await createServer({ cacheDir: resolve('node_modules/.vite-params'), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
let air
try {
  ;({ AIR_EXTINCTION: air } = await server.ssrLoadModule('/src/seaHaze.ts'))
} finally {
  await server.close()
}

const probe = [...points.map(world => ({ world })), sky]
const debug = passes => ({ params: { debug: { probe, probeHalf: 1, ...(passes != null ? { passes } : {}) } } })
const runs = { hazed: merge(specs[0], debug(null)), raw: merge(specs[0], debug({ aerial: false, seaHaze: false })) }
await mkdir(outDir, { recursive: true })
const results = {}
for (const [name, spec] of Object.entries(runs)) {
  const file = join(outDir, `${name}.spec.json`)
  await writeFile(file, JSON.stringify({ ...spec, name }))
  const run = spawnSync('node', ['scripts/snapshot.mjs', '--out', outDir, ...render, '--scene', file], { encoding: 'utf8' })
  if (run.status !== 0) throw new Error(`snapshot.mjs failed:\n${run.stdout}\n${run.stderr}`)
  results[name] = JSON.parse(await readFile(join(outDir, `${name}.json`), 'utf8'))
}

const p = results.hazed
const cam = p.debug.cameraPosition
const V = p.visibilityKm * 1000
// The sea haze only exists where the clouds pass runs (any cloud, or dust).
const seaHaze = p.weather.kind !== 'clear' || p.weather.dust != null
const haze = seaHaze ? Math.max(3.912 / V - air[1], 0) : 0
const f = (v, d = 4) => v.map(x => x.toFixed(d)).join(' ')
const skyMean = p.debug.probe[points.length].raw?.mean
console.log(`${p.date}: visibility ${(V / 1000).toFixed(1)} km, sea haze ${seaHaze ? haze.toExponential(2) + ' /m' : 'none (clear, no dust)'}; out ${outDir}`)
console.log(`sky reference ${JSON.stringify(sky)}: ${skyMean != null ? f(skyMean) : 'out of frame'}`)
console.log('   dist m   T (R G B)              raw                    hazed                  H if 1−T               H if (1−T)²')
for (let i = 0; i < points.length; i++) {
  const [h, r] = [results.hazed.debug.probe[i], results.raw.debug.probe[i]]
  const d = Math.hypot(points[i][0] - cam[0], points[i][1] - cam[1], points[i][2] - cam[2])
  if (h.pixel == null || r.pixel == null) {
    console.log(`${d.toFixed(0).padStart(9)}   out of frame`)
    continue
  }
  const T = air.map(a => Math.exp(-(a + haze) * d))
  const implied = w => h.raw.mean.map((x, k) => (x - T[k] * r.raw.mean[k]) / Math.max(w(T[k]), 1e-6))
  console.log(
    `${d.toFixed(0).padStart(9)}   ${f(T, 3).padEnd(22)} ${f(r.raw.mean).padEnd(22)} ${f(h.raw.mean).padEnd(22)} ${f(implied(t => 1 - t)).padEnd(22)} ${f(implied(t => (1 - t) ** 2))}`
  )
}
console.log('The weighting whose H agrees across distances is the one the frame uses.')
