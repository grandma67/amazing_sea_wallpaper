# Amazing Sea Wallpaper

- The dev server runs on port **5174** (`npm run dev`); 5173 belongs to other projects.
- PLAN.md has the architecture, versions, decisions and lessons.

# Goal: realistic, and cheap to render

Every feature should look like a photograph of a real coast, and cost as little as it can.
- **Realistic first:** real sizes, real places (research which coast, season and time of
  day), physically grounded rules (wave breaking, light, scattering) over "looks cool".
  Subtle is fine; fake is not. When the task's own rule conflicts with the research, follow
  the research and say so (or ask, if it changes the look a lot).
- **Optimized:** spend detail where the camera sees it. Simplify with distance (a far
  forest is colour and relief, not trees; distant pines are cones), instance repeated
  meshes, bake colour into vertices instead of adding shader work, keep each mesh under
  ~100k triangles, and cap per-pixel loops (the ocean foams round the nearest 48 rocks
  only). Watch the render time the snapshot script prints (1080p/16 frames: ~2–3 s); a
  feature that adds more than ~10% needs a reason.

# Developing features

How to add a scene feature (a prop, a sky effect, a lighting change) and check it
efficiently. Written after the debris, shore-life and moon/eclipse work, which took longer
than it should have.

## 1. Before writing code

- **Read PLAN.md** ("How it works", "Lessons and gotchas") and the module closest to what you
  are adding: `props/rocks.ts` or `props/debris.ts` for instanced props, `props/vegetation.ts`
  for plants, `scene.ts` for lighting and post-processing.
- **Decide what "done" looks like**: which views it should show in (shoreline, along-beach,
  framed, overlook, open sea), at what distance, how often, and whether it should be
  readable at wallpaper size or realistic and subtle. If the task doesn't say and it
  matters, ask the user. Life-size crabs and shells, for example, only show within ~20 m.
- **Working through a TODO list:** read every open item first and ask all the questions
  that change what gets built in one batch (how visible, which places, which kinds),
  rather than discovering them a render round in.
- **Research briefly, then commit to a table.** One or two searches are enough. Encode the
  result as data: which biome/ocean/month/time of day gets what (see `FLOWERS` in
  `props/shoreLife.ts` and `debrisFor()` in `props/debris.ts`). The table is what gets
  tested.

## 2. Structure that keeps it testable and stable

- **Split choice from geometry.** A pure `xxxFor(params, rng)` decides what appears; mesh
  builders (`logGeometry(rng, …)`) build it at real size with the base on y = 0; a
  `createXxx(ctx)` places instances. The first two are unit-testable without WebGL.
- **New randomness gets its own stream:** `ctx.rng('my-feature')` in props, or
  `Random.derive(seed, 'my-feature')` in `params.ts`. Never add draws to the main `rng` in
  `generateParams`: that changes every other day's scene. Detail inside a mesh can use
  `hash()`/`noise3()` instead of the stream.
- **Shore coordinates:** `shoreToWorld(coast, s, a)`, with s < 0 on land, s = 0 at the
  waterline and `a` along the shore (camera at a ≈ 0, s = −distanceToWater).
  `beachLines(coast)` gives the high-tide line and the storm line.
- **Place by trying spots until enough land in view** (`ctx.visible`), not by sampling once
  around the camera: the visible beach is often far along the shore (see the driftwood
  piles loop).
- Every material: `vertexColors`, `DoubleSide` for thin parts, `castShadow`/`receiveShadow`,
  `frustumCulled = false` on instanced meshes. Plants: switch off direct specular (see
  `vegetation.ts`) or edge-on leaves glitter.

## 3. Describe the scene in JSON instead of hunting for dates

A **scene spec** (`src/sceneSpec.ts`) forces whatever the feature needs and leaves the rest
to the date. Put one spec or a list in a file and render them:

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

- Each image is saved as `<name>.jpg` (or `<date>.jpg`) with its params and spec in `<name>.json`;
  the contact sheet takes any of them. In the browser: `?scene=<JSON>`.
