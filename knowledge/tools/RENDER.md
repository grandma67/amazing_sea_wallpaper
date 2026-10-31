# Render tools: snapshot, diff, bench, mesh, contact sheet

Index, dev server and shared conventions: [TOOLS.md](../TOOLS.md). Debug switches:
[DEBUG.md](DEBUG.md).

## `scripts/snapshot.mjs`: render

```sh
node scripts/snapshot.mjs --out $SP/feat --w 1920 --h 1080 --frames 16 2024-01-03 2024-09-05 …
node scripts/snapshot.mjs --out $SP/feat --frames 16 --scene '{"timeOfDay":"night","lighthouse":"rock"}'
node scripts/snapshot.mjs --out $SP/feat --frames 16 --props all --crop islands --scene $SP/specs.json
```

- Defaults are 3840×2160 and the page's 64 frames: always pass size and frames. 16 frames at
  1080p (~2–3 s/day) is enough for geometry and lighting; grainy clouds are expected. 2560×1440
  for small features; placement only: `--w 640 --h 360 --frames 1`; after a shader edit:
  `--w 320 --h 180 --frames 1` first (GLSL errors show only at render time).
- Saves `NAME.jpg` and `NAME.json` (params, spec and `debug`: exposure, scene luminance,
  irradiance, nightScale, `cameraGroundM`, `props`, `propTimes`). `DEBUG=1` also prints `debug`.
  Otherwise a temporary `console.warn('DBG …')` (snapshot echoes browser warnings), removed
  before committing.
- `--props KINDS|all`: per prop, pieces placed, in frame, nearest distance and pixel box, its CPU
  build time, and the three slowest kinds (e.g. rocks ~275 ms, vegetation ~320 ms on a Nova
  Scotia beach). Use it for a new prop's cost (`bench.mjs` only times the whole render). Kinds are
  the creators in `props/index.ts` (`rocks`, `islands`, `shore-life`, `colony`, `ships`, …).
- `--crop KINDS` saves `NAME.KIND.jpg`; read the crop, not the frame.
- ⚠ warnings (`scripts/checks.mjs`): backlit (low sun within 60° of the view: pale features
  vanish; check front-lit with `"sunAzimuthDeg": 160`), prop not placed or none in frame. Act on
  them before reading images.
- `--ref HEAD`: "was this already broken?" (implies `--drop-unknown`, so a new feature's scene
  file works as it is).
- `--budget SECONDS` (default 900) kills hung renders.
- A shader compile failure prints `[browser error] THREE.WebGLProgram: Shader Error` +
  `ERROR: 0:LINE: …` and the numbered source; read them, don't grep them away. Reserved words:
  LESSONS.md "Shaders".

## `scripts/diff.mjs`: did it show up?

Renders each spec as-is (`OUT/on`) and with `--off` merged deeply (`OUT/off`), then prints %
changed, pixel box (98% of the change), mean/max Δ and brighter/darker, plus `NAME.diff.jpg`
(off | on cropped, diff ×8 below). `⚠ invisible` (< 0.01%) means not placed, out of frame,
hidden (cloud layer, geometry) or too faint: fix that before looking. ~6 s/spec at 960×540.

```sh
node scripts/diff.mjs --scene $SP/specs.json --off '{"contrails":null}' --out $SP/contrails --w 960 --h 540 --frames 16
node scripts/diff.mjs --scene $SP/specs.json --off '{"props":{"rocks":false}}' --out $SP/rocks     # keeps the other props
node scripts/diff.mjs --scene S --ref HEAD --out $SP/change   # S at the ref (off) vs now (on)
node scripts/diff.mjs --a $SP/before --b $SP/after            # two folders, same names
```

- `--keep-camera`: terrain changes (bars, cusps, tides) also move the camera, which stands on the
  ground. With it the "on" renders go first and each "off" render stands at the same height
  (`params.camera.groundM`, from `debug.cameraGroundM`). Heading and lens are the date's in both;
  props on the reshaped ground still move; a composition re-roll can still differ.
