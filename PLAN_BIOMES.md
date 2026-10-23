# Plan: coasts, biomes and coastal weather

Brings the wallpaper's coasts closer to the world's: rocky shores, reef-fronted tropical
beaches, tides, beach shapes that follow the waves, more sand colours, two missing
climates, coastal weather and the animals these open up. Stony beaches have their own plan
(COAST_PLAN.md) and come first. Status 2026-10-23: plan only, nothing built.

## Why: research vs. today

Research summary (sources at the end; details go into COASTS.md in phase 0).

| Topic | Real world | Today | Phase |
|---|---|---|---|
| Coast types | ~40% sand/gravel, 21% mud, 13% rocky, 27% bare rock; ~33% cliffed | `beach` 65% (all sand), `open-sea` 35% | 1, 6, 8 |
| Beach shape | Reflective (steep, no bar), intermediate (cusps, rips), dissipative (flat, 2–3 bars) by grain and swell | Slope 0.035–0.11 and a sandbar 60%, not tied to waves | 3 |
| Tropical beaches | Most island beaches sit behind a fringing reef: waves break on the crest 100–500 m out, 50–75% of the height lost, calm lagoon inside | Surf breaks on the beach | 4 |
| Tides | Micro < 2 m (Mediterranean, Caribbean, Baltic), meso 2–4 m, macro > 4 m (Fundy, Brittany, Patagonia, NW Australia); spring tides at new and full moon | Fixed sea level | 5 |
| Sand colour | Also pink (foraminifera: Bermuda, Bahamas, Komodo) and red (iron: Prince Edward Island, Santorini, Maui) | white, golden, grey, black | 2 |
| Landforms | Barrier islands and lagoons, spits, fjords, rias, beachrock, tidal flats, salt marsh | none of these | 7, 8 |
| Climates | Temperate oceanic (Britain, Atlantic Canada, Pacific NW, NZ), humid subtropical (Florida, S Brazil, Queensland, Natal, S Japan), treeless polar | Five biomes; nordic Arctic has conifers and birch | 2, 9 |
| Weather | Marine-layer stratus mornings (California, Atacama, May–Jul), sea-breeze cumulus over land, harmattan dust (West Africa Dec–Feb), offshore wind spray, winter snow and ice foot, bioluminescent surf | fog, sea smoke, dust, monsoon, storms ✓; the rest missing | 2, 10 |
| Animals | Sea otters, walrus, polar bears, waders on flats, oystercatchers, tidepool life | none of these | 11 |

## Rules for every phase

- Read PLAN.md "How it works" and "Lessons and gotchas" and the closest module first;
  follow CLAUDE.md (choice/geometry split, own streams, spec fields, tests, renders).
- **Own streams only.** New draws use `Random.derive(seed, '<feature>')` or
  `ctx.rng('<feature>')`, never the main `rng` in `generateParams`. Days that don't get
  the new feature stay byte-identical (`test/sceneSpec.test.ts`, `bench.mjs` pixel
  diff 0). The exceptions are phases 3 and 9, which change existing days on purpose:
  each says so in the changelog.
- **Spec field for every feature** (`sceneSpec.ts`), always drawn, then forced with
  `or()` / `forced()` / `forcedKind()`. Add each one to the CLAUDE.md field list.
- **Choice tables** are pure `xxxFor(params, rng)` functions exposed in `props/choices.ts`,
  so `scripts/params.mjs --stats` can count them without rendering.
- **Budget:** render time within ~10% of today per phase (`bench.mjs`); meshes < 100k tris;
  detail only near the camera.
- **"Done"** only for what a render or `diff.mjs` showed. ~3 render rounds per phase.
- **One commit per phase step**, `npm test` and `npx tsc --noEmit` first. Never commit
  TODO.md.

## Phases

### 0. Docs: research and gaps (no code)

- COASTS.md: add "Research: the world's coasts" (coast-type shares, beach states, sand
  colours, tides, reef-fronted beaches, landforms, climates) with sources, and a
  "Gaps" table pointing to the phases here.