- Left-out fields come from the date (`date` also sets the moon phase and the month), and
  forcing one thing keeps the others: `{"date": D, "timeOfDay": "night"}` is day D's biome,
  coast and lens at night. `seed` gives another random scene on the same date.
- Fields: `timeOfDay`, `evening`, `sunElevationDeg`, `sunAzimuthDeg` (0 = ahead),
  `moonPhaseDeg`, `dayMoon`, `nightSky`, `eclipse`, `biome`, `ocean`, `monsoon`, `ice`, `coast`,
  `composition`, `sand`, `weather`, `clouds` (genera and species, ≤ 4 layers, e.g.
  `["cumulus-humilis","cumulus-fractus"]`), `cloudArrangement`, `storm`, `shelfCloud`,
  `waterspout`, `rollCloud`, `lenticular`, `contrails` (true or a count), `noctilucent`,
  `nacreous`, `rainbow`, `fog`, `lighthouse`, `landform`, `islands`, `colony`, `colonySite`,
  `pinnipeds`, `haulOut`, `wind`, `camera.{heightM,focalLengthMm,horizonFraction,rollDeg}`
  and `props.{marine,birds,migratory,ships,rocks,seaStacks,vegetation,debris,shoreLife,mangroves,wildlife}`.
- `camera.horizonFraction` is how far **down** the frame the horizon sits: 0.3 is mostly sea,
  0.7 mostly sky (for sky features).
- A spec file can share fields: `{"base": {date, camera, props…}, "scenes": [{"name": "a", …}]}`;
  each scene is merged deeply over the base (snapshot.mjs and diff.mjs).
  For features that can be absent, `null`/`false` removes them, `true` makes sure they are there,
  and a kind (`"rock"`, `"bank"`, `"orca"`) forces the kind.
- Anything else goes in `params`, a deep patch over the finished `SceneParams`
  (`{"params": {"coast": {"distanceToWater": 6}, "lighthouse": {"paint": "red"}}}`). It
  comes last, so the title and anything derived from the patched field don't follow it.
- Unknown fields and bad values throw, naming the field: a typo never quietly renders a
  random day.
- A new random feature should get a field here: draw as usual, then apply the forced value
  with `or(drawn, force)`, `forced()` or `forcedKind()`, always making the draw, so an
  unforced spec stays byte-identical to the date (`test/sceneSpec.test.ts`). Props read
  `ctx.params.overrides`.
- Forced features are placed like any other: a life-size crab still needs sand near the
  camera in frame, and a boat is skipped if no sea spot is found.

## 3b. Ask the generator, don't render: `scripts/params.mjs`

Computing params is cheap (three years of days in ~1.5 s); rendering is not. Ask
`params.mjs` how often something happens, which days have it, and what a spec gives,
before rendering anything:

```sh
node scripts/params.mjs --stats 'p => p.weather.formations'                 # counts over 3 years
node scripts/params.mjs --stats 'p => p.contrails.length' --where 'p => p.sea.ocean === "southern"'
node scripts/params.mjs --list --where 'p => p.storm?.shelf != null' --fields title,camera.headingDeg
node scripts/params.mjs --scene '{"waterspout":true}' --fields waterspout,weather.formations 2024-09-12
node scripts/params.mjs --scene '{"storm":"squall"}' --stats 'p => p.weather.formations'   # a spec on every day
```

- `--where`/`--stats` take a JS function of the `SceneParams`; `--stats` counts each element
  of an array. Dates: `YYYY-MM-DD` or `FROM..TO`; none = the test days (`test/days.ts`).
- Use it for frequencies, real dates (eclipses) and "is it there at all?"; use specs for looks.
  Pick 4–8 dates covering the cases (each biome, a near view and a far one, day and night).
- For a feature that must be in frame (the moon, an eclipse), compute whether it is in frame
  from `camera.headingDeg`, `focalLengthMm` (36×24 mm sensor) and `horizonFraction`. Don't
  render to find out.

