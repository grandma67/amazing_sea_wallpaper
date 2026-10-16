// Render time and pixels, now vs another commit: the CLAUDE.md rule "a
// feature that adds more than ~10% needs a reason", and "a speed change must
// leave the image alone", checked in one command.
//
//   node scripts/bench.mjs [--ref HEAD~1] [--w 1920 --h 1080 --frames 16]
//        [--scene specs.json | DATE...] [--out out/bench] [--runs 2]
//
// Checks out --ref (default HEAD, i.e. the last commit, against your working
// tree) into a temporary git worktree, serves it with vite on port 5175,
// renders the same dates or specs with both (this tree on 5174, which must
// be running), --runs times each (the fastest counts: the first render of a
// kind compiles shaders), and prints the times side by side and a pixel diff
// (diff.mjs). Default dates: a clear, a cloudy, a storm and a night day.
// Run it with nothing else using the GPU; under `caffeinate -i` on battery.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, rm, symlink } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return fallback
  const [, value] = args.splice(i, 2)
  return value
}
const ref = option('ref', 'HEAD')
const out = resolve(option('out', 'out/bench'))
const runs = Number(option('runs', 2))
const scene = option('scene', null)
const size = ['w', 'h', 'frames'].flatMap(k => [`--${k}`, option(k, { w: '1920', h: '1080', frames: '16' }[k])])
const dates = args.length > 0 ? args : ['2024-07-12', '2024-06-26', '2024-04-24', '2024-02-12']

const git = (...a) => spawnSync('git', a, { encoding: 'utf8' })
const sha = git('rev-parse', '--short', ref).stdout.trim()
if (sha === '') throw new Error(`unknown ref ${ref}`)
const tree = resolve(`/private/tmp/claude-bench-${sha}`)

async function serve() {
  if (!existsSync(tree)) {
    const r = git('worktree', 'add', '--detach', tree, ref)
    if (r.status !== 0) throw new Error(r.stderr)
    await symlink(resolve('node_modules'), join(tree, 'node_modules'))
  }
  const server = spawn('npx', ['vite', '--port', '5175', '--strictPort'], { cwd: tree, stdio: 'ignore' })
  for (let i = 0; i < 600; i++) {
    try {
      if ((await fetch('http://localhost:5175/')).ok) return server
    } catch {}
    await new Promise(r => setTimeout(r, 100))
  }
  server.kill()
  throw new Error('the worktree server did not start on 5175')
}

/** Renders everything `runs` times; the fastest time per name. */
function render(url, dir) {
  const times = new Map()
  for (let run = 0; run < runs; run++) {
    const job = scene != null ? ['--scene', scene] : dates
    const r = spawnSync('node', ['scripts/snapshot.mjs', '--url', url, '--out', dir, ...size, ...job], { encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`snapshot.mjs failed on ${url}:\n${r.stdout}\n${r.stderr}`)
    for (const line of r.stdout.split('\n')) {
      const m = line.match(/\/([^/]+)\.jpg\s+([\d.]+)s/)
      if (m != null) times.set(m[1], Math.min(times.get(m[1]) ?? Infinity, Number(m[2])))
    }
  }
  return times
}

try {
  if (!(await fetch('http://localhost:5174/').catch(() => null))?.ok) throw new Error('start this tree first: npx vite (port 5174)')
  await mkdir(out, { recursive: true })
  const server = await serve()
  let before
  try {
    before = render('http://localhost:5175/', join(out, 'before'))
  } finally {
    server.kill()
  }
  const after = render('http://localhost:5174/', join(out, 'after'))
  console.log(`\n${'name'.padEnd(24)} ${sha.padStart(8)}   now   change`)
  let sumA = 0
  let sumB = 0
  for (const [name, b] of before) {
    const a = after.get(name)
    if (a == null) continue
    sumA += a
    sumB += b
    const change = ((a / b - 1) * 100).toFixed(0)
    console.log(`${name.padEnd(24)} ${b.toFixed(1).padStart(7)}s ${a.toFixed(1).padStart(5)}s  ${change.padStart(4)}%${a / b > 1.1 ? '  ⚠ >10% slower' : ''}`)
  }
  console.log(`${'total'.padEnd(24)} ${sumB.toFixed(1).padStart(7)}s ${sumA.toFixed(1).padStart(5)}s  ${((sumA / sumB - 1) * 100).toFixed(0).padStart(4)}%\n`)
  const diff = spawnSync('node', ['scripts/diff.mjs', '--a', join(out, 'before'), '--b', join(out, 'after'), '--out', out], { encoding: 'utf8' })
  process.stdout.write(diff.stdout + diff.stderr)
} finally {
  git('worktree', 'remove', '--force', tree)
  await rm(tree, { recursive: true, force: true })
}
