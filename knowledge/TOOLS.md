# Rendering and inspection tools

`SP` = scratchpad. Scene specs and `params.mjs`: [SCENE_SPECS.md](SCENE_SPECS.md).

## Render: `scripts/snapshot.mjs`

```sh
curl -s localhost:5174 | grep -o '<title>[^<]*'      # expect "Amazing Sea Wallpaper"
npx vite                                              # run_in_background, if not running
node scripts/snapshot.mjs --out $SP/feat --w 1920 --h 1080 --frames 16 2024-01-03 2024-09-05 …
node scripts/snapshot.mjs --out $SP/feat --frames 16 --scene '{"timeOfDay":"night","lighthouse":"rock"}'
node scripts/snapshot.mjs --out $SP/feat --frames 16 --props all --crop islands --scene $SP/specs.json
lsof -tiTCP:5174 -sTCP:LISTEN | xargs kill            # stop the server when done
```

- `--props KINDS|all` reports, per prop, pieces placed, in frame, nearest distance and pixel box
  (also `debug.props` in `<name>.json`). Kinds are the creators in `props/index.ts` (`rocks`,
  `islands`, `shore-life`, `colony`, `ships`, …). Placement-only check: `--w 640 --h 360
  --frames 1`.
- `--crop KINDS` saves `<name>.<kind>.jpg`; read the crop, not the frame.
- ⚠ warnings (`scripts/checks.mjs`): backlit view (low sun within 60° of the view; pale features
  vanish), prop not placed or out of frame. Act on them before reading images.
- `--budget SECONDS` (default 900) kills hung renders. macOS has no `timeout`; don't wrap commands
  in one.
- 16 frames at 1080p (~2–3 s/day) is enough for geometry and lighting; grainy clouds are expected.
  Use 2560×1440 for small features.
- The first render after starting Vite can take minutes (dep optimisation).
- `DEBUG=1` prints `debug` (exposure, scene luminance, irradiance, nightScale); it's also in each
  `.json`. Otherwise use a temporary `console.warn('DBG …')` (snapshot echoes it) and remove it
  before committing.
- A shader compile failure prints `[browser error] THREE.WebGLProgram: Shader Error` +
  `ERROR: 0:LINE: …` and the numbered source; read them, don't grep them away. GLSL errors show
  only at render time: test patched shaders with `--w 320 --h 180 --frames 1` first. `half` is a
  reserved word in GLSL ES 3.

## Look at results cheaply

- **Mesh preview: `scripts/mesh.mjs`** (~0.4 s/mesh): side, front, 3/4 above and eye height
  `--eye` m off, on sand-albedo ground with a 1 m ruler; prints size and triangles. The builder can
  be any export under `src/` returning a BufferGeometry or Object3D; args are JSON, `$rng` is a
  seeded Random (`--seed`).
  ```sh
  node scripts/mesh.mjs --out $SP/mesh 'props/wildlife#hippoGeometry($rng, 0)' 'props/wildlife#crocodileGeometry($rng, "nile", 0.4)'
  ```
- **"Did it show up?" is a number: `scripts/diff.mjs`.** It renders each spec as-is and with
  `--off` merged, then prints % changed, pixel box, strength and brighter/darker, plus
  `NAME.diff.jpg` (off | on cropped, diff ×8 below). `⚠ invisible` (< 0.01%) means not placed, out
  of frame, hidden (cloud layer, geometry) or too faint; fix that before looking. ~6 s/spec at
  960×540.
  ```sh
  node scripts/diff.mjs --scene $SP/specs.json --off '{"contrails":null}' --out $SP/contrails --w 960 --h 540 --frames 16
  node scripts/diff.mjs --a $SP/before --b $SP/after          # two folders, same names
  ```
- **Contact sheet:** `node scripts/contact-sheet.mjs --dir $SP/feat` (one image read, not eight).
  - `--region top|bottom|centre|X0,Y0,X1,Y1` (fractions) for sky features;
  - `--compare $SP/before` puts pairs side by side;
  - `--match REGEX` filters names (`'\.rocks$'` for crops).
- Manual crop: `sips -c <h> <w> --cropOffset <y> <x> in.jpg --out crop.jpg` (height before width,
  y before x); resize with `sips -Z 1200`. There's no PIL here.
- **Speed: `scripts/bench.mjs --ref HEAD~3`** checks out the ref in a temp worktree on port 5175
  and renders the same dates (or `--scene`) both ways, best of `--runs 2`. It prints times
  (`⚠ >10% slower`) and the pixel diff (~35 s, 4 default dates). Use it for the 10% rule and for
  speed work, where the image must stay identical.
- **Animals table:** `node scripts/animals.mjs` → paste into ANIMALS.md.
- Reason from numbers before re-rendering. Post-exposure units: sky ≈ 0.1–1; above 40 clamps to
  white. The night moon disc is ~10⁴, so anything drawn on it must be a 10⁻⁴–10⁻³ fraction.

## Page UI (no rendering change)

`main.ts`, `style.css`: no snapshot needed. Use a throwaway Playwright script that reads computed
styles after clicks/taps:
- `chromium.launch({channel:'chrome'})`; an `isMobile`/`hasTouch` context for phones;
- `await window.__sea.ready`; `?scene={"clouds":[]}` for speed;
- a script in `$SP` can't resolve `playwright`: import `<repo>/node_modules/playwright/index.mjs`;
- service worker and cache: `npx vite build` + `npx vite preview --port 4173` (dev skips the
  worker), with `?w=320&h=180&frames=1&cache=1` (the cache is off under webdriver).

## Tool gotchas

- Changing `vite.config.ts` restarts the dev server and can leave pages at `504 Outdated Optimize
  Dep` (the render hangs until `--budget`). Fix: `npx vite --port 5176 --force` and pass
  `--url http://localhost:5176/` (snapshot, bench).
- The first `mesh.mjs` run on a fresh dev server can re-optimise deps; renders then throw
  `reading 'hasFeature'` (two three.js copies). Restart with `npx vite --force`.
- `bench.mjs` clears `out/bench` first. Its first HEAD render can come out wrong (no haze): re-run
  before blaming the change.
- Scripted edits: Python `str.replace` hits every match (`"  cirrus: {"` also hit the choice
  table), and loose regexes hit params. Prefer Edit, or assert exactly one match.