Useful fixed dates: 2024-04-08 and 2026-08-12 (total solar eclipse), 2024-10-02 (annular),
2025-03-29 (partial solar), 2025-03-14 (blood moon), 2026-08-28 (partial lunar),
2024-02-12 (Arctic beach, driftwood), 2024-06-26 (nordic beach, kelp, daytime moon),
2024-07-12 (Mediterranean beach, seagrass, shells), 2024-03-08 (tropical shore at golden hour),
2024-09-12 (Mediterranean in waterspout season), 2024-04-24 (storm with a shelf cloud).

## 4. Render

The dev server runs on **5174** (`strictPort`; 5173 is often another project). First check
it is this app, then start it in the background if needed:

```sh
curl -s localhost:5174 | grep -o '<title>[^<]*'      # expect "Amazing Sea Wallpaper"
npx vite                                              # run_in_background
SP=<scratchpad>
node scripts/snapshot.mjs --out $SP/feat --w 1920 --h 1080 --frames 16 2024-02-12 2024-07-12 …
node scripts/snapshot.mjs --out $SP/feat --frames 16 --props all --crop islands --scene $SP/specs.json
```

- **`--props KINDS` (or `all`) prints where each prop landed**: pieces placed, how many in
  frame, the nearest one's distance, its pixel box. Kinds are the creators in
  `props/index.ts` (`rocks`, `islands`, `shore-life`, `colony`, `ships`, …). It's also
  under `debug.props` in each `<name>.json`. This answers "did it show up, and where?"
  without reading an image, and replaces temporary `console.warn` placement logs. For a
  placement check alone, render small: `--w 640 --h 360 --frames 1`.
- **`--crop KINDS` also saves `<name>.<kind>.jpg`**, the frame cut to that prop's box.
  Read the crop, not the frame.
- **Warnings (⚠) after each render:** a backlit view (low sun within 60° of the view,
  where pale features vanish), and a `--props` kind that wasn't placed or landed out of
  frame. Act on them before reading any image (`scripts/checks.mjs`).
- **One render command per step**, and check what's already in the output folder before
  re-running; don't chain two runs of the same specs.
- **`--budget SECONDS`** (default 900) stops the script if a render hangs. macOS has no
  `timeout` command; don't wrap the script in one.

- 16 frames at 1080p is ~2–3 s a day and enough to judge geometry and lighting. Clouds stay
  grainy; that's expected. Use 2560×1440 when the feature is small.
- The very first render after starting Vite can take minutes (dependency optimisation).
- `DEBUG=1` prints each day's `debug` (exposure, scene luminance, irradiance, nightScale).
  It's also in the `DATE.json` next to each image.
- For anything `--props` doesn't cover, add a temporary `console.warn('DBG …')`. The
  snapshot script echoes browser warnings. Remove it before committing.
