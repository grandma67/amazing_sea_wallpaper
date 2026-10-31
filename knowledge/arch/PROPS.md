# Props

Everything placed in the scene (`src/props/`, built with `builder.ts` `MeshBuilder`), at real
size: rocks, sea stacks, vegetation, birds, migratory flocks, ships, marine life, ice, colonies,
pinnipeds, landforms, storm bolts, surf/rock spray, cloud events (`skyEvents.ts`,
`props/cloudEvents.ts`), waterspout, stones and beachrock (COAST.md). Which animals appear where:
[ANIMALS.md](../ANIMALS.md). Pitfalls: LESSONS.md "Placement", "Meshes".

## Plants

- **Plant pools** (`plantsFor` in `places.ts`): the place's own `plants` (region or
  `PLACE_PLANTS`), else its biome's in the day's climate (`climateBiome` in `biome.ts`, PLAN_BIOMES
  11b: subtropical palm, live oak, palmetto, sea oats; temperate broadleaf woods; volcanic coasts
  by climate). On polar water (Arctic, Southern Ocean) or in a polar climate they're filtered to
  tundra: grass and bush, plus birch in the Arctic below `HIGH_ARCTIC_DEG` (74°). A place's own
  pool skips the filter: Tierra del Fuego has southern beech (`broadleaf`) and no conifers, South Georgia only
  tussock grass. `place.windBent` kinds lean 20–35° downwind (the day's wind) and are 25% shorter,
  hero trees included (`vegetation.ts`).
- **Trees** (`trees.ts`, `props/vegetation.ts`, `wind.ts` bending): per-species leaf meshes folded
  on the midrib (oval oak/almond, ovate birch, lance olive, needles stone pine, rounded shrubs,
  pinnate acacia); bark relief as geometry (28 sides, rings every 15 cm, fissures to 5 cm,
  buttress roots). Built once into the still scene but instanced hundreds of times: < 100k
  triangles per species (tested). In-mesh randomness from `hash()`. Plants get no direct specular.
- **Salt-marsh tufts** (`props/saltMarsh.ts`, PLAN_BIOMES 9): `saltMarshFor()` on every day with
  `coast.marsh` (stream `'salt-marsh'`), colours from `marshLook`. `createSaltMarsh()` samples the
  ground inside the view cone out to 45 m (evenly by area), keeps points in the marsh band, off
  creeks and above the run-up, sparser over the first 8 m; up to 2,500 instances of 4 grass-tuft
  (10–16 blades, 0.15–0.35 m) and 4 glasswort variants (upright stems on the low marsh). Accents
  (purple, red) follow the terrain's accent patches (the same `fbm`). ~1,900 in frame, ~8 ms,
  < 150k triangles. Boulders and sea stacks are off on flats and marsh beaches (`rocks.ts`).
- **Mangroves** (`props/mangroves.ts`): `mangroveFor()` picks a stand by biome, ocean and shelter
  (`SHELTERED_SURF`, surf < 0.35 m, or a reef offshore); `createMangroves()` finds the waterline in
  frame, runs the stand 80–300 m along shore, trees where ground is within ±0.9 m of sea level,
  thinning seaward. `rhizophora()`/`avicennia()` in `trees.ts`. Shoreline views look straight out
  to sea and never show a stand.

## Landmarks

- **Islands:** `params.ts` `pickIslands()` (own stream; ~30% of days) picks kind by biome
  (`ISLANDS`) and per island offset, distance, width, height (low 1–4 km, high 8–30 km).
  `props/islands.ts` moves each to open water in frame (12-point footprint over seabed, clear of
  others and the colony rock), builds a polar-grid heightfield with noisy outline and per-kind
  profile (`islandHeight`), colours by height/slope/noise, instances palms (cays) or distant pines
  (skerries). Past 5 km `distant` (left out of the planar reflection, like mountains).
- **Big rocks in the sea** (islands, an island colony's stack, a lighthouse's rock): the heightfield,
  stack or foot mesh carries `userData.waterline` (`WaterIsland` in `props/surf.ts`: centre, 32
  waterline radii at world angles, top, depth). Islands: `outlineOfIsland()` (analytic, the shore is
  `radius() = 1`); the stack and foot: `outlineOfMesh()` (horizontal rays inward at y = 0.2).
  `props/index.ts` `waterIslandsOf()` (after the lighthouse) keeps those within 5 km and not
  `distant`, adds `islandWaves()` (`waveOnRock`'s crest; `breaks` × smoothstep(0.25, 0.9, crest):
  a few centimetres of swell laps at a cliff, white water needs tenths of a metre) →
  `userData.waterIslands` → `ocean.ts setOceanIslands()` (4 nearest, OCEAN.md) and
  `createIslandSpray()` (bursts every ~10 m of the swell-facing outline, ≤ 30 per island, when
  `breaks` > 0.5). Their material gets a **wash band** (`props/wash.ts` `addWash`/`setWash`): white
  foam on the face from the local sea level up to min(crest × (1 + 2 breaks), 0.8 × top), ragged,
  brightest at the bottom, 0.5–1 strong; at a distance this is what shows the waterline (foam on
  the water is a fraction of a pixel tall at grazing angles). Mainland headlands and icebergs are
  not tagged.
- **Lighthouse:** `params.ts` picks site, paint, height and light character by coast (~9% of days;
  most on nordic, mediterranean, volcanic; rare in tropics, deserts, polar seas). Sites: a rocky
  point with keeper's cottage (beach days) or a stout flared tower on a rock at sea; the other is
  tried if one doesn't fit the frame. Paint: white, red cast iron (Scandinavia), red or black
  bands, bare granite on rocks; red, black or copper domes. Rotating Fresnel lens: ~2° beams
  grouped by chart character (`Fl(2) W 15s` = 2 beams per group), landward side screened on a
  point; lit sunset to sunrise and in fog. `props/lighthouse.ts` builds it; `lighthouse.ts` draws
  beams in screen space (closest approach of view ray and beam axis, haze + fog scattering,
  depth-occluded) and flash glare, before exposure.

## On the beach

Rocky shores (PLAN_BIOMES 8) have no beach: shore life, mangroves, stones and every wildlife
but marine iguanas are off (`hasBeach`). Rocks: chance 0.9, twice the clusters, the rock's own
colour (`coast.rock.color`). Debris: driftwood and wrack jammed at the back of the platform
(u −3 … −0.3), none under a plunging cliff, no coconuts. Seals: `onRockShore` (level rock
0.2–4 m above the swash, 3–40 m in from today's water), tilted to the rock. Iguanas: on the
platform 3–20 m in from today's water. Vegetation starts on top of the back face.

- **Shore debris** (`debris.ts`, `debrisFor()` by biome and ocean): wrack (kelp, Posidonia mats and
  fibre balls, sargassum, sticks) on the high-tide line at ~1.1× run-up height, plus a fainter
  older line; logs on the storm line above ~2.2× and up to the back of the beach (`logGeometry`:
  bowed, oval, knots, checks, splintered end, root wads); coconuts on palm coasts. Stony days:
  logs on the storm ridge crest and its back slope, the older wrack line on the crest.
- **Shore life** (`shoreLife.ts`, `shoreLifeFor()`): crabs by biome and time of day, shells by
  coast, flowers in bloom by month (`FLOWERS`). Crabs and shells show only near the camera. Each
  flower has a `ground` (`sand`, `stones`, `both`; `growsOn`): shingle and cobble get the
  vegetated-shingle flora (sea kale, horned poppy, sea pea, sea campion) plus the either-ground
  ones; no ghost crabs or sand dollars, 30% of the shells. Mixed beaches get both.
- **Wildlife** (`wildlife.ts`, `wildlifeFor()`): the place's `animals` pool, then turtles
  (`nestingSpecies(animals, month, pick)`: in-season entries weighted), monkeys, lizards,
  crocodiles, hippos and basking turtles by the pool's chances. `inWater()` decides where the big
  ones are; `inSea()` places them by depth via `ctx.seaPoint`. `spot()` casts rays through the
  lower frame and marches them to the ground, so each group lands in view, near first; tracks are
  a world-space strip of churned sand. Turtles don't nest on shingle or cobble (basking ones still
  haul out).
- **Pinnipeds** (`pinnipeds.ts`): hauled out on rock or beach; `swimmingHead` for heads in water.
  On a stony beach: above the full run-up, no higher than the storm ridge crest, tilted to
  `terrainNormal`.
- **Rocks** (`rockChanceFor`): boulders more often on cobble (60% of the rock-free days get them),
  half as often on shingle; stony days skip the scattered near-camera pebbles (`props/stones.ts`
  draws them).
- **Colonies** (`colony.ts`): island or mainland headland/rookery. Only the island stack is a big
  rock in the sea (`userData.waterline`, Landmarks).
- **Storms and animals:** `stormy(params)` (`props/context.ts`: storm or storm sky). Gulls rest on
  water or sand facing the wind (`restingGull`), colonies have no birds up, pinnipeds leave the
  haul-out (heads only, up to 100 m off), crabs, monkeys, lizards and basking turtles hide;
  migratory flocks and whales are off.

## Ships

- **Ships** (`ships.ts`): hulls lofted per kind; `polarFleet()` replaces leisure craft in Arctic
  and Southern Ocean waters (dinghies, trawlers, expedition ships in season, icebreakers).
  `seaSpot()` aims at the lower half of the frame, then samples distance (log-uniform) and bearing
  in view. `shipSpeed()` by kind (`UNDERWAY`, stream `ships/motion`); `floatOnWaves()` fits a
  plane to `seaLevel()` every ~2 m over the waterplane (follows waves longer than the hull,
  averages shorter ones, as RAOs do). `wakeFor()`: Kelvin height 0.1 × beam × Fr, wake foam
  (propellers; sail only when quick), foam lifetime 8 + 0.8 × beam s, hull collar.
- `ocean.ts setOceanShips` (8 nearest): discards sea inside the hull (`hullHalfWidth` mirrors
  `hullShape`), adds the Kelvin field's slope (stationary phase: tan a = T/(1 + 2T²),
  k = g/(U cos θ)², two branches, weighted by how well a hull of length L makes that wavelength:
  fast boats' wakes narrow, Rabaud & Moisy), foam and a slick. `hullSpray()`: bow slam (0.6 U in a
  sea), breaking crests on the weather side (`whitecapFraction`), crests climbing the hull
  (`pose.rel`), chine sheets.
- **Ship lights** (`shipLights.ts`, sunset to sunrise): `shipLightsFor()` encodes COLREGs
  (masthead 225°, sidelights 112.5°, stern 135°, two mastheads from 50 m, sailing tricolour under
  20 m, anchor all-round, trawling green over white, deck/work lamps) at Annex I intensities
  (0.9–94 cd). Only lights whose sector faces the camera are added, as additive sprites ≥ 2.5 px
  with radiance × area = intensity, in scene units via metered luminance / `skyLuminance()`. The
  ocean mirrors the 12 brightest as GGX point lights (hidden from the planar mirror). The night
  grade is mesopic: pixels far above sky level keep their colour.
