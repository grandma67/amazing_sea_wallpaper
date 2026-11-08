// Does the sea reflect the sky it should near the horizon? One render with
// probes at mirrored angles: the frame's sky at +el, the sea at −el (calm
// water at grazing angle el should read ~F(el) × that sky: Fresnel, Schlick
// as ocean.ts), and the sky cube the water reads (debug.cubeProbe) at +el,
// sharp and blurred. Prints per angle:
//   sea / (F × sky)  ~1 on calm water; below 1 is a dark reflection. Rough
//                    water sits lower (it mirrors a spread of sky, which
//                    darkens with height): read it with the wind printed.
//   cube / sky       ~1: the cube holds the frame's sky. Off 1 is a cube bug.
//   cube lod N / sky how much a rough sea's blur pulls in (below the horizon
//                    the real cube holds a dark ground; the water reads a
//                    folded cube, reflection.ts foldedSkyCube).
// This was REFLECTION.md phase 6's diagnosis, as one command: the sea at
// −1° had matched the sky at +4° (its ray aimed 5.7° high), and the
// "dark cube" suspected for it read the same as the frame.
// Guide: knowledge/tools/RENDER.md.
//
//   node scripts/horizon.mjs --scene SPEC [--az 0] [--els 0.3,0.5,1,2,4] [--lod 5]
//
// --az A        azimuth from the view (deg, + right): aim at open sea, away from
//               land, islands and the sun's glitter
// --els LIST    elevations (deg) to mirror (default 0.3,0.5,1,2,4)
// --lod N       the blurred cube level to read beside the sharp one (default 5)
// --out DIR (out/horizon)  --w --h --frames --url   passed to snapshot.mjs
//
// Force calm water to read the reflection itself:
//   "params": {"ocean": {"windSpeed": 0.5, "airWindSpeed": 0.5, "swellHeight": 0.2}}

import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { merge, parseArgs, readSpecs } from './lib.mjs'

const { option, rejectUnknown, rejectPositional } = parseArgs()
const sceneArg = option('scene', null)
const az = Number(option('az', 0))
const els = option('els', '0.3,0.5,1,2,4').split(',').map(Number)
const lod = Number(option('lod', 5))
const outDir = resolve(option('out', 'out/horizon'))
const defaults = { w: '1920', h: '1080', frames: '16' }
const render = ['w', 'h', 'frames', 'url'].flatMap(k => {
  const v = option(k, defaults[k] ?? null)
  return v == null ? [] : [`--${k}`, v]
})
rejectUnknown()
rejectPositional('horizon.mjs takes only options')
if (sceneArg == null) throw new Error('give --scene SPEC (one spec)')
if (els.some(e => !Number.isFinite(e) || e <= 0 || e >= 45)) throw new Error('--els are elevations in (0, 45) degrees')

const { specs } = await readSpecs(sceneArg)
if (specs.length !== 1) throw new Error('horizon.mjs takes one spec')
const probe = els.flatMap(el => [{ az, el }, { az, el: -el }])
const cubeProbe = els.flatMap(el => [{ az, el, lod: 0 }, { az, el, lod }])
const spec = merge(specs[0], { name: 'horizon', params: { debug: { probe, probeHalf: 1, cubeProbe } } })
await mkdir(outDir, { recursive: true })
const file = join(outDir, 'horizon.spec.json')
await writeFile(file, JSON.stringify(spec))
const run = spawnSync('node', ['scripts/snapshot.mjs', '--out', outDir, ...render, '--scene', file], { encoding: 'utf8' })
if (run.status !== 0) throw new Error(`snapshot.mjs failed:\n${run.stdout}\n${run.stderr}`)
const p = JSON.parse(await readFile(join(outDir, 'horizon.json'), 'utf8'))

const green = r => r?.raw?.mean?.[1]
const fresnel = el => 0.02 + 0.98 * (1 - Math.sin((el * Math.PI) / 180)) ** 5
const f = (v, d = 2) => (v == null || !Number.isFinite(v) ? '   -' : v.toFixed(d).padStart(5))
console.log(`${p.date}: ${p.weather.kind}, wind ${p.ocean.windSpeed.toFixed(1)} m/s, sun ${p.sunElevationDeg.toFixed(1)}°, az ${az}; ${join(outDir, 'horizon.jpg')}`)
if (p.ocean.windSpeed > 2) console.log('  (rough water: sea / (F × sky) sits below 1 by design; force a calm sea to test the reflection itself)')
console.log('    el     sky (G)    sea (G)     F   sea/(F·sky)  cube/sky  cube lod ' + lod + '/sky')
els.forEach((el, i) => {
  const [sky, sea] = [p.debug.probe[2 * i], p.debug.probe[2 * i + 1]]
  const [cube, blurred] = [p.debug.cubeProbe[2 * i], p.debug.cubeProbe[2 * i + 1]]
  const s = green(sky)
  const ratio = (sea.pixel == null || sky.pixel == null) ? NaN : green(sea) / (fresnel(el) * s)
  console.log(
    `  ${String(el).padStart(4)}   ${s != null ? s.toExponential(2) : 'out'}   ${green(sea) != null ? green(sea).toExponential(2) : 'out  '}   ${f(fresnel(el))}   ${f(ratio).padStart(9)}   ${f(cube.raw[1] / s).padStart(8)}   ${f(blurred.raw[1] / s).padStart(10)}`
  )
})
console.log('Calm water: sea/(F·sky) ≈ 1 and cube/sky ≈ 1. A sea ratio that drops near the horizon while cube/sky stays 1: the reflected ray, not the cube.')
