# Living things by season: flowers, blossom, fungi, fireflies, moss, seaweed, animals

What blooms, fruits, glows, greens or arrives on a coast through the year, beyond what
[SEASONS.md](SEASONS.md) already covers (leaf colour and fall, grass, litter, colonies, whales,
seals, crabs, waterfowl, snow, sea ice). Research only; the plan is
[plans/NATURE_PLAN.md](plans/NATURE_PLAN.md).

Conventions (as SEASONS.md):

- Rows keyed by **climate** (`place.climate`) use **northern-equivalent months**: south of the
  equator the same row comes six months later (`seasonMonth`).
- Rows keyed by a **place** use that place's **local calendar months**, like turtle nesting
  (the place knows its hemisphere). Each place row says so ("local").
- *(est.)* = our estimate from the general pattern, not from a source we read. "Summary" = read
  through a search summary, not the full page. Sources are at the end.
- Days counts (`params.mjs --stats`, 1095 days 2024–2026): beach 433, rock-shore 280, open sea
  380, tidal flat 2; by climate tropical 300, polar 205, temperate 191, boreal 120, subtropical
  103, Mediterranean 94, arid 82.

## 0. What the project already has (so this doc doesn't repeat it)

| Thing | Where | Season? |
|---|---|---|
| 12 beach flowers (`FLOWERS`) | `props/shoreLife.ts` | yes, by biome and months |
| Salt marsh green → straw, glasswort red | `props/saltMarsh.ts` `marshLook` | yes |
| Autumn leaves, bare trees, spring green, litter | `phenology.ts`, `props/trees.ts`, `props/leafLitter.ts` | yes |
| Moss, lichen, algae on boulders (`GROWTH`) | `props/rocks.ts` | **no**, by biome only |
| Lichen bands, weed, barnacles on rock shores (`LICHEN`) | `rockShore.ts`, `terrain.ts` | **no** |
| Wrack, kelp, sargassum on the beach | `props/debris.ts` | sargassum only |
| Bioluminescent surf | planned, REGIONS.md §4 | months per place, researched |
| Flowering trees and shrubs, fungi, fireflies, insects | – | not modelled |
| Sea otters, walrus, polar bears, waders, herons, blacktip sharks | planned, PLAN_BIOMES 14 | no season research before this doc |

## 1. Flowers and blossom

Flowering changes the look of a coast only where a lot of one plant blooms at once: a whole
crown, a hillside of shrubs, a heath. Single small flowers are already handled by `FLOWERS`.

### 1.1 Shrubs and heath

| Plant | Stands in for (our kind) | Where (places) | Months | Colour | Evidence |
|---|---|---|---|---|---|
| Common gorse (*Ulex europaeus*) | `bush`, nordic temperate | Atlantic Europe: `cornwall-wales`, `brittany`, `ireland`, `scotland`, `bristol-channel`, `morecambe-bay`, `wadden-north-sea` *(est. for the last)*; invasive in `new-zealand-south`, `new-zealand-north`, `tasmania`, `central-chile` *(est.)* | peak **Apr–May**, Jan–Jun; a few flowers all year in mild winters (two strains flower at different times) | bright yellow | Woodland Trust (Jan–Jun, peak Apr–May), Dorset Nature (peak April), Lincolnshire Life (two strains) |
| Heather, ling (*Calluna vulgaris*) | ground cover on heath and cliff tops | `scotland`, `ireland`, `norway-west`, `cornwall-wales`, `brittany`, `baltic` *(est. for the last)* | **Jul–Sep**; Lüneburg Heath Aug–Sep | purple-pink | Dorset Nature, Cornwall record (Jul–Sep); Naturpark Lüneburger Heide (Aug–Sep) |
| Thrift, sea pink (*Armeria maritima*) | already in `FLOWERS` ([4, 8]) | – | Apr–Sep, most May–Jul; on cliff tops from April | pink | Irish Wildflowers, Dorset Nature (May–Sep); Welsh blog (from April). `FLOWERS` agrees. |
| Rock roses (*Cistus*) | `bush`, Mediterranean | Mediterranean-climate places of the Mediterranean Sea and `portugal-morocco` | **May–Jul** (spring to early summer); each flower lasts a day | white, pink | nursery and garden pages only (May–Jul); no field source |
| Phrygana / garrigue spring flush | ground cover, Mediterranean | Mediterranean Sea places | spring (Mar–May *(est.)*); brown and "sere" by Jul–Aug | mixed: yellow, pink, white | Kythnos and Algarve accounts; no month table found. The summer brown is already `dry` in phenology. |

### 1.2 Flowering trees

