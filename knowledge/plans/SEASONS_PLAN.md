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
| 5 | Snow cover and ice foot (PLAN_BIOMES 13) with the season's months; seasonal mountain snow line | later, own plan |
| 6 | Leaf litter on the ground and in the wrack under deciduous trees | later |
| 7 | Tropical wet and dry seasons (savanna coasts brown in the dry season), Baltic sea ice, sargassum season | later |

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

## 5. Later phases (not built)

- **Snow and ice foot** (PLAN_BIOMES 13): snow cover months by climate: polar Oct–May, boreal
  Dec–Mar (coasts thaw often: a chance per day), temperate only on rare cold days; with snow,
  grass and ground cover are hidden and the `dry` value no longer matters. Needs terrain mask,
  rock and plant snow caps; its own plan.
- **Seasonal snow line:** `pickLandform` draws a snow line; scale it by season (winter ×0.6,
  late summer ×1.2), on a stream that doesn't move the draw.
- **Leaf litter:** autumn leaves in the wrack and under trees on framed days.
- **Tropical wet and dry season:** a per-place `dryMonths` for savanna coasts (north Australia,
  West Africa, Gujarat), feeding `dry`.
- **Baltic sea ice** (Gulf of Bothnia Jan–Apr) and **sargassum season** (Caribbean Apr–Sep).

## Checks

- `test/phenology.test.ts`: the curves (monotone, in 0..1, hemisphere flip, evergreen climates
  flat), every climate × month key, builders deterministic and unchanged in summer.
- `test/seasonsAnimals.test.ts`: over `allParams()`, no colony birds, humpbacks, ghost crabs out
  of season where the tables say; Oman humpbacks all year.
- `diff.mjs --off '{"phenology":false}'` on a temperate autumn framed day and a Mediterranean
  August day; renders at 1080p, 16 frames.
