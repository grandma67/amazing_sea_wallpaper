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

Beach days only. Warm beaches get a region first: tropical Pacific → South-East Asia (60%)
or Central America; tropical Indian → South-East Asia (65%) or East Africa; tropical
Atlantic → Caribbean (65%) or West Africa; warm volcanic Pacific → Galápagos or Hawaii; the
Mediterranean Sea; the Arabian coast (desert, Indian Ocean).

| Animal | Where | When | Weather | Chance |
|---|---|---|---|---|
| Sea turtles nesting, crawl tracks and nest mounds | Caribbean: leatherback Mar–Jun, green/hawksbill Jul–Oct; Central America: olive ridley Jul–Dec, green otherwise; SE Asia: green/hawksbill Apr–Sep, olive ridley Nov–Mar; West Africa: leatherback/olive ridley Oct–Mar; East Africa, Galápagos, Arabia: green all year; Mediterranean: loggerhead Jun–Aug | Nesting females at night and blue hour; fresh tracks in the morning, softened by evening | – | 35% in season |
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
| Ghost crabs, burrows and sand fans | Tropical 85%, desert 70%, Mediterranean 30% (not Southern Ocean or Arctic) | Most at night (6–18), some at dusk, few by day | **Storm:** in their burrows (burrows still show) | as listed |
| Hermit crabs | Tropical wrack lines | Any | **Storm:** hidden | 60% where no ghost crabs |
| Shore crabs | Cooler coasts, at the water's edge | Any | **Storm:** hidden | 45% where no ghost crabs |
| Starfish | Nordic, Mediterranean, Pacific volcanic beaches | Any | – | 30% |

## How often, over three years

Share of days on which the generator chooses each animal, of all days and of each biome's
and ocean's days. Regenerate with `node scripts/animals.mjs`.

1095 days (2024-01-01 … 2026-12-30).

| Animal | All days | nordic | mediterranean | volcanic | desert | tropical | atlantic | pacific | indian | arctic | southern |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Crabs: ghost | 23% | – | 20% | – | 39% | 45% | 18% | 25% | 38% | – | – |
| Crabs: hermit | 2% | – | – | – | – | 7% | 2% | 2% | 3% | – | – |
| Crabs: shore | 12% | 14% | 19% | 25% | – | – | 18% | 12% | 5% | – | – |
| Crocodile: american | 0.6% | – | – | – | – | 2% | 0.8% | 1% | – | – | – |
| Crocodile: nile | 0.1% | – | – | – | – | 0.3% | – | – | 0.5% | – | – |
| Crocodile: saltwater | 1% | – | – | – | – | 4% | – | 2% | 3% | – | – |
| Crocodile: west-african | 0.2% | – | – | – | – | 0.6% | 0.5% | – | – | – | – |
| Gulls: flying | 58% | 58% | 55% | 64% | 52% | 59% | 54% | 62% | 57% | 55% | 62% |
| Gulls: resting | 3% | 3% | 4% | 6% | – | 3% | 4% | 3% | 3% | 2% | – |
| Hippos: hippo | 0.5% | – | – | – | – | 2% | 1% | – | 0.5% | – | – |
| Lizards: green-iguana | 0.9% | – | – | – | – | 3% | 0.8% | 2% | – | – | – |
| Lizards: marine-iguana | 0.9% | – | – | 7% | – | – | – | 3% | – | – | – |
| Lizards: monitor | 1% | – | – | – | – | 4% | – | 1% | 3% | – | – |
| Lizards: spiny-tailed | 1% | – | – | – | 11% | – | – | – | 6% | – | – |
| Marine: dolphin | 14% | 6% | 15% | 10% | 19% | 19% | 16% | 16% | 15% | – | – |
| Marine: humpback | 10% | 10% | 9% | 7% | 9% | 12% | 10% | 11% | 7% | 13% | 5% |
| Marine: orca | 3% | 8% | 2% | 4% | – | – | 2% | 1% | – | 14% | 16% |
| Marine: swordfish | 5% | 4% | 5% | 5% | 8% | 6% | 6% | 4% | 8% | – | – |
| Migratory birds: duck | 7% | 11% | 13% | 11% | – | – | 10% | 7% | 5% | 11% | 5% |
| Migratory birds: flamingo | 9% | – | 11% | – | 15% | 17% | 10% | 11% | 12% | – | – |
| Migratory birds: goose | 6% | 11% | 9% | 9% | – | – | 8% | 5% | 0.5% | 14% | 11% |
| Monkeys: capuchin | 0.3% | – | – | – | – | 1.0% | – | 0.8% | – | – | – |
| Monkeys: macaque | 2% | – | – | – | – | 6% | – | 3% | 3% | – | – |
| Monkeys: vervet | 0.7% | – | – | – | – | 3% | – | – | 4% | – | – |
| Sea turtle: green | 5% | – | 0.3% | 5% | 9% | 11% | 1% | 5% | 14% | – | – |
| Sea turtle: hawksbill | 0.3% | – | – | – | – | 1.0% | – | 0.8% | – | – | – |
| Sea turtle: leatherback | 0.5% | – | – | – | – | 2% | 1% | – | – | – | – |
| Sea turtle: loggerhead | 0.6% | – | 2% | – | – | – | 2% | – | – | – | – |
| Sea turtle: olive-ridley | 3% | – | – | – | – | 10% | 0.3% | 5% | 5% | – | – |
| Seabird colony: gannet (island) | 5% | 4% | 12% | 9% | – | – | 7% | 5% | 4% | 8% | – |
| Seabird colony: gannet (mainland) | 1% | 2% | 2% | 1% | – | – | 0.8% | 2% | 0.9% | 2% | – |
| Seabird colony: penguin (island) | 0.1% | – | – | 0.7% | – | – | – | – | – | – | 3% |
| Seabird colony: penguin (mainland) | 0.1% | – | – | 0.7% | – | – | – | – | – | – | 3% |
| Seabird colony: puffin (island) | 1% | 3% | – | 5% | – | – | 2% | 1% | 0.5% | 5% | – |
| Seabird colony: puffin (mainland) | 0.4% | 1.0% | – | 1% | – | – | 0.8% | 0.3% | – | – | – |
| Seabird colony: tropical (island) | 6% | – | – | – | 10% | 16% | 3% | 8% | 9% | – | – |
| Seabird colony: tropical (mainland) | 0.5% | – | – | – | 2% | 1.0% | – | 0.3% | 2% | – | – |
| Seals: elephant-seal (beach) | 0.4% | 1.0% | – | 1% | – | – | – | – | – | – | 11% |
| Seals: fur-seal (beach) | 0.1% | – | – | 0.7% | – | – | – | – | – | – | 3% |
| Seals: fur-seal (rock) | 1% | 1.0% | – | 1% | 7% | – | 2% | – | – | – | 11% |
| Seals: sea-lion (beach) | 0.8% | – | 2% | 0.7% | – | 0.6% | – | 2% | 1% | – | – |
| Seals: sea-lion (rock) | 3% | 1% | 4% | 4% | 0.9% | 3% | – | 7% | 3% | – | – |
| Seals: seal (beach) | 1% | 4% | 0.6% | 2% | – | – | 2% | 0.5% | – | 8% | – |
| Seals: seal (rock) | 3% | 12% | 1.0% | 5% | – | – | 4% | 3% | – | 11% | – |
| Starfish: starfish | 12% | 18% | 22% | 13% | – | – | 15% | 13% | 4% | 16% | 8% |

Days per biome: nordic 209, mediterranean 313, volcanic 149, desert 114, tropical 310; per ocean: atlantic 399, pacific 381, indian 214, arctic 64, southern 37.
