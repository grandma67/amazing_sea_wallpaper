# Plan: coasts, biomes and coastal weather

Brings the wallpaper's coasts closer to the world's: stony beaches, rocky shores,
reef-fronted tropical beaches, tides, beach shapes that follow the waves, more sand colours,
calm lagoons, two missing climates, the real sun for the place and date, coastal weather and
the animals these open up. Research and sources for stony beaches are in COASTS.md; the rest
are at the end. Status 2026-10-23: plan only, nothing built.

## Why: research vs. today

Research summary (sources at the end; details go into COASTS.md in phase 0).

| Topic | Real world | Today | Phase |
|---|---|---|---|
| Coast types | ~40% sand/gravel, 21% mud, 13% rocky, 27% bare rock; ~33% cliffed | `beach` 65% (all sand), `open-sea` 35% | 1, 8, 9 |
| Beach shape | Reflective (steep, no bar), intermediate (cusps, rips), dissipative (flat, 2–3 bars) by grain and swell | Slope 0.035–0.11 and a sandbar 60%, not tied to waves | 4 |
| Tropical beaches | Most island beaches sit behind a fringing reef: waves break on the crest 100–500 m out, 50–75% of the height lost, calm lagoon inside | Surf breaks on the beach | 6, 7 |
| Tides | Micro < 2 m (Mediterranean, Caribbean, Baltic), meso 2–4 m, macro > 4 m (Fundy, Brittany, Patagonia, NW Australia); spring tides at new and full moon | Fixed sea level | 5 |
| Sand colour | Also pink (foraminifera: Bermuda, Bahamas, Komodo) and red (iron: Prince Edward Island, Santorini, Maui) | white, golden, grey, black | 3 |
| Landforms | Barrier islands and lagoons, spits, fjords, rias, beachrock, tidal flats, salt marsh | none of these | 7, 9, 10 |
| Climates | Temperate oceanic (Britain, Atlantic Canada, Pacific NW, NZ), humid subtropical (Florida, S Brazil, Queensland, Natal, S Japan), treeless high Arctic | Five biomes; polar coasts already lose trees, but the Arctic keeps birch | 3, 11 |
| Sun | Polar night in Arctic winter, midnight sun in Arctic summer | Time of day is a category, independent of latitude and date | 12 |
| Weather | Marine-layer stratus mornings (California, Atacama, May–Jul), sea-breeze cumulus over land, harmattan dust (West Africa Dec–Feb), offshore wind spray, winter snow and ice foot, bioluminescent surf | fog, sea smoke, dust, monsoon, storms ✓; the rest missing | 3, 13 |
| Animals | Sea otters, walrus, polar bears, waders on flats, oystercatchers, tidepool life | none of these | 14 |

## What the code does today (constraints found in review)

These shape the order and the shared steps below.

- **Terrain is one cross-section.** `terrainHeightAt` (`terrain.ts`, GLSL and TS mirror) is a
  function of the distance from the waterline `s` (plus noise); `hasCoast` / `coast.type
  !== 'beach'` returns −200 m for open sea. Coast type is checked 21 times in 14 files
  (`composition.ts`, `camera.ts`, `scene.ts`, `terrain.ts`, `params.ts`, props). Shapes that
  vary along the shore in plan view (spit, lagoon behind a barrier, fjord walls) can't be
  written as a cross-section.
- **Water is calm only where it is shallow.** `ocean.ts` `shallowDamping(depth)` is the only
  damping; there is no shelter. A 2 m lagoon keeps about half the swell, and the surf code
  breaks waves on its shore.
- **Sea level is 0 everywhere** (ocean, `SURF_GLSL`, `seaLevel()`, prop placement).
- **Regions exist only in `props/wildlife.ts`** (`regionFor`: warm coasts only, drawn on a
  prop stream). Tides, harmattan and new sand colours need named places on every coast.
- **Time of day is a weighted category** (`params.ts` ~1101), not the sun of a real place
  and date; eclipses already override it after the draw.
- **The sky is decided before the place.** Time of day (~1101), weather kind
  (`generateWeather`), rainbow (~1139) and camera heading (~1149) come before the biome
  (~1305) and ocean (~1309); formations are picked later with the climate. So a region
  rule that changes the time of day or weather must not patch it afterwards (the rainbow,
  fog and framing were already made from the old value): it re-generates the day with the
  value forced (2c).
- **Seasons ignore the hemisphere** (`oceans.ts`: "hemisphere ignored"); only the Southern
  Ocean flips months (`fogSeason`, cloud summer, sea smoke). Chile, SW Australia, Natal,
  Tasmania and South Brazil days get northern seasons today.
- **Wildlife's region is its first draw** (`drawWildlife`: `regionFor` then `pick`,
  `active`, …), so the order of `ctx.rng('wildlife')` draws must be kept.
- **Polar coasts already filter plants** (`params.ts` ~1314): Arctic keeps grass, bush and
  birch; Southern Ocean grass and bush.

## Rules for every phase

- Read PLAN.md "How it works" and "Lessons and gotchas" and the closest module first;
  follow CLAUDE.md (choice/geometry split, own streams, spec fields, tests, renders).
- **Own streams only.** New draws use `Random.derive(seed, '<feature>')` or
  `ctx.rng('<feature>')`, never the main `rng` in `generateParams`.
- **Only the days that get a feature change.** Every other day stays byte-identical
  (`test/sceneSpec.test.ts`, `bench.mjs` pixel diff 0). Each phase's changelog row says
  which existing days change (e.g. "tropical beach days with a reef", "all beach days"
  for phase 4).
- **Spec field for every feature** (`sceneSpec.ts`), always drawn, then forced with
  `or()` / `forced()` / `forcedKind()`. A forced value always wins over gates and tables.
  Add each field to the CLAUDE.md field list.
- **Choice tables** are pure `xxxFor(params, rng)` functions exposed in `props/choices.ts`,
  so `scripts/params.mjs --stats` can count them without rendering.
- **Budget:** render time within ~10% of today per phase (`bench.mjs`); meshes < 100k tris;
  instanced near-camera detail ≤ ~1M tris for stones (1d) and ≤ ~0.5M for everything
  else added here together; detail only near the camera. The terrain shader
  grows in several phases: measure it each time, and branch on coast kind (uniform) so
  only one profile runs per day.
