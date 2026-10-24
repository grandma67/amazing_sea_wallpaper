// Ask the scene generator questions without rendering: what a date or a spec
// gives, and how often something happens over the days. Computing params is
// cheap (three years of days in ~1 s); a render is not.
//
//   node scripts/params.mjs [--scene SPEC] [--fields a.b,c] DATE [DATE...]
//   node scripts/params.mjs --stats 'p => p.weather.formations' [--where EXPR]
//   node scripts/params.mjs --list [--where EXPR] [--fields a.b,c] [--limit 40]
//   node scripts/params.mjs --ref REF [--fields a.b,c] [--list] [--scene SPEC] [DATE...]
//   node scripts/params.mjs --help
//
// DATE is YYYY-MM-DD or a range FROM..TO. Without dates, --stats and --list
// run over the test days (three years from 2024-01-01, test/days.ts).
// --scene SPEC (a JSON file or inline JSON, as for snapshot.mjs) is applied
//   to every day: '{"storm":"squall"}' asks "what do storms look like?".
//   A file with { "base": {…}, "scenes": [{ "name": …, … }] } (snapshot.mjs's
//   format) runs each scene in turn under its name. A spec's own "date" is
//   used when no DATE is given; DATEs given replace it.
// --fields picks what to print (dotted paths; default: title).
// --where 'p => …' keeps the days for which it is true.
// --stats 'p => …' counts the values it returns (each element of an array,
//   so 'p => p.weather.formations' counts layers), with the share of days.
// --list prints one line per day: date, then the fields.
// Each day also has p.props: what the props choose (src/props/choices.ts:
//   gulls, marine, migratory, wildlife, shoreLife, debris, mangroves), on the
//   render's own random streams. Placement can still miss the frame.
// And p.view: what the camera sees of the ground at 1080p (eye height, lens,
//   pixel angle, nearest ground in frame; src/composition.ts frameView), to
//   check before rendering whether a near-camera prop can be in view and how
//   many pixels it gets.
// --ref REF compares with another commit (checked out into a temporary git
//   worktree, as bench.mjs does): how many days changed and in which
//   top-level params (or in --fields), for the changelog's "N of 1096 days
//   change" line. --list prints each changed day with before → after.
// --rendered uses the params the page renders (generateSceneParams: a bad
//   framing re-rolls the coast) instead of the first attempt; slower.
//
// Examples:
//   node scripts/params.mjs --scene '{"waterspout":true}' --fields waterspout,weather.formations 2024-09-06
//   node scripts/params.mjs --stats 'p => p.contrails.length' --where 'p => p.sea.ocean === "southern"'
//   node scripts/params.mjs --list --where 'p => p.storm?.shelf != null' --fields title,camera.headingDeg
//   node scripts/params.mjs --stats 'p => p.props.wildlife?.crocodile' --where 'p => p.props.wildlife != null'
//   node scripts/params.mjs --rendered --scene '{"beachMaterial":"cobble","composition":"shoreline"}' --fields view 2025-07-10
//   node scripts/params.mjs --stats 'p => p.coast.composition + " " + Math.round(p.view.nearest / 5) * 5' --where 'p => p.coast.type === "beach"'
//   node scripts/params.mjs --ref HEAD~1                    # which days did my change touch?
//   node scripts/params.mjs --ref HEAD --fields coast.sand.name --list --limit 10
//   node scripts/params.mjs --scene scenes/stony.json --fields title,view

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile, rm, symlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return fallback
  const [, value] = args.splice(i, 2)
  return value
}
const flag = name => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return false
  args.splice(i, 1)
  return true
}
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
const list = flag('list')
const rendered = flag('rendered')
const limit = Number(option('limit', ref != null ? 20 : 1e9))
const unknown = args.find(a => a.startsWith('--'))
if (unknown != null) throw new Error(`unknown option ${unknown} (see --help)`)
if (ref != null && stats != null) throw new Error('--ref compares days; use --stats without it')

