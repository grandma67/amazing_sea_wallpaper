# Plan: stony beaches (shingle and cobble)

Adds pebble, shingle and cobble beaches, such as those of Atlantic Canada, Norway, Nice and
Iceland, as a **beach material** that biomes choose, next to sand colour. Research, sources
and current coast probabilities are in COASTS.md.

## Goal and "done"

- A stony beach should read as one at wallpaper size: individual stones near the camera,
  a stony texture to ~80 m, and the right colour and steep ridged profile beyond.
- Views: `shoreline`, `along-beach`, `framed` (stones in the foreground), `overlook`
  (colour and ridges only). Open-sea days are unchanged.
- Sand days are byte-identical to today (`test/sceneSpec.test.ts`, `bench.mjs` pixel diff 0).
- Render cost: within ~10% of today on stony days, unchanged on sand days.

## Materials

| Material | What it is | Stone size |
|---|---|---|
| `sand` | today's beach | – |
| `mixed` | sand beach; gravel/cobble band on the upper beach and storm ridge | 2–15 cm |
| `shingle` | pebbles over the whole beach, coarser at the crest | 1–6 cm |
| `cobble` | cobbles and small boulders, gravel or sand at the waterline | 6–30 cm |

## Chances (beach days) — `BEACH_MATERIALS` table

| Biome / ocean | sand | mixed | shingle | cobble | Stone colours |
|---|---|---|---|---|---|
| nordic | 35 | 25 | 20 | 20 | grey granite, greywacke, some red sandstone (Fundy) |
| nordic, Arctic | 25 | 25 | 20 | 30 | grey, more angular (frost-shattered) |
| mediterranean | 55 | 15 | 25 | 5 | white–cream limestone, grey |
| volcanic | 50 | 15 | 15 | 20 | black basalt, a few red scoria |
| desert | 75 | 15 | 5 | 5 | tan and red gravel |
| tropical | 85 | 10 | – | 5 | pale coral rubble, dark basalt |

Target over 2024–2026: ~62% of beach days sand, ~15% mixed, ~23% shingle or cobble.

## Steps

Each step ends with `npm test`, and one commit per step.

### 1. Choice and spec (no rendering change)

- `src/beach.ts`: `type BeachMaterial`, `BEACH_MATERIALS` (table above) and
  `beachMaterialFor(biome, ocean, rng)`; stone palettes per biome as `RGB[]`.
- `params.ts` `generateCoast`: `coast.material` drawn from
  `Random.derive(seed, 'beach-material')`, always drawn and then forced via
  `or(drawn, spec.beachMaterial)`. Open-sea days get `'sand'` (unused).