- **"Done"** only for what a render or `diff.mjs` showed. ~3 render rounds per phase.
- **One commit per phase step**, `npm test` and `npx tsc --noEmit` first. Never commit
  TODO.md.

## Phases

Order follows dependencies: shared pieces (regions, tides, calm water, coast-kind terrain)
come before the features that need them.

| # | Phase | Needs |
|---|---|---|
| 0 | Docs: research and gaps | – |
| 1 | Stony beaches | – |
| 2 | Shared foundations: regions, hemisphere, coast-kind terrain, re-generation | – |
| 3 | Cheap table changes | 2 |
| 4 | Beach shape from waves and grain | 1, 2 |
| 5 | Tides | 2 |
| 6 | Calm water (shelter mask) | – |
| 7 | Reef-fronted tropical beaches | 2, 5, 6 |
| 8 | Rocky shore | 1, 2, 5 |
| 9 | Tidal flats and salt marsh | 5, 8 |
| 10 | Landforms: barrier lagoon, spit, fjord | 6, 8 |
| 11 | Climates: temperate, subtropical, polar | 2, 3 |
| 12 | The real sun: polar night, midnight sun | 2 |
| 13 | Weather extras | 2, 11, 12 |
| 14 | Animals | 5, 7, 8, 9, 11 |

Phase 1 adds its ridges to today's beach profile; from phase 2b on, every new profile
(cusps, reef, platform, flat) is a branch of the coast-kind switch.

### 0. Docs: research and gaps (no code)

- COASTS.md: add "Research: the world's coasts" (coast-type shares, beach states, sand
  colours, tides, reef-fronted beaches, landforms, climates) with sources, and a
  "Gaps" table pointing to the phases here. Fix "nordic Arctic has conifers" wherever it
  appears (polar coasts already drop trees; only birch remains in the Arctic).
- CLOUDS.md: a "Coastal weather" note: marine layer, sea breeze, harmattan, offshore winds
  (marked "planned, PLAN_BIOMES phases 3/13").
- ANIMALS.md: a "Planned" list under the rules (sea otter, walrus, polar bear, waders).
- Commit: "Docs: coast and climate research, gaps vs. today".

### 1. Stony beaches (shingle and cobble)

Adds pebble, shingle and cobble beaches, such as those of Atlantic Canada, Norway, Nice and
Iceland, as a **beach material** that biomes choose, next to sand colour. It adds
`coast.material`, steep ridged profiles and the stone shader, which phases 4, 8 and 9 reuse.

**Done when:**

- A stony beach reads as one at wallpaper size: individual stones near the camera, a stony
  texture to ~80 m, and the right colour and steep ridged profile beyond.
- Views: `shoreline`, `along-beach`, `framed` (stones in the foreground), `overlook`
  (colour and ridges only). Open-sea days are unchanged.
- Sand days are byte-identical to today (`test/sceneSpec.test.ts`, `bench.mjs` pixel diff 0).
- Render cost: within ~10% of today on stony days, unchanged on sand days.

**Materials:**

| Material | What it is | Stone size |
|---|---|---|
| `sand` | today's beach | – |
| `mixed` | sand beach; gravel/cobble band on the upper beach and storm ridge | 2–15 cm |
| `shingle` | pebbles over the whole beach, coarser at the crest | 1–6 cm |
| `cobble` | cobbles and small boulders, gravel or sand at the waterline | 6–30 cm |

**Chances on beach days (`BEACH_MATERIALS`):**

| Biome / ocean | sand | mixed | shingle | cobble | Stone colours |
|---|---|---|---|---|---|
| nordic | 35 | 25 | 20 | 20 | grey granite, greywacke, some red sandstone (Fundy) |
| nordic, Arctic | 25 | 25 | 20 | 30 | grey, more angular (frost-shattered) |
| mediterranean | 55 | 15 | 25 | 5 | white–cream limestone, grey |
| volcanic | 50 | 15 | 15 | 20 | black basalt, a few red scoria |
| desert | 75 | 15 | 5 | 5 | tan and red gravel |
| tropical | 85 | 10 | – | 5 | pale coral rubble, dark basalt |

Target over 2024–2026: ~62% of beach days sand, ~15% mixed, ~23% shingle or cobble (close
to reality; decision 1). Phase 11 re-keys the nordic rows by climate (temperate: much
shingle; polar: as "nordic, Arctic").

#### 1a. Choice and spec (no rendering change)

- `src/beach.ts`: `type BeachMaterial`, `BEACH_MATERIALS` (table above) and
  `beachMaterialFor(biome, ocean, rng)`; stone palettes per biome as `RGB[]`.
- `params.ts` `generateCoast`: `coast.material` drawn from
  `Random.derive(seed, 'beach-material')`, always drawn and then forced via
  `or(drawn, spec.beachMaterial)`. Open-sea days get `'sand'` (unused).
- Shape on non-sand days only, from that same stream (sand days don't touch it; phase 4
  later derives all slopes from the beach state, with stony beaches always reflective):
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

#### 1b. Terrain shape

- `terrain.ts` (GLSL and TS mirror): add ridges to the beach profile (Gaussian bumps along
  `s`, wobbling with `a`); keep `terrainHeight` and the shader in step (`test/terrain.test.ts`).
- Surf: a steep beach means the waves break on the beach face (surging/plunging, narrow surf
  zone). Check `surfBreakDepth`/`breakerIndex` give that from the slope; if not, add the
  material to `breakerIndex`.
- Run-up: shorter swash (it sinks into gravel): scale `runup` ~0.6 on shingle/cobble.
- Render check: `--scene '{"beachMaterial":"cobble","composition":"along-beach"}'` with
  stones still drawn as sand; the profile and surf should already look right.

#### 1c. Stone texture in the terrain shader (5–80 m)

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

#### 1d. Stones near the camera (while a stone is ≥ ~10 px)

A stone gets a mesh only while it is big on screen: ≥ ~10 px, where its silhouette,
parallax and cast shadow show. Smaller, the shader (1c) looks the same. At 1080p with a
50 mm lens (36 mm sensor) one pixel is ~0.37 mrad, so the mesh radius is ≈ 170 × stone
size: 3 cm pebbles to ~5 m (16 px at 5 m), 10 cm cobbles to ~15 m (18 px), 20 cm to ~15 m
(capped). Scale the radius with focal length and output height (`ctx` camera).

