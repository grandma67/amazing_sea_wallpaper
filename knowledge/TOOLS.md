# Tools

`SP` = scratchpad. Spec format and fields: [SCENE_SPECS.md](SCENE_SPECS.md). Reason from numbers
(this page's no-render tools) before rendering.

## Ask the generator, don't render: `scripts/params.mjs`

Params are cheap (3 years in ~1.5 s). Use it for frequencies, which days, what a spec gives, real
dates (eclipses) and "is it there at all?".

```sh
node scripts/params.mjs --help
node scripts/params.mjs --stats 'p => p.weather.formations'                  # counts over the test days
node scripts/params.mjs --stats 'p => p.contrails.length' --where 'p => p.sea.ocean === "southern"'
node scripts/params.mjs --list --where 'p => p.storm?.shelf != null' --fields title,camera.headingDeg
node scripts/params.mjs --scene '{"storm":"squall"}' --stats 'p => p.weather.formations'   # spec on every day
node scripts/params.mjs --scene scenes/stony.json --fields title,place.id    # each scene of a {base, scenes} file
node scripts/params.mjs --stats 'p => p.props.wildlife?.crocodile ?? null'   # prop choices
```

- Dates are `YYYY-MM-DD` or `FROM..TO`; with none, the test days (`test/days.ts`). Pick 4–8 dates
  covering the cases (each biome, near/far, day/night).
- `--where`/`--stats` take a JS function of `SceneParams`; `--stats` counts array elements.
- `p.props` = what the props choose (`props/choices.ts`), on the same streams as the render.
- `p.placeData` = the day's resolved place (`places.ts` `Place`: weight, tide, reef, material and
  sand chances, pools).
- **Expected shares, no sampling:** `--expect 'pl => …'` weighs every place by its share of days
  (numbers are averaged, anything else counted; null leaves a place out). Use it for a test's
  `expectShare` target instead of a probe test.
  ```sh
  node scripts/params.mjs --expect 'pl => pl.biome === "tropical" ? pl.reef : null'   # 0.46
  node scripts/params.mjs --stats 'p => p.coast.reef != null' --where 'p => p.placeData.reef > 0.5'
  ```
- **What the camera sees:** each day's `p.view` (eye height above the ground, lens, pixel angle at
  1080p, nearest ground in frame, ground at the bottom centre; `frameView` in `composition.ts`). A
  thing of size S at distance d is S / (d × pixelMrad / 1000) px wide. Over real beach days the
  nearest ground is under ~7 m on 40–55% of along-beach and framed days, 5–40 m on shorelines and
  40 m+ on overlooks. `--rendered` uses the params the page renders (`generateSceneParams` may
  re-roll a bad framing).
  ```sh
  node scripts/params.mjs --rendered --scene '{"place":"nova-scotia","composition":"shoreline"}' --fields view 2025-07-10
  node scripts/params.mjs --stats 'p => p.coast.composition + " " + Math.min(40, Math.round(p.view.nearest / 5) * 5)' --where 'p => p.coast.type === "beach"'
  ```
- **Props and helpers on real days, no render:** `p.ctx` is the props' `PropContext` at 1080p
  (the render camera and frustum, `ground`, `visible`, `inFrame`, `distance`, `rng`; no wave
  field, so `seaLevel` is 0), built on first use. Expressions naming `src.X` or `props.X` get
  `src/X.ts` and `src/props/X.ts` (all but the browser-only ones: main, workers, assets, clouds,
  meshPreview, scene). Use these instead of throwaway test files to probe a creator, a
  placement rule or a height helper. Creators build meshes (ms each): a spec or a few dates.
  ```sh
  node scripts/params.mjs --scene '{"place":"fundy","coast":"tidal-flat","tide":"high"}' --stats 'p => p.ctx.ground(0, 0) > p.coast.runup'
  node scripts/params.mjs --scene '{"saltMarsh":true,"composition":"framed"}' --stats 'p => props.saltMarsh.createSaltMarsh(p.ctx).reduce((n, m) => n + m.count, 0) > 300' 2025-07-01..2025-07-20
  node scripts/params.mjs --scene '{"coast":"tidal-flat"}' --stats 'p => src.terrain.worldToShore(p.coast, 0, 0).map(Math.round)' 2025-07-10
  ```
