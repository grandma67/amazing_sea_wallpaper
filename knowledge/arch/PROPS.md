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
- **Seasons** (`phenology.ts`, 0.98): `createVegetation` passes `plantSeason(kind, phen)` to
  each builder. Deciduous trees (by `deciduousShare`, hashed per tree from its shape) skip
  leaves with 1 − `on` and colour them from `autumnColors` with `turned` (hashed per leaf, top
  and outside of the crown first, each tree a little early or late), all after the builder's
  draws; as the leaves go, 0–3 fine twigs per tip show (`TWIG`). Spring's `fresh` leaves are
  paler. `grass()` turns more blades straw with `dry`. Colony birds, crabs, lizards, humpbacks,
  waterfowl and gulls read `animalSeasons.ts`.
- **Blossom** (`phenology.ts` `BLOOM`, 0.140–0.141, plans/NATURE_PLAN.md phases 3–4): rock rose,
  gorse and wattle on `bush`; flamboyant (dry-season window, bare crowns) and pōhutukawa (the first
  trees behind the shore) on `broadleaf`. A tree flowers by a hash of its position
  (`crownBlossom`); its mesh is its variant's flowering twin, built by replaying the variant's
  recorded draws (`Random.from`), so shapes and the vegetation stream don't change. `leaves()`
  turns a share of a flowering crown's cards into flower cards, outside first, after the draws,
  and thins its leaves to `on` (flamboyant); the crown is evergreen. Far crowns: `canopyTint`
  mixes toward the bush rows' flowers. `props.bloom`: true / a list forces, false is the switch.
