# Nature plan: blossom, moss and weed, fireflies, animal seasons, desert bloom, fungi

Bring the remaining living things on a coast into the season. Research and numbers:
[NATURE.md](../NATURE.md). Builds on the seasons work ([SEASONS_PLAN.md](SEASONS_PLAN.md):
`phenology.ts`, `animalSeasons.ts`) and on PLAN_BIOMES phase 14 (the new animals). TODO items
22 (fireflies) and 24 (flowers by biome and month) are phases 1 and 3.

## Status

| Phase | What | Days touched (of 1095, est.) | Status |
|---|---|---|---|
| 1 | Blossom on plants we already draw, the common rows first: flamboyant, rock rose, heather | ~81 land days in a window; fewer with the plant in frame | planned |
| 2 | Moss by realistic rules on rock **and tree trunks** (wetness, spray, water-fed faces); upper-shore weed by season | every boulder, rock-shore and humid-forest day; count the clear changes before building | planned |
| 3 | Fireflies and glow-worms on warm nights, by region, short flash streaks | ≤ 56 eligible, ~15–25 in frame | planned |
| 4 | Seasons for PLAN_BIOMES 14 animals (polar bears and walrus on the sea ice's clock, waders, blacktip sharks, sea otters and kelp, monarchs) | per animal, counted when each is built | planned, with phase 14 |
| 5 | Atacama desert bloom, one year in three: flowers near the camera, colour on far land | ~3–6 | planned |
| 6 | Fungi near the camera; fairy rings as the far-off sign | ~5 in frame (live mode: many) | planned |

## Answers (2026-11-07)

1. **Common flowers first:** build the rows that land on the most days (flamboyant ~60, rock
   rose ~13, heather ~8). Gorse, pōhutukawa and wattle stay researched in NATURE.md for later.
2. **Moss follows nature's rules,** whatever they key on: if that's the weather, so be it. That
   means climate wetness, today's wetness, spray from the sea and where water runs (NATURE.md
   §4), not the rock's biome. Trunks get moss too.
3. **Short streaks:** the scene isn't a long exposure (waves and leaves are sharp), so a firefly
   draws as the trace of **one flash**: ½–1 s at walking-pace flight, ~0.15–0.6 m, J-shaped for
   *Photinus*. That's what the eye sees, not a camera's long-exposure effect. Glow-worms and
   perched fireflies are dots.
4. **Near the viewer, and far-off land coloured:** desert bloom draws flowers near the camera
   and tints far ground cover magenta (a real bloom colours whole hillsides). Fungi stay near
   the camera. A mushroom can't colour land from far off, but **fairy rings** (rings of darker,
   lusher grass, metres across) can, so they're the far-off sign of fungi in grass.
5. **No towns:** confirmed, the code draws none. Only their light glow on the night horizon
   (`nightGlow.ts`) and the lighthouse exist. Jacaranda and planted cherries stay out.

Every count above is from `params.mjs --stats` windows (place, month, coast not open sea) before
the "is it in frame" filter; re-count each one with `--rendered` before building.

## Decisions (proposed)

- **Not random where it follows the calendar.** Blossom, moss, weed and the animal seasons
  follow date, climate, place and hemisphere: thresholds and colours, no new draws (as
  phenology). Which crown is in bloom comes from `hash()` of its position, like autumn leaves.
- **New randomness gets its own stream:** fireflies (`ctx.rng('fireflies')`), the bloom year
  (`Random.derive(yearSeed, 'desert-bloom')`, so every day of a year agrees), fungi
  (`ctx.rng('fungi')`). Nothing draws from the main `rng`.
