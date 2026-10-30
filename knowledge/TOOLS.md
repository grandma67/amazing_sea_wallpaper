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
  (also `debug.props` in `<name>.json`), each kind's CPU build time and the three slowest
  (`debug.propTimes`; e.g. rocks ~275 ms and vegetation ~320 ms on a Nova Scotia beach). Use it
  for a new prop's cost instead of probe tests: `bench.mjs` only times the whole render. Kinds are the creators in `props/index.ts` (`rocks`,
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
  - `--keep-camera`: terrain changes (bars, cusps, tides) also move the camera, which stands on
    the ground, and then most of the frame differs. With it the "on" renders go first and each
    "off" render stands at the same height (`params.camera.groundM`, from `debug.cameraGroundM`).
    Props on the reshaped ground still move. A composition re-roll can still differ.
- **Coast shape without rendering: `scripts/profile.mjs`** (~0.6 s/scene, TS mirror of the terrain
  shader). Prints state, grain, slopes, bars, rips, cusps, ridges, run-up, beach lines, break
  depth and the camera's place; on reef days the reef (crest and lagoon depth **drawn vs
  reached**, flat, passes, shelter); how far the surf zone reaches (`surfReach`) and **where a full
  wave breaks along the camera's cut** (bands of s with their width: a 2 m strip on a steep face
  won't read as a white line from afar); heights along s at the camera, through the nearest rip
  channel and the nearest reef pass (out past the crest); writes `NAME.profile.png` (out to the
  surf zone's end): sea at the top, a across, land brown→green by height, water
  light→dark blue by depth, 0.5 m contours, black waterline, **white where the day's waves break**,
  red camera, 50 m grid. Use it for any terrain or depth feature before a render (rips that don't
  cut the breaker line, cusps too small, bars too deep, a lagoon that never reaches its depth,
  surf breaking on too narrow a band show here). Compare every drawn number with the reached
  one before rendering.
  ```sh
  node scripts/profile.mjs --scene scenes/beach-states.json --out $SP/profile
  node scripts/profile.mjs --scene '{"place":"namibia","coast":"beach","swellHeight":2.5,"swellPeriod":12}' 2024-06-11
  ```
- **Contact sheet:** `node scripts/contact-sheet.mjs --dir $SP/feat` (one image read, not eight).
  - `--region top|bottom|centre|X0,Y0,X1,Y1` (fractions) for sky features;
  - `--compare $SP/before` puts pairs side by side;
  - `--match REGEX` filters names (`'\.rocks$'` for crops).
- **Zoom into one render:** `contact-sheet.mjs --dir D --match '^NAME$' --region X0,Y0,X1,Y1`
  (fractions 0..1 of the frame, not pixels: a `--props` box `[627,926,821,1080]` at 1920×1080 is
  `0.33,0.86,0.43,1`). A
  single image fills the sheet (2400 px wide), so a small region comes out magnified (the bottom
  0.45 × 0.16 of a 1080p frame ≈ 2.7×). Several images share the width: thumbnails, not a zoom.
  `sips --cropOffset` silently returns the whole image here; there's no PIL.
- **What the camera sees, without rendering:** `params.mjs` gives each day `p.view` (eye height
  above the ground, lens, pixel angle at 1080p, nearest ground in frame, ground at the bottom
  centre; `frameView` in `composition.ts`). Ask it before sizing near-camera props: a thing of
  size S at distance d is S / (d × pixelMrad / 1000) px wide. `--rendered` uses the params the
  page renders (`generateSceneParams` may re-roll a bad framing).
  ```sh
  node scripts/params.mjs --rendered --scene '{"place":"nova-scotia","composition":"shoreline"}' --fields view 2025-07-10
  node scripts/params.mjs --stats 'p => p.coast.composition + " " + Math.min(40, Math.round(p.view.nearest / 5) * 5)' --where 'p => p.coast.type === "beach"'
  ```
- **Expected shares from the place table, no sampling:** `params.mjs --expect 'pl => …'` weighs
  every place (`places.ts` `Place`) by its share of days: numbers are averaged (the share you
  should get), anything else counted; null leaves a place out. Each day also has `p.placeData`
  (its resolved place: weight, tide, reef, material and sand chances, pools) for `--where` and
  `--stats`. Use these instead of a probe test to set a test's `expectShare` target.
  ```sh
  node scripts/params.mjs --expect 'pl => pl.biome === "tropical" ? pl.reef : null'   # 0.46
  node scripts/params.mjs --stats 'p => p.coast.reef != null' --where 'p => p.placeData.reef > 0.5'
  ```
- **Which days did a change touch:** `params.mjs --ref HEAD` (or any ref) generates every test
  day with that commit (temporary worktree) and with this tree, and counts the days that differ
  per top-level param (fields added since are listed, not counted). `--fields a.b` narrows it,
  `--list` prints each changed day's leaf values before → after. Use it for the changelog's
  "N of 1096 days change" and to catch accidental cascades (a new draw on the wrong stream shows
  as `camera` or `ocean` changing on every day).
- **Did the shares move:** `params.mjs --ref HEAD --stats 'p => p.coast.state' --where …` prints
  each value's share at the ref and now side by side, with the change in points (⚠ at ≥ 5).
  Run it on every choice a change touches before rendering (phase 5 found reflective beaches
  29% → 10% only at the docs step). `--where` runs on each side's own params.
- **Before/after images without stashing:** `snapshot.mjs --ref HEAD …` renders with that commit
  (temporary worktree on port 5177, `scripts/refServer.mjs`); `diff.mjs --scene S --ref HEAD`
  renders S at the ref (OUT/off) and now (OUT/on) and diffs them; `--off` then patches only the
  ref side. Spec fields the ref doesn't know (the feature's own `reef`, `props.beachrock`) are
  left out there and named (`--drop-unknown`, checked with the ref's own `sceneSpec.ts`), so a
  new feature's scene file works with `--ref` as it is. Use it for "was this already broken?".
- **Props in tests:** `view(spec, height)` / `viewOf(params, height)` in `test/days.ts` give a
  `PropContext` (camera, `pixelAngle`) without WebGL: test what a creator places, how far and
  how many pixels, over specs and real days, before any render.
- **Speed: `scripts/bench.mjs --ref HEAD~3`** checks out the ref in a temp worktree on port 5175
  and renders the same dates (or `--scene`) both ways, best of `--runs 3`. It prints times
  (`⚠ >10% slower`; `noisy` when a scene's runs differ by > 10%: the machine was busy, so rerun
  before believing it) and the pixel diff (~50 s, 4 default dates). With `--scene`, the ref run
  drops spec fields it doesn't know (as `snapshot.mjs --ref`), so the feature's own scene file
  benchmarks it. Use it for the 10% rule and for
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
- Two vite servers must not share one deps cache. A worktree that symlinks this tree's
  `node_modules` would share `node_modules/.vite`, and both pages then fail with `reading
  'hasFeature'`. `refServer.mjs` gives the worktree its own `cacheDir`. If 5174 is broken that
  way: stop it, `rm -rf node_modules/.vite`, start `npx vite` again.
- Waiting for the dev server: it answers in 1–2 s; cap a wait loop at ~10 s and treat longer
  as a fault, not something to wait out.
- `bench.mjs` clears `out/bench` first. Its first HEAD render can come out wrong (no haze): re-run
  before blaming the change.
- GLSL ES 3.00 keywords and reserved words that read like names: `flat`, `smooth`, `half`,
  `input`, `output`, `filter`, `active`, `common`, `partition`, `fixed`, `long`, `short`. And `smoothstep(e0, e1, x)` with
  e0 ≥ e1 is undefined (works on one GPU, not another): write `1.0 - smoothstep(e1, e0, x)`. Both
  show only at render time: after any shader edit, render `--w 320 --h 180 --frames 1` first.
- Vitest hides `console.log` from passing tests: a throwaway probe test prints with
  `process.stderr.write(…)` (and is deleted afterwards). Prefer `params.mjs` or a real test.
- Scripted edits: Python `str.replace` hits every match (`"  cirrus: {"` also hit the choice
  table), and loose regexes hit params. Prefer Edit, or assert exactly one match.