- Shape on non-sand days only, from that same stream (sand days don't touch it):
  - `beachSlope` 0.12–0.25 (shingle/cobble), 0.08–0.14 (mixed);
  - `beachWidth` 12–40 m; `sandbarHeight = 0`; `duneHeight` small (grass or rock behind);
  - new `CoastParams.ridges`: 1–3 storm ridges (height 0.3–1.2 m, at the high-tide and
    storm lines from `beachLines`).
- `sceneSpec.ts`: `beachMaterial: oneOf('sand', 'mixed', 'shingle', 'cobble')`.
- Title: `nordic cobble beach` / `mediterranean shingle beach` (sand titles unchanged).
- `src/props/choices.ts`: expose it so `params.mjs --stats 'p => p.coast.material'` works.
- `test/beach.test.ts`: shares over `allParams()` per biome are roughly as in the table, no
  shingle in the tropics, sand days identical to before, forced spec works on any biome.
- Update COASTS.md with the measured shares.

### 2. Terrain shape

- `terrain.ts` (GLSL and TS mirror): add ridges to the beach profile (Gaussian bumps along
  `s`, wobbling with `a`); keep `terrainHeight` and the shader in step (`test/terrain.test.ts`).
- Surf: a steep beach means the waves break on the beach face (surging/plunging, narrow surf
  zone). Check `surfBreakDepth`/`breakerIndex` give that from the slope; if not, add the
  material to `breakerIndex`.
- Run-up: shorter swash (it sinks into gravel) — scale `runup` ~0.6 on shingle/cobble.
- Render check: `--scene '{"beachMaterial":"cobble","composition":"along-beach"}'` with
  stones still drawn as sand; the profile and surf should already look right.

### 3. Stone texture in the terrain shader (15–80 m)

- `stoneMaterial` uniform (0 sand, 1 mixed, 2 shingle, 3 cobble), `stoneSize`, `stoneColors`.
- Voronoi cells over shore coords, cell size = stone size; per cell: albedo from the palette
  (by hash), dome normal, darkened gaps (contact shadow / AO). Cap at one 3×3 cell search.
- Grading: cell size grows toward the ridge crest; for `mixed` blend from sand at the
  waterline to stones on the upper beach and ridges.
- Fade to the mean stone colour by pixel footprint (like the wind ripples); no ripples on stones.
- Wet stones: darker (×0.5) and glossy, highlight per cell (each stone's own curved glint,
  not a flat sheet).
- Also feed the palette mean to `ocean.ts` `sandAlbedo` (shallow seabed colour).
- Test patched GLSL at `--w 320 --h 180 --frames 1` first.

### 4. Stones near the camera (≤ ~15 m)

- `src/props/stones.ts`: `stoneGeometry(rng, size)` — flattened ellipsoid (pebbles: smooth,
  rounded; cobbles: a few flat facets like `rockGeometry`, much lower detail), 150–600 tris,
  base on y = 0. Preview with `scripts/mesh.mjs`.
- `createStones(ctx)`: own stream `ctx.rng('stones')`; ~6 variants in one `InstancedMesh`,
  placed on the visible beach within ~15 m (`ctx.visible`), packed by Poisson-disc with
  partial burial, rotation, scale by grading. Colour per instance from the palette.
  `castShadow`/`receiveShadow`, `frustumCulled = false`. Budget: < 40k instances.
- Register in `props/index.ts`; `--props stones` reports count and nearest distance.
- Mesh tests: deterministic, finite, base near y = 0, triangle budget.

### 5. Other props follow

- `shoreLife.ts`: no sand crabs or sand dollars on shingle/cobble; shells fewer; shore crabs
  under cobbles in nordic are fine. Flowers: sea kale, sea pea, sea campion on shingle
  (nordic and Atlantic shingle flora) instead of dune flowers.
- `debris.ts`: driftwood and wrack on the storm ridge crest.
- `wildlife.ts`/`pinnipeds.ts`: walkers stay above the swash; check they sit on the ridge
  slope correctly.
- Rocks: more boulders on cobble days (`rockChance` up), fewer on shingle.

### 6. Renders and finish

- Specs in `scenes/stony.json`: Canada (nordic, atlantic, cobble, along-beach, golden hour),
  Arctic (nordic, arctic, cobble, overcast), Nice (mediterranean, shingle, shoreline, daylight),
  Iceland (volcanic, cobble, framed), mixed (nordic, mixed, shoreline), overlook (mediterranean
  shingle). Front-lit (`sunAzimuthDeg: 160`) first, then backlit.
- `diff.mjs` with `--off '{"beachMaterial":"sand"}'` to confirm each shows.
- `bench.mjs --ref HEAD~N`: sand days pixel-identical, stony days within ~10%.
- ~3 render rounds. Then: changelog.md, PLAN.md ("How it works": beach material; lessons;
  references from COASTS.md), COASTS.md shares, ANIMALS.md if animal rules changed.

## Open questions

- Are the chances right? Stony ~23% of beach days is close to reality for nordic coasts but
  could feel frequent in the Mediterranean; easy to tune in the table.
- Arctic beaches in winter: stones under snow and ice foot? (Later; out of scope here.)
- Rock-shore and tidal-flat coast types and a `temperate` biome (COASTS.md) are separate
  plans.
