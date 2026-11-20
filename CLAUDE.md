# Amazing Sea Wallpaper

Docs in `knowledge/` (read what the task needs: one section with `node scripts/doc.mjs FILE "heading"`,
`--toc FILE` for headings, `--grep "phrase"` to search all docs across wrapped lines; a doc this
file says to *open* is read whole):
- `ARCHITECTURE.md`: decisions, params and draw order, biome/climate/place tables, frame and post,
  page/CI. How each area works: `arch/SKY.md`, `arch/OCEAN.md`, `arch/COAST.md` (coordinates and
  heights, beaches, tides, reefs, stones), `arch/PROPS.md`.
- `KNOWN_ISSUES.md`: open bugs and gaps by area; fix plans with steps: `tasks.md` (repo root).
- `lessons/`: pitfalls by topic (index: `LESSONS.md`; `lessons/PROCESS.md` on every task).
  `LEAKS.md`: in-place day changes, freeing GPU resources, `npm run check:restart`.
- `TOOLS.md`: which tool answers what, tests, conventions, dev server, gotchas; `tools/PARAMS.md`
  (params, profile, test helpers), `tools/RENDER.md` (snapshot, diff, bench, mesh, contact sheet),
  `tools/DEBUG.md` (`params.debug` switches and views).
- `SCENE_SPECS.md`: spec fields, writing specs that show a feature, fixed dates.
- What appears where and how often: `ANIMALS.md`, `CLOUDS.md`, `COASTS.md`.
- Research by topic: `SEASONS.md` (leaves, grass, colonies, whales, seals, winter sleep,
  waterfowl, snow, sea ice), `BUSHES.md` (which shrub `bush` is on each coast; flowers, fruit,
  shedding), `TREES.md` (every tree kind's flowers, fruit, cones, catkins, shedding), `NATURE.md`
  (blossom, fungi, fireflies, moss, seaweed, phase-14 animals, salt spray and how near the sea plants grow), `STARS.md` (night sky),
  `REFLECTION.md` (when water, wet sand and ice mirror; how GPUs draw it), `REGIONS.md` (places,
  grain, tides: ranges, and ebb and flow by place); sources in `REFERENCES.md`.
- `plans/`: open plans (APP, LIVE_MODE, TERRAIN_FORMS, WATERSPOUT_FOG, PLAN_BIOMES phases 13–14)
  and the records of finished ones (each with its decisions and open leftovers).

Versions: `changelog.md` (repo root). Dev server: port **5174** (`strictPort`; 5173 is other projects).

# Goal: realistic, and cheap to render

- **Realistic first:** like a photo of a real coast. Real sizes; researched place, season and time
  of day. Prefer physical rules (wave breaking, light, scattering) over "looks cool". Subtle is
  fine; fake is not. If the task conflicts with research, follow the research and say so (ask if it
  changes the look a lot).
- **Optimized:** detail only where the camera sees it.
  - Simplify with distance (far forest = colour + relief; distant pines = cones).
  - Instance repeats; bake colour into vertices instead of shader work; each mesh < ~100k tris.
  - Cap per-pixel loops (ocean foam goes round the nearest 48 rocks only).
  - Render time (snapshot, 1080p, 16 frames) is ~2–3 s per day; adding more than ~10% needs a
    reason (`scripts/bench.mjs`).
- **A move-around mode is planned** (`plans/LIVE_MODE.md`, not designed): "rare in frame" alone
  isn't a reason to drop a feature, so raise it before dropping one on a visibility count. Where it
  costs little, decide what a thing is from its world position and let only the choice of what to
  draw read the camera (`props/leafLitter.ts`).

# Developing features

## 1. Before code
- Read the relevant `arch/` doc (for a new decision in `params.ts`, ARCHITECTURE.md "Draw order in
  `buildParams`" first), `lessons/PROCESS.md` plus the `lessons/` file for the area (index:
  LESSONS.md), and the closest module: `props/rocks.ts` / `props/debris.ts` (instanced),
  `props/vegetation.ts` (plants), `scene.ts` (lighting, post).
- Define "done": which views (shoreline, along-beach, framed, overlook, open sea) on which coasts
  (beach; rock-shore: platform, boulder, cliff top; tidal-flat, salt-marsh beach), what distance, how
  often, and whether it must read at wallpaper size or may be realistic and subtle. Ask if it's
  unclear and it matters (life-size crabs and shells show only within ~20 m).
- Judged by eye (a new look, not a number): find 2–3 reference photos first and say what to match,
  **the far look too** (a field of flowers from a cliff, a ring in turf); without one, say the look
  is an estimate (a description alone cost several rounds on the ice foot, four on the bloom's far
  tint).
- **How near and how visible, by numbers, before the first render:**
  - near-camera features: how near the ground in frame is on real days (`params.mjs` `p.view`), then
    count placements: `params.mjs --count KIND [--by 'o => …'] --where 'p => …'` (pieces in frame
    per sub-kind, days with any), then a test (`view()` in `test/days.ts`). Plan numbers (radii,
    counts, budgets) are estimates until then;
  - a feature on a plant or prop kind: its nearest distance on real days (arch/PROPS.md "Where each
    plant kind stands") and its size in pixels there (TREES.md §0): stone-pine cones are 5 px at
    20 m, which only 14% of stone-pine days have (58% are past 300 m);
  - visible, not just in frame: `params.mjs --find KIND --scene S DATES` (props or terrain in front
    don't count; ranks the days; px of the nearest; haze contrast past 1 km): pick spec dates from it.
    A ground feature (turf, rings, flowers): `src.groundSeen.groundSeen(p.ctx)` (how much of each
    ground is seen, by band). Mushrooms, glow-worms and the lomas range each lost a round to "in
    frame but hidden";
  - wet surfaces (damp sand, swash, seepage, wet rock, pools): `snapshot.mjs --where … --sample 8
    --water` on and off (`debug.water.share` per kind). Ebb and flow's band was ≤ 0.2% of real
    frames, found only after the look renders;
  - light and colour: a faint light's magnitude at its distance (`fireflyMagnitude`), a tint's
    luminance ratio (~0.7 reads darker; channel ratios alone don't), a far colour against the
    ground's own (an average of several often matches it).
- Matching what an existing pass draws (haze, light, a colour already in the frame)? Measure that
  pass on a render first (`haze.mjs`; probes by world point from `params.mjs --project`, not guessed
  pixels), then write the formula. The textbook formula and a cube "stand-in" both cost rounds.
- **Verify every assumption in one batch, before code:** list each sentence in the phase that states
  a mechanism or a number as fact and check it with a command: what the code it says to copy does
  (open it: "hashed like autumn leaves" was per instanced variant, not per tree); the coordinate
  frame of every distance (`arch/COAST.md`: "60 m of the shore" from s = 0 caught no tree, trees
  start behind the dunes); both hemispheres for any month (a European row listed New Zealand); how
  many instances exist to carry a share (`--count`: "one flamboyant per view" met days with no
  broadleaf); that the "done when" view has the thing in frame (`--count`, `--project`); physical
  claims with the code's own functions (`sunLimits`, `params.mjs`); a sky target ("arc ≥ 2× the
  sky") against its mirror (`params.mjs --line`). A plan's "where we stand" and its steps can be
  stale: grep for what each step adds before building it. Write the answers in the plan.
- TODO lists: read all open items first, then ask every build-changing question (visibility,
  places, kinds) in one batch.
- Scope grows mid-task (a second bug found, another version of the fix, geometry instead of
  shading)? Stop and ask before extending it, one at a time; don't chain them (D14, D37, D9).
- A biome-keyed table? Read ARCHITECTURE.md "Biome, climate or place" first: key it by what it
  follows (rock → biome, weather → `place.climate`, one place → a place field) and add it there.
- Research briefly (1–2 searches; cite only what you read), then encode it as a data table by place
  or climate (biome only for rock), ocean, month and time of day (`FLOWERS` in
  `props/shoreLife.ts`, `debrisFor()` in `props/debris.ts`). Test the table.
- Terrain, shore and water-level features: read `arch/COAST.md` "Coordinates and heights" (s = 0 is
  the land, not the water; who measures from the shore; readers of "A new seabed or shore profile")
  and write the geometry down before code, with a forced-extremes table (each tide stage ×
  composition: camera and dry land); test it with `expectDryCameras` (`test/days.ts`).
- **Write down before the first render** (in the plan or to the user): the docs this section names,
  opened, not grepped (a skipped COAST.md cost a bug on sea ice); the real sizes and shapes from the
  photos, before reusing a nearby mesh; how many days it touches (`params.mjs --stats`): if very
  few, or a neighbouring case would be many more, raise the scope now.

## 2. Structure
- Split choice from geometry: a pure `xxxFor(params, rng)` decides; builders (`logGeometry(rng,
  …)`) work at real size with the base on y = 0; `createXxx(ctx)` places. The first two are
  unit-testable without WebGL. Add new choices to `props/choices.ts`.
- New randomness = its own stream: `ctx.rng('my-feature')` (props) or `Random.derive(seed,
  'my-feature')` (`params.ts`). Never add draws to the main `rng` in `generateParams` (it changes
  every day). In-mesh detail may use `hash()`/`noise3()`.
- Every new random feature gets a scene-spec field, forced without changing unforced days
  (SCENE_SPECS.md "Adding a spec field"). Every new prop gets an off switch (`props.<kind>: false`)
  so `diff.mjs` can show what it adds.
- Shore coords: `shoreToWorld(coast, s, a)`; s < 0 is land, 0 the foot of the high-tide beach, `a`
  along the shore. The camera is at a ≈ 0, s = −distanceToWater. `beachLines(coast)` gives the
  high-tide and storm lines.
- Place by trying spots until enough is in view (`ctx.visible`; `ctx.inFrame` for things seen
  whole), not one sample round the camera.
- Materials: `vertexColors`; `DoubleSide` for thin parts; `castShadow`/`receiveShadow`;
  `frustumCulled = false` on instanced meshes. Plants get no direct specular.
- Storm-aware props: `stormy(params)` (`props/context.ts`). Animals in water: `ctx.waterSpot(rng,
  depth, maxDistance)`.

## 3. Check it (details: TOOLS.md and `tools/`, SCENE_SPECS.md)
- **Before any shell scripting or a probe test, read TOOLS.md "Gotchas"** (zsh word splitting,
  BSD `grep`/`sed`, Vitest hiding `console.log`, Python's certificates): each cost a rerun twice.
- **Numbers before renders.** Use scene specs, not hunted dates; ask `params.mjs` for frequencies
  and "is it there at all?". Field names and values for `--where`: `params.mjs --schema PREFIX`
  (a wrong name is a silent "0 days"). Changed a choice or its inputs? `params.mjs --ref HEAD
  --stats 'p => …'` (⚠ at ≥ 5 points). Test targets: `params.mjs --expect 'pl => …'` (no sampling;
  `--weight` for a share on a subset of days). Anything about the frame needs `--rendered`
  (`--project`, `--count`, `--find` imply it): the page's framing differs on 30% of land days (coast
  and eye height only).
- A new mesh, in this order, before any scene render: its geometry tests (faces up, finite, budget),
  `scripts/mesh.mjs` alone (a look: `--material … --scale … --sun 8`, ~1 s; low sun shows what a high
  one flatters), then `params.mjs --project KIND` for where it lands. `--props KIND` also prints CPU
  build time. Render the beach only for placement and light.
- Terrain and water-depth features (bars, cusps, tides, reefs, flats): `profile.mjs` (numbers,
  cross-shore profile, depth map with the break line); compare drawn and reached numbers; force
  waves with `swellHeight`/`swellPeriod`. Diff terrain changes with `diff.mjs --keep-camera`. After
  editing a height or film term (GLSL or its TS mirror), run `node scripts/parity.mjs` (the camera,
  props and `p.view` stand on the TS mirror); read a terrain term at a pixel with
  `params.debug.terrainProbe`, not a temporary shader edit.
- A spec file's base forces `timeOfDay` and `weather` (the date's own may be night); add `eclipse:
  null`; don't force `camera.heightM` (compositions set their own).
- After any shader edit: `npx vitest run test/glsl` (reserved names like `flat`, brackets,
  `#include`s of everything tagged `/* glsl */`), then render `--w 320 --h 180 --frames 1` (other
  GLSL errors show only at render time).
- Sky and light features: place and check positions with `skyFrame.ts` (`src.skyFrame`); write a TS
  mirror of the shader (`skyMirror.ts`: same frame, `airTransmittance`, integer hash
  `hashGlsl`/`hashCell`) and compare it with the night sky's mirror (`nightGlow.ts` `nightSkyCd`)
  before rendering; then measure the render with `params.debug.probe` (points) and `probeLine`
  (lines: bands vs grain) and run the same line through `params.mjs --line`. Bands or stripes:
  switch the feature's pass off on the same frame first.
- A light inside or under the volumetric clouds (lightning, town light): arch/SKY.md "A light inside
  or under takram's clouds" first; check the cloud is there (`debug.cloudFace`) and read the
  mirror's value at the probed face (`params.mjs --project storm`) before the first look.
- A console message the user sees but a script doesn't: check the script sees that kind of message
  (TOOLS.md "Gotchas": GPU and worker GL messages need `watchPage`), then try 4K with default frames,
  before changing render conditions.
- Fixing a value's misuse in one place (a normal, a ray, a distance)? Grep its other readers in the
  same shader and check each (REFLECTION phase 2 moved only the mirror lookup off a tilted normal;
  the sky reflection three lines down kept it for four phases).
- **Fixing a named symptom (a tasks.md row): what it is, then the right technique, then the fix.**
  Before any fix, switch off what the task blames on the same frame (`diff.mjs --off`) and say
  what the thing is: D37's "spray" was the sea's mirror image and a stack's texture, D9's "grid
  aliasing" a boulder's vertical rim. Then ask how renderers solve that look (soft particles, a pass
  after the clouds) before any workaround: each workaround on D9 and D37 cost a render round.
- Debugging a look: `doc.mjs --grep SYMPTOM KNOWN_ISSUES` first. Probe creators and helpers with
  `params.mjs` (`p.ctx`, `src.X`, `props.X`), not throwaway tests; `profile.mjs` maps the view cone
  and warns when dry land floods. Then `params.debug` switches and false-colour views
  (`tools/DEBUG.md`) before editing code to test a guess. A wrong look: find its cause (grep every
  term that feeds it) before the next render, so one render tests one idea. Writing a known issue:
  say how the cause was found (measured with what, or suspected). Water's sky reflection:
  `horizon.mjs`; the sky cube itself: `debug.cubeProbe`.
- Prove visibility with `scripts/diff.mjs` before the first full render (`⚠ invisible` = fix before
  looking): props with `--off '{"props":{"<kind>":false}}'`; sky, light, haze and weather features
  with their spec field off (`'{"dust":null}'`) on a clear **and** a cloudy sky (clear days skip the
  clouds pass). Read a contact sheet, not single frames.
- A new off switch (`passes.X`, a spec field set to null) must give back the old image exactly:
  before rendering, read your `git diff` for every condition and value you changed and check each is
  under the switch; then `diff.mjs --scene … --ref HEAD --off PATCH --off-here` says "identical" (a
  later phase of a feature HEAD already has: `--off-both`; don't hand-build spec files for it).
  Missed in three phases running.
- "Was this already broken?": `snapshot.mjs --ref HEAD` (or `diff.mjs --scene … --ref HEAD`), no
  stashing.
- **Real days in the first render round, beside the specs:** `snapshot.mjs --where 'p => …'
  --sample 8`. Forced specs hide seed-dependent bugs, low sun, the coasts you didn't think of. A
  shader or choice that reads the seed: `--seeds 3`.
- Check front-lit first, then backlit. Act on snapshot ⚠ warnings before reading images.
- One render command per step, 16 frames at 1080p. ~3 render rounds per feature (see, fix
  everything, confirm) on the same dates; if a 4th seems needed, reason from numbers, `--props` and
  `diff.mjs` instead.
- Renders (`snapshot`, `diff`, `bench`) go in the background (`run_in_background`), not behind a
  long foreground timeout: a run that takes minutes is stuck (`snapshot.mjs` stops within seconds
  when its server dies). Keep a run's whole output until it has passed; don't filter it to "error".
- Animal meshes: `test/meshLint.test.ts` must pass (no loose part, no open tube end); a new animal
  or pose gets a row. Judge faces with `mesh.mjs --focus head`, a change with `mesh.mjs --ref HEAD`;
  before adding detail to anything placed in crowds, `params.mjs --count` for its triangles ×
  instances. Skins and looks: first `params.mjs --find` for how near the animals come (seals sit ≥ 60
  m off: a skin there is under a pixel); photos via `asset.mjs search`.
- Stop the dev server when done: `lsof -tiTCP:5174 -sTCP:LISTEN | xargs kill`.

## 4. Tests and finishing
- A row in a shared table where there is one (TOOLS.md "Tests"): a mesh in `meshes.test.ts`, a
  "when this, then that" rule in `realDays.test.ts`, a forced field in `sceneSpec.test.ts`, an off
  switch in `propSwitches.test.ts`. Then `test/<feature>.test.ts` covering:
  - the choice table over `allParams()` (real days): only where intended, roughly as often
    (`expectShare` in `test/days.ts`, not `toBeCloseTo`), season respected; prop choices via
    `propsOf(p)`; a table keyed by place, climate or ocean checked over every key combination;
  - feature rules via specs: `scene(spec, date?)`, `scenes(spec, count)` (e.g. `scenes({
    lighthouse: true, timeOfDay: 'night', fog: null })`); add `eclipse: null` when forcing time of
    day or sky;
  - meshes: a row with its real size and budget (`expectMesh`: deterministic, finite, 3 seeds);
  - `params.ts` changes: determinism and title.
- Run `npm test` (typecheck of `test/` + Vitest, ~7 s; `npm run test:times` for where the time
  goes) and `npx tsc --noEmit` (`src/` only) before committing; neither alone covers both.
- Say "done" only for what a render or `diff.mjs` showed; otherwise "placed, not checked". A subtle
  feature needs a before/after with its own switch off (`diff.mjs --crop`): a full frame or contact
  sheet doesn't show it.
- Show each fix when it's done, before the next one or its commit: `node scripts/show.mjs --from
  DIFF_OUT --name NAME --label 'what to look at'` (labelled side-by-side crop in Preview, left
  before; `--full` adds both frames).
- After new animals or changed chances: `node scripts/animals.mjs`, paste its table into ANIMALS.md
  (update the rules there too).
- Count the days a change touches with `node scripts/params.mjs --ref HEAD` (`--list` each day's
  changed values; `--changed 'p => p.place.id'` where; `--fields` narrows the comparison, not just
  the print) for the changelog row.
- Update docs: changelog.md, ARCHITECTURE.md and the `arch/` doc (how it works), KNOWN_ISSUES.md,
  the `lessons/` file for the area, REFERENCES.md, the topic doc (ANIMALS, CLOUDS, COASTS),
  SCENE_SPECS.md (new fields), the plan's status, and TODO.md if used.
- Never commit TODO.md. One commit per feature, with a descriptive message.
