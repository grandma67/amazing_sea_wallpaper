# Animals

Every animal the wallpaper can show: where (biome, ocean, region), when (month, time of
day) and in what weather, and how often. Seasons (0.98, `src/animalSeasons.ts`, research in
SEASONS.md §3) are in the "Seasons" section below and override the rows. Animals are at real size, so small ones show only
near the camera (a 10 cm crab is a speck at 20 m; turtles and monkeys within ~40 m).

"Storm" below means a thunderstorm or squall, or a storm sky (`stormy()` in
`src/props/context.ts`). Probabilities are per day, from the generator's own choices over
three years (see the table at the end, `node scripts/animals.mjs`); placement can still
miss the frame, so a chosen animal isn't always seen.

Rocky shores (PLAN_BIOMES 8, about a quarter of all days) have no sand: no turtles, ghost,
hermit or shore crabs, shells, sand flowers or beach animals (monkeys, crocodiles, hippos,
monitors, green and spiny-tailed iguanas). Marine iguanas stay (on the platform near the
water); seals haul out on the rock by the water instead of a beach; seabird colonies and
everything at sea or in the air are as on beaches. So beach animals appear on fewer days
than before 0.62.

## Rules

### In the air and at sea

| Animal | Where | When | Weather | Chance | Code |
|---|---|---|---|---|---|
| Gulls (white, or dark silhouettes against a low sun) | Every coast | Any time | **Storm:** none fly; they rest in rafts on the water or huddle on the sand, facing into the wind | 60% of days | `props/birds.ts` |
| Dolphins (pods, porpoising or rolling) | Warm and temperate seas: not Arctic | Day and night | None in storms | 35% of days have a marine animal, then by ocean: Pacific 5 : humpback 3 : swordfish 2 : orca 1 (Atlantic similar, Indian no orca, Southern orca 3 : humpback 3 : dolphin 1, Arctic orca 2 : humpback 3) | `props/marine.ts` |
| Humpback whales (blow, back, flukes, breach) | Every ocean (they migrate) | " | None in storms | " | " |
| Orcas | Cool coasts only (never tropical or desert) | " | None in storms | " | " |
| Swordfish (leaping) | Warm and temperate open water | " | None in storms | " | " |
| Geese (skeins in a V or line, high) | Every climate but tropical and arid (they winter as far south as Florida and south China) | By climate and month (Seasons below); not at night | None in storms | Weighted against "none" 6: goose 2, duck 2 (cool), flamingo 1.5 (warm, not polar); by the day's climate (phase 11e) | `props/migratory.ts` |
| Sea ducks (eiders, scoters: lines low over the waves) | As geese | As geese | None in storms | " | " |
| Flamingos (wading in the shallows, or flying in pink lines) | Tropical, arid, mediterranean and subtropical climates, not polar seas | Any month; not at night | None in storms | " | " |
| Seabird colony: gannets (white rock, guano) | Every climate but tropical and arid, and puffin coasts half the time (Australasian and Cape gannets in the south) | Any | **Storm:** the birds sit on their ledges, none circling | 15% of days have a colony; on a beach some are mainland cliffs | `props/colony.ts`, `pickColony` in `params.ts` |
| Seabird colony: puffins and guillemots | Northern hemisphere, Arctic water or a polar, boreal or temperate climate: half of them | Any | As gannets | " | " |
| Seabird colony: boobies and frigatebirds | Tropical and arid climates (the Galápagos and Hawaii too) | Any | As gannets | " | " |
| Seabird colony: penguins | Southern Ocean | Any | As gannets | " | " |

### Seals and sea lions

`pickPinnipeds` in `params.ts`, `props/pinnipeds.ts`. 20% of days on coasts that have them
(6% on tropical coasts, where sea lions live only in the Galápagos), hauled out on a skerry,
the seabird island, or the beach (most often elephant seals).

Kinds by biome and ocean (relative weights, `PINNIPEDS`), except where the climate says
otherwise (`pinnipedTable`, phase 11e): tropical coasts only the Galápagos' sea lions and
Hawaii's monk seals (as harbour seals); subtropical coasts fur seals in the south (NSW,
Uruguay, northern New Zealand; not Natal) and none in the north (Florida, south Japan, Taiwan,
the Canaries); temperate mediterranean-biome coasts spotted seals in the Yellow Sea, none on
Atlantic Portugal.

