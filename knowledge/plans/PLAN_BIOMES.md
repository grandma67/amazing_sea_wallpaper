# Plan: coasts, biomes and coastal weather

Brings the wallpaper's coasts closer to the world's: real places, stony beaches, rocky
shores, reef-fronted tropical beaches, tides, beach shapes that follow the waves, more sand
colours, calm lagoons, two missing climates, the real sun for the place and date, and (later)
coastal weather and the animals these open up. Research is in COASTS.md and REGIONS.md;
sources at the end. Status 2026-10-23: phase 0 (docs) and 1a (places) done; the rest planned.

## Why: research vs. today

Research summary (sources at the end; details go into COASTS.md in phase 0).

| Topic | Real world | Today | Phase |
|---|---|---|---|
| Places | Coasts are real places with their own latitude, climate, tide, sand and animals | biome × ocean drawn separately; latitude from the ocean basin; named places only for warm-coast animals | 1 |
| Coast types | ~40% sand/gravel, 21% mud, 13% rocky, 27% bare rock; ~33% cliffed | `beach` 65% (all sand), `open-sea` 35% | 2, 8, 9 |
| Beach shape | Reflective (steep, no bar), intermediate (cusps, rips), dissipative (flat, 2–3 bars) by grain and swell | Slope 0.035–0.11 and a sandbar 60%, not tied to waves | 4 |
| Tropical beaches | Most island beaches sit behind a fringing reef: waves break on the crest 100–500 m out, 50–75% of the height lost, calm lagoon inside | Surf breaks on the beach | 6, 7 |
| Tides | Micro < 2 m (Mediterranean, Caribbean, Baltic), meso 2–4 m, macro > 4 m (Fundy, Brittany, Patagonia, NW Australia); spring tides at new and full moon | Fixed sea level | 5 |
| Sand colour | Also pink (foraminifera: Bermuda, Bahamas, Komodo) and red (iron: Prince Edward Island, Santorini, Maui) | white, golden, grey, black | 3 |
| Landforms | Barrier islands and lagoons, spits, fjords, rias, beachrock, tidal flats, salt marsh | none of these | 7, 9, later 10 |
| Climates | Temperate oceanic (Britain, Atlantic Canada, Pacific NW, NZ), humid subtropical (Florida, S Brazil, Queensland, Natal, S Japan), treeless high Arctic | Five biomes; polar coasts already lose trees, but the Arctic keeps birch | 3, 11 |
| Seasons | Southern-hemisphere coasts have summer in December | Only the Southern Ocean flips months | 1 |
| Sun | Polar night in Arctic winter, midnight sun in Arctic summer | Time of day is a category, independent of latitude and date | 12 |
| Weather | Marine-layer stratus mornings (California, Atacama, May–Jul), harmattan dust (West Africa Dec–Feb); later: sea-breeze cumulus, offshore wind spray, winter snow and ice foot, bioluminescent surf | fog, sea smoke, dust, monsoon, storms ✓; the rest missing | 3, later 13 |
| Animals | Sea otters, walrus, polar bears, waders on flats, oystercatchers, tidepool life | none of these | later 14 |

## What the code does today (constraints found in review)

These shape the order and the shared steps below.

- **Terrain is one cross-section.** `terrainHeightAt` (`terrain.ts`, GLSL and TS mirror) is a
  function of the distance from the waterline `s` (plus noise); `hasCoast` / `coast.type
  !== 'beach'` returns −200 m for open sea. Coast type is checked ~26 times in ~15 files
  (`composition.ts`, `camera.ts`, `scene.ts`, `terrain.ts`, `params.ts`, props; recount
  with grep when 1b starts). Shapes that vary along the shore in plan view (spit, lagoon
  behind a barrier, fjord walls) can't be written as a cross-section.
- **Water is calm only where it is shallow.** `ocean.ts` `shallowDamping(depth)` is the only
  damping; there is no shelter. A 2 m lagoon keeps about half the swell, and the surf code
  breaks waves on its shore.
- **Sea level is 0 everywhere** (ocean, `SURF_GLSL`, `seaLevel()`, prop placement).
- **The sky is drawn before the place.** In `buildParams` (`params.ts`): time of day
  (~1101), weather (`generateWeather`, ~1119), rainbow, heading (~1149) and sun azimuth
  (~1154) come first; then the biome (`keep('biome', rng.weighted(BIOMES))`, ~1305; today
  tropical 29%, mediterranean 29%, nordic 19%, volcanic 14%, desert 10%), the ocean
  (`pickOcean` on stream `'ocean'`, ~1309) and latitude from the basin (~1469). So today
  the sky can't depend on the place. Phase 1a moves the place to the front.
- **`keep()` pins** main-stream draws that come after the sky's variable number of draws,
  so forcing the time of day in a spec doesn't reshuffle the later draws
  (`generateParams` ~1046 runs an unforced pass for the pins, then the forced pass).
- **Named places exist only in `props/wildlife.ts`** (`regionFor`: warm coasts only, drawn
  on a prop stream). Tides, harmattan and new sand colours need named places on every coast.
- **Time of day is a weighted category** (~1101), not the sun of a real place and date;
  eclipses already override it after the draw.
- **The sun's azimuth is relative to the camera,** not a compass bearing: `relSunAz` is
  drawn for framing and added to the random `headingDeg`. No day has the sun at its real
  compass bearing (an evening sun can be in the east).
- **Latitude drives more than the atmosphere:** `scene.ts` (atmosphere anchor),
  `noctilucent.ts`, `seaHaze.ts` (summer by sign), `skyEvents.ts` (tropical ≥ 10°) and
  `wildlife.ts` (Galápagos vs. Hawaii by |lat| < 25°).
- **Seasons ignore the hemisphere** (`oceans.ts`: "hemisphere ignored"); only the Southern
  Ocean flips months (`fogSeason`, cloud summer, sea smoke). Chile, SW Australia, Natal,
  Tasmania and South Brazil days get northern seasons today.
- **Polar coasts already filter plants** (`params.ts` ~1314): Arctic keeps grass, bush and
  birch; Southern Ocean grass and bush.

## Rules for every phase

CLAUDE.md applies (choice/geometry split, own streams, spec fields with `or()` / `forced()` /
`forcedKind()`, choice tables in `props/choices.ts`, tests, ~3 render rounds, "done" only for what
a render or `diff.mjs` showed, `npm test` + `npx tsc --noEmit`, one commit per phase step). In
addition:

