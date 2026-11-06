# Coasts

Which coasts the wallpaper draws and how often, and the research behind them. Status
2026-10-30 (PLAN_BIOMES phases 1–7). Shares are over 2024–2026 (1096 days, 715 beach days;
`node scripts/params.mjs --stats … 2024-01-01..2026-12-31`). How the code works:
[arch/COAST.md](arch/COAST.md); research numbers per region: REGIONS.md; plan:
[plans/PLAN_BIOMES.md](plans/PLAN_BIOMES.md).

## How a coast is chosen

1. **Place** (`places.ts`, the first main-stream draw; PLAN_BIOMES 1a): a real stretch of
   coast, weighted by √ of its region's coastline length (REGIONS.md §1). It fixes the
   **biome** (water, sand colours, rocks, plants) and the latitude range; the day's
   **climate** (own stream) patches the biome's sands, plants and greens (`climateBiome`,
   PLAN_BIOMES 11) and names it in the title.
2. **Ocean** (`pickOcean`, `oceans.ts`, own stream): from the place's weights; sets swell,
   wind, polar water and ice. Climate (own stream) and latitude (within the place's range,
   signed) follow.
3. **Coast type** (`generateCoast`, `params.ts`): land 65% / `open-sea` 35%, once per
   date; on land the place's `coast` weights choose `beach` or `rock-shore` (stream
   `'coast-kind'`, PLAN_BIOMES 8), then the rocky shore's kind (stream `'rock-shore'`).
4. **Shape** (same function): dunes, hills, sand colour (the place's `sand` chances, stream
   `'sand-colour'`), composition (beach days only).
5. **Beach material** (`beach.ts`, stream `'beach-material'`, PLAN_BIOMES 2): sand, mixed,
   shingle or cobble from the place's chances; a stony beach gets a low bank and storm ridges
   instead of dunes.
6. **Reef** (`reef.ts`, stream `'reef'`, PLAN_BIOMES 7): the place's reef chance; a reef
   calms the lagoon and drops bars and rips.
7. **Beach state** (`beachState.ts`, stream `'beach-material'`, PLAN_BIOMES 4): grain, then a Wright & Short
   state from Ω = Hb / (ws · T), which sets the face and nearshore slopes, width, bars, rips
   and cusps (shares below; sources in REGIONS.md §2).
8. **Tide** (`tides.ts`, stream `'tide'`, PLAN_BIOMES 5; drawn before the coast): the place's
   mean range, spring–neap from the moon, a random stage. The beach is built for its spring
   range (berm, low-tide terrace above 2 m); meso- and macro-tidal sand beaches are
   tide-modified; the land sits `level` lower and the camera stands by today's water.

## Shares

### Biomes

| Biome | Share | Places it stands for | Sand (within biome) | Rocks | Sea stacks |
|---|---|---|---|---|---|
| `mediterranean` | 15.2% | Mediterranean, Portugal, California, Chile, SW Australia, Cape; subtropical Florida, S Brazil, E Australia, S Japan, Natal | grey 35%, white 34%, golden 31% | 75% | 30% |
| `tropical` | 23.5% | SE Asia, Pacific islands, India, Caribbean, East and West Africa, N Australia | white 64%, golden 34%, pink 2% | 45% | 15% |
| `nordic` | 40.4% | Arctic Canada, Norway, Greenland, Britain, Atlantic Canada, BC, Alaska, Baltic, Patagonia, NZ South | grey 50%, golden 50%, red 0.2% | 85% | 20% |
| `volcanic` | 13.3% | Hawaii, Japan, Iceland, Canaries, Réunion | black 70%, grey 30%, red (Hawaii 4%) | 95% | 45% |
| `desert` | 7.5% | Arabia, Namibia, Sahara coast, Atacama | golden 57%, white 43%, red (Red Sea, Oman 3%) | 40% | 20% |

### Climate by biome (PLAN_BIOMES 11)

The biome is the place's look preset; the climate is drawn per day from the place's weights
(`params.mjs --expect`, tested in `test/climate.test.ts`) and changes the land, sea, sky and
animals:

| Biome | Climates (share of the biome's days) | What the climate changes |
|---|---|---|
| `nordic` | temperate 42%, polar 39%, boreal 19% | temperate: marram and broadleaf woods, golden over grey sand, big swell ×2, haar ×1.4; polar: tundra on any water, grey gravel sand; boreal: conifer and birch (the preset) |
| `mediterranean` | mediterranean 53%, subtropical 42%, temperate 5% | subtropical: sea oats, saw palmetto, cabbage palm, live oak on pale quartz sand (white 60%), fewer boulders, summer storms ×2 and congestus, fog ×0.4, sargassum (N Atlantic) or seagrass, ghost crabs 75%, no seals in the north; temperate (Atlantic Portugal, Yellow Sea): maritime pine and oak, kelp |
| `volcanic` | tropical 28%, subtropical 20%, temperate 18%, boreal 18%, polar 16% | tropical: palms, coconuts, seagrass, boobies, Galápagos sea lions and Hawaiian monk seals; boreal: moss, crowberry, stone birch; polar: tundra |
| `tropical`, `desert` | tropical; arid | – (title "desert" for arid) |

Places own pools win on top: the Hebrides' and west Ireland's shell sand (white 30%, 15%;
machair behind), Tierra del Fuego's southern beech. Flat places (`mountains: false`: Florida,
the Wadden, Baltic, Bahamas, Maldives, the Gulf, Arctic plains) have no mountains, volcanoes or
high islands.

### Ocean by biome

From the places' ocean weights (2024–2026). Southern-hemisphere places are 27% of days;
climates: tropical 27%, polar 19%, temperate 18%, boreal 11%, subtropical 9%,
mediterranean 9%, arid 8%.

| Biome | Pacific | Atlantic | Indian | Arctic | Southern |
|---|---|---|---|---|---|
| tropical | 45% | 20% | 35% | – | – |
| mediterranean | 32% | 60% | 8% | – | – |
| nordic | 24% | 33% | – | 38% | 6% |
| volcanic | 49% | 25% | 10% | – | 16% |
| desert | 30% | 28% | 41% | – | – |

### Coast type and composition

| Coast | Share of days |
|---|---|
| `beach` | 39.5% (0.3% of days with a salt marsh) |
| `rock-shore` | 25.6% |
| `tidal-flat` | 0.3% (2 of the 1095 test days; 87 of 29,220 days 1990–2069) |
| `open-sea` | 34.7% |

| Composition (land days, attempt 0; the page renders mostly more `shoreline`: tools/PARAMS.md) | Share |
|---|---|
| `along-beach` | 28.8% |
| `shoreline` | 28.1% |
| `overlook` | 28.0% (cliff tops on rocky shores, hillsides on beaches) |
| `framed` | 15.1% |

### Rocky shores

PLAN_BIOMES 8, [plans/ROCK_SHORE.md](plans/ROCK_SHORE.md). Measured over 2024–2026: 277 of
1096 days (25.3% of all, 38.7% of land days; `params.mjs --expect` gives 36.6%).

| Biome | Rocky share of its land days |
|---|---|
| nordic | 51% |
| volcanic | 45% |
| desert | 36% |
| mediterranean | 33% |
| tropical | 19% |