| Biome | Atlantic | Pacific | Indian | Arctic | Southern |
|---|---|---|---|---|---|
| Nordic | harbour seal | harbour seal 2, sea lion 1 (Alaska, BC) | – | harbour seal | fur seal 1, elephant seal 1 (Tierra del Fuego) |
| Mediterranean | – | sea lion 3, harbour seal 1, elephant seal 1 (California) | sea lion (SW Australia) | – | – |
| Desert | fur seal (Namibia) | sea lion 2, fur seal 1 (Atacama, Peru) | – | – | – |
| Volcanic | harbour seal | sea lion 2, harbour seal 1 | – | – | elephant seal 2, fur seal 2 |
| Tropical | – | sea lion (Galápagos) | – | – | – |

Beach rather than rock haul-out: harbour seals 35%, sea lions 50%, fur seals 40%, elephant
seals 85%.

**Storm:** none hauled out; the herd is in the water, 8–16 heads up to 100 m off.

### On the beach (`props/wildlife.ts`, `props/shoreLife.ts`)

Beach days only. The animals come from the day's **place** (`src/places.ts`): each region
has a pool (nesting turtles with their months and weights, and a chance per day for monkeys,
lizards, crocodiles, hippos, basking turtles), and a place may replace its region's pool.
Places without a pool have none of these animals. Regions in the second table: `se-asia` =
Philippines, Indonesia, mainland SE Asia; `caribbean` = Antilles, Yucatán–Belize;
`mediterranean-sea` = Aegean, Adriatic, western Med, North Africa–Levant; `arabia` = Red Sea,
Oman–Yemen, Persian Gulf; the Galápagos and Hawaii are places. Other pools:

| Place or region | Animals |
|---|---|
| `pacific-islands` | green/hawksbill Nov–Mar; monitors 8%, saltwater crocodiles 4%; no monkeys |
| `north-australia` | green/hawksbill Oct–Mar; saltwater crocodiles 15% |
| `nw-australia` | green Nov–Mar; saltwater crocodiles 8% |
| `india` | olive ridley Nov–Mar (Odisha); monitors 10%, saltwater crocodiles 4% |
| `south-asia-islands` | green/hawksbill all year; Sri Lanka adds macaques 10%, monitors 15%, crocodiles 5%; Andaman monitors 10%, crocodiles 8% |
| `northeast-brazil` | loggerhead, hawksbill, olive ridley Sep–Mar |
| `florida-carolinas` | loggerhead (and some green) May–Aug |
| `bahamas-bermuda` | green/hawksbill Jun–Oct only (no iguanas or crocodiles) |
| `horn-of-africa`, `comoros` | green all year |
| `western-australia-desert` | green/loggerhead Nov–Mar |

| Animal | Where | When | Weather | Chance |
|---|---|---|---|---|
| Sea turtles nesting, crawl tracks and nest mounds | Caribbean: leatherback Mar–Jun, green/hawksbill Jul–Oct; Central America: olive ridley Jul–Dec, green otherwise; SE Asia: green/hawksbill Apr–Sep, olive ridley Nov–Mar; West Africa: leatherback/olive ridley Oct–Mar; East Africa, Galápagos, Arabia: green all year; Mediterranean: loggerhead Jun–Aug | Nesting females at night and blue hour; fresh tracks in the morning, softened by evening | – | 35% in season; never on shingle or cobble (they dig in sand) |
| Hatchlings running to the sea | As nesting, ~2 months later | Night, blue hour, sunrise | – | 30% of those |
| Basking green turtles | Hawaii | Day | **Storm:** none | 45% |
| Long-tailed macaques | South-East Asia | Day | **Storm:** hidden | 30% |
| White-faced capuchins | Central America | Day | **Storm:** hidden | 20% |
| Vervet monkeys | East Africa | Day | **Storm:** hidden | 25% |
| Marine iguanas (black heaps facing the sun) | Galápagos | Day | **Storm:** hidden | 85% |
| Green iguanas | Central America, Caribbean | Day | **Storm:** hidden | 25%, 20% |
| Water monitors | South-East Asia | Day | **Storm:** hidden | 20% |
| Spiny-tailed lizards | Arabia | Day | **Storm:** hidden | 25% |
| Saltwater crocodiles | South-East Asia | Bask by day just above the swash, some agape | **Storm:** in the water, eyes and back awash | 12% (by day) |
| American crocodiles | Central America, Caribbean | As above | As above | 12%, 8% |
| Nile crocodiles | East Africa | As above | As above | 10% |
| West African crocodiles | West Africa | As above | As above | 12% |
| Hippos (a pod of 2–7) | West Africa (Loango, Bijagós); rarely East Africa | On the beach from dusk to dawn (sunset, evening golden hour, blue hour, night); in the water by day, backs and heads awash | **Storm:** in the water | 15%, 4% |
| Ghost crabs, burrows and sand fans | By climate: tropical 85% (60% on lava-coast sand), arid 70%, subtropical 75%, mediterranean 30%, temperate mediterranean-biome 10% (not Southern Ocean or Arctic; not on shingle or cobble) | Most at night (6–18), some at dusk, few by day | **Storm:** in their burrows (burrows still show) | as listed |
| Hermit crabs | Tropical-climate wrack lines | Any | **Storm:** hidden | 60% where no ghost crabs |
| Shore crabs | Every climate but tropical and arid, at the water's edge (and among cobbles) | Any | **Storm:** hidden | 45% where no ghost crabs |
| Starfish | Nordic, Mediterranean, Pacific volcanic beaches | Any | – | 30% |