- **Old dates may change on purpose, never by accident (decided 2026-10-23).** A date
  doesn't have to keep its old picture: a phase may change the days it is about, even
  all of them (phase 4 changes every beach's slope and bars), if that makes the scene more
  realistic or the code simpler. Don't add dummy draws or byte-identical tests just to
  keep old pictures. What stays, and why:
  - **CLAUDE.md's stream rule stands:** each feature draws on its own stream
    (`Random.derive(seed, 'xxx')`), never the main `rng`, so adding a feature doesn't
    cascade into unrelated draws (lens, wind, place) on every day. Cascades make
    `bench.mjs`/`diff.mjs` comparisons meaningless and silently break fixed dates, test
    dates and the share tables. **The one exception is 1a:** the place becomes the first
    main-stream draw and reshuffles every date once, deliberately.
  - **SCENE_SPECS.md's "make the draw, then force" stands:** forcing one field must leave
    the rest of the day as the unforced day, or `diff.mjs --off` (phases 2, 7) compares
    two different scenes.
  - **Pure refactors** (1b) are checked by comparing params and images before and after
    (`bench.mjs` pixel diff ≤ 1/255; GLSL reordering can change the last bit).
  - Each phase's changelog row says what changed on which days ("all beach days change
    slope and bars"), so a different picture for a date can be traced.
- A forced spec value always wins over gates and tables. Add each new field to SCENE_SPECS.md.
- **Place data lives in the place tables** (`src/places.ts`, from REGIONS.md §1): a new
  per-place choice (sand, material, coast kind, reef, tide) is a field there with a region
  default, not a separate table keyed by biome × ocean.
- **Budget:** render time within ~10% of today per phase (`bench.mjs`); meshes < 100k tris;
  instanced near-camera detail ≤ ~1M tris for stones (2d) and ≤ ~0.5M for everything else added
  here together. The terrain shader grows in several phases: measure it each time, and branch on
  coast kind (uniform) so only one profile runs per day.

## Phases

Order follows dependencies: shared pieces (places, coast-kind terrain, tides, calm water)
come before the features that need them. Phases 1–9, 11 and 12 are the plan; 10, 13 and 14
are **later**: each gets its own plan when started (see "Later and skipped"). Stopping
after 12 leaves a complete result.

| # | Phase | Needs | |
|---|---|---|---|
| 0 | Docs: research and gaps | – | |
| 1 | Foundations: places (before the sky), coast-kind terrain, hemisphere seasons | – | |
| 2 | Stony beaches | 1 | |
| 3 | Cheap table changes | 1 | |
| 4 | Beach shape from waves and grain | 2, 3 | |
| 5 | Tides | 1 | |
| 6 | Calm water (shelter mask) | – | |
| 7 | Reef-fronted tropical beaches | 1, 5, 6 | |
| 8 | Rocky shore | 2, 5 | own plan first |
| 9 | Tidal flats and salt marsh | 5, 8 | |
| 10 | Landforms: barrier lagoon, spit, fjord | 6, 8 | later, own plan |
| 11 | Climates: temperate, subtropical, polar | 1, 3 | |
| 12 | The real sun: polar night, midnight sun | 1 | |
| 13 | Weather extras | 11, 12 | later, own plan |
| 14 | Animals | 5, 7, 8, 9, 11 | later |

Foundations come first, so every new profile (stone ridges, cusps, reef, platform, flat) is
a branch of the coast-kind switch (1b).

**Size:** phase 8 and the later phases 10 and 13 are each bigger than phases 0–3 together.
Before starting one, write its own plan in `knowledge/plans/` (8: rock-shore terrain and
preview; 10: one per landform; 13: snow and ice foot apart from the rest) and keep only a
summary and a link here.

### 0. Docs: research and gaps (no code)

- COASTS.md: add "Research: the world's coasts" (coast-type shares, beach states, sand
  colours, tides, reef-fronted beaches, landforms, climates) with sources, and a
  "Gaps" table pointing to the phases here.
- CLOUDS.md: a "Coastal weather" note: marine layer, harmattan (phase 3); sea breeze,
  offshore winds (later, phase 13).
- ANIMALS.md: a "Planned" list under the rules (sea otter, walrus, polar bear, waders).
- REGIONS.md "To check": look up the ≈ values (tides for Patagonia, Red Sea, Norway,
  Iceland; grain sizes; slopes) once here, so later phases don't each stop for research.
- Commit: "Docs: coast and climate research, gaps vs. today".

### 1. Foundations

Three steps every later phase builds on, one commit each.

#### 1a. Places, drawn before the sky (changes every date)

The day draws a **place** first; biome, ocean, climate and latitude follow from it, and the
sky is drawn after, so it can depend on the place (decision 8). Data and weights:
**REGIONS.md §1**.

- `src/places.ts`: `type Place` with three kinds of field:
  - **constant:** `biome` (today's `Biome` preset, the look), `region` (shared defaults
    and a spec name; never drawn), `latitude` range (signed: the sign is the
    hemisphere), later `tide` range;
  - **choose one** (weighted, `{ atlantic: 70, arctic: 30 }`): `ocean`, `climate`; later
    phases add `material` (2), `sand` (3), `reef` (7), `coast` kind (8, 9);
  - **choose many** (pools): `animals`, `plants`, later `debris`, `flowers`. A pool entry
    may carry a weight or months (`{ kind: 'sandpiper', months: [7, 9] }`); each feature's
    own rules still decide what shows on the day.
  - **Defaults:** a place lists only what differs from its region; a region lists only
    what differs from its biome's current behaviour (today's plant sets, animal regions,
    sands). `placeFor(seed, spec)` merges biome → region → place.
- **Weights:** √ of the region's coastline length, split among its places by length
  (decision 11). Result: nordic ≈ 42%, tropical 23%, mediterranean 14%, volcanic 13%,
  desert 9% of days.
- **Draw order in `buildParams`:** the place is the **first** main-stream draw, before
  the eclipse check and time of day. Right after it: ocean from the place's choices on
  stream `'ocean'` (ice and monsoon as today), climate on `'climate'`, latitude from the
  place's range on `'ocean'`. Then the sky as today. The old biome draw (~1305), the
  ocean's later position and `OCEANS_BY_BIOME` / basin latitude ranges go. Because the
  place comes before the sky's variable draws it needs no `keep()` pin.
- **What this opens up** (used later, no change in 1a): the sky can read
  `params.place`, latitude and date while it is drawn: phase 3's marine layer is a chance
  inside the weather draw, phase 12 limits the time-of-day draw to what the sun allows.
  No re-generation pass is needed (decision 12).
- `SceneParams.place` (`{ id, region, climate, hemisphere }`); `params.biome` and
  `params.sea.ocean` stay, so every existing reader keeps working.
- **Specs:** new field `place` (a place id, or a region id = any of its places). `biome`,
  `ocean` and `climate` still work: they restrict the draw to places that match (weights
  renormalised) and force that choice; impossible combinations (`biome: "tropical"`,
  `ocean: "arctic"`) throw. Existing scene specs keep working.