- **A shader that fails to compile** prints `[browser error] THREE.WebGLProgram: Shader Error`
  followed by the `ERROR: 0:LINE: …` lines and the numbered source round them. Read those
  lines (don't grep them away); GLSL errors only show up at render time, so check a patched
  shader with one tiny render (`--w 320 --h 180 --frames 1`) before a full round.
- Stop the server when you're done (`lsof -tiTCP:5174 -sTCP:LISTEN | xargs kill`).

## 5. Look at the results cheaply

- **"Did it show up?" is a number, not an image: `scripts/diff.mjs`.** It renders each spec
  as written and with `--off` merged in, and prints how much of the frame changed, where
  (pixel box), how strongly and whether brighter or darker, plus `NAME.diff.jpg` (off | on
  cropped to the change, difference ×8 below). `⚠ invisible` (< 0.01% changed) means not
  placed, out of frame, hidden (inside a cloud layer, behind geometry) or too faint: fix that
  before looking at pictures. ~6 s per spec at 960×540.

  ```sh
  node scripts/diff.mjs --scene $SP/specs.json --off '{"contrails":null}' --out $SP/contrails --w 960 --h 540 --frames 16
  node scripts/diff.mjs --a $SP/before --b $SP/after          # two folders of renders, same names
  ```
- **Contact sheet first:** `node scripts/contact-sheet.mjs --dir $SP/feat` makes one image of
  all the days. Read that instead of each frame: one image read instead of eight.
- **Sky features:** `contact-sheet.mjs --region top` (or `bottom`, `centre`, `X0,Y0,X1,Y1`
  fractions) shows only that part of each image, at a bigger size.
- **Crop for small things**: `--crop KIND` at render time. By hand, from the full-size
  render: `sips -c <height> <width> --cropOffset <y> <x> in.jpg --out crop.jpg` (note:
  height before width, y before x). Resize whole frames with `sips -Z 1200`. Python has no
  PIL here.
- **Before/after a commit, time and pixels: `scripts/bench.mjs`.** It checks out a ref in a
  temporary worktree, serves it on 5175, renders the same dates (or `--scene`) with both
  (best of `--runs 2`), and prints each render time side by side (`⚠ >10% slower`) and a
  pixel diff. `node scripts/bench.mjs --ref HEAD~3` (~35 s for the 4 default dates). Use it
  for the ~10% rule and for speed work, which must leave the image identical.
- **Side-by-side pictures:** render the same specs into `$SP/before` and `$SP/after`, then
  `node scripts/contact-sheet.mjs --dir $SP/after --compare $SP/before` puts each pair
  side by side in one image. `--match REGEX` keeps some names only (`'\.rocks$'` for the
  crops).
- **Light it so you can see it.** Foam, spray, mist and anything pale vanish against the
  glare of a low sun ahead: the water there is as bright as the foam. Check them in a
  front-lit spec first (`"sunAzimuthDeg": 160`, `"timeOfDay": "daylight"`), then backlit
  for looks.
- **Budget about three render rounds per feature**: one to see it, one to fix everything
  seen, one to confirm. If a fourth seems needed, stop and reason from numbers, the
  `--props` report or `diff.mjs` instead.
- **Before the first render of anything in the sky, write down its height and distance**
  and compare them with the cloud layers that day (`params.mjs --fields weather.formations`,
  altitudes in `cloudTypes.ts`): a mesh inside the storm deck (Cb base 600 m) or the scud
  (300–550 m) is hidden, whatever its colour.
- **When you change a shared layer** (a cloud type, the exposure, fog), re-check conclusions
  drawn while it was broken. Scud made every storm flat grey; "calvus and capillatus look
  the same from below" was blamed on physics and was wrong.
- Keep the **same dates across rounds** so you compare like with like, and budget the
  rounds: decide what to check, render once, fix everything you saw, render again.
- When something looks wrong, **reason from the numbers before re-rendering.** Render units
  after exposure: sky ≈ 0.1–1; values above 40 clamp to white (GradeEffect). A night moon
  disc is ~10⁴, so anything on it (earthshine, eclipse shadow) must be a 10⁻⁴–10⁻³
  fraction or it saturates. Work out the factor from the JSON, then render.

## 6. Things that bit us

- **Auto exposure re-normalises everything.** Making the whole scene darker or brighter
  does nothing; change `exposure` (e.g. `nightScale`) or the relative brightness of parts.
- **takram's sky** draws the sun and moon independently, with no occlusion. Its shader string can
  be patched after construction (`eclipse.ts`; make the patch throw if it stops matching).
  A moon drawn bigger is dimmer unless `lunarRadianceScale` scales with `moonScale²`.
- **The env cube is 256²**: a star or a bright speck becomes a whole texel and shows as a
  block in wet-sand reflections. Don't boost things in `envScene`.
- **Props are lit by `scene.environment`** (the sky cube) as well as the sun light. In odd
  lighting (totality) they glow unless you dim `environmentIntensity`.
- **Small objects at real scale vanish:** check the frame sizes before tuning colours. A
  10 cm crab at 5 m is ~70 px at 4K; at 20 m it's a speck.
- **Smooth blobs read as rocks.** Seaweed and seagrass need texture: loose leaves and
  ribbons draped over a low mound (`MeshBuilder.ribbon`, `clumpGeometry`).
- **Uniform tubes read as pipes.** Wood needs bulges, an oval section, checks along the grain
  and splintered ends (`logGeometry`).
- `MeshBuilder.tube` returns its rings; close the ends with `MeshBuilder.cap`.
- **"Not showing" is usually placement, lighting or size, not code.** Check `--props`
  (placed? in frame? how far?), then the light (backlit?), then pixel size, before
  debugging a shader. If a shader really needs debugging, force one visible output
  (`coverage = 1.0` over a region) and move it step by step.
- **Low things at sea hide behind the horizon** (~4.5 km from 1.6 m eye height): a 2 m cay
  is only a line of palms. Place low features near; a group of low islands can read as
  one long shore.
- **Steep features narrower than the ocean grid zig-zag** (vertex spacing is r × 0.012):
  clamp widths to the grid and pixel size (see `surfProfile`'s `minFace`).
- **Sheer walls on a polar grid read as drums**: vary the wall's foot with angle.
- `half` is a reserved word in GLSL ES 3.
- **Patching takram's sky shader** (`eclipse.ts`, `contrails.ts`, `noctilucent.ts`): insert
  functions before `vec3 getSkyRadiance(` and calls after the `vec3 radiance =
  GetSkyRadiance(…);` line; patch only the main sky, never `envScene`'s. Lengths there are in
  km (`ATMOSPHERE.bottom_radius`), positions are ECEF from the earth's centre. Things drawn
  there sit under the volumetric clouds and behind geometry for free. The weather-map
  lookup in the clouds' shaders is patched the same way (`cloudArrangement.ts`).
- **Light for something floating in the air** (a contrail, a high cloud): takram's
  `GetSunAndSkyIrradiance` is for a surface (cosine factor, zero once the sun is below its
  plane). Use `GetSunAndSkyScalarIrradiance` and a phase function.
- `Vector3.transformDirection` normalises: scale a direction after transforming it.
- **takram cloud layers:** `coverageFilterWidth` near 1 turns any layer into a sheet over the
  whole sky; ragged scraps need a narrow width and a high `weatherExponent`. A second layer
  in an étage reads the weather map's alpha (fine Perlin; `layerChannels`). From under a
  closed deck you never see a cloud's top.
- **A mesh hanging from the volumetric clouds** (a waterspout) can't know where the deck has
  gaps: give it its own soft cloud base (spray puffs), or it ends in clear sky.
- **Physically faint is fine, but know it:** noctilucent clouds need the sun 6–16° down and our
  blue hour stops at −7°, so they're faint on real days; contrails at blue hour are in the
  earth's shadow (dark lines). Say so rather than boost them.
- **Editing by script:** Python's `str.replace` replaces every match (a key like `"  cirrus: {"`
  also hit the choice table) and a loose regex hit a function's parameters. Prefer the Edit
  tool, or assert the old text occurs exactly once.

## 7. Tests and finishing

- Add a `test/<feature>.test.ts` covering:
  - the choice table over `allParams()` (the real days): only where it should, roughly as
    often as intended, the season respected;
  - the feature's own rules on scenes that have it, set up with a spec instead of searching
    the days: `scene(spec, date?)` and `scenes(spec, count)` in `test/days.ts`
    (e.g. `scenes({ lighthouse: true, timeOfDay: 'night', fog: null })`). Add
    `eclipse: null` when forcing a time of day or sky: real eclipse days override them;
  - the meshes: deterministic, finite positions and normals, base near y = 0, triangle
    budget;
  - for anything in `params.ts`, determinism and the title.
- `npm test` (typecheck + Vitest, ~6 s) and `npx tsc --noEmit` before committing.
- Say "done" only for what a render or `diff.mjs` showed: a feature never seen clearly (behind
  a cloud, too small) is "placed, not checked".
- Update PLAN.md: versions table, "How it works", lessons, references. Update TODO.md
  status if it's in use; never commit TODO.md. Commit each feature separately with a
  descriptive message.
