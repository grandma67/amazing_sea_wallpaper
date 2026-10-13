import { defineConfig } from 'vite'

// Relative base so the build works under https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
  // Rendered snapshots land in out/; don't reload the page when they change.
  server: { watch: { ignored: ['**/out/**'] } }
})
