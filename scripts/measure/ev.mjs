// How far did a change move each frame's exposure? Reads the NAME.json of two
// folders of the same renders (a diff.mjs OUT: off = before, on = after) and
// prints the EV change, log2(after / before), per group (time of day, and
// moonlit/starlit at night by default): median, min, max, before the frame
// meter's boost and after it, and how many frames the boost lifted on each
// side. For re-tuning exposure terms so each class keeps its median (tasks.md
// D11, 0.231). Guide: knowledge/tools/RENDER.md.
//
//   node scripts/measure/ev.mjs OUT [--by 'j => j.weather.kind'] [--each]
//   node scripts/measure/ev.mjs --a DIR --b DIR
//
// Get the renders cheaply (exposure doesn't depend on size or frames):
//   node scripts/render/diff.mjs --where 'p => true' --sample 72 --spread 'p => p.timeOfDay' \
//     --off PATCH --w 320 --h 180 --frames 1 --out $SP/tune
//   node scripts/measure/ev.mjs $SP/tune
// --each   also every file: group, name, EV, EV after the boost (sorted by EV)

import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

import { parseArgs } from '../shared/lib.mjs'

const { args, option, flag, rejectUnknown } = parseArgs()
const aArg = option('a', null)
const bArg = option('b', null)
const byArg = option('by', null)
const each = flag('each')
rejectUnknown()
if ((aArg == null) !== (bArg == null)) throw new Error('give both --a and --b, or one diff.mjs OUT folder')
if (aArg == null && args.length !== 1) throw new Error('give a diff.mjs OUT folder (with off/ and on/), or --a DIR --b DIR')
const before = aArg ?? join(args[0], 'off')
const after = bArg ?? join(args[0], 'on')

// eslint-disable-next-line no-new-func
const by = byArg != null ? new Function(`return (${byArg})`)() : j => j.timeOfDay + (j.timeOfDay === 'night' ? `/${j.nightSky}` : '')

const names = (await readdir(after)).filter(f => f.endsWith('.json'))
const groups = new Map()
const rows = []
let missing = 0
for (const name of names) {
  let a
  try {
    a = JSON.parse(await readFile(join(before, name), 'utf8'))
  } catch {
    missing++
    continue
  }
  const b = JSON.parse(await readFile(join(after, name), 'utf8'))
  const boostA = a.debug.frameBoost ?? 1
  const boostB = b.debug.frameBoost ?? 1
  const row = {
    name: name.replace(/\.json$/, ''),
    group: String(by(b)),
    // debug.exposure already includes the frame meter's boost (scene.ts `exposed`).
    ev: Math.log2(b.debug.exposure / boostB / (a.debug.exposure / boostA)),
    evBoost: Math.log2(b.debug.exposure / a.debug.exposure),
    liftedA: boostA > 1.01,
    liftedB: boostB > 1.01
  }
  rows.push(row)
  if (!groups.has(row.group)) groups.set(row.group, [])
  groups.get(row.group).push(row)
}

const median = values => {
  const s = [...values].sort((x, y) => x - y)
  const m = s.length >> 1
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}
const f = x => (x >= 0 ? '+' : '') + x.toFixed(2)
if (each) for (const r of [...rows].sort((x, y) => x.ev - y.ev)) console.log(`  ${r.group.padEnd(18)} ${r.name.padEnd(28)} ${f(r.ev)}  ${f(r.evBoost)}`)
console.log(`${'group'.padEnd(18)}   n   EV median    min    max   after boost: median    min    max   lifted before/after`)
for (const [group, list] of [...groups].sort()) {
  const ev = list.map(r => r.ev)
  const evB = list.map(r => r.evBoost)
  console.log(
    `${group.padEnd(18)} ${String(list.length).padStart(3)}   ${f(median(ev)).padStart(9)} ${f(Math.min(...ev)).padStart(6)} ${f(Math.max(...ev)).padStart(6)}   ${f(median(evB)).padStart(19)} ${f(Math.min(...evB)).padStart(6)} ${f(Math.max(...evB)).padStart(6)}   ${list.filter(r => r.liftedA).length}/${list.filter(r => r.liftedB).length}`
  )
}
if (missing > 0) console.log(`(${missing} file${missing > 1 ? 's' : ''} only in ${after})`)
