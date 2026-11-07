// A table of one number (or label) over a folder of renders: reads every
// NAME.json snapshot.mjs saved (the day's params at the top, the render's
// numbers under `debug`) and summarises what 'j => …' returns. Guide:
// knowledge/tools/RENDER.md.
//
//   node scripts/summary.mjs DIR 'j => j.debug.frameMedian' [--by 'j => j.timeOfDay'] [--each]
//
// Numbers: count, min, p25, median, p75, max per group. Anything else: how many
// of each value. --by EXPR groups the files (default: one group). --each also
// lists every file: name, group, value (sorted by value). A file the
// expression throws on is counted apart and named. For diff.mjs folders, give
// OUT/on or OUT/off.
//
//   node scripts/summary.mjs $SP/nights 'j => j.debug.frameBoost' --by 'j => j.weather.kind'
//   node scripts/summary.mjs $SP/d1/on 'j => j.debug.propTimes["sky-open"]'

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { parseArgs } from './lib.mjs'

const { args, option, flag, rejectUnknown } = parseArgs()
const byArg = option('by', null)
const each = flag('each')
rejectUnknown()
if (args.length !== 2) throw new Error("give DIR and an expression: node scripts/summary.mjs DIR 'j => j.debug.exposure'")
const [dir, expr] = args

// eslint-disable-next-line no-new-func
const fn = source => new Function(`return (${source})`)()
const value = fn(expr)
const groupOf = byArg != null ? fn(byArg) : () => 'all'

const files = (await readdir(dir)).filter(f => f.endsWith('.json') && f !== 'on.json' && f !== 'off.json').sort()
if (files.length === 0) throw new Error(`no NAME.json renders in ${dir} (for a diff.mjs folder give OUT/on or OUT/off)`)

const rows = []
const failed = []
for (const file of files) {
  const j = JSON.parse(await readFile(join(dir, file), 'utf8'))
  const name = file.slice(0, -5)
  try {
    rows.push({ name, group: String(groupOf(j)), value: value(j) })
  } catch (error) {
    failed.push(`${name} (${error instanceof Error ? error.message : String(error)})`)
  }
}

const fmt = v => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(2) : Number(v.toPrecision(3)).toString())
const quantile = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
const groups = new Map()
for (const r of rows) groups.set(r.group, [...(groups.get(r.group) ?? []), r])

console.log(`${rows.length} renders in ${dir}`)
const width = Math.max(5, ...[...groups.keys()].map(g => g.length))
for (const [group, list] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
  const numbers = list.map(r => r.value).filter(v => typeof v === 'number' && Number.isFinite(v))
  if (numbers.length === list.length) {
    const s = [...numbers].sort((a, b) => a - b)
    console.log(
      `${group.padEnd(width)}  n ${String(s.length).padStart(4)}  min ${fmt(s[0]).padStart(8)}  p25 ${fmt(quantile(s, 0.25)).padStart(8)}  median ${fmt(quantile(s, 0.5)).padStart(8)}  p75 ${fmt(quantile(s, 0.75)).padStart(8)}  max ${fmt(s.at(-1)).padStart(8)}`
    )
  } else {
    const counts = new Map()
    for (const r of list) {
      const key = JSON.stringify(r.value) ?? 'undefined'
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    console.log(`${group.padEnd(width)}  n ${String(list.length).padStart(4)}  ${[...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(', ')}`)
  }
}
if (each) {
  const key = r => (typeof r.value === 'number' ? r.value : String(JSON.stringify(r.value)))
  for (const r of [...rows].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0)))
    console.log(`  ${r.name.padEnd(24)} ${r.group.padEnd(width)}  ${typeof r.value === 'number' ? fmt(r.value) : JSON.stringify(r.value)}`)
}
if (failed.length > 0) console.log(`⚠ ${failed.length} threw: ${failed.join(', ')}`)