- `src/props/stones.ts`: `stoneGeometry(rng, size)`: flattened ellipsoid (pebbles: smooth,
  rounded; cobbles: a few flat facets like `rockGeometry`, much lower detail), 50–150 tris,
  base on y = 0. Preview with `scripts/mesh.mjs`.
- `createStones(ctx)`: own stream `ctx.rng('stones')`; ~6 variants in one `InstancedMesh`,
  placed on the visible beach within that radius (`ctx.visible`), packed by Poisson-disc with
  partial burial, rotation, scale by grading. Colour per instance from the palette.
  `castShadow`/`receiveShadow`, `frustumCulled = false`.
- **Budget:** ≤ ~8k instances, ≤ ~1M triangles in all. Estimated counts in a 40° view
  with 60% cover: 3 cm to 5 m ≈ 5.6k; 10 cm to 15 m ≈ 4.7k; 20 cm to 15 m ≈ 1.2k. Under
  ~2 cm: shader only. Hard cap 8k (nearest first). These are estimates: check with
  `bench.mjs`; if over 10%, shrink the radius before the triangle count.
- Register in `props/index.ts`; `--props stones` reports count and nearest distance.
- Mesh tests: deterministic, finite, base near y = 0, triangle budget.

#### 1e. Other props follow

- `shoreLife.ts`: no sand crabs or sand dollars on shingle/cobble; shells fewer; shore crabs
  under cobbles in nordic are fine. Flowers: sea kale, sea pea, sea campion on shingle
  (nordic and Atlantic shingle flora) instead of dune flowers.
- `debris.ts`: driftwood and wrack on the storm ridge crest.
- `wildlife.ts`/`pinnipeds.ts`: walkers stay above the swash; check they sit on the ridge
  slope correctly.
- Rocks: more boulders on cobble days (`rockChance` up), fewer on shingle.

#### 1f. Renders and finish

- Specs in `scenes/stony.json`: Canada (nordic, atlantic, cobble, along-beach, golden hour),
  Arctic (nordic, arctic, cobble, overcast), Nice (mediterranean, shingle, shoreline, daylight),
  Iceland (volcanic, cobble, framed), mixed (nordic, mixed, shoreline), overlook (mediterranean
  shingle). Front-lit (`sunAzimuthDeg: 160`) first, then backlit.
- `diff.mjs` with `--off '{"beachMaterial":"sand"}'` to confirm each shows.
- `bench.mjs --ref HEAD~N`: sand days pixel-identical, stony days within ~10%.
- ~3 render rounds. Then: changelog.md, PLAN.md ("How it works": beach material; lessons;
  references from COASTS.md), COASTS.md shares and mark its stony-beach proposal done,
  ANIMALS.md if animal rules changed.
- Arctic winter stones under snow and an ice foot come in phase 13.

### 2. Shared foundations

Four steps every later phase builds on, one commit each.

#### 2a. Regions and sub-places (no rendering change except latitude)

Named places for every coast, so tables can say "Fundy" or "West Africa" instead of
"biome × ocean".

- `src/regions.ts`: `type Region`, the `REGIONS` table from **REGIONS.md §1** and the
  sub-places from **REGIONS.md §1b**, and `regionFor(biome, ocean, rng)` →
  `{ region, place }` on stream `Random.derive(seed, 'region')`.
- **Each region and sub-place carries:** weight, latitude range, hemisphere, climate.
  A sub-place may override the region's latitude, climate, tidal range and sand chances
  (Fundy: macro tide, red mud; PEI: red sand; Newfoundland: boreal; Norway north: boreal,
  Norway west: temperate). Every later table that needs a finer place reads the sub-place;
  no phase draws its own.
- `SceneParams.region` (`{ region, place, hemisphere, climate }`); spec field `region`
  (a region or `region/place`; forcing it also forces a matching biome and ocean, or throws
  if they're forced to something else).
- `wildlife.ts` reads `params.region` and maps it to its `WildRegion`. **Keep wildlife's
  draw order:** `drawWildlife` still makes its old first draw (`rng.float()`, now
  discarded) so `pick`, `active` and every later draw stay where they were. Today's wildlife
  regions keep their weights; the **new parent regions** (`pacific-islands`,
  `south-asia-islands`, `nw-australia`, `northeast-brazil`, `horn-of-africa`,
  `western-australia-desert`) take days from them and change only those days' animals
  (decision 9). Regenerate ANIMALS.md and list the changed days in the changelog.
- `latitudeDeg` comes from the region's (or sub-place's) range; basin ranges in `oceans.ts`
  become the fallback (decision 10). Check what latitude drives (it anchors the atmosphere)
  with a bench diff on a Norway and a Galápagos day.
- Tests: every biome × ocean has regions, shares roughly as weighted, latitudes in range,
  `animals.mjs` table unchanged for days whose region didn't change.
- Docs: PLAN.md "How it works" (regions), COASTS.md (region table), ANIMALS.md (regions now
  shared).

#### 2b. Coast-kind dispatch (no rendering change)

- `CoastParams.type` gains `'rock-shore'` and `'tidal-flat'` (unused until phases 8–9).
  Replace the 21 `type === 'beach'` / `'open-sea'` checks with helpers in `terrain.ts`:
  `hasLand(coast)`, `hasBeach(coast)`, `hasSurfZone(coast)`, and go through the 14 files
  deciding which each means (composition, camera, props).
- `terrainHeightAt`: a `coastKind` uniform selects the profile (one branch per day, not all
  evaluated); TS mirror switches the same way. Phase 1's ridges live in the beach branch.
- Tests: all existing days byte-identical; helper truth table per coast type.

#### 2c. Re-generation for region rules (no rendering change)

The sky is decided before the place (see constraints). Region rules that change the time
of day or the weather (marine layer in 3, polar night and midnight sun in 12) work like a
scene spec instead of a patch:

- `generateParams` builds the day as today; then `regionRules(params)` returns the forced
  values the region needs (e.g. `{ timeOfDay: 'blue-hour' }`, `{ weather: 'overcast',
  clouds: ['stratus'] }`) or nothing.
- If something is forced, generate again with those values merged into the spec (user spec
  wins). `keep()` already pins the later main-stream draws (biome, lens, wind, horizon), so
  the place stays the same while the rainbow, fog, framing and clouds follow the new sky.
