# Nature plan: blossom, moss and weed, fireflies, animal seasons, desert bloom, fungi

Bring the remaining living things on a coast into the season. Research and numbers:
[NATURE.md](../NATURE.md). Builds on the seasons work ([SEASONS_PLAN.md](SEASONS_PLAN.md):
`phenology.ts`, `animalSeasons.ts`) and on PLAN_BIOMES phase 14 (the new animals). TODO 24
(flowers by biome and month) is phase 1; TODO 22 (fireflies) is phase 3.

## Status

| Phase | What | Days touched (of 1095, measured) | Estimate | Status |
|---|---|---|---|---|
| 1 | Blossom: flamboyant, rock rose, heather | flamboyant **24** land days in full bloom, **109** with scattered trees; rock rose ~13; heath near the camera on **14** rock-shore days, on far slopes on the heath places' 9 beach days when a landform or island is in frame | 3–4 h | planned |
| 2 + 2b | Moss on rock and trunks by realistic rules; upper-shore weed by season (built together: both edit the rock-shore shader) | every boulder, rock-shore and forest day a little; weed on European Atlantic rock shores | 5–7 h | planned |
| 3 | Fireflies and glow-worms, single-flash streaks | **13** eligible nights (glow-worms night only; night and evening blue hour are ~17% of days); fewer after weather, moon and in-frame filters | 5–7 h | planned, **scope question** |
| 4 | Seasons for PLAN_BIOMES 14 animals | per animal | ~0.5 h each + the animal (2–4 h each, own plan) | with phase 14 |
| 5 | Desert or spring bloom | **~1** (Atacama: 1 land day Sep–Nov, ×0.37; Cape West Coast: 1 Atlantic land day Aug–Sep; Namaqualand isn't a place) | 1.5–2.5 h | **scope question**: recommend research only |
| 6 | Fairy rings (far) and mushrooms (near) | rings: **124** land days in a growing season (before grass-in-frame); mushrooms: **80** in season, ~5–10 with a tree within 15 m in frame *(leaf-litter analogue: 14)* | 3–5 h | planned |

Estimates are my working hours including research, tests, ~3 render rounds and docs, from past
commits (leaf litter ~1 h after its plan, snow and ice foot 1–2 h, Baltic sea ice ~6 h). Phases
1–3 and 6: about 16–24 h, plus review between phases.

**Order:** 1 → 2 + 2b → 6 (fairy rings avoid phase 1's heath mask; mushrooms sit under trees whose
trunks phase 2 changes) → 3 (independent; can move anywhere once its scope is decided) → 4 and 5
as decided. Counts are `params.mjs --stats` windows
(place, month, not open sea). In-frame counts for a new prop need its choice to exist
(`params.mjs --project KIND`, `--rendered`): the first step of each phase.

## Answers (2026-11-07)

1. **Common flowers first:** flamboyant, rock rose, heather. Gorse, pōhutukawa and wattle stay
   researched in NATURE.md for later.
2. **Moss follows nature's rules,** whatever they key on: drought, today's wetness, spray from the
   sea and where water runs (NATURE.md §4), not the rock's biome. Trunks get moss too.
3. **Short streaks, a deliberate middle ground:** the eye's own persistence (~20 ms + ~20 ms decay,
   somewhat longer in the dark) would give a 2–10 cm streak; a full ½–1 s flash is what a camera
   holds at ~½ s exposure or more. We draw the whole flash (~0.3–0.8 m) as chosen: a stylised
   choice, not eye-accurate, while waves and leaves stay sharp.
4. **Near the viewer, and far-off land coloured:** the bloom tints far ground (phase 5, if built);
   mushrooms stay near the camera; **fairy rings** are the far-off sign of fungi.
5. **No towns:** confirmed in the code (only the night horizon's town glow, `nightGlow.ts`, and the
   lighthouse). Jacaranda and planted cherries stay out.

## Decisions

- **Not random where it follows the calendar.** Blossom, moss, weed and the animal seasons follow
  date, climate, place and hemisphere: thresholds and colours, no new draws (as phenology). Which
  crown blooms comes from `hash()` of its position, like autumn leaves.
