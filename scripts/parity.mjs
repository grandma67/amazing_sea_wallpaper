// Do the CPU mirrors match the drawn terrain? Renders days with a grid of
// the terrain shader's own terms (params.debug.terrainProbe: world x, z,
// height h, pools, snow), then evaluates the TS mirrors at the same world
// points with the params the render saved: terrainHeight (camera height,
// props, p.view all stand on it), waterFilms poolAt (p.pools) and
// groundCover groundCoverAt (mushrooms, fireflies, groundSeen stand on it). Prints
// per day and per coast kind: |Δh| median / p99 / max, the share past
// --tol, the worst sample (to probe further), and pool pixels GPU vs CPU.
// Built after the TS bareRock had drifted from the shader for many
// versions unseen (0.137): run it after any edit to a height or film term,
// in GLSL or TS. Guide: knowledge/tools/RENDER.md.
//
//   node scripts/parity.mjs [--sample 12] [--where EXPR] [--every 16] [--tol 0.02]
//   node scripts/parity.mjs --scene scenes/wet-mirror.json
//   node scripts/parity.mjs 2024-06-13 2025-07-10
//
// Days: DATEs, or --scene SPEC (debug merged in), or real land days spread
// across coast kinds (--where, default not open sea; --sample N, default 12).
// --every N (16)  grid step in px of the render; --tol M (0.02) metres;
// --cover-tol (0.1) the ground cover mirror's p95 |Δ| (groundCover.ts, pixels < 0.5 m)
// --out DIR (out/parity)  --w 960 --h 540 --url   passed to snapshot.mjs (1 frame)
// Exit code 1 when a day's p99 |Δh| or pool mismatch is past the tolerances.

import { execFileSync, spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createServer } from 'vite'

import { merge, parseArgs, readSpecs } from './lib.mjs'

const { args, option, rejectUnknown } = parseArgs()
const sceneArg = option('scene', null)
const where = option('where', 'p => p.coast.type !== "open-sea"')
const sample = option('sample', '12')
const every = Number(option('every', 16))
const tol = Number(option('tol', 0.02))
const coverTol = Number(option('cover-tol', 0.1))
const outDir = resolve(option('out', 'out/parity'))
const render = [['w', '960'], ['h', '540'], ['url', null]].flatMap(([k, d]) => {
  const v = option(k, d)
  return v == null ? [] : [`--${k}`, v]
})
rejectUnknown()

const TERMS = ['x', 'z', 'h', 'pools', 'snow', 'cover', 'footprint']
const debug = { params: { debug: { terrainProbe: { terms: TERMS, every } } } }

/** The specs to render: given dates, a spec file, or real days. */
async function specs() {
  if (sceneArg != null) return (await readSpecs(sceneArg)).specs.map((s, i) => merge({ name: s.name ?? s.date ?? `scene-${i + 1}`, ...s }, debug))
  let dates = args
  if (dates.length === 0) {
    const out = execFileSync(process.execPath, ['scripts/params.mjs', '--where', where, '--sample', sample, '--spread', 'p => p.coast.type + "/" + (p.coast.rock?.kind ?? "")'], { encoding: 'utf8' })
    dates = out.split('\n').filter(l => /^\d{4}-\d{2}-\d{2}$/.test(l))
  }
  return dates.map(date => merge({ name: date, date }, debug))
}

const list = await specs()
if (list.length === 0) throw new Error('no days to check')
await mkdir(outDir, { recursive: true })
const file = join(outDir, 'parity.specs.json')
await writeFile(file, JSON.stringify(list))
console.log(`[parity] rendering ${list.length} day(s), grid every ${every} px`)
const run = spawnSync(process.execPath, ['scripts/snapshot.mjs', '--out', outDir, ...render, '--frames', '1', '--scene', file], { encoding: 'utf8' })
if (run.status !== 0) throw new Error(`snapshot.mjs failed:\n${run.stdout}\n${run.stderr}`)