- The rules see the first pass's region, so they must not change the biome or ocean (assert
  the region is the same after the second pass).
- Cost: a second pass only on affected days (params are ~0.5 ms).
- Tests: no rule → one pass, byte-identical; a forced day keeps biome, ocean, region and
  heading; user spec beats the rule.

#### 2d. Hemisphere-aware seasons

- `season(params)` / `monthInSeason(params, fromMonth, toMonth)` helpers from the region's
  hemisphere (Southern Ocean regions included), replacing the ad-hoc `ocean === 'southern'`
  flips.
- Go through every month-keyed table and use the helper: flowers (`shoreLife.ts`
  `FLOWERS`), fog seasons (`fogSeason`), cloud summer (`pickFormations`), sea smoke,
  migratory birds, turtle nesting (already by region; check), ice.
- **Changes existing days:** southern-hemisphere days of mediterranean, desert, tropical
  and volcanic biomes (Chile, SW Australia, Cape, Natal, Atacama, Namibia, Réunion, NZ…)
  get their real seasons. List in the changelog.
- Tests: a July day in SW Australia is winter (no summer flowers), a January one summer;
  northern days unchanged.
- Docs: PLAN.md "How it works" (seasons), lessons.

### 3. Cheap table changes (no new geometry)

Each is a table row or a palette, plus a spec value and a test. Changes only the days that
get them.

| Change | Where | Rule |
|---|---|---|
| Pink sand | `biome.ts` `SAND_STYLES` (`pink`, albedo ≈ [0.68, 0.52, 0.48]) | bermuda-bahamas ~25% of beaches, se-asia ~3% (Komodo), other tropical ~1% |
| Red sand | `SAND_STYLES` (`red`, ≈ [0.42, 0.2, 0.12]) | atlantic-canada sub-places PEI ~60% and Fundy ~40% of beaches (others none), hawaii ~4% (Maui), arabia ~3% (Oman, Red Sea) |
| Sand colour gate | `generateCoast` | The colour is still drawn from `biome.sands` as today; a second draw on `Random.derive(seed, 'sand-colour')` replaces it with pink or red at the region's or sub-place's chance. A forced `sand` wins over both |
| High Arctic tundra | `params.ts` polar filter (~1314) | Already no trees on polar coasts; above ~74° (Svalbard, high Arctic Canada, N Greenland) also drop birch (only dwarf willow and birch, < 30 cm, which read as `grass`/`bush`) |
| Southern Ocean plants | same | tierra-del-fuego region: add southern beech (as `broadleaf`, wind-bent) at the back; South Georgia stays grass (tussock) |
| Marine-layer mornings | a region rule (2c): forces `weather` and `clouds`, re-generating the day | california and atacama regions, May–Jul (Jun–Sep weaker in Atacama: winter-spring camanchaca), golden hour to late morning: overcast with stratus or Sc deck at ~300–600 m on ~45% of those mornings; ~15% in Aug–Oct; never on storm days |
| Harmattan | `seaHaze.ts` (visibility is drawn after the place, so no re-generation) | west-africa region, Dec–Feb: dust visibility 2–10 km, ochre haze, sun dimmed and reddened; ~50% of those days |
| Haar | `params.ts` fog | britain-ireland and norway regions Apr–Jul: check `fogSeason` first; raise the advection chance only if it doesn't already peak then |

- Spec: `sand` accepts `pink` and `red`; marine layer is forced with the existing
  `weather: "overcast"` + `clouds: ["stratus"]`, plus a new `marineLayer: true|null` so
  tests can switch it off; harmattan via a new `dust: "harmattan"|null` if `seaHaze` has
  no force today.
- Tests: `test/biome.test.ts` (new): pink and red only in the listed regions, roughly as
  often; `test/seaHaze.test.ts`: harmattan only west-africa Dec–Feb;
  `test/cloudTypes.test.ts`: marine layer by region, month and time of day; vegetation: no
  birch above 74°, beech only in tierra-del-fuego.
- Renders: PEI red beach (`region: "atlantic-canada"`, `sand: "red"`, golden hour),
  Bermuda pink (daylight, front-lit), Svalbard tundra (along-beach), California June
  morning (`"date": "2025-06-14"`, golden hour), Loango harmattan (`2025-01-10`).
- Docs: COASTS.md sand table, CLOUDS.md marine layer row, PLAN.md "How it works" (sand
  colour gate, tundra), changelog (days that change: marine-layer mornings, harmattan
  days, pink/red days, high-Arctic plants).

### 4. Beach shape from waves and grain (Wright & Short)

Changes every beach day on purpose (decision 5): slope and bars become physical instead of
random.

- `src/beachState.ts`: `beachStateFor(material, grainMm, breakerHeight, swellPeriod)` →
  `'reflective' | 'low-tide-terrace' | 'transverse-bar-rip' | 'rhythmic-bar' |
  'longshore-bar' | 'dissipative'` from the dimensionless fall velocity
  Ω = Hb / (ws · T) (reflective < 1.5, dissipative > 5.5). `ws` from Soulsby (1997), with
  densities and the carbonate shape factor from **REGIONS.md §2**. Pure: no rng; the grain
  is drawn on the beach-material stream.
- Grain table (`GRAIN`) and face slope by grain: REGIONS.md §2 (coral/shell 0.3–1 mm,
  white quartz 0.15–0.3 mm, golden 0.2–0.5 mm, grey 0.2–0.6 mm, black basalt 0.3–2 mm, pink
  0.5–1 mm, red 0.15–0.3 mm); shingle and cobble always reflective. Its worked Ω examples
  are test cases. Check the ≈ slope values against Bascom (1951) before encoding.
- `Hb` from the **offshore** swell (height H₀, period T), not from `surfWave` (which uses
  the slope, so it would be circular): Komar–Gaynord Hb ≈ 0.39 g^0.2 (T H₀²)^0.4. Storm
  days and winter months (hemisphere-aware, 2d) push one state toward dissipative (winter
  profile); each date is generated on its own, so "after a storm" is not available.
