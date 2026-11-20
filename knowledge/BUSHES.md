# Bushes through the year: which shrubs, when they flower, fruit and shed

The one `bush` kind stands for a coast's own shrubs. This doc says which real species those are,
place by place, and when each flowers, fruits and sheds, with colours and shapes. Research
written 2026-11-14. Code: `src/shrubs.ts` (`SHRUBS`: which species grow where, and their share of
the bushes), `src/phenology.ts` `BLOOM` (flowers: rows with `species`) and `src/fruits.ts` `FRUIT`
(fruit: rows with `species`). Trees are in [TREES.md](TREES.md). Gorse, rock rose and wattle,
the first bush rows, are in [NATURE.md](NATURE.md) §1.1. Heather is ground cover (NATURE_PLAN
phase 5).

Conventions:

- Shrub rows use the place's **local calendar months**: each species' places lie in one
  hemisphere. Willow is the exception: it follows the climate's leaf days, northern places only.
- Colours are **linear albedo**; five are measured from photos (§4), the rest *(est.)*: hue from the sources, brightness set against the
  measured leaves. White flowers are `[0.62, 0.62, 0.6]`, close to the rock rose's measured
  white.
- Sources were read through search summaries (§5).

## 0. How a bush gets its species

Each bush crown takes a species by a hash of its position (`crownBlossom`), the same hash the
older blossom rows use:

1. The hash range first holds the older bush rows that grow there, exactly as before (gorse 0.5,
   rock rose 0.4, wattle 0.35).
2. Next come the place's shrub species, each with its share.
3. The rest of the range is generic bushes.

So a bush that flowers white in April is the same bush that hangs sloes in October, and a moving
camera sees the same ones. A crown flowering or fruiting today is its variant's twin: the same
replayed draws, plus the species' flower cards and fruit. Plain bushes are built exactly as
before.

Berries hang in clusters (`FruitRow.cluster`: sea buckthorn packed along the twig, haws, lentisk, salal, calafate, myrtle, naupaka), each berry an 8-triangle octahedron at its real size, on the mound's surface (0.36 m out from the twig tips: the leaves reach ~0.3 m; at 0.08 m every berry was hidden).

Bushes stand 6 m and more from the camera, nearer than trees. A 1 cm berry at 10 m is about
1 px: berries read as a tint on the twigs where they're packed (sea buckthorn, lentisk, haws).
Hips, sloes and plums read as dots; bunches, banksia spikes and flower cards read as shapes.

## 1. Which shrubs, where

"Days" counts land days (of 712 with bushes in the pool) where the species grows
(`params.mjs --stats`, 2026-11-14).

