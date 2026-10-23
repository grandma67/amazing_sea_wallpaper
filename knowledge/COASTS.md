# Coasts

Which coasts the wallpaper draws and how often, and a proposal for stony beaches (pebble,
shingle, cobble) like Canada's. Status 2026-10-23. Shares are over 2024–2026 (1096 days,
`node scripts/params.mjs --stats … 2024-01-01..2026-12-31`). Code paths are in INITIAL_PLAN.md
"How it works".

## How a coast is chosen (today)

1. **Biome** (`BIOMES` in `biome.ts`, main stream): sets water, sand colours, rocks,
   plants.
2. **Ocean** (`pickOcean`, `oceans.ts`, own stream): weighted by biome; sets swell, wind,
   latitude, polar water and ice.
3. **Coast type** (`generateCoast`, `params.ts`): `beach` 65% / `open-sea` 35%, once per
   date.
4. **Shape** (same function): slope, beach width, dunes, hills, sandbar (60%), sand colour
   (`biome.sands`), composition (beach days only).

### Biomes

| Biome | Share | Places it stands for | Sand (within biome) | Rocks | Sea stacks |
|---|---|---|---|---|---|
| `mediterranean` | 28.6% | Mediterranean, California, Chile, SW Australia | grey 37%, white 32%, golden 31% | 75% | 30% |
| `tropical` | 28.3% | Pacific/Indian/Caribbean islands | white 68%, golden 32% | 45% | 15% |
| `nordic` | 19.2% | Norway, Scotland, Svalbard, Greenland, Alaska, Tierra del Fuego | grey 55%, golden 45% | 85% | 20% |
| `volcanic` | 13.6% | Hawaii, Japan, Iceland, Canaries, Réunion | black 60%, grey 40% | 95% | 45% |
| `desert` | 10.4% | Arabia, Namibia, Sahara coast, Atacama | golden 61%, white 39% | 40% | 20% |

### Ocean by biome

| Biome | Pacific | Atlantic | Indian | Arctic | Southern |
|---|---|---|---|---|---|
| tropical | 47% | 19% | 34% | – | – |
| mediterranean | 29% | 58% | 13% | – | – |
| nordic | 21% | 39% | – | 30% | 10% |
| volcanic | 47% | 31% | 11% | – | 11% |
| desert | 28% | 27% | 45% | – | – |

### Coast type and composition

| Coast | Share of days |
|---|---|
| `beach` | 65.2% |
| `open-sea` | 34.8% |

| Composition (beach days) | Share |
|---|---|
| `along-beach` | 31.2% |
| `shoreline` | 30.1% |
| `overlook` | 21.7% |
| `framed` | 17.1% |

Other things in view, all days: islands 32% (rocky 13%, high 6%, cay 5%, skerries 4.5%,
karst 3%); landform 31% (range 19%, stratovolcano 9%, shield 4%).

**Every beach is sand today.** The only "stone" is boulders and sea stacks (`props/rocks.ts`);
there is no pebble, shingle or cobble beach surface.

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
  slopes of ~1:4–1:8 versus 1:10–1:30 for sand. One or more storm ridges (berms) at high
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

## Proposal: beach material

Canada fits the existing `nordic` biome (Atlantic, Pacific and Arctic oceans, conifers,
birch, grey water). What's missing is not a biome but a **beach material** axis, which also
fits the Mediterranean and volcanic coasts.

| Material | What it is |
|---|---|
| `sand` | today's beach |
| `mixed` | sand beach with a gravel/cobble band at the top and on the storm ridge |
| `shingle` | pebbles 1–6 cm, whole beach |
| `cobble` | cobbles and small boulders 6–30 cm, often with sand or gravel at the waterline |

### Proposed chances (beach days)

| Biome | sand | mixed | shingle | cobble | Stone colours |
|---|---|---|---|---|---|
| nordic | 35% | 25% | 20% | 20% | grey granite, greywacke, some red sandstone |
| — nordic on Arctic | 25% | 25% | 20% | 30% | grey, frost-shattered, more angular |
| mediterranean | 55% | 15% | 25% | 5% | white–cream limestone, grey |
| volcanic | 50% | 15% | 15% | 20% | black basalt (black sand stays) |
| desert | 75% | 15% | 5% | 5% | tan/red gravel (Atacama, Red Sea) |
| tropical | 85% | 10% | – | 5% | coral rubble (pale), dark basalt |

Overall: ~23% of beach days stony (shingle or cobble, ~15% of all days), ~15% mixed,
~62% sand. Today it's 100% sand.

Coast shape should follow the material: slope `beachSlope` 0.12–0.25 for shingle/cobble
(today 0.035–0.11), narrower beach, one or two storm ridges, no sandbar and no dunes (grass
or rock behind), surging/plunging surf close in.

### How to build it (cheap)

- **Choice:** `beachMaterialFor(biome, ocean, rng)` in its own stream
  (`Random.derive(seed, 'beach-material')`), spec field `beachMaterial`, test table. Doesn't
  change any existing day (sand days stay byte-identical).
- **Near (≤ ~15 m):** instanced low-poly pebbles/cobbles (a few variants, like `rocks.ts`
  at 200–800 tris), placed in view only, for real shadows and parallax.
- **Mid (15–80 m):** terrain shader: Voronoi cells for stones, per-cell albedo and normal
  bulge, contact shadows in the gaps; fades with pixel footprint like the wind ripples do.
- **Far:** colour and the storm-ridge relief only.
- **Wet:** stones wet below run-up are dark and glossy; swash sinks in (shorter wet band).
- **Knock-on:** crabs and shells skip shingle (crabs on cobbles are fine in nordic), driftwood
  piles on the storm ridge, no dune grass on the beach itself.

## Proposal: more coasts and biomes

| Addition | Places | Suggested share | Notes |
|---|---|---|---|
| Coast type `rock-shore` (wave-cut platform, tidepools, no beach) | Peggy's Cove, Maine, Brittany, Cornwall, Big Sur | 10% of days (from `beach`, 65% → 55%) | rocks.ts boulders + flat ledge terrain; spray on ledges |
| Coast type `tidal-flat` (wide mud/sand flat at low tide) | Bay of Fundy, Wadden Sea, Morecambe Bay | 3% (nordic/mediterranean Atlantic only) | needs the tide state; low-cost terrain variant |
| Biome `temperate` (mixed forest, grey–golden sand, much shingle) | Atlantic Canada, New England, Britain, Brittany, Pacific NW, NZ South Island, Tasmania | weight 2 (~15%) | splits off the mild half of `nordic`; adding a biome reshuffles the main-stream biome pick for every date |

Recommended order: beach material first (biggest realism gain, Canada and the Mediterranean
both benefit, no existing day changes), then `rock-shore`; the `temperate` biome only if
nordic still reads too Arctic, since it changes every day's biome.
