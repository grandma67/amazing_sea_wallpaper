// Serve another commit under vite on its own port (a temporary worktree,
// lib.mjs), for bench.mjs, snapshot.mjs --ref and diff.mjs --ref.
//
//   const old = await serveRef('HEAD', 5175)   // { sha, url, close }
//   old.close()                                 // synchronous: safe in 'exit'

import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { SERVER_PID_FILE, stopServer, worktree } from './lib.mjs'

export { shortSha } from './lib.mjs'

export async function serveRef(ref, port = 5175) {
  const { sha, tree, remove } = worktree(ref, `ref-${port}`)
  // Its own deps cache, not node_modules/.vite: through the shared
  // node_modules both servers would rewrite one cache, and pages then load
  // two three.js copies ("reading 'hasFeature'").
  writeFileSync(
    join(tree, 'vite.ref.config.mjs'),
    `import { mergeConfig } from 'vite'\nimport base from './vite.config.ts'\nexport default mergeConfig(base, { cacheDir: ${JSON.stringify(join(tree, '.vite-cache'))} })\n`
  )
  const server = spawn('npx', ['vite', '--config', 'vite.ref.config.mjs', '--port', String(port), '--strictPort'], { cwd: tree, stdio: 'ignore', detached: true })
  // For worktreeReaper.mjs, if the caller dies before calling close.
  writeFileSync(join(tree, SERVER_PID_FILE), String(server.pid))
  // Don't keep the caller alive; its 'exit' handler (close) stops the server.
  server.unref()
  const close = () => {
    // The whole group: killing npx alone can leave vite on the port.
    stopServer(server.pid)
    remove()
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
