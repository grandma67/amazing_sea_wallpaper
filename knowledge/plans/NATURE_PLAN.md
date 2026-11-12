# Nature plan: blossom, heath, moss and shore weed, fungi, fireflies, coast blooms, animal seasons

Bring the remaining living things on a coast into the season. Research and numbers:
[NATURE.md](../NATURE.md). Builds on the seasons work ([SEASONS_PLAN.md](SEASONS_PLAN.md):
`phenology.ts`, `animalSeasons.ts`), on PLAN_BIOMES phase 14 (the new animals) and, for the
lomas, on [TERRAIN_FORMS.md](TERRAIN_FORMS.md). TODO 24 (flowers by biome and month) is phases
3–5; TODO 22 (fireflies) is phases 13–14.

## Status

Phases are numbered in build order. Each is one commit and touches one part of the code (a
choice table, a mesh, one shader), so it can be checked on its own.

| # | Phase | Code it touches | Days touched (of 1095, measured) | Estimate | Needs |
|---|---|---|---|---|---|
| 1 | Real assets: measure (fetch CC0 photos, textures, scans; sizes and colours) | `scripts/asset.mjs` (new) | none (data for every later phase) | 0.5–1 h + ~15 min per asset | – |
| 2 | Close two place gaps (Atacama 26–30°S, Namaqualand and the Sandveld 29–33°S) | `places.ts`, one test | **95** days change, 67 to another place | ~1 h | – |
| 3 | Bush blossom: rock rose, gorse, wattle; the `BLOOM` table and far tint | `phenology.ts`, `props/trees.ts` `leaves()` | rock rose ~13; gorse **6** full, 14 at ×0.4, 16 at ×0.1; wattle **2** full, 1 at ×0.3 | 2.5–3.5 h | 1 |
| 4 | Tree blossom: flamboyant (per-crown thinning, dry-season window), pōhutukawa | `phenology.ts`, `places.ts` `onDryCoast`, `props/trees.ts` | flamboyant **24** full, **109** scattered; pōhutukawa **1** | 2.5–3.5 h | 3 |
| 5 | Heath: heather on ground cover by month, near and far | terrain ground-cover shader, landforms, islands | **14** rock-shore days near; far slopes on the heath places' 9 beach days | 1.5–2 h | 1 |
| 6 | `eucalyptus` kind (Australia native, California groves) | `props/trees.ts`, `props/vegetation.ts`, `places.ts` `PLACE_PLANTS` | every Australian and Californian land day with trees (count first) | 2–3 h | 1 |
| 7 | Moss on rock: amount by climate and place, colour by today's wetness | `props/rocks.ts` `GROWTH`, rock-shore shader, `phenology.ts` | every boulder and rock-shore day a little | 2–3 h | 1 |
| 8 | Shore zonation: the spray belt, laver, sea lettuce | rock-shore shader, `places.ts` `sprayBelt` | every rock-shore day (belt); weed on Atlantic, NE Pacific and Japanese rock shores | 2.5–3.5 h | 7 |
| 9 | Moss and lichen on trunks | `props/trees.ts` trunk colours, `props/vegetation.ts` | every forest day a little | 1.5–2 h | 7, 8 (belt), 6 |
| 10 | Fairy rings | terrain ground-cover shader | **124** land days in a growing season (before grass in frame) | 1.5–2 h | 5 (heath mask) |
| 11 | Real assets: bake (reduce, vertex colours, emit, check), proved on one mushroom | `scripts/asset.mjs`, `src/props/scans/` | none (meshes for 12 and 17) | 1–1.5 h + ~1 h per asset | 1 |
| 12 | Mushrooms under trees and on grass | `props/fungi.ts` (new) | **80** land days in season (temperate, boreal, Mediterranean, polar; tropical and subtropical more) | 2–3 h | 9, 10, 11 |
| 13 | Fireflies: the choice table, weather rules, placement and counts (no drawing) | `props/fireflies.ts` `firefliesFor`, `props/choices.ts` | **11** eligible land nights, **~4** after wind, rain and mangroves | 2–3 h | – |
| 14 | Fireflies: drawing (sprites and ribbons, brightness by magnitude, streaks) | `props/fireflies.ts` meshes, star magnitude code | as 13 | 3–4 h | 13 |
| 15 | Lomas: yearly green on Peru's fog hills | `props/landforms.ts` colour by height; later TERRAIN_FORMS's wall | 3 land days Jun–Nov, **~0.5** with hills high enough in frame | 1–1.5 h | 2 |
| 16 | Bloom years: the Atacama's desert bloom, Namaqualand and the Cape West Coast, Baja | per-year streams, `props/shoreLife.ts` `FLOWERS`, far ground tint | desert bloom **0** Sep–Nov; Namaqualand **1** (July, ×0.4); Baja **0** | 2.5–3.5 h | 2 |
| 17 | Animal seasons for PLAN_BIOMES phase 14 (monarchs on eucalyptus) | `animalSeasons.ts` | per animal | ~0.5 h each (+ the animal's own plan) | 6, 11, phase 14 |

Estimates are my working hours including research, tests, ~3 render rounds and docs, from past
commits (leaf litter ~1 h after its plan, snow and ice foot 1–2 h, Baltic sea ice ~6 h). Phases
1–16: about 29–42 h, plus review between phases. Counts are `params.mjs --stats` windows (place,
month, not open sea), measured before phase 2 except phase 2's own; each phase's first step
recounts on the current table and measures the in-frame share (`params.mjs --project KIND`,
`--rendered`) once its choice exists.

**Why this order:** measured colours (1) and the final place table (2) come before anything is
rendered, so no render round is spent on guessed colours or re-rolled days. Blossom goes from the
simplest machinery (bushes: a hashed share of leaf cards) to the new per-crown thinning (4).
Heath (5) comes before fairy rings (10), which must avoid it; eucalyptus (6) before trunk moss
(9), so its smooth bark is there to colour. Moss on rock (7), then the belt that limits it (8),
then trunks, which read both. The mesh bake (11) waits until mushrooms (12) need it. Fireflies'
choice (13) is tested without WebGL before any drawing (14). The bloom phases (15, 16) depend
only on the place gaps (2) and can move anywhere after it.

## Decisions

**How open questions are decided (2026-11-12): whatever is more realistic.** A thing that happens
on a real coast on that date gets built, however rarely it's in frame (the move-around mode will
see more of it). Choices made before that rule stay as made (the stylised firefly streak).