const shift = (date, days) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const TEST_DAYS = Array.from({ length: 3 * 365 }, (_, i) => shift('2024-01-01', i))
const given = args.flatMap(a => {
  if (!a.includes('..')) return [a]
  const [from, to] = a.split('..')
  const out = []
  for (let d = from; d <= to; d = shift(d, 1)) out.push(d)
  return out
})

/** The specs to run: one, or each scene of a { base, scenes } file merged
 * over the base (objects merge, the rest replaces), as snapshot.mjs does. */
async function specs() {
  if (sceneArg == null) return [{ name: null, spec: {} }]
  const parsed = JSON.parse(/^\s*[[{]/.test(sceneArg) ? sceneArg : await readFile(sceneArg, 'utf8'))
  const merge = (a, b) => {
    if (b === null || typeof b !== 'object' || Array.isArray(b) || a == null || typeof a !== 'object' || Array.isArray(a)) return b
    const out = { ...a }
    for (const [k, v] of Object.entries(b)) out[k] = merge(a[k], v)
    return out
  }
  if (!Array.isArray(parsed.scenes)) return [{ name: null, spec: parsed }]
  return parsed.scenes.map((scene, i) => {
    const spec = merge(parsed.base ?? {}, scene)
    return { name: spec.name ?? `scene-${i + 1}`, spec }
  })
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
  const [{ generateParams }, { parseSceneSpec }, { propChoices }, { frameView, generateSceneParams }] = await Promise.all([
    mod('/src/params.ts'),
    mod('/src/sceneSpec.ts'),
    mod('/src/props/choices.ts'),
    mod('/src/composition.ts')
  ])
  const day = (date, spec) => {
    const p = rendered ? generateSceneParams(date, 16 / 9, spec) : generateParams(date, 0, 16 / 9, spec)
    const out = { ...p, props: propChoices(p) }
    // Computed only when asked for (it marches rays over the terrain).
    Object.defineProperty(out, 'view', { get: () => frameView(p), enumerable: false })
    return out
  }
  return { server, parseSceneSpec, day }
}

/** A temporary worktree of `ref` (removed afterwards), as bench.mjs makes. */
async function worktree() {
  const git = (...a) => spawnSync('git', a, { encoding: 'utf8' })
  const sha = git('rev-parse', '--short', ref).stdout.trim()
  if (sha === '') throw new Error(`unknown ref ${ref}`)
  const tree = resolve(`/private/tmp/claude-params-${sha}`)
  const registered = git('worktree', 'list', '--porcelain').stdout.includes(`worktree ${tree}\n`)
  if (!registered) {
    // A leftover folder that isn't a worktree any more.
    if (existsSync(tree)) await rm(tree, { recursive: true, force: true })
    const r = git('worktree', 'add', '--detach', tree, ref)
    if (r.status !== 0) throw new Error(r.stderr)
    await symlink(resolve('node_modules'), join(tree, 'node_modules'))
  }
  return { sha, tree, remove: () => git('worktree', 'remove', '--force', tree) }
}

function printStats(days) {
  const of = fn(stats)
  const counts = new Map()
  for (const p of days) {
    const value = of(p)
    for (const v of new Set(Array.isArray(value) ? value.map(x => JSON.stringify(x)) : [JSON.stringify(value)])) counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  console.log(`${days.length} days`)
  for (const [v, n] of [...counts].sort((a, b) => b[1] - a[1]))
    console.log(`${String(n).padStart(6)}  ${((100 * n) / Math.max(1, days.length)).toFixed(1).padStart(5)}%  ${v}`)
}

function printDays(days) {
  if (list || days.length > 1) {
    console.log(`${days.length} days`)
    for (const p of days.slice(0, limit)) console.log([p.date, ...fields.map(f => JSON.stringify(get(p, f)))].join('  '))
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
}

const here = await load(process.cwd())
const old = ref != null ? await worktree() : null
const there = old != null ? await load(old.tree) : null
try {
  for (const { name, spec: raw } of await specs()) {
    here.parseSceneSpec(raw)
    const { spec, dates } = datesFor(raw)
    if (name != null) console.log(`== ${name}`)
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
