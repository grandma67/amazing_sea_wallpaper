# Nature plan: blossom, moss and weed, fireflies, animal seasons, desert bloom, fungi

Bring the remaining living things on a coast into the season. Research and numbers:
[NATURE.md](../NATURE.md). Builds on the seasons work ([SEASONS_PLAN.md](SEASONS_PLAN.md):
`phenology.ts`, `animalSeasons.ts`) and on PLAN_BIOMES phase 14 (the new animals). TODO items
22 (fireflies) and 24 (flowers by biome and month) are phases 1 and 3.

## Status

| Phase | What | Days touched (of 1095, est.) | Status |
|---|---|---|---|
| 1 | Blossom on plants we already draw: gorse, heather, rock rose, pōhutukawa, wattle, flamboyant | ~85 land days in a window; fewer with the plant in frame | planned |
| 2 | Moss by wetness and season; upper-shore weed by season (*Ulva* spring green, *Porphyra* winter band) | every boulder and rock-shore day a little; count the clear changes before building | planned |
| 3 | Fireflies and glow-worms on warm nights, by region | ≤ 56 eligible, ~15–25 in frame | planned |
| 4 | Seasons for PLAN_BIOMES 14 animals (polar bears and walrus on the sea ice's clock, waders, blacktip sharks, sea otters and kelp, monarchs) | per animal, counted when each is built | planned, with phase 14 |
| 5 | Atacama desert bloom, one year in three | ~3–6 | planned, needs a yes |
| 6 | Fungi near the camera | ~5 in frame (live mode: many) | planned, needs a yes |

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
2. **Day count:** the windows give only ~1 gorse, ~8 heather, ~0 pōhutukawa, ~2 wattle,
   ~13 rock rose and ~60 tropical days over three years: **single places bloom on very few
   days**. That is real (a place's bloom is a few weeks), but raise it with the user before
   building rows that land on almost no day.
3. Check the existing `FLOWERS` months against NATURE.md §1.1 (thrift [4, 8] agrees).

**Done when:** a forced `new-zealand-north` December framed day shows red crowns near and a red
tint on far cliffs; a Cornwall April overlook yellow gorse; a Scottish August heath purple; the
same places in another month unchanged (`diff.mjs --off '{"props":{"bloom":false}}'`, a contact
sheet, front- and backlit). Cost: vertex colour only, expect 0% render time.

**Tests:** `test/bloom.test.ts`: the table over every place × month (no sampling), hemisphere,
shares in 0..1, a crown fixed by its position, unchanged outside the window, off switches;
`realDays.test.ts` row "no bloom outside its months".

## 2. Moss and weed by season

**Moss** (`props/rocks.ts` `GROWTH`, rock shores' `terrain.ts`):

- `mossWetness(params)` in `phenology.ts`: 1 (green) on rain, drizzle and fog days and in wet
  climates; drying toward 0 in the Mediterranean dry season (the grass's `DRY_DAYS`), a
  savanna `drySeason`, and arid coasts; polar moss under snow is already hidden.
- Dry moss: mix `mossColor` ~50% toward a dark brown (NATURE.md §4, half because some mosses
  stay green). A uniform; no draws.
- **Key fix:** moss amount follows climate, not rock. Move `moss` from `GROWTH[biome]` to a
  climate factor (temperate, boreal 1; Mediterranean 0.4; tropical 0.6; subtropical 0.5; arid 0;
  polar 0.5 *(est.)*), keeping lichen and algae by biome. This changes the look on many days:
  **ask first**, and measure with `params.mjs --ref HEAD`.

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

**Still frame or streaks?** A short exposure shows dots, a long exposure streaks; the
wallpaper's night look decides (open question 3). In the move-around mode, `flash` blinks
(~0.5 s flash, 2–6 s cycle *(est.)*), `synchronous` blinks together, `glow` stays on.

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

## 5. Atacama desert bloom (needs a yes)

`desertBloomFor(params)`: on `atacama-peru` (local Sep–Nov, ±1 month) in a bloom year, chosen
once per year from `Random.derive(year, 'desert-bloom')` at ~1 in 3 *(13 events in 35 years)*.
Ground cover tinted magenta and purple at a distance, and `FLOWERS` rows (new kinds) on sand near
the camera. Touches only a handful of days over three years: raise before building.

## 6. Fungi (needs a yes; mainly for the move-around mode)

`fungiFor(params, rng)`: season by climate (NATURE.md §2: temperate Sep–Nov, boreal Aug–Oct,
Mediterranean Oct–Dec, tropical in the wet season, `drySeason` months none), ×1.5 on humid
weather *(est.)*. Kinds by the tree overhead (fly agaric under birch and pine, boletes, saffron
milk caps under Mediterranean pine, field mushrooms and fairy rings in grass). Instanced meshes
3–20 cm, base at y = 0, ~200 tris each, placed as leaf litter is (hash per cell under each crown;
camera reads only the range and budget).

A 10 cm cap shows only within ~15 m; a tree that near is in frame on ~14 of 1095 days, so a still
frame shows fungi on perhaps 5 days. Worth building now only with the move-around mode in mind
(CLAUDE.md "A move-around mode is planned"): **ask**.

## Open questions (one batch, before building)

1. **Blossom rows that land on almost no day** (gorse ~1, pōhutukawa ~0, wattle ~2 days in
   three years): build them for realism and the move-around mode, or only the rows with more days
   (flamboyant, rock rose, heather)?
2. **Moss by climate instead of biome** (phase 2) changes many days' rocks: yes or no?
3. **Fireflies at night: dots (short exposure) or short streaks (a long exposure photo)?**
4. **Desert bloom and fungi** (phases 5, 6): build now, or wait for the move-around mode?
5. **Towns:** should planted jacaranda and cherries ever appear (that needs a town or harbour)?

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