| Tree | Our kind | Place (local months) | Months | Colour | Evidence |
|---|---|---|---|---|---|
| Pōhutukawa (*Metrosideros excelsa*) | `broadleaf` (the comment in `biome.ts` already names it) | `new-zealand-north` (local) | **mid-Nov – early Jan**, peak ~10 days either side of 25 Dec; varies ±2 weeks by year | crimson over the whole crown | RNZ, Te Papa, NZ Herald; Kermadec pōhutukawa flowers all year (not one of our places) |
| Golden and coastal wattles (*Acacia pycnantha*, *A. longifolia*) | `bush` (coastal wattle) | `east-australia`, `tasmania`, `sw-australia` *(est. for SW)* (local) | **late Aug–Sep**; range Jul–Nov; earlier now in Victoria | bright yellow | Australian Government floral emblem page (late Aug–Sep); lawn.com.au (Aug start, Sep peak) |
| Flamboyant, royal poinciana (*Delonix regia*) | `broadleaf`, tropical | planted and naturalised on most tropical coasts | Caribbean **May–Sep**; Vietnam May–Jul; India from April, full in May; Hong Kong from May; southern hemisphere *(est.)* Nov–Jan | scarlet crown | a Wikipedia mirror's regional table; NParks; Hong Kong news. No source for northern Australia |
| Tropical almond (*Terminalia catappa*) | `broadleaf`, tropical | – | already in phenology (turns red twice a year) | – | SEASONS.md §2.1 |
| Jacaranda | – | `east-australia` (Brisbane Oct, Sydney mid-Oct to peak mid-Nov), `sw-australia` (Perth Nov–Dec) (local) | Oct–Dec | lilac | Sydney and Australian lifestyle pages; it's **a planted street tree**, so not on a wild coast |
| Cherry (*Prunus*, incl. wild yamazakura) | – | `south-japan`, `japan` (local) | late Mar – early Apr on southern coasts, mid–late Apr in Tohoku | pale pink | travel guides agreeing; mostly **planted** (parks, temples); wild yamazakura in hill forest *(est.: no source read)* |

**Not drawn by rule:** jacaranda and planted cherries belong to towns. A wild coast shows them
only if the scene has a town. Wild yamazakura could tint distant Japanese forest *(est.)*.

### 1.3 Desert bloom

| Where | When | How often | Evidence |
|---|---|---|---|
| Atacama coast (`atacama-peru`, local) | **Sep–Nov**, peaking about two months after rain; 2024 bloomed in July (winter) | 13 events 1981–2015 (satellite), ~15 in 40 years: **about one year in three**, tied to El Niño rain; widespread only in 1997 and 2015 | Wikipedia "Desert bloom", RBGE Chilean endemics, CNN 2024 |

