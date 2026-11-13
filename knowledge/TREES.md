# Trees through the year: flowers, fruits, cones, seeds and shedding

For every tree kind in the project, what it stands for on each coast, and when it flowers, sets
and ripens fruit, cones or seed, and sheds them. Each section gives the colours and shapes too.
Research written 2026-11-13. Code: `src/fruits.ts` (`FRUIT`: what is drawn as its own shape)
and `src/phenology.ts` (`BLOOM`: flowers that recolour leaf cards). Leaf colour and leaf fall
are in [SEASONS.md](SEASONS.md) §2.1. Bushes (which shrubs, their flowers and fruit) are in [BUSHES.md](BUSHES.md); heath blossom, fungi,
fireflies and moss in [NATURE.md](NATURE.md).

Conventions (as NATURE.md):

- Rows keyed by **climate** use **northern-equivalent** months and days (`seasonDay`,
  `seasonMonth`): south of the equator the same row comes six months later. Rows keyed by a
  **place** use its **local** calendar ("local").
- Colours are **linear albedo**. They are *(est.)*: the hue comes from the photos and sources
  below, the brightness is set against the measured leaves and bark (NATURE_PLAN §1). No asset
  measurement was made for this table.
- "Summary" = read through a search summary, not the full page (every source here was read that
  way).

## 0. What a reader sees, and why most fruit is small

