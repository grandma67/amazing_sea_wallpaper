// Ask the scene generator without rendering (~1.5 s for all test days).
// Guide: knowledge/tools/PARAMS.md.
//
//   node scripts/params.mjs [OPTIONS] [DATE...]
//
// DATE: YYYY-MM-DD or FROM..TO. None: the test days (1095 from 2024-01-01),
//   or a spec's own "date".
// --scene SPEC     JSON file or inline; applied to every day. A { base, scenes }
//                  file runs each scene under its name. DATEs replace a spec's date.
// --fields a.b,c   what to print (default title). With --ref: ALSO NARROWS the
//                  comparison to those fields.
// --where EXPR     keep days where 'p => …' is true (with --ref: each side's own).
// --stats EXPR     count the values 'p => …' returns (each array element), with shares.
// --each EXPR      one line per day: the date and what 'p => …' returns (an error
//                  says so on its line). With --where: from "how many" to "which".
// --list           one line per day (with --ref: each changed day, before → after).
// --limit N        lines listed (default all; 20 with --ref).
// --sample N       print N dates of the days kept by --where, one per line, spread
//                  across --spread EXPR (default place, coast, time of day): the
//                  largest groups first, one day each, then round again.
// --spread EXPR    what to spread a --sample over: 'p => …', any value.
// --expect EXPR    over the place table, weighted by share of days: numbers
//                  averaged, the rest counted, null skips the place. No sampling.
// --weight EXPR    with --expect: weigh each place by its share of days × 'pl => …'
//                  as well: a share on a subset of days ("sand on beach days": weight
//                  by pl.coast.beach). Prints the subset's share of all days.
// --schema PREFIX  every field path over the test days (or the given days/spec), with
//                  its type, values (strings, ≤ 12) or range (numbers), and on how many
//                  days it's set: for writing --where without guessing names. PREFIX
//                  narrows ("coast", "props.debris"); "all" for everything.
// --count KINDS    what a prop places, by piece (implies --rendered): per kind
//                  (comma-separated, or all) and sub-kind (userData.plantKind, .kind,
//                  or --by 'o => …' over each mesh, e.g. 'o => o.userData.blossom'),
//                  pieces placed and in frame and the nearest in frame. Over many days
//                  (> --limit, default 12 here): only the summary (days with any in
//                  frame, median and max in frame). For "is it in frame on real days".
// --ref REF        compare with a commit (temporary worktree): days changed per
//                  top-level param; with --stats, shares side by side (⚠ ≥ 5 pts).
// --changed EXPR   with --ref: count 'p => …' over the changed days (now's params).
// --rendered       the params the page renders (generateSceneParams re-rolls a
//                  bad framing); slower. Without it, expressions that read the
//                  camera (p.ctx, p.view) get a warning when the page's framing
//                  differs (first 40 days checked). A re-roll changes only coast and
//                  camera height, so choices and frequencies don't need it.
// --project KINDS  where props land, without a render (with each point's x, z and its
//                  mirror image's pixel, for params.debug.probe {world}/{mirror}): builds the props on the
//                  params the page renders (implies --rendered). Per kind (from
//                  props/index.ts, comma-separated, or all): pieces, in frame, pixel
//                  box, nearest; then the --rows nearest points in frame (default
//                  12): distance, shore s and a, height, height above the ground,
//                  pixel. For "where does this end / what's next to the camera".
// --above M        with --project: only points at least M above the sea (a face, not
//                  the underwater skirt), e.g. to probe an island and its mirror image.
//                  "covered by": a prop between the camera and the point (props only,
//                  not the terrain; checked when ≤ 20000 rows): don't probe it there.
// --line LINE      a line of sky pixels through the CPU mirrors of the sky
//                  shaders (skyMirror.ts): '{"az":0,"el":[2,40],"step":0.05}' or a
//                  list of them, az
//                  from the view as params.debug.probeLine. Prints bands vs
//                  ripple, grain and the shape per day; compare with the render's
//                  line probe. --sky aurora,glow (default both, summed: cd/m²;
//                  glow includes the Milky Way); --jitters N layer offsets
//                  averaged (default 8; 1 = one pixel's view).
//
// In expressions, besides SceneParams: p.props (props/choices.ts on the
// render's streams), p.placeData (places.ts Place), p.view (composition.ts
// frameView at 1080p), p.pools (waterFilms.ts nearestPool: the nearest pool
// in frame, m and image point, pool m² within 15 m; no render, nothing hides
// it), p.ctx (PropContext at 1080p, no wave field), and
// src.X / props.X (src/X.ts, src/props/X.ts; on --ref both sides see this tree's).
//
//   node scripts/params.mjs --stats 'p => p.weather.formations' --where 'p => p.sea.ocean === "southern"'
//   node scripts/params.mjs --scene '{"waterspout":true}' --fields waterspout,weather.formations 2024-09-06
//   node scripts/params.mjs --expect 'pl => pl.biome === "tropical" ? pl.reef : null'
//   node scripts/params.mjs --ref HEAD --changed 'p => p.place.climate'
//   node scripts/params.mjs --where 'p => p.lighthouse?.lit' --each 'p => [p.place.id, p.coast.type]'
//   node scripts/params.mjs --scene scenes/aurora.json --line '{"az":-30,"el":[8,30]}' --sky aurora
//   node scripts/params.mjs --scene '{"saltMarsh":true}' --stats 'p => props.saltMarsh.createSaltMarsh(p.ctx).length' 2025-07-01..2025-07-10

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