### Seasons (`src/animalSeasons.ts`)

Months are the day's own season (south of the equator six months on).

| Animal | In season | Out of season |
|---|---|---|
| Puffin colony birds | Apr–mid Aug (day 85–227) | the island or cliffs stay, no birds in the air |
| Gannet colony birds | late Feb–Oct (day 50–304), southern gannetries in the austral summer | as puffins |
| Tropical and penguin colonies | all year | – |
| Humpbacks | polar, boreal, temperate: May–Nov; tropical, subtropical, arid: Dec–Apr; Mediterranean-climate coasts: passage Mar–May, Sep–Dec (half as often otherwise); Oman all year | weight × 0.1 |
| Harbour seals hauled out | Jun–Aug | Dec–Feb half as often, spring and autumn × 0.8 (stream `'pinnipeds/season'`) |
| Southern elephant seals | local Sep–Apr | local May–Aug × 0.1 (at sea) |
| Ghost crabs out (not tropical or arid) | May–Oct | Dec–Feb none out, burrows × 0.3; Nov, Mar, Apr half |
| Shore crabs | Mar–Nov | Dec–Feb none (deeper water) |
| Spiny-tailed lizards | Mar–Oct | Nov–Feb brumating |
| Geese, sea ducks | polar: May–Sep (passage May, Sep; breeding × 0.6); boreal: passage Apr–May, Sep–Oct, summer × 0.3, ducks × 0.5 otherwise; temperate: passage Mar–May, Sep–Nov, winter × 0.6, summer × 0.15; Mediterranean and subtropical: winter Nov–Feb × 0.6, Mar, Apr, Oct × 0.8 | none (weight 0) |
| Gulls | – | polar climate Nov–Mar × ⅓ |

Planned animals (sea otters, walrus, polar bears, waders, herons, tidepool life, blacktip
sharks): PLAN_BIOMES.md phase 14.

**On a frozen sea** (`seaIce.ts`, SEA_ICE.md), nothing is in the water: no whales or dolphins, swimming seals or animals afloat. Seals stay hauled out on rock and beach.

## How often, over three years

Share of days on which the generator chooses each animal, of all days and of each biome's
and ocean's days. Regenerate with `node scripts/animals.mjs`.

1095 days (2024-01-01 … 2026-12-30).