- **New randomness gets its own stream:** fireflies `ctx.rng('fireflies')`, fungi
  `ctx.rng('fungi')`, the bloom year (if built) `Random.derive(\`amazing-sea:${year}\`,
  'desert-bloom')` (`Random.derive(seed: string, stream)`; one draw per calendar year, so every
  day of a year agrees; a spec `seed` doesn't change it). Nothing draws from the main `rng`.
- **Keys** (ARCHITECTURE.md "Biome, climate or place"; add each table there): flamboyant, rock rose
  and heather by **place** list; moss amount by **climate** with a place factor, moss wetness by
  **drought** (place dry seasons and climate); firefly regions by **place**; fungi and fairy ring
  seasons by **climate**; lichen and algae colours stay by **biome** (they follow the rock).
- **Months:** climate rows in northern-equivalent months (`monthInSeason`), place rows in local
  calendar months (as turtle nesting).
- **Spec fields and off switches** (SCENE_SPECS.md "Adding a spec field"; same shapes as `snow`,
  `seaIce`, `leafLitter`). A forced field ignores month, season and weather rules but not physics
  (fireflies still only at night or evening blue hour; nothing on open sea):

  | Spec field | Type | Meaning | Off switch |
  |---|---|---|---|
  | `bloom` | `boolean \| BloomKind[] \| null` | true: every row that grows here, in full flower (nothing where no row grows: the plant isn't there); a list: those rows, also where they don't grow (for testing a look); null/false: none | `props.bloom: false` |
  | `fireflies` | `boolean \| 'flash' \| 'glow' \| 'synchronous' \| null` | true: the place's kind at its peak count, `flash` where the place has none; a kind: that kind (`synchronous` needs mangroves: on trees or bushes otherwise); null: none | `props.fireflies: false` |
  | `fungi` | `boolean \| null` | true: mushrooms under the trees near the camera, as in the peak month | `props.fungi: false` |
  | `fairyRings` | `boolean \| null` | true: rings on the grass near and far, as in the growing season | `props.fairyRings: false` |
  | `desertBloom` (phase 5, if built) | `boolean \| number \| null` | true: a strong bloom; 0..1: its strength | via `props.phenology` |

  `props.phenology: false` also turns off phases 1, 2 (colour by wetness), 2b and 5.
- **Ready for the move-around mode:** what a thing is comes from its world position (a crown's
  hash, a fungus or ring cell's hash); only the choice of what to draw reads the camera
  (`props/leafLitter.ts` pattern).
- **Colours:** linear albedo, estimated from typical photo colours (sRGB → linear, ×0.8 for
  petals). Every value is *(est.)* until checked with `scripts/mesh.mjs --sun 8` against 2–3
  reference photos per row.

## 1. Blossom on plants we already draw (TODO 24)

**Module:** `phenology.ts` gains `BLOOM` and `bloomFor(kind, phen, place)` → `{ crowns, leaves,
colors, bareOn? } | undefined`; `PlantSeason` gains `bloom`. `props/trees.ts` `leaves()` already
recolours a hashed share of leaves for autumn: a second hashed share for blossom (outside of the
crown first, as autumn). Heather goes through a new `heathTint` on the terrain's ground cover.

**Per-tree leaf thinning (new):** today `PlantSeason.on` is one value for every tree of a kind.
Flamboyant needs some crowns thin and others not: `bloom.bareOn` (the `on` for a blooming crown)
applies only to crowns whose hash falls in `bloom.crowns`; the rest keep the climate's `on`. Same
hash, so a crown that blooms is the one that's thin.

### Flamboyant (*Delonix regia*), `broadleaf`

It flowers **after the dry season, nearly leafless, as the rains begin**, and keeps flowering while
new leaves come; dry sites flower copiously, moist ones little; where there's no clear dry season
individuals vary (NATURE.md §1.2, §8).

| Places | Months (local) | Strength | Source |
|---|---|---|---|
| With `drySeason` (`north-australia`, `nw-australia`, `west-africa`, `central-america`, `east-africa`, `northeast-brazil`, `indonesia`, in their latitudes) | the dry season's last 6 weeks and the rains' first 6 weeks | 1 | timing: World Agroforestry DB, Yucatán; 6 weeks *(est.)* |
| `india` (15–22°N, as its `drySeason`) | Apr–Jun | 1 | Indian Forester: first week Apr – last week Jun |
| `antilles`, `lesser-antilles-volcanic`, `bahamas-bermuda`, `yucatan-belize` | May–Sep, peak Jun | 1 | Caribbean table |
| `mainland-se-asia` | May–Jul | 1 | Vietnam |
| `philippines`, `pacific-islands`, `hawaii`, `sri-lanka`, `andaman-lakshadweep`, `sumatra-java-south`, `maldives`, `comoros`, `reunion-mauritius`, and the parts of the first row's places outside their dry-season latitudes | any month | 0.2 (scattered trees) | Singapore: no pronounced season *(est. for the rest)* |
| `galapagos` | none | 0 | native flora; planted only in towns *(est.)* |

- **Share:** 0.15 of `broadleaf` crowns × strength *(est.)*. Tropical broadleaf is 1.5 of 14.5
  vegetation weight, so ~1.5% of trees: about one flamboyant per framed view at full strength.
  Measured windows (land days in three years): **24** in full bloom, **109** with the 0.2
  scattered strength, 55 in a dry-season place out of its window, the rest no flamboyant. Measure
  the in-frame share with `--project vegetation` once the choice exists.
- **Leaves:** a blooming crown's `bareOn` 0.4 in the late dry season *(est.)*; blossom share of its
  leaf cards 0.8.
- **Colour:** scarlet `[0.55, 0.02, 0.01]`, inner crown `[0.31, 0.01, 0.006]`. No far tint: one
  crown in ~70 doesn't colour a forest.

### Rock rose (*Cistus*), `bush`

- **Places:** `western-med`, `adriatic`, `aegean`, `north-africa-levant`, `portugal-morocco`,
  `canaries` (native from Macaronesia through the Mediterranean to the Caucasus and N Africa; not
  California, Chile, the Cape or SW Australia: Kew POWO, first-nature).
- **Months:** May–Jul (local), peak late May – mid Jun *(est.)*; April ×0.3.
- **Share:** 0.4 of `bush` crowns, 0.25 of their leaf cards *(est.: speckled, not solid; each flower
  lasts a day)*.
- **Colours:** pink `[0.55, 0.17, 0.36]` and white `[0.70, 0.68, 0.65]` (half each by crown hash).
- **Far tint:** `canopyTint` of the scrub band by 0.4 × 0.25 × the bush share of the day's plants
  (a faint pink-white haze on far maquis) *(est.)*.

### Heather (*Calluna*, with bell heather), ground cover

- **Places (heath):** `cornwall-wales`, `brittany`, `ireland`, `scotland`, `norway-west` (Norway's
  coastal heath *(est.)*). Not `baltic`.
- **Where:** near the camera, the land behind a `rock-shore` coast (platform, boulder and cliff-top
  compositions) in those places, not dunes, machair or under trees; far off, landforms' and islands'
  lower slopes in those places on every coast type (a beach day's headland is heath too).
  **Patchy**: a world-space noise mask with ~35% cover *(est.)* (patchy on cooler aspects, tight
  and a few cm high on exposed tops: British Plant Communities). Measured: 14 rock-shore days get
  heath near the camera; the 9 beach days only on far slopes, when a landform or island is in frame.
- **Colour by month (local):** bloom Jul–Sep, peak mid-Aug, a muted purple from afar
  `[0.14, 0.07, 0.13]` (petals `[0.26, 0.09, 0.24]` mixed with stems); Oct–Mar rusty brown
  `[0.08, 0.04, 0.034]` (dead flowers, wiry stems); Apr–Jun dark green `[0.06, 0.08, 0.04]`
  *(est.)*. So heath shows in every month, not only in August.

**Before code:** reference photos (flamboyant on a Caribbean beach, cistus scrub above a
Mediterranean cove, heather on a Cornish or Scottish cliff top near and from ~300 m); open
ARCHITECTURE.md "Draw order in `buildParams`" and "Biome, climate or place", `arch/PROPS.md`,
LESSONS.md (plants).

**Done when:** a forced tropical framed day in its window shows a scarlet, thinned crown; a
western-Med May cove pink and white cistus; a Scottish cliff-top heath purple in August, brown in
January, dark green in May, near and far (`diff.mjs --off '{"props":{"bloom":false}}'`, contact
sheet, front- and backlit); other places unchanged. Cost ~0% render time.

**Tests:** `test/bloom.test.ts`: the table over every place × month (no sampling), dry-season
windows in both hemispheres, shares in 0..1, a crown fixed by its position, `bareOn` only on
blooming crowns, unchanged outside the window, the heath mask deterministic, off switches;
`realDays.test.ts` "no bloom outside its months"; `sceneSpec.test.ts` the `bloom` field.

## 2. Moss on rock and trunks

**Rules** (NATURE.md §4): amount = climate × place factor × spray shelter × face; colour = today's
wetness. No draws.

- **Amount by climate** `MOSS`: temperate 1, boreal 1, polar 0.5, tropical 0.6, subtropical 0.5,
  Mediterranean 0.4, arid 0 *(est.)*; place factor 1.3 for the wettest, foggiest coasts
  (`se-alaska`, `british-columbia`, `pacific-northwest`, `norway-west`, `ireland`, `scotland`,
  `new-zealand-south`, `patagonia-fjords`, `tasmania`) *(est.)*. Replaces `GROWTH[biome].moss`
  (`props/rocks.ts`) and feeds the rock shore and trunks.
- **Spray belt:** the yellow-grey lichen zone above the black *Verrucaria* band is ~1 m high on
  sheltered shores and tens of metres up cliffs on very exposed ones (JNCC, EUNIS B3.11). Lichen
  zones grow over years, so the belt follows the **coast's exposure, not today's swell or tide**:
  - **Measured from** the spring high water plus run-up, the reference the rock-shore shader
    already uses for its black band (`above = h − tideSpring − runup`, `terrain.ts`); boulders on a
    beach from their `wetLine` (`runup × 1.3`, `props/rocks.ts`) above sea level.
  - **Height** `sprayBelt` (m above that line), a place field with a default by climate from the
    typical swell: the swell table's weighted mean is 0.62 m (0.73 m on temperate and boreal coasts,
    `BIG_SWELL`), so default `1 + 4 × 0.62 ≈ 3.5` m (3.9 m temperate and boreal) *(est. mapping)*.
    Sheltered places 1.5 m: `baltic`, `adriatic`, `aegean`, `western-med`, `persian-gulf`,
    `red-sea`, `yellow-sea`, `fundy`, `pei`. Exposed ocean fronts 12 m: `scotland`, `ireland`,
    `cornwall-wales`, `norway-west`, `iceland-faroe`, `iceland`, `new-zealand-south`, `tasmania`,
    `patagonia-fjords` (outer coast), `south-georgia`, `kerguelen-heard`, `nz-subantarctic`,
    `tierra-del-fuego`, `falklands` *(est.: the place lists from exposure to the open
    Atlantic and Southern Ocean; the metres within the sources' 1 m – tens of m range)*.
  - No moss inside the belt; moss fades in over the next 3 m *(est.)*. Trees whose base is inside
    it: lichen-grey bark (`LICHEN[biome]` at 0.4) instead of moss (Isles of Scilly flora).
  - **Forced extremes** (colour only, no geometry, so the camera and dry land are unaffected and
    `expectDryCameras` doesn't apply): the belt is the same at low, mid and high tide on platform,
    boulder and cliff-top compositions, and in a storm (it doesn't read today's swell). A test checks
    that: each tide stage × composition gives the same belt height on a forced place.
- **Faces:** rocks: upward faces (as now) and concave low spots of the shader's noise. Trunks:
  base to ~1.5 m *(est.)*, densest at the base, on the side the tree leans (`tilt`,
  `leanSeaward` in `props/vegetation.ts`: stemflow), patchy by hash; never "the north side".
- **Wetness today** `mossWetness(params)` in `phenology.ts` (0 dry … 1 wet). **Only drought dries
  moss**, not winter dormancy (temperate grass is `dry` in winter from dead tops, and winter is the
  wettest season there):
  - 1 on rain, drizzle, storm and fog days, and in temperate, boreal and polar climates always;
  - Mediterranean: 1 − the `DRY_DAYS` curve's summer drought (Jun–Oct);
  - savanna places: 1 − `savannaDry` in their `drySeason`;
  - tropical and subtropical places without a `drySeason`: 1 (humid all year);
  - arid: 0.
  Colour = mix(moss green, dry brown `[0.068, 0.045, 0.019]`, 0.5 × (1 − wetness)) (half: some mosses
  stay green when dry).
- **Changes many days** (decided): uniforms aren't params, so `params.mjs --ref HEAD` shows 0;
  count with `--stats 'p => src.phenology.mossFor(p)…'`. `diff.mjs` on a temperate rock shore, a
  Mediterranean August boulder beach, a British Columbia framed forest and an exposed Atlantic
  platform in a big swell.

**Done when:** moss on sheltered rock and trunk bases in wet climates, none in the spray belt or on
arid coasts, dark in a dry Mediterranean August, green on a rainy day there, green in a temperate
January; render time ~0%.

**Tests:** `test/moss.test.ts`: `MOSS` and `sprayBelt` over every climate and place, the belt the
same over tide stages × compositions and swell, wetness by weather and month in both hemispheres
(temperate winter wet, wet tropics wet), a trunk's moss side follows its lean; `npx vitest run
test/glsl` after the shader edits.

## 2b. Upper-shore weed by season

- **Laver** (*Porphyra umbilicalis*: dense stands round high water on exposed rock along most of
  Norway's coast; northern Portugal to the Faroes; MarLIN, SNL): a dark purple-brown
  `[0.05, 0.025, 0.03]` patchy band in the littoral fringe just below the black lichen.
  **All year** on `norway-west`, `norway-north`, `iceland-faroe`, `scotland`; **Nov–Apr** on
  `ireland`, `cornwall-wales`, `brittany`, `bristol-channel`, and `portugal-morocco` **north of
  41°N** only (its range ends in northern Portugal; absent in summer in the south: MarLIN). No row
  elsewhere (other oceans' Bangiales unresearched).
- **Sea lettuce** (*Ulva*): a brighter green fleck `[0.06, 0.16, 0.03]` on the same rock, Mar–May,
  ×0.3 otherwise *(est.; sources conflict, NATURE.md §5)*.
- **Done when:** `diff.mjs --crop` on a Scottish and a Cornish rock-shore platform, January and
  July: the band in both in January, only in Scotland in July. Tests: the table over every place ×
  month, the 41°N limit.

## 3. Fireflies and glow-worms (TODO 22)

**Scope:** 13 eligible nights in three years with the table below (SE Asia and north Australia
7, of which only those with mangroves drawn count; Mediterranean 2; India, eastern North America,
Japan 1 each; glow-worms 1) (night and evening blue hour are
~17% of days, and firefly months are short), before weather, moon and "plants in frame". That's
real; build it anyway (rare showpiece, PLAN_BIOMES decision 4) or defer: **ask before building**.

**Choice:** `firefliesFor(params, rng)` in `props/fireflies.ts` (in `props/choices.ts`).

| Region (places) | Kind | Months (local) | Peak | Source |
|---|---|---|---|---|
| Atlantic Europe and the North Sea: `cornwall-wales`, `brittany`, `ireland`, `bristol-channel`, `wadden-north-sea`, `mont-saint-michel`, `scotland` | `glow` (glow-worm females in grass) | May–Sep | Jun–Jul | NHM, UK Glow-worm Survey |
| North: `norway-west`, `baltic` | `glow` | Jun–Aug | Jul | Finland study (glowing at high latitudes on the shortest nights), range to ~65°N, Norway GBIF records *(months est.)* |
| Mediterranean Sea: `western-med`, `adriatic`, `aegean`, `portugal-morocco` | `flash` (*Luciola*, short dashes) | May–Jun | Jun | Italian essay, Biologer.hr |
| Eastern North America: `florida-carolinas`, `maine`, `fundy`, `nova-scotia` | `flash` (*Photinus*, J streaks) | Jun–Aug (`florida-carolinas` May–Sep) | mid-Jun – early Jul | state guides |
| Japan, Taiwan, Korea: `south-japan`, `japan`, `taiwan-south-china`, `yellow-sea` | `flash` (Genji, Heike) | May–Jul | Jun | Japan Times, Tokyo guides |
| South-East Asia mangroves: `indonesia`, `philippines`, `mainland-se-asia`, `sumatra-java-south` | `synchronous` on mangrove crowns; only where `props/mangroves.ts` draws mangroves | all year; Nov–Dec ×1, Jan–Mar ×0.4 | Nov–Dec | Selangor survey (6% vs 2%) |
| Eastern Australia: `east-australia` | `flash` | Oct–Mar (Queensland "up to six months"; Illawarra mid-Nov – early Dec) | Nov–Dec | Illawarra and Coffs Coast reports |
| Northern Australia mangroves: `north-australia` | `synchronous` where mangroves are drawn | Nov–Mar *(est.: wet season)* | – | coastal mangroves of Qld and NT (Illawarra source) |
| India: `india` (Konkan) | `flash` | May–Jun (pre-monsoon) | late May | one Sindhudurg observation; Western Ghats richest region (2026 checklist) |

Months outside the peak ×0.4 *(est.)*. Everything else: none (polar, most boreal, arid, the Pacific
coast of North America, New Zealand, Africa, South America: no seasonal source, NATURE.md §3).

- **When:** `timeOfDay === 'night'`, or `'blue-hour'` with `evening` (`params.ts`); `glow` only at
  night (glow-worms from ~22:00).
- **Moon:** ×0.3 when `moonElevationDeg > 2` and `moonIllumination > 0.7` (the same "moon up" test
  `params.ts` uses for moonlit nights; glow-worm guides, Sabah).
- **Weather:** none in rain, drizzle, storm (`stormy`) or snow; ×0.3 in fog; none with
  `ocean.airWindSpeed > 4` m/s (air over land, not the iced or calmed sea wind) *(est.: still, warm
  evenings)*.
- **On what:** land with grass or bushes 5–60 m away and in frame (`ctx.visible`): `flash` 0.5–3 m
  above grass and bushes, `glow` on the grass, `synchronous` in mangrove crowns. Never over sand,
  bare rock or water.
- **Chance** per eligible evening at the peak 0.7 *(est.)*.
- **Count from density × the vegetated area in view** (5–60 m, in frame), so near and far come out
  right on their own:
  - `flash`: **0.15 males per m²** (*Photinus carolinus* emergence traps: one per 13 m², 3.6 m
    apart; displaying males also cluster, so ×0.5–2 by a patch noise), × the month factor; of
    those, the share **lit in the frame** is ½–1 s in a 5–7 s cycle, **~15%**, and only those are
    drawn. E.g. 1000 m² of grass in view at the peak: ~150 flying, **~20 lit**.
  - `glow`: glowing females are **0.1–19 per 100 m** of walked path at Essex sites (most sites
    ~5–17); as an area density, a path sees ~1 m each side, so **~0.05 per m²** at a good site,
    ×(0.01–1) by a site hash *(est. conversion)*; all lit (steady). Mostly 22:00–00:00 (Essex
    surveys start then; most stop by midnight), so `night` only.
  - `synchronous`: per mangrove crown in view, 20–200 on a display tree *(est.)*, on 1 in 5
    crowns *(est.)* (display trees are few; some sit empty for months: Selangor survey); all lit
    together in the frame.
  - Budget cap: 400 drawn lights *(est.)*.

**Brightness:** 10¹⁰–10¹¹ photons per flash (Silver 2026, *Am. J. Phys.*; the classic 10¹³–10¹⁴
is ~1000× too high, and "real fireflies look much dimmer than LEDs"). At 562 nm over a 0.5 s
flash, into a hemisphere: **I ≈ 7.6 × 10⁻⁶ cd** (upper bound; ×0.1 at the low end). Seen from the
camera: magnitude **+0.3 at 2 m, +2.3 at 5 m, +3.8 at 10 m, +5.3 at 20 m, +6.8 at 40 m**
(m = −13.99 − 2.5 log₁₀(I / d²)). `glow` the same, steady. Colour `[0.66, 1.0, 0.035]` (~562 nm).

**Drawing:** stars sit on the sky dome at infinity and can't be hidden by plants, so fireflies are
**their own depth-tested additive sprites and ribbons** in the scene (as `props/shipLights.ts`),
not the star pass. They reuse only the star code's magnitude → luminance conversion (`stars.ts`:
V magnitude is luminance), spread over the sprite's pixels so a point of magnitude m adds the same
light as a star of magnitude m. Then the night exposure handles them by construction.

**Streak (answer 3, stylised):** one flash at flight speed. Speed 0.6–1.5 m/s (2–5 ft/s), slower and
arcing while flashing, so a lit trace is **~0.3–0.8 m**. `flash`: a thin ribbon along a J (bottom
and upswing of a U arc) for *Photinus*; a short straight or gently curved dash for the others
*(est.)*; brightest mid-trace, fading at the ends; total light conserved (the magnitude spread along
it). `glow` and `synchronous`: dots. Geometry, not motion blur, so the 16 render frames agree.
Move-around mode: flashes ½–1 s every 5–7 s, `synchronous` together, `glow` steady.

**Before the first render:** the in-frame count with `--project fireflies`; `scripts/mesh.mjs` for
the ribbon; a forced spec (`fireflies: 'flash'`, `timeOfDay: 'night'`, `eclipse: null`,
`moonPhaseDeg: 0`) beside real days (`snapshot.mjs --where 'p => p.props.fireflies != null'
--sample 8`); `params.debug.probe` on a near and a far firefly against the magnitudes.

**Done when:** near fireflies read as points or short J streaks, far ones fade out by ~40 m, plants
hide those behind them; none by day, at dawn blue hour, in rain or on open sea; ≤ 5% render time
(`bench.mjs`).

**Tests:** `test/fireflies.test.ts`: the table over every place × month; none by day, at dawn, in
rain, wind, on open sea or snow; fewer under a full moon (`expectShare`); placements over
vegetation only; `synchronous` only with mangroves; magnitude by distance; deterministic; off switch
(`propSwitches.test.ts`), spec field (`sceneSpec.test.ts`).

## 4. Animal seasons for PLAN_BIOMES phase 14

Build with each animal of phase 14 (its own plan); the season goes in `animalSeasons.ts`:

| Animal | Season rule | Reads |
|---|---|---|
| Polar bear | ashore on days without sea ice, on the ice when there is ice; ~2% of eligible days | `params.seaIce` |
| Walrus | coastal haul-out on ice-free days from Aug to the freeze (Point Lay from early Aug); on floes when there is ice | `params.seaIce`, local month |
| Sea otters and kelp mats | otters all year; floating kelp canopy full Jun–Sep, ×0.4 Dec–Mar (winter wave losses) | month |
| Waders | flocks on passage (Mar–May, Aug–Oct; Wadden peaks late Jul – mid Sep) and in winter on temperate and Mediterranean flats and beaches; summer ×0.15; polar Jun–Jul scattered pairs | climate, month |
| Blacktip sharks | `florida-carolinas` mid-Jan – Mar, peak Feb–Mar, within 20–50 m of shore | place, local month |
| Reef blacktips | reef lagoons, all year | – |
| Monarchs (new) | `california` late Oct – Feb, clustered on trees near the camera | place, month |

Monarchs roost on eucalyptus at 75% of California's sites, but the project draws no eucalyptus
(California has stone pine and cypress): either add a eucalyptus kind for `california` (its own
small task) or cluster them on the pines (Pacific Grove is pine and eucalyptus). Decide in the
monarchs' own plan.

After each: `node scripts/animals.mjs`, paste into ANIMALS.md with its rule in "Seasons".

## 5. Desert or spring bloom — recommend research only

**The counts:** Atacama has 1 land day in Sep–Nov in three years, × a 0.37 chance of a bloom year
(13 events in 35 years): ~0.4 days. Namaqualand (yearly bloom Jul–Sep, orange *Ursinia* and white
daisies; SANParks) is at ~29–31°S, between `namibia` (to −29°) and `cape` (−33° to −35°): **no place
draws it**. The Cape's West Coast (Postberg, ~33°S, inside `cape`: daisies every Aug–Sep, strong
some years; West Coast NP) has 1 Atlantic land day in Aug–Sep in three years.

So either version shows on about one day in three years (the move-around mode doesn't change it:
it's the date). Recommendation: keep it researched only, unless a place is added for Namaqualand or
the Cape gets more days. If built anyway, the design stays:

- Atacama: `desertBloomFor(params)`, local ramp 1–20 Sep, full 20 Sep – 31 Oct, fading to 20 Nov;
  a bloom year at 0.37 from the per-year stream, 1 in 3 of them strong.
- Cape West Coast: every Aug–Sep, strength drawn per year (0.3–1).
- Near the viewer: new `FLOWERS` kinds (Atacama *Cistanthe* magenta `[0.46, 0.02, 0.26]` and yellow
  `[0.65, 0.44, 0.02]`, *Nolana* lilac `[0.38, 0.35, 0.60]`; Cape orange daisy `[0.75, 0.25, 0.02]`
  and white `[0.72, 0.70, 0.66]` *(est.)*). Far land: ground cover and lower slopes tinted by
  strength × 0.5 in noise patches.

## 6. Fungi and fairy rings (answer 4)

**Fairy rings (far-off sign)** (RHS, Utah State herbarium, Britannica):

- A ring of **darker, taller grass** at the advancing edge (extra nitrogen), often with a band of
  dead or thin grass just inside it; diameters commonly **2–10 m** (over 10 m sometimes; rings of
  hundreds of metres are rare and old); grows 20–30 cm a year, lasts decades.
- **Where:** grass on land (machair, dune grassland, cliff-top turf) in temperate, boreal and
  Mediterranean climates; not on sand, under trees or on phase 1's heath mask (heath isn't turf);
  0–3 per hectare *(est.)*.
- **Look:** dark band 0.3–0.6 m wide `[0.04, 0.115, 0.02]` against the usual ground cover
  `[0.08, 0.13, 0.05]`; inner dead band 0.2–0.4 m straw *(est. widths)*. Full in the growing season
  (temperate Apr–Oct, boreal Jun–Sep, Mediterranean Nov–May), ×0.3 otherwise *(est.)*; under snow
  hidden.
- **Code:** a world-space cell hash for ring centre and radius in the terrain's ground-cover shader
  (like `litterMap`), so rings are fixed in the world. 124 land days are in a growing season; how
  many show grass in frame: `--rendered` once built.

**Mushrooms (near the viewer):** `fungiFor(params, rng)`:

- **Season** by climate (NATURE.md §2): temperate Sep–Nov (+ a weak May–Jun flush ×0.2), boreal
  Aug–Oct, Mediterranean Oct–Dec, polar Jul–Aug, arid none.
  - Tropical with a `drySeason`: its wet months ×1, none in the dry months (Thai study; Amazon
    secondary forest lower in dry months).
  - Tropical without one: all year ×0.5 (fruiting more continuous than temperate, but still with
    rain: Yunnan, Pasoh's main and second flushes) *(est.)*.
  - Subtropical: Jun–Oct ×1 (Xalapa's rainy season), else ×0.3 *(est. for Florida, Natal, south
    Japan: no source found)*.
  - ×1.5 on rain, drizzle or fog days everywhere *(est.)*.
  - Counted: 80 land days in the temperate, boreal, Mediterranean and polar seasons; the tropical
    and subtropical rows add more, to count when built.
- **Kinds by ground:** fly agaric (red cap with white warts, 8–20 cm) under birch and conifer;
  brown boletes (10–20 cm) under conifer, birch and broadleaf; saffron milk caps (orange, 5–10 cm)
  under Mediterranean pines; field and fairy-ring mushrooms (white or tan, 3–8 cm) on grass, on a
  ring's dark band when one is near *(est.: field-guide knowledge)*.
- **Meshes:** cap + stem, base at y = 0, ~200 tris, instanced; placed by cell hash under each crown
  within ~15 m of the camera (leaf-litter pattern).
- **Done when:** a forced temperate October framed forest day shows a few caps near the camera and
  a ring on the grass further off; nothing out of season.

## Still open

- **Phase 3:** build for ~13 eligible nights, or defer?
- **Phase 5:** research only (recommended), or build for ~1 day?
- Every *(est.)* above: shares, colours, widths, moss factors, firefly counts. Photos and `mesh.mjs`
  decide colours; renders decide shares.

## Checks (all phases)

- Before the first render, per phase: the docs named in CLAUDE.md §1 opened, real sizes from photos,
  the in-frame count with `--project` / `--rendered`.
- `diff.mjs` for visibility with each off switch on a clear and a cloudy day; real days in the first
  render round; `bench.mjs` (phase 3 ≤ 5%; every other phase ~0%).
- `npm test` and `npx tsc --noEmit`; `params.mjs --ref HEAD` for the changelog row.
- Docs: changelog.md, ARCHITECTURE.md (new tables in "Biome, climate or place"), `arch/PROPS.md`,
  SEASONS.md pointer, ANIMALS.md, SCENE_SPECS.md, REFERENCES.md, NATURE.md for new numbers.