Trees stand 9–30 m from the camera at the nearest (framed shots' "heroes"), and most stand
further. At 1080p with our usual lens, 1 m at 20 m is about 45 px. So:

| Size | Pixels at 20 m | Reads as |
|---|---|---|
| Coconut, 30 cm; a date bunch, ~1 m | 14; 45 | a shape |
| Pandanus head, 20 cm; mangrove propagule, 30 × 1.5 cm | 9; 14 × 0.7 | a shape; a thin line |
| Stone-pine or spruce cone, 10–15 cm | 5–7 | a dot of colour |
| Tropical almond, 6 cm; birch catkin, 3–8 cm × 5 mm | 3; 2–4 × ¼ | a speck, a tint over many |
| Olive, 2 cm; cypress cone, 3 cm; acorn, 2–3 cm; gumnut, 1 cm | ~1 | a tint at best |

The decision follows the project's rule "subtle is fine, fake is not". Everything at least
~5 cm and hanging clear of the leaves is drawn at its real size; the crop counts are real, and
some read only as a tint. Olives are the one sub-centimetre-scale fruit drawn: whole groves turn
from green to black, so they read as a tint on near crowns (fewer than grow, to cap triangles).
Not drawn: cypress cones, acorns, gumnuts, umbrella-thorn pods. Reason: each is a single pixel
or less, on trees that are rarely near.

## 1. Which real trees our kinds stand for

From `biome.ts` (comment above `CLIMATE_LOOKS`), `places.ts` `PLACE_PLANTS`, and SEASONS.md
§2.1. "Days" counts land days (of 715) where the kind is in the pool (`params.mjs --stats`,
2026-11-13).

| Kind | Climate or place | Stands for | Days |
|---|---|---|---|
| `palm` | tropical | coconut palm (*Cocos nucifera*) | 197 |
| `palm` | subtropical | Canary date palm (*Phoenix canariensis*); Florida: cabbage palm (*Sabal palmetto*); Asia's fan palms *(est.: drawn as Canary)* | 57 |
| `pandanus` | tropical, subtropical | screw pine (*Pandanus tectorius*) | 204 |
| `broadleaf` | tropical | tropical almond (*Terminalia catappa*, the deciduous 40%), flamboyant, others | 197 |
| `broadleaf` | temperate north | pedunculate and sessile oak, beech | ~110 |
| `broadleaf` | Mediterranean Sea, Iberia | holm oak (*Quercus ilex*) | ~45 |
| `broadleaf` | subtropical | live oak, laurel forest (evergreen) | 64 |
| `broadleaf` | NZ, Tierra del Fuego, Patagonia | pōhutukawa, southern beech | ~20 |
| `stone-pine` | Mediterranean, subtropical | stone pine (*Pinus pinea*); maritime and slash pine | 91 |
| `olive` | Mediterranean | olive (*Olea europaea*) | 54 |
| `cypress` | Mediterranean | Italian cypress (*Cupressus sempervirens*) | 54 |
| `conifer` | temperate, boreal | Norway spruce; Sitka spruce and Douglas fir in the Pacific Northwest | 169 |
| `birch` | boreal, polar | silver and downy birch | 165 |
| `acacia` | arid | umbrella thorn (*Vachellia tortilis*) | 60 |
| `eucalyptus` | Australia, California | blue gum, blackbutt, spotted gum; red flowering gum on WA's south coast | 25 |
| `rhizophora`, `avicennia` (mangroves) | tropical, desert shores | red and grey mangroves | stands |

## 2. The calendar, by tree

### Coconut palm (`palm`, tropical): `coconut`

- **Flowers:** a mature palm opens 12–15 cream to pale-yellow spikes a year, so it flowers **all
  year** (World Agroforestry, FAO Ecocrop).
- **Fruit:** **8–12 months** from set to ripe, about 11 after pollination. Every palm carries nuts
  of every age, all year. Young nuts are **green** and turn **brown** as they ripen and dry.
  "Yellow" varieties go yellow → brown. Dwarf cultivars are green, yellow or orange.
- **Shape:** a husked nut 25–30 cm long, slightly egg-shaped, in clusters under the crown.
- **Shed:** ripe nuts drop all year (on the beach: `props/debris.ts` coconuts).
- **Drawn:** the mesh's own nuts (3–6 a crown, the same draws), recoloured by hash: green 55%
  `[0.07, 0.12, 0.025]`, yellow 15% `[0.24, 0.19, 0.04]`, brown 30% `[0.12, 0.07, 0.03]`.

### Canary date palm (`palm`, subtropical): `palm-dates`

- **Flowers:** cream-yellow plumes in early summer *(Jun–Jul, est. from NC State's
  early-summer fruit and STIHL's September)*.
- **Fruit:** sources disagree. NC State has the "orangish-yellow" fruit ripening in early summer,
  STIHL in September, Edhat in summer and fall. Bunches ~1–2 m hang from among the fronds. The
  dates are 2 cm, oval, yellow to orange. We use green Aug–Sep, **orange Oct–Feb**, and a few dry
  brown bunches left by spring *(est.)*.
- **Drawn:** **no coconuts on subtropical palms** (a realism fix: the old mesh hung coconuts on
  Canary and cabbage palms). Instead 2–3 bunches on stalks: a lumpy hanging mass about 1 m long,
  with the same draws as the old nuts.

### Cabbage palm (`palm`, Florida): `sabal`

- **Flowers:** white to cream plumes in **June–July** (IFAS, USDA, all agree).
- **Fruit:** round and **shiny black**, under 1.3 cm, ripe **Oct–Nov** (Coastal Carolina
  arboretum). FNPS says late summer to fall. Gone by winter *(est.)*.
- **Drawn:** plumes Jun–Jul, green bunches Aug–Sep, black Oct–Dec, none Jan–May.

### Screw pine (`pandanus`): `pandanus`

- **Flowers:** regional. The Dutch botanic garden lists Jan–May, Fiji pollinates Mar–May, northern
  Australia Apr–Aug.
- **Fruit:** a pineapple-like head of wedge-shaped keys, 15–30 cm, that takes **1–2 years** to
  ripen. It is **green**, then yellow, **orange** or red with a green top (NParks: "orange").
  Trees carry heads of every age, so all year.
- **Shed:** the ripe head breaks into keys that fall and float.
- **Drawn:** a 22 cm head on a stalk under each tuft (~0.7 per arm): green 60%, orange
  `[0.5, 0.17, 0.02]` 30%, red 10%.

### Tropical almond (`broadleaf`, tropical): `almond-fruit`

- **Flowers:** small, white to greenish, in spikes, inconspicuous. Months vary by tree and place
  (WorldFloraDB: Mar–Jun and Oct; IFAS: summer and fall).
- **Fruit:** a flattened drupe 5–7 cm, **green turning red, yellow, brown or dark purple**
  (IFAS; WorldFloraDB "dark purple sometimes tinted red"). Fruiting varies "considerably among
  trees and localities". We use all year at 0.7.
- **Shed:** the leaves turn red and fall twice a year (SEASONS.md §2.1, already drawn).
- **Drawn:** only on the deciduous (almond) share of tropical broadleaf crowns, by the same crown
  hash the leaf fall uses. Green 50%, red 30%, purple 20%.

### Flamboyant (`broadleaf`, tropical): flowers in `BLOOM` (NATURE_PLAN phase 4)

- **Pods:** 30–60 cm × 5 cm, flat, dark brown and woody. They hang through the following dry
  season. **Not drawn yet:** only the flowering twins know which crowns are flamboyants, so pods
  need the twin machinery to run out of season (a follow-up).

### Oak (`broadleaf`, temperate north): `oak-catkins` (`BLOOM`)

- **Flowers:** pale yellow-green **catkins** hang with the new leaves, **late April – early
  May** in England (several sources). Some say early April, before the leaves.
- **Fruit:** acorns, green, ripening brown by **mid–late October**. Not drawn (2–3 cm, among the
  leaves).
- **Drawn:** leaf cards as catkins at **leaf-out** (northern days 100–145, full 112–132), 30% of
  the cards at 0.45 of a leaf's size, colour `[0.2, 0.19, 0.04]`, on 85% of crowns. The crowns
  keep their leaf-out (`keepsSeason`), so catkins show on half-leafed oaks. No far tint
  (subtle).

### Holm oak (`broadleaf`, Mediterranean Sea and Iberia): `holm-oak` (`BLOOM`)

- **Flowers:** yellow to greenish-yellow catkins all over the evergreen crown, **April–May**
  (Provence, Giglio); a UK source has April–June. A holm-oak wood in flower looks golden-olive
  from afar *(est.: no photo measured)*.
- **Fruit:** acorns ripen in the first autumn (feed for Ibérico pigs). Not drawn.
- **Drawn:** Apr 0.6, May 1, Jun 0.2 (northern-equivalent); 35% of cards on 80% of crowns,
  `[0.24, 0.19, 0.04]`. **Far tint on.** Not in California (coast live oak), the Cape, Chile or
  SW Australia (other trees).

### Stone pine (`stone-pine`): `stone-pine-cones`

- **Flowers:** pollen cones in spring. The new shoot starts in April, just after flowering
  (Spanish strobilus study).
- **Cones:** **three years** to ripen, the longest of any pine (Gymnosperm Database, Conifer
  Society). For the first two they are green and round. In the third they grow ovoid, 8–15 cm,
  and turn **shiny chestnut-brown**. Sources differ on the month: "April" in the third year
  (Conifer Society) against maturation in **October–November** (Portuguese phenology). The
  likely reading is ripe in autumn, shiny brown through the winter, opening in the summer heat.
- **Shed:** the seeds (pine nuts) fall in summer. Open grey cones hang on a while.
- **Drawn:** every crown, all year, ~1 cone a twig tip on the crown's surface. Green
  `[0.08, 0.11, 0.04]` at 0.65 size, the rest chestnut `[0.16, 0.075, 0.03]` (35% Oct–May) and
  open grey `[0.16, 0.13, 0.1]` (30% Jun–Sep).

### Olive (`olive`): `olive` (`BLOOM`) and `olive-fruit`

- **Flowers:** small cream clusters in spring. FAO and growers put it in **late April – June**
  in the northern Mediterranean (one grower says March). A September–October date in one search
  summary contradicts the rest and is ignored.
- **Fruit:** fruit set right after; green and growing **June–September**; then intense green →
  yellowish-green → partly purple → purple → **violet-black**. Green-ripe table olives are picked
  from October. Black ones ripen 3–4 months after the green stage, so Nov–Jan. The harvest runs
  **October to January**; the unpicked fruit hangs into late winter.
- **Drawn:** flowers May (1), Jun (0.6), Apr (0.3), 25% of cards at 0.4 size, cream
  `[0.5, 0.48, 0.33]`. The fruit is a 2.2 cm egg, 1.5 a tip on the crown's surface: crop
  Jun 0.3 → Aug–Oct 1 → Dec 0.6 → Feb 0.2, none Mar–May (harvested). Black share Oct 0.1 →
  Dec 0.8 → Jan 1; purple between.

### Italian cypress (`cypress`): nothing drawn

- **Cones:** round to ovoid, **2–4 cm**, 8–14 scales, green or bluish at first, **brown-grey
  after ~20–24 months**, and they stay on the tree (persistent). Every tree carries both kinds,
  all year. At 2–4 cm against a dark narrow crown they're under a pixel at our distances.

### Spruce (`conifer`): `spruce-cones`

- **Flowers:** pink-red pollen cones and **ruby-red to purple female cones, upright**, at the
  top of the tree in **May** (NC State "purple", others "ruby-red").
- **Cones:** after pollination they turn green and hang down. By **October** they are brown and
  10–15 cm (Scandinavian Mountains). The Conifer Society gives 5–7 months.
- **Shed:** the seeds fall over the winter and the next spring (sources differ: autumn, the
  following year, spring). The **empty cones hang until the next autumn** (WSL).
- **Masting:** heavy crops come every few years (WSL MastWeb's mast monitoring). We hash it per
  calendar year and place: heavy (1) 1 year in 4, middling (0.45) 1 in 3, else light (0.15).
  2020–2026 at `norway-west` happen to be light or middling.
- **Drawn:** cones only at the top third of the tree (from 0.65 of the crown's height), up to 3
  per branch end in a heavy year. Mid-May to early June: red `[0.22, 0.03, 0.06]`, upright, at
  0.45 size. Then green, hanging and growing to full size by August. Brown `[0.14, 0.075, 0.035]`
  from September. Last year's cones stay brown until mid-May, then grey and fewer until late
  September.

### Birch (`birch`): `birch-catkins`

- **Flowers:** the male catkins **form in late summer** and hang closed, brownish, **all
  winter** (2–4 cm). They open yellow and lengthen to 6–8 cm in **April–May** (Woodland Trust;
  some say March–May) as the leaves come.
- **Fruit:** the female catkins turn green and hang in **July–August**, then brown. They **break
  up in September–October**, shedding winged seeds into the winter (USDA seed manual; UK
  sources).
- **Drawn:** keyed to the climate's leaf days (boreal leaf-out d 140, temperate d 105, polar d 166):
  male catkins closed and brown `[0.09, 0.05, 0.04]` from d 220 through winter; open and yellow
  `[0.3, 0.24, 0.05]` from leaf-out −20 to +20 days; female catkins green, then brown from
  d 215–245, thinning out from d 255 to 330. They're thin tails (5–9 mm wide) and read only as a
  tint on near crowns, most clearly on bare winter birches.

### Umbrella thorn (`acacia`): `umbrella-thorn` (`BLOOM`)

- **Flowers:** globose, scented heads, **cream to white**, early to late summer, in the rainy
  season (SANBI). They are "fairly inconspicuous unless flowering is heavy".
- **Fruit:** flat pods coiled into a spring, which break into segments. Not drawn (thin and small).
- **Drawn:** northern-equivalent May 0.3, Jun–Jul 1, Aug 0.5; 30% of cards at half size, cream
  `[0.58, 0.55, 0.4]`, on half the crowns. *(est.: the month window follows the southern
  African "summer" mapped to northern-equivalent months; Red Sea and Arabian acacias flower
  after their own rains, not checked.)*

### Gums (`eucalyptus`): `gum-blossom` and `red-flowering-gum` (`BLOOM`)

- **Blue gum:** flowering is mainly spring, with spasmodic flowers all year, over as much as 9
  months (Tasforests). Western Tasmanian populations flower later. Flowers are cream stamen
  tufts *(colour est.: not confirmed by a source read)*. Drawn local: Sep–Oct 1, Aug 0.7,
  Jul 0.5, Nov 0.6, otherwise 0.2–0.3. California's groves *(est.)*: Mar–Apr 1, Dec–Feb and May
  partial.
- **Red flowering gum** (*Corymbia ficifolia*): native to WA's south coast round Walpole and
  Denmark, planted widely. Crimson, scarlet, orange or pink over the whole crown. EUCLID records
  **Jan–May and Sep**; Australian Geographic gives the warmer months, Dec–Apr. Drawn local:
  Jan–Feb 1, Mar 0.6, Dec 0.6, Apr 0.3, on 6% of `sw-australia` crowns (`scales: 'crowns'`), in
  three colours.
- **Shed:** gums shed their bark in summer ribbons. Not drawn (the bark shader is fixed).

### Red mangrove (`rhizophora`): `propagules`

- **Flowers:** pale yellow, mainly **early to mid summer** in Florida but also all year (IFAS).
  Dangremond and Feller found June–August.
- **Propagules:** the seed germinates on the tree. A green, cigar-shaped seedling **20–40 cm**
  long hangs from the fruit. Fruit peaks 4–7 months after the buds, and the main propagule crop
  4–6 months later still (Gill and Tomlinson 1971). In northern Florida they stay attached for
  **9–10 months**. A Mexican stand produced flowers and propagules all year with dry and rainy
  swings, ~357 days from flower to mature propagule.
- **Drawn:** all year at 0.6 (tropical stands), about one per twig tip hanging below the crown:
  green `[0.07, 0.11, 0.03]` with a brown cap 75%, older brown 25%.

### Grey mangrove (`avicennia`): nothing drawn

- Small yellow-orange flowers in the dry season (south-east Australia Jun–Oct). In Kenya the
  buds start in November and the fruit falls in April–May. In the Red Sea flowering and
  propagules peak Nov–Jan. Fruit takes 2–3 months near the equator and up to 10 in the far
  south. Not drawn: flowers a few mm across, on 2–4 m trees.

## 3. Shedding, summarised

| What falls | When | Drawn? |
|---|---|---|
| Deciduous leaves (oak, beech, birch, almond) | SEASONS.md §2.1 | yes: leaf fall and litter (`props/leafLitter.ts`) |
| Coconuts | all year | yes: on the sand (`props/debris.ts`) |
| Birch seed | Sep → winter | no (2 mm seeds; their catkins thin out on the tree) |
| Spruce seed; empty cones | winter–spring; cones hang until the next autumn | on the tree only |
| Stone-pine seed; open cones under the tree | summer | on the tree only; cones on the ground are a gap (`leafLitter` could carry them) |
| Olives | unpicked, Jan–Mar | no |
| Gum bark ribbons | summer | no |
| Mangrove propagules | after 9–10 months | on the tree only |

## 4. Sources

All read through search summaries, 2026-11-13.

- Stone pine: https://herbarivirtual.uib.cat/en/general/78/especie/pi-ver ,
  https://conifersociety.org/conifers/pinus-pinea/ , https://ressources.ciheam.org/ressources/om/pdf/a122/00007243.pdf ,
  https://www-archiv.fdm.uni-hamburg.de/b-online/earle/pi/pin/pinea.htm
- Norway spruce: https://scandinavianmountains.com/flora-fauna/trees-shrubs/norway-spruce.htm ,
  https://mastweb.wsl.ch/en/recognise-seed-mast/norway-spruce/ , https://plants.ces.ncsu.edu/plants/picea-abies/common-name/norway-spruce/ ,
  https://conifersociety.org/conifers/picea-abies/ , https://bygl.osu.edu/node/736
- Birch: https://naturescalendar.woodlandtrust.org.uk/what-we-record-and-why/species-we-record/trees/silver-birch/ ,
  https://forestrycommission.blog.gov.uk/2026/03/30/the-lifecycle-of-catkins , https://www.fs.usda.gov/nsl/Wpsm/Betula.pdf ,
  https://www.treeguideuk.co.uk/?p=7102
- Olive: https://www.fao.org/land-water/databases-and-software/crop-information/olive/ar ,
  https://deepgreenpermaculture.com/2023/09/18/harvesting-olives-a-guide-on-when-and-how-to-pick-them/ ,
  https://www.origenoliva.com/en/blogs/noticias-aceite-de-oliva/un-ano-en-la-vida-del-olivar
- Pandanus: https://www.nparks.gov.sg/florafaunaweb/flora/5/2/5242 , https://www.botanischetuinen.nl/en/plant_en/35588/screw-pine ,
  https://webarchive.library.unt.edu/web/20090116105445/http:/www.agroforestry.net/tti/P.tectorius-pandanus.pdf
- Red mangrove: https://ask.ifas.ufl.edu/publication/FP502 , https://harvardforest1.fas.harvard.edu/publications/pdfs/Gill_Biotropia_1971.pdf ,
  https://www.floridamuseum.ufl.edu/southflorida/habitats/mangroves/species/
- Grey mangrove: https://researchportal.murdoch.edu.au/esploro/outputs/journalArticle/Vegetative-and-reproductive-phenologies-of-four/991005540570507891 ,
  https://serm.ulb.be/wp-content/uploads/2022/01/070_Wangonduetal_2010_WIndOceanJMarSci.pdf
- Umbrella thorn: https://pza.sanbi.org/node/9642 , https://arboretum.arizona.edu/sites/arboretum.arizona.edu/files/Vachellia%20tortilis_SD_1.pdf
- Tropical almond: https://edis.ifas.ufl.edu/publication/ST626/pdf , https://worldfloradb.net/plants/terminalia-catappa-l ,
  https://somemagneticislandplants.com.au/beach-almond
- Gums: https://permits.sttas.com.au/sites/default/files/media/documents/science/tasforests/Tasforests-Vol-8_pages69-93.pdf ,
  https://figshare.utas.edu.au/articles/journal_contribution/Genetic_control_of_flowering_time_in_Eucalyptus_globulus_ssp_globulus/22884365 ,
  https://keys.lucidcentral.com/euclid/pdf/entities/corymbia_ficifolia.pdf , https://www.australiangeographic.com.au/?p=14772
- Oak: https://www.treeguideuk.co.uk/?p=76 , https://www.ucc.ie/en/tree-explorers/trees/a-z/quercusrobur/ ,
  https://forest.jrc.ec.europa.eu/en/european-atlas/qr-trees/pedunculate-oak
- Holm oak: https://www.wildflowersprovence.fr/?p=20220 , https://uol.de/en/icbm/geooekologie/lehre/giglio-flora/pflanzensteckbriefe-m-z/quercus-ilex-steineiche ,
  https://www.woodlandtrust.org.uk/trees-woods-and-wildlife/british-trees/a-z-of-british-trees/holm-oak/
- Coconut: https://apps.worldagroforestry.org/treedb/AFTPDFS/Cocos_nucifera.PDF , https://ecocrop.apps.fao.org/ecocrop/srv/en/cropView?id=744 ,
  https://eagriorg.github.io/eagri50/HORT282/pdf/lec14.pdf
- Canary date palm and cabbage palm: https://plants.ces.ncsu.edu/plants/phoenix-canariensis , https://www.stihl.com/792.aspx?idTree=203 ,
  https://coastal.edu/arboretum/sabal_palmetto , https://www.fnps.org/plant/sabal-palmetto , https://hort.ifas.ufl.edu/trees/SABPALA.pdf
- Italian cypress: https://forest.jrc.ec.europa.eu/media/atlas/Cupressus_sempervirens.pdf ,
  https://www.ruhr-uni-bochum.de/biodivpfl/Cupressaceae/Description/HTML/Cupressus%20sempervirens.htm

## 5. Open

- Flamboyant pods (§2): they need the flowering twins to persist out of season.
- Stone-pine cones and coconuts' kin on the ground under the trees (`leafLitter`).
- Red Sea and Arabian acacia flowering after local rains; Asian subtropical fan palms
  (*Livistona*: blue-black fruit) drawn as Canary dates.
- Colours not measured with `asset.mjs` (every colour here is *(est.)*).
