// Ask the scene generator questions without rendering: what a date or a spec
// gives, and how often something happens over the days. Computing params is
// cheap (three years of days in ~1 s); a render is not.
//
//   node scripts/params.mjs [--scene SPEC] [--fields a.b,c] DATE [DATE...]
//   node scripts/params.mjs --stats 'p => p.weather.formations' [--where EXPR]
//   node scripts/params.mjs --list [--where EXPR] [--fields a.b,c] [--limit 40]
//
// DATE is YYYY-MM-DD or a range FROM..TO. Without dates, --stats and --list
// run over the test days (three years from 2024-01-01, test/days.ts).
// --scene SPEC (a JSON file or inline JSON, as for snapshot.mjs) is applied
//   to every day: '{"storm":"squall"}' asks "what do storms look like?".
// --fields picks what to print (dotted paths; default: title).
// --where 'p => …' keeps the days for which it is true.
// --stats 'p => …' counts the values it returns (each element of an array,
//   so 'p => p.weather.formations' counts layers), with the share of days.
// --list prints one line per day: date, then the fields.
//
// Examples:
//   node scripts/params.mjs --scene '{"waterspout":true}' --fields waterspout,weather.formations 2024-09-12
//   node scripts/params.mjs --stats 'p => p.contrails.length' --where 'p => p.sea.ocean === "southern"'
//   node scripts/params.mjs --list --where 'p => p.storm?.shelf != null' --fields title,camera.headingDeg

import { readFile } from 'node:fs/promises'
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
const sceneArg = option('scene', null)
const fields = (option('fields', 'title') ?? '').split(',').filter(Boolean)
const where = option('where', null)
const stats = option('stats', null)
const limit = Number(option('limit', 1e9))
const list = flag('list')

const shift = (date, days) => {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
function dates() {
  if (args.length === 0) return Array.from({ length: 3 * 365 }, (_, i) => shift('2024-01-01', i))
  return args.flatMap(a => {
    if (!a.includes('..')) return [a]
    const [from, to] = a.split('..')
    const out = []
    for (let d = from; d <= to; d = shift(d, 1)) out.push(d)
    return out
  })
}
const spec = sceneArg == null ? {} : JSON.parse(/^\s*[[{]/.test(sceneArg) ? sceneArg : await readFile(sceneArg, 'utf8'))
const get = (p, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), p)
const fn = expr => (expr == null ? null : (0, eval)(expr))
const keep = fn(where) ?? (() => true)

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
try {
  const { generateParams } = await server.ssrLoadModule('/src/params.ts')
  const { parseSceneSpec } = await server.ssrLoadModule('/src/sceneSpec.ts')
  parseSceneSpec(spec)
  const days = dates()
    .map(date => generateParams(date, 0, 16 / 9, spec))
    .filter(p => keep(p))

  if (stats != null) {
    const of = fn(stats)
    const counts = new Map()
    for (const p of days) {
      const value = of(p)
      for (const v of new Set(Array.isArray(value) ? value.map(x => JSON.stringify(x)) : [JSON.stringify(value)])) counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    console.log(`${days.length} days`)
    for (const [v, n] of [...counts].sort((a, b) => b[1] - a[1]))
      console.log(`${String(n).padStart(6)}  ${((100 * n) / Math.max(1, days.length)).toFixed(1).padStart(5)}%  ${v}`)
  } else if (list || args.length === 0) {
    console.log(`${days.length} days`)
    for (const p of days.slice(0, limit)) console.log([p.date, ...fields.map(f => JSON.stringify(get(p, f)))].join('  '))
  } else {
    for (const p of days) {
      const out = Object.fromEntries(fields.map(f => [f, get(p, f)]))
      console.log(p.date, JSON.stringify(out, null, 1))
    }
  }
} finally {
  await server.close()
}
