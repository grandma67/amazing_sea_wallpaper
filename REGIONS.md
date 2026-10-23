# Regions

Research for PLAN_BIOMES.md: the named places each biome × ocean stands for (phase 2), sand
grain sizes and fall velocities (phase 4), tidal ranges (phase 5) and bioluminescence
seasons (phase 13). Status 2026-10-23: research only, nothing built.

Values marked **≈** are from general knowledge or a single non-authoritative page; check
them against national tide tables or papers before relying on them in a test.

## 1. Regions by biome and ocean

**Method.** Weights follow coastline length (CIA World Factbook, with the World Resources
Institute figure where the Factbook's count is clearly too coarse, e.g. archipelagos),
then are adjusted by judgment for how much of that coast fits the biome. Coastline length
is fractal (it depends on the ruler), so treat the weights as a rough ranking, not
measured shares. Ocean shares per biome stay as today (COASTS.md, `pickOcean`).

**Climate** column = the climate the region gives in PLAN_BIOMES phase 11. Since each
region has one climate, the climate split falls out of the region weights instead of
being drawn separately.

**Wildlife regions.** Today `wildlife.ts` `regionFor` picks these warm regions (weights
fixed by the code): tropical Pacific se-asia 60 / central-america 40; tropical Indian
se-asia 65 / east-africa 35; tropical Atlantic caribbean 65 / west-africa 35; volcanic
Pacific under 25° galapagos 50 / hawaii 50; mediterranean Atlantic → mediterranean;
desert Indian → arabia. Rows marked **new parent** below are missing from that list and
would change which animals appear on some days (see "Open questions").

### Nordic

Ocean shares: Atlantic 39%, Arctic 30%, Pacific 21%, Southern 10%.

| Ocean | Region | Places | Weight | Latitude | Climate | Coastline basis |
|---|---|---|---|---|---|---|
| Atlantic | `norway` | Norwegian coast and fjords, Lofoten | 30 | 58–71° | by sub-place (§1b): west temperate, north boreal | 83,281 km incl. islands (CIA) |
| Atlantic | `britain-ireland` | Scotland, Ireland, Wales, Cornwall | 18 | 50–59° | temperate | UK 12,429 + Ireland 1,448 km (WRI 19,717 + 6,437) |
| Atlantic | `atlantic-canada` | Newfoundland, Nova Scotia, Fundy, PEI, Gulf of St Lawrence, Maine | 20 | 43–52° | temperate (Newfoundland boreal, §1b) | a fraction of Canada's 202,080 km (most of it is Arctic) |
| Atlantic | `baltic` | Sweden, Finland, Estonia, Danish islands | 12 | 54–66° | boreal | Sweden 26,384, Finland 31,119 km (WRI; skerry archipelagos) |
| Atlantic | `wadden-north-sea` | Netherlands, Germany, Denmark North Sea | 6 | 52–57° | temperate | 451 + 2,389 + 7,314 km |
| Atlantic | `brittany-normandy` | Brittany, Normandy, Channel Islands | 6 | 47–50° | temperate | part of France 4,853 km |
| Atlantic | `iceland-faroe` | Iceland (non-volcanic beaches), Faroes | 8 | 62–66° | boreal | 4,970 + 1,117 km |
| Arctic | `arctic-canada` | Canadian Arctic Archipelago, Hudson Bay, Ungava | 40 | 58–78° | polar | most of Canada's 202,080 km |
| Arctic | `greenland` | Greenland west and east coasts | 30 | 60–78° | polar | 44,087 km |
| Arctic | `arctic-russia` | Kola, White Sea, Siberian coast | 20 | 66–78° | polar | part of Russia 37,653 km (WRI 110,310) |
| Arctic | `svalbard` | Svalbard | 10 | 76–78° (basin max 78°) | polar | 3,587 km |
| Pacific | `alaska` | SE Alaska, Gulf of Alaska, Cook Inlet, Aleutians | 40 | 54–61° | boreal | part of US 19,924 km |
| Pacific | `british-columbia` | BC outer coast and fjords, Haida Gwaii | 25 | 48–55° | temperate | part of Canada |
| Pacific | `pacific-northwest` | Washington, Oregon | 10 | 42–48° | temperate | part of US |
| Pacific | `russian-far-east` | Okhotsk Sea, Sakhalin (non-volcanic) | 10 | 48–60° | boreal | part of Russia |
| Pacific | `new-zealand-south` | NZ South Island | 15 | 41–47° | temperate | part of NZ 15,134 km |
| Southern | `patagonia-fjords` | Chilean fjords, Patagonia | 50 | 42–55° | temperate (subpolar oceanic) | Chile 6,435 km (WRI 78,563, mostly fjords) |
| Southern | `tierra-del-fuego` | Tierra del Fuego, Beagle Channel | 20 | 53–56° | temperate | part of Chile and Argentina |
| Southern | `tasmania` | Tasmania's south and west coasts | 15 | 41–44° | temperate | part of Australia |
| Southern | `south-georgia-falklands` | South Georgia, Falklands | 15 | 51–55° | by sub-place (§1b) | – |

### Mediterranean

Ocean shares: Atlantic 58% (in the code "Atlantic" = the Mediterranean Sea itself),
Pacific 29%, Indian 13%. Subtropical regions provide PLAN_BIOMES phase 11's
`subtropical` climate (≈ 25–30% of mediterranean days with these weights).

| Ocean | Region | Places | Weight | Latitude | Climate | Coastline basis |
|---|---|---|---|---|---|---|
| Atlantic | `mediterranean-sea` | Greece, Italy, Croatia, Turkey, Spain, France, North Africa | 70 | 31–45° | mediterranean | Greece 13,676, Italy 7,600, Croatia 5,835, Turkey 7,200 km… |
| Atlantic | `portugal-morocco` | Portugal, Atlantic Spain, Atlantic Morocco | 8 | 30–43° | mediterranean | 1,793 + part of 2,945 km |
| Atlantic | `florida-carolinas` | Florida, Georgia, Carolinas (barrier islands) | 14 | 25–35° | subtropical | part of US |
| Atlantic | `south-brazil` | South Brazil, Uruguay | 8 | 25–35° (south) | subtropical | part of Brazil 7,491 km |
| Pacific | `california` | California | 35 | 32–42° | mediterranean | part of US |
| Pacific | `central-chile` | Central Chile | 25 | 30–38° (south) | mediterranean | part of Chile |
| Pacific | `east-australia` | Queensland south, NSW | 20 | 25–35° (south) | subtropical | part of Australia 25,760 km |
| Pacific | `east-asia-subtropical` | South Japan, Taiwan, South China coast, Korea's west coast (Yellow Sea) | 20 | 22–38° | subtropical | parts of Japan 29,751, China 14,500 km |
| Indian | `sw-australia` | Perth, Margaret River, Esperance | 50 | 30–35° (south) | mediterranean | part of Australia |
| Indian | `cape` | Western and Southern Cape | 20 | 33–35° (south) | mediterranean | part of South Africa 2,798 km |
| Indian | `natal` | KwaZulu-Natal, south Mozambique | 30 | 25–31° (south) | subtropical | part of South Africa |

### Tropical

Ocean shares: Pacific 47%, Indian 34%, Atlantic 19%.

| Ocean | Region | Places | Weight (today) | Weight (proposed) | Notes |
|---|---|---|---|---|---|
| Pacific | `se-asia` | Philippines, east Indonesia, Vietnam, PNG | 60 | 50 | Philippines 36,289, Indonesia 54,716 km |
| Pacific | `pacific-islands` **new parent** | Fiji, Tahiti, Samoa, Micronesia, Vanuatu, Solomons | – | 25 | no monkeys; reef-fronted beaches; French Polynesia 2,525, Fiji 1,129 km (WRI 5,830, 4,638) |
| Pacific | `central-america` | Pacific Mexico (tropical), Costa Rica, Panama, Colombia | 40 | 25 | |
| Indian | `se-asia` | West Indonesia, Thailand (Andaman), Malaysia | 65 | 35 | |
| Indian | `south-asia-islands` **new parent** | Maldives, Sri Lanka, Andaman, Lakshadweep, Seychelles | – | 25 | no vervets or Nile crocodiles; Maldives 644 km (WRI 2,002) |
| Indian | `east-africa` | Kenya, Tanzania, Mozambique, Madagascar, Comoros | 35 | 30 | Madagascar 4,828, Mozambique 2,470 km |
| Indian | `nw-australia` **new parent** | Kimberley, Broome | – | 10 | saltwater crocodiles; macro-tidal |
| Atlantic | `caribbean` | Greater and Lesser Antilles, Yucatán, Belize, Bahamas, Bermuda | 65 | 65 (incl. bahamas-bermuda) | Cuba 3,735 km (WRI 14,519) |
| Atlantic | ↳ `bahamas-bermuda` (sub-place of caribbean, §1b) | Bahamas, Turks and Caicos, Bermuda | – | (≈ 10 of the 65) | pink sand; Bahamas 3,542 km |
| Atlantic | `west-africa` | Gabon, Loango, Bijagós, Senegal, Gulf of Guinea | 35 | 20 | Gabon 885, Guinea-Bissau 350 km (WRI 3,176) |
| Atlantic | `northeast-brazil` **new parent** | Bahia to Ceará | – | 15 | green turtles, no monkeys on the beach |

Tropical latitudes stay 5–23° as today.

### Volcanic

Ocean shares: Pacific 47%, Atlantic 31%, Indian 11%, Southern 11%.

| Ocean | Region | Places | Weight | Latitude | Notes |
|---|---|---|---|---|---|
| Pacific (< 25°) | `hawaii` | Hawaiian Islands | 50 of < 25° | 19–22° | today's wildlife region |
| Pacific (< 25°) | `galapagos` | Galápagos | 50 of < 25° | 0–1° (basin min 5: widen) | today's wildlife region |
| Pacific (≥ 25°) | `japan` | Honshu, Kyushu, Izu Islands | 45 | 30–43° | |
| Pacific (≥ 25°) | `kamchatka-kurils` | Kamchatka, Kurils, Aleutians | 30 | 43–60° | |
| Pacific (≥ 25°) | `new-zealand-north` | Taranaki, Bay of Plenty, Auckland | 25 | 36–40° (south) | |
| Atlantic | `iceland` | Reynisfjara, Snæfellsnes | 45 | 63–66° | |
| Atlantic | `canaries` | Canary Islands | 25 | 27–29° | |
| Atlantic | `azores-madeira` | Azores, Madeira | 15 | 32–39° | |
| Atlantic | `lesser-antilles-volcanic` | Montserrat, St Lucia, Martinique, Cape Verde | 15 | 13–17° | |
| Indian | `reunion-mauritius` | Réunion, Mauritius | 60 | 20–21° (south) | |
| Indian | `comoros` | Comoros | 25 | 11–13° (south) | |
| Indian | `sumatra-java-south` | Indian Ocean coasts of Java and Sumatra | 15 | 6–9° (south) | |
| Southern | `south-shetland` | Deception Island, South Shetlands | 40 | 62–63° (south) | polar |
| Southern | `south-sandwich` | South Sandwich Islands | 20 | 56–60° (south) | polar |
| Southern | `kerguelen-heard` | Kerguelen, Heard Island | 20 | 49–53° (south) | polar |
| Southern | `nz-subantarctic` | Auckland, Campbell Islands | 20 | 50–53° (south) | |

### Desert

Ocean shares: Indian 45%, Pacific 28%, Atlantic 27%.

| Ocean | Region | Places | Weight | Latitude | Notes |
|---|---|---|---|---|---|
| Indian | `arabia` | Red Sea, Oman, Persian Gulf, Yemen | 60 (today 100) | 12–30° | Saudi Arabia 2,640, Oman 2,092, Yemen 1,906, UAE 1,318 km |
| Indian | `horn-of-africa` **new parent** | Somalia, Eritrea, Djibouti | 15 | 2–16° | |
| Indian | `western-australia-desert` **new parent** | Shark Bay, Ningaloo, Pilbara | 25 | 20–27° (south) | |
| Pacific | `atacama-peru` | Atacama, Peru | 60 | 5–27° (south) | camanchaca; Peru 2,414 km |
| Pacific | `baja-sonora` | Baja California, Gulf of California | 40 | 23–31° | |
| Atlantic | `sahara-atlantic` | Mauritania, Western Sahara, south Morocco | 55 | 18–29° | Mauritania 754 km |
| Atlantic | `namibia` | Skeleton Coast, Walvis Bay | 45 | 17–29° (south) | Namibia 1,572 km |

**Hemisphere:** "(south)" after a latitude marks a southern-hemisphere region; all
Southern Ocean regions are southern. Everything else is northern.

## 1b. Sub-places

A sub-place is drawn with the region (PLAN_BIOMES 2a) and overrides the region's values
where listed; regions not listed have no sub-places. Weights are within the region, by
judgment (≈).

| Region | Sub-place | Weight | Overrides |
|---|---|---|---|
| `norway` | `norway-west` (Stavanger to Trøndelag) | 50 | 58–64°, temperate, tide ≈ 0.3–1.5 m |
| `norway` | `norway-north` (Nordland, Lofoten, Troms, Finnmark) | 50 | 64–71°, boreal, tide ≈ 2–3 m |
| `atlantic-canada` | `newfoundland` | 30 | 46–52°, boreal |
| `atlantic-canada` | `nova-scotia` (Atlantic shore) | 25 | 43–47° |
| `atlantic-canada` | `fundy` | 15 | 44–46°, tide 11.7 m mean (to ~16 m), red mud and sand ~40% of beaches, tidal flats |
| `atlantic-canada` | `pei` (and Northumberland Strait) | 15 | 46–47°, red sand ~60%, tide ≈ 1 m |
| `atlantic-canada` | `maine` | 15 | 43–45°, tide ≈ 3 m |
| `britain-ireland` | `scotland` | 35 | 55–59°, haar |
| `britain-ireland` | `ireland` | 25 | 51–55° |
| `britain-ireland` | `cornwall-wales` | 25 | 50–53° |
| `britain-ireland` | `bristol-channel` | 7 | 51°, tide 9.6 m mean (to ~15 m) |
| `britain-ireland` | `morecambe-bay` | 8 | 54°, macro tide, tidal flats |
| `brittany-normandy` | `brittany` | 70 | 47–49°, tide ≈ 5–8 m |
| `brittany-normandy` | `mont-saint-michel` (Saint-Malo, Chausey) | 30 | 48–49°, tide 8–14 m, tidal flats |
| `south-georgia-falklands` | `south-georgia` | 50 | 54–55° (south), polar |
| `south-georgia-falklands` | `falklands` | 50 | 51–52° (south), temperate |
| `east-asia-subtropical` | `south-japan` | 45 | 30–35° |
| `east-asia-subtropical` | `taiwan-south-china` (incl. Hong Kong, Matsu) | 35 | 22–26°, blue tears Apr–Jun |
| `east-asia-subtropical` | `yellow-sea` (Korea west, Incheon) | 20 | 34–38°, temperate, tide ~9.5 m spring, tidal flats |
| `caribbean` | `antilles` | 67 | 12–23°, tide 0.1–0.2 m |
| `caribbean` | `yucatan-belize` (incl. Holbox) | 15 | 16–21°, bioluminescence Jun–Sep |
| `caribbean` | `bahamas-bermuda` | 18 | 21–32°, pink sand ~25%, tide ≈ 0.8 m |
| `arabia` | `red-sea` | 45 | 13–28°, tide ≈ 0.5 m, reefs |
| `arabia` | `oman` | 30 | 17–24° |
| `arabia` | `persian-gulf` | 25 | 24–30°, tide ≈ 1–3 m |
| `south-asia-islands` | `maldives` | 40 | 0–7°, bioluminescence Jun–Oct |
| `south-asia-islands` | `sri-lanka` | 30 | 6–10° |
| `south-asia-islands` | `andaman-lakshadweep` | 30 | 8–14°, bioluminescence Oct–Mar |
| `alaska` | `cook-inlet` | 15 | 59–61°, tide ~9 m mean (to ~11.6 m) |
| `alaska` | `se-alaska` | 50 | 54–59°, tide ≈ 4–5 m |
| `alaska` | `gulf-aleutians` | 35 | 52–60° |

The `bahamas-bermuda` row in the tropical table above is this sub-place (its weight there
is the same share of the Atlantic tropical days: 18% of caribbean's 65 ≈ 12).

## 2. Sand grain and fall velocity (phase 4)

### Size classes (Wentworth)

| Class | Size |
|---|---|
| very fine sand | 0.063–0.125 mm |
| fine sand | 0.125–0.25 mm |
| medium sand | 0.25–0.5 mm |
| coarse sand | 0.5–1 mm |
| very coarse sand | 1–2 mm |
| granules / gravel | 2–4 mm |
| shingle (pebbles) | ~4–64 mm |
| cobbles | 64–256 mm |

### Fall velocity

Soulsby (1997): w_s = (ν/d) · [√(10.36² + 1.049·D*³) − 10.36], with
D* = d · [(s − 1)g/ν²]^(1/3). Below, ν = 1.05×10⁻⁶ m²/s (≈ 18 °C sea water).
Computed here, not copied from a table. Carbonate grains are given 0.75 × the
sphere value, because their platy, porous shapes settle more slowly; that factor is an
assumption.

| d (mm) | Quartz, s = 2.65 (cm/s) | Basalt glass, s ≈ 2.9 | Carbonate, s = 2.71, × 0.75 |
|---|---|---|---|
| 0.125 | 1.1 | 1.3 | 0.9 |
| 0.2 | 2.5 | 2.8 | 2.0 |
| 0.25 | 3.5 | 3.9 | 2.7 |
| 0.35 | 5.2 | 5.7 | 4.0 |
| 0.5 | 7.3 | 7.9 | 5.6 |
| 0.75 | 9.9 | 10.7 | 7.6 |
| 1 | 12.0 | 12.9 | 9.2 |
| 1.5 | 15.3 | 16.4 | 11.7 |
| 2 | 17.9 | 19.2 | 13.7 |

### Grain per sand type

| Sand | Median grain | Basis |
|---|---|---|
| white coral/shell (tropical) | 0.3–1 mm, medium to very coarse | Oahu calcareous samples "medium to very coarse"; Waikiki "fine to medium" |
| white quartz (e.g. Whitehaven) | 0.15–0.3 mm ≈ | very fine and well sorted |
| golden quartz | 0.2–0.5 mm ≈ | the commonest beach sand |
| grey (mixed rock, north) | 0.2–0.6 mm ≈ | glacial sources are poorly sorted |
| black basalt | 0.3–2 mm | Big Island basalt-glass beach "mostly fine (some medium)"; Reynisfjara coarse with pebbles |
| pink (foraminifera) | 0.5–1 mm ≈ | as coral sand |
| red (iron-stained quartz, PEI) | 0.15–0.3 mm ≈ | fine sandstone sources |
| shingle | 4–64 mm | Chesil Beach: pea-sized at Bridport to fist-sized at Portland |
| cobble | 64–256 mm | Wentworth |

### Ω and beach state

Ω = Hb / (w_s · T). Reflective < ~1–1.5, intermediate ~1.5–5.5, dissipative > ~5.5
(thresholds vary between papers). Computed examples, quartz:

| Grain | Hb 0.5 m, T 8 s | Hb 1.5 m, T 10 s | Hb 2.5 m, T 12 s |
|---|---|---|---|
| 0.2 mm | 2.5 (intermediate) | 5.9 (dissipative) | 8.2 (dissipative) |
| 0.3 mm | 1.4 (reflective edge) | 3.4 (intermediate) | 4.8 (intermediate) |
| 0.5 mm | 0.9 (reflective) | 2.1 (intermediate) | 2.9 (intermediate) |
| 1 mm | 0.5 (reflective) | 1.3 (reflective) | 1.7 (intermediate) |

So coarse coral and black sands stay steep and barless in all but big swell; fine quartz
under ocean swell goes flat with bars. This matches the observed world (steep tropical
reef beaches, flat multi-bar Namibia and Oregon).

### Slope and grain

Beach-face slope rises with grain size and falls with wave energy (Bascom 1951; Woodruff
et al. 2021). Approximate face slopes for moderate waves (≈, Bascom-type curves; check
the original before encoding exact values):

| Grain | Face slope |
|---|---|
| 0.2 mm | 1:50–1:30 (0.02–0.035) |
| 0.35 mm | 1:15 (0.065) |
| 0.5 mm | 1:10 (0.1) |
| 1 mm | 1:7 (0.14) |
| shingle | 1:8–1:4 (0.12–0.25) |
| cobble | 1:5–1:3 (0.2–0.33) |

## 3. Tidal ranges (phase 5)

Classes: micro < 2 m, meso 2–4 m, macro 4–6 m, mega > 6 m (mean spring range; some
authors put mega at 8 m).

| Region | Range | Class | Basis |
|---|---|---|---|
| `mediterranean-sea` | ~0.4 m mean, a few cm in places; Gulf of Gabès ~2 m | micro | Aviso |
| `caribbean` | 0.1–0.2 m (Belize 0.15 m) | micro | Kjerfve 1981, 45 gauges |
| `bahamas-bermuda` | ≈ 0.8 m | micro | |
| `baltic` | ≈ 0–0.2 m | micro | |
| `hawaii` | ~0.6 m (daily range ~2 ft) | micro | US Harbors (Honolulu) |
| `california` | ≈ 1.2–2 m (San Diego 1.4 m on a sample day) | micro | US Harbors |
| `norway` | ≈ 0.3 m (Skagerrak) to 1.5 m (Bergen) to 3 m (Lofoten, Tromsø) | micro–meso | |
| `wadden-north-sea` | 1.5–4 m, central part often > 3 m; storm surges to 5 m | meso | Wadden Sea World Heritage; Danish national park |
| `britain-ireland` | ≈ 2–5 m; Bristol Channel 9.6 m mean, ~15 m max | meso–mega | Wikipedia (tidal range) |
| `brittany-normandy` | Saint-Malo highs ~11 m, lows ~2.5 m; Chausey 8.2 m mean, > 14 m springs | mega | Britannica, NASA Earth Observatory |
| `atlantic-canada` | Fundy (Burntcoat Head) 11.7 m mean, ~16 m max; elsewhere ≈ 1–2 m (PEI ≈ 1 m) | micro–mega | Wikipedia, Guinness |
| `arctic-canada` | Ungava Bay 9.75 m; elsewhere ≈ 1–2 m | micro–mega | Wikipedia |
| `alaska` | Cook Inlet (Turnagain Arm) ~9 m mean, ~11.6 m spring; SE Alaska ≈ 4–5 m | meso–mega | historical newspaper figure |
| `british-columbia` | ≈ 3–5 m | meso | |
| `east-asia-subtropical` (Korea, Yellow Sea) | Incheon ~9.5 m spring, ~6.5 m neap | mega | 1908 figures (KoreaScience) |
| `nw-australia` | Broome ~10 m at times; Derby (King Sound) max 11.8 m; king tides Mar–Apr and Sep–Oct | mega | Wikipedia, Kimberley Ports |
| `patagonia-fjords`, `tierra-del-fuego` | ≈ 6–13 m (Río Gallegos); not verified | macro–mega | |
| `iceland` | ≈ 2–4 m | meso | |
| `svalbard`, `greenland` | ≈ 1–4 m | micro–meso | |
| `east-africa` | ≈ 3–4 m (Mombasa, Zanzibar) | meso | |
| `south-asia-islands` | ≈ 1 m (Maldives) | micro | |
| `arabia` | Red Sea ≈ 0.5 m; Gulf ≈ 1–3 m; not verified | micro–meso | |
| `baja-sonora` | upper Gulf of California ≈ 7–9 m | mega | |
| everything else | ≈ 1–2 m | micro | |

Spring–neap: Incheon spring/neap ≈ 1.46, a typical ratio; ×1.2 at springs and ×0.8 at neaps
(plan) is close.

## 4. Bioluminescence seasons (phase 13)

Glowing surf needs a dense dinoflagellate bloom (*Lingulodinium polyedra* in California,
*Noctiluca scintillans* in Asia and Australia); it shows an hour or two after dark, best
on moonless nights, and is episodic (days to weeks).

| Region | Months | Notes | Basis |
|---|---|---|---|
| `california` | early spring to late summer, irregular; some Nov sightings | red tides last days to months | USC Sea Grant, Scripps, NBC San Diego |
| `florida-carolinas` | May–Oct, peak Jul–Aug | mostly in lagoons (Indian River) | Islands.com |
| `caribbean` (Puerto Rico bays) | year-round | in bays and mangrove lagoons, not surf; rain dims it | Puerto Rico tourism, Wikipedia |
| `caribbean` (Jamaica Luminous Lagoon) | Dec–Apr best | lagoon | Islands.com |
| `caribbean` (Holbox, Yucatán) | Jun–Sep | beach | Riviera Maya News |
| `south-asia-islands` (Maldives) | Jun–Oct (sources differ: Apr–Nov) | beach surf | travel guides |
| `south-asia-islands` (Lakshadweep, Andaman) | Oct–Mar, peak Nov–Feb | beach | Outlook Traveller |
| `east-asia-subtropical` (Hong Kong, Matsu) | late Mar–early Jul, peak Apr–Jun | *Noctiluca*, "blue tears" | The Standard, National Taiwan Ocean University |
| `tasmania` | austral summer (Dec–Feb) | *Noctiluca* | The Nightly, Tasmanian government |
| `east-australia` (Jervis Bay) | sightings late April | | Australian Geographic |

Not plankton: Toyama Bay's glowing firefly squid (Mar–Jun) wash up on beaches; a separate
feature if wanted, not "bioluminescent surf".

Lagoon-only places (Puerto Rico bays, Indian River, Luminous Lagoon) glow in calm water
stirred by boats or fish, not in breaking waves: they need a calm-water scene (PLAN_BIOMES
phase 6 lagoon), not the surf effect.

## Open questions

Decided 2026-10-23 (PLAN_BIOMES decisions 9 and 10): new parent regions are used even
though they change some warm days' animals, and each region sets its own latitude (basin
ranges in `oceans.ts` are the fallback).

1. ≈ values (tides for Patagonia, Red Sea, Norway, Iceland; some grain sizes; slopes)
   need one lookup each in national tables or papers before tests depend on them.

## Sources

Regions: [List of countries by length of coastline (CIA, WRI)](https://en.wikipedia.org/wiki/List_of_countries_and_dependencies_by_length_of_coastline),
[Coastline Length 2023 (Geofactbook)](https://geofactbook.com/fact/coastline/2023).

Grain and fall velocity: [Soulsby (1997) in CMS-Flow sediment fall velocity](https://cirpwiki.info/wiki/CMS-Flow:Sediment_Fall_Velocity),
[Simple and general formula for settling velocity (ASCE 2007)](https://ascelibrary.com/doi/10.1061/%28ASCE%290733-9429%282007%29133%3A2%28229%29),
[Oahu calcareous sands (J. Coastal Research)](https://journals.flvc.org/jcr/article/download/81251/78391/93593),
[Beach sands flashcards (CCSF)](https://fog.ccsf.edu/~kwiese/content/Classes/BeachSandsFlashcards.pdf),
[Hawaii beach sands report (GPO)](https://www.govinfo.gov/content/pkg/CZIC-qe500-h35-no-41/html/CZIC-qe500-h35-no-41.htm),
[Chesil Beach](https://en.wikipedia.org/wiki/Chesil_Beach),
[Scottish Geology Trust: shingle](https://geoguide.scottishgeologytrust.org/page/2354),
[Sand size vs. beachface slope (Geomorphology 2010)](https://home.uevora.pt/~ahr/9.pdf),
[Woodruff et al. 2021](https://websites.umass.edu/woodruff/files/2021/09/45_Woodruff_etal_2021_MarineGeology.pdf),
[Bascom 1951 (EarthRef)](https://earthref.org/ERR/190121),
[Beach states, Ω classes (Springer 2025)](https://link.springer.com/article/10.1007/s00367-025-00802-y).

Tides: [Tidal range (Wikipedia)](https://en.wikipedia.org/wiki/Tidal_range),
[Guinness: greatest tidal range](https://www.guinnessworldrecords.com/world-records/73813-highest-tide-average),
[NASA: Chausey Islands](https://earthobservatory.nasa.gov/images/151414/ebb-and-flow-in-the-chausey-islands),
[Britannica: double tide (Saint-Malo)](https://www.britannica.com:443/science/double-tide),
[Tides around the world (Aviso)](https://www.aviso.altimetry.fr/en/applications/ocean/tides/tides-around-the-world.html),
[Mediterranean tides (Aviso)](https://mobile.aviso.altimetry.fr/en/news/image-of-the-month/1999/oct-1999-mediterranean-tides-are-more-than-meets-the-eye.html),
[Caribbean tides (Kjerfve, Smithsonian)](https://repository.si.edu/server/api/core/bitstreams/ceb1ad08-3a96-40ee-97f0-078bb83e0923/content),
[Wadden Sea: taking shape](https://waddensea-worldheritage.org/taking-shape),
[Danish Wadden Sea tides](https://eng.nationalparkvadehavet.dk/help-the-wadden-sea/tidal-water),
[King Sound](https://en.wikipedia.org/wiki/King_Sound),
[Kimberley Ports: weather and tides](https://kimberleyports.wa.gov.au/?p=2470),
[Incheon tidal range (KoreaScience)](https://koreascience.or.kr/article/JAKO198011920645802.page),
[Cook Inlet (historical newspaper)](https://newspapers.lib.utah.edu/details?id=3690949),
[Honolulu tides (US Harbors)](https://www.usharbors.com/harbor/hawaii/honolulu-hi/tides/),
[San Diego tides (US Harbors)](https://www.usharbors.com/harbor/california/san-diego-ca/tides/).

Bioluminescence: [USC Sea Grant: San Diego red tide](https://dornsife.usc.edu/uscseagrant/?p=6911),
[NBC San Diego: when to see bioluminescence](https://www.nbcsandiego.com/news/local/when-and-where-to-catch-bioluminescence-in-san-diego/3297836/),
[Puerto Mosquito](https://en.wikipedia.org/wiki/Puerto_Mosquito),
[Puerto Rico's bioluminescent bays](https://welcome.topuertorico.org/biobays.shtml),
[Islands.com: best bioluminescent beaches](https://www.islands.com/1997347/best-beaches-watch-bioluminescent-waves-florida/),
[Holbox bioluminescence](https://www.rivieramayanews.mx/best-time-to-see-bioluminescence-in-holbox-summer-nights-and-new-moon/),
[Maldives glowing beaches guide](https://gowanderly.com/maldives-beaches-glow/),
[India's bioluminescent beaches (Outlook Traveller)](https://www.outlooktraveller.com/amp/story/destinations/india/bioluminescent-beaches-of-india),
[Hong Kong blue tears (The Standard)](https://www.thestandard.com.hk/news/article/330963/Video-Stunning-blue-tears-spotted-in-Kai-Tak-waterfront-spark-concerns-over-water-pollution),
[Matsu blue tears (NTOU)](https://mprp.ntou.edu.tw/p/16-1017-87861.php?Lang=en),
[Tasmania's glowing coastline](https://thenightly.com.au/australia/tasmanias-glowing-coastline-how-to-spot-bioluminescent-magic-before-it-disappears-c-17298080),
[Tasmanian bloom (NRE)](https://www.tasmaniancountry.com/newspaper/tasmanian-country/recent-algal-bloom-naturally-occurring-and-not-harmful-nre-confirms),
[Jervis Bay (Australian Geographic)](https://australiangeographic.com.au/tag/bioluminescence),
[Bioluminescent waves (UCSD)](https://today.ucsd.edu/story/new-study-uses-simulations-to-reveal-bioluminescent-light-intensity-in-breaking-waves),
[Toyama firefly squid](https://www.amusingplanet.com/2012/03/firefly-squids-in-toyama-bay-japan.html).