- CLOUDS.md: a "Coastal weather" note: marine layer, sea breeze, harmattan, offshore winds
  (marked "planned, PLAN_BIOMES phase 2/10").
- ANIMALS.md: a "Planned" list under the rules (sea otter, walrus, polar bear, waders).
- Commit: "Docs: coast and climate research, gaps vs. today".

### 1. Stony beaches

Do COAST_PLAN.md as written. It adds `coast.material`, steep ridged profiles and the stone
shader, which phases 3, 6 and 8 reuse.

### 2. Cheap table changes (no new geometry)

Each is a table row or a palette, plus a spec value and a test.

| Change | Where | Rule |
|---|---|---|
| Pink sand | `biome.ts` `SANDS` (`pink`, albedo ≈ [0.68, 0.52, 0.48]); tropical Atlantic and Indian sands | ~5% of tropical-Atlantic beaches, ~2% tropical Indian (Komodo) |
| Red sand | `SANDS` (`red`, ≈ [0.42, 0.2, 0.12]) | nordic Atlantic ~5% (PEI, Fundy), volcanic ~4% (Santorini, Maui), desert ~5% |
| Sand colour on its own stream | `generateCoast` | New colours drawn from `Random.derive(seed, 'sand-colour')` only when a gate draw says so, so existing sand days keep their colour |
| No trees on Arctic coasts | `props/vegetation.ts` | `ocean === 'arctic'` or latitude > ~68°: grass, low willow and bush only (tundra); Southern-Ocean nordic (Tierra del Fuego) keeps beech/conifer |
| Marine-layer mornings | `clouds.ts` / `pickFormations` | Mediterranean-Pacific (California) and desert-Pacific (Atacama), May–Aug: stratus or Sc deck at ~300–600 m on ~45% of mornings (golden hour to late morning), breaking up by afternoon; weaker in other months |
| Harmattan | `seaHaze.ts` | Tropical Atlantic, West Africa region, Dec–Feb: dust visibility 2–10 km, ochre haze, sun dimmed and reddened; ~50% of those days |
| Haar | `params.ts` fog | Nordic Atlantic Apr–Jul: advection-fog chance up (check `fogSeason` first; may already be right) |

- Spec: `sand` accepts `pink` and `red`; `weather.marineLayer` via `clouds` already works;
  add `"dust": "harmattan"` only if `seaHaze` has no force today.
- Tests: `test/biome.test.ts` (new): pink and red sand only where listed, roughly as often;
  `test/seaHaze.test.ts`: harmattan only West Africa Dec–Feb; `test/cloudTypes.test.ts`:
  marine layer by region and month; vegetation: no conifer/birch on Arctic days.
- Renders: PEI red beach (nordic atlantic, golden hour), Bermuda pink (tropical atlantic,
  daylight front-lit), Svalbard tundra (nordic arctic, along-beach), California June
  morning (mediterranean pacific, `"date": "2025-06-14"`, golden hour), Loango harmattan
  (`2025-01-10`, tropical atlantic).
- Docs: COASTS.md sand table, CLOUDS.md marine layer row, PLAN.md "How it works" (sand
  colour stream, tundra), changelog.

### 3. Beach shape from waves and grain (Wright & Short)

Changes every beach day on purpose: slope and bars become physical instead of random.

- `src/beachState.ts`: `beachStateFor(material, grain, swellHeight, swellPeriod, rng)` →
  `'reflective' | 'low-tide-terrace' | 'transverse-bar-rip' | 'rhythmic-bar' |
  'longshore-bar' | 'dissipative'` from the dimensionless fall velocity
  Ω = Hb / (ws · T) (reflective < 1.5, dissipative > 5.5). Grain per biome and sand colour
  (coral and black sand coarse, quartz golden medium, fine on dissipative coasts); shingle
  and cobble are always reflective.
