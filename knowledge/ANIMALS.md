# Animals

Every animal the wallpaper can show: where (biome, ocean, region), when (month, time of
day) and in what weather, and how often. Animals are at real size, so small ones show only
near the camera (a 10 cm crab is a speck at 20 m; turtles and monkeys within ~40 m).

"Storm" below means a thunderstorm or squall, or a storm sky (`stormy()` in
`src/props/context.ts`). Probabilities are per day, from the generator's own choices over
three years (see the table at the end, `node scripts/animals.mjs`); placement can still
miss the frame, so a chosen animal isn't always seen.

## Rules

### In the air and at sea

| Animal | Where | When | Weather | Chance | Code |
|---|---|---|---|---|---|
| Gulls (white, or dark silhouettes against a low sun) | Every coast | Any time | **Storm:** none fly; they rest in rafts on the water or huddle on the sand, facing into the wind | 60% of days | `props/birds.ts` |
| Dolphins (pods, porpoising or rolling) | Warm and temperate seas: not Arctic | Day and night | None in storms | 35% of days have a marine animal, then by ocean: Pacific 5 : humpback 3 : swordfish 2 : orca 1 (Atlantic similar, Indian no orca, Southern orca 3 : humpback 3 : dolphin 1, Arctic orca 2 : humpback 3) | `props/marine.ts` |
| Humpback whales (blow, back, flukes, breach) | Every ocean (they migrate) | " | None in storms | " | " |
| Orcas | Cool coasts only (never tropical or desert) | " | None in storms | " | " |
| Swordfish (leaping) | Warm and temperate open water | " | None in storms | " | " |
| Geese (skeins in a V or line, high) | Cool coasts (nordic, volcanic, Mediterranean) | Spring (Mar–May) and autumn (Sep–Nov) migration; ¼ as often otherwise; not at night | None in storms | Weighted against "none" 6: goose 2, duck 2 (cool), flamingo 1.5 (warm, not polar) | `props/migratory.ts` |
| Sea ducks (eiders, scoters: lines low over the waves) | Cool coasts | As geese | None in storms | " | " |
| Flamingos (wading in the shallows, or flying in pink lines) | Warm coasts (tropical, desert, Mediterranean), not polar seas | Any month; not at night | None in storms | " | " |
| Seabird colony: gannets (white rock, guano) | Temperate coasts: nordic, Mediterranean, volcanic | Any | **Storm:** the birds sit on their ledges, none circling | 15% of days have a colony; on a beach some are mainland cliffs | `props/colony.ts`, `pickColony` in `params.ts` |
| Seabird colony: puffins and guillemots | Northern coasts (Arctic, nordic, volcanic): half of them | Any | As gannets | " | " |
| Seabird colony: boobies and frigatebirds | Tropical and desert coasts | Any | As gannets | " | " |
| Seabird colony: penguins | Southern Ocean | Any | As gannets | " | " |

### Seals and sea lions

`pickPinnipeds` in `params.ts`, `props/pinnipeds.ts`. 20% of days on coasts that have them
(6% on tropical coasts, where sea lions live only in the Galápagos), hauled out on a skerry,
the seabird island, or the beach (most often elephant seals).

Kinds by biome and ocean (relative weights, `PINNIPEDS`):

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

Beach days only. The animals come from the day's **place** (`src/places.ts`, PLAN_BIOMES
1a): each region has a pool (nesting turtles with their months and weights, and a chance
per day for monkeys, lizards, crocodiles, hippos, basking turtles), and a place may
replace its region's pool. Places without a pool have none of these animals. The old
warm-coast regions keep their animals (`se-asia` = Philippines, Indonesia, mainland SE
Asia; `caribbean` = Antilles, Yucatán–Belize; `mediterranean-sea` = Aegean, Adriatic,
western Med, North Africa–Levant; `arabia` = Red Sea, Oman–Yemen, Persian Gulf; the
Galápagos and Hawaii are places). New pools:

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
| Ghost crabs, burrows and sand fans | Tropical 85%, desert 70%, Mediterranean 30% (not Southern Ocean or Arctic; not on shingle or cobble) | Most at night (6–18), some at dusk, few by day | **Storm:** in their burrows (burrows still show) | as listed |
| Hermit crabs | Tropical wrack lines | Any | **Storm:** hidden | 60% where no ghost crabs |
| Shore crabs | Cooler coasts, at the water's edge (and among cobbles) | Any | **Storm:** hidden | 45% where no ghost crabs |
| Starfish | Nordic, Mediterranean, Pacific volcanic beaches | Any | – | 30% |

### Planned (PLAN_BIOMES.md phase 14, later)

| Animal | Where | Notes |
|---|---|---|
| Sea otters | California, Alaska, British Columbia | rafts floating on their backs in kelp beds |
| Walrus | Svalbard, Greenland, Arctic Canada, north Alaska | haul-outs of 5–40 on beaches and floes |
| Polar bear | Arctic places, near ice | rare (~2% of eligible days) |
| Waders (oystercatchers, knots, sanderlings) | tidal flats and low-tide beaches; sanderlings on most sandy swashes | flocks on the swash, ≥ 0.25 m above the swash line |

## How often, over three years

Share of days on which the generator chooses each animal, of all days and of each biome's
and ocean's days. Regenerate with `node scripts/animals.mjs`.

1095 days (2024-01-01 … 2026-12-30).

