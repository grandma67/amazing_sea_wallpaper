# Amazing Sea Wallpaper

PLAN.md has architecture, versions, decisions, lessons. Dev server: port **5174** (`strictPort`; 5173 is other projects).

# Goal: realistic, and cheap to render

- **Realistic first:** like a photo of a real coast. Real sizes, researched places/season/time of day, physical rules (wave breaking, light, scattering) over "looks cool". Subtle is fine; fake is not. If the task conflicts with research, follow research and say so (ask if it changes the look a lot).
- **Optimized:** detail only where the camera sees it. Simplify with distance (far forest = colour + relief; distant pines = cones), instance repeats, bake colour into vertices instead of shader work, <~100k tris per mesh, cap per-pixel loops (ocean foams round nearest 48 rocks only). Render time (snapshot script, 1080p/16 frames) ~2–3 s; >~10% added needs a reason.

# Developing features

## 1. Before code
- Read PLAN.md ("How it works", "Lessons and gotchas") and the closest module: `props/rocks.ts`/`props/debris.ts` (instanced), `props/vegetation.ts` (plants), `scene.ts` (lighting, post).
- Define "done": which views (shoreline, along-beach, framed, overlook, open sea), distance, frequency, readable at wallpaper size vs realistic/subtle. Ask if unclear and it matters (life-size crabs/shells show only within ~20 m).
- TODO lists: read all open items first; ask every build-changing question (visibility, places, kinds) in one batch.
- Research briefly (1–2 searches), then encode as a data table by biome/ocean/month/time of day (e.g. `FLOWERS` in `props/shoreLife.ts`, `debrisFor()` in `props/debris.ts`). Test the table.

## 2. Structure
- Split choice from geometry: pure `xxxFor(params, rng)` decides; builders (`logGeometry(rng, …)`) at real size, base on y = 0; `createXxx(ctx)` places. First two unit-testable without WebGL.
- New randomness = own stream: `ctx.rng('my-feature')` (props) or `Random.derive(seed, 'my-feature')` (`params.ts`). Never add draws to main `rng` in `generateParams` (changes every day). In-mesh detail may use `hash()`/`noise3()`.
- Shore coords: `shoreToWorld(coast, s, a)`; s < 0 land, 0 waterline, `a` along shore (camera a ≈ 0, s = −distanceToWater). `beachLines(coast)` → high-tide and storm lines.
- Place by trying spots until enough is in view (`ctx.visible`), not one sample round the camera; visible beach is often far along shore (see driftwood piles loop).
- Materials: `vertexColors`, `DoubleSide` for thin parts, `castShadow`/`receiveShadow`, `frustumCulled = false` on instanced. Plants: no direct specular (see `vegetation.ts`) or edge-on leaves glitter.