- `generateCoast`: slope, bar count (0–3), bar distance and sandbar height from the state;
  storms and winter months push one state toward dissipative (winter profile).
- `terrain.ts` (GLSL + TS mirror, `test/terrain.test.ts`):
  - **beach cusps** on reflective and intermediate beaches: horns and bays along `a`,
    spacing ≈ run-up length (15–40 m), 0.1–0.4 m relief, a cheap sine of `a` with
    wobble on the upper swash zone;
  - **rip channels** on transverse-bar-rip and rhythmic states: gaps in the bar every
    150–400 m; `ocean.ts` gets darker, calmer water and fewer breakers over them (the
    bar depth already drives breaking).
- Spec: `beachState`.
- Tests: Ω thresholds, every material/biome gets plausible states, cusps only on steep
  states, terrain TS/GLSL mirror.
- Renders: along-beach on a cusped reflective beach (Mediterranean) and a dissipative
  multi-bar beach (desert atlantic, big swell); `bench.mjs` (expect pixel change, ≤ 10% time).
- Docs: PLAN.md "How it works" (beach state), lessons; changelog notes "all beach days
  change slope".

### 4. Reef-fronted tropical beaches

- Choice: `reefFor(params, rng)` on stream `'reef'`: fringing reef on ~60% of tropical
  beach days (Pacific and Indian islands more than continental Atlantic), ~20% of
  volcanic Pacific (Hawaii) and desert Indian (Red Sea); none elsewhere. Reef distance
  100–500 m, lagoon depth 1–3 m, passes (gaps) every 0.5–2 km.
- `terrain.ts`: seabed profile with a shallow lagoon, a reef flat and crest at ~0.3 m below
  mean sea, then a steep drop-off. Surf breaks on the crest from the existing
  `surfBreakDepth`; the beach gets only the re-formed small waves (shorebreak 10–30% of
  offshore height).
- `ocean.ts`: lagoon colour (turquoise over sand, brown-green patches over coral heads by
  noise), crest foam line, darker blue past the drop-off; caustics already exist.
- Beachrock: flat, slightly tilted grey ledges along the waterline on ~30% of reef
  beaches (`rocks.ts` style, very low poly, instanced).
- Keeps mangroves and sheltered surf in mind: a reef counts as sheltered for
  `mangroveFor`.
- Spec: `reef` (null/true/`"fringing"`), `beachrock`.
- Tests: reef only on the listed coasts, profile continuity, surf height inside the lagoon.
- Renders: Maldives-like (tropical indian, shoreline, midday), Tahiti (tropical pacific,
  overlook), Hawaii (volcanic pacific, along-beach), each front-lit then backlit;
  `diff.mjs --off '{"reef":null}'`.
- Docs: COASTS.md (reef share), PLAN.md "How it works" (reef profile), changelog; animals
  that now fit (phase 11): reef herons, blacktip sharks in the lagoon.

### 5. Tides

- `src/tides.ts`: `tideFor(params, rng)` → `{ range, level }`. Range class by region
  (`TIDAL_RANGE` table: Mediterranean and Caribbean micro 0.2–0.5 m; most open coasts
  meso 1.5–3 m; Fundy, Brittany, Patagonia, NW Australia, Korea, Alaska macro 4–12 m),
  × 1.2 at spring tides (new/full moon, from the existing moon phase) and × 0.8 at neaps.
  Level = a random phase of the semidiurnal cycle on stream `'tide'`.
- Sea level: shift the water plane and every shore-relative thing (`shoreToWorld` s = 0,
  `beachLines`, run-up, surf profile) by `level`. Wrack stays on the last high-tide line,
  so at low tide it sits far up a wide wet band.
- Low-tide look (meso and macro only): wet-sand band widens; exposed rocks get a dark
  weed/mussel band (vertex colour below the high-water line in `rocks.ts`); tidepools as
  flat mirror patches between rocks; on reef coasts the reef flat dries.
