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
  server: { watch: { ignored: ['**/out/**'] } }
})
