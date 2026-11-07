# Nature plan: blossom, moss and weed, fireflies, animal seasons, desert bloom, fungi

Bring the remaining living things on a coast into the season. Research and numbers:
[NATURE.md](../NATURE.md). Builds on the seasons work ([SEASONS_PLAN.md](SEASONS_PLAN.md):
`phenology.ts`, `animalSeasons.ts`) and on PLAN_BIOMES phase 14 (the new animals). TODO 24
(flowers by biome and month) is phase 1; TODO 22 (fireflies) is phase 3.

## Status

| Phase | What | Days touched (of 1095) | Estimate | Status |
|---|---|---|---|---|
| 1 | Blossom on plants we already draw: flamboyant, rock rose, heather | windows: ~60 tropical, ~13 rock rose, ~8 heath; in frame fewer (below) | 2–3 h | planned |
| 2 | Moss on rock and trunks by realistic rules (climate, today's wetness, spray, water-fed faces) | every boulder, rock-shore and forest day a little | 4–6 h | planned |
| 2b | Upper-shore weed by season (*Porphyra* band, *Ulva* green) | rock-shore days on European Atlantic coasts | 1–2 h | planned |
| 3 | Fireflies and glow-worms on warm evenings and nights, by region, single-flash streaks | ≤ 56 eligible before the in-frame filter | 4–6 h | planned |
| 4 | Seasons for PLAN_BIOMES 14 animals | per animal | ~0.5 h each + the animal itself (2–4 h each, own plan) | with phase 14 |
| 5 | Atacama desert bloom | **~0** (1 Atacama land day in Sep–Nov in 3 years × ⅓) | 1.5–2.5 h | **scope question** |
| 6 | Fungi near the camera; fairy rings as the far-off sign | mushrooms ~5 in frame; rings on more grass days | 3–5 h | planned |

Estimates are my working hours including research, tests, ~3 render rounds and docs, from past
commits (leaf litter ~1 h after its plan, snow and ice foot 1–2 h, Baltic sea ice ~6 h). Phases
1–3, 5, 6: about 15–25 h, plus review between phases. Counts are `params.mjs --stats` windows
(place, month, not open sea); re-count each with `--rendered` and the thing in frame first.

## Answers (2026-11-07)

1. **Common flowers first:** flamboyant, rock rose, heather. Gorse, pōhutukawa and wattle stay
   researched in NATURE.md for later.
2. **Moss follows nature's rules,** whatever they key on: climate wetness, today's wetness, spray
   from the sea and where water runs (NATURE.md §4), not the rock's biome. Trunks get moss too.
3. **Short streaks:** the scene isn't a long exposure (waves and leaves are sharp), so a firefly
   draws as the trace of **one flash** (§3 below), not a camera effect. Glow-worms and perched
   fireflies are dots.
4. **Near the viewer, and far-off land coloured:** desert bloom draws flowers near the camera and
   tints far ground cover. Mushrooms stay near the camera; **fairy rings** are the far-off sign of
   fungi (a mushroom can't colour land from far off; a ring of dark grass can).
5. **No towns:** confirmed in the code (only the night horizon's town glow, `nightGlow.ts`, and the
   lighthouse). Jacaranda and planted cherries stay out.

## Decisions

- **Not random where it follows the calendar.** Blossom, moss, weed and the animal seasons follow
  date, climate, place and hemisphere: thresholds and colours, no new draws (as phenology). Which
  crown blooms comes from `hash()` of its position, like autumn leaves.
- **New randomness gets its own stream:** fireflies `ctx.rng('fireflies')`, fungi
  `ctx.rng('fungi')`, the bloom year `Random.derive(\`amazing-sea:${year}\`, 'desert-bloom')`
  (`Random.derive(seed: string, stream)`; one draw per calendar year, so every day of a year
  agrees; a spec `seed` doesn't change it). Nothing draws from the main `rng`.
- **Keys** (ARCHITECTURE.md "Biome, climate or place"; add each table there): flamboyant by
  **place** list (its months come from the place's dry season or a place row); rock rose and
  heather by **place** list; moss amount and wetness by **climate** with a place factor; firefly
  regions by **place**; fungi seasons by **climate**; lichen and algae colours stay by **biome**
  (they follow the rock).
- **Months:** climate rows in northern-equivalent months (`monthInSeason`), place rows in local
  calendar months (as turtle nesting).
- **Spec fields and off switches** (SCENE_SPECS.md "Adding a spec field"; same shapes as
  `snow`, `seaIce`, `leafLitter`):

  | Spec field | Type | Meaning | Off switch |
  |---|---|---|---|
  | `bloom` | `boolean \| BloomKind[] \| null` | true: every row that grows here in full flower whatever the month; a list: those rows; null/false: none | `props.bloom: false` |
  | `fireflies` | `boolean \| 'flash' \| 'glow' \| 'synchronous' \| null` | true: the place's kind at its peak; a kind: that kind; null: none (ignores month, moon, weather; still night only) | `props.fireflies: false` |
  | `desertBloom` | `boolean \| number \| null` | true: a strong bloom; a number 0..1: its strength | via `props.phenology` |
  | `fungi` | `boolean \| null` | true: mushrooms in season under the trees near the camera | `props.fungi: false` |
  | `fairyRings` | `boolean \| null` | true: rings on the grass near and far | `props.fairyRings: false` |

  `props.phenology: false` also turns off phases 1, 2 (colour by wetness), 2b and 5, as it does
  the other seasonal looks.
- **Ready for the move-around mode:** what a thing is comes from its world position (a crown's
  hash, a fungus or ring cell's hash); only the choice of what to draw reads the camera
  (`props/leafLitter.ts` pattern).
- **Colours:** linear albedo, estimated from typical photo colours (sRGB → linear, ×0.8 for
  petals). Every value is *(est.)* until checked with `scripts/mesh.mjs --sun 8` against 2–3
  reference photos per row.

## 1. Blossom on plants we already draw (TODO 24)

**Module:** `phenology.ts` gains `BLOOM` and `bloomFor(kind, phen, place)` → `{ crowns, leaves,
colors } | undefined`; `PlantSeason` gains `bloom`. `props/trees.ts` `leaves()` already recolours a
hashed share of leaves for autumn: a second hashed share for blossom (outside of the crown first,
as autumn). `canopyTint` mixes bloom into distant forest and scrub; heather goes through a new
`heathTint` on the terrain's ground cover.

### Flamboyant (*Delonix regia*), `broadleaf`

Research (NATURE.md §1.2, and the agroforestry and Indian studies): it flowers **after the dry
season, nearly leafless, as the rains begin**, keeps flowering while new leaves come; dry sites
flower copiously, moist ones little; where there's no clear dry season individuals vary.

| Places | Months (local) | Strength | Source |
|---|---|---|---|
| With `drySeason` (`north-australia`, `nw-australia`, `west-africa`, `central-america`, `east-africa`, `northeast-brazil`, `india`, `indonesia` in their latitudes) | the dry season's last 6 weeks and the rains' first 6 weeks | 1 | timing: agroforestry DB, Yucatán; the 6 weeks *(est.)*; `india` gives Apr–Jun (Indian study: first week Apr – last week Jun) |
| `antilles`, `lesser-antilles-volcanic`, `bahamas-bermuda`, `yucatan-belize` | May–Sep, peak Jun | 1 | Caribbean table |
| `mainland-se-asia` | May–Jul | 1 | Vietnam |
| `philippines`, `pacific-islands`, `hawaii`, `sri-lanka`, `andaman-lakshadweep`, `sumatra-java-south`, `maldives`, `comoros`, `reunion-mauritius` | any month | 0.2 (a few trees, scattered) | Singapore: no pronounced season *(est. for the rest)* |
| `galapagos` | none | 0 | native flora; planted only in towns *(est.)* |

- **Share:** 0.15 of `broadleaf` crowns in those places *(est.)*. Tropical broadleaf is 1.5 of
  14.5 vegetation weight, so ~1.5% of trees: ~0–1 flamboyant in a typical framed view. Count with
  `--rendered` before building; the real look is one red crown among palms, which is right.
- **Leaves:** in the late dry season `on` falls to 0.4 on flamboyant crowns *(est.)*; blossom
  share of the remaining leaf cards 0.8.
- **Colour:** scarlet `[0.55, 0.02, 0.01]`, shaded `[0.31, 0.01, 0.006]` for the crown's inside.
  Far tint: one crown in ~70 doesn't tint a forest; `canopyTint` gets the bloom only from its
  share (≈1%, invisible) — fine.

### Rock rose (*Cistus*), `bush`

- **Places:** `western-med`, `adriatic`, `aegean`, `north-africa-levant`, `portugal-morocco`,
  `canaries` (native from Macaronesia through the Mediterranean to the Caucasus; not California,
  Chile, the Cape or SW Australia: NATURE.md §1.1, Kew, first-nature).
- **Months:** May–Jul (local), peak late May – mid Jun *(est.)*; April ×0.3.
- **Share:** 0.4 of `bush` crowns, 0.25 of their leaf cards *(est.: a flowering cistus is
  speckled, not solid; each flower lasts a day, new ones open daily)*.
- **Colours:** pink `[0.55, 0.17, 0.36]` and white `[0.70, 0.68, 0.65]` (half each by crown
  hash; *C. albidus*, *C. creticus* pink, *C. salviifolius*, *C. monspeliensis* white).

### Heather (*Calluna*, with bell heather *Erica cinerea*), ground cover

- **Places (heath):** `cornwall-wales`, `brittany`, `ireland`, `scotland`, `norway-west`
  (Norway's coastal heathland *(est.)*). Not `baltic` (no source).
- **Where on the ground:** cliff tops and rock-shore land behind the shore (`rock-shore` coast,
  and land above beaches in those places), **patchy**: a world-space noise mask with ~35% cover
  *(est.)*, stunted and tight on exposed tops (British Plant Communities: patchy on cooler
  aspects, a few cm high where grazed or exposed; mixed with western gorse in Cornwall).
- **Months:** Jul–Sep (local), peak mid-Aug (Lüneburg Aug–Sep); outside them the heath patches
  are still there, brown: dead flowers and wiry stems Oct–Mar `[0.08, 0.04, 0.034]`, dark green
  Apr–Jun `[0.06, 0.08, 0.04]` *(est.)*.
- **Colour in bloom:** a patch reads muted purple from far off, `[0.14, 0.07, 0.13]` (petals
  `[0.26, 0.09, 0.24]` mixed with stems) *(est.)*.

**Before code:** reference photos (flamboyant on a Caribbean beach, cistus scrub above a
Mediterranean cove, heather on a Cornish or Scottish cliff top near and from ~300 m); open
ARCHITECTURE.md "Draw order in `buildParams`" and "Biome, climate or place", `arch/PROPS.md`,
LESSONS.md (plants); count in-frame days with `--rendered`.

**Done when:** a forced tropical framed day in its window shows a scarlet crown; a western-Med May
cove pink and white cistus; a Scottish August cliff-top purple patches from near and far; the same
places out of season unchanged except heather's brown and green (`diff.mjs --off
'{"props":{"bloom":false}}'`, contact sheet, front- and backlit). Cost: vertex colour and one
noise term in the ground shader, expect ~0% render time.

**Tests:** `test/bloom.test.ts`: the table over every place × month (no sampling), hemisphere
and dry-season windows, shares in 0..1, a crown fixed by its position, unchanged outside the
window, the heath mask deterministic, off switches; `realDays.test.ts` "no bloom outside its
months"; `sceneSpec.test.ts` the `bloom` field.

## 2. Moss on rock and trunks

**Rules** (NATURE.md §4): amount = climate wetness × place factor × spray shelter × face; colour =
today's wetness. No draws.

- **Amount by climate** `MOSS`: temperate 1, boreal 1, polar 0.5, tropical 0.6, subtropical 0.5,
  Mediterranean 0.4, arid 0 *(est.)*; place factor 1.3 for the wettest, foggiest coasts
  (`se-alaska`, `british-columbia`, `pacific-northwest`, `norway-west`, `ireland`, `scotland`,
  `new-zealand-south`, `patagonia-fjords`, `tasmania`) *(est.)*. Replaces `GROWTH[biome].moss`
  (`props/rocks.ts`) and feeds the rock shore and trunks.
- **Spray belt:** the yellow-grey lichen zone above the black *Verrucaria* band is ~1 m high on
  sheltered shores and "tens of metres up cliffs" on very exposed ones (JNCC supralittoral rock,
  EUNIS B3.11). Its top above the sea's reach: `1 + 4 × Hs` m, capped at 25 m (Hs = significant
  swell height) *(est. mapping)*. No moss inside it; moss fades in over the next 3 m *(est.)*.
  Boulders on a beach: the same height test on their own surface. Trees whose base is inside the
  belt get lichen-grey bark (`LICHEN[biome]` at 0.4) instead of moss (Isles of Scilly flora).
- **Faces:** rocks: upward faces (as now) and concave crevices (the shader's existing noise
  low spots). Trunks: from the base up to ~1.5 m *(est.)*, densest at the base, on the side the
  tree leans (`tilt`, `leanSeaward` in `props/vegetation.ts`: stemflow), patchy by hash; never
  "the north side" (beech stemflow study).
- **Wetness today** `mossWetness(params)` in `phenology.ts` (0 dry … 1 wet): 1 on rain, drizzle,
  storm and fog days; otherwise 1 − the grass's `dry` (Mediterranean `DRY_DAYS`, savanna
  `drySeason`), 0 on arid coasts. Colour = mix(moss green, dry brown `[0.068, 0.045, 0.019]`,
  0.5 × (1 − wetness)) (half: some mosses stay green when dry).
- **Changes many days** (decided): report with `params.mjs --ref HEAD` (it won't show: uniforms
  aren't params, so count with `--stats` on `mossFor(p)`), and `diff.mjs` on a temperate rock
  shore, a Mediterranean August boulder beach, a British Columbia framed forest and an exposed
  Atlantic platform in a big swell (no moss low down).

**Done when:** moss shows on sheltered rock and trunk bases in wet climates, is absent in the spray
belt and on arid coasts, dark in a dry Mediterranean August, green on a rainy day of the same
place; render time ~0%.

**Tests:** `test/moss.test.ts`: `MOSS` over every climate and place, the spray belt by swell,
wetness by weather and month in both hemispheres, a trunk's moss side follows its lean;
`npx vitest run test/glsl` after the shader edits.

## 2b. Upper-shore weed by season

- **Laver** (*Porphyra umbilicalis*: dense stands round high water on exposed rock along most of
  Norway's coast; Europe from northern Portugal to the Faroes; MarLIN, SNL): a dark purple-brown
  `[0.05, 0.025, 0.03]` patchy band in the littoral fringe just below the black lichen.
  **All year** on `norway-west`, `norway-north`, `iceland-faroe`, `scotland`; **Nov–Apr** on
  `ireland`, `cornwall-wales`, `brittany`, `bristol-channel`, `portugal-morocco` (absent in
  summer in the south: MarLIN). No row elsewhere (other oceans' Bangiales unresearched).
- **Sea lettuce** (*Ulva*): a brighter green fleck `[0.06, 0.16, 0.03]` on the same European rock,
  Mar–May, ×0.3 otherwise *(est.; sources conflict, NATURE.md §5)*, more where streams run in (not
  modelled).
- **Done when:** `diff.mjs --crop` on a Scottish and a Cornish rock-shore platform, January and
  July: the band in both in January, only in Scotland in July. Tests: the table over every place ×
  month.

## 3. Fireflies and glow-worms (TODO 22)

**Choice:** `firefliesFor(params, rng)` in `props/fireflies.ts` (in `props/choices.ts`).

| Region (places) | Kind | Months (local) | Peak |
|---|---|---|---|
| Atlantic Europe: `cornwall-wales`, `brittany`, `ireland`, `bristol-channel`, `wadden-north-sea`, `mont-saint-michel` | `glow` (glow-worm females in grass) | May–Sep | Jun–Jul |
| Mediterranean Sea: `western-med`, `adriatic`, `aegean`, `portugal-morocco` | `flash` (*Luciola*) | May–Jun | Jun |
| Eastern North America: `florida-carolinas`, `maine`, `fundy`, `nova-scotia` | `flash` (*Photinus*, J streaks) | Jun–Aug (`florida-carolinas` May–Sep) | mid-Jun – early Jul |
| Japan, Taiwan, Korea: `south-japan`, `japan`, `taiwan-south-china`, `yellow-sea` | `flash` (Genji, Heike) | May–Jul | Jun |
| South-East Asia mangroves: `indonesia`, `philippines`, `mainland-se-asia`, `sumatra-java-south` | `synchronous` on mangrove crowns, only with `mangroves` | all year; Nov–Dec ×1, Jan–Mar ×0.4 (Selangor 6% vs 2%) | Nov–Dec |

Months outside the peak ×0.4 *(est.)*. Everything else: none (polar, boreal, arid, the Pacific
coast of North America, New Zealand, Australia, Africa, South America: no source, NATURE.md §3).

- **When:** `timeOfDay` night, or blue hour with `evening` true (they start at dusk; none at dawn).
  Glow-worms from ~22:00 local: night only.
- **Moon:** ×0.3 when the moon is up and over 70% lit (glow-worm guides; Sabah: weak on full-moon
  nights).
- **Weather:** none in rain, drizzle, storm (`stormy`) or snow; ×0.3 in fog; none with
  `ocean.windSpeed` over 4 m/s *(est.: they fly on still, warm evenings)*.
- **On what:** land with grass or bushes within 5–60 m and in frame (`ctx.visible`): `flash`
  0.5–3 m above grass and bushes (Photinus flies up to 3 m), `glow` on the grass, `synchronous`
  in mangrove crowns. Never over sand, bare rock or water.
- **Chance** per eligible evening at the peak 0.7; **count** in view 20–150 for `flash` and
  `synchronous`, 3–30 for `glow` *(est.)*; of `flash`, only those mid-flash show (½–1 s lit in a
  5–7 s cycle: ~15%).

**Brightness (research, NATURE.md §3):** 10¹⁰–10¹¹ photons per flash (Silver 2026, *Am. J. Phys.*;
the classic 10¹³–10¹⁴ is now thought ~1000× too high, and "real fireflies look much dimmer than
LEDs"). At 562 nm over a 0.5 s flash, into a hemisphere: **I ≈ 7.6 × 10⁻⁶ cd** (upper bound;
10× less at the low end). As seen from the camera that's a star of magnitude **+0.3 at 2 m, +2.3
at 5 m, +3.8 at 10 m, +5.3 at 20 m, +6.8 at 40 m**. So render each light as a point of that
apparent magnitude through the same path as stars (`stars.ts` maps V magnitude to luminance), and
it lands right in the night exposure by construction. Glow-worms: the same intensity, steady.
Colour: yellow-green, linear `[0.66, 1.0, 0.035]` (normalised, ~562 nm).

**Streak (answer 3):** one flash at flight speed. Speed 0.6–1.5 m/s (an older photometry paper,
2–5 ft/s), and they slow and arc while flashing, so a lit trace is **~0.3–0.8 m**. `flash` =
a thin additive ribbon along a J (the bottom and upswing of a U arc) for *Photinus*, a short
straight or gently curved dash for *Luciola* and Japanese species *(est.)*; brightest mid-trace,
fading at the ends; total light conserved (the magnitude above spread along the ribbon). `glow`
and `synchronous`: dots. Geometry, not motion blur, so the 16 render frames agree. Move-around
mode: flashes ½–1 s every 5–7 s, `synchronous` all together, `glow` steady.

**Before the first render:** count eligible days with `--rendered` and vegetation in frame;
`scripts/mesh.mjs` for the ribbon; forced spec (`fireflies: 'flash'`, `timeOfDay: 'night'`,
`eclipse: null`, a moonless date) beside real days (`snapshot.mjs --where 'p =>
p.props.fireflies != null' --sample 8`); `params.debug.probe` on a near and a far firefly against
the magnitudes above.

**Done when:** near fireflies read as clear points or short J streaks, far ones fade out by ~40 m;
none by day, on dawn blue hour, in rain or on open sea; ≤ 5% render time (`bench.mjs`).

**Tests:** `test/fireflies.test.ts`: the table over every place × month; none by day, at dawn,
in rain, wind, on open sea or snow; fewer under a full moon (`expectShare`); placements over
vegetation only; magnitude by distance against the numbers above; deterministic; off switch
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
| Monarchs (new) | `california` late Oct – Feb, clustered on eucalyptus and pine near the camera | place, month |

After each: `node scripts/animals.mjs`, paste into ANIMALS.md with its rule in "Seasons".

## 5. Atacama desert bloom (answer 4) — scope question

**The count:** `atacama-peru` has 15 days in three years, 1 of them on land in Sep–Nov. With a
bloom one year in three, it shows on **~0.3 days in three years**. Building it is ~2 h for a look
that will almost never appear (the move-around mode doesn't change that: it's about the date, not
the camera). Options: keep it researched only; or widen to coasts with a yearly bloom (Namaqualand
on the `cape`'s west coast, Aug–Sep, every year, not researched yet).

If built: `desertBloomFor(params)` on `atacama-peru`, local months: ramp 1–20 Sep, full 20 Sep –
31 Oct, fading to 20 Nov (UC: mid-Sep to mid-Nov; peak ~2 months after rain). A bloom year with
chance 0.37 (13 events in 35 years, satellite), strength drawn on the same stream: 1 in 3 bloom
years strong (≈ once in 8 years, matching "every five to ten years" for big ones), the rest weak
and patchy near the coast.

- **Near the viewer:** new `FLOWERS` kinds on sand and ground: *Cistanthe longiscapa* magenta
  `[0.46, 0.02, 0.26]` with its yellow form `[0.65, 0.44, 0.02]` (Caldera 2021: big purple and
  yellow patches), *Nolana* pale lilac `[0.38, 0.35, 0.60]` (Frontiers 2022, UC).
- **Far land:** ground cover, landforms' and islands' lower slopes tinted toward magenta by
  strength × 0.5, in purple and yellow patches (a world-space noise), as `groundCoverTint` does for
  dry grass.

## 6. Fungi and fairy rings (answer 4)

**Fairy rings (far-off sign)** (RHS, Utah State herbarium, Britannica):

- A ring of **darker, taller grass** at the advancing edge (extra nitrogen), often with a band of
  dead or thin grass just inside it; diameters commonly **2–10 m** (over 10 m sometimes; huge
  rings of hundreds of metres are rare and old); grows 20–30 cm a year, lasts decades.
- **Where:** grass on land (machair, dune grassland, cliff-top turf) in temperate, boreal and
  Mediterranean climates; 0–3 per hectare *(est.)*; not on sand, heath or under trees.
- **Look:** dark band 0.3–0.6 m wide `[0.04, 0.115, 0.02]` against the usual ground cover
  `[0.08, 0.13, 0.05]`; inner dead band 0.2–0.4 m straw *(est. widths)*. Visible in the growing
  season (temperate Apr–Oct, boreal Jun–Sep, Mediterranean Nov–May); faint otherwise *(est.)*.
- **Code:** a world-space cell hash for ring centre and radius in the terrain's ground-cover
  shader (like `litterMap`), so rings are fixed in the world.

**Mushrooms (near the viewer):** `fungiFor(params, rng)`:

- **Season** by climate (NATURE.md §2): temperate Sep–Nov (+ a weak May–Jun flush ×0.2), boreal
  Aug–Oct, Mediterranean Oct–Dec, polar Jul–Aug, tropical and subtropical in the wet months
  (none in a `drySeason`), arid none; ×1.5 on rain, drizzle or fog days *(est.)*.
- **Kinds by ground:** fly agaric (red cap with white warts, 8–20 cm) under birch and conifer;
  brown boletes (10–20 cm) under conifer, birch and broadleaf; saffron milk caps (orange, 5–10 cm)
  under Mediterranean pines; field and fairy-ring mushrooms (white or tan, 3–8 cm) on grass, on the
  ring's dark band when a ring is near *(est.: field-guide knowledge)*.
- **Meshes:** cap + stem, base at y = 0, ~200 tris, instanced; placed by cell hash under each crown
  within ~15 m of the camera (leaf-litter pattern).
- **Done when:** a forced temperate October framed forest day shows a few caps near the camera and
  a ring on the grass further off; nothing out of season.

## Still open

- Phase 5's scope: build it, keep it researched only, or widen to Namaqualand?
- Every *(est.)* above: shares, colours, widths, moss factors, firefly counts. Photos and
  `mesh.mjs` decide colours; renders decide shares.

## Checks (all phases)

- Before the first render, per phase: the docs named in CLAUDE.md §1 opened, real sizes from
  photos, the day count with `--rendered`.
- `diff.mjs` for visibility with each off switch on a clear and a cloudy day; real days in the
  first render round; `bench.mjs` (phase 3 ≤ 5%; every other phase ~0%).
- `npm test` and `npx tsc --noEmit`; `params.mjs --ref HEAD` for the changelog row.
- Docs: changelog.md, ARCHITECTURE.md (new tables in "Biome, climate or place"), `arch/PROPS.md`,
  SEASONS.md pointer, ANIMALS.md, SCENE_SPECS.md, REFERENCES.md, NATURE.md for new numbers.
