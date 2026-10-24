// Serve another commit of this repo: a temporary git worktree of REF (sharing
// this tree's node_modules) under vite on its own port. Used by bench.mjs,
// snapshot.mjs --ref and diff.mjs --ref to render "before" images without
// stashing your changes.
//
//   const old = await serveRef('HEAD', 5175)   // { sha, url, close }
//   … render old.url …
//   old.close()                                 // synchronous: safe in 'exit'

import { spawn, spawnSync } from 'node:child_process'
import { existsSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const git = (...a) => spawnSync('git', a, { encoding: 'utf8' })

/** The short sha of `ref`; throws on an unknown ref. */
export function shortSha(ref) {
  const sha = git('rev-parse', '--short', ref).stdout.trim()
  if (sha === '') throw new Error(`unknown ref ${ref}`)
  return sha
}

export async function serveRef(ref, port = 5175) {
  const sha = shortSha(ref)
  const tree = resolve(`/private/tmp/claude-ref-${sha}-${port}`)
  const registered = git('worktree', 'list', '--porcelain').stdout.includes(`worktree ${tree}\n`)
  if (!registered) {
    // A leftover folder that isn't a worktree any more.
    if (existsSync(tree)) rmSync(tree, { recursive: true, force: true })
    const r = git('worktree', 'add', '--detach', tree, ref)
    if (r.status !== 0) throw new Error(r.stderr)
    symlinkSync(resolve('node_modules'), join(tree, 'node_modules'))
  }
  // Its own pre-bundled deps, not node_modules/.vite: through the shared
  // node_modules both servers would rewrite one cache, and a page then loads
  // two three.js copies ("Cannot read properties of undefined (reading
  // 'hasFeature')").
  writeFileSync(
    join(tree, 'vite.ref.config.mjs'),
    `import { mergeConfig } from 'vite'\nimport base from './vite.config.ts'\nexport default mergeConfig(base, { cacheDir: ${JSON.stringify(join(tree, '.vite-cache'))} })\n`
  )
  const server = spawn('npx', ['vite', '--config', 'vite.ref.config.mjs', '--port', String(port), '--strictPort'], { cwd: tree, stdio: 'ignore' })
  // Don't keep the caller alive: it exits when its work is done, and its
  // 'exit' handler (close) stops the server.
  server.unref()
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    server.kill()
    git('worktree', 'remove', '--force', tree)
    rmSync(tree, { recursive: true, force: true })
  }
  const url = `http://localhost:${port}/`
  for (let i = 0; i < 600; i++) {
    try {
      if ((await fetch(url)).ok) return { sha, url, close }
    } catch {}
    await new Promise(r => setTimeout(r, 100))
  }
  close()
  throw new Error(`the worktree server for ${ref} did not start on ${port} (is the port taken?)`)
}