- `--keep-exposure`: exposure is metered from the sky alone (`meterScene` over the env scene) and
  the weather (gloom, time of day), not from terrain or props. A sky, weather, haze or sun change
  re-exposes the whole frame, mixing the feature with the exposure shift. With it each "off"
  render uses the "on" render's exposure (`params.debug.exposure`): clear vs broken cloud went
  from 88% to 93% of the frame changed. No effect on terrain or prop diffs.
- With `--ref`, `--off` patches only the ref side.
- `--threshold N` (0–255, default 4): above JPEG noise; two renders of the same code on the same
  GPU are identical.

## `scripts/bench.mjs`: speed

```sh
node scripts/bench.mjs --ref HEAD~3 | tail -20
node scripts/bench.mjs --scene $SP/specs.json
```

Serves the ref on 5175 and renders the same dates (default: a clear, a cloudy, a storm and a
night day) or `--scene` both ways at 1080p/16 frames, best of `--runs 3` (the first run compiles
shaders). Prints the pixel diff first and the timing table **last** (`⚠ >10% slower`; `noisy`
when a scene's runs differ by > 10%: the machine was busy, rerun); both are saved in
`OUT/summary.txt`, so a cut-off log never means a re-run. ~50 s for the 4 default dates. Use it
for the 10% rule and for speed work, where the image must stay identical.

- Needs this tree's dev server (5174 or `--url`). Clears `--out` (default `out/bench`) first.
- Run it with nothing else on the GPU; under `caffeinate -i` on battery.
- Its first HEAD render can come out wrong (no haze): re-run before blaming the change.

## `scripts/mesh.mjs`: one mesh alone

~0.4 s/mesh: side, front, 3/4 above, and at eye height `--eye` m off (default 20), on sand-albedo
ground with a 1 m ruler; prints size and triangles. The builder is any export under `src/`
returning a BufferGeometry or Object3D; args are JSON, `$rng` is a seeded Random (`--seed`). It
can't show shader terrain: preview that with forced-spec renders.

```sh
node scripts/mesh.mjs --out $SP/mesh 'props/wildlife#hippoGeometry($rng, 0)' 'props/wildlife#crocodileGeometry($rng, "nile", 0.4)'
```

## `scripts/contact-sheet.mjs`: look at results cheaply

- `node scripts/contact-sheet.mjs --dir $SP/feat`: one image read, not eight.
- `--region top|bottom|centre|X0,Y0,X1,Y1` (fractions) for sky features; `--compare $SP/before`
  puts pairs side by side; `--match REGEX` filters names (`'\.rocks$'` for crops).
- **Zoom into one render:** `--match '^NAME$' --region X0,Y0,X1,Y1` (fractions of the frame,
  not pixels: a `--props` box `[627,926,821,1080]` at 1920×1080 is `0.33,0.86,0.43,1`). A single
  image fills the 2400 px sheet, so a small region comes out magnified.
- Post-exposure units: sky ≈ 0.1–1; above 40 clamps to white. The night moon disc is ~10⁴, so
  anything drawn on it must be a 10⁻⁴–10⁻³ fraction.

## Page UI (no rendering change)

`main.ts`, `style.css`: no snapshot needed. Use a throwaway Playwright script that reads computed
styles after clicks/taps:
- `chromium.launch({channel:'chrome'})`; an `isMobile`/`hasTouch` context for phones;
- `await window.__sea.ready`; `?scene={"clouds":[]}` for speed;
- a script in `$SP` can't resolve `playwright`: import `<repo>/node_modules/playwright/index.mjs`;
- service worker and cache: `npx vite build` + `npx vite preview --port 4173` (dev skips the
  worker), with `?w=320&h=180&frames=1&cache=1` (the cache is off under webdriver).

Page URL options (`?date`, `?w`/`?h`, `?portrait`, `?frames`, `?worker`, `?cache`, `?scene`,
`?future`): header of `src/main.ts`.