- Spec: `tide` (`"low" | "mid" | "high"` or a level in m), `tidalRange`.
- Tests: ranges per region, spring/neap from moon phase, level in range, all shore props
  move with the waterline.
- Renders: Brittany low tide (nordic atlantic, along-beach), same at high tide,
  Mediterranean (no visible change); `diff.mjs` between low and high.
- Docs: PLAN.md "How it works" (tides), lessons, CLAUDE.md spec fields, changelog.

### 6. Rocky shore coast type

- `generateCoast`: coast types `beach` 55%, `rock-shore` 10%, `open-sea` 35% on
  stream `'coast-kind'` so beach/open-sea days stay identical; by biome (nordic,
  volcanic and Mediterranean most; tropical and desert least).
- Terrain: wave-cut platform (flat, slightly seaward-dipping shelf, ragged edge), a
  low cliff or boulder slope behind, no sand. Reuse `rocks.ts` boulders on the platform and
  the phase-1 cobble shader in gaps.
- Water: waves break on the platform edge (rock data for `ocean.ts` foam, `waveOnRock`),
  spray bursts on the outer ledge, wash across the platform; tidepools at low tide (phase 5).
- Compositions: `shoreline` and `framed` from the platform; `overlook` from the cliff top.
- Spec: `coast: "rock-shore"`.
- Tests: share and biome table, terrain has no sand band, camera stands on rock.
- Renders: Peggy's Cove (nordic atlantic, granite, golden hour), Big Sur (mediterranean
  pacific, overlook), Iceland basalt (volcanic, storm swell).
- Docs: COASTS.md coast table, PLAN.md, changelog, CLAUDE.md views list.

### 7. Landforms: barrier lagoon, spit, fjord walls

- **Barrier and lagoon:** on along-beach and overlook beach days in humid subtropical,
  Mediterranean and desert coasts (~10%): a narrow sand barrier with dunes, a calm lagoon
  behind (ocean shader with no swell, low wind chop) where land would be.
- **Spit:** along-beach views, ~8% of sandy temperate/nordic beaches: the beach runs out
  into a curving sandy hook with a lagoon behind its tip.
- **Fjord walls:** nordic days with `range` landform (~30% of them): steep valley walls
  on both sides of the view running out to sea, snow on tops in winter; far = colour and
  relief only (`landforms.ts` heightfield).
- Spec: `landform: "fjord"`, `lagoon`, `spit`.
- Tests: where each appears, heightfields finite, triangle budget.
- Renders: Outer Banks lagoon (subtropical, overlook), Farewell Spit (temperate),
  Norwegian fjord (nordic atlantic).
- Docs: COASTS.md landforms, PLAN.md, changelog.

### 8. Tidal flats and salt marsh

- Coast kind `tidal-flat`, ~3% of days, only macro- and mesotidal temperate/nordic Atlantic
  and Korea/China (Wadden Sea, Fundy, Morecambe Bay, Yellow Sea): at low tide a km-wide
  wet flat with shallow channels and ripples, the sea a far line; salt-marsh band (low
  green-brown grass tufts, instanced) at the back.
- Spec: `coast: "tidal-flat"`.
- Renders: Wadden Sea at low tide (golden hour, wet-flat reflections), Fundy red mud.
- Docs: COASTS.md, PLAN.md, changelog.

### 9. Climates: temperate and humid subtropical

Adding biomes to `BIOMES` reshuffles every day's biome. Instead, add a **climate**
within each biome on its own stream (`Random.derive(seed, 'climate')`), so the main
stream is untouched and only the split days change:

