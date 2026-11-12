// Serve another commit under vite on its own port (a temporary worktree,
// lib.mjs), for bench.mjs, snapshot.mjs --ref and diff.mjs --ref.
//
//   const old = await serveRef('HEAD', 5175)   // { sha, url, close }
//   old.close()                                 // synchronous: safe in 'exit'

import { spawn } from 'node:child_process'
import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { SERVER_PID_FILE, stopServer, worktree } from './lib.mjs'

export { shortSha } from './lib.mjs'

/** The ref server's output (overwritten each run): why it stopped, if it does. */
export const refLog = port => `/private/tmp/claude-ref-${port}.log`

export async function serveRef(ref, port = 5175) {
  // Something already answering on the port isn't ours: with --strictPort the
  // new server would fail and the wait below would render against that one
  // (a server still stopping, or another commit's).
  try {
    await fetch(`http://localhost:${port}/`)
    throw new Error(`port ${port} is already taken (lsof -tiTCP:${port} -sTCP:LISTEN): stop that server first`)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('port ')) throw error
  }
  const { sha, tree, remove } = worktree(ref, `ref-${port}`)
  // Its own deps cache, not node_modules/.vite: through the shared
  // node_modules both servers would rewrite one cache, and pages then load
  // two three.js copies ("reading 'hasFeature'").
  writeFileSync(
    join(tree, 'vite.ref.config.mjs'),
    `import { mergeConfig } from 'vite'\nimport base from './vite.config.ts'\nexport default mergeConfig(base, { cacheDir: ${JSON.stringify(join(tree, '.vite-cache'))} })\n`
  )
  const log = openSync(refLog(port), 'w')
  const server = spawn('npx', ['vite', '--config', 'vite.ref.config.mjs', '--port', String(port), '--strictPort'], { cwd: tree, stdio: ['ignore', log, log], detached: true })
  closeSync(log)
  let exited = false
  server.on('exit', () => (exited = true))
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
  /** Is the server still running? (A render waits forever on a dead one.) */
  const alive = () => {
    if (exited) return false
    try {
      process.kill(server.pid, 0)
      return true
    } catch {
      return false
    }
  }
  /** The last lines of its output. */
  const tail = (n = 15) => {
    try {
      return readFileSync(refLog(port), 'utf8').trimEnd().split('\n').slice(-n).join('\n')
    } catch {
      return '(no log)'
    }
  }
  for (let i = 0; i < 600; i++) {
    if (!alive()) {
      close()
      throw new Error(`the worktree server for ${ref} exited on start; its log (${refLog(port)}):\n${tail()}`)
    }
    try {
      if ((await fetch(url)).ok) return { sha, url, close, alive, tail, log: refLog(port) }
    } catch {}
    await new Promise(r => setTimeout(r, 100))
  }
  close()
  throw new Error(`the worktree server for ${ref} did not answer on ${port} in 60 s; its log (${refLog(port)}):\n${tail()}`)
}
