#!/usr/bin/env node
// Keeps the last days' render JSON on the site (pages.yml, after the render step).
//
// Each Pages deploy replaces dist/, so the day before's daily/pc/DATE.json was gone: a bad
// picture (2026-11-17, white) could not be read afterwards: its sky light, frame median,
// NaN count, camera. This copies the previous deploy's archive forward, adds today's render
// if it passed, and writes daily/index.json: [{date, title, sha, run}], newest first.
// Only the JSON (~20 KB a size a day); the pictures stay today's only.
//
//   node scripts/dailyArchive.mjs --dist dist [--site URL] [--keep 60]
//
// --site defaults to https://OWNER.github.io/REPO/ from GITHUB_REPOSITORY. Never fails the
// job: a missing archive (the first deploy) or file is skipped with a line. Read a day with
// node scripts/ciDay.mjs DATE.

import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const SIZES = ['pc', 'phone']

/**
 * The new index: today's entry (or none, if today's render failed) on top of the old one's,
 * one per date, newest first, at most `keep`, none after `today`.
 */
export function mergeIndex(old, todayEntry, keep, today) {
  const byDate = new Map()
  for (const e of Array.isArray(old) ? old : []) {
    if (e != null && typeof e.date === 'string' && e.date <= today) byDate.set(e.date, e)
  }
  if (todayEntry != null) byDate.set(todayEntry.date, todayEntry)
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, keep)
}

/** The Pages URL of a GITHUB_REPOSITORY "owner/repo". */
export function siteOf(repository) {
  const [owner, repo] = String(repository ?? '').split('/')
  if (!owner || !repo) return null
  return `https://${owner.toLowerCase()}.github.io/${repo}/`
}

async function getJson(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

async function main() {
  const args = process.argv.slice(2)
  const opt = (name, fallback) => {
    const i = args.indexOf(`--${name}`)
    return i >= 0 ? args[i + 1] : fallback
  }
  const dist = opt('dist', 'dist')
  const keep = Number(opt('keep', 60))
  const site = opt('site', siteOf(process.env.GITHUB_REPOSITORY))
  const today = new Date().toISOString().slice(0, 10)

  let old = []
  if (site == null) console.log('[dailyArchive] no --site and no GITHUB_REPOSITORY: starting a new archive')
  else {
    try {
      old = await getJson(new URL('daily/index.json', site))
    } catch (error) {
      console.log(`[dailyArchive] no archive at ${site}daily/index.json (${error.message}): starting a new one`)
    }
  }

  const todayFile = join(dist, 'daily', 'pc', `${today}.json`)
  let todayEntry = null
  if (existsSync(todayFile)) {
    const j = JSON.parse(await readFile(todayFile, 'utf8'))
    todayEntry = { date: today, title: j.title ?? null, sha: process.env.GITHUB_SHA ?? null, run: process.env.GITHUB_RUN_ID ?? null }
  } else console.log(`[dailyArchive] no render for ${today} in ${dist} (failed?): archive carried over without it`)

  const index = mergeIndex(old, todayEntry, keep, today)
  for (const size of SIZES) await mkdir(join(dist, 'daily', size), { recursive: true })
  let copied = 0
  for (const e of index) {
    if (e.date === today) continue
    for (const size of SIZES) {
      const out = join(dist, 'daily', size, `${e.date}.json`)
      if (existsSync(out) || site == null) continue
      try {
        await writeFile(out, JSON.stringify(await getJson(new URL(`daily/${size}/${e.date}.json`, site))))
        copied++
      } catch (error) {
        console.log(`[dailyArchive] ${size}/${e.date}.json: ${error.message}; skipped`)
      }
    }
  }
  await writeFile(join(dist, 'daily', 'index.json'), JSON.stringify(index, null, 1))
  console.log(`[dailyArchive] ${index.length} day(s) in daily/index.json, ${copied} file(s) carried over`)
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch(error => {
    // An archive is a convenience: never fail the deploy for it.
    console.log(`[dailyArchive] failed: ${error.message}`)
  })
}
