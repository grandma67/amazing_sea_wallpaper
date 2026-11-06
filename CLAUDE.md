# Amazing Sea Wallpaper

Docs in `knowledge/` (read what the task needs):
- `ARCHITECTURE.md`: decisions, params and draw order, page/CI, ideas, known issues; `arch/SKY.md`,
  `arch/OCEAN.md`, `arch/COAST.md` (coordinates and heights, beaches, tides, reefs, stones),
  `arch/PROPS.md`: how each area works.
- `LESSONS.md`: pitfalls by topic.
- `LEAKS.md`: in-place day changes, freeing GPU resources, `npm run check:restart`.
- `TOOLS.md`: which tool answers what, shared conventions, dev server, gotchas; `tools/PARAMS.md`
  (params, profile, test helpers), `tools/RENDER.md` (snapshot, diff, bench, mesh, contact sheet),
  `tools/DEBUG.md` (`params.debug` switches and views).
- `SCENE_SPECS.md`: spec fields, writing specs that show a feature, fixed dates.
- `ANIMALS.md`, `CLOUDS.md`, `COASTS.md`: what appears where and how often.
- `SEASONS.md`: seasons by climate and hemisphere (leaves, grass, colonies, whales, seals,
  winter sleep, waterfowl): research and numbers.
- `STARS.md`: the night sky (stars, meteors, Milky Way, planets, airglow, aurora): research and numbers.
- `REGIONS.md`: research behind places, grain, tides; `REFERENCES.md`: sources.
- `plans/`: open plans (biomes, phone app, waterspout fix, night sky, seasons, snow, sea ice, live mode, shadows and dark frames).

Versions: `changelog.md` (repo root). Dev server: port **5174** (`strictPort`; 5173 is other projects).

# Goal: realistic, and cheap to render

- **Realistic first:** like a photo of a real coast. Use real sizes and researched place, season and time of day. Prefer physical rules (wave breaking, light, scattering) over "looks cool". Subtle is fine; fake is not. If the task conflicts with research, follow the research and say so (ask if it changes the look a lot).
- **Optimized:** detail only where the camera sees it.
  - Simplify with distance (far forest = colour + relief; distant pines = cones).
  - Instance repeats; bake colour into vertices instead of shader work; keep each mesh under ~100k tris.
  - Cap per-pixel loops (ocean foam goes round the nearest 48 rocks only).
  - Render time (snapshot, 1080p, 16 frames) is ~2–3 s per day; adding more than ~10% needs a reason (`scripts/bench.mjs`).
- **A move-around mode is planned** (`plans/LIVE_MODE.md`, not designed yet): "rare in frame" alone isn't a reason to drop a feature, so raise this before dropping one on a visibility count. Where it costs little, decide what a thing is from its world position and let only the choice of what to draw read the camera (`props/leafLitter.ts`).

# Developing features

## 1. Before code
- Read the relevant `arch/` doc (for a new decision in `params.ts`, ARCHITECTURE.md "Draw order in `buildParams`" first), LESSONS.md (relevant sections) and the closest module: `props/rocks.ts` / `props/debris.ts` (instanced), `props/vegetation.ts` (plants), `scene.ts` (lighting, post).
- Define "done": which views (shoreline, along-beach, framed, overlook, open sea) on which coasts (beach, rock-shore: platform, boulder, cliff top; tidal-flat, salt-marsh beach), what distance, how often, and whether it must read at wallpaper size or may be realistic and subtle. Ask if it's unclear and it matters (life-size crabs and shells show only within ~20 m).
- Features judged by eye (a new look, not a number): find 2–3 reference photos first and say what to match; without one, say the look is an estimate. Only a description cost several render rounds on the ice foot.
- Near-camera features: read how near the ground in frame is on real days (`params.mjs` `p.view`) and count placements in a test (`view()` in `test/days.ts`) before rendering. Plan numbers (radii, counts, budgets) are estimates until then.
- TODO lists: read all open items first, then ask every build-changing question (visibility, places, kinds) in one batch.
- A biome-keyed table? Read ARCHITECTURE.md "Biome, climate or place" first: key it by what it follows (rock → biome, weather → `place.climate`, one place → a place field) and add it to that list.
- Check a plan's physical claims with the code's own functions (`sunLimits`, `params.mjs`) before writing specs or tests from them; a visual target for a sky feature ("arc ≥ 2× the sky") against its mirror (`params.mjs --line`).
- Research briefly (1–2 searches; cite only what you read), then encode the result as a data table by place or climate (biome only for rock), ocean, month and time of day (e.g. `FLOWERS` in `props/shoreLife.ts`, `debrisFor()` in `props/debris.ts`). Test the table.
- Terrain, shore and water-level features: read `arch/COAST.md` "Coordinates and heights" first (s = 0 is the land, not the water; who measures from the shore; the readers of "A new seabed or shore profile") and write the geometry down before code, with a forced-extremes table (each tide stage × composition: camera and dry land); test it with `expectDryCameras` (`test/days.ts`).

