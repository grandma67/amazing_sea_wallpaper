# Nature plan: blossom, moss and weed, fireflies, animal seasons, desert bloom, fungi

Bring the remaining living things on a coast into the season. Research and numbers:
[NATURE.md](../NATURE.md). Builds on the seasons work ([SEASONS_PLAN.md](SEASONS_PLAN.md):
`phenology.ts`, `animalSeasons.ts`) and on PLAN_BIOMES phase 14 (the new animals). TODO 24
(flowers by biome and month) is phase 1; TODO 22 (fireflies) is phase 3.

## Status

| Phase | What | Days touched (of 1095, measured) | Estimate | Status |
|---|---|---|---|---|
| 1 | Blossom: flamboyant, rock rose, heather | flamboyant **24** land days in full bloom, **109** with scattered trees; rock rose ~13; heath near the camera on **14** rock-shore days, on far slopes on the heath places' 9 beach days when a landform or island is in frame | 3–4 h | planned |
| 1b | Blossom: gorse, pōhutukawa, wattle (Answers 2026-11-12 b) | land days measured 2026-11-12: gorse **6** full (Apr–May), **14** at ×0.4, 16 at ×0.1; wattle **2** full, 1 at ×0.3; pōhutukawa **1** in its window; in frame: `--project vegetation` once built | 2–3 h | planned |
| 2 + 2b | Moss on rock and trunks by realistic rules; upper-shore weed by season (built together: both edit the rock-shore shader) | every boulder, rock-shore and forest day a little; weed on European Atlantic rock shores | 5–7 h | planned |
| 3 | Fireflies and glow-worms, single-flash streaks | **11** eligible land nights (recounted 2026-11-12 with the dusk rule); **~4** after the wind, rain and mangrove rules; fewer after moon and in-frame filters | 5–7 h | planned (build: real on those nights) |
| 4 | Seasons for PLAN_BIOMES 14 animals; a `eucalyptus` kind (Australia native, California groves) for the monarchs | per animal; eucalyptus on every Australian and Californian land day with trees | ~0.5 h each + the animal (2–4 h each, own plan); eucalyptus 2–3 h | with phase 14 |
| 5 | Coast blooms: Peru's lomas (yearly), the Atacama's *desierto florido* (El Niño years), Namaqualand and the Cape West Coast (yearly); first close the two place gaps that hold them | measured with 5a applied: lomas 3 land days Jun–Nov, **~0.5** with hills high enough in frame; desert bloom **0** Sep–Nov; Namaqualand **1** (July, ×0.4); 5a changes 95 days | 4–6 h (5a ~1 h, its own commit) | planned (build) |
| 6 | Fairy rings (far) and mushrooms (near) | rings: **124** land days in a growing season (before grass-in-frame); mushrooms: **80** in season; under trees ~5–10 with a tree within 15 m in frame *(leaf-litter analogue: 14)*, on grass more (count with `--project fungi` once built) | 3–5 h | planned |
| 0a | Real assets, measure only: fetch CC0 photos, textures and scans and measure sizes and colours (Fab/Megascans excluded) | every phase's colours | ~0.5–1 h + ~15 min per asset | before phase 1 |
| 0b | Real assets, mesh bake: reduce, bake to vertex colours, emit, check; proved on one mushroom | phase 6 meshes, phase 4 animals | 1–1.5 h + ~1 h per asset | before phase 6 |

Estimates are my working hours including research, tests, ~3 render rounds and docs, from past
commits (leaf litter ~1 h after its plan, snow and ice foot 1–2 h, Baltic sea ice ~6 h). Phases
0–3, 5 and 6: about 22–33 h, plus review between phases. Every phase is a build phase; phase 4
builds with each PLAN_BIOMES phase-14 animal.

**Order:** 0a → 1 → 1b → 2 + 2b → 0b → 6 (fairy rings avoid phase 1's heath mask; mushrooms sit under trees whose
trunks phase 2 changes) → 3 (independent of the others) → 5 (5a's place change re-rolls
days, so it goes in last, in its own commit) → 4 with each phase-14 animal. Counts are `params.mjs --stats` windows
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
4. **Near the viewer, and far-off land coloured:** the bloom tints far ground (phase 5);
   mushrooms stay near the camera; **fairy rings** are the far-off sign of fungi.
5. **No towns:** confirmed in the code (only the night horizon's town glow, `nightGlow.ts`, and the
   lighthouse). Jacaranda and planted cherries stay out.

## Answers (2026-11-12)

**Rule for every open question: whatever is more realistic.** A thing that happens on a real
coast on that date gets built, however rarely it's in frame (the move-around mode will see more
of it). So:

1. **Phase 3 is built.** Recount: 11 eligible land nights in three years (the glow-worm dusk rule
   added none: no Atlantic-Europe evening blue hour in May–Sep falls on a test day). Research
   changed the weather rules (glow-worm females glow in wind and rain; only flying males stop),
   see phase 3.
2. **Phase 5 is built, and wider:** Peru's lomas bloom every winter (Jun–Nov); the Atacama's
   desert bloom and Namaqualand's lie in two **gaps in the place table** (26–30°S Chile, 29–33°S
   South Africa: real coast that no place draws). Closing them is more realistic, so 5a does it.
3. **Phase 0 uses CC0 only; Fab/Megascans excluded.** Not a realism question but a licence one:
   Fab's Standard License forbids standalone redistribution and requires that end users can't
   extract the asset; a public web build serves every mesh to the browser, so nothing in it can
   be made unextractable. CC0 (Poly Haven, ambientCG, Smithsonian CC0) covers every row.
4. **The *(est.)* values stay estimates until each phase's photo and render steps check them**:
   those are build steps, not open questions.

## Answers (2026-11-12, second round)