| Animal | All days | nordic | mediterranean | volcanic | desert | tropical | atlantic | pacific | indian | arctic | southern |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Crabs: ghost | 17% | – | 12% | – | 44% | 50% | 14% | 20% | 39% | – | – |
| Crabs: hermit | 1% | – | – | – | – | 5% | – | 2% | 3% | – | – |
| Crabs: shore | 14% | 17% | 20% | 27% | – | – | 23% | 17% | 5% | – | – |
| Crocodile: american | 0.6% | – | – | – | – | 3% | 0.6% | 1% | – | – | – |
| Crocodile: saltwater | 0.5% | – | – | – | – | 2% | – | 1% | – | – | – |
| Crocodile: west-african | 0.3% | – | – | – | – | 1% | 0.8% | – | – | – | – |
| Gulls: flying | 57% | 57% | 60% | 53% | 66% | 56% | 58% | 56% | 60% | 60% | 46% |
| Gulls: resting | 3% | 3% | 5% | 5% | 2% | 2% | 3% | 4% | 3% | 3% | 6% |
| Hippos: hippo | 0.2% | – | – | – | – | 0.8% | 0.6% | – | – | – | – |
| Lizards: green-iguana | 0.5% | – | – | – | – | 2% | 0.6% | 1% | – | – | – |
| Lizards: marine-iguana | 0.5% | – | – | 4% | – | – | – | 2% | – | – | – |
| Lizards: monitor | 0.6% | – | – | – | – | 3% | – | 0.8% | 3% | – | – |
| Lizards: spiny-tailed | 0.2% | – | – | – | 2% | – | – | – | 1% | – | – |
| Marine: dolphin | 13% | 11% | 11% | 11% | 15% | 17% | 15% | 15% | 16% | – | 8% |
| Marine: humpback | 11% | 13% | 10% | 10% | 12% | 8% | 11% | 8% | 7% | 19% | 19% |
| Marine: orca | 3% | 6% | 3% | 4% | – | – | 1% | 2% | – | 10% | 21% |
| Marine: swordfish | 5% | 2% | 8% | 2% | 7% | 8% | 4% | 6% | 8% | – | – |
| Migratory birds: duck | 7% | 12% | 7% | 8% | – | – | 9% | 6% | 0.6% | 10% | 8% |
| Migratory birds: flamingo | 7% | – | 11% | – | 15% | 16% | 7% | 7% | 15% | – | – |
| Migratory birds: goose | 8% | 11% | 11% | 16% | – | – | 10% | 8% | 2% | 10% | 8% |
| Monkeys: capuchin | 0.5% | – | – | – | – | 2% | – | 2% | – | – | – |
| Monkeys: macaque | 0.9% | – | – | – | – | 4% | – | 2% | 0.6% | – | – |
| Monkeys: vervet | 0.2% | – | – | – | – | 0.8% | – | – | 1% | – | – |
| Sea turtle: green | 3% | – | – | 5% | 10% | 7% | – | 4% | 14% | – | – |
| Sea turtle: hawksbill | 0.4% | – | – | – | – | 2% | – | 0.5% | 1% | – | – |
| Sea turtle: loggerhead | 0.3% | – | 2% | – | – | – | 0.8% | – | – | – | – |
| Sea turtle: olive-ridley | 1% | – | – | – | – | 5% | 0.6% | 2% | 1% | – | – |
| Seabird colony: gannet (island) | 4% | 4% | 11% | 2% | – | – | 6% | 3% | 1% | 4% | – |
| Seabird colony: gannet (mainland) | 0.8% | 2% | 1% | – | – | – | 0.3% | 0.8% | – | 3% | – |
| Seabird colony: penguin (island) | 0.2% | 0.2% | – | 0.7% | – | – | – | – | – | – | 4% |
| Seabird colony: penguin (mainland) | 0.2% | 0.2% | – | 0.7% | – | – | – | – | – | – | 4% |
| Seabird colony: puffin (island) | 3% | 6% | – | 3% | – | – | 3% | 3% | 0.6% | 6% | – |
| Seabird colony: puffin (mainland) | 0.8% | 2% | – | 1% | – | – | 0.8% | 0.8% | 0.6% | 1% | – |
| Seabird colony: tropical (island) | 5% | – | – | – | 27% | 15% | 3% | 7% | 16% | – | – |
| Seabird colony: tropical (mainland) | 0.5% | – | – | – | 2% | 1% | 0.8% | 0.5% | – | – | – |
| Seals: elephant-seal (beach) | 0.6% | 0.7% | 0.6% | 2% | – | – | – | 0.3% | – | – | 13% |
| Seals: elephant-seal (rock) | 0.3% | 0.5% | – | 0.7% | – | – | – | – | – | – | 6% |
| Seals: fur-seal (beach) | 0.2% | 0.2% | – | – | 1% | – | 0.3% | – | – | – | 2% |
| Seals: fur-seal (rock) | 0.6% | – | – | 0.7% | 7% | – | 1% | 0.3% | – | – | 2% |
| Seals: sea-lion (beach) | 0.8% | 0.5% | 1% | 1% | 2% | 0.4% | – | 2% | – | – | – |
| Seals: sea-lion (rock) | 2% | 0.9% | 7% | 4% | 4% | 0.8% | – | 6% | 1% | – | – |
| Seals: seal (beach) | 2% | 4% | 0.6% | 2% | – | – | 2% | 2% | – | 4% | – |
| Seals: seal (rock) | 6% | 12% | 0.6% | 6% | – | – | 6% | 4% | – | 15% | – |
| Starfish: starfish | 10% | 15% | 16% | 10% | – | – | 10% | 14% | 0.6% | 11% | 6% |

Days per biome: nordic 442, mediterranean 167, volcanic 146, desert 82, tropical 258; per ocean: atlantic 355, pacific 371, indian 154, arctic 167, southern 48.