- **What's built:** the common flowers first (flamboyant, rock rose, heather; 2026-11-07), then
  gorse, pōhutukawa and wattle on the same machinery (2026-11-12). Fireflies and glow-worms
  (rare, real). All four coast blooms, plus closing the two place gaps that hold them. A
  `eucalyptus` kind (Australia's native coast trees; the monarchs' roost). Moss on rock and
  trunks by nature's rules: drought, today's wetness, spray from the sea, where water runs
  (NATURE.md §4), not the rock's biome.
- **Not built:** jacaranda and planted cherries (towns; the code has no towns, only the night
  horizon's town glow, `nightGlow.ts`, and the lighthouse). Fab/Megascans (licence: Fab's Standard
  License forbids standalone redistribution and needs the asset unextractable; a public web build
  serves every mesh to the browser). CC0 covers every row.
- **Near and far:** mushrooms only near the camera; fairy rings are fungi's far-off sign; blooms
  tint far ground; heath shows near and on far slopes.
- **Firefly streaks, a deliberate middle ground (2026-11-07):** the eye's persistence (~20 ms +
  ~20 ms decay) would give a 2–10 cm streak; a full ½–1 s flash is what a camera holds at ~½ s
  exposure. We draw the whole flash (~0.3–0.8 m): stylised, while waves and leaves stay sharp.
- **Not random where it follows the calendar.** Blossom, heath, moss, weed, lomas and the animal
  seasons follow date, climate, place and hemisphere: thresholds and colours, no new draws (as
  phenology). Which crown blooms comes from `hash()` of its position, like autumn leaves.
