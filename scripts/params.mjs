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
// --list           one line per day (with --ref: each changed day, before → after).
// --limit N        lines listed (default all; 20 with --ref).
// --expect EXPR    over the place table, weighted by share of days: numbers
//                  averaged, the rest counted, null skips the place. No sampling.
// --ref REF        compare with a commit (temporary worktree): days changed per
//                  top-level param; with --stats, shares side by side (⚠ ≥ 5 pts).
// --changed EXPR   with --ref: count 'p => …' over the changed days (now's params).
// --rendered       the params the page renders (generateSceneParams re-rolls a
//                  bad framing); slower.
//
// In expressions, besides SceneParams: p.props (props/choices.ts on the
// render's streams), p.placeData (places.ts Place), p.view (composition.ts
// frameView at 1080p), p.ctx (PropContext at 1080p, no wave field), and
// src.X / props.X (src/X.ts, src/props/X.ts; on --ref both sides see this tree's).
//
//   node scripts/params.mjs --stats 'p => p.weather.formations' --where 'p => p.sea.ocean === "southern"'
//   node scripts/params.mjs --scene '{"waterspout":true}' --fields waterspout,weather.formations 2024-09-06
//   node scripts/params.mjs --expect 'pl => pl.biome === "tropical" ? pl.reef : null'
//   node scripts/params.mjs --ref HEAD --changed 'p => p.place.climate'
//   node scripts/params.mjs --scene '{"saltMarsh":true}' --stats 'p => props.saltMarsh.createSaltMarsh(p.ctx).length' 2025-07-01..2025-07-10

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

import { expandDates, parseArgs, readSpecs, TEST_DAYS, worktree } from './lib.mjs'

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
const ref = option('ref', null)
const expect = option('expect', null)
const changedArg = option('changed', null)
const list = flag('list')
const rendered = flag('rendered')
const limit = Number(option('limit', ref != null ? 20 : 1e9))
rejectUnknown()

const given = expandDates(args)

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
  const day = (date, spec) => {
    const p = rendered ? generateSceneParams(date, 16 / 9, spec) : generateParams(date, 0, 16 / 9, spec)
    const out = { ...p, props: propChoices(p) }
    // Computed only when asked for (it marches rays over the terrain).
    Object.defineProperty(out, 'view', { get: () => frameView(p), enumerable: false })
    // Not enumerable either: it isn't a param, so --ref doesn't count it.
    Object.defineProperty(out, 'placeData', { get: () => places.PLACES?.find(pl => pl.id === p.place?.id), enumerable: false })
    // The props' PropContext at 1080p (as test/days.ts viewOf): the render's
    // camera and frustum, no wave field (seaLevel 0). Built once, on first use.
    let ctx = null
    Object.defineProperty(out, 'ctx', {
      get: () => {
        if (ctx == null) {
          const { camera } = createCamera(p, p.camera.aspect * 1080, 1080)
          ctx = new PropContext(p, camera, null, (camera.fov * Math.PI) / 180 / 1080)
        }
        return ctx
      },
      enumerable: false
    })
    return out
  }
  return { server, mod, parseSceneSpec, day, places: places.PLACES ?? [] }
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
  const rows = places.map(pl => [of(pl), pl.weight]).filter(([v]) => v != null)
  const total = rows.reduce((t, [, w]) => t + w, 0)
  const share = places.reduce((t, pl) => t + pl.weight, 0)
  console.log(`${rows.length} of ${places.length} places, ${(100 * total / share).toFixed(1)}% of days`)
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
if (/\b(src|props)\.\w/.test([where, stats, expect, changedArg].join(' '))) {
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
if (expect != null) {
  try {
    printExpect(here.places)
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
    if (stats != null) printStats(days)
    else printDays(days)
  }
} finally {
  await here.server.close()
  await there?.server.close()
  old?.remove()
}