- **Wildlife:** `wildlife.ts` reads the place's `animals` pool instead of `regionFor` (its
  first float goes). Region defaults reproduce today's regional animals (macaques in
  se-asia, vervets in east-africa, …); the new places get their own (decision 9). The
  Galápagos/Hawaii latitude test goes (they're places now). Regenerate ANIMALS.md.
- **Every date changes** (the one deliberate main-stream change, see "Rules"): new biome
  mix, latitudes, animals. Check one day per biome still looks right (front-lit;
  `bench.mjs` for time) and say so in the changelog.
- **Re-find dates that depended on the old draw:** SCENE_SPECS.md "Fixed dates" (real
  eclipses stay: they're tied to the date, not the draw; others need a new date or a
  spec), hard-coded dates in `test/` (prefer specs: `scene(spec, date?)`), and dates
  named in COASTS.md, CLOUDS.md, ANIMALS.md and LESSONS.md. Grep for `20[0-9][0-9]-` and
  check each still shows what it claims.
- Tests (`test/places.test.ts`): shares over `allParams()` per biome, region and place
  roughly as weighted; every place's choices non-empty and from the known values;
  latitudes in range and signed by hemisphere; specs `place`, `biome`, `ocean`,
  `climate` force what they say and throw on impossible combinations; forcing
  `timeOfDay` doesn't change the place; determinism.
- Docs: ARCHITECTURE.md (places, draw order), COASTS.md (shares), ANIMALS.md (pools),
  SCENE_SPECS.md (`place`, `climate`); REGIONS.md references "PLAN_BIOMES 1a".

#### 1b. Coast-kind dispatch (no rendering change)

- `CoastParams.type` gains `'rock-shore'` and `'tidal-flat'` (unused until phases 8–9).
  Replace the ~26 `type === 'beach'` / `'open-sea'` checks (recount) with helpers in
  `terrain.ts`: `hasLand(coast)`, `hasBeach(coast)`, `hasSurfZone(coast)`, and go through
  the files deciding which each means (composition, camera, props).
- `terrainHeightAt`: a `coastKind` uniform selects the profile (one branch per day, not all
  evaluated); TS mirror switches the same way.
- Tests: params and images the same before and after (refactor check); helper truth
  table per coast type.

#### 1c. Hemisphere-aware seasons

- `season(params)` / `monthInSeason(params, fromMonth, toMonth)` helpers from the place's
  hemisphere (the sign of its latitude; Southern Ocean places included), replacing the
  ad-hoc `ocean === 'southern'` flips.
- Go through every month-keyed table and use the helper: flowers (`shoreLife.ts`
  `FLOWERS`), fog seasons (`fogSeason`), cloud summer (`pickFormations`), sea smoke,
  migratory birds, turtle nesting (check), ice.
- Southern-hemisphere days (Chile, SW Australia, Cape, Natal, Atacama, Namibia, Réunion,
  NZ…) get their real seasons; note in the changelog.
- Tests: a July day in SW Australia is winter (no summer flowers), a January one summer;
  northern months as before.
- Docs: ARCHITECTURE.md (seasons), LESSONS.md.

### 2. Stony beaches (shingle and cobble)

Adds pebble, shingle and cobble beaches, such as those of Atlantic Canada, Norway, Nice and
Iceland, as a **beach material** each place chooses, next to sand colour. It adds
`coast.material`, steep ridged profiles and the stone shader, which phases 4, 8 and 9 reuse.

**Done when:**

- A stony beach reads as one at wallpaper size: individual stones near the camera, a stony
  texture to ~80 m, and the right colour and steep ridged profile beyond.
- Views: `shoreline`, `along-beach`, `framed` (stones in the foreground), `overlook`
  (colour and ridges only). Open-sea days don't get a material.
- Render cost: within ~10% of today on stony days, about the same on sand days.

**Materials:**

| Material | What it is | Stone size |
|---|---|---|
| `sand` | today's beach | – |
| `mixed` | sand beach; gravel/cobble band on the upper beach and storm ridge | 2–15 cm |
| `shingle` | pebbles over the whole beach, coarser at the crest | 1–6 cm |
| `cobble` | cobbles and small boulders, gravel or sand at the waterline | 6–30 cm |

**Chances on beach days** (the place's `material` choice; these are the biome defaults,
regions and places override):

| Default for | sand | mixed | shingle | cobble | Stone colours |
|---|---|---|---|---|---|
| nordic | 35 | 25 | 20 | 20 | grey granite, greywacke, some red sandstone (Fundy) |
| polar climate | 25 | 25 | 20 | 30 | grey, more angular (frost-shattered) |
| mediterranean | 55 | 15 | 25 | 5 | white–cream limestone, grey |
| volcanic | 50 | 15 | 15 | 20 | black basalt, a few red scoria |
| desert | 75 | 15 | 5 | 5 | tan and red gravel |
| tropical | 85 | 10 | – | 5 | pale coral rubble, dark basalt |

Overrides to set now: britain-ireland, brittany-normandy and atlantic-canada more shingle
(temperate shingle coasts: Chesil, Normandy, Nova Scotia); wadden-north-sea, the Baltic's
sandy south and florida-carolinas mostly sand. Target over 2024–2026: ~62% of beach days
sand, ~15% mixed, ~23% shingle or cobble (close to reality; decision 1). Measure with
`params.mjs` and adjust the overrides, not the defaults.

#### 2a. Choice and spec (no rendering change)

- `src/beach.ts`: `type BeachMaterial`, the biome defaults above, stone palettes per biome
  as `RGB[]` (region overrides: Fundy red sandstone); `material` field in `places.ts`.
- `params.ts` `generateCoast`: `coast.material` from the place's choice on
  `Random.derive(seed, 'beach-material')`, forced via `or(drawn, spec.beachMaterial)`.
  Open-sea days get `'sand'` (unused).
- Shape on non-sand days from that same stream. These ranges are temporary: phase 4
  replaces them with slopes from the beach state (stony beaches always reflective), so
  pick plausible values and don't tune them:
  - `beachSlope` 0.12–0.25 (shingle/cobble), 0.08–0.14 (mixed);
  - `beachWidth` 12–40 m; `sandbarHeight = 0`; `duneHeight` small (grass or rock behind);
  - new `CoastParams.ridges`: 1–3 storm ridges (height 0.3–1.2 m, at the high-tide and
    storm lines from `beachLines`).
- `sceneSpec.ts`: `beachMaterial: oneOf('sand', 'mixed', 'shingle', 'cobble')`.
- Title: `nordic cobble beach` / `mediterranean shingle beach` (sand titles unchanged).
- `src/props/choices.ts`: expose it so `params.mjs --stats 'p => p.coast.material'` works.
- `test/beach.test.ts`: shares over `allParams()` per biome and region roughly as set, no
  shingle in the tropics, forced spec works on any place.
- Update COASTS.md with the measured shares.

#### 2b. Terrain shape

- `terrain.ts` (GLSL and TS mirror), beach branch of 1b: add ridges to the beach profile
  (Gaussian bumps along `s`, wobbling with `a`); keep `terrainHeight` and the shader in step
  (`test/terrain.test.ts`).
- Surf: a steep beach means the waves break on the beach face (surging/plunging, narrow surf
  zone). Check `surfBreakDepth`/`breakerIndex` give that from the slope; if not, add the
  material to `breakerIndex`.
- Run-up: shorter swash (it sinks into gravel): scale `runup` ~0.6 on shingle/cobble.
- Render check: `--scene '{"beachMaterial":"cobble","composition":"along-beach"}'` with
  stones still drawn as sand; the profile and surf should already look right.

#### 2c. Stone texture in the terrain shader (5–80 m)

- `stoneMaterial` uniform (0 sand, 1 mixed, 2 shingle, 3 cobble), `stoneSize`, `stoneColors`.
- Voronoi cells over shore coords, cell size = stone size; per cell: albedo from the palette
  (by hash), dome normal, darkened gaps (contact shadow / AO). Cap at one 3×3 cell search.
- The cell hash (centre jitter, size, colour index) is one function with a TS mirror
  (`stoneCell(s, a)` in `beach.ts`), so 2d can put mesh stones on the same cells.
- Grading: cell size grows toward the ridge crest; for `mixed` blend from sand at the
  waterline to stones on the upper beach and ridges.
- Fade to the mean stone colour by pixel footprint (like the wind ripples); no ripples on stones.
- Wet stones: darker (×0.5) and glossy, highlight per cell (each stone's own curved glint,
  not a flat sheet).
- Also feed the palette mean to `ocean.ts` `sandAlbedo` (shallow seabed colour).
- Test patched GLSL at `--w 320 --h 180 --frames 1` first.

#### 2d. Stones near the camera (while a stone is ≥ ~10 px)

A stone gets a mesh only while it is big on screen: ≥ ~10 px, where its silhouette,
parallax and cast shadow show. Smaller, the shader (2c) looks the same. At 1080p with a
50 mm lens (36 mm sensor) one pixel is ~0.37 mrad, so the mesh radius is ≈ 170 × stone
size: 3 cm pebbles to ~5 m (16 px at 5 m), 10 cm cobbles to ~15 m (18 px), 20 cm to ~15 m
(capped). Scale the radius with focal length and output height (`ctx` camera).

- `src/props/stones.ts`: `stoneGeometry(rng, size)`: flattened ellipsoid (pebbles: smooth,
  rounded; cobbles: a few flat facets like `rockGeometry`, much lower detail), 50–150 tris,
  base on y = 0. Preview with `scripts/mesh.mjs`.
- `createStones(ctx)`: own stream `ctx.rng('stones')`; ~6 variants in one `InstancedMesh`,
  placed on the visible beach within that radius (`ctx.visible`). **One stone per shader
  cell:** each mesh stone sits on a `stoneCell` centre with that cell's size and colour
  (not a separate Poisson-disc layer), with partial burial and rotation from the stream.
  Within the mesh radius the shader drops its dome normal and keeps only the gaps' AO,
  so there's no doubled layer; across the radius edge the mesh fades by burial over the
  last ~20% so no ring shows. `castShadow`/`receiveShadow`, `frustumCulled = false`.
- **Budget:** ≤ ~8k instances, ≤ ~1M triangles in all. Estimated counts in a 40° view
  with 60% cover: 3 cm to 5 m ≈ 5.6k; 10 cm to 15 m ≈ 4.7k; 20 cm to 15 m ≈ 1.2k. Under
  ~2 cm: shader only. Hard cap 8k (nearest first). These are estimates: check with
  `bench.mjs`; if over 10%, shrink the radius before the triangle count.
- Register in `props/index.ts`; `--props stones` reports count and nearest distance.
- Mesh tests: deterministic, finite, base near y = 0, triangle budget.

#### 2e. Other props follow

- `shoreLife.ts`: no sand crabs or sand dollars on shingle/cobble; shells fewer; shore crabs
  under cobbles in nordic are fine. Flowers: sea kale, sea pea, sea campion on shingle
  (nordic and Atlantic shingle flora) instead of dune flowers.
- `debris.ts`: driftwood and wrack on the storm ridge crest.
- `wildlife.ts`/`pinnipeds.ts`: walkers stay above the swash; check they sit on the ridge
  slope correctly.
- Rocks: more boulders on cobble days (`rockChance` up), fewer on shingle.

#### 2f. Renders and finish

- Specs in `scenes/stony.json`: Nova Scotia (`place: "nova-scotia"`, cobble, along-beach,
  golden hour), Arctic (`place: "arctic-canada"`, cobble, overcast), Nice
  (`place: "western-med"`, shingle, shoreline, daylight), Iceland (`place: "iceland"`,
  cobble, framed), mixed (`place: "scotland"`, mixed, shoreline), overlook (`aegean`,
  shingle). Front-lit (`sunAzimuthDeg: 160`) first, then backlit.
- `diff.mjs` with `--off '{"beachMaterial":"sand"}'` to confirm each shows.
- `bench.mjs --ref HEAD~N`: render time within ~10%.
- ~3 render rounds. Then: changelog.md, ARCHITECTURE.md (beach material), LESSONS.md,
  REFERENCES.md (from COASTS.md), COASTS.md shares and mark its stony-beach proposal done,
  ANIMALS.md if animal rules changed.
- Arctic winter stones under snow and an ice foot: later (phase 13).

### 3. Cheap table changes (no new geometry)

Each is a place field, a table row or a palette, plus a spec value and a test.

| Change | Where | Rule |
|---|---|---|
| Pink sand | `biome.ts` `SAND_STYLES` (`pink`, albedo ≈ [0.68, 0.52, 0.48]) | place `sand` choice: `bahamas-bermuda` ~25% of beaches, `indonesia` ~3% (Komodo), other tropical places ~1% |
| Red sand | `SAND_STYLES` (`red`, ≈ [0.42, 0.2, 0.12]) | place `sand` choice: `pei` ~60% and `fundy` ~40% of beaches (other atlantic-canada places none), `hawaii` ~4% (Maui), `oman-yemen` and `red-sea` ~3% |
| Sand colour | `generateCoast` | The place's `sand` choice (a weighted table, defaulting to its biome's `sands`) on `Random.derive(seed, 'sand-colour')`. A forced `sand` wins |
| High Arctic tundra | `params.ts` polar filter (~1314) | Already no trees on polar coasts; above ~74° (Svalbard, high Arctic Canada, N Greenland) also drop birch (only dwarf willow and birch, < 30 cm, which read as `grass`/`bush`) |
| Southern Ocean plants | `tierra-del-fuego` and `south-georgia` plant pools | tierra-del-fuego: add southern beech (as `broadleaf`, wind-bent) at the back; South Georgia stays grass (tussock) |
| Marine-layer mornings | a chance inside the weather draw (`generateWeather`, which now runs after the place, 1a) | `california` and `atacama-peru` places, May–Jul (Jun–Sep weaker in Atacama: winter-spring camanchaca), golden hour to late morning: overcast with stratus or Sc deck at ~300–600 m on ~45% of those mornings; ~15% in Aug–Oct; never on storm days |
| Harmattan | `seaHaze.ts` | `west-africa` place, Dec–Feb: dust visibility 2–10 km, ochre haze, sun dimmed and reddened; ~50% of those days |
| Haar | `params.ts` fog | britain-ireland and norway regions Apr–Jul: check `fogSeason` first; raise the advection chance only if it doesn't already peak then |