- **New randomness gets its own stream:** fireflies `ctx.rng('fireflies')`, fungi
  `ctx.rng('fungi')`; bloom years one stream per region,
  `Random.derive(\`amazing-sea:${year}\`, 'bloom:atacama' | 'bloom:namaqualand' | 'bloom:baja')`
  (`Random.derive(seed: string, stream)`: one draw per calendar year, so every day of a year
  agrees and a spec `seed` doesn't change it). Nothing draws from the main `rng`.
- **Keys** (ARCHITECTURE.md "Biome, climate or place"; add each table there): every blossom row,
  heath, laver and sea lettuce, firefly regions, lomas and bloom years by **place** (with a
  latitude limit where noted); moss amount by **climate** with a place factor; moss wetness by
  **drought** (place dry seasons and climate); `sprayBelt` a **place** field with a climate
  default; fungi and fairy-ring seasons by **climate**; lichen, algae and moss colours stay by
  **biome** (they follow the rock).
- **Months:** climate rows in northern-equivalent months (`monthInSeason`), place rows in local
  calendar months (as turtle nesting).
- **Spec fields and off switches** (SCENE_SPECS.md "Adding a spec field"; same shapes as `snow`,
  `seaIce`, `leafLitter`). A forced field ignores month, season and weather rules but not physics
  (fireflies still only at night or evening blue hour; nothing on open sea). Each off switch gives
  back today's image exactly (CLAUDE.md §3: check with `diff.mjs --ref HEAD --off … --off-here`):

  | Phase | Spec field | Type | Meaning | Off switch |
  |---|---|---|---|---|
  | 3, 4 | `bloom` | `boolean \| BloomKind[] \| null` | true: every row that grows here, in full flower (nothing where no row grows: the plant isn't there); a list: those rows, also where they don't grow (for testing a look); null/false: none | `props.bloom: false` |
  | 5 | `heath` | `boolean \| 'flower' \| 'brown' \| 'green' \| null` | true: heath where a place has it, today's colour; a stage: that colour; null: none | `props.heath: false` |
  | 6 | – (`vegetation` kinds already force) | – | – | `PLACE_PLANTS` row off: `props.eucalyptus: false` |
  | 7, 9 | – (no draw) | – | – | `props.moss: false` (back to `GROWTH[biome].moss`, no trunk moss) |
  | 8 | – (no draw) | – | – | `props.shoreWeed: false` (laver, sea lettuce; the belt stays: it replaces today's moss limit) |
  | 10 | `fairyRings` | `boolean \| null` | true: rings on the grass near and far, as in the growing season | `props.fairyRings: false` |
  | 12 | `fungi` | `boolean \| null` | true: mushrooms under the trees and on the grass near the camera, as in the peak month | `props.fungi: false` |
  | 13, 14 | `fireflies` | `boolean \| 'flash' \| 'glow' \| 'synchronous' \| null` | true: the place's kind at its peak count, `flash` where the place has none; a kind: that kind (`synchronous` needs mangroves: on trees or bushes otherwise); null: none | `props.fireflies: false` |
  | 16 | `desertBloom` | `boolean \| number \| null` | true: a strong bloom; 0..1: its strength; where the place has a bloom row | `desertBloom: null` |

  `props.phenology: false` also turns off phases 3–5, 7's wetness colour, 8's weed, 15 and 16.
- **Ready for the move-around mode:** what a thing is comes from its world position (a crown's
  hash, a fungus or ring cell's hash); only the choice of what to draw reads the camera
  (`props/leafLitter.ts` pattern).
- **Colours:** linear albedo from typical photo colours (sRGB → linear, ×0.8 for petals). Every
  value is *(est.)* until phase 1 measures it and `scripts/mesh.mjs --sun 8` checks it against
  2–3 reference photos per row.
- **Estimates stay estimates** until each phase's photo, count and render steps check them: those
  are build steps, not open questions.

## 1. Real assets: measure

Today every mesh is procedural with colour baked into vertices (`props/*.ts` builders); the only
files loaded are sky and cloud data in `public/assets/` (4.7 MB, `src/assets.ts`). No textures,
no glTF. Phases 1 and 11 add real reference data without changing that runtime model: scans and
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
only when `mesh.mjs` beside a photo shows it reads better at the distance it's seen.

**This phase is steps 1–2** (fetch, measure); steps 3–6 are phase 11. Measure first what phases
3–9 need: flamboyant, cistus, gorse, wattle and pōhutukawa flower colours from photos; heather
near and from ~300 m; eucalyptus leaf and bark; moss, lichen and laver albedo from
ambientCG/Poly Haven materials and photos.

**Done when:** `node scripts/asset.mjs measure <url>` writes `source.json` and the measured size
and linear colour mean and spread per region; the rows above measured and their *(est.)* colours
replaced in this plan.

## 2. Close the two place gaps (own commit)

Realism first: real coast that no place draws, and where two of the big blooms happen (phase 16).
Done before any render so every later count and render is on the final table.

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
  (2024-07-23, 2024-08-16, 2025-11-30), see phase 15.
- Other readers of latitude in these places (snow, sea ice, `drySeason`, reefs, grain): grep
  `atacama-peru`, `namibia`, `cape` and check each still holds at the new edge.

## 3. Bush blossom: rock rose, gorse, wattle

**Module:** `phenology.ts` gains `BLOOM` and `bloomFor(kind, phen, place)` → `{ crowns, leaves,
colors, bareOn? } | undefined`; `PlantSeason` gains `bloom`. `props/trees.ts` `leaves()` already
recolours a hashed share of leaves for autumn: a second hashed share for blossom (outside of the
crown first, as autumn). This phase builds the table, the hashed share and the far tint on `bush`
only; `bareOn` is phase 4.

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

### Gorse and wattle (research: NATURE.md §1.1–1.2)

| Plant | Our kind | Places | Months (local) | Share | Colour *(est.)* | Source |
|---|---|---|---|---|---|---|
| Common gorse (*Ulex europaeus*) | `bush` | `cornwall-wales`, `brittany`, `ireland`, `scotland`, `bristol-channel`, `morecambe-bay`; invasive in `new-zealand-south`, `new-zealand-north`, `tasmania`, `central-chile` | full Apr–May; Jan–Mar and Jun ×0.4; Jul–Dec ×0.1 (a few flowers all year in mild winters; two strains) | 0.5 of `bush` crowns, 0.5 of their leaf cards (gorse is dense with flowers) | yellow `[0.70, 0.50, 0.02]` | Woodland Trust, Dorset Nature, Lincolnshire Life |
| Coastal and golden wattle (*Acacia longifolia*, *A. pycnantha*) | `bush` | `east-australia`, `tasmania`, `sw-australia` *(est.)* | full late Aug – Sep; Jul and Oct–Nov ×0.3 | 0.35 of `bush` crowns, 0.5 of their leaf cards | yellow `[0.72, 0.55, 0.03]` | Australian floral emblem page, lawn.com.au |


- **Far tint:** gorse and wattle as rock rose (0.4 × leaf share × `bushShare`).
- **Gorse and heath** overlap in Atlantic Europe: gorse is on `bush`, heath on ground cover
  (phase 5), so both show (Cornish cliff tops: western gorse with heather, NATURE.md §8).

**Before code:** reference photos (cistus scrub above a Mediterranean cove, gorse on a Cornish
cliff top, wattle on a NSW headland); open ARCHITECTURE.md "Draw order in `buildParams`" and
"Biome, climate or place", `arch/PROPS.md`, LESSONS.md (plants).

**Done when:** a western-Med May cove shows pink and white cistus; a Cornish May cliff top yellow
gorse; a September NSW headland yellow wattle; far maquis a faint tint; other months and places
unchanged (`diff.mjs --off '{"props":{"bloom":false}}'`, contact sheet, front- and backlit).
Cost ~0% render time.

**Tests:** `test/bloom.test.ts`: the table over every place × month (no sampling), shares in 0..1,
a crown fixed by its position, unchanged outside the window, the off switch;
`realDays.test.ts` "no bloom outside its months"; `sceneSpec.test.ts` the `bloom` field.

## 4. Tree blossom: flamboyant and pōhutukawa

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

### Pōhutukawa (*Metrosideros excelsa*), `broadleaf`

- **Where:** `new-zealand-north`, on the coast's first trees (s within 60 m of the shore).
- **Months (local):** full 15 Dec – 5 Jan; ramps 15 Nov → 15 Dec and 5 → 15 Jan (RNZ, Te Papa, NZ
  Herald: peak ~10 days either side of 25 Dec, ±2 weeks by year).
- **Share:** 0.6 of near-shore `broadleaf` crowns, 0.7 of their leaf cards; leaves stay on.
- **Colour:** crimson `[0.45, 0.02, 0.03]` *(est.)*. A crimson line along the near coast, so no far
  tint beyond 60 m.

**Before code:** reference photos (flamboyant on a Caribbean beach, pōhutukawa along a Northland
beach).

**Done when:** a forced tropical framed day in its window shows a scarlet, thinned crown; a
Christmas `new-zealand-north` beach crimson crowns along the shore; other places unchanged.

**Tests:** in `test/bloom.test.ts`: dry-season windows in both hemispheres, `bareOn` only on
blooming crowns, `onDryCoast` the same answer as `savannaDry`'s old test, the pōhutukawa shore
limit.

## 5. Heath: heather on ground cover

Through a new `heathTint` on the terrain's ground cover, plus landform and island lower slopes.

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

**Before code:** reference photos (heather on a Cornish or Scottish cliff top, near and from
~300 m, in August, January and May).

**Done when:** a Scottish cliff-top heath is purple in August, brown in January, dark green in May,
near and far; gorse (phase 3) beside it in May (`diff.mjs --off '{"props":{"heath":false}}'`).

**Tests:** the heath places and months; the mask deterministic and ~35% cover; not on dunes,
machair or under trees; `sceneSpec.test.ts` the `heath` field.

## 6. Eucalyptus kind

The project draws no eucalyptus anywhere, though eucalypts are Australia's native coast trees;
monarchs also roost on them at 75% of California's sites (phase 17). Add `eucalyptus` (`props/trees.ts` builder, `props/vegetation.ts`
`KINDS`): a tall pale or mottled trunk, open crown of hanging grey-green leaf clumps
`[0.06, 0.08, 0.05]` *(est.; colour from phase 1)*, evergreen (no autumn), real heights from photos
(coastal eucalypts ~10–30 m *(est.)*). Pools by `PLACE_PLANTS` (`places.ts`): `east-australia`,
`sw-australia`, `tasmania` as a main kind *(weights est.)*; `california` a small weight (planted
groves). Wattle (phase 3) keeps `bush`. Count first: land days with the new kind in frame (`--project
vegetation`); `params.mjs --ref HEAD` (the pools change a prop choice, not params).

- **Done when:** an `east-australia` framed day shows eucalypts beside the bush; a `california`
  day rarely; `mesh.mjs` beside a reference photo; `meshes.test.ts` row (real size, budget).

## 7. Moss on rock

**Rules** (NATURE.md §4): amount = climate × place factor × face (the spray belt's limit comes in
phase 8); colour = today's wetness. No draws.

- **Amount by climate** `MOSS`: temperate 1, boreal 1, polar 0.5, tropical 0.6, subtropical 0.5,
  Mediterranean 0.4, arid 0 *(est.)*; place factor 1.3 for the wettest, foggiest coasts
  (`se-alaska`, `british-columbia`, `pacific-northwest`, `norway-west`, `ireland`, `scotland`,
  `new-zealand-south`, `patagonia-fjords`, `tasmania`) *(est.)*. Replaces `GROWTH[biome].moss`
  (`props/rocks.ts`) and feeds the rock shore (here) and trunks (phase 9). **Only the amount moves**: the green
  stays `GROWTH[biome].mossColor` (moss species follow the rock's region with the lichen and
  algae, Decisions "Keys"); trunks use the same colour as the rocks around them. Phase 1's
  ambientCG/Poly Haven moss materials check those colours.
- **Faces:** upward faces (as now) and concave low spots of the shader's noise.
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


**Done when:** moss on sheltered rock in wet climates, none on arid coasts, dark in a dry
Mediterranean August, green on a rainy day there, green in a temperate January; render time ~0%.

**Tests:** `test/moss.test.ts`: `MOSS` over every climate and place, wetness by weather and month
in both hemispheres (temperate winter wet, wet tropics wet); `npx vitest run test/glsl`.

## 8. Shore zonation: the spray belt, laver, sea lettuce

The upper shore's bands, all measured from the same line (spring high water plus run-up) in the
rock-shore shader: weed in the littoral fringe below, the black lichen, then the spray belt where
moss can't grow.

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
  - No moss inside the belt; moss fades in over the next 3 m *(est.)*. Trunks in the belt: phase 9.
  - **Forced extremes** (colour only, no geometry, so the camera and dry land are unaffected and
    `expectDryCameras` doesn't apply): the belt is the same at low, mid and high tide on platform,
    boulder and cliff-top compositions, and in a storm (it doesn't read today's swell). A test checks
    that: each tide stage × composition gives the same belt height on a forced place.
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

**Done when:** no moss inside the belt on an exposed Atlantic platform in a big swell, the same
belt at low and high tide; `diff.mjs --crop` on a Scottish and a Cornish rock-shore platform,
January and July: the laver band in both in January, only in Scotland in July; a British
Columbia platform in February with the band, in August without.

**Tests:** `sprayBelt` over every place; the belt the same over tide stages × compositions and
swell; the weed table over every place × month, the 41°N and 40°N limits.

## 9. Moss and lichen on trunks

- **Where on the trunk:** base to ~1.5 m *(est.)*, densest at the base, on the side the tree
  leans (`tilt`, `leanSeaward` in `props/vegetation.ts`: stemflow), patchy by hash; never "the
  north side". Amount from phase 7's `MOSS`; colour the same as the rocks around them.
- **In the spray belt** (phase 8; a tree whose base is inside it): lichen-grey bark
  (`LICHEN[biome]` at 0.4) instead of moss (Isles of Scilly flora).
- **Eucalyptus** (phase 6): smooth shedding bark carries little moss *(est.)*: ×0.3.
- **Done when:** trunk bases green in a British Columbia framed forest, grey near an exposed
  Atlantic shore, none on arid coasts.
- **Tests:** a trunk's moss side follows its lean; lichen bark inside the belt.

## 10. Fairy rings

**Fairy rings (far-off sign)** (RHS, Utah State herbarium, Britannica):

- A ring of **darker, taller grass** at the advancing edge (extra nitrogen), often with a band of
  dead or thin grass just inside it; diameters commonly **2–10 m** (over 10 m sometimes; rings of
  hundreds of metres are rare and old); grows 20–30 cm a year, lasts decades.
- **Where:** grass on land (machair, dune grassland, cliff-top turf) in temperate, boreal and
  Mediterranean climates; not on sand, under trees or on phase 5's heath mask (heath isn't turf);
  0–3 per hectare *(est.)*.
- **Look:** dark band 0.3–0.6 m wide `[0.04, 0.115, 0.02]` against the usual ground cover
  `[0.08, 0.13, 0.05]`; inner dead band 0.2–0.4 m straw *(est. widths)*. Full in the growing season
  (temperate Apr–Oct, boreal Jun–Sep, Mediterranean Nov–May), ×0.3 otherwise *(est.)*; under snow
  hidden.
- **Code:** a world-space cell hash for ring centre and radius in the terrain's ground-cover shader
  (like `litterMap`), so rings are fixed in the world. 124 land days are in a growing season; how
  many show grass in frame: `--rendered` once built.

- **Done when:** a forced October machair or cliff-top day shows a ring off in the grass, none on
  heath or sand (`diff.mjs --off '{"props":{"fairyRings":false}}'`).

## 11. Real assets: bake

Steps 3–6 of phase 1's pipeline (reduce, bake, emit, check), adding `@gltf-transform` now.

**Done when:** `node scripts/asset.mjs <url>` produces a baked mesh with its measured size and
colours, its licence recorded; one scan (a mushroom) through every step to prove the pipeline.
Then a fly agaric, a bolete and a field mushroom for phase 12; PLAN_BIOMES phase-14 animals from Smithsonian
specimens (proportions) and photos (colour) for phase 17.

## 12. Mushrooms

`fungiFor(params, rng)`:

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
- **Meshes:** cap + stem, base at y = 0, ~200 tris, instanced; sizes and colours from phase 11's
  scans and phase 1's photos.
- **Spec:** `fungi: true` forces both placements (under trees and on grass) as in the peak month.
- **Day count:** grass mushrooms reach many more days than the under-tree 5–10 (grass is near the
  camera on most land days): count with `--project fungi` as the first step.
- **Done when:** a forced temperate October framed forest day shows a few caps near the camera
  under the trees; a forced October machair or cliff-top day shows field mushrooms on the grass
  and a ring further off; nothing out of season.

## 13. Fireflies: choice, weather, placement

Testable without WebGL: what's out tonight, where, and how many. Drawing is phase 14.

**Scope:** 11 eligible land nights in three years with the table and the dusk rule below
(`synchronous` 6, `flash` 4, `glow` 1). Of the 6 `synchronous`, mangroves are drawn on 2
(2024-12-22 north Australia, 2026-01-09 Philippines); of the `flash` nights, 3 have air wind
≥ 10 m/s and drop out; Japan 2026-06-25 (5.1 m/s, moon up at 0.83) stays at a reduced chance. So
**~4 nights** before moon and "plants in frame". Rare and real: built.

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
    `night` only, the glow-worm rows almost never fire (that's most of why the first count had just 1
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

**Done when:** `params.mjs --project fireflies` places lights only over grass, bushes and mangrove
crowns, 5–60 m out and in frame, in the counts above; none by day, at dawn blue hour, in rain
(`flash`) or on open sea.

**Tests:** `test/fireflies.test.ts`: the table over every place × month; none by day, at dawn,
on open sea or in snow; `flash` none in rain and none at ≥ 8 m/s wind, `glow` still there in
drizzle and at 8 m/s; fewer under a full moon (`expectShare`); placements over
vegetation only; `synchronous` only with mangroves; `glow` in evening blue hour only at
`sunElevationDeg ≤ −6`, never at dawn, and a June 60°N dusk eligible while 64°N isn't; magnitude by distance; deterministic; off switch
(`propSwitches.test.ts`), spec field (`sceneSpec.test.ts`).

## 14. Fireflies: drawing

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

**Tests:** magnitude by distance; the ribbon mesh in `meshes.test.ts` (finite, budget).

## 15. Lomas: yearly green on Peru's fog hills

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
  that's a terrain gap, planned in [TERRAIN_FORMS.md](TERRAIN_FORMS.md) phase 2: build the tint
  on the range now and on the wall once it exists (all 3 days then).
- **Colour by local month:** Jul–Oct full: mix the far ground toward an olive green
  `[0.07, 0.09, 0.035]` by 0.5 in noise patches (~50% cover) *(est.)*; Jun and Nov ×0.5;
  Jun–Jul a yellow fleck `[0.55, 0.40, 0.03]` at 0.1 of the green's weight (amancaes) *(est.)*;
  Dec–May none.
- **Counts:** 3 `atacama-peru` land days in Jun–Nov (same after phase 2); none has a landform on the
  test days, so 0 in frame today and ~0.5 expected; with the escarpment, all 3.

- **Done when:** a forced Peruvian August day with a range in frame shows green lower slopes; the
  same day in February bare.
- **Tests:** lomas only Jun–Nov and only in their latitudes.

## 16. Bloom years: desert bloom, Namaqualand and the Cape West Coast, Baja

### Atacama's *desierto florido* (El Niño years)

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

### Namaqualand and the Cape West Coast (every year)

- **When:** every year, strength drawn per year 0.3–1 (per-year stream). Namaqualand and the
  Sandveld (`namibia` south of 29°S): Aug–Sep full, Jul and Oct ×0.4; the coast flowers late in
  the season, so the coastal peak is late Aug – mid Sep (SANParks; Northern Cape tourism). Cape
  West Coast (`cape` on an Atlantic day, north of 33.5°S: Postberg): Aug 1 – Sep 30 (West
  Coast NP).
- **Near the viewer:** orange daisy `[0.75, 0.25, 0.02]` (*Ursinia*, *Dimorphotheca*) and white
  `[0.72, 0.70, 0.66]` *(est.)*, new `FLOWERS` kinds, dense patches.
- **Far land:** as the Atacama. Daisies close when cloudy and open in the sun (well known; *est.*: ×0.3
  colour on overcast and rain days).

### Baja's Pacific coast after a wet winter

- **When:** a bloom year at 0.3 *(est.: southern California's desert superblooms 2017, 2019,
  2023, 2024; no Baja frequency found)* from the per-year stream: Feb–Mar full, Apr ×0.4
  (hillsides "painted" in Feb–Mar in good years; gone in the 2011–16 drought: a Baja local account;
  rain "consistently over several months", cool nights, seed bank: National Geographic).
- **Where:** `baja-sonora`, Pacific ocean days only (the Gulf side is hyper-arid, flowering after
  hurricanes: Desert Museum); far slopes and ground cover as the Atacama, with yellow and orange
  `[0.70, 0.45, 0.03]` and purple `[0.30, 0.10, 0.35]` *(est.)*.
- **Counted 2026-11-12:** 0 `baja-sonora` land days in Feb–Apr on the test days (rare in the
  test set, real on the coast: built for the move-around mode and other years).

**Done when:** a forced Atacama October (strong) shows magenta near and a tint far; a September
Namaqualand rock shore orange and white; the same places in February bare
(`diff.mjs --off '{"desertBloom":null}'`).

**Tests:** `test/coastBloom.test.ts`: the tables over every place × month; each region's bloom year
the same on every day of a year and independent of the spec seed.

## 17. Animal seasons for PLAN_BIOMES phase 14

Build with each animal of PLAN_BIOMES phase 14 (its own plan); the season goes in `animalSeasons.ts`:

| Animal | Season rule | Reads |
|---|---|---|
| Polar bear | ashore on days without sea ice, on the ice when there is ice; ~2% of eligible days | `params.seaIce` |
| Walrus | coastal haul-out on ice-free days from Aug to the freeze (Point Lay from early Aug); on floes when there is ice | `params.seaIce`, local month |
| Sea otters and kelp mats | otters all year; floating kelp canopy full Jun–Sep, ×0.4 Dec–Mar (winter wave losses) | month |
| Waders | flocks on passage (Mar–May, Aug–Oct; Wadden peaks late Jul – mid Sep) and in winter on temperate and Mediterranean flats and beaches; summer ×0.15; polar Jun–Jul scattered pairs | climate, month |
| Blacktip sharks | `florida-carolinas` mid-Jan – Mar, peak Feb–Mar, within 20–50 m of shore | place, local month |
| Reef blacktips | reef lagoons, all year | – |
| Monarchs (new) | `california` late Oct – Feb: cluster on `eucalyptus` (phase 6) near the camera; on cypress and pine where none stands | place, month, plant pool |

After each: `node scripts/animals.mjs`, paste into ANIMALS.md with its rule in "Seasons".

## Still open

Nothing blocks a build. Outside this plan: the Atacama's coastal escarpment
([TERRAIN_FORMS.md](TERRAIN_FORMS.md) phase 2), which gives phase 15's lomas all 3 days.

## Checks (all phases)

- Before the first render, per phase: the docs named in CLAUDE.md §1 opened, real sizes from photos,
  the in-frame count with `--project` / `--rendered`.
- `diff.mjs` for visibility with each off switch on a clear and a cloudy day; real days in the first
  render round; `bench.mjs` (phase 3 ≤ 5%; every other phase ~0%).
- `npm test` and `npx tsc --noEmit`; `params.mjs --ref HEAD` for the changelog row.
- Docs: changelog.md, ARCHITECTURE.md (new tables in "Biome, climate or place"), `arch/PROPS.md`,
  SEASONS.md pointer, ANIMALS.md, SCENE_SPECS.md, REFERENCES.md, NATURE.md for new numbers.
