#!/usr/bin/env node
// Why did the published picture of DATE look wrong? Reproduces a day as CI rendered it.
//
//   node scripts/ci/ciDay.mjs [DATE] [--no-render] [--full] [--out DIR] [--sha SHA] [--repo OWNER/REPO]
//
// 1. The Pages runs of DATE (UTC; GitHub Actions API): event, time, commit, outcome, and each
//    run's warnings and errors (`NaN pixels`, `Broken frame`). The last successful one is
//    what the site served at the day's end. CI deploys the PUSHED commit, not your HEAD.
// 2. The archived render JSON of DATE (daily/pc/DATE.json, scripts/ci/dailyArchive.mjs; kept 60
//    days from 0.203 on): sky light, frame median, NaN cells, camera, and brokenFrame's reasons.
// 3. Unless --no-render: renders DATE at that commit on SwiftShader (as CI: --angle swiftshader)
//    with debug.nanTrace, into --out (default out/ci-DATE), and prints the same numbers beside
//    the archived ones. 320×180 at 24 frames by default (~1.5 min): it reproduced 2026-11-17,
//    while 1 frame did not (the sky cube's clouds get frames/5 passes). --full: CI's 1920×1080
//    (~2.5 min a day on this Mac, tens of minutes on the runner).
//
// GITHUB_TOKEN or GH_TOKEN raises the API's limit (60 requests an hour without; a day costs
// ~2 + 2 per run). Next steps: tools/RENDER.md "Broken frames".

import { execFileSync, spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { brokenFrame } from '../render/checks.mjs'
import { siteOf } from './dailyArchive.mjs'
import { parseArgs } from '../shared/lib.mjs'

/** The Pages runs that rendered `date` (they render the UTC date they start on), oldest first. */
export function runsForDay(runs, date) {
  return (runs ?? []).filter(r => String(r.run_started_at ?? r.created_at).slice(0, 10) === date).sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
}

/** The run whose picture the site served at the end of `date`: the last successful one. */
export function publishedRun(runs) {
  return [...runs].reverse().find(r => r.conclusion === 'success') ?? null
}

const fmt = v => (Array.isArray(v) ? `[${v.map(x => (typeof x === 'number' ? x.toPrecision(3) : String(x))).join(', ')}]` : typeof v === 'number' ? v.toPrecision(3) : String(v))

/** The numbers that told 2026-11-17's story, from a render JSON. */
export function summarise(j) {
  const d = j?.debug ?? {}
  return {
    title: j?.title,
    sunElevationDeg: j?.sunElevationDeg,
    weather: j?.weather != null ? `${j.weather.kind} ${(j.weather.formations ?? []).join('+')}` : undefined,
    camera: d.cameraPosition,
    frameMedian: d.frameMedian,
    frameNonFinite: d.frameNonFinite,
    exposure: d.exposure,
    cubeSkylight: d.cubeSkylight,
    skyIrradiance: d.skyIrradiance,
    sunIrradiance: d.sunIrradiance,
    cloudSkylight: d.cloudSkylight
  }
}

function repoFromGit() {
  const url = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf8' }).trim()
  const m = url.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/)
  if (m == null) throw new Error(`origin is not a GitHub repository (${url}): pass --repo OWNER/REPO`)
  return `${m[1]}/${m[2]}`
}

async function api(path) {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { accept: 'application/vnd.github+json', ...(token ? { authorization: `Bearer ${token}` } : {}) }
  })
  if (!res.ok) throw new Error(`GitHub API ${path}: HTTP ${res.status}${res.status === 403 ? ' (rate limit? set GITHUB_TOKEN)' : ''}`)
  return res.json()
}