- **Before the first render, write down (in the plan or to the user):**
  1. the docs this section names for the task, opened, not grepped (a skipped COAST.md cost a bug on sea ice);
  2. the real sizes and shapes, from the reference photos, before reusing a mesh that's nearby;
  3. how many days it touches (`params.mjs --stats`). If that's very few, or a neighbouring case would be many more, raise the scope now, not after building.

## 2. Structure
- Split choice from geometry: a pure `xxxFor(params, rng)` decides; builders (`logGeometry(rng, …)`) work at real size with the base on y = 0; `createXxx(ctx)` places. The first two are unit-testable without WebGL. Add new choices to `props/choices.ts`.
- New randomness = its own stream: `ctx.rng('my-feature')` (props) or `Random.derive(seed, 'my-feature')` (`params.ts`). Never add draws to the main `rng` in `generateParams` (that changes every day). In-mesh detail may use `hash()`/`noise3()`.
- Every new random feature gets a scene-spec field, forced without changing unforced days (SCENE_SPECS.md "Adding a spec field"). Every new prop gets an off switch (`props.<kind>: false`) so `diff.mjs` can show what it adds.
- Shore coords: `shoreToWorld(coast, s, a)`. s < 0 is land, 0 the foot of the high-tide beach; `a` runs along the shore. The camera is at a ≈ 0, s = −distanceToWater. `beachLines(coast)` gives the high-tide and storm lines.
- Place by trying spots until enough is in view (`ctx.visible`, `ctx.inFrame` for things that must be seen whole), not one sample round the camera.
- Materials: `vertexColors`; `DoubleSide` for thin parts; `castShadow`/`receiveShadow`; `frustumCulled = false` on instanced meshes. Plants get no direct specular.
- Storm-aware props: `stormy(params)` (`props/context.ts`). Animals in water: `ctx.waterSpot(rng, depth, maxDistance)`.

