// Shared by the scripts: argument parsing, scene specs, dates, git worktrees,
// browser messages.

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync, symlinkSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** `--name value` and `--flag` readers that remove what they read from
 * `args`, so what's left are the positional arguments. */
export function parseArgs(args = process.argv.slice(2)) {
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
  /** Throws on a `--x` nothing read (call after reading every option). */
  const rejectUnknown = () => {
    const unknown = args.find(a => a.startsWith('--'))
    if (unknown != null) throw new Error(`unknown option ${unknown} (see the script's header)`)
  }
  return { args, option, flag, rejectUnknown }
}

/** Objects merge deeply, everything else replaces (as a spec's `params` patch). */
export function merge(a, b) {
  if (b === null || typeof b !== 'object' || Array.isArray(b) || a == null || typeof a !== 'object' || Array.isArray(a)) return b
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = merge(a[k], v)
  return out
}

/** Inline JSON (starts with { or [) or a JSON file. */
export async function readJson(arg) {
  return JSON.parse(/^\s*[[{]/.test(arg) ? arg : await readFile(arg, 'utf8'))
}

/** The specs a --scene argument holds: one spec, a list, or a
 * { base, scenes } file (each scene merged over the base). `multi` says
 * whether it was a list or a scenes file. */
export async function readSpecs(arg) {
  const parsed = await readJson(arg)
  if (Array.isArray(parsed)) return { specs: parsed, multi: true }
  if (Array.isArray(parsed.scenes)) return { specs: parsed.scenes.map(scene => merge(parsed.base ?? {}, scene)), multi: true }
  return { specs: [parsed], multi: false }
}

/** `date` moved by `days`, as YYYY-MM-DD. */
export function shiftDate(date, days) {
  const d = new Date(`${date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** The test days (test/days.ts DAYS): 1095 days from 2024-01-01. */
export const TEST_DAYS = Array.from({ length: 3 * 365 }, (_, i) => shiftDate('2024-01-01', i))

/** YYYY-MM-DD, FROM..TO ranges and "today", expanded to dates. */
export function expandDates(list) {
  return list.flatMap(a => {
    if (a === 'today') return [new Date().toISOString().slice(0, 10)]
    if (!a.includes('..')) return [a]
    const [from, to] = a.split('..')
    const out = []
    for (let d = from; d <= to; d = shiftDate(d, 1)) out.push(d)
    return out
  })
}

const git = (...a) => spawnSync('git', a, { encoding: 'utf8' })

/** The short sha of `ref`; throws on an unknown ref. */
export function shortSha(ref) {
  const sha = git('rev-parse', '--short', ref).stdout.trim()
  if (sha === '') throw new Error(`unknown ref ${ref}`)
  return sha
}

/** Where a worktree's server notes its pid, for worktreeReaper.mjs. */
export const SERVER_PID_FILE = '.ref-server-pid'

/** Stops a server started as its own process group (npx and vite under it). */
export function stopServer(pid) {
  try {
    process.kill(-pid, 'SIGTERM')
  } catch {}
}

/** Synchronous (safe in 'exit'). Retries: a stopping server may still write. */
export function removeWorktree(tree) {
  git('worktree', 'remove', '--force', tree)
  rmSync(tree, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  git('worktree', 'prune')
}

/** A temporary git worktree of `ref` at /private/tmp/claude-TAG-SHA, sharing
 * this tree's node_modules. `remove()` is synchronous (safe in 'exit'); if the
 * script dies first, worktreeReaper.mjs removes it. */
export function worktree(ref, tag) {
  const sha = shortSha(ref)
  const tree = resolve(`/private/tmp/claude-${tag}-${sha}`)
  // Forget worktrees whose folder is gone (a cleared /tmp after a reboot).
  git('worktree', 'prune')
  if (!git('worktree', 'list', '--porcelain').stdout.includes(`worktree ${tree}\n`)) {
    // A leftover folder that isn't a worktree any more.
    if (existsSync(tree)) rmSync(tree, { recursive: true, force: true })
    const r = git('worktree', 'add', '--detach', tree, ref)
    if (r.status !== 0) throw new Error(r.stderr)
    symlinkSync(resolve('node_modules'), join(tree, 'node_modules'))
  }
  // Own session, so the terminal's Ctrl+C doesn't stop it with the script.
  spawn(process.execPath, [fileURLToPath(new URL('./worktreeReaper.mjs', import.meta.url)), String(process.pid), tree], { detached: true, stdio: 'ignore' }).unref()
  let removed = false
  const remove = () => {
    if (removed) return
    removed = true
    removeWorktree(tree)
  }
  return { sha, tree, remove }
}

/** A WebGL or GPU-process GL message ("WebGL: INVALID_…", "[.WebGL-0x…] GL_…"). */
const GL_MESSAGE = /WebGL|\bGL_[A-Z_]+\b/

/**
 * Prints a page's errors and warnings, and collects its GL messages. Playwright's
 * `console` event misses the render worker's WebGL warnings and every GPU-process
 * message ("[.WebGL-0x…] GL_INVALID_VALUE: …"); only a CDP session with
 * `Log.enable` gets them all (page and workers), so GL messages are taken from
 * there alone and everything else from `console`. `gl()` returns the GL messages
 * since its last call, grouped ("48× …", addresses masked), and empties the list.
 * `format(msg)` may rewrite a console line (null = skip it).
 */
export async function watchPage(page, { format } = {}) {
  let gl = new Map()
  page.on('console', msg => {
    const type = msg.type()
    if (type !== 'error' && type !== 'warning') return
    const text = msg.text()
    if (GL_MESSAGE.test(text)) return
    const line = format != null ? format(msg) : `[browser ${type}] ${text}`
    if (line != null) console.log(line)
  })
  page.on('pageerror', error => console.log('[page error]', error.message))
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Log.enable')
  cdp.on('Log.entryAdded', ({ entry }) => {
    if (!GL_MESSAGE.test(entry.text)) return
    const key = entry.text.replace(/0x[0-9a-f]+/gi, '0x…').trim()
    gl.set(key, (gl.get(key) ?? 0) + 1)
  })
  return {
    gl() {
      const out = [...gl].map(([text, n]) => `${n}× ${text}`)
      gl = new Map()
      return out
    }
  }
}