- **Keys** (ARCHITECTURE.md "Biome, climate or place"): flowering by **place** (gorse, heather,
  pōhutukawa, wattle are a few places' plants) or **climate** (rock rose, flamboyant); moss
  wetness and fungi seasons by **climate** (weather); firefly regions by **place**; the
  rock's own growth colours stay by **biome**. Add each table to that list in ARCHITECTURE.md.
- **Months:** climate rows in northern-equivalent months (`monthInSeason`), place rows in local
  calendar months (as turtle nesting), as NATURE.md's convention.
- **Off switches and specs:** `props.phenology: false` turns off phases 1, 2 and 5 together (they
  are phenology); each also gets its own: `props.bloom`, `props.fireflies`, `props.fungi`, spec
  fields `bloom`, `fireflies`, `desertBloom`, `fungi` (SCENE_SPECS.md "Adding a spec field").
- **Planted trees stay out:** jacaranda and planted cherries belong to towns; no town is drawn.
  Revisit if towns or harbours appear (NATURE.md §1.2).
- **Ready for the move-around mode:** what a thing is comes from its world position (a crown's
  hash, a fungus cell's hash); only the choice of what to draw reads the camera
  (`props/leafLitter.ts` pattern).

## 1. Blossom on plants we already draw (TODO 24)

**Module:** `phenology.ts` gains `BLOOM` (table) and `bloomFor(kind, phen, place)` → `{ share,
colors } | undefined`; `PlantSeason` gains `bloom`. `props/trees.ts` `leaves()` already recolours
a hashed share of leaves for autumn: add a second hashed share for blossom (the outside of the
crown first, as autumn). `canopyTint` mixes the bloom colour into distant forest and scrub, so a
pōhutukawa cliff reads red from far off.

| Row | Kind | Key | Months | Share of crowns × of leaves | Colour (linear, est.) |
|---|---|---|---|---|---|
| Gorse | `bush` | places: Atlantic Europe temperate list; NZ, Tasmania, Chile ×0.3 | peak Apr–May (full), Jan–Jun (×0.3), else ×0.05 | 0.7 × 0.6 | yellow |
| Heather | ground cover tint, not a mesh | heath places | Jul–Sep, peak mid-Aug | ground cover only | purple-pink |
| Rock rose | `bush` | Mediterranean climate, Mediterranean Sea and Portugal | May–Jul | 0.4 × 0.25 | white, pink |
| Pōhutukawa | `broadleaf` | `new-zealand-north` (local) | mid-Nov – early Jan, peak 15 Dec – 5 Jan | 0.8 × 0.7 | crimson |
| Wattle | `bush` | `east-australia`, `tasmania`, `sw-australia` (local) | Aug–Sep, Jul and Oct ×0.4 | 0.3 × 0.8 | bright yellow |
| Flamboyant | `broadleaf` | tropical climate | May–Sep north, Nov–Jan south *(est.)* | 0.12 × 0.8 | scarlet |

Every share is *(est.)*. Before code:

1. **Reference photos** (2–3 each): pōhutukawa on a cliff (near and from ~300 m), gorse on a
   headland, flamboyant on a tropical beach. Say what to match; photos decide crown shares.
2. **Day count:** the windows give ~60 tropical, ~13 rock rose and ~8 heather days over three
   years (gorse ~1, pōhutukawa ~0, wattle ~2: deferred, answer 1). Re-count with
   `--rendered` and the plant in frame.
3. Check the existing `FLOWERS` months against NATURE.md §1.1 (thrift [4, 8] agrees).

Built first (answer 1): flamboyant, rock rose, heather. Gorse, pōhutukawa and wattle rows wait.

**Done when:** a forced tropical June framed day shows scarlet crowns near and a red fleck in
far forest; a Mediterranean May beach white and pink rock roses; a Scottish August heath
purple; the same places in another month unchanged (`diff.mjs --off '{"props":{"bloom":false}}'`, a contact
sheet, front- and backlit). Cost: vertex colour only, expect 0% render time.

**Tests:** `test/bloom.test.ts`: the table over every place × month (no sampling), hemisphere,
shares in 0..1, a crown fixed by its position, unchanged outside the window, off switches;
`realDays.test.ts` row "no bloom outside its months".

## 2. Moss and weed by season

**Moss** (`props/rocks.ts` `GROWTH`, rock shores' `terrain.ts`, `props/trees.ts` bark), by
NATURE.md §4 (answer 2):

- **Amount (climate, a place field where one place differs):** `MOSS` by climate: temperate
  and boreal 1, polar 0.5, tropical 0.6, subtropical 0.5, Mediterranean 0.4, arid 0 *(est.)*;
  the foggiest, wettest places higher (`se-alaska`, `british-columbia`, `pacific-northwest`,
  `norway-west`, `ireland`, `scotland`, `new-zealand-south`, `patagonia-fjords`, `tasmania`
  *(est.)*). Replaces `GROWTH[biome].moss`; lichen and algae stay by biome (they follow the
  rock and the sea). Add `MOSS` to ARCHITECTURE.md "Biome, climate or place".
- **Spray:** none in the splash and lichen zone, rising with height above the sea and distance
  from the shore (rocks: their `s` and height; rock shores: above the lichen bands), lower on
  exposed coasts (by swell) *(est. distances, ~10–30 m and ~5–15 m up)*. Trees within the
  spray belt: lichen-grey bark instead of moss (Scilly).
- **Face:** rocks: upward faces and the crevices water runs into. Trunks: the lower trunk, on
  the side the tree leans (stemflow), denser near the base, from a hash of the tree, never "the
  north side".
- **Colour by today's wetness** (`mossWetness(params)`, `phenology.ts`): green on rain,
  drizzle and fog days and through wet seasons; ~50% toward dark brown in the Mediterranean dry
  season (`DRY_DAYS`), a savanna `drySeason` and on arid coasts. Under snow: hidden already.
- No draws: amount and colour are uniforms and vertex colours. Changes the look on many days
  (decided: answer 2); report it with `params.mjs --ref HEAD` and `diff.mjs` on a temperate
  rock shore, a Mediterranean August boulder beach and a British Columbia framed forest.

**Upper-shore weed** (`terrain.ts` rock-shore "weed, mussels and barnacles" band, rocks' algae
band):

- Spring: a brighter green fleck (*Ulva*) in Mar–May on temperate and boreal rock, ×0.3 the rest
  of the year *(est.; sources conflict, NATURE.md §5)*.
- Winter: a dark purple-brown band (*Porphyra*) in the littoral fringe Nov–Apr on temperate and
  boreal Atlantic and Pacific rock; all year in boreal.
- Subtle by nature: done = `diff.mjs --crop` before/after on a rock-shore platform view, January
  and April.

**Tests:** wetness by climate and month, both hemispheres; the shader's uniforms over every
climate; `npx vitest run test/glsl` after the edit.

## 3. Fireflies and glow-worms (TODO 22)

**Choice:** `firefliesFor(params, rng)` in `props/fireflies.ts` (added to `props/choices.ts`):

- **Where:** a place table `FIREFLIES` from NATURE.md §3: kind (`flash` flying, `glow` steady
  in grass, `synchronous` on mangrove trees), local months, peak. Regions: Atlantic Europe
  temperate (glow-worm Jun–Jul, May–Sep ×0.3), Mediterranean Sea (May–Jun), eastern North
  America (Jun–Jul, May and Aug ×0.4), Japan and Taiwan (May–Jul), South-East Asia mangroves
  (all year, `mangroves` present).
- **When:** night and late blue hour; ×0.3 under a moon over 70% lit and above the horizon;
  none in rain, storm (`stormy`), fog *(est.)* or wind over ~4 m/s *(est.)*; none on snow.
- **On what:** land with vegetation within ~60 m in frame: grass and bushes for `flash`, the
  grass edge for `glow`, mangrove crowns for `synchronous`. Never over sand, rock or water.
- **How many:** 20–200 lights in view, the peak month's upper end *(est.)*; a chance per eligible
  night ~0.6 at the peak *(est.)*.

**Geometry and light:** additive points or sprites (as `props/shipLights.ts`), not lights that
light the scene; 0.5–3 m above the plants (flash), on the ground (glow), in tree crowns
(synchronous). Colour ~565 nm yellow-green. Their brightness is the open question: measure a
real firefly's luminance (research, 1–2 searches) and run it through the night exposure
(`exposure.ts`) so a dot is neither clipped nor lost; check with `params.debug.probe`.

**Streaks (answer 3):** each `flash` light is the trace of one flash, not a long exposure: a
thin additive ribbon (a few quads, or a line strip with width) ~0.15–0.6 m long, J-shaped
(the upswing of a U arc: bottom first, then up), brightest in the middle and fading at both
ends; a hashed share (~⅓ *(est.)*) are mid-flash in any frame, so the rest are off. `glow`
and `synchronous` are dots. The 16 render frames see the same streak (it's geometry, not motion
blur). In the move-around mode `flash` flashes ½–1 s every 5–7 s along its arc, `synchronous`
together, `glow` stays on.

**Before the first render:** count eligible days with `--rendered` and `ctx.visible` (the 56
eligible days shrink once vegetation must be in frame), then `scripts/mesh.mjs` for the sprite,
then a forced spec (`fireflies: 'flash'`, `timeOfDay: 'night'`, `eclipse: null`) beside real
days (`snapshot.mjs --where 'p => p.props.fireflies != null' --sample 8`).

**Tests:** `test/fireflies.test.ts`: the table over every place × month; none by day, in rain,
on open sea or snow; fewer under a full moon (`expectShare`); placements over vegetation only;
deterministic; off switch (`propSwitches.test.ts`), spec field (`sceneSpec.test.ts`).

## 4. Animal seasons for PLAN_BIOMES phase 14

Build with each animal of phase 14 (its own plan), with the season in `animalSeasons.ts`:

| Animal | Season rule | Reads |
|---|---|---|
| Polar bear | ashore on days without sea ice, on the ice (floes, fast ice) when there is ice; rare (~2% of eligible days) | `params.seaIce` |
| Walrus | coastal haul-out on ice-free days from Aug to the freeze; on floes when there is ice | `params.seaIce`, local month |
| Sea otters and kelp mats | otters all year; floating kelp canopy full Jun–Sep, ×0.4 Dec–Mar (winter storms) | month |
| Waders | flocks on passage (Mar–May, Aug–Oct; peak Aug) and in winter on temperate and Mediterranean flats and beaches; summer ×0.15; polar Jun–Jul: scattered pairs, no flocks | climate, month |
| Blacktip sharks | `florida-carolinas` mid-Jan – Mar (peak Feb–Mar), fins within 20–50 m of shore | place, local month |
| Reef blacktips | reef lagoons, all year | – |
| Monarchs (new) | `california` late Oct – Feb, clustered on eucalyptus and pine near the camera; very rare in frame | place, month |

After each: `node scripts/animals.mjs`, paste into ANIMALS.md with its rule in "Seasons".

## 5. Atacama desert bloom (answer 4)

`desertBloomFor(params)`: on `atacama-peru` (local Sep–Nov, ±1 month) in a bloom year, chosen
once per year from `Random.derive(year, 'desert-bloom')` at ~1 in 3 *(13 events in 35 years)*.
**Near the viewer:** new `FLOWERS` kinds (magenta *Cistanthe*, yellow, white) on sand and
ground near the camera, as the beach flowers are placed. **Far land:** the terrain's ground
cover and the landforms' and islands' lower slopes tinted magenta-purple by the bloom's
strength (as `canopyTint` and `groundCoverTint` do for autumn and dry grass), so distant hills
read in colour. Touches a handful of days over three years (decided: realism).

## 6. Fungi (answer 4: near the viewer; mainly for the move-around mode)

**Far-off sign:** fairy rings in grass, rings of darker, lusher grass 2–20 m across *(est.)*,
in the terrain's ground-cover colour (a world-space hash per cell, like `litterMap`), seen from
tens of metres. Present all year as dark rings (the grass lives on), with the mushrooms on the
ring only in the fruiting season *(est.)*. Mushrooms themselves never tint far land.

`fungiFor(params, rng)`: season by climate (NATURE.md §2: temperate Sep–Nov, boreal Aug–Oct,
Mediterranean Oct–Dec, tropical in the wet season, `drySeason` months none), ×1.5 on humid
weather *(est.)*. Kinds by the tree overhead (fly agaric under birch and pine, boletes, saffron
milk caps under Mediterranean pine, field mushrooms and fairy rings in grass). Instanced meshes
3–20 cm, base at y = 0, ~200 tris each, placed as leaf litter is (hash per cell under each crown;
camera reads only the range and budget).

A 10 cm cap shows only within ~15 m; a tree that near is in frame on ~14 of 1095 days, so a still
frame shows mushrooms on perhaps 5 days; fairy rings show on more grass days. Built for realism
and the move-around mode (CLAUDE.md "A move-around mode is planned").

## Still open

- Fairy rings' size, density and how dark: reference photos and 1–2 searches before phase 6.
- Moss's spray distances and the wettest places' factors are *(est.)*: look for a measured moss
  or lichen zonation profile (height above the sea) before phase 2's numbers are final.
- Firefly flight speed and luminance: research before phase 3's render.

## Checks (all phases)

- Before the first render, per phase: the docs named in CLAUDE.md §1 opened (ARCHITECTURE "Draw
  order in `buildParams`" and "Biome, climate or place", `arch/PROPS.md`, LESSONS.md), real sizes
  from photos, the day count with `--rendered`.
- `diff.mjs` for visibility with each off switch on a clear and a cloudy day; real days in the
  first render round; `bench.mjs` (phase 3 may cost; every other phase should be ~0%).
- `npm test` and `npx tsc --noEmit`; `params.mjs --ref HEAD` for the changelog row (phase 1, 2
  and the animal seasons should change only their own days).
- Docs: changelog.md, ARCHITECTURE.md (the new tables in "Biome, climate or place"),
  `arch/PROPS.md`, SEASONS.md pointer, ANIMALS.md, SCENE_SPECS.md, REFERENCES.md.
