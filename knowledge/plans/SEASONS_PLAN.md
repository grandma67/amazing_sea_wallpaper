# Seasons plan

Make plants and animals follow the day's season the way the sky already does. Research and
numbers: [SEASONS.md](../SEASONS.md). Everything reads the season in the day's own hemisphere
(`seasons.ts`) and is keyed by **climate** (weather → `place.climate`, ARCHITECTURE.md "Biome,
climate or place"), with place fields only for one place's difference.

## Status

| Phase | What | Status |
|---|---|---|
| 1 | Phenology module: leaves, grass, ground cover by climate and day | done (0.98) |
| 2 | Trees in autumn and winter: turned leaves, leaf fall, bare crowns; fresh spring green | done (0.98) |
| 3 | Grass, ground cover and distant land by season (dry Mediterranean summer, brown boreal and tundra) | done (0.98) |
| 4 | Animals: colonies in season, humpback migration, seal haul-out, winter dormancy (ghost crabs, shore crabs, spiny-tailed lizards), geese and ducks by climate and season, polar gulls | done (0.98) |
| 5 | Seasonal mountain snow line (incl. winter snow on summer-bare mountains) | done (0.99) |
| 6 | Sargassum season (Caribbean and subtropical Atlantic wrack Apr–Sep) | done (0.100) |
| 7 | Tropical dry season: savanna coasts brown in the dry months (`drySeason` per place) | done (0.101, more coasts 0.102) |
| 8 | Leaf litter: real leaves under deciduous trees near the camera, litter colour on the ground further off | done (0.103) |
| 9 | Snow cover and ice foot: built as PLAN_BIOMES 13 | done (0.111), [SNOW.md](SNOW.md) |
| 10 | Sea ice: the Baltic, then every freezing coast | done (0.114, 0.115), [SEA_ICE.md](SEA_ICE.md) |

Next: the drawn snow lines (open problem 1, if approved).

## Open problems

As of 0.102 (2026-11-06).

**To decide**

1. **Drawn snow lines too low (`pickLandform`, biome-keyed; needs a yes, it changes the look on
   many days).** Phase 5 scales these lines but doesn't fix them.
   - Tropical: 32 of 61 tropical landform days have snow below 3 km. Even Mauna Kea's lowest
     recorded snow is about 2800 m, and phase 5 leaves tropical lines as drawn.
   - Nordic biome on temperate coasts: 0.35–0.6 of the height is low. Ireland comes to ~430 m in
     January (after ×0.6) and west Norway ~630 m in late August.
2. **Dry coasts left out or wrong within a place:** `mainland-se-asia` and `philippines` have no dry
   season, and Madagascar's east coast dries with Mozambique (SEASONS.md §2.2). Separating them needs
   more than latitude.

**Not checked in a render**

4. **Phase 5:**
   - Tropical, arid and southern-hemisphere days were tested, not rendered.
   - The plan's January and August comparison wasn't rendered: each date draws a different
     mountain, so on/off pairs were used instead.
   - The stronger snow edge was rendered only on Kamchatka and British Columbia, not Ireland or
     Norway.
   - The higher autumn start (1.3 × the peak) came after the last render; it moves bare mountains'
     line from November to mid-January.
5. **Distant woods' autumn tint** (`canopyTint` on landforms and islands, 0.98): tested in numbers
   only.

**Estimates to replace with research**

6. **`SNOW_SEASON`:** only the temperate winter line has a source (the Alps' ~800 m, a
   station-based cover median, so a rough guide). The other climates, the ×0.7, ×0.85 and ×1.2
   factors and the minimum heights are *(est.)* in SEASONS.md §4.

**Known gaps until later phases**

8. **Still not modelled:** larch (conifers stay green; no phase), and leaves in the wrack (phase 8
   left them out: the evidence varies from negligible to dominant by beach, §2.5 in SEASONS.md).

**From phase 6**

9. **Sargassum in the Adriatic (a bug from before phase 6, needs a yes):** `drawDebris` tests
   `ocean === 'atlantic'`, which the Mediterranean Sea's places also are, so `adriatic`'s subtropical
   days get golden sargassum (2 of 20 real sargassum days before phase 6, 1 now). It should
   probably be seagrass.
10. **West Africa and northeast Brazil have no season:** West Africa's peaks are from a preprint
    and Brazil has no source, so both keep sargassum all year (SEASONS.md §2.4). Together they are
    9 of the 15 sargassum days left.
11. **The heaps' look:** in the 2026-10-29 render, sargassum reads as smooth tan mounds, not a
    tangle of little floats. Phase 6 only changes when it's there.

## Decisions

- **Phenology is not random.** It follows the date, climate and hemisphere, so there is no draw
  and no new stream. The tree builders keep every draw they made before: a leaf's colour and
  whether it is still on come from `hash()` of its position, so a tree's shape never changes with
  the season, only its leaves. Plants outside autumn, winter and spring render as before; the
  snow line also moves in late summer (phase 5).
- **Off switch:** spec `props.phenology: false` (→ `params.overrides.phenology`) gives every day the
  summer look and the snow line as drawn, for `diff.mjs --off '{"props":{"phenology":false}}'`.
- **Animals change only on the days they're about:** out-of-season days lose or gain an animal.
  Decisions keep their draws; the season is an extra threshold on a draw that's already made, or
  its own stream (`'pinnipeds/season'`).
- **Out-of-season colonies keep the rock:** the guano-white rock stays, without birds in the air
  (only the circling birds are drawn; penguins and tropical boobies are there all year).
- **Dates by climate, not latitude** (Swedish data: birch turns *later* further north), with
  Europe yellower and eastern North America and East Asia redder (`AUTUMN_RED` places).

## 1. `src/phenology.ts` (pure, no three.js)

```ts
seasonDay(day)            // seasons.ts: northern-equivalent day of year (south +182)
phenologyFor(params)      // → Phenology, or SUMMER when overrides.phenology === false
interface Phenology {
  on, turned, fresh               // deciduous leaves: share still on, share turned, spring green
  dry: number                     // grass and ground cover: 0 green … 1 straw
  tropical: { on, turned }        // the tropical almond's own clock
  climate, placeId, south
}
deciduousShare(kind, phen)        // share of that kind's trees that are deciduous here
autumnColors(kind, phen)          // the turned leaves' colours (yellow; redder in AUTUMN_RED places)
plantSeason(kind, phen)           // what a plant builder gets; undefined when it looks as in summer
canopyTint(foliage, phen, plants) // a distant forest's colour this season, from the day's plant pool
groundCoverTint(cover, phen)      // ground cover dried toward straw
seasonalSnowLine(land, climate, day) // phase 5
```

Leaf curve per climate (SEASONS.md §2.1): `on` = 1 until peak colour, falling to 0 at "bare",
rising from leaf-out to "full"; `turned` from first tint to midway between peak and bare;
`fresh` in the three weeks after leaf-out. Tropical almond: its own curve in local Jan–Feb and
Jul–Aug. Grass `dry` by climate (§2.2).

## 2. Trees

- `Builder = (rng, foliage, season?) => BufferGeometry`; `leaves()` takes the season: each tree
  is deciduous with the kind's share (hashed per tree), each leaf is skipped with 1 − `on` and
  coloured from `autumn` with `turned` (hashed per leaf; the top and outside of the crown turn
  first). Kinds: `broadleaf`, `birch`, `bush`.
- Bare trees keep their limbs; the crown is twigs only, which is what a winter oak looks like at
  wallpaper size.
- Done when: a temperate framed day in late October shows orange crowns; a December day bare
  ones; a boreal September yellow birches; a Mediterranean day unchanged.

## 3. Ground

- `grass()`: its straw share rises with `dry` (no new draws).
- Terrain `groundCover` mixes toward straw with `dry`.
- Landforms and islands: the forest band's colour through `canopyTint` (deciduous share by the
  climate's broadleaf and birch weights).
- Done when: Mediterranean August beaches have golden grass behind them; April green.

## 4. Animals

| Decision | Change | Where |
|---|---|---|
| Colony birds in the air | none out of season (`colonyInSeason`) | `props/colony.ts` |
| Humpbacks | ×0.1 out of season by climate (`humpbackSeason`), Oman all year | `props/marine.ts` |
| Seals | harbour seals ×0.5 in winter, ×0.8 in spring and autumn; southern elephant seals ×0.1 local May–Aug (own stream) | `params.ts` `pickPinnipeds` |
| Ghost crabs (non-tropical, non-arid) | none out Dec–Feb and burrows ×0.3; half Nov, Mar, Apr | `props/shoreLife.ts` |
| Shore crabs | none Dec–Feb (offshore) | `props/shoreLife.ts` |
| Spiny-tailed lizards | none Nov–Feb (brumation) | `props/wildlife.ts` |
| Geese, ducks | presence by climate × month (`waterfowlSeason`) | `props/migratory.ts` |
| Gulls | polar climate Nov–Mar ×⅓ | `props/birds.ts` |

## 5. Seasonal snow line (done, 0.99)

`seasonalSnowLine` (`phenology.ts`, table `SNOW_SEASON`) runs after `pickLandform`'s draws, by
climate and date; numbers in SEASONS.md §4. Off with `props.phenology: false` (the line as drawn).
What changed from the first plan, after checking its numbers:

- A flat "non-desert above ~1500 m" would have whitened tropical peaks, so the minimum height and
  the amount are by climate, and tropical and arid lines stay as drawn.
- A winter line of 0.7–0.9 of `height` misses most ranges (their peaks reach ~0.8 of it) and sits
  far too high on tall volcanoes, so summer-bare mountains get a winter altitude in metres, capped
  at 0.85 of the real peak.
- Low lines crossed the slopes in a straight edge, so the snow edge's noise is stronger
  (`props/landforms.ts`).

## 6. Sargassum season (done, 0.100)

`sargassumSeason` (`phenology.ts`) is a threshold on the roll `wrack()` already makes (`props/debris.ts`):
full Apr–Sep, ×0.2 Oct–Mar, calendar months in both hemispheres. No new draws, and the amount is
still drawn, so the day's other debris choices stay the same (coconut placement can still shift,
because it follows the wrack's meshes on the same stream). `phenology: false` and a forced
`props.debris.wrack` keep the wrack. Numbers: SEASONS.md §2.4. Tests: `test/debris.test.ts`.

What changed from the first plan: West Africa and northeast Brazil keep sargassum all year, since
West Africa's peaks differ from the Caribbean's and we found no calendar for Brazil.

## 7. Tropical dry season (done, 0.101)

`Place.drySeason` (`places.ts` `DRY_SEASON`) feeds `Phenology.dry` through `savannaDry`
(`phenology.ts`): `dry` reaches 0.8 over the season's first six weeks, holds, and returns to 0 in
the month after. Calendar months, no draws, and `props.phenology: false` keeps the grass green.
Numbers: SEASONS.md §2.2. Tests: `test/phenology.test.ts`.

What changed from the first plan:

- **More places (0.102, after research):** `nw-australia`, `central-america`, `east-africa`,
  `northeast-brazil`, `india` and `indonesia`, each in the latitudes where its dry season holds.
- **West Africa only from 5°N:** the place runs from −5° to 15°, and Nov–Apr doesn't hold near or
  south of the equator.
- **Queensland's wet tropics stay green:** latitude can't separate them from the Top End, so
  `wetCoast` adds the ocean.
- **Gujarat:** it has no place, but `india`'s 15–22°N covers its coast up to 22°N.
- **A field, not `dryMonths`:** `drySeason` holds the months, latitudes and `wetCoast`.

Rendered at 1080p against the previous commit, with a framed view forced on each place: straw grass
in the dry month (north Australia September
5.81% of the frame, Guanacaste March 36.25%, Fortaleza October 5.29%, Mozambique September 4.77%, India
April 1.68%, West Africa December 2.22%, northwest Australia August 0.37%, the Lesser Sundas September
0.39%), and identical in the wet month (north Australia February, West Africa July, India August) and
elsewhere (Antilles September). Guanacaste's large share is the ground cover's tint, seen there as a
slight warming of the ground. A backlit view and the wet-tropics exception weren't rendered (tested).

`dry` isn't in `SceneParams`, so `params.mjs --ref` reports 0 changed. Count with
`--stats 'p => src.phenology.phenologyFor(p).dry > 0 …'`: 44 of 1095 days have savanna-dry grass, 13
of them open sea.

## 8. Leaf litter (done, 0.103)

`props/leafLitter.ts`, `phenology.ts` `LITTER_DAYS` and `litterTint`, `terrain.ts` `litterMap`.
Numbers: SEASONS.md §2.5. Off with `props.leafLitter: false` or `props.phenology: false`.

- **The count first.** Within the season, a deciduous tree stands under 20 m in frame on 8 of 1095
  days, which the plan called rare. Built anyway, by decision: realism first, and a future
  move-around mode will walk up to trees a still frame never shows close. A 5–10 cm leaf at those
  distances is 6–20 px at 1080p, so it reads clearly where it shows.
- **Two levels, no seam.** Real leaves while a leaf is at least 3 px long (`leafShare`); past that,
  a world-space map of the ground under each deciduous crown, which the terrain shader reads with
  one fetch. The map also lies under the leaves.
- **Ready for a moving camera.** A leaf comes from a hash of its tree's position and its index, not
  a stream or the view; thinning is a threshold on its own hash, so coming closer only adds leaves.
  Only `createLeafLitter`'s range, frustum and budget and `litterField`'s frustum test read the
  camera: a live mode re-runs those per tree (or drops the frustum test).
- **What changed from the first plan:** no leaves in the wrack (the evidence varies too much by
  beach for a rule by season); no new stream or spec force, since it isn't random and every draw
  stays as it was (`--ref`: 0 of 1095 days changed).
- **Seen in renders** (`diff.mjs --off`, 16 frames): temperate January and November, boreal October,
  tundra September, an overlook for the colour alone, backlit, and real days 2026-10-16 (Norway) and
  2026-02-25 (British Columbia). 2026-10-12 (Iceland) showed nothing: the page re-rolls its framing,
  and the framing it renders has no deciduous tree. Render time 0% overall on three litter scenes
  (`bench.mjs --runs 3`; one scene's runs were noisy).
- **How often** (`params.mjs --rendered`): 14 of 1095 days have leaves in frame and 69 only the
  ground colour. The 8 in the count above is from the first framing attempt, for a tree under 20 m.
- **Freed:** `check:restart --date 2024-11-28 --steps 8` covers real litter days (11-30, 12-05), and
  `test/leafLitter.test.ts` checks the map goes with the terrain's material.

## 9. Snow cover and ice foot (done, 0.111)

Its own plan, with what it settled, how it came out and its limits: [SNOW.md](SNOW.md). Numbers:
SEASONS.md §4.1. Spec: `snow`, `props.iceFoot`.

## 10. Baltic sea ice (done, 0.114)

Its own plan, with what it settled, how it came out and its limits: [SEA_ICE.md](SEA_ICE.md). Numbers: SEASONS.md §4.2.
Spec: `seaIce`, `props.seaIce`. The first plan's Jan–Apr north of 60° was too narrow against FMI's own account.

## Checks

- `test/phenology.test.ts`: the curves (monotone, in 0..1, hemisphere flip, evergreen climates
  flat), every climate × month key, builders deterministic and unchanged in summer.
- `test/seasonsAnimals.test.ts`: over `allParams()`, no colony birds, humpbacks, ghost crabs out
  of season where the tables say; Oman humpbacks all year.
- `diff.mjs --off '{"phenology":false}'` on a temperate autumn framed day and a Mediterranean
  August day; renders at 1080p, 16 frames.
- Phase 5 (`test/phenology.test.ts`): snow line by month and climate, both hemispheres; tropical
  and arid unchanged; off switch keeps the draw.
- Phase 6: sargassum share by month over `allParams()` (`expectShare`).
- Phase 7: `drySeason` over every place; `dry` in and out of the months.
- Phase 8 (`test/leafLitter.test.ts`): the curve in every climate and month, a leaf fixed by its
  tree, thinning, mesh checks, dry ground, budget, weathering, plants unchanged, off switches, the
  map's rim.
- Phase 10 (`test/seaIce.test.ts`): the table over every place, dates by zone, waves under the ice, nothing surfacing,
  off switches, the fields' ranges, a piece of rubble fixed by its cell, mesh checks.