import { expandDates, parseArgs, propPoints, readSpecs, spreadSample, TEST_DAYS, worktree } from './lib.mjs'

const { args, option, flag, rejectUnknown } = parseArgs()
if (flag('help') || flag('h')) {
  const self = await readFile(fileURLToPath(import.meta.url), 'utf8')
  console.log(self.slice(0, self.indexOf('\nimport ')).replace(/^\/\/ ?/gm, ''))
  process.exit(0)
}
const sceneArg = option('scene', null)
const fieldsArg = option('fields', null)
const fields = (fieldsArg ?? 'title').split(',').filter(Boolean)
const where = option('where', null)
const stats = option('stats', null)
const each = option('each', null)
const ref = option('ref', null)
const expect = option('expect', null)
const changedArg = option('changed', null)
const list = flag('list')
const lineArg = option('line', null)
const projectArg = option('project', null)
const weightArg = option('weight', null)
const schemaArg = option('schema', null)
const countArg = option('count', null)
const byArg = option('by', null)
// --project: only points at least this high above the sea (m): a face, not a skirt.
const aboveArg = option('above', null)
const above = aboveArg == null ? null : Number(aboveArg)
const rendered = flag('rendered') || projectArg != null || countArg != null
const rows = Number(option('rows', 12))
const skyArg = option('sky', 'aurora,glow')
const jitters = Number(option('jitters', 8))
const limitArg = option('limit', null)
const limit = Number(limitArg ?? (ref != null ? 20 : 1e9))
const sample = Number(option('sample', 0))
const spreadArg = option('spread', 'p => [p.place.id, p.coast.type, p.timeOfDay]')
rejectUnknown()
if (weightArg != null && expect == null) throw new Error('--weight goes with --expect')
if (byArg != null && countArg == null) throw new Error('--by goes with --count')

const given = expandDates(args)
const FRAMING_CHECKS = 40

/** The specs to run: one (unnamed), or each scene of a list or scenes file. */
async function specs() {
  if (sceneArg == null) return [{ name: null, spec: {} }]
  const { specs, multi } = await readSpecs(sceneArg)
  return specs.map((spec, i) => ({ name: multi ? (spec.name ?? `scene-${i + 1}`) : null, spec }))
}

/** Given DATEs win over a spec's own date; without either, the test days. */
function datesFor(spec) {
  if (given.length > 0) {
    const { date: _, ...rest } = spec
    return { spec: rest, dates: given }
  }
  return { spec, dates: spec.date != null ? [spec.date] : TEST_DAYS }
}

const get = (p, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), p)
const fn = expr => (expr == null ? null : (0, eval)(expr))
const keep = fn(where) ?? (() => true)