- Spec: `sand` accepts `pink` and `red`; marine layer is forced with the existing
  `weather: "overcast"` + `clouds: ["stratus"]`, plus a new `marineLayer: true|null` so
  tests can switch it off; harmattan via a new `dust: "harmattan"|null` if `seaHaze` has
  no force today.
- Tests: `test/biome.test.ts` (new): pink and red only in the listed places, roughly as
  often; `test/seaHaze.test.ts`: harmattan only west-africa Dec–Feb;
  `test/cloudTypes.test.ts`: marine layer by place, month and time of day; vegetation: no
  birch above 74°, beech only in tierra-del-fuego.
- Renders: PEI red beach (`place: "pei"`, `sand: "red"`, golden hour),
  Bermuda pink (`place: "bahamas-bermuda"`, daylight, front-lit), Svalbard tundra
  (along-beach), California June morning (`place: "california"`, `"date": "2025-06-14"`,
  golden hour), Loango harmattan (`place: "west-africa"`, `2025-01-10`).
- Docs: COASTS.md sand table, CLOUDS.md marine layer row, ARCHITECTURE.md (sand colour,
  tundra), changelog (marine-layer mornings, harmattan days, pink/red days, high-Arctic
  plants).

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
  are test cases. Slope values checked against Bascom (1951) in phase 0.