async function main() {
  const { option, flag, rejectUnknown } = parseArgs()
  const noRender = flag('no-render')
  const full = flag('full')
  const outArg = option('out', null)
  const shaArg = option('sha', null)
  const repo = option('repo', null) ?? repoFromGit()
  rejectUnknown()
  const date = process.argv.slice(2).find(a => /^\d{4}-\d{2}-\d{2}$/.test(a)) ?? new Date().toISOString().slice(0, 10)
  const out = outArg ?? join('out', `ci-${date}`)

  // 1. The runs.
  console.log(`[ciDay] ${date}: Pages runs of ${repo}`)
  const listed = await api(`/repos/${repo}/actions/workflows/pages.yml/runs?per_page=100&created=${date}`)
  const runs = runsForDay(listed.workflow_runs, date)
  if (runs.length === 0) console.log('  none (older than the API keeps, or a day with no run)')
  for (const r of runs) {
    console.log(`  run ${r.id}  ${r.event}  ${r.created_at}  ${r.head_sha.slice(0, 7)}  ${r.conclusion ?? r.status}`)
    try {
      const { jobs } = await api(`/repos/${repo}/actions/runs/${r.id}/jobs`)
      for (const job of jobs.filter(j => j.name === 'build')) {
        const render = job.steps?.find(s => /render/i.test(s.name))
        if (render != null) console.log(`    render step: ${render.conclusion ?? render.status}`)
        const notes = await api(job.check_run_url.replace('https://api.github.com', '') + '/annotations')
        for (const a of notes.filter(n => n.annotation_level !== 'notice')) console.log(`    ${a.annotation_level}: ${a.title}: ${a.message}`)
      }
    } catch (error) {
      console.log(`    (jobs: ${error.message})`)
    }
  }
  const published = publishedRun(runs)
  const sha = shaArg ?? published?.head_sha ?? null
  if (published != null) console.log(`  served at the day's end: run ${published.id}, commit ${published.head_sha.slice(0, 7)}`)

  // 2. The archived numbers.
  const site = siteOf(repo)
  let archived = null
  try {
    const res = await fetch(new URL(`daily/pc/${date}.json`, site))
    if (res.ok) archived = await res.json()
    else console.log(`[ciDay] no archived JSON for ${date} (HTTP ${res.status}: before the archive, 0.203, or older than 60 days)`)
  } catch (error) {
    console.log(`[ciDay] archive: ${error.message}`)
  }
  if (archived != null) {
    console.log('[ciDay] published render (pc):')
    for (const [k, v] of Object.entries(summarise(archived))) console.log(`  ${k}: ${fmt(v)}`)
    for (const reason of brokenFrame(archived)) console.log(`  ⚠ broken: ${reason}`)
  }

  // 3. The render, as CI.
  if (noRender) return
  if (sha == null) {
    console.log('[ciDay] no commit to render (no run found): pass --sha')
    process.exitCode = 1
    return
  }
  const known = spawnSync('git', ['cat-file', '-e', `${sha}^{commit}`]).status === 0
  if (!known) {
    console.log(`[ciDay] fetching ${sha.slice(0, 7)} from origin`)
    execFileSync('git', ['fetch', 'origin', sha], { stdio: 'inherit' })
  }
  const spec = JSON.stringify({ name: date, date, params: { debug: { nanTrace: true } } })
  const size = full ? ['--w', '1920', '--h', '1080'] : ['--w', '320', '--h', '180']
  const args = ['scripts/render/snapshot.mjs', '--ref', sha, '--angle', 'swiftshader', '--out', out, ...size, '--frames', '24', '--budget', full ? '3000' : '1200', '--scene', spec]
  console.log(`[ciDay] node ${args.map(a => (a.includes(' ') || a.includes('{') ? `'${a}'` : a)).join(' ')}`)
  const run = spawnSync('node', args, { stdio: 'inherit' })
  if (run.status !== 0) process.exitCode = run.status ?? 1
  let local = null
  try {
    local = JSON.parse(await readFile(join(out, `${date}.json`), 'utf8'))
  } catch {
    try {
      local = JSON.parse(await readFile(join(out, `${date}.blank.json`), 'utf8'))
    } catch {
      return
    }
  }
  const a = archived != null ? summarise(archived) : {}
  console.log(`[ciDay] this render${archived != null ? ' (published in brackets)' : ''}:`)
  for (const [k, v] of Object.entries(summarise(local))) console.log(`  ${k}: ${fmt(v)}${archived != null ? `  [${fmt(a[k])}]` : ''}`)
  for (const reason of brokenFrame(local)) console.log(`  ⚠ broken: ${reason}`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    console.error(`[ciDay] ${error.message}`)
    process.exit(1)
  })
}