## 3. Check it (details: TOOLS.md and `tools/`, SCENE_SPECS.md)
- A new mesh, in this order, before any scene render: its geometry tests (faces up, finite, budget), `scripts/mesh.mjs` alone, then `params.mjs --project KIND` for where it lands. Anything about the frame in `params.mjs` needs `--rendered` (`--project` implies it): the page's framing differs on 30% of land days (coast and eye height only; heading, lens and every other choice stay).
- Numbers before renders. Use scene specs, not hunted dates; ask `params.mjs` for frequencies and "is it there at all?". Changed a choice or its inputs? `params.mjs --ref HEAD --stats 'p => …'` (⚠ at ≥ 5 points). Test targets: `params.mjs --expect 'pl => …'` (no sampling).
- Terrain and water-depth features (bars, cusps, tides, reefs, flats): `profile.mjs` (numbers, cross-shore profile, top-down depth map with the break line); compare drawn and reached numbers; force waves with `swellHeight`/`swellPeriod`. Diff terrain changes with `diff.mjs --keep-camera`.
- A spec file's base forces `timeOfDay` and `weather` (the date's own may be night); don't force `camera.heightM` (compositions set their own). `--props KIND` also prints CPU build time. Preview new meshes alone with `scripts/mesh.mjs`; render the beach only for placement and light.
- After any shader edit, render `--w 320 --h 180 --frames 1` first (GLSL errors and reserved words like `flat` show only at render time).
- Sky and light features: place and check positions with `skyFrame.ts` (`params.mjs` `src.skyFrame`); write a TS mirror of the shader (`skyMirror.ts`: same frame, `airTransmittance`, integer noise hash `hashGlsl`/`hashCell`) and compare it with the night sky's own mirror (`nightGlow.ts` `nightSkyCd`) before rendering; then measure the render with `params.debug.probe` (points) and `probeLine` (lines: bands vs grain) and run the same line through `params.mjs --line` to validate the mirror. Bands or stripes: switch the feature's pass off on the same frame first.
- A console message the user sees but a script doesn't: first check the script sees that kind of message (TOOLS.md "Gotchas": GPU and worker GL messages need `watchPage`), then try 4K with default frames, before changing render conditions.
- Debugging a look: first grep ARCHITECTURE.md "Known issues" for the symptom. Probe creators and helpers with `params.mjs` (`p.ctx`, `src.X`, `props.X`), not throwaway tests; `profile.mjs` maps the view cone and warns when dry land floods. Then switches and false-colour views in `params.debug` (`tools/DEBUG.md`: grid density, props off, markers, passes, fixed exposure, terrain and sea views) before editing code to test a guess.
- Prove visibility with `scripts/diff.mjs` before the first full render (`⚠ invisible` = fix before looking): props with `--off '{"props":{"<kind>":false}}'`; sky, light, haze and weather features with their spec field off (`'{"dust":null}'`) on a clear **and** a cloudy sky (clear days skip the clouds pass, so haze and cloud-lit effects can vanish there). Read a contact sheet, not single frames.
- "Was this already broken?": `snapshot.mjs --ref HEAD` (or `diff.mjs --scene … --ref HEAD`) renders the last commit without stashing.
- **Real days in the first render round, beside the specs:** `snapshot.mjs --where 'p => …' --sample 8`. Forced specs hide what real days show (seed-dependent bugs, low sun, the coasts you didn't think of). A shader or choice that reads the seed: `--seeds 3`.
- A look on a mesh: `mesh.mjs --material … --scale … --sun 8` before any scene (~1 s, low sun shows what a high one flatters).
- A wrong look: find its cause before the next render (grep every term that feeds it, `params.debug`), so one render tests one idea.
- Check front-lit first, then backlit. Act on snapshot ⚠ warnings before reading images.
- One render command per step, 16 frames at 1080p. ~3 render rounds per feature (see, fix everything, confirm) on the same dates. If a 4th seems needed, reason from numbers, `--props` and `diff.mjs` instead.
- Stop the dev server when done: `lsof -tiTCP:5174 -sTCP:LISTEN | xargs kill`.

## 4. Tests and finishing
- `test/<feature>.test.ts` covering:
  - the choice table over `allParams()` (real days): only where intended, roughly as often (`expectShare` in `test/days.ts`, not `toBeCloseTo`), season respected; prop choices via `propsOf(p)`; a table keyed by place, climate or ocean also checked over every key combination (no sampling);
  - feature rules via specs: `scene(spec, date?)` and `scenes(spec, count)` in `test/days.ts` (e.g. `scenes({ lighthouse: true, timeOfDay: 'night', fog: null })`). Add `eclipse: null` when forcing time of day or sky (real eclipse days override);
  - meshes: deterministic, finite positions and normals, base near y = 0, within the triangle budget;
  - `params.ts` changes: determinism and title.
- Run `npm test` (typecheck of `test/` + Vitest, ~20 s) and `npx tsc --noEmit` (`src/` only) before committing; neither alone covers both.
- Say "done" only for what a render or `diff.mjs` showed; otherwise say "placed, not checked". A subtle feature needs a before/after with its own switch off (`diff.mjs --crop`): a full frame or contact sheet doesn't show it.
- After new animals or changed chances: run `node scripts/animals.mjs` and paste its table into ANIMALS.md (update the rules there too).
- Count the days a change touches with `node scripts/params.mjs --ref HEAD` (before committing; `--list` shows each day's changed values; `--changed 'p => p.place.id'` says where; `--fields` narrows the comparison, not just the print) for the changelog row.
- Update docs: changelog.md, ARCHITECTURE.md and the `arch/` doc (how it works, known issues), LESSONS.md, REFERENCES.md, the topic doc (ANIMALS, CLOUDS, COASTS), SCENE_SPECS.md (new fields), and TODO.md status if used.
- Never commit TODO.md. One commit per feature, with a descriptive message.