- `generateCoast`: slope, bar count (0–3), bar distances and heights from the state.
- `terrain.ts` (GLSL + TS mirror, `test/terrain.test.ts`):
  - **beach cusps** on reflective and intermediate beaches: horns and bays along `a`,
    spacing ~1.5 × swash length (15–40 m), 0.1–0.4 m relief, a sine of `a` with wobble on
    the upper swash zone;
  - **rip channels** on transverse-bar-rip and rhythmic states: the bar term gets an
    `a`-dependent gap every 150–400 m. The surf already breaks by local depth, so gaps
    show as fewer breakers; `ocean.ts` adds darker, rougher water over the channel.
- Spec: `beachState`.
- Tests: Ω thresholds, every material/biome gets plausible states, cusps only on steep
  states, terrain TS/GLSL mirror.
- Renders: along-beach on a cusped reflective beach (Mediterranean) and a dissipative
  multi-bar beach (namibia, big swell); `bench.mjs` (expect pixel change, ≤ 10% time).
- Docs: PLAN.md "How it works" (beach state), lessons; changelog: "all beach days change
  slope and bars".

### 5. Tides

- `src/tides.ts`: `tideFor(params, rng)` → `{ range, level, phase }`. Range by region
  (`TIDAL_RANGE`) from **REGIONS.md §3**: Caribbean 0.1–0.2 m, Mediterranean ~0.4 m,
  Hawaii ~0.6 m; Wadden 1.5–4 m; Brittany, Fundy, Bristol Channel, Ungava, Cook Inlet,
  Incheon, NW Australia 8–12 m mean (up to 16 m). Mixed regions take the range from their
  sub-place (2a: Fundy within Atlantic Canada, Bristol Channel within Britain).
  × 1.2 at spring tides (moon phase within ~2 days of new/full) and × 0.8 at neaps.
- Level: a random phase of the semidiurnal cycle on stream `'tide'` (real high-water
  times depend on each port's lunitidal interval; a random phase is realistic for an
  unnamed beach). Spec `tide: "low"|"mid"|"high"` sets the phase.
- **Lower the land, not the sea.** Sea level 0 stays everywhere (ocean, surf, `seaLevel()`).
  The terrain profile and everything placed on it (rocks, debris, plants, animals,
  lighthouse mound) shift by −`level`; `beachLines` and the wrack stay attached to the
  land. One offset uniform in `terrain.ts` plus the TS mirror; props already sample the
  terrain. Distant islands and landforms don't move (sub-pixel).
- Low-tide look (meso and macro only): wider wet band (wetness by height above the last
  high water); exposed rocks get a dark weed/mussel band (vertex colour below the
  high-water line in `rocks.ts`); tidepools as flat mirror patches between rocks.
- Spec: `tide`, `tidalRange`.
- Tests: ranges per region, spring/neap from moon phase, level in range, terrain and props
  move together, micro-tidal days byte-identical within 1 cm (or exactly, if level is 0).
- Renders: Brittany low and high tide (along-beach), Mediterranean (no visible change);
  `diff.mjs` between low and high.
- Docs: PLAN.md "How it works" (tides, land offset), lessons, CLAUDE.md spec fields,
  changelog (days that change: all meso- and macro-tidal beach days).

### 6. Calm water (shelter mask)

Needed by reef lagoons (7), barrier lagoons, spits and fjords (10), and later sheltered
mangroves.

- `ocean.ts`: a `shelter(p)` term in 0..1 multiplying the swell cascades (not the short
  wind chop), next to `shallowDamping`. Sources, as uniforms: a reef or barrier line in
  shore coords (`s` beyond which the sea is open), and up to a few polygons/ellipses for
  lagoons and fjord interiors. Wind chop scales with fetch inside (lagoon width).
- `SURF_GLSL` and the TS mirror (`surfWave`): offshore height × (1 − shelter), so no sets
  break on a lagoon shore; foam and refracted surf follow.
- Waves that pass a reef or bar re-form at 10–30% of the offshore height (the sandbar code
  already re-forms waves; reuse it).
- `seaLevel()` (CPU) applies the same mask so floating props sit still in a lagoon.
- Tests: mask 0 everywhere when unused (byte-identical days), lagoon surf height ≤ 0.3 ×
  offshore, CPU/GPU agree.
- Render check with a forced test lagoon at 640×360 before phase 7 uses it.
- Docs: PLAN.md "How it works" (shelter), lessons.

### 7. Reef-fronted tropical beaches

- Choice: `reefFor(params, rng)` on stream `'reef'`: fringing reef on ~60% of tropical
  beach days (island regions — pacific-islands, south-asia-islands, se-asia — more than
  continental central-america, west-africa, east-africa, northeast-brazil), ~20% of
  hawaii and arabia (Red Sea);
  none elsewhere. Reef distance 100–500 m, lagoon depth 1–3 m, passes (gaps) every
  0.5–2 km.
- `terrain.ts`: seabed profile with a shallow lagoon, a reef flat and crest at ~0.3 m below
  mean sea, then a steep drop-off. Surf breaks on the reef face from the existing
  `surfBreakDepth`; the shelter mask (6) calms the lagoon.
- `ocean.ts`: lagoon colour (turquoise over sand, brown-green patches over coral heads by
  noise), crest foam line, darker blue past the drop-off; caustics already exist.
- At low tide (5) the reef flat dries: wet brown-grey coral with puddles.
- Beachrock: flat, slightly tilted grey ledges along the waterline on ~30% of reef
  beaches (`rocks.ts` style, very low poly, instanced).
- A reef counts as sheltered for `mangroveFor`.
- Spec: `reef` (null/true), `beachrock`.
- Tests: reef only on the listed coasts and shares, profile continuity, surf height inside
  the lagoon.
- Renders: Maldives-like (shoreline, midday), Tahiti (overlook), Hawaii (along-beach), each
  front-lit then backlit; `diff.mjs --off '{"reef":null}'`.
- Docs: COASTS.md (reef share), PLAN.md "How it works" (reef profile), changelog (days that
  change: tropical beach days with a reef).

### 8. Rocky shore

Uses the coast-kind switch from 2b.

- `generateCoast`: draw kind on a new stream `'coast-kind'`: of today's beach days, ~38%
  become `rock-shore` (≈ 25% of all days; decision 1: the world's coasts are ~40% rock
  without sediment and ~33% cliffed, against ~40% sand and gravel). Weighted by region:
  Norway, Greenland, Arctic Canada, BC, Alaska, Patagonian fjords, Atlantic Canada,
  Britain, Brittany, Iceland, California, Chile most (≈ 50–60% of their coast days);
  Mediterranean ~40%; tropical, desert and barrier-island coasts (Florida, Wadden) least
  (≈ 10–20%). Measure the result with `params.mjs` and record it in COASTS.md. Open-sea
  days and the remaining beach days are unchanged.