| Biome | Climate split | Places |
|---|---|---|
| nordic | `boreal` (today's) 45%, `temperate` 40%, `polar` 15% (Arctic ocean always polar) | Norway/Alaska; Britain, Atlantic Canada, Pacific NW, NZ South Island; Svalbard, Greenland |
| mediterranean | `mediterranean` 75%, `subtropical` 25% (Atlantic and Pacific only) | Med, California, Chile; Florida, S Brazil, Queensland, Natal, S Japan |
| tropical, volcanic, desert | unchanged | – |

- `temperate`: mixed broadleaf and conifer, marram dunes (yellow dunes), machair on
  shell-sand Atlantic coasts, golden-grey sand and much shingle (phase 1 table row).
- `subtropical`: live oak, saw palmetto, sea oats on dunes, wide pale quartz beaches,
  barrier lagoons (phase 7), more cumulus congestus and summer storms.
- `polar`: tundra (phase 2), snow (phase 10), no conifers.
- Every table keyed by biome gets a look: oceans, sands, plants, debris, shore life,
  animals, fog, clouds, islands, ice.
- Spec: `climate`.
- Tests: split shares, tables by climate, unforced non-split days byte-identical.
- Renders: one per new climate, each composition once.
- Docs: COASTS.md biome table (biome × climate shares), CLOUDS.md climate leanings,
  ANIMALS.md (regions per climate), PLAN.md, CLAUDE.md spec fields, changelog.

### 10. Weather extras

| Feature | Rule | Build |
|---|---|---|
| Sea-breeze cumulus | Warm sunny afternoons (`few`/`scattered`, sun up, land warmer: Mediterranean, subtropical, tropical): Cu over land, clear over the sea | `cloudArrangement.ts`: mask the weather map by a land/sea line ~1–5 km inland, along `seawardAzimuthDeg` |
| Offshore wind | Mistral, bora, Santa Ana, harmattan: wind from land | wind direction vs. `seawardAzimuthDeg`; offshore: very clear air (visibility up), smooth faces, spray blown back off the crests (`props/surf.ts`) |
| Snow and ice foot | Polar and nordic winter (latitude and month): snow on land and upper beach, a shore-fast ice ledge at the high-water line | terrain colour by height above high tide; ice foot as a low extruded strip; frozen spray on rocks |
| Polar night check | Arctic latitudes 66–78° have no sun in Dec–Jan | check that `timeOfDay` is limited by latitude; if not, restrict it (changes some Arctic winter days) |
| Bioluminescent surf | Night, new-moon-ish, summer/autumn blooms: California, Maldives, Puerto Rico, Japan (Toyama) | `ocean.ts`: blue emission on breaking crests and swash (foam mask × bloom), ~2% of eligible nights |

- Spec: `seaBreeze`, `offshoreWind`, `snow`, `bioluminescence`.
- Specs, tests, renders and docs as above (CLOUDS.md for sea breeze, PLAN.md lessons, changelog).

### 11. Animals

| Animal | Where | Notes |
|---|---|---|
| Sea otters (rafts in kelp) | Mediterranean-Pacific (California), nordic Pacific (Alaska, BC) | float on their backs; need kelp-bed patches in the water |
| Walrus haul-out | nordic Arctic, polar climate | beach or ice floe, 5–40 animals; `pinnipeds.ts` |
| Polar bear | Arctic, polar climate, near ice | rare (~2% of eligible days), on the beach or a floe |
| Waders (oystercatchers, knots, sanderlings) | tidal flats and low-tide beaches, temperate/nordic; sanderlings everywhere on the swash | flocks running on the swash (phase 5 needed) |
| Herons (grey, reef) | rocky shores, reef lagoons | standing in shallow water |
| Tidepool life | rock-shore at low tide | urchins, anemones, mussels as vertex detail near the camera |
| Blacktip sharks | reef lagoons, by day | fins in the shallows |

- `xxxFor` choice per animal, `props/choices.ts`, `test/<animal>.test.ts`, meshes checked
  with `scripts/mesh.mjs` first.
- After each: `node scripts/animals.mjs`, paste into ANIMALS.md and update its rules.

## Docs to update (checklist per phase)

| Doc | What |
|---|---|
| changelog.md | a version row per phase; note when existing days change (phases 3, 9, polar night) |
| PLAN.md | "How it works" (new modules and rules), "Lessons and gotchas", "References" (sources below), "Decisions" (climate split instead of new biomes) |
| COASTS.md | coast-type, material, tide, reef, landform, biome and climate shares, re-measured with `params.mjs --stats … 2024-01-01..2026-12-31`; mark the "Proposal" sections done |
| COAST_PLAN.md | mark done after phase 1 |
| CLOUDS.md | marine layer, sea breeze, climate leanings |
| ANIMALS.md | new animals' rules and the regenerated table |
| CLAUDE.md | new spec fields; fixed dates for new looks (PEI red beach, Wadden low tide, Maldives reef, California June gloom); new views (`rock-shore`) |
| scenes/ | `scenes/coasts.json` with one spec per new coast, climate and weather, for future regression renders |
| README.md | feature list, if it lists coasts or biomes |

## Open questions

1. Shares: are `rock-shore` 10% and reef on ~60% of tropical beach days right for a
   wallpaper, or should beaches stay dominant (realism says rocky shores are more common
   than we draw)?
2. Phase 3 changes every beach day's slope. OK, or gate it behind its own stream so only
   new days differ?
3. Climate split (phase 9) vs. new top-level biomes: the split keeps today's days, but
   titles would read "temperate" for some days now titled "nordic". OK?
4. Polar night: should Arctic winter days be dark (realistic) or keep daylight times by
   pretending the coast is further south?
5. Bioluminescence and pink sand are rare showpieces. Keep them rare (realistic) or a
   bit more often?

## Sources

[Global coastal dataset (ESSD preprint 2025)](https://essd.copernicus.org/preprints/essd-2025-388/),
[Global distribution of coastal cliffs](https://openpolar.no/Record/crwiley:10.1002%2Fesp.4574),
[Beach states, Ω classes (Springer 2025)](https://link.springer.com/article/10.1007/s00367-025-00802-y),
[Short & Hesp 1982](https://data-ww3.ifremer.fr/BIB/Short_Hesp_MG1982.pdf),
[Beach cusps, Trafalgar](https://scimar.icm.csic.es/index.php/secId/6/IdArt/3912/index.php),
[Flash rips between cusps](https://www.scienceofthesurf.com/rip-of-the-month-2018/june-2018-rotm114-laguna-beach-california),
[Sand colours (Hawaii Guide)](https://www.hawaii-guide.com/blog/hawaii-colored-sand-beaches-black-green-red-white-explained),
[EarthDate: Beach reading](https://www.earthdate.org/episodes/beach-reading),
[Tidal environments (TU Delft)](https://coastal.citg.tudelft.nl/book/3a_tidal_environments.html),
[Tides and coasts (SERC)](https://cdn.serc.carleton.edu/files/NAGTWorkshops/geomorph/activities/GlS210_TidesAndCoasts.pdf),
[Coastal landforms](https://www.savemyexams.com/igcse/geography/edexcel/19/revision-notes/2-coastal-environments/2-1-coastal-processes-and-landforms/2-1-2-coastal-landforms/),
[Fringing reef wave attenuation](https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2021.684732/epub),
[Coral reef zones](https://www.remnote.com/learn/science/marine-biology/coral-reef-reef-types-and-physical-zones-study-deck),
[Namib fog and Benguela upwelling (ACP 2026)](https://acp.copernicus.org/articles/26/12565/2026/),
[June Gloom](https://en.wikipedia.org/wiki/June_Gloom),
[Bioluminescent waves (UCSD)](https://today.ucsd.edu/story/new-study-uses-simulations-to-reveal-bioluminescent-light-intensity-in-breaking-waves),
[Bioluminescent beaches (MBL)](https://new-www.mbl.edu/news/americas-5-best-bioluminescent-beaches-islands),
[Machair (EUNIS)](https://eunis.eea.europa.eu/habitats/8044),
[Irish coastal habitats](https://www.noticenature.ie/wp-content/uploads/2016/06/coastal-habitats.pdf).
