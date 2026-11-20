// Edges along a render's probe line: where the luminance steps (a cloud's
// lip, a horizon, a ridge), how sharp (10–90% width in pixels), the levels on
// each side; and mean luminance over ranges. Reads NAME.json that
// snapshot.mjs saved with params.debug.probeLine. Guide: knowledge/tools/RENDER.md.
//
//   node scripts/measure/edges.mjs FILE.json... [--line N] [--min 0.08] [--window 0.1] [--mean A:B,C:D]
//
// --line N      which probe line of a list (default 0)
// --min R       smallest step reported, as a ratio of the darker side (default 0.08 = 8%)
// --window W    degrees on each side over which a step's levels are read (default 0.1)
// --mean A:B    mean cd/m² over each range of the line's varying coordinate (el or az),
//               and the ratio of each to the first: "is the face as bright as the deck?"
//
// Compare an edge with a CPU prediction (shelf lip: src.shelfCloud.lipElevationAhead in
// params.mjs --rendered): they should agree within a few pixels.
//
//   node scripts/render/snapshot.mjs --out $SP/p --scene '{"date":"2016-06-21","params":{"debug":
//     {"probeLine":[{"az":0,"el":[3,12],"step":0.02}]}}}'
//   node scripts/measure/edges.mjs $SP/p/scene-1.json --mean 6:8,10.5:12

import { readFile } from 'node:fs/promises'

import { parseArgs } from '../shared/lib.mjs'

const { args, option, rejectUnknown } = parseArgs()
const lineIndex = Number(option('line', 0))
const minStep = Number(option('min', 0.08))
const window = Number(option('window', 0.1))
const meanArg = option('mean', null)
rejectUnknown()
if (args.length === 0) throw new Error('give one or more NAME.json files from snapshot.mjs with params.debug.probeLine')

const median = values => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

for (const file of args) {
  const json = JSON.parse(await readFile(file, 'utf8'))
  const probe = json.debug?.probeLine
  if (probe == null) throw new Error(`${file}: no debug.probeLine (render with params.debug.probeLine)`)
  const line = Array.isArray(probe) ? probe[lineIndex] : probe
  const samples = (line.samples ?? line).filter(s => Number.isFinite(s.cdm2))
  if (samples.length < 3) throw new Error(`${file}: line ${lineIndex} has too few samples`)
  // The coordinate that varies along the line, and pixels per degree along it.
  const key = Math.abs(samples.at(-1).el - samples[0].el) >= Math.abs(samples.at(-1).az - samples[0].az) ? 'el' : 'az'
  const span = samples.at(-1)[key] - samples[0][key]
  const pxSpan = Math.hypot(samples.at(-1).pixel[0] - samples[0].pixel[0], samples.at(-1).pixel[1] - samples[0].pixel[1])
  const pxPerDeg = pxSpan / Math.abs(span)
  console.log(`${file} (line ${lineIndex}, along ${key}, ${pxPerDeg.toFixed(1)} px/°)`)

  // Levels on each side of each sample (medians, so stars and rain streaks don't count).
  const at = i => samples[i][key]
  const levelOver = (from, to) => median(samples.filter(s => s[key] >= Math.min(from, to) && s[key] <= Math.max(from, to)).map(s => s.cdm2))
  const steps = []
  for (let i = 1; i < samples.length - 1; i++) {
    const before = levelOver(at(i) - window * Math.sign(span), at(i))
    const after = levelOver(at(i), at(i) + window * Math.sign(span))
    if (before == null || after == null) continue
    const ratio = Math.max(before, after) / Math.min(before, after) - 1
    if (ratio >= minStep) steps.push({ i, before, after, ratio })
  }
  // Merge neighbours into one edge each: keep the strongest of each run.
  const edges = []
  for (const s of steps) {
    const last = edges.at(-1)
    if (last != null && Math.abs(at(s.i) - at(last.i)) <= window) {
      if (s.ratio > last.ratio) edges[edges.length - 1] = s
    } else edges.push(s)
  }
  if (edges.length === 0) console.log('  no step ≥ ' + Math.round(minStep * 100) + '%')
  for (const e of edges) {
    // 10–90% crossing around the edge, from the levels on each side.
    const lo = e.before + 0.1 * (e.after - e.before)
    const hi = e.before + 0.9 * (e.after - e.before)
    const mid = e.before + 0.5 * (e.after - e.before)
    const near = samples.filter(s => Math.abs(s[key] - at(e.i)) <= 2 * window)
    const cross = level => {
      for (let k = 1; k < near.length; k++) {
        const [a, b] = [near[k - 1], near[k]]
        if ((a.cdm2 - level) * (b.cdm2 - level) <= 0 && a.cdm2 !== b.cdm2) return a[key] + ((level - a.cdm2) / (b.cdm2 - a.cdm2)) * (b[key] - a[key])
      }
      return null
    }
    const [x10, x50, x90] = [cross(lo), cross(mid), cross(hi)]
    const width = x10 != null && x90 != null ? Math.abs(x90 - x10) * pxPerDeg : null
    console.log(
      `  edge at ${key} ${(x50 ?? at(e.i)).toFixed(2)}°: ${e.before.toPrecision(3)} → ${e.after.toPrecision(3)} cd/m² (${e.after > e.before ? '+' : '−'}${Math.round(e.ratio * 100)}%), ` +
        `10–90% ${width == null ? '?' : width.toFixed(1)} px`
    )
  }
  if (meanArg != null) {
    const ranges = meanArg.split(',').map(r => r.split(':').map(Number))
    const means = ranges.map(([a, b]) => {
      const values = samples.filter(s => s[key] >= Math.min(a, b) && s[key] <= Math.max(a, b)).map(s => s.cdm2)
      return values.length === 0 ? NaN : values.reduce((t, v) => t + v, 0) / values.length
    })
    console.log('  mean ' + ranges.map(([a, b], k) => `${a}–${b}°: ${means[k].toPrecision(3)}${k > 0 ? ` (×${(means[k] / means[0]).toFixed(2)})` : ''}`).join(', '))
  }
}
