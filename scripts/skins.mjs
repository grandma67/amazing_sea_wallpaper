// Bake the animal skin atlas (scripts/skinBake.py) in its own Python: the
// first run makes .venv-skins (git-ignored) with numpy, scipy and Pillow.
// Arguments go to skinBake.py:
//
//   npm run skins                       the whole atlas → public/assets/skins.png
//   npm run skins -- --only ID --preview DIR   one layer, tiled 3 × 2, to check its joins
//
// asset.mjs patch ID runs this too (the patch outlined beside the baked tile).

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const venv = resolve('.venv-skins')
const python = join(venv, 'bin', 'python')
if (!existsSync(python)) {
  console.log('[skins] setting up .venv-skins (numpy, scipy, Pillow): once')
  execFileSync('python3', ['-m', 'venv', venv], { stdio: 'inherit' })
  execFileSync(python, ['-m', 'pip', 'install', '--quiet', 'numpy', 'scipy', 'pillow'], { stdio: 'inherit' })
}
execFileSync(python, ['scripts/skinBake.py', ...process.argv.slice(2)], { stdio: 'inherit' })
