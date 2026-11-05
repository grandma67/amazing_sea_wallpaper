# Seasons by region

What changes on a coast through the year, by **climate** (the day's `place.climate`, see
ARCHITECTURE.md "Biome, climate or place") and **hemisphere**. This is the research. The plan is in
[plans/SEASONS_PLAN.md](plans/SEASONS_PLAN.md) and the code in `src/phenology.ts` and
`src/seasons.ts`.

Conventions:

- **Months are northern-hemisphere months** unless a row says "local". South of the equator the
  same season comes six months later (`seasonMonth`, `seasonDay` in `seasons.ts`): "October" for
  a temperate oak means April in Tasmania.
- **Day numbers** (`d`) count from 1 January in the northern-hemisphere calendar (Oct 25 = 298).
- Values marked *(est.)* are our estimates from the general pattern, not from a source we read.
  Sources are at the end and in REFERENCES.md.

## 1. What the project already follows

Before this work (0.97), these already used the season (`seasons.ts`): beach flowers in bloom
(`FLOWERS`), fog season and sea smoke, summer cumulus, polar nacreous clouds in winter,
noctilucent clouds in summer, Mediterranean summer haze, spring and autumn bird passage, salt
marsh colour (`marshLook`), winter beaches one state flatter, Arctic sea ice, polar ship
seasons, turtle nesting (local months per place), waterspout season, the aurora's equinox peak
and the real polar sun (≥ 63°).

Nothing followed the season on **trees, grass, ground cover, seabird colonies, whales, seals,
crabs or lizards**. That is what this research is for.

## 2. Plants

### 2.1 Deciduous trees: colour and leaf fall

Leaves turn (chlorophyll breaks down, carotenoids show yellow and orange, some species make red
anthocyanins), then fall. Dates by climate:

| Climate | Leaf-out (full by) | First tint | Peak colour | Bare | Colours |
|---|---|---|---|---|---|
| Polar (tundra shrubs: dwarf birch, willow, bearberry, blueberry) | d 166 (182) | d 227 (mid-Aug) | d 248 (early Sep) | d 268 (late Sep) | red and orange; dwarf birch yellow first, then red |
| Boreal (birch, aspen, rowan) | d 140 (156) | d 244 (Sep 1) | d 263 (~Sep 20) | d 288 (mid-Oct) | mostly yellow; rowan and shrubs red |
| Temperate (oak, beech, ash) | d 105 (130) | d 268 (late Sep) | d 300 (late Oct–early Nov) | d 335 (~Dec 1) | yellow, orange, copper-brown (oak, beech) |
| Subtropical, Mediterranean | evergreen (live oak, holm oak) | – | – | – | – |
| Tropical (tropical almond, *Terminalia catappa*) | – | local Jan–Feb, Jul–Aug | – | partly bare | red before falling |

Evidence:

- **UK oak** (Nature's Calendar, 2019 records): first tint ~2 October, full tint ~4 November,
  first leaf fall ~1 November, bare ~1 December; about a month from first fall to bare. The
  expected range of first tint runs late August to early November. Benchmark: first colour
  25 September, full tint 30 October.
- **Sweden** (55–68° N, 378 sites): senescence observed from late August into November; in birch
  and poplar it starts *later* further north (not earlier), so latitude within a climate is not
  a simple shift. We key the dates by climate, not latitude.
- **Arctic tundra**: colour from dwarf birch, willow, blueberry and bearberry; a window of a
  couple of weeks in September (Alaska), before snow; frost can strip leaves early.
- **Europe vs eastern North America**: European autumns are yellower, North American ones redder
  (more sun at the same latitude). East Asia (Japan, Korea's maples) is red too *(est.: well
  known, no source read)*.
- **Tropical almond**: sheds all its leaves twice a year (Jan–Feb and Jul–Aug in Vietnam and
  Singapore), turning red or brown-yellow first; helps it survive one or two dry seasons.

Which of our plant kinds are deciduous (our kinds stand in for species, `biome.ts`):

| Kind | Deciduous where | Share of trees |
|---|---|---|
| `birch` | everywhere it grows (boreal, polar, nordic) | 1 |
| `broadleaf` | northern temperate, boreal, polar (oak, beech) | 0.9 (holly, ivy-clad: est.) |
| `broadleaf` | Tierra del Fuego (lenga and ñire, *Nothofagus pumilio*, *N. antarctica*) | 0.6 *(est.)* |
| `broadleaf` | Patagonian fjords | 0.3 *(est.: evergreen coigüe dominates)* |
| `broadleaf` | NZ, Tasmania, Mediterranean (holm oak), subtropical (live oak) | 0: evergreen |
| `broadleaf` | tropical (tropical almond among other trees) | 0.4 *(est.)* |
| `bush` | polar (dwarf birch, willow) / boreal / northern temperate (gorse and heather stay green) | 0.8 / 0.6 / 0.3 *(est.)* |
| `conifer`, `stone-pine`, `cypress`, `olive`, `palm`, `pandanus` | never (no larch in our set) | 0 |
| `acacia` | arid: semi-deciduous in drought, but desert coasts barely change | 0 |

Spring: new leaves are a pale yellow-green for two or three weeks before darkening *(est.)*.

### 2.2 Grass and ground cover

| Climate | Green | Dry or dead | Notes |
|---|---|---|---|
| Mediterranean | Nov–May | **Jun–Oct**: straw-gold, fully dry Jul–Sep | summer dormancy of perennial grasses; annuals die; green-up after the first autumn rains (Oct–Nov) |
| Temperate | Mar–Nov | Dec–Feb: dull, dead tops (~⅓) | British machair and pasture stay fairly green; marram is grey-green all year *(est.)* |
| Boreal | Jun–Sep | Oct–May: brown and straw when not under snow | |
| Polar | Jul–Aug | Sep–Jun: brown tundra (under snow most of it) | Svalbard: melt in early June over 2–3 weeks |
| Subtropical | all year | Dec–Feb slightly duller | |
| Tropical | wet season, and all year outside the places below | savanna coasts' dry season, below | `Place.drySeason`, `phenology.ts` `savannaDry` |
| Arid | – | always straw | |

Evidence: summer dormancy is how Mediterranean perennial grasses survive the dry season (growth
stops, leaves senesce); in Iberia the green-up moves from spring-driven in the cool wet north to
autumn-rain-driven in the dry south; annual pastures germinate with the first lasting autumn
rains.

Savanna coasts, in **real calendar months** (these are local rains, so no hemisphere shift). A place
gets a dry season only if it's clear and latitudes can separate it from the place's wetter coasts:

| Place | Dry | Applies | Evidence | Stays green |
|---|---|---|---|---|
| `north-australia`, `nw-australia` | May–Oct | whole place | most rain December–April; growth slows and dries out April–May; driest late in the dry season (BoM, Greening Australia, Williams and Cook) | Queensland's wet tropics, 18.5–15.5°S on the Pacific side: Cairns ~38–71 mm a month June–September, Townsville 10–21 mm |
| `west-africa` | Nov–Apr | 5–15°N | Conakry dry November–April; Accra and Lomé's Dahomey Gap under ~760 mm a year; Abidjan's rains May–July and October–November | below 5°N: no source for Gabon |
| `central-america` | Dec–Apr | 9–20°N | Pacific dry forest from Chiapas to northwest Costa Rica; Guanacaste nearly rainless December–April; Panama's Pacific mid-December to mid-April | the wetter south, including Colombia's Pacific *(est., no source read)* |
| `east-africa` | May–Oct | 26–10°S | Mozambique: dry May–October in the north, April–September in the south | Kenya and north Tanzania: two rainy seasons |
| `northeast-brazil` | Aug–Dec | 5–3°S | Fortaleza: core rains March–April (1974–2008 study), July–November about 12–95 mm a month | Recife ~388 mm in July, Salvador ~137 mm in November |
| `india` | Dec–May | 15–22°N | southwest monsoon June–September brings most of the rain; the northeast monsoon lasts to mid-December. No source named Konkan or Odisha directly | Kerala and Tamil Nadu (northeast monsoon) |
| `indonesia` | May–Oct | 11–8°S | Bali and Komodo are dry May–October (indirect); the same cycle as north Australia across the sea | the wet equatorial islands |

The grass cures over the first six weeks, holds at `dry` 0.8 and greens in the month after. The six
weeks, the month, 0.8 and every latitude limit are *(est.)*. All of this comes from search summaries,
many of them travel pages; the Brazil study and the rainfall tables are the firmest.

Left out, or wrong within a place:

- **`mainland-se-asia`, `philippines`:** sources conflict (central Vietnam, the Philippine west coast),
  and each place mixes wet and dry coasts that latitude can't separate.
- **Madagascar's east coast** is inside `east-africa`'s latitudes and dries with Mozambique, though it's
  humid *(est., no source read)*.
- **Gujarat:** only the coast up to 22°N is in `india`; Kutch has no place.

### 2.3 Already done: flowers and salt marsh

Beach flowers bloom in their months (`FLOWERS`, `shoreLife.ts`); salt marsh turns from green to
straw, glasswort red in autumn (`marshLook`).

### 2.4 Sargassum on the beach

`phenology.ts` `sargassumSeason`, a threshold on the wrack draw in `props/debris.ts`. These are
**real calendar months**, not the day's season: it's one Atlantic bloom, not a local summer.

| Coast | Months | Drawn wrack kept | |
|---|---|---|---|
| Caribbean, subtropical North Atlantic | Apr–Sep | all | peak about June–July (USF) |
| Same, Oct–Mar | | a fifth | the low season is sourced only weakly; ×0.2 is *(est.)* |
| West Africa | all year | all | its peaks differ: March–May and September (2026 preprint, not peer reviewed); Nigeria May–August (2011–12 survey); satellite data are thin |
| Northeast Brazil | all year | all | no stranding calendar found |

All of this comes from search summaries, not the full papers. West Africa and northeast Brazil are
left as they were rather than given the Caribbean's months.

### 2.5 Leaf litter

Leaves lie from peak colour until spring's growth covers them (temperate) or the first lasting snow
buries them (boreal, polar, using the snow plan's months). All dates *(est.)*, from §2.1's table:

| Climate | Builds (day) | Gone (day) |
|---|---|---|
| Temperate | 300–335 | 105–135 |
| Boreal | 263–288 | 320–340 |
| Polar | 248–268 | 269–285 |
| Tropical (almond) | its shedding months only: they rot within weeks *(est.)* | |

- **It lasts:** oak and beech litter loses only part of its mass in a year or two (beech ~13% in a
  year in Turkey; ~40% oak and ~26% beech in 24 months in microcosms; oak disappears ~1.7 times as
  fast as beech in a French field study), from search summaries. So a winter floor is a real look.
- **Colour:** we found no source on how fast it fades. Leaves weather brown over 90 days *(est.)*.
- **Sizes** *(est.)*: oak and beech ~10 cm, southern beeches ~4 cm, birch ~5 cm, tundra shrubs ~2.5
  cm, tropical almond ~20 cm.
- **Density** *(est.)*: a real floor has hundreds of leaves per m²; we draw 60, on the litter colour.
- **In the wrack: not modelled.** On Oregon's rocky coast red alder leaves arrive by small streams
  in the autumn, and in the wrack range from negligible to the main detritus by beach, so a rule by
  season wouldn't hold.

## 3. Animals

### 3.1 Seabird colonies (attendance)

| Colony | At the colony | Away (at sea) | Source |
|---|---|---|---|
| Atlantic puffin, guillemot | late Mar–Apr to early–mid Aug (Shetland 2–3 weeks later than the south) | Sep–Mar, far out in the North Sea and Atlantic | UK guides, Isle of May, Shetland |
| Northern gannet | late Feb (some from Jan) to end of Oct | Nov–Jan, off West Africa | Bass Rock (Scottish Seabird Centre) |
| Australasian and Cape gannets | local Aug–Apr *(est.)* = the same northern months | | |
| Tropical boobies, frigatebirds | all year (breeding all year or by island) | – | *(est.)* |
| Penguins (South Georgia: king, gentoo) | all year (king chicks over winter) | – | *(est.)* |

The rock stays guano-white out of season (guano isn't washed off in a winter) *(est.)*; only the
birds are gone.

### 3.2 Whales: humpback migration

Every humpback population but the Arabian Sea's (resident off Oman) migrates: **summer and
autumn feeding at high latitudes, winter breeding in the tropics** (IWC). Breeding: Dec–Mar in
the north (Hawaii mid-Nov to early May), Jul–Oct in the south (Western Australia Jun–Oct). In
northern months for both hemispheres:

| Coast | Humpbacks | Months |
|---|---|---|
| Polar, boreal, temperate (feeding grounds) | yes | May–Nov |
| Tropical, subtropical, arid (breeding grounds) | yes | Dec–Apr |
| Mediterranean climate coasts (California, Chile, Cape, SW Australia: migration corridors, some summer feeding) | half as often outside passage | passage Mar–May, Sep–Dec |
| Arabian Sea (Oman) | all year | |

Out of season a few stragglers stay (some populations skip migration in some years).

### 3.3 Seals hauled out

| Kind | On land most | Least | Source |
|---|---|---|---|
| Harbour seal | pupping (Jun–Jul) and moult (Aug) | winter (more time at sea) *(est.)* | Norway, Scotland, Wadden Sea surveys |
| Northern elephant seal (California) | Dec–Mar breeding, Apr–Aug moult, autumn juveniles: all year | – | Año Nuevo State Park |
| Southern elephant seal (South Georgia, Tierra del Fuego) | local Sep–Nov breeding, Dec–Apr moult | local May–Aug at sea *(est.)* | |
| Fur seals, sea lions | all year (breeding Nov–Jan south) | – | *(est.)* |

### 3.4 Winter sleep and winter absence

No big coastal animal of ours truly hibernates; the seasonal ones go dormant in burrows or move
offshore:

| Animal | Where | Dormant or away | Evidence |
|---|---|---|---|
| Atlantic ghost crab (*Ocypode quadrata*) | subtropical, Mediterranean, temperate sand | Oct–Apr in the Carolinas, in its burrow; stays in below ~15.5 °C air | animaldiversity.org; Texas/Georgia burrow study |
| Ghost crabs | tropical, arid | active all year | |
| Shore crab (*Carcinus maenas*) | temperate, boreal | moves to deeper water in winter *(est.)* | |
| Spiny-tailed lizard (*Uromastyx*) | Arabia | brumates ~Oct/Nov–Feb, 2–5 months; out on warm days | SF Zoo fact sheet, keeper sources |
| Monkeys, monitors, iguanas, crocodiles, hippos | tropical | active all year | |
| Sea turtles | – | already by local nesting months | |

### 3.5 Birds that move

| Bird | Polar | Boreal | Temperate | Mediterranean, subtropical |
|---|---|---|---|---|
| Geese | breed Jun–Aug, passage May and Sep; gone Oct–Apr | passage Apr–May, Sep–Oct; few in summer; gone in winter | passage Mar–May, Sep–Nov; **wintering flocks** Dec–Feb (Wadden, Britain); few in summer | winter Nov–Feb; passage Mar–Apr, Oct; gone in summer |
| Sea ducks (eiders, scoters) | as geese | winter on open boreal seas | winter and passage | winter |
| Gulls | most leave Nov–Mar (ivory and glaucous gulls stay) *(est.)* | all year | all year | all year |
| Flamingos | – | – | – | Mediterranean all year (Camargue), Florida winter *(est.)* |

## 4. Weather and climate (already mostly in the project)

- **Fog, haze, clouds:** fog seasons, summer haze, summer cumulus: done (§1).
- **Snow and ice on the shore:** polar and boreal winters (and nordic late winter) cover the
  land; an ice foot forms at the high-water line. Planned in PLAN_BIOMES phase 13 (snow and ice
  foot); the season tables here give its months (see the plan).
- **Mountain snow line** (`phenology.ts` `SNOW_SEASON`): lowest mid-January to mid-March, highest
  mid-August to mid-September, in the day's hemisphere. Alps 1961–2010: median snow line ~800 m in
  winter, ~3080 m in summer (a station-based cover median, so a rough guide). The drawn line is
  scaled: winter ×0.6 (polar, boreal, temperate), ×0.7 (Mediterranean), ×0.85 (subtropical) *(est.)*,
  late summer ×1.2 *(est.)*. Mountains drawn bare come down to a winter altitude if tall enough:

  | Climate | Bare mountain whitens from | Winter line | |
  |---|---|---|---|
  | Polar | 900 m | 100–400 m | *(est.)* |
  | Boreal | 900 m | 200–600 m | *(est.)* |
  | Temperate | 1500 m | 800–1300 m | Alps' winter median, above |
  | Mediterranean | 2000 m | 1200–1700 m | *(est.)* |
  | Subtropical | 2500 m | 1800–2300 m | *(est.)* |

  Tropical and arid stay as drawn. Mauna Kea (4207 m) has snow mostly November–March and has had
  it down to about 2800 m, so a tropical mountain needs real height.
- **Baltic sea ice:** the Gulf of Bothnia freezes Jan–Apr most winters *(est.)*; only Arctic ice
  exists today.

## Sources

- Leaf litter (§2.5), from search summaries: Jonard et al. 2008 (Canadian Journal of Forest
  Research), Kara et al. 2014 (Journal of Soil Science and Plant Nutrition), Sariyildiz & Anderson
  2003, and a study of terrestrial matter in Oregon's rocky intertidal
  (https://www.aminer.org/pub/5c7573f8f56def97988f634f/consumption-of-terrestrial-organic-matter-in-the-rocky-intertidal-zone-along-the).

- Woodland Trust, Nature's Calendar autumn analyses (2019 records, 2022):
  https://naturescalendar.woodlandtrust.org.uk/blog/2020/recording-autumn-phenology-an-analysis-of-2019-records
- Swedish citizen-science autumn colour study (EGU 2014/2017 abstracts):
  https://opac.geologie.ac.at/ais312/dokumente/EGU/EGU2014-15812.pdf
- Europe yellow vs North America red (phys.org, 2021): https://phys.org/news/2021-11-north-american-fall-red-europe.pdf
- Tundra autumn colour (Popular Science): https://www.popsci.com/science/tundra-fall-foliage/
- Svalbard snowmelt: https://pureportal.spbu.ru/ru/publications/physical-and-optical-properties-of-snow-covering-arctic-tundra-on-svalbard(eceba47e-64e1-449d-a07a-a7e7072589af).html
- Snow line: Alps 1961–2010, https://link.springer.com/article/10.1007/s00704-012-0688-9 ; Mauna Kea,
  https://www.hawaiimagazine.com/snow-on-mauna-kea/
- Tropical almond: https://biodiversitysg.nparks.gov.sg/our-biodiversity/flowering-plants/trees/ketapang-/ ,
  https://apps.worldagroforestry.org/treedb2/speciesprofile.php?Spid=1616
- Mediterranean summer dormancy: https://pmc.ncbi.nlm.nih.gov/articles/PMC2803600 ,
  https://pubmed.ncbi.nlm.nih.gov/33873715/
- Puffins: https://www.shetland.org/blog/when-to-see-puffins-in-shetland ,
  https://theedinburghreporter.co.uk/2025/08/puffins-take-flight/?print=pdf
- Bass Rock gannets: https://seabird.org/webcams
- Humpbacks (IWC Whale Watching Handbook): https://wwhandbook.iwc.int/en/species/humpback-whale
- Harbour seal haul-out seasons (NAMMCO): https://septentrio.uit.no/index.php/NAMMCOSP/article/download/2695/2544/10327
- Elephant seals, Año Nuevo: https://www.parks.ca.gov/?page_id=29375
- Ghost crab: https://animaldiversity.org/accounts/Ocypode_quadrata/ ,
  https://archives.datapages.com/data/bulletns/1977-79/data/pg/0063/0003/0450/0466.htm
- Uromastyx: https://www.sfzoodocents.org/notebook/FactSheets/REPTILIA/Uromastyx.pdf
- Savanna dry seasons (search summaries): BoM, https://media.bom.gov.au/social/blog/2171/fire-weather-across-northern-australia/ ;
  Greening Australia, https://www.greeningaustralia.org.au/publications/grasses-northern-territory-savannas ;
  Williams and Cook 2001, https://ava.icmbio.gov.br/pluginfile.php/4592/mod_data/content/19705/2001_3_._Savanna_fire_regimes_by_Dick_Williams_and_Garry_Cook.pdf ;
  Climate of Ghana, https://en.wikipedia.org/wiki/Climate_of_Ghana ; Senegal, https://visiearth.pages.dev/sn/geography-and-climate/ ;
  rainy season by latitude (low quality), https://www.vf-tropi.com/vf-wa04.html ;
  Guinea, https://www.globalsecurity.org/military/world/africa/gn-climate.htm ; Dahomey Gap, https://en.wikipedia.org/wiki/Dahomey_Gap ;
  Abidjan, https://en.wikipedia.org/wiki/West_African_forest_zone ;
  Central American dry forests, https://en.wikipedia.com/wiki/Central_American_dry_forests ;
  Costa Rica, https://ticotimes.net/2024/11/13/costa-ricas-dry-season-transforms-wildlife-watching ;
  Mozambique, https://www.expertafrica.com/mozambique/info/mozambique-weather-and-climate ;
  East Africa's rains, https://www.nature.com/articles/s43017-023-00397-x.pdf ;
  Fortaleza and Recife, https://repositorio.ufc.br/bitstream/riufc/64563/1/2015_art_gahounsougbo.pdf ;
  Brazil's monthly rain, https://www.currentresults.com/Weather/South-America/Brazil/precipitation-july.php ;
  India's monsoons, https://www.wionews.com/india-news/met-dept-announces-onset-of-northeast-monsoon-withdrawal-of-southwest-monsoon-1760602512372/amp ;
  Cairns and Townsville, https://weather2travel.com/queensland/cairns/climate , https://weather2travel.com/queensland/townsville/climate/?Units=1
- Sargassum (search summaries): USF outlook, https://optics.marine.usf.edu/projects/SaWS/pdf/Sargassum_outlook_2023_bulletin4_USF.pdf ;
  West Africa, https://egusphere.copernicus.org/preprints/2026/egusphere-2026-2727/egusphere-2026-2727.pdf
  and https://pml.ac.uk/news/why-is-sargassum-seaweed-swamping-west-african-coasts/
