# Plan: coasts, biomes and coastal weather

Brings the wallpaper's coasts closer to the world's: real places, stony beaches, rocky shores,
reef-fronted tropical beaches, tides, beach shapes that follow the waves, more sand colours, calm
lagoons, missing climates, the real sun for the place and date, and (later) coastal weather and
the animals these open up. Research: COASTS.md, REGIONS.md. How the built parts work:
ARCHITECTURE.md and `arch/`. Status 2026-10-31: phases 0–8 done; 9, 11, 12 planned; 10, 13,
14 later.

## Status

| # | Phase | Real world | State |
|---|---|---|---|
| 0 | Docs: research and gaps | – | done |
| 1a | Places, drawn before the sky | coasts are real places (latitude, climate, tide, animals) | done (0.39); every date reshuffled once |
| 1b | Coast-kind dispatch (`hasLand`/`hasBeach`/`hasSurfZone`, `coastKind` uniform) | – | done (0.40), no image change |
| 1c | Hemisphere-aware seasons | southern coasts have summer in Dec–Feb | done (0.41) |
| 2 | Stony beaches (material, ridges, stone shader, mesh stones, props follow) | ~¼ of beaches are pebble, shingle or cobble | done (0.42–0.47); bench −2% on stony scenes |
| 3 | Cheap tables: pink/red sand, high-Arctic tundra, Tierra del Fuego beech, marine layer, harmattan, haar | | done (0.48–0.52); haar already covered by the fog season |
| 4 | Beach shape from waves and grain (Wright & Short) | reflective / intermediate / dissipative by grain and swell | done (0.54, sourced 0.56); mixed beaches stop at a terrace; rips needed scouring below the profile; cusps reach ≥ ⅓ of their spacing |
| 5 | Tides | micro to mega ranges, springs and neaps | done (0.57); s = 0 is the foot of the high-tide beach with a berm; terrace above 2 m spring range; micro-tidal stay wave-dominated; tidepools are runnels on the terrace |
| 6 | Calm water (shelter mask) | calm water behind reefs and barriers | done (0.59); reefs use it, barriers later |
| 7 | Reef-fronted tropical beaches | most island beaches sit behind a fringing reef | done (0.60); ~48% of tropical beach days, not ~60% (continental places have few reefs); crest at about spring low water; crest white water is its own band |
| 8 | Rocky shore | ~36% of coast is rock, about half cliff-backed | done (0.62): 25.3% of days (38.7% of land days); [ROCK_SHORE.md](ROCK_SHORE.md); relief in the height function, softened with distance against grid aliasing |
| 9 | Tidal flats and salt marsh | 21% of coast is mud | done (0.64); [TIDAL_FLAT.md](TIDAL_FLAT.md); ~0.3% of days (the five places are 1.9% of days, not enough for ~3%) |
| 10 | Landforms: barrier lagoon, spit, fjord | | later, own plan |
| 11 | Climates: temperate, subtropical, polar | temperate oceanic and humid subtropical coasts | done (0.66–0.71): `climateBiome`, cloud leanings, wrack, crabs, seals, colonies and birds by climate; flat places get no mountains or high islands |
| 12 | The real sun: polar night, midnight sun | | done (0.72): from 63°; Dec–Jan night and blue hour 18% → 30% of days; Svalbard (76–80°) December is night only (noon below −6°), so the twilight-noon render is Tromsø's latitude |
| 13 | Weather extras: offshore wind, snow and ice foot, glowing surf, sea-breeze Cu | | later, own plan |
| 14 | Animals: sea otters, walrus, polar bears, waders… | | later |

Open from done phases (ARCHITECTURE.md "Known issues"): beach-state share retune (ask first;
COASTS.md "Beach state and tides"), no trough behind longshore bars, step-like emerged rip channels
at low tide, waves re-forming at full height behind bars, straight reef shelter (passes don't let
swell in).

