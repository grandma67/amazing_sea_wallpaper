import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// Relative base so the build works under https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
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
  server: { port: 5174, strictPort: true, watch: { ignored: ['**/out/**'] } }
})
