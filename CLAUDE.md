# Amazing Sea Wallpaper

Docs in `knowledge/` (read what the task needs):
- `ARCHITECTURE.md`: decisions, how each module works, ideas, known issues.
- `LESSONS.md`: pitfalls by topic.
- `SCENE_SPECS.md`: spec fields, fixed dates, `params.mjs` queries.
- `TOOLS.md`: snapshot, mesh preview, diff, contact sheet, bench, tool gotchas.
- `REFERENCES.md`: sources.
- `ANIMALS.md`, `CLOUDS.md`, `COASTS.md`: what appears where and how often.
- `REGIONS.md`: research for the plans.
- `plans/`: open plans (biomes, phone app, waterspout fix).

Versions: `changelog.md` (repo root). Dev server: port **5174** (`strictPort`; 5173 is other projects).

# Goal: realistic, and cheap to render

- **Realistic first:** like a photo of a real coast. Use real sizes and researched place, season and time of day. Prefer physical rules (wave breaking, light, scattering) over "looks cool". Subtle is fine; fake is not. If the task conflicts with research, follow the research and say so (ask if it changes the look a lot).
- **Optimized:** detail only where the camera sees it.
  - Simplify with distance (far forest = colour + relief; distant pines = cones).
  - Instance repeats; bake colour into vertices instead of shader work; keep each mesh under ~100k tris.
  - Cap per-pixel loops (ocean foam goes round the nearest 48 rocks only).
  - Render time (snapshot, 1080p, 16 frames) is ~2–3 s per day; adding more than ~10% needs a reason (`scripts/bench.mjs`).

# Developing features

## 1. Before code
- Read ARCHITECTURE.md (the relevant module), LESSONS.md (relevant sections) and the closest module: `props/rocks.ts` / `props/debris.ts` (instanced), `props/vegetation.ts` (plants), `scene.ts` (lighting, post).
- Define "done": which views (shoreline, along-beach, framed, overlook, open sea), what distance, how often, and whether it must read at wallpaper size or may be realistic and subtle. Ask if it's unclear and it matters (life-size crabs and shells show only within ~20 m).
- TODO lists: read all open items first, then ask every build-changing question (visibility, places, kinds) in one batch.
- Research briefly (1–2 searches), then encode the result as a data table by biome, ocean, month and time of day (e.g. `FLOWERS` in `props/shoreLife.ts`, `debrisFor()` in `props/debris.ts`). Test the table.

## 2. Structure
- Split choice from geometry: a pure `xxxFor(params, rng)` decides; builders (`logGeometry(rng, …)`) work at real size with the base on y = 0; `createXxx(ctx)` places. The first two are unit-testable without WebGL. Add new choices to `props/choices.ts`.
- New randomness = its own stream: `ctx.rng('my-feature')` (props) or `Random.derive(seed, 'my-feature')` (`params.ts`). Never add draws to the main `rng` in `generateParams` (that changes every day). In-mesh detail may use `hash()`/`noise3()`.
- Every new random feature gets a scene-spec field, forced without changing unforced days (SCENE_SPECS.md "Adding a spec field").
- Shore coords: `shoreToWorld(coast, s, a)`. s < 0 is land, 0 the waterline; `a` runs along the shore. The camera is at a ≈ 0, s = −distanceToWater. `beachLines(coast)` gives the high-tide and storm lines.
- Place by trying spots until enough is in view (`ctx.visible`, `ctx.inFrame` for things that must be seen whole), not one sample round the camera.
- Materials: `vertexColors`; `DoubleSide` for thin parts; `castShadow`/`receiveShadow`; `frustumCulled = false` on instanced meshes. Plants get no direct specular.
- Storm-aware props: `stormy(params)` (`props/context.ts`). Animals in water: `ctx.waterSpot(rng, depth, maxDistance)`.

## 3. Check it (details: SCENE_SPECS.md, TOOLS.md)
- Use scene specs, not hunted dates. Ask `scripts/params.mjs` for frequencies and "is it there at all?" before rendering anything.
- Preview new meshes alone with `scripts/mesh.mjs`; render the beach only for placement and light.
- Prove visibility with `scripts/diff.mjs` (`⚠ invisible` = fix before looking). Read a contact sheet, not single frames.
- Check front-lit first, then backlit. Act on snapshot ⚠ warnings before reading images.
- One render command per step, 16 frames at 1080p. ~3 render rounds per feature (see, fix everything, confirm) on the same dates. If a 4th seems needed, reason from numbers, `--props` and `diff.mjs` instead.
- Stop the dev server when done: `lsof -tiTCP:5174 -sTCP:LISTEN | xargs kill`.

## 4. Tests and finishing
- `test/<feature>.test.ts` covering:
  - the choice table over `allParams()` (real days): only where intended, roughly as often, season respected;
  - feature rules via specs: `scene(spec, date?)` and `scenes(spec, count)` in `test/days.ts` (e.g. `scenes({ lighthouse: true, timeOfDay: 'night', fog: null })`). Add `eclipse: null` when forcing time of day or sky (real eclipse days override);
  - meshes: deterministic, finite positions and normals, base near y = 0, within the triangle budget;
  - `params.ts` changes: determinism and title.
- Run `npm test` (typecheck + Vitest, ~6 s) and `npx tsc --noEmit` before committing.
- Say "done" only for what a render or `diff.mjs` showed; otherwise say "placed, not checked".
- After new animals or changed chances: run `node scripts/animals.mjs` and paste its table into ANIMALS.md (update the rules there too).
- Update docs: changelog.md, ARCHITECTURE.md (how it works, known issues), LESSONS.md, REFERENCES.md, the topic doc (ANIMALS, CLOUDS, COASTS), SCENE_SPECS.md (new fields), and TODO.md status if used.
- Never commit TODO.md. One commit per feature, with a descriptive message.