1. **Gorse, pōhutukawa and wattle are built** as phase 1b, after phase 1 (common flowers).
2. **Monarchs get a `eucalyptus` kind**, which Australia needs anyway: the eucalypts are its
   native coast trees, and today no Australian coast draws one.
3. **Phase 0 is split:** 0a (fetch and measure) before phase 1, 0b (reduce, bake, emit) before
   phase 6, where the first scanned mesh is needed.
4. **Research gaps closed** (NATURE.md §8, 2026-11-12 rows): Pacific laver (2b), sea lettuce's
   season (2b), subtropical and polar fungi (6), fireflies in Sri Lanka, Brazil and the Pacific
   Northwest and their colour (3), desert-bloom timing and Baja (5).
5. **Checked in the code:** lomas need hills that the terrain doesn't draw (5b); 5a's re-roll
   measured (5a).

## Decisions

- **Not random where it follows the calendar.** Blossom, moss, weed and the animal seasons follow
  date, climate, place and hemisphere: thresholds and colours, no new draws (as phenology). Which
  crown blooms comes from `hash()` of its position, like autumn leaves.
- **New randomness gets its own stream:** fireflies `ctx.rng('fireflies')`, fungi
  `ctx.rng('fungi')`, the bloom year `Random.derive(\`amazing-sea:${year}\`,
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
  | `fungi` | `boolean \| null` | true: mushrooms under the trees and on the grass near the camera, as in the peak month | `props.fungi: false` |
  | `fairyRings` | `boolean \| null` | true: rings on the grass near and far, as in the growing season | `props.fairyRings: false` |
  | `desertBloom` (phase 5) | `boolean \| number \| null` | true: a strong bloom; 0..1: its strength | via `props.phenology` |

  `props.phenology: false` also turns off phases 1, 2 (colour by wetness), 2b and 5 (lomas included).
- **Ready for the move-around mode:** what a thing is comes from its world position (a crown's
  hash, a fungus or ring cell's hash); only the choice of what to draw reads the camera
  (`props/leafLitter.ts` pattern).
- **Colours:** linear albedo, estimated from typical photo colours (sRGB → linear, ×0.8 for
  petals). Every value is *(est.)* until checked with `scripts/mesh.mjs --sun 8` against 2–3
  reference photos per row.

## 0. Real assets: scans, textures and photos for plants and animals

Today every mesh is procedural with colour baked into vertices (`props/*.ts` builders); the only
files loaded are sky and cloud data in `public/assets/` (4.7 MB, `src/assets.ts`). No textures,
no glTF. This step adds real reference data without changing that runtime model: scans and
textures are **inputs to an offline bake**, not files the page streams.

**Sources (licence checked per file; record each in REFERENCES.md with its URL and licence):**

| Source | What | Licence | Use for |
|---|---|---|---|
| [Poly Haven](https://polyhaven.com/license) models and textures | scanned plants, rocks, ground, bark | CC0 | shrub and ground-cover shapes, bark and moss albedo |
| [ambientCG](https://ambientcg.com) | PBR materials (moss, lichen, bark, ground, sand) | CC0 | albedo means and variation for moss, lichen, heath, turf |
| [Smithsonian 3D, CC0 filter](https://3d.si.edu/cc0) (bulk: [Source Cooperative mirror](https://source.coop/harvard-lil/smithsonian-open-access)) | natural-history specimens, OBJ/glTF | CC0 **per object** (some, e.g. Human Origins, are non-commercial: skip) | animal proportions and sizes (phase 4) |
| Sketchfab CC-BY scans | fungi, animals, flowers | CC-BY (attribution in REFERENCES.md and the page credits) | only where no CC0 exists |
| iNaturalist research-grade / Wikimedia Commons photos | the 2–3 reference photos per row | CC-BY / CC0 per photo | colours and shapes (the *(est.)* values below) |
| Fab / Megascans | high-quality scans | Fab Standard licence: product use allowed, **raw asset redistribution not**; the licence summary also requires that end users can't extract the asset, and a public web build serves every mesh to the browser: **excluded** (Answers 2026-11-12; [Fab licences](https://dev.epicgames.com/documentation/fab/licenses-and-pricing-in-fab), [forum](https://forums.unrealengine.com/t/can-i-use-3d-assets-from-fab-s-standard-license-in-a-revenue-generating-web-app/2453541): no official answer) | – |

**Pipeline** (`scripts/asset.mjs`, new; sources in a git-ignored `assets-src/`, only outputs
committed):
1. **Fetch** by URL into `assets-src/<id>/` with a `source.json` (URL, licence, author, date).
2. **Measure**: real size (bounding box, scale from the scan's metadata or a photo with a known
   object), and the albedo's linear mean and spread per material region (sRGB → linear; ×0.8 for
   petals as in Decisions). These replace *(est.)* colours in the tables below.
3. **Reduce** (`@gltf-transform/core` + `functions`, devDependency): weld, simplify to the
   budget (props ≤ ~5k tris per instance, CLAUDE.md's 100k per mesh), drop UVs after baking.
4. **Bake** the texture into vertex colours (sample the albedo at each vertex after a light
   subdivide where the texture has detail the mesh doesn't), so the result is a `vertexColors`
   mesh like today's. Leaf, petal and moss cards: a small baked palette per card instead of a
   texture.
5. **Emit** a compact typed-array module (`src/props/scans/<id>.ts`: positions, normals, colours,
   indices, quantised) or a `public/assets/<id>.bin` loaded via `assets.ts` for anything over
   ~50 kB; budget for all scans together ~2 MB.
6. **Check**: `expectMesh` row (`meshes.test.ts`: real size, finite, budget), `scripts/mesh.mjs
   --sun 8` beside the reference photo, then `--project KIND` as usual.

Procedural builders stay where they're already right (trees, rocks); a scan replaces a builder
only when `mesh.mjs` beside a photo shows it reads better at the distance it's seen. Per phase:
flamboyant flower and cistus flower colour from photos (phase 1); heather albedo near and from
~300 m (phase 1); moss, lichen and laver albedo from ambientCG/Poly Haven materials and photos
(phase 2, 2b); a fly agaric, a bolete, a field mushroom scan (phase 6); phase 14 animals from
Smithsonian specimens (proportions) and photos (colour).

**Split (Answers 2026-11-12 b):**
- **0a, before phase 1:** steps 1–2 only (fetch, measure). Phases 1, 1b, 2 and 2b need colours
  and sizes, not meshes. **Done when:** `node scripts/asset.mjs measure <url>` writes
  `source.json` and the measured size and linear colour mean and spread per region; flamboyant,
  cistus and heather measured and their *(est.)* colours replaced.
- **0b, before phase 6:** steps 3–6 (reduce, bake, emit, check), adding `@gltf-transform` then.
  **Done when:** `node scripts/asset.mjs <url>` produces a baked mesh with its measured size and
  colours, its licence recorded; one scan (a mushroom) through every step to prove the pipeline.

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
| With `drySeason` (`north-australia`, `nw-australia`, `west-africa`, `central-america`, `east-africa`, `northeast-brazil`, `indonesia`, in their latitudes) | the dry season's last 6 weeks and the rains' first 6 weeks (see "Window" below) | 1 | timing: World Agroforestry DB, Yucatán; 6 weeks *(est.)* |
| `india` (15–22°N, as its `drySeason`) | Apr–Jun | 1 | Indian Forester: first week Apr – last week Jun |
| `antilles`, `lesser-antilles-volcanic`, `bahamas-bermuda`, `yucatan-belize` | May–Sep, peak Jun | 1 | Caribbean table |
| `mainland-se-asia` | May–Jul | 1 | Vietnam |
| `philippines`, `pacific-islands`, `hawaii`, `sri-lanka`, `andaman-lakshadweep`, `sumatra-java-south`, `maldives`, `comoros`, `reunion-mauritius`, and the parts of the first row's places outside their dry-season latitudes | any month | 0.2 (scattered trees) | Singapore: no pronounced season *(est. for the rest)* |
| `galapagos` | none | 0 | native flora; planted only in towns *(est.)* |

- **Window, in days:** `DrySeason.months` is whole months, so the window uses the same day-of-year
  arithmetic as `savannaDry` (`phenology.ts`): `end` = the 1st of the month after `months[1]`;
  bloom ramps in over `end − 45 … end − 30`, full `end − 30 … end + 30`, out by `end + 45`
  (6 weeks each side, with 2-week ramps) *(est. ramps)*. India (`months: [12, 5]`): end = 1 Jun,
  bloom 17 Apr – 16 Jul, near the Indian Forester's Apr–Jun.
- **"In their latitudes"** already exists: `DrySeason.latitudeDeg` and `wetCoast` (`places.ts`),
  read by `savannaDry`. Extract its test into `onDryCoast(day): DrySeason | undefined` and use it
  for both; outside it, those places fall to the 0.2 "scattered trees" row.
- **Share:** 0.15 of `broadleaf` crowns × strength *(est.)*. Tropical broadleaf is 1.5 of 14.5
  vegetation weight, so ~1.5% of trees: about one flamboyant per framed view at full strength.
  Measured windows (land days in three years): **24** in full bloom, **109** with the 0.2
  scattered strength, 55 in a dry-season place out of its window, the rest no flamboyant. Measure
  the in-frame share with `--project vegetation` once the choice exists.
- **Leaves:** in seasonally dry places the tree flowers while bare and new leaves come **with** the
  flowers once the rains return (World Agroforestry: leafless Mar–May in India, new leaves May–Jun;
  Singapore: "new leaves produced with new flowers" after the rains). So a blooming crown's
  `bareOn` is 0.4 from window start to `end` (late dry season) and ramps linearly back to the
  climate's `on` by `end + 45` *(0.4 est.)*. The 0.2-strength rows (no clear dry season: "each tree
  its own rhythm", leaves before flowers) keep the climate's `on`. Blossom share of a blooming
  crown's leaf cards 0.8, falling to 0.5 as the leaves return *(est.)*.
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
- **Far tint:** mix the far canopy colour toward the crown's mean flower colour by
  0.4 × 0.25 × `bushShare`, where `bushShare` = the `bush` weight ÷ the total non-grass weight of
  the day's plant pool: the same `plants` list and weighting `canopyTint` (`phenology.ts`) already
  uses for the deciduous share. A faint pink-white haze on far maquis *(est.)*.

### Heather (*Calluna*, with bell heather), ground cover

- **Places (heath):** `cornwall-wales`, `brittany`, `ireland`, `scotland`, `norway-west` (Norway's
  coastal heath *(est.)*). Not `baltic`.
- **Where:** near the camera, the land behind a `rock-shore` coast (platform, boulder and cliff-top
  compositions) in those places, not dunes, machair or under trees; far off, landforms' and islands'
  lower slopes in those places on every coast type (a beach day's headland is heath too).
  **Patchy**: a world-space noise mask with ~35% cover *(est.)*. The mask is noise only: aspect
  (patchier on cooler slopes, tight and a few cm high on exposed tops: British Plant Communities)
  is not modelled, since height a few cm doesn't change geometry and our ground cover has no
  aspect term to key it to. Revisit if renders of far slopes look uniform. Measured: 14 rock-shore days get
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

## 1b. Gorse, pōhutukawa, wattle (Answers 2026-11-12 b)

Same machinery as phase 1 (`BLOOM` rows, hashed crowns, far tint by `bushShare` or the
broadleaf share). Research: NATURE.md §1.1–1.2.

| Plant | Our kind | Places | Months (local) | Share | Colour *(est.)* | Source |
|---|---|---|---|---|---|---|
| Common gorse (*Ulex europaeus*) | `bush` | `cornwall-wales`, `brittany`, `ireland`, `scotland`, `bristol-channel`, `morecambe-bay`; invasive in `new-zealand-south`, `new-zealand-north`, `tasmania`, `central-chile` | full Apr–May; Jan–Mar and Jun ×0.4; Jul–Dec ×0.1 (a few flowers all year in mild winters; two strains) | 0.5 of `bush` crowns, 0.5 of their leaf cards (gorse is dense with flowers) | yellow `[0.70, 0.50, 0.02]` | Woodland Trust, Dorset Nature, Lincolnshire Life |
| Pōhutukawa (*Metrosideros excelsa*) | `broadleaf` | `new-zealand-north`, on the coast's first trees (s within 60 m of the shore) | full 15 Dec – 5 Jan; ramps 15 Nov → 15 Dec and 5 → 15 Jan | 0.6 of near-shore `broadleaf` crowns, 0.7 of their leaf cards | crimson `[0.45, 0.02, 0.03]` | RNZ, Te Papa, NZ Herald |
| Coastal and golden wattle (*Acacia longifolia*, *A. pycnantha*) | `bush` | `east-australia`, `tasmania`, `sw-australia` *(est.)* | full late Aug – Sep; Jul and Oct–Nov ×0.3 | 0.35 of `bush` crowns, 0.5 of their leaf cards | yellow `[0.72, 0.55, 0.03]` | Australian floral emblem page, lawn.com.au |

- **Gorse and phase 1's heath** overlap in Atlantic Europe: gorse is on `bush`, heath on ground
  cover, so both show (Cornish cliff tops: western gorse with heather, NATURE.md §8).
- **Far tint:** gorse and wattle as rock rose (0.4 × leaf share × `bushShare`); pōhutukawa a
  crimson line along the near coast, so no far tint beyond 60 m.
- **First step:** count the land days in each window (`--stats`) and the in-frame share with
  `--project vegetation`; colours from phase 0a.
- **Done when:** a forced Cornish May cliff top yellow gorse beside green heath; a Christmas
  `new-zealand-north` beach crimson crowns along the shore; a September NSW headland yellow
  wattle; other months and places unchanged.
- **Tests:** in `test/bloom.test.ts`: the rows over every place × month, the pōhutukawa shore
  limit, gorse and heath on the same day.

## 2. Moss on rock and trunks

**Rules** (NATURE.md §4): amount = climate × place factor × spray shelter × face; colour = today's
wetness. No draws.

- **Amount by climate** `MOSS`: temperate 1, boreal 1, polar 0.5, tropical 0.6, subtropical 0.5,
  Mediterranean 0.4, arid 0 *(est.)*; place factor 1.3 for the wettest, foggiest coasts
  (`se-alaska`, `british-columbia`, `pacific-northwest`, `norway-west`, `ireland`, `scotland`,
  `new-zealand-south`, `patagonia-fjords`, `tasmania`) *(est.)*. Replaces `GROWTH[biome].moss`
  (`props/rocks.ts`) and feeds the rock shore and trunks. **Only the amount moves**: the green
  stays `GROWTH[biome].mossColor` (moss species follow the rock's region with the lichen and
  algae, Decisions "Keys"); trunks use the same colour as the rocks around them. Phase 0's
  ambientCG/Poly Haven moss materials check those colours.
- **Spray belt:** the yellow-grey lichen zone above the black *Verrucaria* band is ~1 m high on
  sheltered shores and tens of metres up cliffs on very exposed ones (JNCC, EUNIS B3.11). Lichen
  zones grow over years, so the belt follows the **coast's exposure, not today's swell or tide**:
  - **Measured from** the spring high water plus run-up, the reference the rock-shore shader
    already uses for its black band (`above = h − tideSpring − runup`, `terrain.ts`); boulders on a
    beach from their `wetLine` (`runup × 1.3`, `props/rocks.ts`) above sea level.
  - **Height** `sprayBelt` (m above that line), a place field with a default by climate from the
    typical swell: the swell table's weighted mean is 0.62 m (0.73 m on temperate and boreal coasts,
    `BIG_SWELL`), so default `1 + 4 × mean swell` *(est. mapping)*: **3.9 m** for temperate and
    boreal places, **3.5 m** for every other climate (polar, Mediterranean, subtropical,
    tropical, arid). A place in two climates takes its main climate's default.
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
  wettest season there). **The first rule that matches wins** (so a rainy August day on the
  Mediterranean is 1, not the drought value):
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
  `[0.05, 0.025, 0.03]` patchy band in the littoral fringe just below the black lichen (the
  Atlantic row; Pacific below).
  **All year** on `norway-west`, `norway-north`, `iceland-faroe`, `scotland`; **Nov–Apr** on
  `ireland`, `cornwall-wales`, `brittany`, `bristol-channel`, and `portugal-morocco` **north of
  41°N** only (its range ends in northern Portugal; absent in summer in the south: MarLIN).
- **Pacific laver** (researched 2026-11-12): NE Pacific *Pyropia* (*P. columbiensis*,
  *Porphyra mumfordii*, black seaweed *P. abbottiae*) grows in the upper mid to high intertidal on
  bare rock, mainly **winter and early spring** (Calvert Island, BC, to Cape Mendocino; a few to
  midsummer: Lindstrom 2015, UBC, Hakai). Rows: `british-columbia`, `pacific-northwest`,
  `se-alaska` *(est.: black seaweed is harvested in Alaska in spring)*, `california` north of
  40°N: **Dec–Apr**, May–Jun ×0.3. Japan: wild iwanori thalli come up in autumn and early winter
  on high rocky shore (FAO): `japan`, `south-japan` **Nov–Mar** *(est.: no wild calendar found)*.
  Same colour as the Atlantic row.
- **Sea lettuce** (*Ulva*): a brighter green fleck `[0.06, 0.16, 0.03]` on the same rock,
  **Apr–Sep** ×1, ×0.3 otherwise. Resolved 2026-11-12: English Channel wrack is mostly *Ulva* in
  spring and summer (Lemesle et al. 2023) and *Ulva* mats bloom in summer (Franklin et al. 2025);
  subarctic shores grow fast from early spring (Murman coast); the earlier conflict came from an
  outfall site and a UK prediction, not seasonal surveys.
- **Done when:** `diff.mjs --crop` on a Scottish and a Cornish rock-shore platform, January and
  July: the band in both in January, only in Scotland in July; a British Columbia platform in
  February with the band, in August without. Tests: the table over every place × month, the 41°N
  and 40°N limits.

## 3. Fireflies and glow-worms (TODO 22)

**Scope (built, Answers 2026-11-12):** 11 eligible land nights in three years with the table
and the dusk rule below (`synchronous` 6, `flash` 4, `glow` 1). Of the 6 `synchronous`, mangroves
are drawn on 2 (2024-12-22 north Australia, 2026-01-09 Philippines); of the `flash` nights, 3 have
air wind ≥ 10 m/s and drop out; Japan 2026-06-25 (5.1 m/s, moon up at 0.83) stays at a reduced
chance. So **~4 nights** before moon and "plants in frame". Rare and real: built as designed.

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
| Sri Lanka: `sri-lanka` | `flash`; `synchronous` where mangroves are drawn | May–Jul *(est.)* | Jun ("an important breeding season") | Mongabay 2023, Jetwing; mangroves a main coastal habitat |
| Brazil's Atlantic forest: `south-brazil` | `flash` | Nov–Mar (south-east Brazil's rainy season) *(est.: the review says "rainy season" only)* | – | Bechara & Stevani 2018 review; REGUA (rains from November) |
| Brazil's north-east: `northeast-brazil` | `flash` | Apr–Jul (its rainy season) *(est.)* | – | as above |

Months outside the peak ×0.4 *(est.)*. Everything else: none. Polar, most boreal and arid
coasts; New Zealand (its glowworms are cave gnats); **the Pacific coast of North America,
confirmed** (its fireflies are day-active and don't flash, Ellychnia: UW entomologist via KUOW,
Xerces); Kenya and the rest of Africa (searched 2026-11-12, nothing found). Sri Lanka and Brazil
add no night on the test days (counted 2026-11-12).

- **When:** `timeOfDay === 'night'`, or `'blue-hour'` with `evening` (`params.ts`).
  - **`glow` and our `night`:** `night` is the sun 16–30° down (`SUN_ELEVATION`), which the
    summer sun doesn't reach north of ~50°N in June, ~53°N in July, ~61°N in August: with
    `night` only, the glow-worm rows almost never fire (that's most of why phase 3 counted just 1
    glow-worm night). Glow-worm females start glowing **once ambient light falls to ~1 lux, just
    after sunset**, and glow 1–3 h ([Elgert et al. 2021](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC8397135/)).
    Clear-sky illuminance is ~3.5–2 lux at −6° and ~0.008 lux at −12°
    ([AMS Glossary](https://glossarystaging.ametsoc.net/wiki/Nautical_twilight)), so ~1 lux is
    near **−7°**: the bottom edge of our blue hour (−7 … −2.5°).
  - So `glow`: `night`, or evening `blue-hour` with `sunElevationDeg ≤ −6` (×0.5 there: the
    first females lighting up) *(est.: ~1 lux falls between −6° and −7°; heavier cloud reaches it
    earlier, not modelled)*. At 60°N in June the lowest sun is −6.6°, so Norway's south and the
    southern Baltic get a few glow-worm dusks, as the Finland study's "shortest nights"; north of
    ~62°N in June–July none, which is real.
  - Recounted with this rule (2026-11-12): it adds no night on the test days, but it's what real
    evenings at 50–60°N in June–July do, so it stays.
- **Moon:** ×0.3 when `moonElevationDeg > 2` and `moonIllumination > 0.7` (the same "moon up" test
  `params.ts` uses for moonlit nights; glow-worm guides, Sabah).
- **Weather, by kind** (`ocean.airWindSpeed` is the 10 m wind over the sea; in grass at ~1 m it's
  ~0.6 of that by the log profile *(est.: z₀ 3 cm)*):
  - `flash` (flying males): none in rain, drizzle, storm (`stormy`) or snow; ×0.3 in fog; wind ×1
    up to 4 m/s, linear to 0 at 8 m/s (~2.5–5 m/s at flight height) *(est.: no wind threshold
    found in the literature; insects stop flying in wind, UK glow-worm surveys)*.
  - `synchronous` (perched in mangrove crowns along sheltered creeks): as `flash`, but the wind
    ramp runs 6 → 10 m/s *(est.)*.
  - `glow` (females on the grass, not flying): **not stopped by wind or rain** (more unmated
    females glow in wet and windy weather because males don't fly: Burgess, Isle of Wight, citing
    Tyler 2011 and Hopkins et al. 2015); none in snow or a storm (`stormy`, est.); fog ×1.
- **On what:** land with grass or bushes 5–60 m away and in frame (`ctx.visible`): `flash` 0.5–3 m
  above grass and bushes, `glow` on the grass, `synchronous` in mangrove crowns. Never over sand,
  bare rock or water.
- **Chance** per eligible evening at the peak 0.7 *(est.)*, × the month, moon and fog factors:
  one draw from `ctx.rng('fireflies')` decides whether **any** fireflies are out tonight. If they
  are, the count below follows from density alone, without a second scaling by the same
  factors. The month factor scales both (fewer nights with a display, and fewer per display).
- **Count from density × the vegetated area in view** (5–60 m, in frame), so near and far come out
  right on their own:
  - `flash`: **0.15 males per m²** (*Photinus carolinus* emergence traps: one per 13 m², 3.6 m
    apart; displaying males also cluster, so ×0.5–2 by a patch noise), × the month factor; of
    those, the share **lit in the frame** is ½–1 s in a 5–7 s cycle, **~15%**, and only those are
    drawn. E.g. 1000 m² of grass in view at the peak: ~150 flying, **~20 lit**.
  - `glow`: glowing females are **0.1–19 per 100 m** of walked path at Essex sites (most sites
    ~5–17); as an area density, a path sees ~1 m each side, so **~0.05 per m²** at a good site,
    ×(0.01–1) by a site hash *(est. conversion)*; all lit (steady). Mostly 22:00–00:00 (Essex
    surveys start then; most stop by midnight); when: see "`glow` and our `night`" above.
  - `synchronous`: per mangrove crown in view, 20–200 on a display tree *(est.)*, on 1 in 5
    crowns *(est.)* (display trees are few; some sit empty for months: Selangor survey); all lit
    together in the frame.
  - Budget cap: 400 drawn lights *(est.)*.

**Brightness:** 10¹⁰–10¹¹ photons per flash (Silver 2026, *Am. J. Phys.*; the classic 10¹³–10¹⁴
is ~1000× too high, and "real fireflies look much dimmer than LEDs"). At 562 nm over a 0.5 s
flash, into a hemisphere: **I ≈ 7.6 × 10⁻⁶ cd** (upper bound; ×0.1 at the low end). Seen from the
camera: magnitude **+0.3 at 2 m, +2.3 at 5 m, +3.8 at 10 m, +5.3 at 20 m, +6.8 at 40 m**
(m = −13.99 − 2.5 log₁₀(I / d²)). `glow` the same, steady. Colour `[0.66, 1.0, 0.035]` (~560 nm; *Photinus pyralis* in vivo 557 nm, the luciferase 560–562
nm, longer toward orange in some populations: PubMed 16125663, BMC Evol Biol 2018).

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

**Tests:** `test/fireflies.test.ts`: the table over every place × month; none by day, at dawn,
on open sea or in snow; `flash` none in rain and none at ≥ 8 m/s wind, `glow` still there in
drizzle and at 8 m/s; fewer under a full moon (`expectShare`); placements over
vegetation only; `synchronous` only with mangroves; `glow` in evening blue hour only at
`sunElevationDeg ≤ −6`, never at dawn, and a June 60°N dusk eligible while 64°N isn't; magnitude by distance; deterministic; off switch
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

**Eucalyptus kind (decided 2026-11-12):** monarchs roost on eucalyptus at 75% of California's
sites, and the project draws no eucalyptus anywhere, Australia included, where eucalypts are
the native coast trees. Add `eucalyptus` (`props/trees.ts` builder, `props/vegetation.ts`
`KINDS`): a tall pale or mottled trunk, open crown of hanging grey-green leaf clumps
`[0.06, 0.08, 0.05]` *(est.; colour from 0a)*, evergreen (no autumn), real heights from photos
(coastal eucalypts ~10–30 m *(est.)*). Pools by `PLACE_PLANTS` (`places.ts`): `east-australia`,
`sw-australia`, `tasmania` as a main kind *(weights est.)*; `california` a small weight (planted
groves). Monarchs cluster on it near the camera Oct–Feb, on cypress and pine where none stands.
Wattle (1b) keeps `bush`. Count first: land days with the new kind in frame (`--project
vegetation`); `params.mjs --ref HEAD` (the pools change a prop choice, not params).

After each: `node scripts/animals.mjs`, paste into ANIMALS.md with its rule in "Seasons".

## 5. Coast blooms: lomas, desert bloom, Namaqualand and the Cape West Coast

Built (Answers 2026-11-12). Research: NATURE.md §1.3 and §8.

### 5a. Close the two place gaps (own commit, first)

The table (`places.ts`) has `atacama-peru` to −27°, `central-chile` from −30°; `namibia` to
−29°, `cape` from −33°. The coasts between are real and are where the two big blooms happen:
the *desierto florido* from just north of Copiapó (27.4°S) to just south of Vallenar (28.6°S),
with Caldera, Huasco and Chañaral (26.3°S) (Wikipedia "Desert bloom", UC Chile, Chile Travel
2026); Namaqualand's coast from Kleinzee (29.7°S) and Hondeklip Bay (30.3°S) south through the
Sandveld (Lamberts and Elands Bay, ~32°S) (SANParks, Northern Cape tourism).

| Place | Latitude now → after | km now → after | Why |
|---|---|---|---|
| `atacama-peru` | [−27, −5] → **[−30, −5]** | 3 900 → **4 230** | Atacama Region's coast is the same desert to ~30°S (WWF ecoregion) |
| `namibia` | [−29, −17] → **[−33, −17]** | 2 000 → **2 440** | Namaqualand's coast (Succulent Karoo) and the Sandveld (Lamberts Bay is BWk, ~230 mm a year): arid, foggy, Atlantic only; comment "and Namaqualand, the Sandveld" |
| `cape` | [−35, −33], unchanged | 1 000 | the ocean is drawn before the latitude and independently (`pickOcean` then `latitudeIn`, `params.ts`), so `cape` north of −33° would get Indian-Ocean days: the Sandveld goes to `namibia` instead |

*(km est.: straight coast at ~111 km per degree.)*

- **This re-rolls days, measured 2026-11-12** (the two rows applied, `params.mjs --ref HEAD`, then
  reverted): **95 of 1095 days change** (8.7%), 67 of them to another place; the rest keep their
  place and move only latitude and what follows it (moon, sun, sea, snow). `npm test`: **1 of 942
  fails**, `test/beach.test.ts` "is about 59% sand, 17% mixed, 24% shingle or cobble" (shingle
  0.19 vs 0.24 ± 0.05): it samples real days with `toBeCloseTo`; replace with `expectShare`
  against a `params.mjs --expect` target (CLAUDE.md §4), don't retune the number. Also check
  SCENE_SPECS.md's fixed dates against the 95 (`--list`).
- **Bloom days on the new table** (measured, land days): desert bloom south of 26°S in Sep–Nov
  **0**; Namaqualand and the Sandveld Jul–Oct **1** (2025-07-03, −32.3°, rock shore, a range in
  frame; July ×0.4); Cape West Coast Atlantic Aug–Sep **0**; lomas Jun–Nov **3**
  (2024-07-23, 2024-08-16, 2025-11-30), see 5b.
- Other readers of latitude in these places (snow, sea ice, `drySeason`, reefs, grain): grep
  `atacama-peru`, `namibia`, `cape` and check each still holds at the new edge.

### 5b. Peru's lomas: yearly green and flowers on the fog-facing hills

Lomas are fog-watered plant communities on the coastal hills of Peru and northern Chile, ~200–
1000 m up, facing the sea. Green **Jun/Jul–Nov** under the winter *garúa*; brown and bare Dec–Apr
(Lachay: June–November, best Sep–Oct; Atiquipa: blooms every year Jul–Nov). The yellow
*amancaes* (*Ismene amancaes*) flowers at the start of the wet season (Wikipedia "Lomas", TNC
Atiquipa, Lachay pages).

- **Where:** `atacama-peru` from 6°S to 30°S *(lomas are discontinuous; est.: every hill in that
  range)*; far land only, on slopes 200–1000 m above the sea; never the beach or the camera's
  ground (lomas start inland of the shore).
- **What draws those slopes (checked 2026-11-12):** the terrain's hills behind the shore are 15–45
  m (`coast.hillHeight`, `params.ts` 'hills' stream; `terrain.ts` `hills`), below the lomas belt.
  Only a `range` landform (900–2600 m at 12–45 km, `pickLandform`, desert chance 0.2) reaches it:
  17% of `atacama-peru` land days. So lomas colour the range's vertices between 200 and 1000 m
  (`props/landforms.ts`, by height, in the season), ~0.5 of the 3 days. The real coast has a
  500–1000 m escarpment just behind the shore on most of its length (the Coastal Cordillera):
  that's a terrain gap, planned in [TERRAIN_FORMS.md](TERRAIN_FORMS.md).
- **Colour by local month:** Jul–Oct full: mix the far ground toward an olive green
  `[0.07, 0.09, 0.035]` by 0.5 in noise patches (~50% cover) *(est.)*; Jun and Nov ×0.5;
  Jun–Jul a yellow fleck `[0.55, 0.40, 0.03]` at 0.1 of the green's weight (amancaes) *(est.)*;
  Dec–May none.
- **Counts:** 3 `atacama-peru` land days in Jun–Nov (same with 5a); none has a landform on the
  test days, so 0 in frame today and ~0.5 expected; with the escarpment, all 3.

### 5c. The Atacama's *desierto florido* (El Niño years)

- **When and where:** in a bloom year, `atacama-peru` south of 26°S (Chañaral to Vallenar):
  local ramp 1–20 Sep, full 20 Sep – 31 Oct, fading to 20 Nov. It needs rain in Jun–Jul and over
  ~15 mm (Conaf, Universidad de Chile, 2024). The July 2024 flowers came early from El Niño rain
  and weren't extensive enough to count as a *desierto florido* (Conaf): so an early bloom, Jul–Aug
  at 0.3 strength, in 1 bloom year in 4 *(est.)*.
- **Bloom year:** 0.37 from the per-year stream (13 events in 35 years), 1 in 3 of them strong
  (widespread blooms 1997, 2015; big ones every 5–10 years).
- **Near the viewer:** new `FLOWERS` kinds (`props/shoreLife.ts`): *Cistanthe longiscapa* magenta
  `[0.46, 0.02, 0.26]` (with yellow `[0.65, 0.44, 0.02]` forms), *Nolana* lilac
  `[0.38, 0.35, 0.60]` *(est.)*, on sand and gravel behind the beach.
- **Far land:** ground cover and lower slopes tinted by strength × 0.5 in noise patches.

### 5d. Namaqualand and the Cape West Coast (every year)

- **When:** every year, strength drawn per year 0.3–1 (per-year stream). Namaqualand and the
  Sandveld (`namibia` south of 29°S): Aug–Sep full, Jul and Oct ×0.4; the coast flowers late in
  the season, so the coastal peak is late Aug – mid Sep (SANParks; Northern Cape tourism). Cape
  West Coast (`cape` on an Atlantic day, north of 33.5°S: Postberg): Aug 1 – Sep 30 (West
  Coast NP).
- **Near the viewer:** orange daisy `[0.75, 0.25, 0.02]` (*Ursinia*, *Dimorphotheca*) and white
  `[0.72, 0.70, 0.66]` *(est.)*, new `FLOWERS` kinds, dense patches.
- **Far land:** as 5c. Daisies close when cloudy and open in the sun (well known; *est.*: ×0.3
  colour on overcast and rain days).

### 5e. Baja's Pacific coast after a wet winter

- **When:** a bloom year at 0.3 *(est.: southern California's desert superblooms 2017, 2019,
  2023, 2024; no Baja frequency found)* from the per-year stream: Feb–Mar full, Apr ×0.4
  (hillsides "painted" in Feb–Mar in good years; gone in the 2011–16 drought: a Baja local account;
  rain "consistently over several months", cool nights, seed bank: National Geographic).
- **Where:** `baja-sonora`, Pacific ocean days only (the Gulf side is hyper-arid, flowering after
  hurricanes: Desert Museum); far slopes and ground cover as 5c, with yellow and orange
  `[0.70, 0.45, 0.03]` and purple `[0.30, 0.10, 0.35]` *(est.)*.
- **Counted 2026-11-12:** 0 `baja-sonora` land days in Feb–Apr on the test days (rare in the
  test set, real on the coast: built for the move-around mode and other years).

**Spec and switch:** `desertBloom: boolean | number | null` (true strong, 0..1 strength) forces
5c, 5d and 5e where the place has them; lomas follow the month only (no draw). All under
`props.phenology: false`.

**Done when:** a forced Atacama October (strong) shows magenta near and a tint far; a September
Namaqualand rock shore orange and white; a Peruvian August beach green hills behind; the same
places in February bare (`diff.mjs --off '{"desertBloom":null}'` and the phenology switch).

**Tests:** `test/coastBloom.test.ts`: the tables over every place × month; the bloom year the same
on every day of a year and independent of the spec seed; lomas only Jun–Nov and only in their
latitudes; 5a's new latitudes in `places.test.ts` if one exists.

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
  Aug–Oct, Mediterranean Oct–Dec, polar Jul–Aug (Greenland fruiting peaks Jul–Aug, cited in an
  Arctic fly study, 2026-11-12), arid none.
  - Tropical with a `drySeason`: its wet months ×1, none in the dry months (Thai study; Amazon
    secondary forest lower in dry months).
  - Tropical without one: all year ×0.5 (fruiting more continuous than temperate, but still with
    rain: Yunnan, Pasoh's main and second flushes) *(est.)*.
  - Subtropical: **May–Oct ×1**, Mar–Apr and Nov ×0.5, Dec–Feb ×0.3 (Xalapa's rainy season
    Jun–Oct; Florida: "summer" mushrooms Mar–Nov, prime in the rainy summer, "winter" mushrooms
    late Nov – Feb when wet, water-limited all year: UF/IFAS). *Est. for Natal and south Japan*
    (rain-led as Florida: Natal's summer rains, Japan's tsuyu and autumn).
  - ×1.5 on rain, drizzle or fog days everywhere *(est.)*.
  - Counted: 80 land days in the temperate, boreal, Mediterranean and polar seasons; the tropical
    and subtropical rows add more, to count when built.
- **Kinds by ground** (seasons checked 2026-11-12: fly agaric Aug–Dec, field mushroom May–Nov in
  the UK, Wild Food UK; host trees field-guide knowledge): fly agaric (red cap with white warts,
  8–20 cm) under birch and conifer;
  brown boletes (10–20 cm) under conifer, birch and broadleaf; saffron milk caps (orange, 5–10 cm)
  under Mediterranean pines; field and fairy-ring mushrooms (white or tan, 3–8 cm) on grass, on a
  ring's dark band when one is near *(est.: field-guide knowledge)*.
- **Two placements, both by cell hash within ~15 m of the camera (leaf-litter pattern):**
  - **Under crowns** (mycorrhizal: fly agaric, boletes, saffron milk caps): within the crown's
    radius of each tree trunk of a matching kind.
  - **On open grass, no tree needed** (saprotrophs: field mushroom *Agaricus campestris* scattered
    or in arcs, favouring grazed, manured pasture; fairy-ring champignon *Marasmius oreades* in
    rings; [MykoWeb](https://www.mykoweb.com/CAF/species/Agaricus_campestris.html),
    [MushroomExpert](https://www.mushroomexpert.com/marasmius_oreades)): on grass ground cover
    (machair, cliff-top turf, dune grassland), not sand, heath or under trees; denser along a
    fairy ring's dark band. *Marasmius* shrivels when dry and revives after rain, so on grass the
    rain ×1.5 is ×2 and a dry Mediterranean day ×0.3 *(est.)*.
  - Field mushrooms also have a spring flush in some regions (temperate May–Jun ×0.2, as above).
- **Meshes:** cap + stem, base at y = 0, ~200 tris, instanced; sizes and colours from phase 0's
  scans and photos.
- **Spec:** `fungi: true` forces both placements (under trees and on grass) as in the peak month.
- **Day count:** grass mushrooms reach many more days than the under-tree 5–10 (grass is near the
  camera on most land days): count with `--project fungi` as the first step.
- **Done when:** a forced temperate October framed forest day shows a few caps near the camera
  under the trees; a forced October machair or cliff-top day shows field mushrooms on the grass
  and a ring further off; nothing out of season.

## Still open

Nothing blocks a build. Outside this plan, found while checking 5b:
- **The Atacama's coastal escarpment isn't drawn.** Real: a 500–1000 m wall of the Coastal
  Cordillera rises a few km behind most of the Peru–Chile desert coast; ours has 15–45 m hills
  and a far range on 17% of days. It's realistic and changes every `atacama-peru` day, so it
  has its own plan: [TERRAIN_FORMS.md](TERRAIN_FORMS.md) phase 2 (decided 2026-11-12). Lomas
  (5b) gain all 3 days with it; build 5b's tint on the range now and on the wall once it exists.

Checked during the phases, not asked: every *(est.)*: shares, colours, widths, moss factors,
firefly counts and wind ramps, bloom-year chances. Photos (0a) and `mesh.mjs` decide colours;
renders decide shares.

## Checks (all phases)

- Before the first render, per phase: the docs named in CLAUDE.md §1 opened, real sizes from photos,
  the in-frame count with `--project` / `--rendered`.
- `diff.mjs` for visibility with each off switch on a clear and a cloudy day; real days in the first
  render round; `bench.mjs` (phase 3 ≤ 5%; every other phase ~0%).
- `npm test` and `npx tsc --noEmit`; `params.mjs --ref HEAD` for the changelog row.
- Docs: changelog.md, ARCHITECTURE.md (new tables in "Biome, climate or place"), `arch/PROPS.md`,
  SEASONS.md pointer, ANIMALS.md, SCENE_SPECS.md, REFERENCES.md, NATURE.md for new numbers.
