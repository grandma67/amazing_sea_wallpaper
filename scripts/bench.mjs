// Render time and pixels, now vs another commit: the CLAUDE.md rule "a
// feature that adds more than ~10% needs a reason", and "a speed change must
// leave the image alone", checked in one command.
//
//   node scripts/bench.mjs [--ref HEAD~1] [--w 1920 --h 1080 --frames 16]
//        [--scene specs.json | DATE...] [--out out/bench] [--runs 2]
//        [--url http://localhost:5174/]   (this tree's server, if not 5174)
//
// Checks out --ref (default HEAD, i.e. the last commit, against your working
// tree) into a temporary git worktree, serves it with vite on port 5175
// (refServer.mjs),
// renders the same dates or specs with both (this tree on 5174, which must
// be running), --runs times each (default 3; the fastest counts: the first render of a
// kind compiles shaders), and prints a pixel diff (diff.mjs), then the times
// side by side LAST (so `| tail` keeps them), also saved with the diff lines in
// OUT/summary.txt. Default dates: a clear, a cloudy, a storm and a night day.
// Run it with nothing else using the GPU; under `caffeinate -i` on battery.
// A scene whose runs differ by more than 10% is marked "noisy": the machine
// was busy, so its change isn't a result (add --runs or close things).

import { spawnSync } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { serveRef, shortSha } from './refServer.mjs'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return fallback
  const [, value] = args.splice(i, 2)
  return value
}
const ref = option('ref', 'HEAD')
const out = resolve(option('out', 'out/bench'))
const runs = Number(option('runs', 3))
const url = option('url', 'http://localhost:5174/')
const scene = option('scene', null)
const size = ['w', 'h', 'frames'].flatMap(k => [`--${k}`, option(k, { w: '1920', h: '1080', frames: '16' }[k])])
const dates = args.length > 0 ? args : ['2024-07-12', '2024-06-26', '2024-04-24', '2024-02-12']

const sha = shortSha(ref)

/** Renders everything `runs` times; the fastest time per name, and the
 * spread (slowest / fastest) to tell a real change from a busy machine. */
const spread = new Map()
function render(url, dir, extra = []) {
  const times = new Map()
  const slowest = new Map()
  for (let run = 0; run < runs; run++) {
    const job = scene != null ? ['--scene', scene] : dates
    const r = spawnSync('node', ['scripts/snapshot.mjs', '--url', url, '--out', dir, ...size, ...extra, ...job], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`snapshot.mjs failed on ${url}:\n${r.stdout}\n${r.stderr}`)
    for (const line of r.stdout.split('\n')) {
      const m = line.match(/\/([^/]+)\.jpg\s+([\d.]+)s/)
      if (m == null) continue
      times.set(m[1], Math.min(times.get(m[1]) ?? Infinity, Number(m[2])))
      slowest.set(m[1], Math.max(slowest.get(m[1]) ?? 0, Number(m[2])))
    }
  }
  // The first run compiles shaders; judge the spread on the others.
  if (runs > 2) for (const [name, t] of times) spread.set(name, Math.max(spread.get(name) ?? 1, slowest.get(name) / t))
  return times
}

try {
  if (!(await fetch(url).catch(() => null))?.ok) throw new Error(`start this tree first: npx vite (${url})`)
  // Old renders left in before/ and after/ would be diffed (and reported) again.
  await rm(out, { recursive: true, force: true })
  await mkdir(out, { recursive: true })
  const old = await serveRef(ref, 5175)
  let before
  try {
    // A new feature's spec fields don't exist at the ref: left out there.
    before = render(old.url, join(out, 'before'), ['--drop-unknown'])
  } finally {
    old.close()
  }
  const after = render(url, join(out, 'after'))
  // Pixels first, times last: the table is what a `| tail` should keep.
  const diff = spawnSync('node', ['scripts/diff.mjs', '--a', join(out, 'before'), '--b', join(out, 'after'), '--out', out], { encoding: 'utf8' })
  const diffText = diff.stdout + diff.stderr
  process.stdout.write(diffText)
  const table = [`${'name'.padEnd(24)} ${sha.padStart(8)}   now   change`]
  let sumA = 0
  let sumB = 0
  for (const [name, b] of before) {
    const a = after.get(name)
    if (a == null) continue
    sumA += a
    sumB += b
    const change = ((a / b - 1) * 100).toFixed(0)
    const noisy = (spread.get(name) ?? 1) > 1.1 ? `  (noisy: runs differ ${(((spread.get(name) ?? 1) - 1) * 100).toFixed(0)}%)` : ''
    table.push(`${name.padEnd(24)} ${b.toFixed(1).padStart(7)}s ${a.toFixed(1).padStart(5)}s  ${change.padStart(4)}%${a / b > 1.1 ? '  ⚠ >10% slower' : ''}${noisy}`)
  }
  table.push(`${'total'.padEnd(24)} ${sumB.toFixed(1).padStart(7)}s ${sumA.toFixed(1).padStart(5)}s  ${((sumA / sumB - 1) * 100).toFixed(0).padStart(4)}%`)
  const pixels = diffText.split('\n').filter(line => /changed, box|invisible|identical/.test(line))
  await writeFile(join(out, 'summary.txt'), [`bench ${sha} vs now`, '', ...pixels, '', ...table, ''].join('\n'))
  console.log(`\n${table.join('\n')}\n(summary: ${join(out, 'summary.txt')})`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