- **Moss on rock** (`phenology.ts` `mossLook`, 0.146, NATURE_PLAN phase 7): amount by climate (`MOSS`)
  ×1.3 on the wettest coasts, dried toward brown by half the drought (`mossWetness`: wet days,
  cool climates, the Mediterranean summer, a savanna's dry season, arid). Boulder props
  (`rockMaterial`'s `mossToday`: weight and patch edge) and the rock-shore terrain; the green stays
  `MOSS_COLOR` by biome; boulders' moss starts above the spray belt (phase 8, `mossFrom`). Colonies,
  lighthouse feet and skerries keep their own growth.
  `props.moss: false`: the biome's old amount, green, none on the terrain.
- **Moss and lichen on trunks** (`props/trunkMoss.ts`, `phenology.ts` `trunkGrowth`, 0.148, NATURE_PLAN
  phase 9): bark vertices carry `barkMoss` (MeshBuilder's `mossy` round a trunk or limb: 1, gum bark
  0.3); `createVegetation` gives each instance `trunkGrowth` (moss, lichen) from its foot's height above
  the belt line (spring high water + `BELT_RUNUP`) and distance inland (`-s`). The shader (a wrapper
  patch like `snowCap`, before it) greys the bark with lichen inside the belt and puts moss cushions at
  the foot to a ragged edge `TRUNK_MOSS_TOP` × amount up, on the stemflow side (toward a slight lean,
  the upper side past ~20°), from the instance matrix, not the camera. Grass and other plants without
  bark get a zero `barkMoss`. `props.moss: false`: none.
- **Eucalyptus** (`props/trees.ts` `eucalyptus`, 0.145, NATURE_PLAN phase 6): coastal gums, 15–24 m,
  hanging leaves, smooth pale or rough dark bark; in the Australian place pools (`PLACE_PLANTS`) and
  a small weight in California. Last in the framed hero order (a near gum shows only its trunk).
  `props.eucalyptus: false` leaves them out after their draws.
- **Heath** (`phenology.ts` `heathFor`, 0.144, plans/NATURE_PLAN.md phase 5): heather in the heath
  places, brown Oct–Mar, green Apr–Jun, mauve in flower Jul–Sep. Near: the terrain's ground cover
  on rock-shore days (arch/COAST.md). Far: landforms' and islands' green slopes mix toward its far
  colour in `heathPatch` patches (`fbm3`, ~35%), unshaded (low, no gaps between crowns).
  `props.heath`: true / a stage forces, false is the switch.
- **Fairy rings** (`fairyRings.ts`, `phenology.ts` `fairyRingsFor`, 0.149, plans/NATURE_PLAN.md
  phase 10): rings of darker, greener grass on the terrain's turf, 0.4–0.6 m wide, 2–24 m across
  (¾ of them 2–10 m), broken into arcs; 40% with a straw band just inside. One ring at most per
  25 m cell (10%: 1.6 a hectare), centre, radius and look from the cell's integer hash (GLSL and the
  TS mirror `fairyRingAt` agree, for phase 12's mushrooms). Only on dense cover (not thin dune
  grass), off heath and under crowns (`skyOpen`); bands box-filtered by the pixel footprint and
  gone past ~3 m footprints. Strength by climate (`FAIRY_SEASON`, northern-equivalent days): full
  in the growing season, a third (subtropical half) otherwise; none tropical, arid, polar.
  `props.fairyRings`: true forces at full strength, false is the switch.
- **Mushrooms** (`props/fungi.ts`, `phenology.ts` `fungiSeason`, 0.151, plans/NATURE_PLAN.md
  phase 12): six kinds (`FUNGI`: fly agaric, bolete, saffron milk cap under their host trees; field
  mushroom, fairy-ring champignon, false parasol on the turf), procedural cap and stem (~200
  triangles, cap 1 across, three ages) at real size by instance scale. Season by climate
  (`FUNGUS_SEASON`; subtropical by month; tropics by the dry season), ×1.5 on a wet day
  (`isWetDay`), none under lying snow. Placed by hash of where they stand: up to 8 slots per host
  crown (forest floor only: ground cover ≥ 0.15), troops in 4 m turf cells, champignons along the
  fairy rings' bands (`fairyRingPoint`); the turf from `groundCover.ts` (a CPU mirror of the
  shader's cover and heath mask). Drawn while a cap is ≥ 2 px, within 60 m, ≤ 3000.
  `props.fungi`: true forces as at the peak, false is the switch.
- **Baked scans** (`src/props/scans/`, 0.150, plans/NATURE_PLAN.md phase 11): CC0 scans baked
  offline (`asset.mjs bake`) into vertex-coloured, quantised meshes at real size, base on y = 0,
  each glTF node a variant at two levels of detail (5k and ~1.5k triangles). Plant cards are cut
  along their alpha map (edges split to 2 texels, so the cut stays connected), coloured from the
  calibrated albedo, welded and simplified (meshoptimizer). Each scan is a dynamic import (a chunk
  fetched only by a day that draws it: `loadScan(id)` before building, then `scanGeometry` sync).
  First: Poly Haven's *Ursinia* daisy (5 plants, 0.14–0.42 m), for phase 16's Namaqualand bloom;
  nothing draws it yet.
- **Sea ice** (`seaIce.ts`, `props/seaIce.ts`, 0.114, plans/SEA_ICE.md): `pickSeaIce` on its own stream gives `params.seaIce`
  (`edge`, `cover`, `snow`, `melt`, `thin`, `rubble`, `lead`, `origin`). A sheet (a polar-grid wedge at `ICE_FREEBOARD`, curved like
  the sea, with `off` per vertex, the m from today's water) hides the ocean, drawn with a polygon offset as 0.18 m is
  below depth resolution past ~1 km. The look is in its fragment shader, from world position and `off`: plates by cell
  noise, cracks and leads (discard over the water), drifts, pools. `iceRubble`, mirrored in GLSL, says where it's piled:
  ridges, a shore belt, the edge's barrier. Rubble is instanced slabs and lumps by a hash of a world cell, near and far
  sets with budgets, drawn by `rubbleMaterial` (cloud, layers, snow and chips from world position); only range, frustum and budget read the camera. Waves: `params.ts` caps the wind and zeroes the
  swell, so surf and spray turn themselves off; `waterSpot`, `marineFor` and `createShips` give nothing afloat.
  `ctx.seaLevel` returns the ice's height, so what rests on the sea rests on it; sea smoke and spouts go in `params.ts`. Bergs (`sea.ice`) stay, frozen in.
  Off: `"seaIce": null`, or `props.seaIce: false` for the mesh alone.
- **Snow** (`snow.ts`, `props/snowCap.ts`, `props/iceFoot.ts`, 0.111, plans/SNOW.md): `pickSnow` on its
  own stream gives `params.snow` (`cover`, `iceFoot`). Nothing about the look reads the camera: the terrain
  shader (`snowLook`) and `snowCap` (a wrapper patch on a standard material, keeping the inner program key)
  work from world position, normal, height and noise. Caps: rocks, driftwood, plants (`amount` 0.8), marsh
  tufts. Hidden, keeping their draws (zero scale, by a hash of the spot): buried grass, mesh stones above the
  line. Flowers go; leaves go above cover 0.6. Mountains' line comes to the shore and islands whiten,
  woods showing through. `createIceFoot` walks stations along `a`: `footLine` (the spring high-water
  contour, walked from the sea) and `footShape` (noise of `a`) say what stands there; the camera only
  chooses section spacing, the view margin and the gap round itself. Off: `"snow": null`, `props.iceFoot: false`.
- **Leaf litter** (`props/leafLitter.ts`, 0.103): `litterFor()` from `Phenology.litter`, not random.
  `deciduousTrees()` reads the plants' meshes (`userData.plantKind`, `geometry.userData.deciduous`
  from `leaves()`). Each leaf is `treeLeaf(tree, i)`, a hash of the tree's position and its index,
  so a moving camera sees the same leaves: `leafShare()` thins them by size on screen (full to
  15 px, none under 3 px), then an even thinning keeps `MAX_LEAVES` (16,000 instances, 8 triangles,
  4 variants, no shadows cast). `litterField()` writes a soft disc per crown in view into a
  world-space R8 map (≤ 1024², ≥ 0.5 m a texel, empty rim), passed through `group.userData.litter`
  to `terrain.ts` `litterMap`: warped, in drifts, thinner on bare ground, above the high-tide mark.
  Distant forests on landforms and islands keep `canopyTint` (their ground doesn't show).
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
  depth-occluded) and flash glare, before exposure. **Beam shadows** (`beamLight`, SHADOWS.md phase 5):
  walking out along each beam from the lamp, the highest angle of land, sea surface (both dropping with
  the earth's curve) or island top passed so far is a horizon; the share of the beam's Gaussian profile
  above it is lit (½ erfc(horizon / 2.2°)), 16 log-spaced samples per beam from 25 m to 8 km. A cliff
  stops a beam at once, a slope eats it from below, the sea takes the lower half bit by bit. No shadow
  map: the lantern is a point and its beams fixed rays. Off: `passes.beamShadow: false`.
  **The lens turns over the shutter** (`setShutter`): a turn is the chart period × groups
  (`lensTurnSeconds`; `periodS` in `LighthouseParams`), so a shutter of t s sweeps 360° · t / turn.
  Under `SWEEP_MIN` (1.1°: every dusk, blue-hour and daytime-fog shutter, ≤ 0.03 s) the beams are
  frozen rays as above. Past it (the nights, 2–40 s) they're the time average: `sweptWindow` gives each
  azimuth's share of the sweep exactly (erf; whole turns light every azimuth alike, the part turn is
  centred on the frame's beams; a point's shade has a soft ±6° edge), baked with the beam shadows
  (`beamLight` every 5°) into a 720 × 16 half-float texture, azimuth × log distance. The shader finds
  where the view ray runs through the beams' layer (|y − lamp| ≤ tan 7° × distance, a double cone:
  up to two stretches, within 8 km) and sums 32 samples per stretch spaced evenly in angle round the
  lantern (equiangular: the 1/r² near the lamp drops out), offset per pixel and frame (interleaved
  gradient noise) so the sweep's and shade's edges leave grain, not bands. The flash is averaged the
  same way, on the CPU (`sweptFlash`). The shutter is the sky meter's (the frame median cancels out of
  `shutterOf`) × the frame's boost, set again after the first look restarts. Cost ~1% (≤ 4%).
  Off: `passes.beamSweep: false` (frozen, as before 0.129).

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
  logs on the storm ridge crest and its back slope, the older wrack line on the crest. Sargassum
  follows the month (`phenology.ts` `sargassumSeason`, a threshold on the same roll).
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
  ocean mirrors the 12 brightest as GGX point lights (hidden from the planar mirror). Night frames
  are a camera's (no night-vision grey, `whiteBalance.ts`): the lamps keep their colours.