- Kinds of rocky shore: low wave-cut platform (most), boulder shore, cliff top (the
  `overlook` composition). Cliff-top views make up roughly a third, since much rocky coast
  can only be seen from above.
- Terrain: wave-cut platform (flat, slightly seaward-dipping shelf, ragged edge as noise
  in `a`), a low cliff or boulder slope behind, no sand. Reuse `rocks.ts` boulders on the
  platform and the phase-1 cobble shader in gaps.
- Water: waves break on the platform edge (rock data for `ocean.ts` foam, `waveOnRock`),
  spray bursts on the outer ledge, wash across the platform; tidepools at low tide (5).
- Compositions: `shoreline` and `framed` from the platform; `overlook` from the cliff top.
- **Props on a rocky shore** (each creator checks `hasBeach` / `coast.type`):

  | Prop | On a rocky shore |
  |---|---|
  | Rocks, boulders, sea stacks | yes, more (the shore itself) |
  | Gulls, colonies, migratory flocks, marine life, ships, islands, landforms, lighthouse | yes, unchanged (lighthouse on the platform or cliff instead of a mound) |
  | Seals and sea lions | yes: rock haul-outs on the platform edge (rock shares up, beach haul-outs off) |
  | Marine iguanas (Galápagos), shore crabs, starfish | yes, on the platform and in pools |
  | Driftwood, wrack | yes, jammed in the back of the platform and gullies; no piles |
  | Vegetation | yes, behind the cliff or boulder slope; no dune grass |
  | Turtles and hatchlings, ghost and hermit crabs, shells, sand flowers | no (need sand) |
  | Crocodiles, hippos, monkeys, green iguanas, monitors, spiny-tailed lizards | no (beach animals; move to beach days only) |
  | Mangroves | no |
  | Stones (phase 1) | only in gaps and gullies (shader), no beach |

  So these beach animals appear less often over all days (about −38% of their beach
  days); regenerate ANIMALS.md.
- Spec: `coast: "rock-shore"`.
- Tests: share and region table, terrain has no sand band, camera stands on rock.
- Renders: Peggy's Cove (atlantic-canada, granite, golden hour), Big Sur (california,
  overlook), Iceland basalt (storm swell).
- Docs: COASTS.md coast table, PLAN.md, changelog (days that change: beach days that
  become rocky shores), CLAUDE.md views list.

### 9. Tidal flats and salt marsh

- Coast kind `tidal-flat`, ~3% of days (from beach days on the `'coast-kind'` stream),
  only in macro- and mesotidal sub-places with flats (2a): `wadden-north-sea`, Fundy
  (atlantic-canada), Morecambe Bay (britain-ireland), Mont-Saint-Michel
  (brittany-normandy), Yellow Sea (east-asia-subtropical); only when the tide (5) is below
  mid —
  at high tide the same day is a beach with a marsh behind.
- Terrain: a km-wide, near-flat profile (slope ~1:1000) with shallow meandering channels
  (noise in `a`), sand ripples (reuse the wind-ripple normal, smaller), the sea a far line;
  wet-flat reflections come from the existing wet-sand shading.
- Salt-marsh band at the back: low green-brown grass tufts, instanced like vegetation.
- Spec: `coast: "tidal-flat"`.
- Renders: Wadden Sea at low tide (golden hour), Fundy red mud.
- Docs: COASTS.md, PLAN.md, changelog.

### 10. Landforms: barrier lagoon, spit, fjord

These vary in plan view, so they are **separate heightfield meshes** (like `islands.ts`),
laid over or beside the cross-section terrain, with lagoons calmed by the shelter mask (6).

- **Barrier and lagoon:** along-beach and overlook beach days in subtropical (11),
  Mediterranean and desert regions (~10%): the camera's beach becomes a narrow barrier
  (terrain profile drops below sea level behind the dunes), a calm lagoon behind it
  (shelter polygon), the mainland shore beyond as a low heightfield. The lagoon lies on the
  land side (`s < 0`), where the surf, swash, wet-sand and run-up code assume dry beach:
  give them a `lagoonFrom` distance (no surf, own small waterline and wet band past it),
  in GLSL and the TS mirror.
- **Spit:** along-beach views on ~8% of sandy temperate and nordic beaches: a curving
  sandy hook heightfield running out from the far beach, with a calm lagoon behind its tip.
- **Fjord:** views from a beach **near the fjord mouth** looking out (open-sea horizon
  between the walls; swell damped inside by the shelter mask): steep walls on both sides
  as heightfields to 5–15 km, colour and relief only beyond ~2 km; snow on tops in winter.
  On ~30% of norway, bc, alaska, chile, greenland region days with a `range` landform.
- Spec: `landform: "fjord"`, `lagoon`, `spit`.
- Tests: where each appears, heightfields finite, triangle budget, shelter mask matches
  the lagoon outline.
- Renders: Outer Banks lagoon (subtropical, overlook), Farewell Spit (temperate),
  Norwegian fjord mouth.
- Docs: COASTS.md landforms, PLAN.md, changelog.

### 11. Climates: temperate, subtropical, polar

Adding biomes to `BIOMES` reshuffles every day's biome. Instead, each day's **climate**
is its region's (or sub-place's) climate from 2a: no separate draw, and the main stream is
untouched. Expected split (from the REGIONS.md weights; measure with `params.mjs`):

