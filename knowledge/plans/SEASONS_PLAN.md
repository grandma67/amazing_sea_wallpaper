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
| 5 | Seasonal mountain snow line (incl. winter snow on summer-bare mountains) | next, ~1–2 h |
| 6 | Sargassum season (Caribbean and subtropical Atlantic wrack Apr–Sep) | next, ~1 h |
| 7 | Tropical dry season: savanna coasts brown in the dry months (`dryMonths` per place) | next, ~½ day |
| 8 | Leaf litter on the ground and in the wrack under deciduous trees | after a visibility count, ~½–1 day |
| 9 | Snow cover and ice foot: built as PLAN_BIOMES 13; this plan gives the months | later, own plan, ~2–4 days |
| 10 | Baltic sea ice (Gulf of Bothnia) | later, own plan, ~2–3 days |

Order: 5–7 together (about a day), then the count for 8, then the snow plan (9). Estimates
include tests, `diff.mjs`, renders and docs.

## Decisions

- **Phenology is not random.** It follows the date, climate and hemisphere, so there is no draw
  and no new stream. The tree builders keep every draw they made before: a leaf's colour and
  whether it is still on come from `hash()` of its position, so a tree's shape never changes with
  the season, only its leaves. Days outside autumn, winter and spring render as before.
- **Off switch:** spec `phenology: false` (→ `params.overrides.phenology`) gives every day the
  summer look, for `diff.mjs --off '{"phenology":false}'`.
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
  leaves: { on, turned, fresh }   // deciduous leaves: share still on, share turned, spring green
  deciduous(kind): number         // share of that kind's trees that are deciduous here
  autumn: RGB[]                   // the turned leaves' colours (yellow; redder in AUTUMN_RED places)
  dry: number                     // grass and ground cover: 0 green … 1 straw
}
canopyTint(foliage, phen, share) // a distant forest's colour this season
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

## 5. Seasonal snow line (not built)

- `pickLandform` (`params.ts`, `snowLine`) draws a snow line as a share of the mountain's
  height, or `Infinity` for mountains with no snow. Scale it after the draw by the season in the
  day's hemisphere (`seasonDay`): winter ×0.6, late summer ×1.2. This is a function of the
  date, so no draw and no stream.
- **Gap to close:** `Infinity × 0.6` is still `Infinity`, so a temperate mountain that's bare in
  summer never gets winter snow. Give non-desert mountains above ~1500 m a winter snow line
  (e.g. 0.7–0.9 of the height, from `hash()` of the landform so it's stable). Check the share of
  days that change with `params.mjs --ref HEAD`.
- Off with `phenology: false` (summer snow line).
- Done when: an overlook with mountains on a temperate January day has white tops that the same
  place in August doesn't; polar and nordic tops reach lower in winter; desert unchanged.

## 6. Sargassum season (not built)

- The wrack choice already exists (`props/debris.ts`, `wrack('sargassum', …)`). Add a month
  threshold on the draw it already makes: full Apr–Sep (the bloom and beaching season), ×0.2
  Oct–Mar. No new draws.
- Done when: `test/seasonsAnimals.test.ts` (or a debris test) over `allParams()` shows
  sargassum wrack mostly Apr–Sep; other wrack kinds unchanged.

## 7. Tropical dry season (not built)

- A per-place `dryMonths` (place field: one place's difference) for savanna coasts, feeding
  `Phenology.dry` on tropical-climate days. Places: `north-australia` (May–Oct),
  `west-africa` (Nov–Apr); Gujarat isn't a place id. Find its place, or drop it. Research
  each place's months briefly (1–2 searches) before writing the table, and cite it in SEASONS.md.
- The grass and ground cover already follow `dry` (phase 3), so no new builder work.
- Done when: a north-Australia September day has straw grass behind the beach and a February day
  green; other tropical places unchanged.

## 8. Leaf litter (not built)

- **First, count:** real leaves are 5–10 cm and read only within ~20 m. Count framed and
  shoreline days with a deciduous tree within ~20 m of the camera in frame (`view()` in
  `test/days.ts`) in autumn. If that's rare, drop this phase or make it a ground tint.
- If built: a tint on the ground cover under deciduous crowns plus a few leaves mixed into the
  wrack, coloured from `Phenology.autumn`, amount from `1 − on` (leaves that fell). `hash()` for
  in-mesh detail; placement on its own stream (`ctx.rng('leafLitter')`).
- Spec field `leafLitter`, off switch `props.leafLitter: false`.
- Done when: `diff.mjs --off '{"props":{"leafLitter":false}}'` shows a visible change on a
  temperate November framed day (no `⚠ invisible`), and nothing in summer.

## 9. Snow cover and ice foot (later, own plan)

Built as PLAN_BIOMES 13 ("Snow and ice foot", which has the build list: snow mask, snow-capped
rocks and plants, ice foot, frozen spray). This plan only gives the season. Write the snow plan
before code. It needs to settle:

- **Months by climate:** polar Oct–May, boreal Dec–Mar, temperate only on rare cold days. Put a
  number on "a chance per day" for boreal coasts (they thaw often) and on temperate cold days.
  Decide whether the weather or the month drives the chance, and give it its own stream
  (`'snow'`).
- **Lying vs. falling snow:** lying snow only, or snowfall too (a weather kind, CLOUDS.md).
- **With snow:** grass and ground cover hidden (`dry` no longer matters); deciduous trees bare
  anyway; animals already dormant (phase 4).
- **Exposure and white balance:** snow's brightness shifts the exposure; check `exposure.ts`
  and the render time (≤ ~10% more).
- Spec field `snow`; done-when views: polar and boreal shoreline and framed days, front-lit and
  backlit.

## 10. Baltic sea ice (later, own plan)

- The `baltic` place covers latitudes 54–66°, but only the Gulf of Bothnia (about 60–66°)
  freezes over in most winters. Ice comes only on days north of a cutoff, Jan–Apr, with a chance
  per day.
- Not a small extra: shore-fast ice and floes mean damped waves, no breaking surf and a changed
  ocean shader (foam, reflection). Size it like phase 9 and plan it on its own.
- Spec field `seaIce`.

## Checks

- `test/phenology.test.ts`: the curves (monotone, in 0..1, hemisphere flip, evergreen climates
  flat), every climate × month key, builders deterministic and unchanged in summer.
- `test/seasonsAnimals.test.ts`: over `allParams()`, no colony birds, humpbacks, ghost crabs out
  of season where the tables say; Oman humpbacks all year.
- `diff.mjs --off '{"phenology":false}'` on a temperate autumn framed day and a Mediterranean
  August day; renders at 1080p, 16 frames.
- Phase 5: snow line by month over `allParams()` (lower in winter, unchanged for deserts, finite
  in winter for tall non-desert mountains), both hemispheres.
- Phase 6: sargassum share by month over `allParams()` (`expectShare`).
- Phase 7: `dryMonths` table over every place that has one; `dry` in and out of the months.
- Phase 8: the visibility count first; then the prop's mesh checks (deterministic, finite, base
  near y = 0) and `diff.mjs` with the off switch.
