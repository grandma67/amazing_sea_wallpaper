# Places and regions

Research for PLAN_BIOMES.md: the places a day is drawn from (phase 1), sand
grain sizes and fall velocities (phase 4), tidal ranges (phase 5) and bioluminescence
seasons (phase 13, later). Status 2026-10-23: research only, nothing built.

Values marked **≈** are from general knowledge or a single non-authoritative page; check
them against national tide tables or papers before relying on them in a test.

## 1. Places

**One draw: the place.** Each day draws one place (PLAN_BIOMES 1a). Everything else
about where the camera stands follows from it:

| Kind | Fields | How |
|---|---|---|
| Constant | biome (today's look preset), latitude range, region, tide range, notes | the same every day there |
| Choose one | ocean, climate; later sand colour, beach material, coast kind (rock shore, tidal flat) | weighted, one per day, each on its own stream |
| Choose many | animals, plants, debris, flowers | a pool of what can appear; each feature's own rules pick from it |

**Region** = a group of places that share defaults (plants, animals, most of the fields)
and a name for specs (`place: "atlantic-canada"` = any of its places). It is never drawn
on its own. A place with no region row ("–") is its own region.

**Weights: √ of coastline length per region, split among its places by length**
(decision 2026-10-23). Raw length would make ~70% of days Arctic and nordic (Canada
alone ~55% of the CIA total); √ keeps the real ranking but compresses it. Taking √ per
region rather than per place keeps shares from depending on how finely a region is split.
Lengths are ≈ CIA World Factbook figures (WRI where CIA is clearly too coarse), split by
judgment; coastline length depends on the ruler, so treat them as a ranking. Shares are
of all days (open-sea days included: the open-sea draw stays separate, 35%).

Result vs. today: nordic 42% (today 19%), tropical 23% (29%), mediterranean 14% (29%),
volcanic 13% (14%), desert 9% (10%). Polar places ≈ 16% of days.

**Climate values:** `polar`, `boreal`, `temperate`, `mediterranean`, `subtropical`,
`tropical`, `arid`. Phase 11 uses them for the look of nordic and mediterranean places;
on the other biomes climate drives seasons and weather rules only.

**Ocean** values are the code's basins; for the mediterranean biome "atlantic" means the
Mediterranean Sea itself (as today).

**Latitude:** "S" = southern hemisphere (the sign is the hemisphere; seasons follow it).
A range across the equator reads "11 S–6".

**Wildlife today.** `wildlife.ts` `regionFor` picks se-asia, central-america,
east-africa, caribbean, west-africa, galapagos, hawaii, mediterranean and arabia. With
places, animals come from each place's pool instead; "new" in the notes marks places that
had no animal region or the wrong one (no macaques on Tahiti).

### Nordic (≈ 42% of days)

| Place | Region | Covers | Ocean | Climate | Latitude | Coast km ≈ | Share % | Notes |
|---|---|---|---|---|---|---|---|---|
| `norway-west` | `norway` | Stavanger to Trøndelag | atlantic | temperate | 58–64° | 40,000 | 2.5 | tide ≈ 0.3–1.5 m |
| `norway-north` | `norway` | Nordland, Lofoten, Troms, Finnmark | atlantic 70, arctic 30 | boreal 80, polar 20 | 64–71° | 43,000 | 2.7 | tide ≈ 2–3 m |
| `scotland` | `britain-ireland` | Scotland, Hebrides, Orkney, Shetland | atlantic | temperate | 55–59° | 6,000 | 1.0 | haar |
| `ireland` | `britain-ireland` | Ireland | atlantic | temperate | 51–55° | 1,700 | 0.3 |  |
| `cornwall-wales` | `britain-ireland` | Cornwall, Wales | atlantic | temperate | 50–53° | 2,500 | 0.4 |  |
| `bristol-channel` | `britain-ireland` | Bristol Channel | atlantic | temperate | 51° | 500 | 0.1 | tide 9.6 m mean (to ~15 m) |
| `morecambe-bay` | `britain-ireland` | Morecambe Bay | atlantic | temperate | 54° | 300 | 0.1 | macro tide, tidal flats |
| `newfoundland` | `atlantic-canada` | Newfoundland, Labrador south | atlantic | boreal 70, temperate 30 | 46–52° | 9,600 | 1.1 |  |
| `nova-scotia` | `atlantic-canada` | Nova Scotia Atlantic shore, Gulf of St Lawrence | atlantic | temperate 70, boreal 30 | 43–47° | 7,400 | 0.8 |  |
| `fundy` | `atlantic-canada` | Bay of Fundy | atlantic | temperate | 44–46° | 1,500 | 0.2 | tide 11.7 m mean (to ~16 m); red mud and sand ~40%; tidal flats |
| `pei` | `atlantic-canada` | Prince Edward Island, Northumberland Strait | atlantic | temperate | 46–47° | 1,100 | 0.1 | red sand ~60%; tide ≈ 1 m |
| `maine` | `atlantic-canada` | Maine | atlantic | temperate | 43–45° | 5,600 | 0.6 | tide ≈ 3 m |
| `baltic` | – | Sweden, Finland, Estonia, Danish islands | atlantic | boreal 70, temperate 30 | 54–66° | 10,000 | 1.8 | tide ≈ 0 |
| `wadden-north-sea` | – | Netherlands, Germany, Denmark North Sea | atlantic | temperate | 52–57° | 3,000 | 1.0 | tidal flats |
| `brittany` | `brittany-normandy` | Brittany, Normandy coast | atlantic | temperate | 47–49° | 2,700 | 0.9 | tide ≈ 5–8 m |
| `mont-saint-michel` | `brittany-normandy` | Saint-Malo, Mont-Saint-Michel, Chausey | atlantic | temperate | 48–49° | 300 | 0.1 | tide 8–14 m; tidal flats |
| `iceland-faroe` | – | Iceland's non-volcanic beaches, Faroes | atlantic | boreal 60, temperate 40 | 62–66° | 3,600 | 1.1 |  |
| `arctic-canada` | – | Canadian Arctic Archipelago, Hudson Bay, Ungava | arctic | polar | 58–78° | 150,000 | 7.0 | Ungava tide 9.75 m |
| `greenland` | – | Greenland west and east coasts | arctic 70, atlantic 30 | polar | 60–78° | 44,000 | 3.8 |  |
| `arctic-russia` | – | Kola, White Sea, Siberian coast | arctic | polar | 66–78° | 25,000 | 2.9 |  |
| `svalbard` | – | Svalbard | arctic | polar | 76–80° | 3,600 | 1.1 |  |
| `alaska-north` | `alaska` | Alaska's Arctic coast (Beaufort, Chukchi) | arctic | polar | 69–71° | 1,700 | 0.3 | new: walrus, polar bear |
| `se-alaska` | `alaska` | SE Alaska Inside Passage | pacific | temperate 60, boreal 40 | 54–59° | 3,000 | 0.5 | tide ≈ 4–5 m |
| `gulf-alaska` | `alaska` | Gulf of Alaska, Kodiak | pacific | boreal | 56–61° | 5,000 | 0.9 |  |
| `cook-inlet` | `alaska` | Cook Inlet, Turnagain Arm | pacific | boreal | 59–61° | 700 | 0.1 | tide ~9 m mean (to ~11.6 m) |
| `british-columbia` | – | BC outer coast and fjords, Haida Gwaii | pacific | temperate | 48–55° | 26,000 | 2.9 |  |
| `pacific-northwest` | – | Washington, Oregon | pacific | temperate | 42–48° | 1,500 | 0.7 |  |
| `russian-far-east` | – | Okhotsk Sea, Sakhalin | pacific | boreal | 48–60° | 8,000 | 1.6 |  |
| `new-zealand-south` | – | NZ South Island | pacific | temperate | 41–47 S° | 6,000 | 1.4 |  |
| `patagonia-fjords` | – | Chilean fjords, Patagonia | southern 70, pacific 30 | temperate | 42–55 S° | 5,000 | 1.3 |  |
| `tierra-del-fuego` | – | Tierra del Fuego, Beagle Channel | southern | temperate 70, polar 30 | 53–56 S° | 1,500 | 0.7 | southern beech |
| `tasmania` | – | Tasmania's south and west coasts | southern | temperate | 41–44 S° | 1,500 | 0.7 |  |
| `south-georgia` | `south-georgia-falklands` | South Georgia | southern | polar | 54–55 S° | 1,000 | 0.4 | tussock grass only |
| `falklands` | `south-georgia-falklands` | Falklands | southern 60, atlantic 40 | temperate | 51–52 S° | 1,300 | 0.5 |  |

### Mediterranean (≈ 14% of days)

| Place | Region | Covers | Ocean | Climate | Latitude | Coast km ≈ | Share % | Notes |
|---|---|---|---|---|---|---|---|---|
| `aegean` | `mediterranean-sea` | Greece, Aegean Turkey, Cyprus | atlantic | mediterranean | 35–41° | 19,000 | 1.6 |  |
| `adriatic` | `mediterranean-sea` | Croatia, Adriatic Italy, Albania, Montenegro | atlantic | mediterranean 70, subtropical 30 | 40–46° | 9,000 | 0.8 | bora |
| `western-med` | `mediterranean-sea` | Mediterranean Spain and France, Tyrrhenian Italy, Corsica, Sardinia, Sicily | atlantic | mediterranean | 36–44° | 10,000 | 0.9 | mistral |
| `north-africa-levant` | `mediterranean-sea` | Tunisia, Libya, Egypt, Levant, Algeria | atlantic | mediterranean | 31–37° | 6,000 | 0.5 |  |
| `portugal-morocco` | – | Portugal, Atlantic Spain, Atlantic Morocco | atlantic | mediterranean 80, temperate 20 | 30–43° | 5,000 | 1.3 |  |
| `florida-carolinas` | – | Florida, Georgia, Carolinas (barrier islands) | atlantic | subtropical | 25–35° | 3,000 | 1.0 |  |
| `south-brazil` | – | South Brazil, Uruguay | atlantic | subtropical | 25–35 S° | 2,000 | 0.8 |  |
| `california` | – | California | pacific | mediterranean | 32–42° | 1,400 | 0.7 | marine layer |
| `central-chile` | – | Central Chile | pacific | mediterranean | 30–38 S° | 1,400 | 0.7 |  |
| `east-australia` | – | Southern Queensland, NSW | pacific | subtropical | 25–35 S° | 2,500 | 0.9 |  |
| `south-japan` | `east-asia-subtropical` | Kyushu, Shikoku, south Honshu, Okinawa | pacific | subtropical | 26–35° | 10,000 | 1.3 |  |
| `taiwan-south-china` | `east-asia-subtropical` | Taiwan, Hong Kong, Matsu, South China coast | pacific | subtropical | 22–26° | 6,000 | 0.8 | blue tears Apr–Jun |
| `yellow-sea` | `east-asia-subtropical` | Korea's west coast, Incheon | pacific | temperate 60, subtropical 40 | 34–38° | 5,000 | 0.6 | tide ~9.5 m spring; tidal flats |
| `sw-australia` | – | Perth, Margaret River, Esperance | indian | mediterranean | 30–35 S° | 2,500 | 0.9 |  |
| `cape` | – | Western and Southern Cape | indian 60, atlantic 40 | mediterranean | 33–35 S° | 1,000 | 0.6 |  |
| `natal` | – | KwaZulu-Natal, south Mozambique | indian | subtropical | 25–31 S° | 1,500 | 0.7 |  |

### Tropical (≈ 23% of days)

| Place | Region | Covers | Ocean | Climate | Latitude | Coast km ≈ | Share % | Notes |
|---|---|---|---|---|---|---|---|---|
| `philippines` | `se-asia` | Philippines | pacific | tropical | 5–19° | 36,000 | 2.1 |  |
| `indonesia` | `se-asia` | Indonesia | pacific 50, indian 50 | tropical | 11 S–6° | 54,700 | 3.1 |  |
| `mainland-se-asia` | `se-asia` | Vietnam, Thailand, Malaysia | pacific 60, indian 40 | tropical | 1–21° | 9,000 | 0.5 |  |
| `pacific-islands` | – | PNG, Solomons, Vanuatu, Fiji, Samoa, Tahiti, Micronesia | pacific | tropical | 23 S–10° | 23,000 | 2.8 | new: no monkeys; reef-fronted |
| `central-america` | – | Pacific Mexico (tropical), Costa Rica, Panama, Colombia | pacific | tropical | 2–20° | 8,000 | 1.6 |  |
| `india` | – | India's west and east coasts | indian | tropical | 8–22° | 7,000 | 1.5 | new: was missing |
| `maldives` | `south-asia-islands` | Maldives | indian | tropical | 1 S–7° | 650 | 0.2 | bioluminescence Jun–Oct |
| `sri-lanka` | `south-asia-islands` | Sri Lanka | indian | tropical | 6–10° | 1,300 | 0.4 |  |
| `andaman-lakshadweep` | `south-asia-islands` | Andaman, Nicobar, Lakshadweep | indian | tropical | 8–14° | 1,900 | 0.6 | bioluminescence Oct–Mar |
| `east-africa` | – | Kenya, Tanzania, Mozambique, Madagascar | indian | tropical | 1–26 S° | 9,000 | 1.7 |  |
| `north-australia` | – | Top End, Cape York, Great Barrier Reef coast | pacific 50, indian 50 | tropical | 10–23 S° | 10,000 | 1.8 | new: saltwater crocodiles |
| `nw-australia` | – | Kimberley, Broome | indian | tropical | 13–20 S° | 7,000 | 1.5 | new: macro tide |
| `antilles` | `caribbean` | Greater and Lesser Antilles | atlantic | tropical | 12–23° | 10,000 | 1.4 | tide 0.1–0.2 m |
| `yucatan-belize` | `caribbean` | Yucatán, Belize, Holbox | atlantic | tropical | 16–21° | 1,800 | 0.3 | bioluminescence Jun–Sep |
| `bahamas-bermuda` | `caribbean` | Bahamas, Turks and Caicos, Bermuda | atlantic | tropical | 21–32° | 4,000 | 0.6 | pink sand ~25% |
| `west-africa` | – | Senegal to Gabon, Bijagós, Loango | atlantic | tropical | 5 S–15° | 6,500 | 1.5 | harmattan |
| `northeast-brazil` | – | Bahia to Ceará | atlantic | tropical | 3–15 S° | 3,500 | 1.1 | new |

### Volcanic (≈ 14% of days)

| Place | Region | Covers | Ocean | Climate | Latitude | Coast km ≈ | Share % | Notes |
|---|---|---|---|---|---|---|---|---|
| `hawaii` | – | Hawaiian Islands | pacific | tropical | 19–22° | 1,200 | 0.6 |  |
| `galapagos` | – | Galápagos | pacific | tropical | 1 S–1° | 1,300 | 0.7 |  |
| `japan` | – | Honshu, Kyushu volcanic coasts, Izu Islands, Hokkaido | pacific | temperate 70, subtropical 30 | 31–43° | 15,000 | 2.2 |  |
| `kamchatka-kurils-aleutians` | `kamchatka-kurils` | Kamchatka, Kurils, Aleutians | pacific | boreal | 43–60° | 6,000 | 1.4 |  |
| `new-zealand-north` | – | Taranaki, Bay of Plenty, Auckland | pacific | subtropical 50, temperate 50 | 36–40 S° | 4,000 | 1.1 |  |
| `iceland` | – | Reynisfjara, Snæfellsnes | atlantic | boreal | 63–66° | 2,500 | 0.9 |  |
| `canaries` | – | Canary Islands | atlantic | subtropical | 27–29° | 1,600 | 0.7 |  |
| `azores-madeira` | – | Azores, Madeira | atlantic | subtropical | 32–39° | 1,100 | 0.6 |  |
| `lesser-antilles-volcanic` | – | Montserrat, St Lucia, Martinique, Cape Verde | atlantic | tropical | 13–17° | 1,800 | 0.8 |  |
| `reunion-mauritius` | – | Réunion, Mauritius | indian | tropical | 20–21 S° | 400 | 0.4 |  |
| `comoros` | – | Comoros | indian | tropical | 11–13 S° | 340 | 0.3 |  |
| `sumatra-java-south` | – | Indian Ocean coasts of Java and Sumatra | indian | tropical | 6–9 S° | 2,500 | 0.9 |  |
| `south-shetland` | – | Deception Island, South Shetlands | southern | polar | 62–63 S° | 1,000 | 0.6 |  |
| `south-sandwich` | – | South Sandwich Islands | southern | polar | 56–60 S° | 300 | 0.3 |  |
| `kerguelen-heard` | – | Kerguelen, Heard Island | southern | polar | 49–53 S° | 2,900 | 1.0 |  |
| `nz-subantarctic` | – | Auckland, Campbell Islands | southern | temperate 50, polar 50 | 50–53 S° | 500 | 0.4 |  |

### Desert (≈ 9% of days)

| Place | Region | Covers | Ocean | Climate | Latitude | Coast km ≈ | Share % | Notes |
|---|---|---|---|---|---|---|---|---|
| `red-sea` | `arabia` | Red Sea coasts (Egypt, Saudi Arabia, Sudan) | indian | arid | 13–28° | 4,500 | 0.7 | tide ≈ 0.5 m; reefs |
| `oman-yemen` | `arabia` | Oman, Yemen | indian | arid | 12–24° | 4,000 | 0.6 |  |
| `persian-gulf` | `arabia` | UAE, Qatar, Kuwait, Bahrain, Saudi Gulf, south Iran | indian | arid | 24–30° | 4,800 | 0.8 | tide ≈ 1–3 m |
| `horn-of-africa` | – | Somalia, Eritrea, Djibouti | indian | arid | 2 S–18° | 5,500 | 1.4 | new |
| `western-australia-desert` | – | Shark Bay, Ningaloo, Pilbara | indian | arid | 20–27 S° | 4,000 | 1.1 | new |
| `atacama-peru` | – | Atacama, Peru | pacific | arid | 5–27 S° | 3,900 | 1.1 | camanchaca |
| `baja-sonora` | – | Baja California, Gulf of California | pacific | arid | 23–31° | 4,500 | 1.2 |  |
| `sahara-atlantic` | – | Mauritania, Western Sahara, south Morocco | atlantic | arid | 18–29° | 2,400 | 0.9 |  |
| `namibia` | – | Skeleton Coast, Walvis Bay | atlantic | arid | 17–29 S° | 2,000 | 0.8 |  |

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

## 4. Bioluminescence seasons (phase 13, later)

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
stirred by boats or fish, not in breaking waves: they need a calm-water lagoon in view (PLAN_BIOMES
phases 6 and 10), not the surf effect. Skipped for now (PLAN_BIOMES "Later and skipped").

## To check

Each place sets its own latitude; the basin ranges in `oceans.ts` are no longer used for
it.

- Coast km per place (split by judgment) and climate weights: rough; refine when a phase
  depends on a specific share.
- ≈ values (tides for Patagonia, Red Sea, Norway, Iceland; some grain sizes; slopes)
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
