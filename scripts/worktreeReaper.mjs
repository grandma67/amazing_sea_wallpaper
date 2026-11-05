// Cleans up a temporary worktree (lib.mjs worktree()) when the script that made
// it dies, however it dies: Ctrl+C, kill -9, a closed terminal, a crash. A
// detached process, because a dying script can't be relied on to run its own
// handlers (SIGKILL runs none, and a signal handler waits for a synchronous
// loop to end). It exits by itself once the script has removed the worktree.
//
//   node scripts/worktreeReaper.mjs OWNER_PID TREE

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { removeWorktree, SERVER_PID_FILE, stopServer } from './lib.mjs'

const owner = Number(process.argv[2])
const tree = process.argv[3]

const alive = pid => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

setInterval(() => {
  if (!existsSync(tree)) process.exit(0)
  if (alive(owner)) return
  // The server first: it writes its deps cache into the worktree.
  try {
    stopServer(Number(readFileSync(join(tree, SERVER_PID_FILE), 'utf8')))
  } catch {}
  removeWorktree(tree)
  process.exit(0)
}, 250)