| Region (places) | Species, share of the bushes | Days |
|---|---|---|
| North Sea and Baltic dunes (`wadden-north-sea`, `baltic`) | sea buckthorn 0.25, Japanese rose 0.2; Wadden also blackthorn and hawthorn 0.15 each | 16 / 39 |
| Atlantic Europe (`cornwall-wales`, `brittany`, `ireland`, `scotland`, `bristol-channel`, `morecambe-bay`) | after gorse (0.5): blackthorn 0.15, hawthorn 0.15; strawberry tree 0.08 in Ireland and Brittany | 18 |
| Mediterranean (`western-med`, `adriatic`, `aegean`, `north-africa-levant`, `portugal-morocco`, `canaries`) | after rock rose (0.4): lentisk 0.2, Spanish broom 0.15, myrtle 0.1, strawberry tree 0.08 | 51 |
| NE America (`maine`, `nova-scotia`, `pei`), `japan` | Japanese rose 0.2 (native in Japan as hamanasu, naturalised on the Atlantic coast) | in 39 |
| Caribbean and Florida (`antilles`, `lesser-antilles-volcanic`, `bahamas-bermuda`, `yucatan-belize`, `central-america`, `florida-carolinas`, `northeast-brazil`) | sea grape 0.3; Florida also saw palmetto 0.3 | 49 / 8 |
| Indo-Pacific (Hawaii, Pacific islands, Maldives, Sri Lanka, Indonesia, Philippines, East Africa, northern Australia, SE Asia, Taiwan, southern Japan…) | beach naupaka 0.35 | 129 |
| East Australia, Tasmania | after wattle (and Tasmania's gorse): coast banksia 0.1; coast tea-tree 0.12 (east only) | 9 / 7 |
| New Zealand | after gorse: mānuka 0.3 | 17 |
| California | yellow bush lupine 0.25 | 10 |
| Pacific Northwest, BC, SE Alaska | salal 0.35 | 33 |
| Tierra del Fuego, Patagonian fjords | calafate 0.35 | 11 |
| Northern boreal and polar coasts (Iceland, Scandinavia, Alaska, Canada) | willow 0.4 | 197 |
| Natal | Natal plum 0.25 | 3 |
| **No species yet** | arid coasts (saltbush, desert shrubs: they flower after rain, which bloom years cover), the Cape's fynbos, central Chile's matorral, the Azores' and Madeira's laurel scrub, Southern Ocean islands | 165 |

On 217 of those days a species is both flowering and fruiting, on 90 fruiting only and on 44
flowering only.

## 2. The calendar, by shrub

**Sea buckthorn** (*Hippophae rhamnoides*): dunes of the North Sea and Baltic.
- *Flowers:* small and green, in **April**, before the leaves (March–April in mild places).
  Wind-pollinated and dioecious. Not drawn.
- *Fruit:* orange ovoid berries (6–8 mm) packed along the twigs, ripe **August–September**. They
  hang **all winter** unless birds take them.
- *Drawn:* green in July, orange `[0.48, 0.08, 0.012]` (**measured**, `sea_buckthorn_ru`, `--petal`) Aug–Jan, thinning by March; 4 berries a twig
  tip.

**Japanese rose** (*Rosa rugosa*): dunes, Baltic, North Sea, NE America, Japan.
- *Flowers:* magenta-pink, some white, 7–9 cm, **June–August**. A few last into October.
- *Fruit:* hips like small tomatoes, ~2–2.5 cm, red-orange from **August**, on the bush into
  January.
- *Drawn:* flowers Jun–Sep (Jul full), hips Aug–Jan, crimson `[0.4, 0.035, 0.03]` (**measured**, `rugosa_hips`, anchored on the leaves).

**Blackthorn** (*Prunus spinosa*): Atlantic hedges and cliff scrub.
- *Flowers:* white, on **bare twigs, March–April**, before the leaves (temperature-driven: early
  in mild springs).
- *Fruit:* sloes 1–1.5 cm, blue-black with a pale bloom, ripe **September–October**, a few into
  winter.
- *Drawn:* flowers Mar–Apr, off-white `[0.48, 0.49, 0.4]` (**measured**, `blackthorn`, `--petal`), the leaves thinning with the flowering (to 30% at the April peak). Sloes
  `[0.05, 0.05, 0.09]` Sep–Dec, green from June.

**Hawthorn** (*Crataegus monogyna*): Atlantic hedges.
- *Flowers:* white (a hint of pink), **May**, with its leaves (hence "the May tree").
- *Fruit:* haws ~1 cm, deep red, ripe **late September – November**, often on the branches well
  into winter.
- *Drawn:* flowers late Apr – Jun (May full); haws `[0.15, 0.022, 0.011]` (**measured**, `haws`: dark red, half the estimate) Sep–Feb, 3 a tip.

**Spanish broom** (*Spartium junceum*): Mediterranean garrigue.
- *Flowers:* bright yellow, **April–July** in Provence (one Spanish seller says Jun–Oct; Calflora
  Apr–Jun).
- *Fruit:* the pods are dry and brown, not drawn.
- *Drawn:* lemon yellow `[0.57, 0.49, 0.034]` (**measured**, `spanish_broom`, `--petal`) May–Jun full, Apr and Jul partial; far tint on.

**Lentisk** (*Pistacia lentiscus*): Mediterranean maquis.
- *Flowers:* small and reddish, Feb–Jun. Not drawn.
- *Fruit:* 4–5 mm drupes in clusters, **red through summer and autumn, blackening into winter**.
  Sources disagree on when (a maquis review says August; an Italian page says red midsummer to
  autumn, ripe in winter).
- *Drawn:* green and red Jun–Aug, red Sep–Nov with black growing, mostly black Dec–Feb.

**Strawberry tree** (*Arbutus unedo*): the Mediterranean, Killarney and Brittany.
- *Flowers:* cream bells **October–December**.
- *Fruit:* takes **about 12 months**, so it ripens with the next flowers: green, yellow, then
  orange and red, ~2 cm and warty.
- *Drawn:* green and small most of the year, yellow in September, red, orange and yellow
  Oct–Jan, beside the flowers.

**Myrtle** (*Myrtus communis*): Mediterranean.
- *Flowers:* white (June–August, *est.*: no source gave the month).
- *Fruit:* blue-black berries, Nov–Jan *(est.)*.

**Sea grape** (*Coccoloba uvifera*): Caribbean and Florida strand.
- *Flowers:* ivory spikes, mainly **spring to early summer**, some all year (IFAS).
- *Fruit:* grape-like bunches, green from early summer, **deep purple by late summer**. They
  ripen unevenly, and only female plants bear them.
- *Drawn:* flower cards as long spikes (May full); bunches Jun–Oct, purple
  `[0.12, 0.03, 0.08]` rising Jul → Oct.

**Beach naupaka** (*Scaevola taccada*): Indo-Pacific strand.
- *Flowers:* white or cream "half-flowers" **all year**.
- *Fruit:* berries green turning **bright white**, all year. They float for a year.
- *Drawn:* both all year at 0.7.

**Saw palmetto** (*Serenoa repens*): Florida.
- *Flowers:* cream plumes **April–June**.
- *Fruit:* drupes green → orange → blue-black in bunches. Months not found *(est. Aug–Oct)*.
- *Drawn on the bush mesh,* not a palmetto's fan leaves (a gap).

**Coast banksia** (*Banksia integrifolia*): east Australia and Tasmania.
- *Flowers:* pale yellow spikes 7–14 cm, **January–July** (local). They wither to grey seed cones
  that stay on the plant for years.
- *Drawn:* upright cones: yellow `[0.5, 0.43, 0.13]` up to 60% of them Mar–May, the rest grey.

**Coast tea-tree** (*Leptospermum laevigatum*): white, **August–October** (local); Herbiguide
puts the peak in Sep–Oct.

**Mānuka** (*Leptospermum scoparium*): New Zealand.
- *Flowers:* white (some pink), **Nov–Jan** on the North Island, Dec–Feb on the South Island,
  4–6 weeks at one place.
- *Drawn:* the northern months for both *(est.)*; far tint on.

**Yellow bush lupine** (*Lupinus arboreus*): California.
- *Flowers:* bright yellow, **April–July** (Theodore Payne; late spring to early summer).
- *Drawn:* far tint on.

**Salal** (*Gaultheria shallon*): Pacific Northwest.
- *Flowers:* pinkish-white bells **May–July**.
- *Fruit:* dark purple-black berries ripe in **August**.

**Calafate** (*Berberis microphylla*): Patagonia.
- *Flowers:* yellow-orange in spring (local Oct–Nov, *est.*).
- *Fruit:* blue-black berries, harvested in the **last week of February – first week of March**
  (a three-season study).

**Willow** (*Salix*: arctic and dwarf willows, tea-leaved willow): northern scrub.
- *Flowers:* catkins come with the new leaves (male yellow, female red on arctic willow). Silky
  grey buds open yellow.
- *Seed:* seeds carry long hairs and blow away as white fluff a few weeks later.
- *Drawn:* by the climate's leaf days: silver catkins 25 days before leaf-out, yellow round
  leaf-out, white fluff from +8 to +45 days. Fluff timing *(est.)*: the sources didn't pin it
  down.

**Natal plum** (*Carissa macrocarpa*): Natal's coastal dunes.
- *Flowers:* white stars in spring and early summer (SANBI).
- *Fruit:* crimson plums 3–5 cm through summer and autumn, some all year. Flowers and fruit
  often show together.

## 3. Shedding

| What | When | Drawn? |
|---|---|---|
| Deciduous bushes' leaves (blackthorn, hawthorn, rose, willow, buckthorn) | with the climate's leaf fall (`deciduousShare` for `bush`: polar 0.8, boreal 0.6, temperate 0.3) | yes (already) |
| Berries eaten or fallen | buckthorn and haws by late winter, hips by January, sloes by December | as the crop thinning |
| Willow seed fluff | weeks after leaf-out | on the bush only |
| Banksia: old cones kept for years | – | yes (grey cones) |
| Fallen fruit on the ground | – | no |

## 4. Open

- The 165 bush days with no species (§1): fynbos, matorral, laurel scrub, arid shrubs.
- Saw palmetto and sea grape are drawn on the round-leaf bush mesh, not their own shapes.
- Mānuka's South Island month lag; Natal and Calafate months *(est.)* where noted.
- Colours measured (2026-11-14, `scripts/assets/asset-measures.json`): sea buckthorn, Japanese-rose hips, haws,
  Spanish broom, blackthorn. The rest are *(est.)*.
- Photos: Commons `Sea buckthorn Russia 2007.JPG`, `Hippophaë rhamnoides DSCN3694-01.jpg`,
  `Rose hips Rosa rugosa Hansa 1.jpg`, `Crataegus monogyna fruit NT2.jpg`, `Spartium junceum 1.JPG`,
  `Prunus spinosa Trefdraeth B.jpg`.

## 5. Sources

All read through search summaries, 2026-11-14.

- Sea buckthorn: https://treesandshrubsonline.org/articles/hippophae/hippophae-rhamnoides/ , https://www.promessedefleurs.ie/shrubs/shrubs-by-variety/hippophae/hippophae-rhamnoides.html ,
  https://plantura.garden/uk/fruits/sea-buckthorn/sea-buckthorn , https://www1.agric.gov.ab.ca/$department/deptdocs.nsf/all/agdex1007
- Japanese rose: https://plants.usda.gov/DocumentLibrary/factsheet/pdf/fs_roru.pdf , https://capemay.com/blog/?p=2137 ,
  https://www.washcoll.edu/learn-by-doing/ces/plants/rosaceae/rosa-rugosa.php , https://totallywilduk.co.uk/?p=94867
- Blackthorn: https://www.ucc.ie/en/tree-explorers/trees/a-z/prunusspinosa/ , https://naturescalendar.woodlandtrust.org.uk/what-we-record-and-why/species-we-record/shrubs/blackthorn ,
  https://woodlandtrust.org.uk/blog/2019/04/hawthorn-and-blackthorn-difference/
- Hawthorn: https://www.ucc.ie/en/tree-explorers/trees/a-z/crataegusmonogyna/ , https://wildlifetrusts.org/wildlife-explorer/trees-and-shrubs/common-hawthorn ,
  https://www.first-nature.com/trees/crataegus-monygyna.php
- Spanish broom: https://www.wildflowersprovence.fr/plant/spartium-junceum/ , https://calflora.net/bloomingplants/spanishbroom.html
- Lentisk: https://www.cielomareterra.org/en/scheda/lentisco , https://www.beanstreesandshrubs.org/browse/pistacia/pistacia-lentiscus-l/ ,
  https://innocentiemangonipiante.it/en/pistacia-lentiscus/
- Strawberry tree: https://en.wikipedia.org/wiki/Arbutus_unedo , https://connexionfrance.com/magazine/frances-autumn-strawberries-the-arbousier-fruit/133840
- Sea grape: https://ask.ifas.ufl.edu/publication/ST175 , https://growables.org/information/TropicalFruit/Seagrape.htm
- Beach naupaka: https://en.wikipedia.org/wiki/Scaevola_taccada , https://hort.ifas.ufl.edu/database/documents/pdf/shrub_fact_sheets/scafrua.pdf
- Saw palmetto: https://ask.ifas.ufl.edu/publication/FP547 , https://mynpn.usanpn.org/npnapps/species/Serenoa/repens
- Coast banksia: https://sutherland.austplants.com.au/rnp/pl29.htm , https://www.friendsoflanecovenp.org/flowers/banksiaintegrifolia
- Coast tea-tree: https://climatewatch.org.au/species/plants/coastal-tea-tree , https://www.herbiguide.com.au/Descriptions/hg_Coast_Teatree.htm
- Mānuka: https://www.umf.org.nz/?p=15119
- Yellow bush lupine: https://store.theodorepayne.org/products/lupinus-arboreus , https://www.grassrootsecology.org/from-the-field/2026/05/20/native-plant-of-the-month-coastal-bush-lupine
- Salal: https://www.wnps.org/native-plant-directory/125:gaultheria-shallon , https://issuu.com/northwestevent/docs/fjord_summer_2020/s/10696363
- Calafate: https://en.wikipedia.org/wiki/Berberis_microphylla , https://pmc.ncbi.nlm.nih.gov/articles/PMC7835903 , https://www.rhs.org.uk/plants/174281/wd/details
- Willow: https://en.wikipedia.org/wiki/Salix_arctica , https://dendro.cnre.vt.edu/dendrology/syllabus/factsheet.cfm?ID=1110
- Natal plum: https://pza.sanbi.org/node/9889 , https://floracanaria.com/canary_islands_flora/exotic_ornamental_flower/carissa_macrocarpa.html