const server = await createServer({ root: process.cwd(), cacheDir: resolve('node_modules/.vite-params'), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
const [{ terrainHeight }, { poolAt }, { groundCoverAt }] = await Promise.all([server.ssrLoadModule('/src/terrain.ts'), server.ssrLoadModule('/src/waterFilms.ts'), server.ssrLoadModule('/src/groundCover.ts')])

const quantile = (sorted, q) => (sorted.length === 0 ? NaN : sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))])
const fmt = v => (Number.isFinite(v) ? (v < 0.001 ? v.toExponential(0) : v.toFixed(3)) : '–')
const byKind = new Map()
let failed = false
console.log('day                    coast                 samples  |Δh| med    p99     max   >tol   pools GPU/CPU/differ  worst (image x,y: GPU h → CPU h)')
for (const spec of list) {
  const p = JSON.parse(await readFile(join(outDir, `${spec.name}.json`), 'utf8'))
  const grid = p.debug?.terrainProbe?.grid
  if (grid == null) throw new Error(`${spec.name}: no terrainProbe grid in the render (an old commit?)`)
  const kind = p.coast.type + (p.coast.rock ? `/${p.coast.rock.kind}` : '') + (p.seaIce ? ' +ice' : '') + (p.snow ? ' +snow' : '')
  const errors = []
  let worst = null
  let gpuPools = 0
  let cpuPools = 0
  let differ = 0
  // Ground cover (groundCover.ts) where a pixel is under 0.5 m: further off
  // the shader's slope sample grows with the pixel and the two part, rightly.
  const coverErrors = []
  for (const [fx, fy, x, z, h, pools, snow, cover, footprint] of grid.samples) {
    if (footprint < 0.5 && h > 0.3 && snow <= 0.5) coverErrors.push(Math.abs(groundCoverAt(p.coast, x, z) - cover))
    const cpu = terrainHeight(p.coast, x, z)
    const e = Math.abs(cpu - h)
    errors.push(e)
    if (worst == null || e > worst.e) worst = { e, fx, fy, h, cpu }
    const gpuPool = pools > 0.5 && snow <= 0.5 && h >= 0
    const cpuPool = poolAt(p, x, z).isPool
    gpuPools += gpuPool ? 1 : 0
    cpuPools += cpuPool ? 1 : 0
    differ += gpuPool !== cpuPool ? 1 : 0
  }
  errors.sort((a, b) => a - b)
  const n = errors.length
  const past = errors.filter(e => e > tol).length / Math.max(n, 1)
  const p99 = quantile(errors, 0.99)
  const poolBad = differ > Math.max(2, 0.2 * Math.max(gpuPools, cpuPools))
  coverErrors.sort((a, b) => a - b)
  const coverP95 = quantile(coverErrors, 0.95)
  const coverBad = coverErrors.length > 20 && coverP95 > coverTol
  const bad = p99 > tol || poolBad || coverBad
  failed ||= bad
  const k = byKind.get(kind) ?? { errors: [], days: 0, differ: 0, pools: 0 }
  k.errors.push(...errors)
  k.days++
  k.differ += differ
  k.pools += Math.max(gpuPools, cpuPools)
  byKind.set(kind, k)
  const w = worst == null ? '' : `[${worst.fx.toFixed(3)}, ${worst.fy.toFixed(3)}]: ${worst.h.toFixed(3)} → ${worst.cpu.toFixed(3)}`
  console.log(
    `${spec.name.padEnd(22)} ${kind.padEnd(21)} ${String(n).padStart(7)}  ${fmt(quantile(errors, 0.5)).padStart(7)} ${fmt(p99).padStart(7)} ${fmt(errors[n - 1]).padStart(7)}  ${(past * 100).toFixed(1).padStart(4)}%   ${`${gpuPools}/${cpuPools}/${differ}`.padStart(14)}   cover |Δ| p95 ${coverErrors.length > 0 ? fmt(coverP95) : '–'} (${coverErrors.length})   ${w}${bad ? '  ⚠' : ''}`
  )
}
console.log('\nby coast kind:')
for (const [kind, k] of byKind) {
  k.errors.sort((a, b) => a - b)
  console.log(`  ${kind.padEnd(24)} ${String(k.days).padStart(2)} day(s)  |Δh| p99 ${fmt(quantile(k.errors, 0.99))}  max ${fmt(k.errors[k.errors.length - 1])}  pool pixels differing ${k.differ} of ${k.pools}`)
}
console.log(
  failed
    ? `\n⚠ a mirror is off on some day (p99 |Δh| > ${tol} m or pools differ): probe its worst point with params.debug.terrainProbe ({"terms": [...], "at": [[x, y]]}) and compare the terms with the TS ones (knowledge/tools/DEBUG.md "Terrain terms").`
    : `\nThe TS mirrors match the drawn terrain (p99 |Δh| ≤ ${tol} m, pools agree).`
)
await server.close()
process.exit(failed ? 1 : 0)