/** The generator from a source tree (this one, or a worktree for --ref). */
async function load(root) {
  // The worktree's deps cache stays in this tree's node_modules, so nothing
  // is written into the worktree while git removes it.
  const server = await createServer({ root, cacheDir: resolve('node_modules/.vite-params'), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  const mod = path => server.ssrLoadModule(path)
  const [{ generateParams }, { parseSceneSpec }, { propChoices }, { frameView, generateSceneParams }, places, { createCamera }, { PropContext }] = await Promise.all([
    mod('/src/params.ts'),
    mod('/src/sceneSpec.ts'),
    mod('/src/props/choices.ts'),
    mod('/src/composition.ts'),
    // Older refs may not have places.ts.
    mod('/src/places.ts').catch(() => ({})),
    mod('/src/camera.ts'),
    mod('/src/props/context.ts')
  ])
  // Older refs may not have waterFilms.ts.
  const waterFilms = existsSync(resolve(root, 'src/waterFilms.ts')) ? await mod('/src/waterFilms.ts') : {}
  /** Is this the camera the page renders? Asked only when an expression reads
   * the camera, and only for the first days: measuring a frame isn't free. */
  const framing = { checked: 0, differ: 0, example: null }
  const checkFraming = (p, date, spec) => {
    if (rendered || framing.checked >= FRAMING_CHECKS) return
    framing.checked++
    const shown = generateSceneParams(date, 16 / 9, spec)
    const key = q => JSON.stringify([q.camera, q.coast?.composition, q.coast?.distanceToWater])
    if (key(shown) === key(p)) return
    framing.differ++
    framing.example ??= `${date}: camera height ${p.camera.heightM.toFixed(2)} m here, ${shown.camera.heightM.toFixed(2)} m on the page`
  }
  const day = (date, spec) => {
    const p = rendered ? generateSceneParams(date, 16 / 9, spec) : generateParams(date, 0, 16 / 9, spec)
    const out = { ...p, props: propChoices(p) }
    // Computed only when asked for (it marches rays over the terrain).
    Object.defineProperty(out, 'view', {
      get: () => {
        checkFraming(p, date, spec)
        return frameView(p)
      },
      enumerable: false
    })
    // The nearest pool in frame (waterFilms.ts, ~0.1–0.4 s a day): only when asked.
    Object.defineProperty(out, 'pools', {
      get: () => {
        checkFraming(p, date, spec)
        return waterFilms.nearestPool?.(p) ?? null
      },
      enumerable: false
    })
    // Not enumerable either: it isn't a param, so --ref doesn't count it.
    Object.defineProperty(out, 'placeData', { get: () => places.PLACES?.find(pl => pl.id === p.place?.id), enumerable: false })
    // The props' PropContext at 1080p (as test/days.ts viewOf): the render's
    // camera and frustum, no wave field (seaLevel 0). Built once, on first use.
    let ctx = null
    Object.defineProperty(out, 'ctx', {
      get: () => {
        if (ctx == null) {
          checkFraming(p, date, spec)
          const { camera } = createCamera(p, p.camera.aspect * 1080, 1080)
          ctx = new PropContext(p, camera, null, (camera.fov * Math.PI) / 180 / 1080)
        }
        return ctx
      },
      enumerable: false
    })
    return out
  }
  return { server, mod, parseSceneSpec, day, framing, places: places.PLACES ?? [] }
}

function countStats(days) {
  const of = fn(stats)
  const counts = new Map()
  for (const p of days) {
    let value
    try {
      value = of(p)
    } catch {
      value = undefined // a field this side doesn't have
    }
    for (const v of new Set(Array.isArray(value) ? value.map(x => JSON.stringify(x)) : [JSON.stringify(value) ?? 'undefined'])) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return counts
}

/** Warn when what was just printed came from a camera the page wouldn't use. */
function warnFraming({ checked, differ, example }) {
  if (differ === 0) return
  console.log(`⚠ framing: on ${differ} of the ${checked} days checked the page renders another camera (${example}). Anything read from p.ctx or p.view is for a frame nobody sees: add --rendered.`)
}

const pct = (n, total) => (100 * n) / Math.max(1, total)

function printStats(days) {
  const counts = countStats(days)
  console.log(`${days.length} days`)
  for (const [v, n] of [...counts].sort((a, b) => b[1] - a[1]))
    console.log(`${String(n).padStart(6)}  ${pct(n, days.length).toFixed(1).padStart(5)}%  ${v}`)
}

/** Shares at the ref and now, side by side. */
function printStatsVs(before, now, sha) {
  const a = countStats(before)
  const b = countStats(now)
  console.log(`${before.length} days at ${sha}, ${now.length} now`)
  console.log(`${sha.padStart(14)}   ${'now'.padStart(13)}   change`)
  const values = [...new Set([...a.keys(), ...b.keys()])].sort((x, y) => (b.get(y) ?? 0) - (b.get(x) ?? 0) || (a.get(y) ?? 0) - (a.get(x) ?? 0))
  for (const v of values) {
    const pa = pct(a.get(v) ?? 0, before.length)
    const pb = pct(b.get(v) ?? 0, now.length)
    const d = pb - pa
    const cell = (n, p) => `${String(n).padStart(6)} ${p.toFixed(1).padStart(5)}%`
    console.log(`${cell(a.get(v) ?? 0, pa)}   ${cell(b.get(v) ?? 0, pb)}   ${(d >= 0 ? '+' : '') + d.toFixed(1)} pts${Math.abs(d) >= 5 ? '  ⚠' : ''}  ${v}`)
  }
}

/** One line per day: its date and what `each` returns. */
function printEach(days) {
  const of = fn(each)
  console.log(`${days.length} days`)
  for (const p of days.slice(0, limit)) {
    let value
    try {
      value = JSON.stringify(of(p)) ?? 'undefined'
    } catch (error) {
      value = `error: ${error instanceof Error ? error.message : String(error)}`
    }
    console.log(`${p.date}  ${value}`)
  }
  if (days.length > limit) console.log(`… ${days.length - limit} more days not shown (--limit ${limit})`)
}

function printDays(days) {
  if (list || days.length > 1) {
    console.log(`${days.length} days`)
    for (const p of days.slice(0, limit)) console.log([p.date, ...fields.map(f => JSON.stringify(get(p, f)))].join('  '))
    if (days.length > limit) console.log(`… ${days.length - limit} more days not shown (--limit ${limit})`)
  } else {
    for (const p of days) console.log(p.date, JSON.stringify(Object.fromEntries(fields.map(f => [f, get(p, f)])), null, 1))
  }
}

const plain = v => v != null && typeof v === 'object' && !Array.isArray(v)
/** `now` with only the keys `before` has: a field added since the ref isn't
 * a change on every day (it's listed once as new). */
const project = (now, before) => (plain(now) && plain(before) ? Object.fromEntries(Object.keys(before).map(k => [k, project(now[k], before[k])])) : now)
/** The leaves that differ, as [dotted path, before, now]. */
const leaves = (before, now, path) =>
  plain(before) && plain(now)
    ? Object.keys(before).flatMap(k => leaves(before[k], now[k], `${path}.${k}`))
    : JSON.stringify(before) === JSON.stringify(now)
      ? []
      : [[path, before, now]]
/** Dotted paths in `now` that `before` doesn't have. */
const added = (now, before, path = '') =>
  plain(now) && plain(before) ? Object.keys(now).flatMap(k => (k in before ? added(now[k], before[k], `${path}${k}.`) : [`${path}${k}`])) : []

/** Now vs the ref, day by day: which fields differ. Without --fields, every
 * top-level param (and the props' choices). */
function printChanges(pairs, sha) {
  const fresh = [...new Set(pairs.flatMap(([before, now]) => added(now, before)))]
  pairs = pairs.map(([before, now]) => [before, Object.assign(project(now, before), { date: now.date, title: now.title })])
  const keys = fieldsArg != null ? fields : [...new Set(pairs.flatMap(([a, b]) => [...Object.keys(a), ...Object.keys(b)]))]
  const counts = new Map(keys.map(k => [k, 0]))
  const changed = []
  for (const [before, now] of pairs) {
    const diff = keys.filter(k => JSON.stringify(get(before, k)) !== JSON.stringify(get(now, k)))
    for (const k of diff) counts.set(k, counts.get(k) + 1)
    if (diff.length > 0) changed.push({ before, now, diff })
  }
  console.log(`${pairs.length} days, ${changed.length} changed vs ${sha}${fieldsArg != null ? ` (in ${fields.join(', ')})` : ''}`)
  for (const [k, n] of [...counts].filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]))
    console.log(`${String(n).padStart(6)}  ${((100 * n) / Math.max(1, pairs.length)).toFixed(1).padStart(5)}%  ${k}`)
  if (fresh.length > 0 && fieldsArg == null) console.log(`  new fields (not counted): ${fresh.join(', ')}`)
  if (changedArg != null) {
    const of = fn(changedArg)
    const counts = new Map()
    for (const { now } of changed) {
      const values = [of(now)].flat()
      for (const v of values) counts.set(JSON.stringify(v), (counts.get(JSON.stringify(v)) ?? 0) + 1)
    }
    console.log(`changed days by ${changedArg}:`)
    for (const [v, n] of [...counts].sort((a, b) => b[1] - a[1]))
      console.log(`${String(n).padStart(6)}  ${((100 * n) / Math.max(1, changed.length)).toFixed(1).padStart(5)}%  ${v}`)
  }
  if (!list) return
  const short = v => {
    const s = JSON.stringify(v) ?? 'undefined'
    return s.length > 120 ? `${s.slice(0, 117)}...` : s
  }
  for (const { before, now, diff } of changed.slice(0, limit)) {
    console.log(`${now.date}  ${now.title}`)
    const all = diff.flatMap(k => leaves(get(before, k), get(now, k), k))
    for (const [path, a, b] of all.slice(0, 8)) console.log(`    ${path}: ${short(a)} → ${short(b)}`)
    if (all.length > 8) console.log(`    … ${all.length - 8} more`)
  }
  if (changed.length > limit) console.log(`… ${changed.length - limit} more changed days not shown (--limit ${limit})`)
}

/** Weighted over the place table: numbers averaged, the rest counted. */
function printExpect(places) {
  const of = fn(expect)
  const by = fn(weightArg) ?? (() => 1)
  const rows = places.map(pl => [of(pl), pl.weight * by(pl)]).filter(([v, w]) => v != null && w > 0)
  const total = rows.reduce((t, [, w]) => t + w, 0)
  const share = places.reduce((t, pl) => t + pl.weight, 0)
  console.log(`${rows.length} of ${places.length} places, ${(100 * total / share).toFixed(1)}% of days${weightArg != null ? ` (weighted by ${weightArg})` : ''}`)
  if (rows.every(([v]) => typeof v === 'number')) {
    console.log(`weighted mean ${(rows.reduce((t, [v, w]) => t + v * w, 0) / total).toFixed(4)}`)
    return
  }
  const counts = new Map()
  for (const [v, w] of rows) counts.set(JSON.stringify(v), (counts.get(JSON.stringify(v)) ?? 0) + w)
  for (const [v, w] of [...counts].sort((a, b) => b[1] - a[1])) console.log(`${(100 * w / total).toFixed(1).padStart(6)}%  ${v}`)
}

const here = await load(process.cwd())
// Expressions that name `src.X` or `props.X` get this tree's modules
// (src/X.ts, src/props/X.ts) as globals, loaded up front (they're async to
// load, expressions are not). Modules that need a browser are left out.
if (/\b(src|props)\.\w/.test([where, stats, each, expect, changedArg].join(' '))) {
  const { readdir } = await import('node:fs/promises')
  const browserOnly = new Set(['main', 'renderWorker', 'spectrumWorker', 'assets', 'clouds', 'meshPreview', 'scene'])
  for (const [global, dir] of [['src', 'src'], ['props', 'src/props']]) {
    const modules = {}
    for (const file of (await readdir(dir)).filter(f => f.endsWith('.ts'))) {
      const name = file.slice(0, -3)
      if (browserOnly.has(name)) continue
      modules[name] = await here.mod(`/${dir}/${file}`).catch(() => undefined)
    }
    globalThis[global] = modules
  }
}
if (lineArg != null) {
  // A mirror line per day: the summed sources along it.
  const lines = [JSON.parse(lineArg)].flat()
  const sources = skyArg.split(',')
  const [mirror, aurora, glow, { milkyWayMap }] = await Promise.all([
    here.mod('/src/skyMirror.ts'),
    here.mod('/src/aurora.ts'),
    here.mod('/src/nightGlow.ts'),
    import('../test/milkyWayMap.mjs')
  ])
  const unknown = sources.filter(s => !['aurora', 'glow'].includes(s))
  if (unknown.length > 0) throw new Error(`--sky: unknown ${unknown.join(', ')} (aurora, glow)`)
  const milkyWay = milkyWayMap(glow.MILKY_WAY_LOG2)
  try {
    for (const { name, spec: raw } of await specs()) {
      here.parseSceneSpec(raw)
      const { spec, dates } = datesFor(raw)
      if (name != null) console.log(`== ${name}`)
      for (const p of dates.map(d => here.day(d, spec)).filter(p => keep(p))) {
        const f = (dir, j) =>
          (sources.includes('aurora') && p.aurora != null ? aurora.auroraCdToward(p.aurora, dir, j) : 0) +
          (sources.includes('glow') ? glow.nightSkyCd(p, dir, milkyWay) : 0)
        for (const line of lines) {
          const m = mirror.mirrorLine(p, line, f, jitters)
          console.log(`${p.date}  az ${JSON.stringify(line.az)} el ${JSON.stringify(line.el)}: ${m.stats.summary}; grain ${(100 * m.grain).toFixed(1)}%`)
          console.log(`    ${mirror.sparkline(m.points.map(q => q.value))}`)
        }
      }
    }
  } finally {
    await here.server.close()
  }
  process.exit(0)
}
if (expect != null) {
  try {
    printExpect(here.places)
  } finally {
    await here.server.close()
  }
  process.exit(0)
}
if (schemaArg != null) {
  // Every leaf path: types, values or range, days set.
  const paths = new Map()
  const note = (path, v) => {
    const e = paths.get(path) ?? { days: new Set(), types: new Set(), strings: new Map(), min: Infinity, max: -Infinity }
    paths.set(path, e)
    return e
  }
  const walk = (v, path, date, depth) => {
    if (depth > 6) return
    if (Array.isArray(v)) {
      const e = note(path)
      e.days.add(date)
      e.types.add(`array`)
      for (const x of v.slice(0, 40)) walk(x, `${path}[]`, date, depth + 1)
      return
    }
    if (v != null && typeof v === 'object') {
      for (const [k, x] of Object.entries(v)) walk(x, path === '' ? k : `${path}.${k}`, date, depth + 1)
      return
    }
    const e = note(path)
    e.days.add(date)
    e.types.add(v === null ? 'null' : typeof v)
    if (typeof v === 'string' || typeof v === 'boolean') e.strings.set(String(v), (e.strings.get(String(v)) ?? 0) + 1)
    if (typeof v === 'number') (e.min = Math.min(e.min, v)), (e.max = Math.max(e.max, v))
  }
  try {
    let total = 0
    for (const { spec: raw } of await specs()) {
      here.parseSceneSpec(raw)
      const { spec, dates } = datesFor(raw)
      for (const p of dates.map(d => here.day(d, spec)).filter(p => keep(p))) {
        total++
        walk(p, '', p.date + total, 0)
      }
    }
    const prefix = schemaArg === 'all' ? '' : schemaArg
    const num = v => (Math.abs(v) >= 100 || Number.isInteger(v) ? String(Math.round(v * 10) / 10) : v.toPrecision(3))
    console.log(`${total} days; path  set on  type  values or range`)
    for (const [path, e] of [...paths].filter(([k]) => k.startsWith(prefix)).sort((a, b) => a[0].localeCompare(b[0]))) {
      const types = [...e.types].join('|')
      const values =
        e.strings.size > 0
          ? [...e.strings].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([v]) => JSON.stringify(v)).join(' ') + (e.strings.size > 12 ? ` … (${e.strings.size})` : '')
          : Number.isFinite(e.min)
            ? `${num(e.min)} … ${num(e.max)}`
            : ''
      console.log(`${path}  ${e.days.size === total ? 'all' : `${e.days.size}/${total}`}  ${types}  ${values}`)
    }
  } finally {
    await here.server.close()
  }
  process.exit(0)
}
if (countArg != null) {
  const { createProps } = await here.mod('/src/props/index.ts')
  const { reportProps } = await here.mod('/src/props/report.ts')
  const by = fn(byArg) ?? (o => o.userData.plantKind ?? o.userData.kind ?? '')
  const perDay = Number(limitArg ?? 12)
  try {
    for (const { name, spec: raw } of await specs()) {
      here.parseSceneSpec(raw)
      const { spec, dates } = datesFor(raw)
      if (name != null) console.log(`== ${name}`)
      const days = dates.map(d => here.day(d, spec)).filter(p => keep(p))
      const summary = new Map()
      for (const p of days) {
        const report = reportProps(createProps(p.ctx), p.ctx.camera, 1920, 1080, by)
        const wanted = countArg.split(',')
        const rowsHere = Object.entries(report).filter(([k]) => countArg === 'all' || wanted.includes(k.split('/')[0]))
        if (days.length <= perDay) {
          console.log(`${p.date}  ${p.place.id}, ${p.coast?.type} ${p.coast?.composition}`)
          if (rowsHere.length === 0) console.log(`  nothing placed`)
          for (const [k, r] of rowsHere) console.log(`  ${k.padEnd(28)} ${String(r.placed).padStart(5)} placed ${String(r.inFrame).padStart(5)} in frame   nearest ${r.nearest < 0 ? '-' : `${r.nearest} m`}`)
        }
        for (const [k, r] of rowsHere) {
          const s = summary.get(k) ?? { days: 0, seen: 0, inFrame: [], nearest: Infinity }
          s.days++
          if (r.inFrame > 0) s.seen++
          s.inFrame.push(r.inFrame)
          if (r.nearest >= 0) s.nearest = Math.min(s.nearest, r.nearest)
          summary.set(k, s)
        }
      }
      console.log(`${days.length} days: kind  placed on  in frame on  in frame median / max  nearest`)
      for (const [k, s] of [...summary].sort((a, b) => a[0].localeCompare(b[0]))) {
        const sorted = [...s.inFrame].sort((a, b) => a - b)
        console.log(`  ${k.padEnd(28)} ${String(s.days).padStart(5)} ${String(s.seen).padStart(10)}   ${String(sorted[Math.floor(sorted.length / 2)]).padStart(6)} / ${sorted.at(-1)}   ${Number.isFinite(s.nearest) ? `${s.nearest} m` : '-'}`)
      }
    }
  } finally {
    await here.server.close()
  }
  process.exit(0)
}
if (projectArg != null) {
  const { createProps } = await here.mod('/src/props/index.ts')
  const { reportProps } = await here.mod('/src/props/report.ts')
  const { worldToShore, terrainHeight } = await here.mod('/src/terrain.ts')
  const three = await import('three')
  const [W, H] = [1920, 1080]
  try {
    for (const { name, spec: raw } of await specs()) {
      here.parseSceneSpec(raw)
      const { spec, dates } = datesFor(raw)
      if (name != null) console.log(`== ${name}`)
      for (const p of dates.map(d => here.day(d, spec)).filter(p => keep(p))) {
        const { camera } = p.ctx
        const group = createProps(p.ctx)
        const report = reportProps(group, camera, W, H)
        const wanted = projectArg === 'all' ? Object.keys(report) : projectArg.split(',')
        console.log(`${p.date}  camera height ${p.camera.heightM.toFixed(2)} m, ${p.coast?.composition}, to water ${p.coast?.distanceToWater?.toFixed(1)} m; 1920×1080`)
        for (const kind of wanted) {
          const r = report[kind]
          if (r == null) {
            console.log(`  ${kind}: nothing placed`)
            continue
          }
          console.log(`  ${kind}: ${r.inFrame}/${r.placed} in frame, nearest ${r.nearest} m, box ${JSON.stringify(r.box)}`)
          const points = []
          for (const object of group.children) if (object.userData.prop === kind) propPoints(object, three, {}, points)
          const near = points
            .map(v => ({ v, n: v.clone().project(camera) }))
            .filter(({ v, n }) => n.z < 1 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1 && (above == null || v.y >= above))
            .map(({ v, n }) => ({ v, n, d: Math.hypot(v.x - camera.position.x, v.z - camera.position.z) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, rows)
          if (near.length > 0) console.log('      dist       s       a       y  above        x        z   px         mirror px  covered by')
          const pixel = n => `${Math.round(((n.x + 1) / 2) * W)},${Math.round(((1 - n.y) / 2) * H)}`
          // Is the point hidden behind a prop (or its own front)? A probe at a
          // covered point reads the cover: a palm frond read as a far island.
          // Props only (not the terrain); up to 20000 rows (a ray each, ~25 s).
          group.updateMatrixWorld(true)
          const ray = new three.Raycaster()
          const kindOf = o => {
            for (let q = o; q != null; q = q.parent) if (q.userData?.prop != null) return q.userData.prop
            return '?'
          }
          const cover = (v, toward) => {
            if (near.length > 20000) return 'unchecked'
            const dist = v.distanceTo(camera.position)
            ray.set(camera.position, v.clone().sub(camera.position).normalize())
            ray.far = dist - Math.max(1, dist * 0.002)
            const hit = ray.intersectObject(group, true)[0]
            return hit == null ? '-' : `${kindOf(hit.object)} at ${hit.distance.toFixed(0)} m${toward}`
          }
          for (const { v, n, d } of near) {
            const [s, a] = p.coast != null ? worldToShore(p.coast, v.x, v.z) : [NaN, NaN]
            const cells = [d, s, a, v.y, v.y - terrainHeight(p.coast, v.x, v.z)].map(x => x.toFixed(1).padStart(7))
            const xz = [v.x, v.z].map(x => x.toFixed(1).padStart(8))
            // Where the sea mirrors it (the point at −y): params.debug.probe {mirror: [x, y, z]}.
            const m = new three.Vector3(v.x, -v.y, v.z).project(camera)
            const mirror = v.y > 0 && m.z < 1 && Math.abs(m.x) <= 1 && Math.abs(m.y) <= 1 ? pixel(m) : '-'
            console.log(`   ${cells.join(' ')} ${xz.join(' ')}   ${pixel(n).padEnd(10)} ${mirror.padEnd(10)} ${cover(v, '')}`)
          }
        }
      }
    }
  } finally {
    await here.server.close()
  }
  process.exit(0)
}
const old = ref != null ? worktree(ref, 'params') : null
const there = old != null ? await load(old.tree) : null
try {
  for (const { name, spec: raw } of await specs()) {
    here.parseSceneSpec(raw)
    const { spec, dates } = datesFor(raw)
    if (name != null) console.log(`== ${name}`)
    if (there != null && stats != null) {
      const before = dates.map(d => there.day(d, spec)).filter(p => {
        try {
          return keep(p)
        } catch {
          return false
        }
      })
      printStatsVs(before, dates.map(d => here.day(d, spec)).filter(p => keep(p)), old.sha)
      continue
    }
    if (there != null) {
      const pairs = dates.map(d => [there.day(d, spec), here.day(d, spec)]).filter(([, now]) => keep(now))
      printChanges(pairs, old.sha)
      continue
    }
    const days = dates.map(d => here.day(d, spec)).filter(p => keep(p))
    if (sample > 0) {
      for (const p of spreadSample(days, fn(spreadArg), sample)) console.log(p.date)
      continue
    }
    if (stats != null) printStats(days)
    else if (each != null) printEach(days)
    else printDays(days)
  }
} finally {
  warnFraming(here.framing)
  await here.server.close()
  await there?.server.close()
  old?.remove()
}