Dependencies: 8 needs 2, 5; 9 needs 5, 8; 10 needs 6, 8; 11 needs 1, 3; 12 needs 1; 13 needs 11,
12; 14 needs 5, 7, 8, 9, 11. Phase 8 and the later 10 and 13 are each bigger than phases 0–3
together: before starting one, write its own plan in `knowledge/plans/` (8: rock-shore terrain and
preview; 10: one per landform; 13: snow and ice foot apart from the rest) and keep only a summary
and a link here. Stopping after 12 leaves a complete result.

## Constraints in today's code

- **Terrain is one cross-section:** `terrainHeightAt` is a function of `s` (plus noise), branched
  by coast kind. Shapes that vary along the shore in plan view (spit, lagoon behind a barrier,
  fjord walls) need separate heightfield meshes (like `islands.ts`).
- **Time of day is a weighted category** (main stream, step 3 of the draw order), not the sun of
  a real place and date; eclipses override it after the draw.
- **The sun's azimuth is relative to the camera:** `relSunAz` is drawn for framing and added to
  the random `headingDeg`, so no day has the sun at its real compass bearing.
- **Latitude drives more than the atmosphere:** `scene.ts` (atmosphere anchor), `noctilucent.ts`,
  `seaHaze.ts`, `skyEvents.ts` (tropical ≥ 10°).

## Rules for every phase (beyond CLAUDE.md)

- **Old dates may change on purpose, never by accident** (decision 5): a phase may change the days
  it is about, even all of them, if that is more realistic or simpler; no dummy draws or
  byte-identical tests just to keep old pictures. Own streams and "draw, then force" stay, so
  nothing cascades and `diff.mjs --off` compares the same scene. Pure refactors are checked by
  params and `bench.mjs` pixel diff ≤ 1/255. Each changelog row says which days change.
- **Place data lives in `places.ts`:** a new per-place choice (coast kind, …) is a field there with
  a region default, not a table keyed by biome × ocean.
- **Terrain and shore phases write the geometry down before code:** where s = 0 sits, the
  profile's pieces and how they join (heights and slopes at each join), what `distanceToWater`,
  `waterline` and `beachLines` mean afterwards, and which readers in arch/COAST.md "Coordinates
  and heights" and "A new seabed or shore profile" change. Check drawn vs reached numbers in
  `profile.mjs` (a forced spec can sketch it) before any shader work. Add a **forced extremes**
  table: for low, mid and high tide (springs) × each composition, where the camera stands, what
  must stay dry (marsh, berm, plants) and its height against the spring high water + run-up; then
  `expectDryCameras` in the tests and the `profile.mjs` dry-land check (phase 9's marsh, drawn for
  mid tide, drowned the camera at spring high water and again when the beach width was capped).
- **Research per phase:** 1–2 searches for the phase's numbers before code, recorded with their
  source in REGIONS.md or COASTS.md. Cite only what was read (phase 7 had to take a figure out).
  Check this plan's own physical claims with the code before building on them (phase 12's
  "Svalbard noon blue-hour glow" is impossible at 78°: the noon sun is −11°).
- **Biome-keyed tables:** before a phase, read ARCHITECTURE.md "Biome, climate or place" and
  probe its leftovers on the phase's places (phase 11 found Florida's mountains only in renders).
- **Props are their own step:** a new prop (salt-marsh tufts, tidepool life) gets its own
  checklist line and commit after the terrain and water work.
- **Shares:** test targets from `params.mjs --expect`; after the first passing test, `params.mjs
  --ref HEAD --stats` on every choice the phase touches (a ⚠ is the point of the phase or a bug,
  decided before rendering).
- **Budget:** render time within ~10% per phase (`bench.mjs`); meshes < 100k tris; instanced
  near-camera detail ≤ ~0.5M tris for everything added here together (stones have their own
  ~1M). Measure the terrain shader each time it grows; branch on coast kind so one profile runs
  per day.