| Biome | Climates | Regions |
|---|---|---|
| nordic | `boreal` (today's) ≈ 35%, `temperate` ≈ 35%, `polar` ≈ 30% | REGIONS.md §1 "Climate" column (norway north, baltic, alaska boreal; norway west, britain-ireland, atlantic-canada, british-columbia, patagonia-fjords temperate; Arctic regions and south-georgia polar) |
| mediterranean | `mediterranean` ≈ 70%, `subtropical` ≈ 30% | mediterranean-sea, california, central-chile, sw-australia, cape; subtropical: florida-carolinas, south-brazil, east-australia, east-asia-subtropical, natal |
| tropical, volcanic, desert | unchanged | – |

Titles use the climate ("temperate shingle beach", "subtropical beach"; decision 2).

Sub-steps, one commit each:

- **11a. Climate in titles** (no rendering change): `params.region.climate` is already
  set by 2a; spec `climate` forces a region with that climate (within the biome); titles
  use it. Latitude stays the region's (decision 10). Tests: shares as expected, boreal and
  mediterranean days keep today's look.
- **11b. Land:** sands, beach materials (temperate: shingle up), rock colours, plants:
  temperate = mixed broadleaf and conifer, marram dunes, machair on shell-sand Atlantic
  coasts; subtropical = live oak, saw palmetto (as `bush`), sea oats on dunes, pale quartz
  beaches; polar = the tundra filter from phase 3.
- **11c. Sea and sky:** oceans and swell per climate, fog (temperate haar, subtropical
  less), cloud leanings (temperate Sc ×2 like cool; subtropical congestus ×2 and summer
  storms).
- **11d. Props:** debris (temperate kelp; subtropical sargassum on the Atlantic, seagrass),
  shore life (subtropical ghost crabs), islands and landforms (barrier lagoons in
  subtropical, phase 10).
- **11e. Animals:** regions per climate in `wildlife.ts`, pinnipeds, migratory birds;
  regenerate ANIMALS.md.
- Renders: one per new climate in each composition once.
- Docs: COASTS.md biome table (biome × climate shares), CLOUDS.md climate leanings,
  ANIMALS.md, PLAN.md, CLAUDE.md spec fields, changelog (days that change: split days).

### 12. The real sun: polar night and midnight sun

- `src/celestial.ts`: `sunLimits(latitudeDeg, date)` → the day's highest and lowest solar
  elevation (declination from the date).
- A region rule (2c): latitude and hemisphere are known only after the first pass, so if
  the drawn `timeOfDay` is impossible for that place and date, the rule forces the
  nearest possible one and the day is re-generated (sun, weather, rainbow, fog and framing
  then follow it):
  - **polar night** (max elevation < 0°): daylight/midday/golden hour → blue hour (civil
    twilight glow at noon, max ≥ −6°) or night (max < −6°);
  - **midnight sun** (min elevation > 0°): night/blue hour → sun-on-horizon or golden hour,
    sun low in the north (south in the Southern Ocean);
  - the sun's elevation and azimuth stay within the day's real range; `headingDeg` is a
    compass bearing (moon framing already uses azimuths), so "north" is real.
  - `sunLimits` takes the signed latitude (hemisphere from 2a).
- Only polar and high-latitude days change (latitude ≥ ~63° in Dec/Jun months); test that
  every other day is byte-identical.
- Spec: an explicit `timeOfDay` still wins (like eclipses), so specs can show impossible
  combinations for debugging; `sunElevationDeg` likewise.
- Tests: Svalbard (78°) in December only night/blue hour; in June never night; the
  equator unchanged.
- Renders: Svalbard noon in December (blue-hour glow), midnight sun in June.
- Docs: PLAN.md "How it works" (sun limits), CLAUDE.md, changelog (days that change:
  Arctic and Southern Ocean days in polar night or midnight sun).

### 13. Weather extras

| Feature | Rule | Build |
|---|---|---|
| Sea-breeze cumulus | Warm sunny afternoons (`few`/`scattered`, sun up after ~11:00, Mediterranean, subtropical, tropical): Cu over land, clear over the sea | `cloudArrangement.ts`: mask the weather map by a land/sea line ~1–5 km inland, along `seawardAzimuthDeg`; patch every pass that reads the weather map (clouds, shadow, env cube), as `stormCells.ts` does |
| Offshore wind | Mistral (mediterranean-sea), bora (Adriatic), Santa Ana (california, Oct–Mar), harmattan (west-africa): wind from land | wind heading vs. `seawardAzimuthDeg`; offshore: visibility up, smooth wave faces, spray blown back off the crests (`props/surf.ts`) |
| Snow and ice foot | Polar and nordic winter by latitude and month (and boreal late winter) | terrain colour above the high-tide line by a snow mask (noise, less on steep slopes); snow-capped rocks (vertex colour by normal.y) and plants (white tint on conifers); ice foot as a low extruded strip at the high-water line; frozen spray on rocks |
| Bioluminescent surf | Dense dinoflagellate blooms, months per region from **REGIONS.md §4**: california Mar–Sep, south-asia-islands (Maldives Jun–Oct; Lakshadweep/Andaman Oct–Mar), east-asia-subtropical (Hong Kong, Matsu) Apr–Jun, tasmania Dec–Feb, caribbean (Holbox) Jun–Sep | `ocean.ts`: blue emission on breaking crests and swash (foam mask × bloom), in scene units scaled like the moon (bright against night exposure, invisible by day) |
| Glowing lagoon | Puerto Rico bays (year-round), Florida Indian River (May–Oct), Jamaica (Dec–Apr): calm water, not surf | glow where the calm lagoon (phase 6/10) is stirred: a few swirls and boat-wake trails; only with a lagoon in view |

Bioluminescence is **eligible** on nights (night or late blue hour) in those regions and
months, with moon illumination < 30% and no storm; it shows on ~15% of eligible nights
(blooms are episodic; a few days a year per place, decision 4). Toyama's glowing firefly
squid (Mar–Jun) are not plankton; left out.

- Spec: `seaBreeze`, `offshoreWind`, `snow`, `bioluminescence`.
- Specs, tests, renders and docs as above (CLOUDS.md for sea breeze, PLAN.md lessons,
  changelog with the days that change).

### 14. Animals

| Animal | Where | Notes |
|---|---|---|
| Sea otters (rafts in kelp) | california, alaska, bc | float on their backs in a kelp-bed canopy: also add floating kelp mats (`debris.ts` wrack builder at sea level) on those coasts |
| Walrus haul-out | svalbard, greenland, arctic-canada, alaska (north) | beach or ice floe, 5–40 animals; `pinnipeds.ts` |
| Polar bear | arctic regions, near ice | rare (~2% of eligible days), on the beach or a floe |
| Waders (oystercatchers, knots, sanderlings) | tidal flats and low-tide beaches, temperate/nordic; sanderlings on most sandy swashes | flocks running on the swash; ≥ 0.25 m above the swash line (CLAUDE.md lesson) |
| Herons (grey, reef) | rocky shores, reef lagoons | standing in shallow water |
| Tidepool life | rock-shore at low tide | urchins, anemones, mussels as vertex detail within ~10 m (real size: specks beyond) |
| Blacktip sharks | reef lagoons, by day | dorsal fins in the shallows near the camera |

- `xxxFor` choice per animal, `props/choices.ts`, `test/<animal>.test.ts`, meshes checked
  with `scripts/mesh.mjs` first.
- After each: `node scripts/animals.mjs`, paste into ANIMALS.md and update its rules.

## Docs to update (checklist per phase)

| Doc | What |
|---|---|
| changelog.md | a version row per phase, naming which existing days change |
| PLAN.md | "How it works" (new modules and rules), "Lessons and gotchas", "References" (sources below), "Decisions" (climate from the region instead of new biomes; lower the land for tides; shelter mask; region rules re-generate the day; hemisphere-aware seasons) |
| REGIONS.md | replace ≈ values with checked ones as each phase uses them; region weights re-measured |
| COASTS.md | coast-type, material, region, tide, reef, landform, biome and climate shares, re-measured with `params.mjs --stats … 2024-01-01..2026-12-31`; mark the "Proposal" sections done |
| CLOUDS.md | marine layer, sea breeze, climate leanings |
| ANIMALS.md | new animals' rules, shared regions, and the regenerated table |
| CLAUDE.md | new spec fields; fixed dates for new looks (PEI red beach, Wadden low tide, Maldives reef, California June gloom, Svalbard polar night and midnight sun); new views (`rock-shore`, `tidal-flat`) |
| scenes/ | `scenes/coasts.json` with one spec per new coast, climate and weather, for future regression renders |
| README.md | feature list, if it lists coasts or biomes |

## Decisions (2026-10-23)

1. **Shares follow reality:** `rock-shore` ~25% of days (beaches drop to ~37%, open sea
   stays 35%, tidal flats ~3%) and reefs on ~60% of tropical beach days; tune toward
   measured world shares, not toward more beaches.
2. **Climate split** (phase 11) is fine: some days now titled "nordic" become "temperate"
   (or "polar"), "mediterranean" ones "subtropical".
3. **Polar night is real:** Arctic winter days get no sun (night, blue hour or civil
   twilight only, by latitude and date; phase 12). Arctic summer gets the midnight sun
   (no night; confirmed 2026-10-23).
4. **Rare showpieces stay rare:** bioluminescence, pink and red sand at their real
   frequencies.
5. **Beach shape applies to all days:** phase 4 changes slope and bars on every beach day,
   past ones included (noted in the changelog).
6. **Tides lower the land** instead of raising the sea (sea level 0 stays everywhere).
7. **Calm water is a shelter mask** in the ocean and surf shaders, shared by reefs,
   lagoons, spits and fjords.
8. **Regions are shared** (`params.region`, table in REGIONS.md) and drive tides, sand
   colours, weather, climate, latitude and animals.
9. **New parent regions change animals** (Pacific islands, Maldives, NW Australia,
   NE Brazil, Horn of Africa, West Australian desert): those warm days lose wrong animals
   (no macaques on Tahiti); confirmed 2026-10-23.
10. **Regions set the latitude**, basin ranges are the fallback (Norway to 71°,
    Galápagos 0°, Tasmania, Patagonia); confirmed 2026-10-23.
11. **Sub-places live in the region** (2a) and carry their own latitude, climate, tide and
    sand chances; no phase draws its own sub-place.
12. **Region rules re-generate the day** (2c) with forced values, like a scene spec,
    instead of patching the sky after the place is known.
13. **Seasons follow the hemisphere** (2d); southern-hemisphere days change (realistic,
    in line with decisions 1–4).
14. **Climate is the region's** (phase 11), not a separate draw.

## Sources

[Global coastal dataset (ESSD preprint 2025)](https://essd.copernicus.org/preprints/essd-2025-388/),
[Global distribution of coastal cliffs](https://openpolar.no/Record/crwiley:10.1002%2Fesp.4574),
[Beach states, Ω classes (Springer 2025)](https://link.springer.com/article/10.1007/s00367-025-00802-y),
[Short & Hesp 1982](https://data-ww3.ifremer.fr/BIB/Short_Hesp_MG1982.pdf),
[Beach cusps, Trafalgar](https://scimar.icm.csic.es/index.php/secId/6/IdArt/3912/index.php),
[Flash rips between cusps](https://www.scienceofthesurf.com/rip-of-the-month-2018/june-2018-rotm114-laguna-beach-california),
[Sand colours (Hawaii Guide)](https://www.hawaii-guide.com/blog/hawaii-colored-sand-beaches-black-green-red-white-explained),
[EarthDate: Beach reading](https://www.earthdate.org/episodes/beach-reading),
[Tidal environments (TU Delft)](https://coastal.citg.tudelft.nl/book/3a_tidal_environments.html),
[Tides and coasts (SERC)](https://cdn.serc.carleton.edu/files/NAGTWorkshops/geomorph/activities/GlS210_TidesAndCoasts.pdf),
[Coastal landforms](https://www.savemyexams.com/igcse/geography/edexcel/19/revision-notes/2-coastal-environments/2-1-coastal-processes-and-landforms/2-1-2-coastal-landforms/),
[Fringing reef wave attenuation](https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2021.684732/epub),
[Coral reef zones](https://www.remnote.com/learn/science/marine-biology/coral-reef-reef-types-and-physical-zones-study-deck),
[Namib fog and Benguela upwelling (ACP 2026)](https://acp.copernicus.org/articles/26/12565/2026/),
[June Gloom](https://en.wikipedia.org/wiki/June_Gloom),
[Bioluminescent waves (UCSD)](https://today.ucsd.edu/story/new-study-uses-simulations-to-reveal-bioluminescent-light-intensity-in-breaking-waves),
[Bioluminescent beaches (MBL)](https://new-www.mbl.edu/news/americas-5-best-bioluminescent-beaches-islands),
[Machair (EUNIS)](https://eunis.eea.europa.eu/habitats/8044),
[Irish coastal habitats](https://www.noticenature.ie/wp-content/uploads/2016/06/coastal-habitats.pdf).