| Animal | All days | nordic | mediterranean | volcanic | desert | tropical | atlantic | pacific | indian | arctic | southern |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Crabs: ghost | 14% | – | 10% | 7% | 24% | 41% | 13% | 16% | 31% | – | – |
| Crabs: hermit | 1% | – | – | 2% | – | 4% | 0.6% | 2% | 3% | – | – |
| Crabs: shore | 4% | 6% | 7% | 6% | – | – | 8% | 5% | 0.6% | – | – |
| Crocodile: american | 0.6% | – | – | – | – | 3% | 0.6% | 1% | – | – | – |
| Crocodile: saltwater | 0.5% | – | – | – | – | 2% | – | 1% | – | – | – |
| Crocodile: west-african | 0.2% | – | – | – | – | 0.8% | 0.6% | – | – | – | – |
| Gulls: flying | 54% | 49% | 60% | 51% | 66% | 56% | 56% | 56% | 60% | 43% | 38% |
| Gulls: resting | 3% | 3% | 5% | 5% | 2% | 2% | 3% | 4% | 3% | 3% | 6% |
| Hippos: hippo | 0.2% | – | – | – | – | 0.8% | 0.6% | – | – | – | – |
| Lizards: green-iguana | 0.5% | – | – | – | – | 2% | 0.6% | 1% | – | – | – |
| Lizards: marine-iguana | 0.5% | – | – | 4% | – | – | – | 2% | – | – | – |
| Lizards: monitor | 0.5% | – | – | – | – | 2% | – | 0.8% | 1% | – | – |
| Marine: dolphin | 14% | 11% | 14% | 13% | 20% | 19% | 19% | 16% | 18% | – | 13% |
| Marine: humpback | 5% | 5% | 6% | 7% | 2% | 5% | 5% | 5% | 5% | 8% | 10% |
| Marine: orca | 3% | 5% | 3% | 4% | – | – | 1% | 1% | – | 7% | 23% |
| Marine: swordfish | 6% | 3% | 9% | 3% | 12% | 8% | 6% | 8% | 10% | – | – |
| Migratory birds: duck | 6% | 10% | 5% | 8% | – | – | 8% | 6% | – | 4% | 10% |
| Migratory birds: flamingo | 8% | – | 11% | 10% | 15% | 16% | 9% | 8% | 16% | – | – |
| Migratory birds: goose | 4% | 7% | 6% | 5% | – | – | 5% | 5% | – | 4% | 6% |
| Monkeys: capuchin | 0.4% | – | – | – | – | 2% | – | 1% | – | – | – |
| Monkeys: macaque | 0.8% | – | – | – | – | 3% | – | 2% | 0.6% | – | – |
| Monkeys: vervet | 0.2% | – | – | – | – | 0.8% | – | – | 1% | – | – |
| Sea turtle: green | 2% | – | – | 2% | 4% | 5% | – | 2% | 9% | – | – |
| Sea turtle: hawksbill | 0.4% | – | – | – | – | 2% | – | 0.5% | 1% | – | – |
| Sea turtle: loggerhead | 0.1% | – | 0.6% | – | – | – | 0.3% | – | – | – | – |
| Sea turtle: olive-ridley | 1% | – | – | – | – | 4% | 0.3% | 2% | 1% | – | – |
| Seabird colony: gannet (island) | 4% | 5% | 11% | 2% | – | – | 6% | 4% | 0.6% | 4% | – |
| Seabird colony: gannet (mainland) | 0.8% | 2% | 1% | – | – | – | 0.3% | 0.8% | – | 3% | – |
| Seabird colony: penguin (island) | 0.2% | 0.2% | – | 0.7% | – | – | – | – | – | – | 4% |
| Seabird colony: penguin (mainland) | 0.2% | 0.2% | – | 0.7% | – | – | – | – | – | – | 4% |
| Seabird colony: puffin (island) | 2% | 6% | – | 0.7% | – | – | 3% | 2% | – | 6% | – |
| Seabird colony: puffin (mainland) | 0.6% | 2% | – | – | – | – | 0.8% | 0.5% | – | 1% | – |
| Seabird colony: tropical (island) | 6% | – | – | 3% | 27% | 15% | 3% | 8% | 17% | – | – |
| Seabird colony: tropical (mainland) | 0.5% | – | – | 0.7% | 2% | 1% | 0.8% | 0.5% | 0.6% | – | – |
| Seals: elephant-seal (rock) | 0.5% | 0.7% | – | 2% | – | – | – | – | – | – | 13% |
| Seals: fur-seal (rock) | 1% | 0.2% | 2% | 0.7% | 9% | – | 2% | 0.8% | – | – | 4% |
| Seals: sea-lion (beach) | 0.1% | 0.2% | – | – | – | – | – | 0.3% | – | – | – |
| Seals: sea-lion (rock) | 2% | 1% | 3% | 3% | 6% | – | – | 5% | 0.6% | – | – |
| Seals: seal (beach) | 0.5% | 0.9% | 0.6% | – | – | – | 0.6% | 0.3% | – | 1% | – |
| Seals: seal (rock) | 5% | 11% | 0.6% | 3% | – | – | 4% | 4% | – | 13% | – |
| Starfish: starfish | 6% | 8% | 11% | 6% | – | – | 5% | 8% | 0.6% | 7% | 2% |

Days per biome: nordic 442, mediterranean 167, volcanic 146, desert 82, tropical 258; per ocean: atlantic 355, pacific 371, indian 154, arctic 167, southern 48.