- **Which days did a change touch:** `--ref HEAD` (or any ref) generates every test day with that
  commit (temporary worktree) and with this tree, and counts the days that differ per top-level
  param (fields added since are listed, not counted). `--fields a.b` narrows it, `--list` prints
  each changed day's leaf values before → after, `--limit N`. Use it for the changelog's "N of
  1096 days change" and to catch cascades (a new draw on the wrong stream shows as `camera` or
  `ocean` changing on every day).
- **Did the shares move:** `--ref HEAD --stats 'p => …' --where …` prints each value's share at
  the ref and now side by side, with the change in points (⚠ at ≥ 5). Run it on every choice a
  change touches before rendering. `--where` runs on each side's own params.
- Must-be-in-frame features (moon, eclipse): compute from `camera.headingDeg`, `focalLengthMm`
  (36×24 mm sensor) and `horizonFraction`; don't render to find out.
- Sky features: compare height and distance with the day's layers (`--fields
  weather.formations`, altitudes in `cloudTypes.ts`) first; inside the storm deck (Cb base 600 m)
  or scud (300–550 m) means hidden.

## Coast shape without rendering: `scripts/profile.mjs`

~0.6 s/scene, TS mirror of the terrain shader. Prints state, grain, slopes, bars, rips, cusps,
ridges, run-up, beach lines, break depth and the camera's place; on reef days the reef (crest and
lagoon depth **drawn vs reached**, flat, passes, shelter); how far the surf zone reaches
(`surfReach`) and **where a full wave breaks along the camera's cut** (bands of s with their
width: a 2 m strip on a steep face won't read as a white line from afar); heights along s at the
camera, through the nearest rip channel and the nearest reef pass. Writes `NAME.profile.png` (out
to the surf zone's end): sea at the top, a across, land brown→green by height, water light→dark
blue by depth, 0.5 m contours, black waterline, white where the day's waves break, red camera,
50 m grid, and the **view cone** in yellow (the frame's edges on the ground and an arc at
`view.nearest`): what crosses the frame and from how near, so a creek or ridge 12 m beside the
camera that a long lens stretches across the picture shows here, not after a render. It prints
the lens and nearest ground, and **dry-land checks**: the share of land behind the beach (and of
a marsh beach's marsh, or a flat's high marsh) below today's spring high water + run-up, with
`⚠ floods` over 10%. On tidal flats it prints the flat, marsh and creeks drawn vs reached and maps
the marsh to today's water at ≥ 4 m/px. Use it for any terrain or depth feature before a render;
compare every drawn number with the reached one.

```sh
node scripts/profile.mjs --scene scenes/beach-states.json --out $SP/profile
node scripts/profile.mjs --scene '{"place":"namibia","coast":"beach","swellHeight":2.5,"swellPeriod":12}' 2024-06-11
```

## Props in tests

`view(spec, height)` / `viewOf(params, height)` in `test/days.ts` give a `PropContext` (camera,
`pixelAngle`) without WebGL: test what a creator places, how far and how many pixels, over specs
and real days, before any render.

## Render: `scripts/snapshot.mjs`

```sh
curl -s localhost:5174 | grep -o '<title>[^<]*'      # expect "Amazing Sea Wallpaper"
npx vite                                              # run_in_background, if not running
node scripts/snapshot.mjs --out $SP/feat --w 1920 --h 1080 --frames 16 2024-01-03 2024-09-05 …
node scripts/snapshot.mjs --out $SP/feat --frames 16 --scene '{"timeOfDay":"night","lighthouse":"rock"}'
node scripts/snapshot.mjs --out $SP/feat --frames 16 --props all --crop islands --scene $SP/specs.json
lsof -tiTCP:5174 -sTCP:LISTEN | xargs kill            # stop the server when done
```

- 16 frames at 1080p (~2–3 s/day) is enough for geometry and lighting; grainy clouds are expected.
  Use 2560×1440 for small features. Placement-only check: `--w 640 --h 360 --frames 1`. After a
  shader edit: `--w 320 --h 180 --frames 1` first (GLSL errors show only at render time).
- `--props KINDS|all` reports, per prop, pieces placed, in frame, nearest distance and pixel box
  (also `debug.props` in `<name>.json`), each kind's CPU build time and the three slowest
  (`debug.propTimes`; e.g. rocks ~275 ms, vegetation ~320 ms on a Nova Scotia beach). Use it for a
  new prop's cost (`bench.mjs` only times the whole render). Kinds are the creators in
  `props/index.ts` (`rocks`, `islands`, `shore-life`, `colony`, `ships`, …).
- `--crop KINDS` saves `<name>.<kind>.jpg`; read the crop, not the frame.
- ⚠ warnings (`scripts/checks.mjs`): backlit view (low sun within 60° of the view; pale features
  vanish), prop not placed or out of frame. Act on them before reading images.
- `--ref HEAD` renders another commit (temporary worktree on port 5177, `scripts/refServer.mjs`)
  without stashing: "was this already broken?". Spec fields the ref doesn't know are left out and
  named (`--drop-unknown`, implied by `--ref`), so a new feature's scene file works as it is.
- `--budget SECONDS` (default 900) kills hung renders. macOS has no `timeout`; don't wrap commands
  in one.
- The first render after starting Vite can take minutes (dep optimisation).
- `DEBUG=1` prints `debug` (exposure, scene luminance, irradiance, nightScale); it's also in each
  `.json`. Otherwise a temporary `console.warn('DBG …')` (snapshot echoes it), removed before
  committing.
- A shader compile failure prints `[browser error] THREE.WebGLProgram: Shader Error` +
  `ERROR: 0:LINE: …` and the numbered source; read them, don't grep them away. Reserved words:
  LESSONS.md "Shaders".

## Did it show up? `scripts/diff.mjs`

Renders each spec as-is and with `--off` merged, then prints % changed, pixel box, strength and
brighter/darker, plus `NAME.diff.jpg` (off | on cropped, diff ×8 below). `⚠ invisible` (< 0.01%)
means not placed, out of frame, hidden (cloud layer, geometry) or too faint; fix that before
looking. ~6 s/spec at 960×540.

```sh
node scripts/diff.mjs --scene $SP/specs.json --off '{"contrails":null}' --out $SP/contrails --w 960 --h 540 --frames 16
node scripts/diff.mjs --a $SP/before --b $SP/after          # two folders, same names
node scripts/diff.mjs --scene S --ref HEAD                  # S at the ref (OUT/off) vs now (OUT/on)
```

- `--keep-camera`: terrain changes (bars, cusps, tides) also move the camera, which stands on the
  ground. With it the "on" renders go first and each "off" render stands at the same height
  (`params.camera.groundM`, from `debug.cameraGroundM`). Props on the reshaped ground still move; a
  composition re-roll can still differ.
- With `--ref`, `--off` patches only the ref side.
- `--keep-exposure`: the exposure is metered from the sky alone (`meterScene` over the env
  scene) and the weather (gloom, time of day), not from terrain or props. A change to the sky,
  weather, haze or sun re-exposes the whole frame, so the diff mixes the feature with the
  exposure shift. With it the "on" renders go first and each "off" render uses the same
  exposure (`params.debug.exposure`): clear vs broken cloud went from 88% to 93% of the frame
  (the off side no longer brightens to compensate). No effect on terrain or prop diffs.

## Debug switches and views: `params.debug`

Render-only switches (`src/debug.ts`), set through a spec's `params` patch, so every script
takes them (`snapshot`, `diff --off`, `params --fields debug`). The generator never reads them:
no draw or other param changes (`test/debug.test.ts`), and a misspelt field throws.
`scenes/debug.json` shows each view on a rock platform and a beach.

| Field | Does | Use it for |
|---|---|---|
| `terrainGrid: 2` | terrain grid × 2 (rings and segments; 0.25–4) | is it grid aliasing? `diff --off '{"params":{"debug":{"terrainGrid":2}}}'`: teeth that change are the grid's |
| `props: false` | no props (markers still drawn) | terrain and sea alone; with `clouds: []`, `weather: "clear"`, `islands`/`landform`/`lighthouse`/`colony`/`pinnipeds: null` a terrain-only render |
| `markers: [...]` | a post (~6 px wide, ≥ 1 m) at each point, a colour per source in list order (red, cyan, yellow, green, magenta, white) | where things stand: `camera-ground`, `edge-rocks`, `water-rocks`, `props:KIND` (each piece of a prop kind, e.g. `props:pinnipeds`) |
| `passes: {name: false}` | switches off `clouds`, `aerial` (aerial perspective), `skyFill`, `bloom`, `reflection` (planar), `shadows` (props cast none) | which pass causes a glow, rim or dark band: one `diff --off` per pass |
| `exposure: N` | fixed exposure (the metered one is `debug.exposure` in each render's `.json`) | comparing renders whose sky or weather differs (`diff.mjs --keep-exposure` sets it) |
| `terrainView` | false colour on the terrain, lit by the scene's light: `slope` (grey by steepness, red where the height bends by 3–10 px within ~2 grid cells: aliasing candidates; less red with `terrainGrid: 2`), `relief` (rock: gullies red, boulders green, bed bands blue; beach: cusps red, bars green, storm ridges blue), `lines` (today's still water cyan, run-up orange, today's high water green, spring high water yellow, beach high-tide line magenta, storm line red), `shore` (s blue and a orange every 10 m, s = 0 white, `waterline` cyan) | which height term made a feature; whether lines sit where props and wet bands assume; the shore frame (wobble, curvature) round the camera |
| `oceanView` | false colour on the sea: `shelter` (blue → red), `breaking` (deep blue, steepening green, breaking red), `depth` (sand → blue over 15 m, a line every metre), `foam` (coverage, grey) | calm water, break lines, depth under the camera's view |

- **Bisect a height term without code:** patch it off in `params.coast` and diff, e.g.
  `diff --off '{"params":{"coast":{"rock":{"dip":0}}}}' --keep-camera` (also `gully`, `relief`,
  `boulder`; on beaches `bars: []`, `cusps: null`, `ridges: []`). The term whose diff shows the
  feature is its cause. Read the feature's period first (a saw every ~1 m on rock was the beds'
  bedding / dip).
- Check a patch landed before rendering: `params.mjs --scene S --fields debug,coast.rock`.

## Look at results cheaply

- **Mesh preview: `scripts/mesh.mjs`** (~0.4 s/mesh): side, front, 3/4 above and eye height `--eye`
  m off, on sand-albedo ground with a 1 m ruler; prints size and triangles. The builder can be any
  export under `src/` returning a BufferGeometry or Object3D; args are JSON, `$rng` is a seeded
  Random (`--seed`).
  ```sh
  node scripts/mesh.mjs --out $SP/mesh 'props/wildlife#hippoGeometry($rng, 0)' 'props/wildlife#crocodileGeometry($rng, "nile", 0.4)'
  ```
- **Contact sheet:** `node scripts/contact-sheet.mjs --dir $SP/feat` (one image read, not eight).
  `--region top|bottom|centre|X0,Y0,X1,Y1` (fractions) for sky features; `--compare $SP/before`
  puts pairs side by side; `--match REGEX` filters names (`'\.rocks$'` for crops).
- **Zoom into one render:** `contact-sheet.mjs --dir D --match '^NAME$' --region X0,Y0,X1,Y1`
  (fractions of the frame, not pixels: a `--props` box `[627,926,821,1080]` at 1920×1080 is
  `0.33,0.86,0.43,1`). A single image fills the 2400 px sheet, so a small region comes out
  magnified; several images share the width (thumbnails). `sips --cropOffset` silently returns the
  whole image here; there's no PIL.
- Post-exposure units: sky ≈ 0.1–1; above 40 clamps to white. The night moon disc is ~10⁴, so
  anything drawn on it must be a 10⁻⁴–10⁻³ fraction.

## Speed: `scripts/bench.mjs`

`bench.mjs --ref HEAD~3` checks out the ref in a temp worktree on port 5175 and renders the same
dates (or `--scene`) both ways, best of `--runs 3`. Prints times (`⚠ >10% slower`; `noisy` when a
scene's runs differ by > 10%: the machine was busy, rerun) and the pixel diff (~50 s, 4 default
dates). With `--scene` the ref run drops spec fields it doesn't know. Use it for the 10% rule and
for speed work, where the image must stay identical. It clears `out/bench` first; its first HEAD
render can come out wrong (no haze): re-run before blaming the change.

## Animals table

`node scripts/animals.mjs` → paste into ANIMALS.md.

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
- Two vite servers must not share one deps cache: a worktree symlinking this tree's `node_modules`
  shares `node_modules/.vite`, and both pages fail with `reading 'hasFeature'`. `refServer.mjs`
  gives the worktree its own `cacheDir`. If 5174 is broken that way: stop it,
  `rm -rf node_modules/.vite`, start `npx vite` again.
- Waiting for the dev server: it answers in 1–2 s; cap a wait loop at ~10 s and treat longer as a
  fault.
- Vitest hides `console.log` from passing tests: a throwaway probe test prints with
  `process.stderr.write(…)` (and is deleted afterwards). Prefer `params.mjs` or a real test.
- Scripted edits: Python `str.replace` hits every match (`"  cirrus: {"` also hit the choice
  table), and loose regexes hit params. Prefer Edit, or assert exactly one match.