- `Hb` from the **offshore** swell (height H₀, period T), not from `surfWave` (which uses
  the slope, so it would be circular): Komar–Gaynord Hb ≈ 0.39 g^0.2 (T H₀²)^0.4. Storm
  days and winter months (hemisphere-aware, 1c) push one state toward dissipative (winter
  profile).
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
- Renders: along-beach on a cusped reflective beach (`western-med`) and a dissipative
  multi-bar beach (`namibia`, big swell); `bench.mjs` (expect pixel change, ≤ 10% time).
- Docs: ARCHITECTURE.md (beach state), LESSONS.md; changelog: "all beach days change
  slope and bars".

### 5. Tides

- `src/tides.ts`: `tideFor(params, rng)` → `{ range, level, phase }`. Range is a constant of
  the place (`tide`, from **REGIONS.md §3**; region default, place override): Caribbean
  0.1–0.2 m, Mediterranean ~0.4 m, Hawaii ~0.6 m; Wadden 1.5–4 m; Brittany, Fundy, Bristol
  Channel, Ungava, Cook Inlet, Incheon, NW Australia 8–12 m mean (up to 16 m).
  × 1.2 at spring tides (moon phase within ~2 days of new/full) and × 0.8 at neaps.
- Level: a random phase of the semidiurnal cycle on stream `'tide'` (real high-water
  times depend on each port's lunitidal interval; a random phase is realistic for an
  unnamed beach). Spec `tide: "low"|"mid"|"high"` sets the phase.
- **Lower the land, not the sea.** Sea level 0 stays everywhere (ocean, surf, `seaLevel()`).
  The terrain profile and everything placed on it (rocks, debris, plants, animals,
  lighthouse mound) shift by −`level`; `beachLines` and the wrack stay attached to the
  land. One offset uniform in `terrain.ts` plus the TS mirror; props already sample the
  terrain. Distant islands and landforms don't move (sub-pixel).
- **The profile must fit the range.** An offset alone breaks macro tides: 8–12 m on a
  0.035–0.11 slope moves the waterline 100–300 m, floods a 3 m dune at high tide and
  strands the camera far from the water at low tide. So:
  - The beach is generated for its tide range: the high-water line (`beachLines`) sits at
    +range/2 above mean sea, the dune toe and storm ridges above it, and the intertidal
    width is range / slope. Macro-tidal beaches get flatter low-tide terraces (real ones
    do: Brittany, Fundy) so the width stays within ~400 m. Micro-tidal days keep today's
    profile.
  - The tide `level` is drawn **before** the camera: `distanceToWater` and the
    composition are measured from the current waterline, not from mean sea level, so
    every composition still frames the water. `beachLines` returns both the mean and
    the current waterline.
  - Phase 4's beach state uses the range too (macro-tidal beaches skew to low-tide
    terrace and dissipative).
- Low-tide look (meso and macro only): wider wet band (wetness by height above the last
  high water); exposed rocks get a dark weed/mussel band (vertex colour below the
  high-water line in `rocks.ts`); tidepools as flat mirror patches between rocks.
- Spec: `tide`, `tidalRange`.
- Tests: ranges per place, spring/neap from moon phase, level in range, terrain and props
  move together, micro-tidal days visibly unchanged (level within a few cm).
- Renders: Brittany low and high tide (`place: "brittany"`, along-beach), Mediterranean
  (no visible change); `diff.mjs` between low and high.
- Docs: ARCHITECTURE.md (tides, land offset), LESSONS.md, SCENE_SPECS.md fields,
  changelog (all meso- and macro-tidal beach days).

### 6. Calm water (shelter mask)

Needed by reef lagoons (7), later by barrier lagoons, spits and fjords (10) and sheltered
mangroves.

- `ocean.ts`: a `shelter(p)` term in 0..1 multiplying the swell cascades (not the short
  wind chop), next to `shallowDamping`. Sources, as uniforms: a reef or barrier line in
  shore coords (`s` beyond which the sea is open), and up to a few polygons/ellipses for
  lagoons and fjord interiors. Wind chop scales with fetch inside (lagoon width).
- **Everything read from the cascades follows the mask,** not just displacement: normals
  (slopes), the Jacobian foam and whitecaps, and the CPU `seaLevel()`. Apply it where
  `shallowDamping` is applied today (both GLSL copies, `ocean.ts` ~159 and ~328), so one
  factor covers all of them, and blur the mask over ~1 swell wavelength so no edge shows.
- `SURF_GLSL` and the TS mirror (`surfWave`): offshore height × (1 − shelter), so no sets
  break on a lagoon shore; foam and refracted surf follow.
- Waves that pass a reef or bar re-form at 10–30% of the offshore height. This is the surf
  model's job (`SURF_GLSL` / `surfWave`; the sandbar code already re-forms waves; reuse
  it), not the ocean cascades'.
- Tests: mask 0 everywhere when unused (the ocean as before), lagoon surf height ≤ 0.3 ×
  offshore, CPU/GPU agree.
- Render check with a forced test lagoon at 640×360 before phase 7 uses it.
- Docs: ARCHITECTURE.md (shelter), LESSONS.md.