Colours: magenta and purple carpets (*Cistanthe*, "pata de guanaco"), with yellow and white
*(est.: well known, not read)*. Other arid coasts (Namaqualand is on the `cape`'s border, Baja)
weren't researched.

## 2. Fungi

Mushrooms are 3–20 cm, so they show only within ~10–15 m of the camera (a 10 cm cap is ~10 px at
15 m at 1080p with our usual lens *(est.)*). A deciduous or pine tree stands near the camera in
frame on only ~14 days of 1095 (leaf litter count, SEASONS_PLAN §8). So this is mainly a
move-around-mode feature (`plans/LIVE_MODE.md`).

| Climate | Main fruiting | Second | Trigger | Evidence |
|---|---|---|---|---|
| Temperate | **Sep–Nov** (late summer to November) | a smaller spring flush in some years | warm summer, wet autumn, few frosts; the UK season has lengthened | biologyinsights overview; Nature news 2007; 6.1-million-record multi-biome study (one main peak; boreal and temperate often a second, spring peak) |
| Boreal | Aug–Oct *(est.: earlier than temperate)* | spring, as temperate | as temperate; ends with lasting frost and snow | multi-biome study (second peak); dates *(est.)* |
| Polar (tundra) | Jul–Aug *(est.)* | – | short thaw season | no source read |
| Mediterranean | **Oct–Dec**, after the first big autumn rains (end Sep–Nov in Catalonia's Empordà) | – | pine mushrooms need ~two heavy rains within 40 days; a hot dry autumn delays the season; the season is getting shorter | Spanish forestry and tourism pages; Pinar Grande 29-year study (shorter season with warming) |
| Subtropical | rainy season *(est.)*; Xalapa (subtropical Mexico) Jun–Oct | – | rain | INECOL Xalapa study |
| Tropical | **rainy season**: northern Thailand peak Jun–Jul, few in the Nov–May dry season; peaks longer and less defined than temperate | – | rain; in a place with `drySeason`, none in the dry months | Thai study; multi-biome study; Yunnan gradient study |
| Arid | none, except after rare rain *(est.)* | – | – | – |

Which fungi stand where *(est.: field-guide knowledge, not read for this doc)*:

| Ground | Kinds and look |
|---|---|
| Under birch and pine (boreal, nordic temperate) | fly agaric (red cap, white spots, 8–20 cm), brown boletes (thick stem) |
| Under oak and beech (temperate) | brown and tan caps, clusters on stumps (honey fungus) |
| Under Mediterranean pines | saffron milk cap (*Lactarius deliciosus*, orange, funnel-shaped) |
| Grass, dunes, machair | white field mushrooms, fairy rings (a ring of darker grass) |
| Tropical forest edge | small, thin, pale or orange caps; bracket fungi on logs |

Weather: fruit bodies come up days after rain, not on the rain day itself. The project has no
weather history (each date is generated on its own), so the day's season is the proxy, maybe
helped by humid weather (fog, drizzle, overcast).

## 3. Fireflies and glow-worms (TODO 22)

All are beetles (Lampyridae). Flashing males fly about 0.5–3 m above vegetation; glow-worm
females glow steadily from the grass. Habitat: wet meadows, forest edges, river banks,
mangroves, **not open sand or bare rock**. They show from late dusk into the night, fewer under a
bright moon, and none in rain or wind *(est. for rain and wind; moon from glow-worm guides)*.
Light is yellow-green, peaking ~550–580 nm *(est.: known value range, not read)*.

| Region (our places) | Species | Months | Peak | Time | Evidence |
|---|---|---|---|---|---|
| Atlantic Europe, temperate (`cornwall-wales`, `brittany`, `ireland`, `bristol-channel`, … ) | common glow-worm (*Lampyris noctiluca*): females glow steadily in grass, chalk downs, coastal grassland | May–Sep | **Jun–Jul** | after 22:00 on still, warm evenings; less with a full moon | NHM, UK Glow-worm Survey, Hampshire and IoW Wildlife Trust |
| Mediterranean Sea (`western-med`, `adriatic`, `aegean`, `north-africa-levant` *(est. for the last)*) | *Luciola italica* and kin: flying, flashing | **May–Jun** (a few weeks); one Croatian record June, another species May | June | dusk into night | Italian essay, Biologer.hr; thin |
| Eastern North America (`florida-carolinas`, `maine`, `nova-scotia` *(est.)*, `fundy`, `pei` *(est.)*) | big dipper firefly (*Photinus pyralis*) and others | Jun–Aug (Tennessee May–Oct) | **mid-Jun – early Jul** | dusk (flashes start at twilight) | AccuWeather, Maryland and Georgia guides, Tennessee record; synchronous species: ~2½ weeks mid-May – early Jun (Congaree) |
| Japan (`south-japan`, `japan`), Taiwan and south China (`taiwan-south-china`) *(est.)*, Korea (`yellow-sea`) *(est.)* | Genji (*Nipponoluciola cruciata*, by streams), Heike (*Aquatica lateralis*, rice fields) | Genji **May–Jun**, Heike Jun–Jul | mid-June (Yugawara late May – late June) | ~19:30–21:30 (viewing events) | Japan Times, Tokyo guides, Wikipedia |
| South-East Asia mangroves (`indonesia`, `philippines`, `mainland-se-asia`, `sumatra-java-south`; Malaysia's Selangor isn't a place) | *Pteroptyx* (synchronous, on riverside mangrove trees, "Christmas trees" of light) | all year *(est.: no source confirms; one 2008–09 survey of six months found 6% abundance in Nov–Dec vs 2% Jan and Mar)* | – | from ~20:00 on clear, moonless nights; weak on rainy or full-moon nights | Selangor River survey (TSHE), Sabah tour pages |
| India, Sri Lanka, Andaman (`india`, `sri-lanka`, `andaman-lakshadweep`) | various | pre-monsoon and monsoon *(est.)* | – | – | no source read |
| None | polar, most boreal, arid; Pacific Northwest and California have few flashing fireflies *(est.)*; New Zealand has none (its "glowworms" are cave fungus-gnat larvae, not coastal) | – | – | – | – |

**The flash's shape:** *Photinus pyralis* males fly in U-shaped arcs and flash on the upswing, a
J-shaped trace; the flash lasts **½–1 s**, every 5–7 s (Maryland field guide, Wikipedia; one
article says every 4 s); females answer 1–2 s later from the grass. Flight speed wasn't found;
~0.3–0.6 m/s is *(est.)*, so one flash traces ~0.15–0.6 m. Glow-worms and perched synchronous
fireflies don't move: dots.

Related, not fireflies: Toyama Bay's firefly squid wash up Mar–Jun (REGIONS.md §4).

**Eligible days today** (`params.mjs --stats`): land, night or blue hour, in temperate,
Mediterranean, subtropical or tropical climate and May–Aug outside the tropics: **56 of 1095
(5%)**, before the "vegetation in frame" and per-region filters, which will cut it to perhaps a
third.

## 4. Moss and lichen

| Fact | Consequence | Evidence |
|---|---|---|
| Dry moss turns **dark brown to near black** (loses turgor; carotenoids show), and greens again within seconds to minutes of wetting | moss colour follows the day's wetness: dark in a dry Mediterranean summer and on arid coasts, green on rain, drizzle and fog days, and through a temperate or boreal winter | Berkeley 3D moss lab (seconds); Tehachapi News; *Syntrichia ruralis* (dark brown when dry) |
| Some mosses stay green when dry | not all moss darkens: use a partial shift (~half) *(est.)* | 2017 desiccation study |
| Moss is mostly a cool, humid-climate cover | the `GROWTH` table keys moss by **biome** (rock), but moss follows weather: by ARCHITECTURE.md "Biome, climate or place" it should key by climate | project rule |
| Lichens are perennial and change little through the year | no seasonal change *(est.)*; maybe slightly brighter when wet | – |

Where moss grows (what decides the amount, not just the colour):

| Rule | Evidence |
|---|---|
| **Moisture first:** frequent rain or fog keeps moss going; dry climates have little | gardening and general pages only (weak), consistent with the desiccation work above |
| **On trunks it follows the water, not the compass:** in a beech study moss was thicker on the *south* side, because trees on slopes lean downhill (~6°) and stemflow runs down that side. "Moss on the north side" is a myth as a rule; shade helps only by keeping bark wetter | 2010 beech stemflow study (GVSU / MSTA Journal) |
| **Salt spray favours lichens over moss:** on the upper shore lichens rule (black *Verrucaria* band low, then yellow *Xanthoria*, white *Pertusaria*, grey-green *Ramalina*); flowering plants and ferns fail just above the splash zone; exposed Cornish coast has far fewer moss species (mean 54 taxa per tetrad against 79–93 sheltered and inland); on Scilly many trees lack moss because salt-tolerant lichens outcompete it | Te Ara (NZ coastal shoreline), JNCC supralittoral lichen biotope, Holyoak's Cornish bryophytes, Isles of Scilly bryophyte flora |
| Salt tolerance is by species, not a hard line: woodland mosses also grow in open coastal places | Holyoak |
| Rock type changes which mosses, more than whether there is moss *(est.)* | – |

So moss amount = climate wetness × shelter from spray (distance and height above the sea,
exposure) × an upward or water-fed face; colour = today's wetness.

Season of wetness by climate *(est., from SEASONS.md §2.2's grass table)*: Mediterranean dry
Jun–Oct, savanna places in their `drySeason`, arid always; temperate, boreal and polar wet or
frozen most of the year (polar moss is under snow when `snow` is set).

## 5. Seaweed on the shore

| Weed | Look | Season | Evidence |
|---|---|---|---|
| Green sea lettuce (*Ulva*), upper shore | bright green film on rock, mats on freshwater-influenced or unstable rock | **conflicting**: Mediterranean (at an outfall) max early spring, falling from May; north Patagonia spring–summer; Washington summer bloom washing up; UK upper-shore Ulva expected to thrive in winter | MarLIN biotope 104; Mediterranean, Patagonian, San Juan Island studies (summaries) |
| Laver (*Porphyra*), littoral fringe | dark purple-brown slippery film high on the rock | **winter weed**: late autumn to spring; may be absent in summer in southern Britain, all year in the cooler north; South Africa big summer and winter biomass; NZ peak spring | MarLIN; UCT thesis; Otago study (summaries) |
| Giant kelp (*Macrocystis*) canopy | golden-brown mat floating at the surface offshore | California: **maximum in mid-summer**; winter losses grow with wave height; spring recovery slower in warm water | Point Loma 2024 (wave attenuation, max kelp cover mid-summer); Santa Barbara Channel |
| Sargassum | done (SEASONS.md §2.4) | – | – |

So: upper-shore green brightest in spring *(est., the majority of sources)* and the dark
*Porphyra* band in winter on temperate and boreal Atlantic and Pacific rock; floating kelp
thickest in summer and thin after winter storms. Neither is in the project yet: the rock's
"weed" band is one colour all year.

## 6. Animals (seasons for PLAN_BIOMES phase 14 and new ones)

| Animal | Places | Season | Notes | Evidence |
|---|---|---|---|---|
| Polar bear | `arctic-canada`, `svalbard`, `greenland`, `alaska-north`, `arctic-russia` | **ashore in the open-water season**: Hudson Bay from break-up (July; some mid-June) until refreeze (Nov–Dec); on the sea ice the rest of the year; Svalbard has bears on the ice all year and coastal bears ashore in late summer–autumn | follows the project's own sea ice (`seaIce.ts`): on land when the day has no sea ice, on the ice when it has | Polar Bears International, Cornell outreach, Svalbard tour guides; ice-free season ~1 month longer since 1979 |
| Walrus haul-out | `alaska-north`, `arctic-russia` (Chukotka), `svalbard`, `greenland`, `arctic-canada` | coastal haul-outs form **as the ice retreats**: Point Lay from early–mid Aug (earliest 3 Aug); Bering haul-outs (mostly males) through the ice-free season; winter on the pack ice | 5–40 animals on a beach in the ice-free months; on floes when there is ice | USFWS fact sheet, Arctic Today, alaska.org (Round Island Aug–Nov) |
| Sea otter | `california`, `british-columbia`, `se-alaska`, `gulf-alaska`, `kamchatka-kurils-aleutians` | **resident all year** *(est.)*, rafting in kelp | the kelp canopy around them is thickest in mid-summer and thin after winter storms | kelp: §5; otters *(est.)* |
| Waders (knot, dunlin, sanderling, oystercatcher, curlew) | tidal flats and sandy beaches; Wadden Sea, British and Iberian estuaries | **passage Mar–May and Aug–Oct** (Wadden autumn peaks late Jul – mid Sep); **big winter flocks** on temperate estuaries (Morecambe Bay ~200,000 in 1985–86; ~80% of Britain's 1.25 million coastal waders on estuaries); in Jun–Jul most are breeding on the Arctic tundra, scattered, not in flocks | flocks only on passage and in winter; a few pairs on polar tundra in summer | Wadden Sea World Heritage, Sovon, BTO, Wader Study Group |
| Blacktip shark (*Carcharhinus limbatus*) | `florida-carolinas` (Palm Beach) | **mid-Jan – Mar**, densest Feb–Mar (>2,000 per km² at the coldest water); north by late spring | within ~20–50 m of shore: dorsal fins and dark shapes in the surf, near the camera | FAU (Kajiura) studies, Live Science, CS Monitor |
| Blacktip reef shark (*C. melanopterus*) | tropical reef lagoons (`maldives`, `pacific-islands`, …) | all year *(est.)* | the PLAN_BIOMES "blacktip in reef lagoons" | – |
| Monarch butterflies | `california` (Pismo, Pacific Grove: ~200 coastal sites) | **late Oct – Feb**, clustered in eucalyptus and pine groves | orange clusters hanging on branches; only near the camera | Griffiths & Villablanca 2015 (eucalyptus at 75% of sites), Pismo listings |
| Herons, tidepool life | rock shores, reefs | all year *(est.)* | no season needed | – |

## 7. What this means for realism (summary)

Biggest visible gains, roughly in order of (days touched × how much it changes the frame):

1. **Seasonal colour on plants we already draw**: gorse yellow in April–May, heather purple in
   August–September, pōhutukawa crimson at Christmas, wattle yellow in the austral late winter,
   flamboyant red in the tropical early wet season. Whole crowns and hillsides, visible far off.
2. **Moss and upper-shore weed by season and wetness**: on every boulder and rock-shore day,
   subtle.
3. **Fireflies and glow-worms** on warm nights by region: rare (≤ 5% of days), striking.
4. **Animal seasons for phase 14** (polar bears and walrus following the sea ice, wader flocks,
   Florida's blacktips).
5. **Desert bloom** on the Atacama one year in three, and **fungi** (mostly for the move-around
   mode).

## 8. Details for the plan (added 2026-11-07)

| Topic | Finding | Evidence |
|---|---|---|
| Firefly brightness | 10¹⁰–10¹¹ photons per flash (upper bound, field lux meter + quantum-yield bound + re-analysis); the classic 10¹³–10¹⁴ (Coblentz 1912: 1/50–1/400 candle) is too high; "real fireflies look much dimmer than LEDs" | Silver 2026, *Am. J. Phys.* (AIP Scilight, read) |
| → intensity | 10¹¹ × 3.5 × 10⁻¹⁹ J (562 nm) over 0.5 s = 7 × 10⁻⁸ W ≈ 4.8 × 10⁻⁵ lm; into a hemisphere **≈ 7.6 × 10⁻⁶ cd**; apparent magnitude +2.3 at 5 m, +5.3 at 20 m, +6.8 at 40 m (our arithmetic) | – |
| Firefly flight | 2–5 ft/s (0.6–1.5 m/s); males fly slowly up to 3 m high; slow and arc while flashing | old photometry paper (biostor 8523), Creighton flight-path study, Lloyd |
| Flamboyant timing | flowers after the dry season when almost leafless, through leaf emergence; India leafless Mar–May, flowering first week Apr – last week Jun; Yucatán peak as dry turns to wet (~May); Bangladesh Apr–May, S Florida and Egypt May–Jun; dry sites flower copiously, moist ones little; no clear season → individuals vary (Singapore) | World Agroforestry DB, Indian Forester, backyardnature Yucatán, NParks |
| Rock rose range | Canaries and Madeira through the Mediterranean to the Caucasus and N Africa, most species in the west; not native to other Mediterranean-climate regions *(est. for that last part)* | Kew POWO, first-nature, Frontiers in Chemistry review |
| Coastal heath | patchy on cooler aspects; a tight woody cover a few cm high on grazed, exposed cliff tops; Cornwall: western gorse with heather and bell heather locally; no cover percentages found | British Plant Communities (H7/H8), Natural England SSSI, geograph (Gwennap Head) |
| Lichen zone height | the yellow-grey lichen splash zone is ~1 m high on very sheltered shores and extends "tens of metres up cliffs" on very exposed ones | JNCC supralittoral biotope, EUNIS B3.11 |
| Laver | *Porphyra umbilicalis*: dense stands round high water on somewhat exposed rock along most of Norway's coast; northern Portugal to the Faroes; most abundant on the upper shore; *P. linearis* a winter annual | MarLIN, Store norske leksikon, Iceland–Iberia genetic study |
| Fairy rings | darker, taller grass at the edge (nutrients), dead grass behind it; 20–30 cm a year; rings over 10 m; *Marasmius oreades* up to 365 m; can last centuries | RHS, Utah State herbarium, Britannica |
| Glow-worm range | *Lampyris noctiluca* to ~65°N in Finland, glowing even on the shortest summer nights; 453 Norwegian records 1991–2024; Welsh and Scottish valleys | Springer 2020 (Finland), NVSU paper, GBIF, Animal Diversity Web |
| More firefly regions | eastern Australia: Queensland "up to six months a year", Illawarra mid-Nov – early Dec, a few weeks at any one site; forests and mangroves along the NSW, Queensland and NT coast. India: Konkan fireflies just before the monsoon (one May observation); Western Ghats hold ~25% of India's 92 species, coasts ~17%. No seasonal source for Sri Lanka, the Andamans, Brazil's Atlantic forest or Kenya | Illawarra Flame, Coffs Coast news, Down To Earth (2026 checklist), EarthSky photo |
| Eye persistence | visible persistence ~20 ms plus ~20 ms decay, longer in scotopic vision, shorter for brighter stimuli: a moving light leaves a 2–10 cm streak to the eye, so a whole-flash streak is a camera-like (~½ s) look | ghost-imaging-with-the-eye study, UBC thesis, Di Lollo & Bischof |
| Namaqualand and the Cape West Coast | Namaqualand blooms every year Jul–Sep (orange *Ursinia*, white daisies), timed by winter rain; Postberg (West Coast NP, ~33°S) Aug 1 – Sep 30 every year, strong some years | SANParks flower reports, West Coast NP (Wikipedia), Business Day 2025 |
| Atacama bloom | dominated by *Cistanthe longiscapa* (magenta; reddish, orange, yellow, pink forms; Caldera 2021 had big purple and yellow patches); *Nolana* white, bluish, lilac; ~200 species; mid-Sep to mid-Nov; big blooms every 5–10 years | Frontiers in Ecology and Evolution 2022, UC Chile |

## Sources

All read through search summaries unless marked "read".

- Details (§8): https://www.aip.org/scilights/how-much-light-comes-from-a-firefly ,
  https://archive.org/download/biostor-8523/biostor-8523.pdf ,
  https://researchworks.creighton.edu/esploro/outputs/journalArticle/Two-Dimensional-Flight-Paths-of-Mate-Searching-Male/991006029366802656 ;
  https://apps.worldagroforestry.org/treedb/AFTPDFS/Delonix_regia.PDF , https://indianforester.co.in/index.php/indianforester/article/view/84367 ,
  https://www.backyardnature.net/yucatan/101/royal_p.htm ; https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:168230-1 ,
  https://first-nature.com/flowers/cistus-salviifolius.php ;
  https://cambridge.org/core/books/british-plant-communities/calluna-vulgarisulex-gallii-heath/291C3AB55C89E1945B12F2FE02622986 ;
  https://eunis.eea.europa.eu/habitats_codeEUNIS/B3.11/eunis2007 ; https://marlin.ac.uk/species/detail/1463 , https://snl.no/Porphyra ;
  https://rhs.org.uk/advice/profile?pid=158 , https://artsci.usu.edu/herbarium/activities_fun-stuff/fun-facts-about-fungi/fairy-rings ;
  https://www.frontiersin.org/articles/10.3389/fevo.2022.957318/full , https://www.uc.cl/noticias/desierto-florido-las-claves-para-entender-este-particular-fenomeno/ ;
  glow-worm range, https://link.springer.com/10.1007/s00265-020-02927-9 , https://vestnik.nvsu.ru/2311-1402/article/download/462766/pdf ;
  Australia, https://www.theillawarraflame.com.au/the-magic-in-macquarie-pass-and-why-you-shouldnt-miss-it/ , https://newsofthearea.com.au/?p=78744 ;
  India, https://www.downtoearth.org.in/wildlife-biodiversity/counting-the-glow-indias-first-firefly-checklist-reveals-92-species , https://ecp.earthsky.org/community-photos/entry/82629 ;
  persistence, https://www.catalyzex.com/paper/ghost-imaging-with-the-human-eye , https://open.library.ubc.ca/cIRcle/collections/831/items/1.0088140 ;
  Namaqualand and Postberg, https://www.sanparks.org/news/namaqua-national-park-flower-report , https://en.wikipedia.org/wiki/West_Coast_National_Park ,
  https://www.businessday.co.za/bd/life/2025-09-10-when-its-time-to-say-it-with-flowers/

- Fireflies: Japan, https://japantimes.co.jp/culture/2008/06/13/events/events-outside-tokyo/fireflies-set-the-nights-alight ,
  https://www.tokyoweekender.com/things-to-do-in-tokyo/where-to-see-fireflies-in-tokyo-2026/ ,
  https://yugawara-resort.com/events/763 , https://en.wikipedia.org/wiki/Nipponoluciola_cruciata ;
  US synchronous, https://www.mentalfloss.com/geography/wanderlust/where-to-see-fireflies ;
  *Photinus*, https://www.accuweather.com/en/leisure-recreation/firefly-season-is-here-when-to-watch-for-summers-flashing-lights/1898307 ,
  https://www.ajc.com/news/2026/06/june-and-july-are-peak-times-for-lightning-bugs-in-georgia/ ,
  https://www.humanegardener.com/wp-content/uploads/2023/05/Bioluminescent-Fireflies-of-Howard-County-MD-cheat-sheet_July-26-1.pdf ;
  *Luciola italica*, https://edcutz.substack.com/p/the-light-fantastic , https://biologer.hr/en/groups/17/species/6826 ;
  glow-worm, https://www.nhm.ac.uk/discover/the-glimmering-world-of-glow-worms.html , https://glowworms.org.uk/ ,
  https://www.hiwwt.org.uk/node/5428 , https://animaldiversity.org/accounts/Lampyris_noctiluca ;
  Selangor *Pteroptyx*, https://www.tshe.org/ea/pdf/EA-p08.pdf , https://www.mysabah.com/wordpress/wp-json/wp/v2/posts/2343
- Pōhutukawa: https://www.rnz.co.nz/news/top/580962/are-pohutukawa-trees-flowering-early-this-year-a-botanist-explains ,
  https://blog.tepapa.govt.nz/?p=3792 , https://nzherald.co.nz/nz/pohutukawa-trees-flower-right-on-time/6QIOMLS32OBDFTR27MMRWYLL5A
- Gorse: https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/plants/wild-flowers/gorse/ ,
  https://dorsetnature.co.uk/pages-flower/wf-123.html , https://www.lincolnshirelife.co.uk/heritage/gorse/
- Heather and thrift: https://dorsetnature.co.uk/pages-flower/wf-70.html ,
  https://naturpark-lueneburger-heide.de/en/nature-and-culture/heathland/heather-blossoming ,
  https://www.dorsetnature.co.uk/pages-flower/wf-54.html , https://www.irishwildflowers.ie/pages/224a.html
- Cistus: https://www.flora-toskana.com/en/balkon-und-terrasse/157-cistus-monspeliensis-montpellier-zistrose.html ,
  https://gardentags.com/plant-encyclopedia/cistus/9538/
- Phrygana: https://sites.google.com/site/wildflowersonkythnos/introduction , https://www.first-nature.com/algarve/habitats-barrocal.php
- Flamboyant: https://www.wikipedia.org/wiki/Gulmohur (regional table, via a mirror), https://www.nparks.gov.sg/florafaunaweb/flora/2/8/2838 ,
  https://hongkongbuzz.hk/2025/05/flowering-tree-that-mimics-feathers-of-flying-phoenix-begins-its-flamboyant-show
- Jacaranda, cherry, wattle: https://www.broadsheet.com.au/sydney/city-file/article/purpe-rain-where-see-jacarandas-sydney ,
  https://lawn.com.au/best-places-to-see-jacarandas/ , https://www.japanhighlights.com/japan/plan-a-cherry-blossom-trip ,
  https://pmc.gov.au/government/australian-national-symbols/australian-floral-emblem , https://lawn.com.au/when-does-wattle-flower/
- Desert bloom: https://www.wikipedia.org/wiki/Desert_bloom , https://chileanendemics.rbge.org.uk/habitats/flowering-desert ,
  https://amp.cnn.com/cnn/2024/07/09/climate/atacama-desert-flowers-bloom-climate-intl
- Fungi: https://biologyinsights.com/what-month-is-mushroom-season/ , https://www.nature.com/news/2007/070402/full/news070402-8.html ,
  https://www.muni.cz/vyzkum/publikace/2298900 (multi-biome study), https://thaiscience.info/Journals/Article/IJAT/10985941.pdf ,
  https://publicaciones.inecol.mx/Record/repo-1005-73/Description?lng=en , https://ui.adsabs.harvard.edu/abs/2018AcO....91....7L/abstract ;
  Mediterranean, https://core.ac.uk/outputs/662020453 , https://www.unicohotels.com/en/blog/hotel-mas-de-torrent/autumn-mushroom-season/ ,
  https://www.tridge.com/news/extreme-heat-and-lack-of-humidity-delay-the--oxmyqm
- Moss placement: https://www.gvsu.edu/cms4/asset/DE36066F-E528-CF94-8F079306A8293D59/moss_beech__stemflow.pdf ,
  https://teara.govt.nz/en/coastal-shoreline/page-2 , https://mhc.jncc.gov.uk/biotopes/jnccmncr00000231 ,
  https://cisfbr.org.uk/Bryo/Cornish_Bryophytes_Coastal.html ,
  https://www.britishbryologicalsociety.org.uk/wp-content/uploads/2020/12/FB120_Bryophyte-Flora-of-the-Isles-of-Scilly.pdf
- Firefly flash: https://en.wikipedia.org/wiki/Photinus_pyralis ,
  https://www.humanegardener.com/wp-content/uploads/2023/05/Bioluminescent-Fireflies-of-Howard-County-MD-cheat-sheet_July-26-1.pdf
- Moss: https://3dmoss.berkeley.edu/community-outreach/media ,
  https://www.tehachapinews.com/lifestyle/pen-in-hand-rain-turns-moss-into-a-lush-green-carpet-covering-rocks-and-other/article_9bb13bdc-3ab7-11e8-af27-4b9de33ac051.html ,
  https://core.ac.uk/download/303679459.pdf
- Seaweed: https://www.marlin.ac.uk/habitats/detail/104 , https://open.uct.ac.za/bitstreams/3fba3ed5-bfaa-44ae-9945-54c939793aeb/download ,
  https://ri.conicet.gov.ar/handle/11336/20341 , https://www.dailykos.com/stories/2017/7/14/1674795/-The-Daily-Bucket-green-tide-an-excess-of-algae-this-summer ;
  kelp, https://doaj.org/article/3135f624a9ca4da2a0e3ecd97e310b19 , https://typeset.io/pdf/environmental-controls-of-giant-kelp-biomass-in-the-santa-4kzyr3q3ws.pdf
- Polar bears: https://polarbearsinternational.org/news-media/articles/what-do-polar-bears-do-in-fall ,
  https://flaviolehner.eas.cornell.edu/outreach/ , https://polarbearsinternational.org/news-media/articles/summer-2023-bear-tracker-update ,
  https://www.antarcticacruises.com/guide/best-time-to-see-polar-bears
- Walrus: https://webarchive.library.unt.edu/web/20130219054821/http:/alaska.fws.gov/fisheries/mmm/walrus/pdf/factsheet_2011.pdf ,
  https://www.arctictoday.com/?p=8057 , https://www.alaska.org/guide/alaska-walrus-haulouts
- Waders: https://waddensea-worldheritage.org/migratory-birds , https://eng.nationalparkvadehavet.dk/experience-the-wadden-sea/migratory-birds-in-the-wadden-sea ,
  https://pub.sovon.nl/static/publicaties/WS-1331-Kleefstra.pdf , https://sora.unm.edu/sites/default/files/journals/iwsgb/n042/p00043-p00044.pdf
- Blacktip sharks: https://fau.isle.flvc.org/node/24809 , https://livescience.com/27720-sharks-swarm-florida.html ,
  https://thecoastalstar.com/profiles/blogs/on-the-water-researchers-studying-why-migrating-blacktip-sharks-a
- Monarchs: https://www.energy.gov/documents/griffiths-and-villablanca-2015-monarch-butterfly-overwintering-groves ,
  https://atlasobscura.com/places/monarch-butterfly-grove
