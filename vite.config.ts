/// <reference types="vitest/config" />
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Relative base so the build works under https://<user>.github.io/<repo>/
/** The commit being built: cached renders (renderCache.ts) from other builds
 * are never shown. */
function buildId(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return String(Date.now())
  }
}

export default defineConfig({
  base: './',
  define: { __BUILD_ID__: JSON.stringify(buildId()) },
  // Pages: the wallpaper, and /random/ which redirects to a random past day.
  build: {
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'index.html'), random: resolve(import.meta.dirname, 'random/index.html') }
    }
  },
  // Rendered snapshots land in out/; don't reload the page when they change.
  // Port 5174, not Vite's default 5173 (often taken by other projects), and
  // fail rather than drift to another port, so the snapshot script's
  // default URL always reaches this app.
  server: { port: 5174, strictPort: true, watch: { ignored: ['**/out/**'] } },
  // Tests over every real day (allParams, generateSceneParams) take 1–4 s
  // alone and time out at the default 5 s when renders or another suite
  // share the machine.
  test: { testTimeout: 20_000 }
})