### 7. Reef-fronted tropical beaches

- Choice: the place's `reef` chance (choose one: reef / none), read by `reefFor(params,
  rng)` on stream `'reef'`: ~60% of tropical beach days overall, island places
  (pacific-islands, maldives, sri-lanka, andaman-lakshadweep, philippines, indonesia,
  north-australia, antilles, bahamas-bermuda) more than continental ones (central-america,
  west-africa, east-africa, northeast-brazil, india), ~20% of `hawaii` and `red-sea`;
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
- Tests: reef only on the listed places and shares, profile continuity, surf height inside
  the lagoon.
- Renders: Maldives (`place: "maldives"`, shoreline, midday), Tahiti
  (`place: "pacific-islands"`, overlook), Hawaii (along-beach), each front-lit then
  backlit; `diff.mjs --off '{"reef":null}'`.
- Docs: COASTS.md (reef share), ARCHITECTURE.md (reef profile), changelog (tropical beach
  days with a reef).

### 8. Rocky shore (own plan first)

Uses the coast-kind switch from 1b.

- `generateCoast`: the place's `coast` choice (beach / rock-shore / tidal-flat; open sea
  stays its own 35% draw) on a new stream `'coast-kind'`: overall ~38% of beach days
  become `rock-shore` (≈ 25% of all days; decision 1: the world's coasts are ~40% rock
  without sediment and ~33% cliffed, against ~40% sand and gravel). Region defaults,
  place overrides: Norway, Greenland, Arctic Canada, BC, Alaska, Patagonian fjords,
  Atlantic Canada, Britain, Brittany, Iceland, California, Chile most (≈ 50–60% of their
  coast days); Mediterranean ~40%; tropical, desert and barrier-island coasts (Florida,
  Wadden) least (≈ 10–20%). Measure the result with `params.mjs` and record it in
  COASTS.md.
- Kinds of rocky shore: low wave-cut platform (most), boulder shore, cliff top (the
  `overlook` composition). Cliff-top views make up roughly a third, since much rocky coast
  can only be seen from above.
- Terrain: wave-cut platform (flat, slightly seaward-dipping shelf, ragged edge as noise
  in `a`), a low cliff or boulder slope behind, no sand. Reuse `rocks.ts` boulders on the
  platform and the phase-2 stone shader in gaps.
- **The hard part is looking like rock, not lumpy ground.** Real rocky shores have
  gullies, stepped ledges along bedding or joints, sharp edges and overhangs; a
  cross-section plus noise reads as smooth hills. Plan for it before building:
  - near the camera (~0–60 m): a separate rock heightfield mesh (like `islands.ts`)
    with terraced noise (quantised steps for bedding), joint-aligned gullies cut along
    `a`, and sharp ridged noise; further out the cross-section profile with the same
    colours;
  - preview it alone with `scripts/mesh.mjs`, then compare with reference photos
    (Peggy's Cove granite, Big Sur, Icelandic basalt) in a contact sheet before
    adding water;
  - phase 8's own plan (see "Size") fixes the mesh, its triangle budget and the
    shader before any props.
- Water: waves break on the platform edge (rock data for `ocean.ts` foam, `waveOnRock`),
  spray bursts on the outer ledge, wash across the platform; tidepools at low tide (5).
- Compositions: `shoreline` and `framed` from the platform; `overlook` from the cliff top.
- **Props on a rocky shore** (each creator checks `hasBeach` / `coast.type`):

  | Prop | On a rocky shore |
  |---|---|
  | Rocks, boulders, sea stacks | yes, more (the shore itself) |
  | Gulls, colonies, migratory flocks, marine life, ships, islands, landforms, lighthouse | yes, as on beaches (lighthouse on the platform or cliff instead of a mound) |
  | Seals and sea lions | yes: rock haul-outs on the platform edge (rock shares up, beach haul-outs off) |
  | Marine iguanas (Galápagos), shore crabs, starfish | yes, on the platform and in pools |
  | Driftwood, wrack | yes, jammed in the back of the platform and gullies; no piles |
  | Vegetation | yes, behind the cliff or boulder slope; no dune grass |
  | Turtles and hatchlings, ghost and hermit crabs, shells, sand flowers | no (need sand) |
  | Crocodiles, hippos, monkeys, green iguanas, monitors, spiny-tailed lizards | no (beach animals; beach days only) |
  | Mangroves | no |
  | Stones (phase 2) | only in gaps and gullies (shader), no beach |

  So these beach animals appear less often over all days; regenerate ANIMALS.md.
- Spec: `coast: "rock-shore"`.
- Tests: shares by region, terrain has no sand band, camera stands on rock.
- Renders: Peggy's Cove (`place: "nova-scotia"`, granite, golden hour), Big Sur
  (`place: "california"`, overlook), Iceland basalt (`place: "iceland"`, storm swell).
- Docs: COASTS.md coast table, ARCHITECTURE.md, changelog (beach days that become rocky
  shores), CLAUDE.md views list.

### 9. Tidal flats and salt marsh

- Coast kind `tidal-flat`, ~3% of days (the place's `coast` choice), only in macro- and
  mesotidal places with flats: `wadden-north-sea`, `fundy`, `morecambe-bay`,
  `mont-saint-michel`, `yellow-sea`; only when the tide (5) is below mid. So the tide is
  drawn before the coast kind in `generateCoast` (it already is before the camera,
  phase 5).
- At mid or high tide the same day is a beach **with a salt marsh behind**: a feature of
  its own on every beach day in those places. Spec field `saltMarsh`, a share in the tests
  and COASTS.md, and a render (Wadden high tide, along-beach).
- Terrain: a km-wide, near-flat profile (slope ~1:1000) with shallow meandering channels
  (noise in `a`), sand ripples (reuse the wind-ripple normal, smaller), the sea a far line;
  wet-flat reflections come from the existing wet-sand shading.
- Salt-marsh band at the back: low green-brown grass tufts, instanced like vegetation.
- Spec: `coast: "tidal-flat"`.
- Renders: Wadden Sea at low tide (golden hour), Fundy red mud.
- Docs: COASTS.md, ARCHITECTURE.md, changelog.

### 10. Landforms: barrier lagoon, spit, fjord (later, own plan)

These vary in plan view, so they are **separate heightfield meshes** (like `islands.ts`),
laid over or beside the cross-section terrain, with lagoons calmed by the shelter mask (6).

- **Barrier and lagoon:** along-beach and overlook beach days in subtropical (11),
  Mediterranean and desert places (~10%): the camera's beach becomes a narrow barrier
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
  On ~30% of norway, british-columbia, alaska, patagonia-fjords and greenland days with a
  `range` landform.
- Spec: `landform: "fjord"`, `lagoon`, `spit`.
- Tests: where each appears, heightfields finite, triangle budget, shelter mask matches
  the lagoon outline.
- Renders: Outer Banks lagoon (`place: "florida-carolinas"`, overlook), Farewell Spit
  (`place: "new-zealand-south"`), Norwegian fjord mouth.
- Docs: COASTS.md landforms, ARCHITECTURE.md, changelog.

### 11. Climates: temperate, subtropical, polar

The biome stays a constant of the place (the look preset); the **climate** is the place's
own choice, drawn in 1a (`norway-north`: boreal 80, polar 20; `adriatic`: mediterranean
70, subtropical 30). No new biomes, so no new main-stream draw. Until this phase the
climate only drives titles (11a) and the polar material default (2); here it changes the
look. Split from the REGIONS.md weights: nordic temperate ≈ 42%, polar ≈ 39% (Arctic
places weigh a lot), boreal ≈ 19%; mediterranean biome ≈ 53% mediterranean, 42%
subtropical, 5% temperate. Measure with `params.mjs` and record in COASTS.md.

Titles use the climate ("temperate shingle beach", "subtropical beach"; decision 2).

Sub-steps, one commit each:

- **11a. Climate in titles** (no rendering change): `params.place.climate` is set by 1a;
  spec `climate` (1a) forces it; titles use it. Tests: shares as expected.
- **11b. Land.** A subtropical place has the `mediterranean` biome but must look like
  Florida. Before building, list every field of `Biome` (`biome.ts`) and every
  biome-keyed table (vegetation, rocks, debris, shore life, flowers, islands, wildlife,
  clouds, fog) and mark per climate: keep the biome's, or override. Implement it as one
  `climateBiome(biome, climate)` that returns a patched `Biome`, so consumers keep
  reading `params.biome`; place and region fields still override on top. Then: sands,
  rock colours, plants: temperate = mixed broadleaf and conifer, marram dunes, machair on
  shell-sand Atlantic coasts; subtropical = live oak, saw palmetto (as `bush`), sea oats on
  dunes, pale quartz beaches; polar = the tundra filter from phase 3.
- **11c. Sea and sky:** swell per climate, fog (temperate haar, subtropical less), cloud
  leanings (temperate Sc ×2 like cool; subtropical congestus ×2 and summer storms).
- **11d. Props:** debris (temperate kelp; subtropical sargassum on the Atlantic, seagrass),
  shore life (subtropical ghost crabs).
- **11e. Animals:** region pools per climate (1a), pinnipeds, migratory birds;
  regenerate ANIMALS.md.
- Renders: one per new climate in each composition once.
- Docs: COASTS.md biome table (biome × climate shares), CLOUDS.md climate leanings,
  ANIMALS.md, ARCHITECTURE.md, SCENE_SPECS.md fields, changelog.

### 12. The real sun: polar night and midnight sun

- `src/celestial.ts`: `sunLimits(latitudeDeg, date)` → the day's highest and lowest solar
  elevation (declination from the date; signed latitude, hemisphere from 1a).
- **The time-of-day draw only offers what the sun allows** (the place is known before
  the sky, 1a): weights of impossible categories go to 0 and the rest renormalise.
  - **polar night** (max elevation < 0°): only blue hour (civil twilight glow at noon,
    max ≥ −6°) or night (max < −6°);
  - **midnight sun** (min elevation > 0°): no night or blue hour; sun-on-horizon or golden
    hour at "night", sun low in the north (south in the Southern Ocean);
  - the sun's elevation stays within the day's real range.
- **Azimuth:** today the sun's azimuth is `headingDeg + relSunAz`, both random, so no
  compass direction is real. On midnight-sun days the heading is drawn as
  `realSunAz − relSunAz` (keeping `relSunAz`, the framing), so the low sun really is in
  the north. Every other day keeps its random compass (a real compass sun for all days is
  under "Later and skipped").
- **Eclipses:** a solar eclipse is dropped where the sun never rises that day (polar
  night); a lunar eclipse stays.
- Days below ~63° never change; test that the filter does nothing there.
- Spec: an explicit `timeOfDay` still wins (like eclipses), so specs can show impossible
  combinations for debugging; `sunElevationDeg` likewise.
- Tests: Svalbard (78°) in December only night/blue hour; in June never night, sun
  azimuth within ±30° of north at "night"; the equator unchanged.
- Expect: polar places are ≈ 16% of days and about half lie above the Arctic Circle, so
  roughly 8% of all December–January days become night or blue hour.
- Renders: Svalbard noon in December (blue-hour glow), midnight sun in June.
- Docs: ARCHITECTURE.md (sun limits), SCENE_SPECS.md, changelog (Arctic and Southern Ocean
  days in polar night or midnight sun).

### 13. Weather extras (later, own plan)

In build order (cheap and frequent first):

| Feature | Rule | Build |
|---|---|---|
| Offshore wind | Mistral (`western-med`), bora (`adriatic`), Santa Ana (`california`, Oct–Mar), harmattan (`west-africa`): wind from land | wind heading vs. `seawardAzimuthDeg`; offshore: visibility up, smooth wave faces, spray blown back off the crests (`props/surf.ts`) |
| Snow and ice foot | Polar and nordic winter by latitude and month (and boreal late winter) | terrain colour above the high-tide line by a snow mask (noise, less on steep slopes); snow-capped rocks (vertex colour by normal.y) and plants (white tint on conifers); ice foot as a low extruded strip at the high-water line; frozen spray on rocks; stones under snow |
| Bioluminescent surf | Dense dinoflagellate blooms, months per region from **REGIONS.md §4**: california Mar–Sep, maldives Jun–Oct, andaman-lakshadweep Oct–Mar, taiwan-south-china (Hong Kong, Matsu) Apr–Jun, tasmania Dec–Feb, yucatan-belize (Holbox) Jun–Sep | `ocean.ts`: blue emission on breaking crests and swash (foam mask × bloom), in scene units scaled like the moon (bright against night exposure, invisible by day) |
| Sea-breeze cumulus (last) | Warm sunny afternoons (`few`/`scattered`, sun up after ~11:00, mediterranean, subtropical, tropical climates): Cu over land, clear over the sea | `cloudArrangement.ts`: mask the weather map by a land/sea line ~1–5 km inland, along `seawardAzimuthDeg`; patch every pass that reads the weather map (clouds, shadow, env cube), as `stormCells.ts` does. Costly for a subtle effect: build only if the others leave budget |

Bioluminescence is **eligible** on nights (night or late blue hour) in those places and
months, with moon illumination < 30% and no storm; it shows on ~15% of eligible nights
(blooms are episodic; a few days a year per place, decision 4).

- Spec: `offshoreWind`, `snow`, `bioluminescence`, `seaBreeze`.
- Specs, tests, renders and docs as in the other phases (CLOUDS.md for sea breeze,
  LESSONS.md, changelog with the days that change).

### 14. Animals (later)

| Animal | Where | Notes |
|---|---|---|
| Sea otters (rafts in kelp) | california, alaska, british-columbia | float on their backs in a kelp-bed canopy: also add floating kelp mats (`debris.ts` wrack builder at sea level) on those coasts |
| Walrus haul-out | svalbard, greenland, arctic-canada, alaska-north | beach or ice floe, 5–40 animals; `pinnipeds.ts` |
| Polar bear | arctic places, near ice | rare (~2% of eligible days), on the beach or a floe |
| Waders (oystercatchers, knots, sanderlings) | tidal flats and low-tide beaches, temperate/nordic; sanderlings on most sandy swashes | flocks running on the swash; ≥ 0.25 m above the swash line (LESSONS.md) |
| Herons (grey, reef) | rocky shores, reef lagoons | standing in shallow water |
| Tidepool life | rock-shore at low tide | urchins, anemones, mussels as vertex detail within ~10 m (real size: specks beyond) |
| Blacktip sharks | reef lagoons, by day | dorsal fins in the shallows near the camera |

- Each animal goes into the place pools (1a) where it lives; `xxxFor` choice per animal,
  `props/choices.ts`, `test/<animal>.test.ts`, meshes checked with `scripts/mesh.mjs`
  first.
- After each: `node scripts/animals.mjs`, paste into ANIMALS.md and update its rules.

## Later and skipped

Good ideas kept on record, with why they're not in the plan now.

**Later** (after phase 12; each gets its own plan when started):

- **Phase 10, landforms** (barrier lagoon, spit, fjord): large terrain work for ~10% of a
  few places' days.
- **Phase 13, weather extras:** offshore wind, snow and ice foot, bioluminescent surf,
  sea-breeze cumulus, in that order.
- **Phase 14, animals:** sea otters, walrus, polar bears, waders, herons, tidepool life,
  blacktip sharks.
- **Rias, beachrock platforms beyond reefs, mangrove shelter from barriers:** follow from
  phases 8 and 10.

**Skipped:**

- **Glowing lagoon** (Puerto Rico bays, Florida Indian River, Jamaica): needs a calm
  lagoon in view, at night, in places the table doesn't have; it would almost never be
  seen. Revisit if phase 10 lagoons exist and a `puerto-rico` place is added.
- **Re-generating the day for place rules** (a former foundations step): replaced by drawing the place
  before the sky (1a), which lets the sky read the place directly.
- **Keeping old dates' pictures for their own sake** (dummy draws, byte-identical tests):
  not needed (decision 5). Own streams and "draw, then force" stay for other reasons.
- **A real compass sun on every day** (evening sun in the west): allowed, but it ties
  framing, heading and coast orientation together; a separate piece of work. Listed as an
  idea in ARCHITECTURE.md.
- **"After a storm" beach states:** each date is generated on its own, so there's no
  history to draw on; storm days and winter months stand in (phase 4).
- **Toyama's glowing firefly squid** (Mar–Jun): not plankton; a separate feature if wanted.

## Docs to update (checklist per phase)

| Doc | What |
|---|---|
| changelog.md | a version row per phase, naming which existing days change |
| ARCHITECTURE.md, LESSONS.md, REFERENCES.md | how it works (new modules and rules), pitfalls, sources below, "Decisions" (one place draw before the sky; √-length weights; climate a place choice instead of new biomes; lower the land for tides; shelter mask; hemisphere-aware seasons) |
| REGIONS.md | replace ≈ values with checked ones (phase 0); place shares re-measured; new place fields (material, sand, reef, coast, tide, pools) as phases add them |
| COASTS.md | coast-type, material, place, tide, reef, landform, biome and climate shares, re-measured with `params.mjs --stats … 2024-01-01..2026-12-31`; mark the "Proposal" sections done |
| CLOUDS.md | marine layer, climate leanings; later sea breeze |
| ANIMALS.md | place pools, new animals' rules, and the regenerated table |
| SCENE_SPECS.md, CLAUDE.md | new spec fields and fixed dates for new looks (SCENE_SPECS.md) (PEI red beach, Wadden low tide, Maldives reef, California June gloom, Svalbard polar night and midnight sun); new views (`rock-shore`, `tidal-flat`) in CLAUDE.md "Before code" |
| scenes/ | `scenes/coasts.json` with one spec per new coast, climate and weather, for future regression renders |
| README.md | feature list, if it lists coasts or biomes |

## Decisions (2026-10-23)

1. **Shares follow reality:** `rock-shore` ~25% of days (beaches drop to ~37%, open sea
   stays 35%, tidal flats ~3%) and reefs on ~60% of tropical beach days; tune toward
   measured world shares, not toward more beaches.
2. **Climate in titles:** some days now titled "nordic" become "temperate" (or "polar"),
   "mediterranean" ones "subtropical".
3. **Polar night is real:** Arctic winter days get no sun (night, blue hour or civil
   twilight only, by latitude and date; phase 12). Arctic summer gets the midnight sun
   (no night).
4. **Rare showpieces stay rare:** bioluminescence, pink and red sand at their real
   frequencies.
5. **Old dates may change on purpose, never by accident:** a phase may change the days
   it's about, past ones included (phase 4 every beach day's slope and bars). Features
   keep their own streams (no cascades) and specs still draw, then force (clean diffs).
   The one deliberate main-stream change is 1a's place draw, which reshuffles every date
   once; its fixed and test dates are re-found then.
6. **Tides lower the land** instead of raising the sea (sea level 0 stays everywhere).
7. **Calm water is a shelter mask** in the ocean and surf shaders, shared by reefs and
   (later) lagoons, spits and fjords.
8. **One draw: the place** (1a, REGIONS.md §1). Its constants (biome, latitude, tide,
   region) are fixed; its choose-one fields (ocean, climate, material, sand, reef, coast
   kind) are weighted draws on their own streams; its choose-many pools (animals, plants,
   debris, flowers) list what can appear. A region is a group of places sharing defaults
   and a spec name, never drawn. Replaces biome × ocean × region × sub-place.
9. **New places change animals** (Pacific islands, Maldives, NW and north Australia,
   NE Brazil, Horn of Africa, West Australian desert, India): those warm days lose wrong
   animals (no macaques on Tahiti).
10. **Places set the latitude** (Norway to 71°, Galápagos 0°, Tasmania, Patagonia);
    basin latitude ranges go.
11. **Weights are √ of coastline length per region**, split among its places by length.
    Raw length would make ~70% of days Arctic and nordic; √ per region keeps the real
    ranking without depending on how finely regions are split.
12. **The place is drawn before the sky** (1a), so time of day, weather and heading can
    follow the place (marine layer, polar night, midnight sun) without re-generating the
    day.
13. **Seasons follow the hemisphere** (1c).
14. **Biome is a constant of the place, climate a choice** (phase 11): no new biomes.
15. **Phases 10, 13 and 14 are later; glowing lagoons are skipped** ("Later and skipped").

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