- **Place weights** (`ROCK` in `places.ts`, else `ROCK_BY_BIOME`: nordic and volcanic 45%,
  mediterranean 30%, desert 20%, tropical 15%): fjord, North Atlantic and North Pacific coasts
  55% (Norway, Greenland, Svalbard, BC, Alaska's south, Patagonia, Tierra del Fuego, South
  Georgia, NZ South Island, Tasmania, Newfoundland, Nova Scotia, Maine, Scotland, Ireland,
  Cornwall, Brittany, Iceland, California, Central Chile, Kamchatka, Hawaii, the Canaries),
  Azores and Galápagos 60%; the Mediterranean Sea, Portugal, the Cape, the Pacific Northwest,
  Fundy, the Bristol Channel and the Baltic 40%; Atacama 35%, Baja 30%, Arctic Russia 25%,
  North Africa 20%, Namibia 15%; barrier and tidal-flat coasts (Florida, Wadden, PEI,
  Morecambe Bay, Mont-Saint-Michel, Alaska's Arctic coast) 10%. The rock share stays when a
  place also has flats (the beach gives way).
- **Kinds:** platform 44%, cliff 36% (16% plunging, no platform), boulder 20%. Cliff ⇔ overlook.
- **Shapes** (`rockShoreFor`): platforms 25–120 m and near level (0.3–0.7%) below a 2 m spring
  range, else 1–4° (steeper for bigger tides) and 30–200 m down to about spring low water, a
  2–6 m scarp, a 2–12 m back cliff; boulder aprons at 1:3–1:5 with 0.8–2.2 m boulders, 2–6 m up;
  cliffs 15–70 m, 5–25 m platform or plunging. Beds 0.25–0.7 m (cliffs 1–3 m) dipping 1–8°,
  joints 6–20 m apart, gullies 0.4–1.5 m deep.

Other things in view, all days: islands 32% (rocky 13%, high 6%, cay 5%, skerries 4.5%,
karst 3%); landform 31% (range 19%, stratovolcano 9%, shield 4%).

### Tidal flats and salt marsh

Plan and research: [plans/TIDAL_FLAT.md](plans/TIDAL_FLAT.md); how it works: arch/COAST.md
"Tidal flats".

- **Place weights** (`FLAT` in `places.ts`, share of land days): wadden-north-sea,
  morecambe-bay, mont-saint-michel 50%, yellow-sea 45%, fundy 25%; nowhere else. These places
  are 1.94% of days (`params.mjs --expect`), so the planned ~3% of days can't be reached.
- **Tide:** a drawn flat shows only below mid tide (level < 0, ~half the days); at or above
  mid the day is a beach with a salt marsh behind. Flats ≈ 0.29% of days, marsh beaches ≈
  0.28% (80 years: 87 and 83 of 29,220 days).
- **Shapes** (`tidalFlatFor`): s = 0 the marsh edge at mean high water (0.42 × spring range);
  the flat straight to spring low water − 0.3 m at 1:2000–1:300 (steeper for bigger tides),
  0.8–5 km wide (Wadden ~1:800 and 3 km, Fundy ~1:300 and 4 km); main channels every 250–700 m,
  15–45 m wide and 0.8–2 m deep at the flat's end; small creeks every 50–120 m, 4 m wide,
  0.18 m deep, on the upper flat; marsh 80–400 m wide, from 0.2–0.8 m above the flat's top to
  the spring high water + 0.5 m. Run-up 0.08–0.2 m, no surf.
- **Marsh beaches:** sand 10–30 m wide, then a marsh 80–400 m at spring high water + 0.4 m; surf
  and run-up × 0.35 (the flooded flats take the swell).
- **Mud:** grey-brown, Fundy red-brown, Mont-Saint-Michel pale grey tangue (`MUD`).
- **Marsh colour by month** (`MARSH_LOOK`): straw Dec–Mar, green Apr–Aug, sea lavender purple
  Jul–Aug, *Salicornia*/*Suaeda* red Sep–Oct, brown Nov.

### Beach material

Measured over 2024–2026 beach days. Target was ~62% sand, ~15% mixed,
~23% shingle or cobble; the defaults alone gave 53% sand, and sandy overrides for ocean
coasts (below) bring it to:

| Material | Share of beach days | Nordic | Polar climate | Volcanic | Desert | Mediterranean | Tropical |
|---|---|---|---|---|---|---|---|
| `sand` | 58.5% | 38% | 33% | 42% | 71% | 78% | 87% |
| `mixed` | 17.3% | 27% | 27% | 19% | 15% | 4% | 8% |
| `shingle` | 11.2% | 17% | 16% | 15% | 2% | 13% | – |
| `cobble` | 13.0% | 18% | 24% | 23% | 12% | 5% | 4% |

Expected from the tables (place weights × climate × chances): sand 59.1%, mixed 16.7%,
shingle 11.7%, cobble 12.5%.

- **Defaults** (`MATERIAL_CHANCES` by biome, `POLAR_MATERIAL` for a polar climate), in % sand /
  mixed / shingle / cobble: nordic 35/25/20/20, polar 25/25/20/30, mediterranean 55/15/25/5,
  volcanic 50/15/15/20, desert 75/15/5/5, tropical 85/10/0/5. Tune with the overrides, not the
  defaults.
- **More shingle:** britain-ireland, brittany-normandy, atlantic-canada (Chesil, the Normandy
  galets, Nova Scotia's cobble barriers).
- **Mostly sand:** wadden-north-sea, florida-carolinas, PEI, the Baltic (60%), the
  mediterranean biome's ocean coasts (Portugal and Morocco, North Africa and the Levant,
  California, Chile, South Brazil, East and SW Australia, Natal, Cape, South Japan, Taiwan,
  Yellow Sea), Pacific Northwest, Arctic Russia and Alaska's north coast, Arctic Canada
  (35%, the Beaufort coast), Japan (black sand), Galápagos and Hawaii, and the coral and
  quartz-sand tropics (Maldives, Sri Lanka, Andaman; Bahamas and Bermuda; Pacific islands;
  India; West Africa; NE Brazil).
- **Stone colours** (`STONE_COLORS` by biome; Fundy red sandstone): grey granite and
  greywacke, white–cream limestone, black basalt with red scoria, tan and red gravel, pale
  coral rubble.
- **Profile** (from the beach state): shingle and cobble are
  reflective, face 0.08–0.24 by stone size (Jennings & Shulmeister 2002); mixed 0.08–0.14; beach 12–40 m wide, no bars (mixed:
  a sand terrace at most), a 0.5–2.5 m bank behind; nearshore 0.06–0.12
  (0.035–0.06 mixed), so waves break on the beach (surf zone ~12 m vs ~48 m on sand, median;
  breaker index 1.0, Iribarren ~2.8: plunging to surging); run-up × 0.6 on shingle and cobble.
- **Storm ridges** (`coast.ridges`, drawn in the terrain since 2b): the storm ridge (0.6–1.2 m
  high, 3–6 m half-width) where storm swash reaches, 1–2.5 m above the sea and ≥ 6 m behind the
  high-tide line; a 0.3–0.6 m berm at the high-tide line on 72% of stony days; an older ridge
  6–12 m behind on 28%. Crests wander ±1.5 m along the shore. The plan put the storm ridge on
  `beachLines`' storm line (2.2 × daily run-up), but that is only ~1 m up and 2–5 m in on a steep
  beach and merged with the berm; real gravel ridge crests sit at the storm run-up limit (Chesil
  ~10 m, small ridges 1–3 m). On stony days `beachLines().stormLine` is the ridge crest.

Drawn as stone texture in the terrain shader plus mesh stones near the camera; the other props
follow (shingle flowers, driftwood and old wrack on the ridge crest, no ghost crabs or turtle
nests on shingle and cobble, seals above the swash, more boulders on cobble). Specs:
`scenes/stony.json`.

### Beach state and tides

Ω = Hb / (ws · T) from the day's swell and the beach's grain (`beachState.ts`, REGIONS.md §2);
storms and mid-latitude winters one state flatter; meso- and macro-tidal beaches tide-modified
(Masselink & Short 1993; micro-tidal ones stay wave-dominated). Shapes per state: REGIONS.md §2
"Beach states: shape by state".

| State | All beach days | Sand beaches (418) | Australia by length (Short 2006) | Shape |
|---|---|---|---|---|
| reflective | 38.9% | 20% | 30% | face 0.10–0.20, nearshore 0.10–0.15, no bar, cusps 80% |
| low-tide-terrace | 39.2% | 42% | ≈ 20% | a shallow terrace reaching 20–50 m out, small rips every 40–120 m, cusps 60% |
| transverse-bar-rip | 7.7% | 13% | 34% | bar 40–90 m welded to the shore between rips every 150–400 m, cusps 40% |
| rhythmic-bar | 3.4% | 6% | 11% | crescentic bar 70–140 m (+ an outer bar on a third), rips every 150–400 m |
| longshore-bar | 3.6% | 6% | 0.3% | straight bar 100–150 m cut by rips every 250–500 m (+ an outer bar half the time) |
| dissipative | 7.3% | 12% | 4% | face ~0.03, nearshore ~0.01, 2 bars (3 on 15%) to ~360 m, wide surf zone |

Cusps on 54% of beach days, rips on 54%. By biome (sand beaches): coarse coral and black sands
stay steep (tropical 66% reflective or terrace, volcanic 83%); fine white quartz under ocean swell
flattens (Mediterranean and desert ocean coasts ~30% dissipative).

Tides: spring ranges on beach days micro (< 2 m) 58%, meso (2–4 m) 33%, macro (4–6 m) 6%, mega
(> 6 m) 2%. By biome (micro / meso / macro+ as % of all beach days): nordic 18 / 16 / 6, tropical
14 / 8 / 1.5, mediterranean 12 / 2 / 0.4, volcanic 9 / 5 / 0, desert 5 / 3 / 0.3. 42% of beach
days have a low-tide terrace (25% under 50 m wide); on 6% today's water is more than 100 m out.

**Against the measured world.** The only census is Australia's (Short 2006; by length, which
suits a view better than counting beaches; REGIONS.md §2). Before tides, wave-dominated shares
matched on reflective (29% vs 30%). Now the terrace is high: on meso-tidal coasts with small swell
a reflective beach becomes reflective + low-tide terrace, which Short files under tide-modified
(Australia: 47% wave-dominated, 10.5% tide-modified, 34% tide-dominated). Rip-cut transverse bars
are under-drawn (13% vs 34%); longshore bars (6% vs 0.3%) and dissipative beaches (12% vs 4%)
over-drawn. Part of the gap is real (Australia's long Southern Ocean swell, T 12–14 s, keeps Ω
low, while our world includes fine-sand storm coasts: Namibia, Oregon, the North Sea); part is
counting (Short files a multibar beach under its inner bar, mostly transverse bar–rip); part is
ours (storm days and winters shift a beach one state flatter, showing the day rather than the
modal state). **Possible retune (not done; ask first, it changes every beach day):** drop the
winter shift and keep only storms, or classify a multibar beach by its inner bar.

### Reef-fronted beaches

`place.reef` chances (`places.ts` REEF): Maldives 0.95; Pacific islands, Bahamas–Bermuda 0.8;
Andaman–Lakshadweep 0.75; Philippines 0.7; Indonesia, Antilles 0.65; Yucatán–Belize,
Réunion–Mauritius 0.6; East Africa 0.45; North Australia, Comoros 0.4; Sri Lanka 0.35; NE Brazil
0.3; mainland SE Asia, Lesser Antilles volcanic 0.25; Hawaii, Red Sea 0.2; Central America 0.15;
NW Australia, Ningaloo 0.1; India 0.05; West Africa and everywhere else 0.

Measured over 2024–2026 (`params.mjs`): 86 of 1096 days (7.8%) have a reef; ~48% of tropical beach
days (1096 forced tropical beach days: 525). The plan asked ~60%: continental tropical places
(India, West Africa, NW Australia, Central America, North Australia) are a third of tropical
days and mostly lack fringing reefs, so the research wins. By place: Pacific islands 22%,
Indonesia 17%, Philippines 16%, East Africa 8%, Andaman, Antilles 6% each, the rest ≤ 5%. Reef
beaches: reflective 59%, low-tide terrace 41% (the waves crossing the reef are small).
Beachrock on 30% of them.

## Research: the world's coasts

What real coasts are like: the target for PLAN_BIOMES.md.

- **Coast types.** A 2025 global dataset (ESSD) classes ~40% of the world's coastline as
  sand, gravel or shingle, 21% mud, 13% rocky and 27% bare rock with no sediment; ~33%
  is cliffed (other estimates put cliffs on up to ~52%). Landsat mapping (Luijendijk et
  al. 2018) finds ~31% sandy. Mud coasts (~14% of ice-free coast) are 60% tropical
  (mangroves, deltas). So a sandy beach is a minority view of the world's shore; rock is
  as common.
- **Beach states** (Wright & Short 1984). Ω = Hb / (ws · T) sorts beaches into reflective
  (Ω < ~1.5: steep, no bar, waves surge on the face, cusps), intermediate (four states:
  longshore bar, rhythmic bar, transverse bar and rip, low-tide terrace) and dissipative
  (Ω > ~5.5: flat, 2–3 bars, a wide surf zone of spilling breakers). Coarse sand and
  small swell → reflective (coral and black sand islands, the Mediterranean); fine sand
  and big swell → dissipative (Namibia, Oregon, the Wadden). Census shares: "Beach state and
  tides" above; grain, fall velocity and shape by state: REGIONS.md §2.
- **Sand colours.** White (coral and shell carbonate, or pure quartz), golden (quartz with
  iron staining, feldspar), grey (mixed rock, glacial), black (basalt glass, volcanic),
  pink (red foraminifera *Homotrema rubrum* mixed into coral sand: Bermuda, Bahamas'
  Harbour Island, Komodo), red (iron-rich sandstone or scoria: Prince Edward Island,
  Fundy, Kaihalulu on Maui, Santorini), green (olivine, Papakōlea: very rare).
  **Drawn** (PLAN_BIOMES 3, `PLACE_SAND` in `places.ts`, else the biome's `sands`): pink on
  bahamas-bermuda 25%, indonesia 3% (Komodo), other tropical places 1%; red on PEI 60%, Fundy
  40%, Hawaii 4%, Oman–Yemen and Red Sea 3%. Rare on purpose (PLAN_BIOMES decision 4): 2024–2026 has 5
  pink and 1 red beach day of 1096.
- **Tides.** Micro < 2 m (Mediterranean ~0.4 m, Caribbean 0.1–0.2 m, Baltic ~0, Hawaii
  ~0.6 m, most open ocean coasts 1–2 m), meso 2–4 m (Wadden, Iceland, east Africa),
  macro and mega > 4 m in funnelling bays and wide shelves (Fundy 11.7 m mean, Brittany
  and Chausey 8–14 m, Bristol Channel 9.6 m, Ungava, Cook Inlet, Incheon, the Kimberley,
  Atlantic Patagonia ~9–10 m springs). Springs at new and full moon run ~1.2× the mean,
  neaps ~0.8×. Values per region: REGIONS.md §3.
- **Reef-fronted beaches.** Most tropical island beaches sit behind a fringing reef:
  waves break on the reef crest 100–500 m out and lose 50–75% of their height (more at
  low tide); inside lies a calm turquoise lagoon 1–3 m deep and the beach gets small
  re-formed waves. Gaps (passes) let swell and currents through every 0.5–2 km.
  Beachrock (cemented sand ledges) lines many of these beaches.
- **Landforms.** Barrier islands with lagoons behind (US Atlantic and Gulf, Wadden,
  southern Brazil; ~10% of the world's coast), spits and hooks (Farewell Spit, Spurn),
  fjords (Norway, BC, Alaska, Chile, Greenland, NZ), rias (Galicia, Brittany), tidal
  flats and salt marsh in macro-tidal bays and behind barriers, cliffs with wave-cut
  platforms on most rocky coasts.
- **Climates.** Besides the five biomes: temperate oceanic coasts (Britain, Ireland,
  Atlantic Canada, Pacific Northwest, NZ South Island, southern Chile) with mixed forest,
  marram dunes and machair; humid subtropical (Florida–Carolinas, southern Brazil,
  Queensland and NSW, Natal, southern Japan) with live oak, palmetto, sea oats and pale
  quartz sand; polar coasts north of ~70° are tundra, no trees, only dwarf willow and
  birch under 30 cm.
- **Seasons.** Southern-hemisphere coasts have summer in December–February.

Sources: [Global coastal dataset (ESSD preprint 2025)](https://essd.copernicus.org/preprints/essd-2025-388/),
[Taking stock of the world's sandy beaches (Luijendijk et al. 2018)](https://coastalcare.org/2018/08/taking-stock-of-the-worlds-sandy-beaches/),
[Global distribution of coastal cliffs](https://openpolar.no/Record/crwiley:10.1002%2Fesp.4574),
[Beach states, Ω classes (Springer 2025)](https://link.springer.com/article/10.1007/s00367-025-00802-y),
[Short & Hesp 1982](https://data-ww3.ifremer.fr/BIB/Short_Hesp_MG1982.pdf),
[Sand colours (Hawaii Guide)](https://www.hawaii-guide.com/blog/hawaii-colored-sand-beaches-black-green-red-white-explained),
[Bermuda pink sand (BIOS)](https://bios.asu.edu/currents/our-unique-pink-sand),
[Tidal environments (TU Delft)](https://coastal.citg.tudelft.nl/book/3a_tidal_environments.html),
[Tides and coasts (SERC)](https://cdn.serc.carleton.edu/files/NAGTWorkshops/geomorph/activities/GlS210_TidesAndCoasts.pdf),
[Fringing reef wave attenuation](https://www.frontiersin.org/journals/marine-science/articles/10.3389/fmars.2021.684732/epub),
[Coral reef zones](https://www.remnote.com/learn/science/marine-biology/coral-reef-reef-types-and-physical-zones-study-deck),
[Coastal landforms](https://www.savemyexams.com/igcse/geography/edexcel/19/revision-notes/2-coastal-environments/2-1-coastal-processes-and-landforms/2-1-2-coastal-landforms/),
[The myriad faces of the coasts (World Ocean Review)](https://worldoceanreview.com/en/?p=5160),
[Machair (EUNIS)](https://eunis.eea.europa.eu/habitats/8044).

## Research: stony beaches

- **Canada.** Most Canadian beaches are reworked glacial sediment: ice ground the bedrock
  into till (clay to boulders), and waves sort it. Newfoundland is mostly wave-cut cliffs and
  boulder/cobble beaches; sand beaches are the exception, where waves sort enough of it.
  Nova Scotia has pebble–cobble beaches (Pictou County) beside sandy ones (Northumberland
  Strait, Eastern Shore). BC's outer coast and fjords are likewise cobble and gravel pockets
  between rock. Sea ice, tides and steep fjord walls also limit sandy beaches.
- **Where else.** Shingle concentrates on formerly glaciated coasts: northern Atlantic and
  Baltic shores, Britain (Chesil Beach, Brighton), Norway, Iceland, New England, Alaska,
  Patagonia, New Zealand's South Island. The Mediterranean has many pebble beaches too, but
  supplied by rivers and cliffs (Nice, Liguria, Croatia, Amalfi, Greek islands). Volcanic
  islands have black basalt cobble and boulder beaches (Iceland's Reynisfjara mixes black
  sand and pebbles; Hawaii and the Azores have boulder beaches). Coral rubble beaches occur
  on tropical islands after storms.
- **What it looks like.** Steep (shingle lets the swash sink in, so backwash erodes less):
  slopes of ~1:4–1:8 versus 1:10–1:30 for sand (measured on 42 NZ pure gravel beaches:
  0.08–0.24, i.e. 1:12–1:4; Jennings & Shulmeister 2002). One or more storm ridges (berms) at high
  tide and storm lines; no wind ripples, no dunes right behind; waves surge or plunge right
  on the beach (no wide surf zone). Grain sorts along the profile: biggest cobbles at the
  crest, finer gravel or sand at the waterline (mixed sand–gravel). Wet stones are dark and
  glossy; dry stones pale and matte with lots of small shadows. Colours follow the local
  rock: grey granite and greywacke (Canada, Norway), white limestone (Mediterranean), black
  basalt (volcanic), red-brown (Fundy sandstone).

Sources: [Canadian Encyclopedia: Coast](https://www.thecanadianencyclopedia.ca/en/article/coast),
[Newfoundland's sandy beaches, a glacial legacy (Coastal Care)](https://coastalcare.org/2018/02/newfoundlands-sandy-beaches-a-glacial-legacy-by-william-j-neal-joseph-t-kelley/),
[GSC paper 85-12 (Nova Scotia pebble–cobble beaches)](https://download-telecharger.services.geo.ca/pub/nrcan_rncan/publications/STPublications_PublicationsST/120/120287/pa_85_12.pdf),
[EUNIS: Atlantic, Baltic and Arctic coastal shingle beach](https://eunis.eea.europa.eu/habitats/8045),
[UK Coastal Monitoring: gravel coasts](https://coastalmonitoring.org/ccoresources/gravel_coasts/blog/?story_id=6),
[Woodruff et al. 2021, mixed beaches of southern New England](https://websites.umass.edu/woodruff/files/2021/09/45_Woodruff_etal_2021_MarineGeology.pdf).