- **Docs per phase:** changelog row naming which days change; ARCHITECTURE.md/`arch/`,
  LESSONS.md, REFERENCES.md; COASTS.md shares re-measured over 2024–2026; REGIONS.md new place
  fields; CLOUDS.md, ANIMALS.md as touched; SCENE_SPECS.md fields and fixed dates for new looks;
  CLAUDE.md views list for new coast kinds (`rock-shore`, `tidal-flat`); `scenes/<phase>.json`.

## Remaining phases

### 8. Rocky shore ([plans/ROCK_SHORE.md](ROCK_SHORE.md))

~38% of land days (≈ 25% of all days) become a rocky shore, from the place's `coast` weights
(stream `'coast-kind'`; fjord, North Atlantic and North Pacific coasts ~55%, Mediterranean ~40%,
tropical, desert and barrier coasts 10–20%). Kinds: wave-cut platform, boulder shore, cliff top
(a third; the overlook). The rock relief (bedding ledges, joint gullies, boulders) lives in the
terrain height function so every reader agrees; the surf breaks on the platform edge by depth,
with spray bursts along it. Props follow the plan's table (no sand animals, rock haul-outs,
wrack in gullies). Spec `coast: "rock-shore"`, `rockShore`.

### 9. Tidal flats and salt marsh ([plans/TIDAL_FLAT.md](TIDAL_FLAT.md))

Coast kind `tidal-flat` from the place's `coast` weights in wadden-north-sea, morecambe-bay,
mont-saint-michel, yellow-sea (~0.5) and fundy (0.25), when the tide is below mid; at or above
mid the same day is a beach with a salt marsh behind (`saltMarsh`). The five places are only
1.94% of days, so flats are ~0.3% of days, not ~3%. Terrain: s = 0 the marsh edge at mean high
water, a straight km-wide flat (1:2000–1:300) to spring low water, meandering creeks in the
height, the sea a far line; the marsh a level platform at spring high water with a low cliff,
seasonal colour and tufts. Spec `coast: "tidal-flat"`, `saltMarsh`.

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

**Later** (after phase 12; each gets its own plan): phase 10 (large terrain work for ~10% of a
few places' days), 13 (in the order listed), 14; rias, beachrock platforms beyond reefs and
mangrove shelter from barriers follow from 8 and 10.

**Skipped:**
- **Glowing lagoon** (Puerto Rico bays, Florida Indian River, Jamaica): needs a calm lagoon in
  view, at night, in places the table doesn't have; almost never seen. Revisit if phase 10
  lagoons exist and a `puerto-rico` place is added.
- **A real compass sun on every day** (evening sun in the west): ties framing, heading and coast
  orientation together; a separate piece of work (ARCHITECTURE.md "Ideas").
- **"After a storm" beach states:** each date is generated on its own, with no history; storm
  days and winter months stand in (phase 4).
- **Toyama's glowing firefly squid** (Mar–Jun): not plankton; a separate feature if wanted.

## Wrap-up (across phases)

- `scenes/coasts.json`: one spec per new coast, climate and weather, for regression renders.
- SCENE_SPECS.md fixed dates for new looks (PEI red beach, Wadden low tide, Maldives reef,
  California June gloom, Svalbard polar night and midnight sun).
- README.md feature list, if it lists coasts or biomes.

## Decisions (2026-10-23)

Numbered; other docs cite them ("decision 4").

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

Shared with COASTS.md (coast types, cliffs, beach states, sand colours, tides, reefs, landforms,
machair) and REGIONS.md. Only here:
[Beach cusps, Trafalgar](https://scimar.icm.csic.es/index.php/secId/6/IdArt/3912/index.php),
[Flash rips between cusps](https://www.scienceofthesurf.com/rip-of-the-month-2018/june-2018-rotm114-laguna-beach-california),
[EarthDate: Beach reading](https://www.earthdate.org/episodes/beach-reading),
[Bioluminescent beaches (MBL)](https://new-www.mbl.edu/news/americas-5-best-bioluminescent-beaches-islands),
[Irish coastal habitats](https://www.noticenature.ie/wp-content/uploads/2016/06/coastal-habitats.pdf).