## 3. Scene specs (JSON) instead of hunting dates
`src/sceneSpec.ts` forces what's needed; the rest comes from the date.
```sh
node scripts/snapshot.mjs --out $SP/feat --w 1920 --h 1080 --frames 16 --scene scenes/examples.json
node scripts/snapshot.mjs --out $SP/feat --frames 16 --scene '{"timeOfDay":"night","lighthouse":"rock"}'
```
```json
{ "name": "arctic-driftwood", "date": "2024-02-12", "timeOfDay": "golden-hour",
  "biome": "nordic", "ocean": "arctic", "composition": "along-beach", "storm": null, "fog": null,
  "camera": { "heightM": 1.6 },
  "props": { "debris": { "driftwood": 1, "rootWads": true }, "shoreLife": null } }
```
- Output `<name>.jpg` (or `<date>.jpg`) + `<name>.json` (params, spec); contact sheet takes any. Browser: `?scene=<JSON>`.
- Omitted fields come from the date (`date` also sets moon phase, month); forcing one keeps the rest (`{"date": D, "timeOfDay": "night"}` = day D's biome/coast/lens at night). `seed` = another scene on the same date.
- Fields: `timeOfDay`, `evening`, `sunElevationDeg`, `sunAzimuthDeg` (0 = ahead), `moonPhaseDeg`, `dayMoon`, `nightSky`, `eclipse`, `biome`, `ocean`, `monsoon`, `ice`, `coast`, `composition`, `sand`, `weather`, `clouds` (genera/species, ≤ 4 layers, e.g. `["cumulus-humilis","cumulus-fractus"]`), `cloudArrangement`, `storm`, `shelfCloud`, `waterspout`, `rollCloud`, `lenticular`, `contrails` (true or count), `noctilucent`, `nacreous`, `rainbow`, `fog`, `lighthouse`, `landform`, `islands`, `colony`, `colonySite`, `pinnipeds`, `haulOut`, `wind`, `camera.{heightM,focalLengthMm,horizonFraction,rollDeg}`, `props.{marine,birds,migratory,ships,rocks,seaStacks,vegetation,debris,shoreLife,mangroves,wildlife}`.
- `camera.horizonFraction` = how far **down** the horizon sits: 0.3 mostly sea, 0.7 mostly sky.
- Shared fields: `{"base": {…}, "scenes": [{"name": "a", …}]}`, each scene deep-merged over base (snapshot.mjs, diff.mjs).
- Optional features: `null`/`false` removes, `true` ensures, a kind (`"rock"`, `"bank"`, `"orca"`) forces kind.
- Anything else: `params`, a deep patch over the finished `SceneParams` (`{"params": {"coast": {"distanceToWater": 6}}}`). Applied last, so title and derived values don't follow it.
- Unknown fields/bad values throw, naming the field.
- New random feature → add a field: always make the draw, then apply force via `or(drawn, force)`, `forced()` or `forcedKind()`, so unforced specs stay byte-identical (`test/sceneSpec.test.ts`). Props read `ctx.params.overrides`.
- Forced features are still placed normally (crab needs sand near camera in frame; boat skipped if no sea spot).

## 3b. Ask the generator, don't render: `scripts/params.mjs`
Params are cheap (3 years in ~1.5 s). Use for frequencies, which days, what a spec gives, real dates (eclipses), "is it there at all?"; specs for looks.
```sh
node scripts/params.mjs --stats 'p => p.weather.formations'                 # counts over 3 years
node scripts/params.mjs --stats 'p => p.contrails.length' --where 'p => p.sea.ocean === "southern"'
node scripts/params.mjs --list --where 'p => p.storm?.shelf != null' --fields title,camera.headingDeg
node scripts/params.mjs --scene '{"waterspout":true}' --fields waterspout,weather.formations 2024-09-12
node scripts/params.mjs --scene '{"storm":"squall"}' --stats 'p => p.weather.formations'   # spec on every day
```
- `--where`/`--stats` take a JS fn of `SceneParams`; `--stats` counts array elements. Dates `YYYY-MM-DD` or `FROM..TO`; none = test days (`test/days.ts`).
- Pick 4–8 dates covering cases (each biome, near/far, day/night).
- Must-be-in-frame features (moon, eclipse): compute from `camera.headingDeg`, `focalLengthMm` (36×24 mm sensor), `horizonFraction`; don't render to find out.

Fixed dates: 2024-04-08, 2026-08-12 total solar eclipse; 2024-10-02 annular; 2025-03-29 partial solar; 2025-03-14 blood moon; 2026-08-28 partial lunar; 2024-02-12 Arctic beach, driftwood; 2024-06-26 nordic beach, kelp, day moon; 2024-07-12 Mediterranean beach, seagrass, shells; 2024-03-08 tropical golden hour; 2024-09-12 Mediterranean waterspout season; 2024-04-24 storm + shelf cloud.

## 4. Render
```sh
curl -s localhost:5174 | grep -o '<title>[^<]*'      # expect "Amazing Sea Wallpaper"
npx vite                                              # run_in_background, if not running
node scripts/snapshot.mjs --out $SP/feat --w 1920 --h 1080 --frames 16 2024-02-12 2024-07-12 …
node scripts/snapshot.mjs --out $SP/feat --frames 16 --props all --crop islands --scene $SP/specs.json
```
`SP` = scratchpad.
- `--props KINDS|all`: per prop, pieces placed, in frame, nearest distance, pixel box (also `debug.props` in `<name>.json`). Kinds = creators in `props/index.ts` (`rocks`, `islands`, `shore-life`, `colony`, `ships`, …). Replaces placement `console.warn`s. Placement-only check: `--w 640 --h 360 --frames 1`.
- `--crop KINDS` saves `<name>.<kind>.jpg`; read the crop, not the frame.
- ⚠ warnings (`scripts/checks.mjs`): backlit view (low sun within 60° of view; pale features vanish), prop not placed/out of frame. Act on them before reading images.
- One render command per step; check the output folder before re-running; don't chain two runs of the same specs.
- `--budget SECONDS` (default 900) kills hung renders. macOS has no `timeout`; don't wrap.
- 16 frames at 1080p (~2–3 s/day) is enough for geometry/lighting; grainy clouds are expected. 2560×1440 for small features.
- First render after starting Vite can take minutes (dep optimisation).
- `DEBUG=1` prints `debug` (exposure, scene luminance, irradiance, nightScale); also in each `.json`.
- Otherwise use temporary `console.warn('DBG …')` (echoed by snapshot); remove before committing.
- Shader compile failure prints `[browser error] THREE.WebGLProgram: Shader Error` + `ERROR: 0:LINE: …` and numbered source; read them, don't grep away. GLSL errors show only at render: test patched shaders with `--w 320 --h 180 --frames 1` first.
- Stop the server when done: `lsof -tiTCP:5174 -sTCP:LISTEN | xargs kill`.

## 5. Look at results cheaply
- **"Did it show up?" is a number: `scripts/diff.mjs`.** Renders each spec as-is and with `--off` merged; prints % changed, pixel box, strength, brighter/darker, plus `NAME.diff.jpg` (off | on cropped, diff ×8 below). `⚠ invisible` (< 0.01%) = not placed, out of frame, hidden (cloud layer, geometry) or too faint; fix before looking. ~6 s/spec at 960×540.
  ```sh
  node scripts/diff.mjs --scene $SP/specs.json --off '{"contrails":null}' --out $SP/contrails --w 960 --h 540 --frames 16
  node scripts/diff.mjs --a $SP/before --b $SP/after          # two folders, same names
  ```
- Contact sheet first: `node scripts/contact-sheet.mjs --dir $SP/feat` (one image read, not eight). `--region top|bottom|centre|X0,Y0,X1,Y1` (fractions) for sky features. `--compare $SP/before` puts pairs side by side; `--match REGEX` filters names (`'\.rocks$'` for crops).
- Manual crop: `sips -c <h> <w> --cropOffset <y> <x> in.jpg --out crop.jpg` (height before width, y before x); resize `sips -Z 1200`. No PIL here.
- `scripts/bench.mjs --ref HEAD~3`: checks out ref in a temp worktree on 5175, renders same dates (or `--scene`) both ways (best of `--runs 2`), prints times (`⚠ >10% slower`) and pixel diff (~35 s, 4 default dates). For the 10% rule and speed work (image must stay identical).
- Light it to see it: pale things (foam, spray, mist) vanish against a low sun ahead. Check front-lit first (`"sunAzimuthDeg": 160`, `"timeOfDay": "daylight"`), then backlit for looks.
- ~3 render rounds per feature (see, fix all, confirm), same dates each round. If a 4th seems needed, reason from numbers, `--props`, `diff.mjs` instead.
- Sky features: before first render, note height/distance vs that day's cloud layers (`params.mjs --fields weather.formations`, altitudes in `cloudTypes.ts`). Inside the storm deck (Cb base 600 m) or scud (300–550 m) = hidden.
- After changing a shared layer (cloud type, exposure, fog), re-check conclusions made while it was broken (scud made storms flat grey; "calvus = capillatus from below" was wrongly blamed on physics).
- Reason from numbers before re-rendering. Post-exposure units: sky ≈ 0.1–1; > 40 clamps white (GradeEffect). Night moon disc ~10⁴, so anything on it (earthshine, eclipse shadow) must be a 10⁻⁴–10⁻³ fraction or saturates.

## 6. Things that bit us
- Auto exposure re-normalises: scaling the whole scene does nothing; change `exposure` (e.g. `nightScale`) or relative brightness.
- takram sky draws sun and moon independently (no occlusion). Its shader string can be patched after construction (`eclipse.ts`; make the patch throw if it stops matching). Bigger moon is dimmer unless `lunarRadianceScale` scales with `moonScale²`.
- Patching the sky shader (`eclipse.ts`, `contrails.ts`, `noctilucent.ts`): functions before `vec3 getSkyRadiance(`, calls after `vec3 radiance = GetSkyRadiance(…);`; main sky only, never `envScene`'s. Units km (`ATMOSPHERE.bottom_radius`), positions ECEF from earth's centre. Gets drawn under volumetric clouds and behind geometry for free. Clouds' weather-map lookup is patched the same way (`cloudArrangement.ts`).
- Env cube is 256²: bright specks become texel blocks in wet-sand reflections. Don't boost things in `envScene`.
- Props are lit by `scene.environment` too; in odd light (totality) dim `environmentIntensity` or they glow.
- Floating things (contrail, high cloud): `GetSunAndSkyIrradiance` is for surfaces (cosine, zero below plane); use `GetSunAndSkyScalarIrradiance` + phase function.
- takram cloud layers: `coverageFilterWidth` near 1 → sheet over the sky; ragged scraps need narrow width + high `weatherExponent`. 2nd layer in an étage reads weather-map alpha (fine Perlin; `layerChannels`). Under a closed deck you never see cloud tops.
- Mesh hanging from volumetric clouds (waterspout) can't see deck gaps: give it its own soft base (spray puffs).
- Physically faint is fine, but say so rather than boost: noctilucents need sun 6–16° down, our blue hour stops at −7°; blue-hour contrails are in earth's shadow (dark lines).
- Small objects at real scale vanish: check pixel size before tuning colour (10 cm crab: ~70 px at 5 m at 4K, a speck at 20 m).
- "Not showing" is usually placement, light or size: check `--props`, backlight, pixel size before debugging shaders. To debug a shader, force a visible output (`coverage = 1.0` over a region) and move it step by step.
- Smooth blobs read as rocks: seaweed/seagrass need loose leaves and ribbons over a low mound (`MeshBuilder.ribbon`, `clumpGeometry`).
- Uniform tubes read as pipes: wood needs bulges, oval section, grain checks, splintered ends (`logGeometry`).
- `MeshBuilder.tube` returns rings; close ends with `MeshBuilder.cap`.
- Low things at sea hide behind the horizon (~4.5 km at 1.6 m eye): a 2 m cay is just palms. Place low features near; low island groups can read as one shore.
- Steep features narrower than the ocean grid (spacing r × 0.012) zig-zag: clamp widths to grid and pixel size (`surfProfile`'s `minFace`).
- Sheer walls on a polar grid read as drums: vary the wall's foot with angle.
- `half` is reserved in GLSL ES 3.
- `Vector3.transformDirection` normalises: scale after transforming.
- Scripted edits: Python `str.replace` hits every match (`"  cirrus: {"` also hit the choice table), loose regexes hit params. Prefer Edit, or assert exactly one match.

## 7. Tests and finishing
- `test/<feature>.test.ts` covering:
  - choice table over `allParams()` (real days): only where intended, roughly as often, season respected;
  - feature rules via specs, not searching days: `scene(spec, date?)`, `scenes(spec, count)` in `test/days.ts` (e.g. `scenes({ lighthouse: true, timeOfDay: 'night', fog: null })`); add `eclipse: null` when forcing time of day/sky (real eclipse days override);
  - meshes: deterministic, finite positions/normals, base near y = 0, triangle budget;
  - `params.ts` changes: determinism and title.
- `npm test` (typecheck + Vitest, ~6 s) and `npx tsc --noEmit` before committing.
- Say "done" only for what a render or `diff.mjs` showed; otherwise "placed, not checked".
- Update PLAN.md (versions table, "How it works", lessons, references) and TODO.md status if used; never commit TODO.md. One commit per feature, descriptive message.
