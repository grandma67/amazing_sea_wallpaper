# Clouds

Which clouds the wallpaper draws, on which coasts and in which weather. Status 2026-10-22
(changelog 0.22–0.27). Code paths: ARCHITECTURE.md; pitfalls: LESSONS.md (takram, storms);
sources: REFERENCES.md.

## How a sky is chosen

1. **Weather kind** (`generateWeather`, `params.ts`): one per day, on any coast.
2. **Storm** (`generateStorm`): 7% of days that aren't night, on any coast. It replaces the
   sky with storm clouds (see [Storms](#storms)).
3. **Genera** (`pickFormations`, `cloudTypes.ts`): at most one per band (low, mid, high),
   weighted by the weather kind and the coast's climate.
4. **Species** (`pickSpecies`, own stream): refines genera to species and adds fractus, scud
   and duplicatus decks. At most 4 layers in all.

Each entry is one takram volumetric layer. Species have their own keys (`'cumulus-fractus'`)
and a WMO `genus`, so code checks `genus === 'cumulonimbus'` (`stormEffects.ts`,
`props/storm.ts`). The spec field `clouds` accepts every key (`GENERA` in `sceneSpec.ts`).

### Weather kinds

| Kind | Share of days | Sky |
|---|---|---|
| `clear` | 15% | none |
| `cirrus` | 13% | one high layer only |
| `few` | 18% | cumulus, sometimes cirrus |
| `scattered` | 25% | Cu or Sc, often Ac or Ci above |
| `broken` | 18% | Sc or towering Cu, often a mid layer |
| `overcast` | 6% | Sc, St or Ns deck, sometimes As; sun hidden. Less likely at night and blue hour |
| `storm` | 6% | cumulonimbus (never at night) |

Shares are over 2024–2026 (`node scripts/params.mjs --stats 'p => p.weather.kind'`).

### What the coast and conditions change

| Condition | Biomes / rule | Effect |
|---|---|---|
| **Cool** | nordic, volcanic | Sc ×2 (scattered, broken); St ×2 (overcast); allows Sc castellanus |
| **Tropical** | tropical | Cu ×2 (scattered); congestus ×2 (broken); humilis on most `few` days |
| **Warm summer** | mediterranean, tropical; Jun–Sep (Dec–Mar on the Southern Ocean) | allows Ac castellanus / floccus on mornings |
| **Morning** | sun up, before noon | humilis on `few` days; Ac turrets (with warm summer) |
| **Windy** | wind ≥ 8 m/s | fractus under cumulus |
| — | desert | no climate leaning: the base weights |

No biome forbids a genus outright. Biomes change the odds, and only the species listed
above need a particular climate.

## Supported clouds (20 entries in `CLOUD_GENERA`)

Base and thickness are each layer's `altitude` and `height` in metres.

### Low (< 2 km)

| Entry | Base / thick | Weather | Biome and conditions |
|---|---|---|---|
| `cumulus` (mediocris) | 700 / 900 | few, scattered, broken | everywhere; most of all on tropical coasts |
| `cumulus-humilis` | 600 / 450 | few | tropical (trade winds) or mornings: 75%; else 10% |
| `cumulus-fractus` | 550 / 350 | scattered (50%), broken with Cu (35%) | wind ≥ 8 m/s; torn by wind or left over from showers |
| `cumulus-congestus` | 800 / 3200 | broken | everywhere, ×2 tropical; forced by waterspouts; titled "towering cumulus" |
| `cumulonimbus` (calvus) | 600 / 9500 | storm only | any coast; 50% of storms |
| `cumulonimbus-capillatus` | 600 / 9500 | storm only | other 50% (stream `'storm-anvil'`); adds a Ci spissatus anvil deck |
| `stratocumulus` | 650 / 500 | scattered, broken, overcast | everywhere; ×2 nordic and volcanic (marine Sc over cool water) |
| `stratocumulus-castellanus` | 650 / 950 | broken, overcast | nordic and volcanic only, wind ≥ 6 m/s, 35%; titled "turreted clouds" |
| `stratus` | 350 / 450 | overcast | everywhere; ×2 nordic and volcanic |
| `stratus-fractus` (scud) | 300 / 250 | overcast under Ns (60%); storms (60%) | any coast; sparse dark scraps |
| `nimbostratus` | 600 / 2600 | overcast | any coast; rain days |

### Mid (2–7 km)

| Entry | Base / thick | Weather | Biome and conditions |
|---|---|---|---|
| `altocumulus` | 3200 / 350 | scattered, broken | everywhere; titled "mackerel sky" |
| `altocumulus-castellanus` | 3200 / 800 | scattered, broken | mediterranean and tropical, summer mornings; titled "turreted clouds" |
| `altocumulus-floccus` | 3400 / 550 | scattered, broken | as castellanus (50/50 between them) |
| `altostratus` (translucidus) | 3800 / 900 | broken; storms (60%, bright ones) | everywhere |
| `altostratus-opacus` | 3500 / 1500 | overcast; dark storms | everywhere; hides the sun |

### High (5–13 km)

| Entry | Base / thick | Weather | Biome and conditions |
|---|---|---|---|
| `cirrus` | 7500 / 500 | cirrus, few, scattered, broken | everywhere |
| `cirrus-spissatus` | 8800 / 900 | broken (30% of Ci); Cb anvils | everywhere |
| `cirrocumulus` | 7000 / 300 | cirrus, scattered | everywhere; `cellScale` 3; titled "cirrocumulus ripples" |
| `cirrostratus` | 8500 / 700 | cirrus, broken | everywhere |

### Extra layers

- **Duplicatus**: in 15% of broken or overcast skies, a second deck of the same genus
  (Ci, Cs, Ac, As, Sc; mostly Ac and Sc) sits 300–800 m higher.
- **Weather channels** (`layerChannels`): each band reads its own weather-map channel (low r,
  mid g, high b). A band's 2nd layer reads a spare channel (`a`, fine Perlin) so its holes don't
  copy the first layer's.

### How often, by biome

Share of each biome's days with that layer in the sky (2024–2026, `params.mjs --stats
'p => p.weather.formations' --where 'p => p.biome.name === "…"'`).

| Entry | nordic | volcanic | mediterranean | tropical | desert |
|---|---|---|---|---|---|
| cumulus | 25% | 29% | 33% | 27% | 35% |
| cumulus-humilis | 6% | 6% | 6% | 13% | 4% |
| cumulus-fractus | 3% | 5% | 4% | 6% | 5% |
| cumulus-congestus | 5% | 2% | 6% | 9% | 7% |
| cumulonimbus (both) | 4% | 8% | 7% | 6% | 1% |
| stratocumulus | 22% | 19% | 16% | 13% | 21% |
| stratocumulus-castellanus | 2% | 3% | – | – | – |
| stratus | 4% | 3% | 3% | 1% | 2% |
| stratus-fractus | 3% | 3% | 3% | 4% | 1% |
| nimbostratus | 1% | 1% | 1% | 2% | – |
| altocumulus | 13% | 13% | 16% | 15% | 18% |
| altocumulus-castellanus / floccus | – | – | 1% | 2% | – |
| altostratus | 4% | 5% | 5% | 6% | 6% |
| altostratus-opacus | 6% | 4% | 6% | 6% | 4% |
| cirrus | 27% | 17% | 26% | 24% | 22% |
| cirrus-spissatus | 3% | 5% | 3% | 4% | 3% |
| cirrocumulus | 4% | 8% | 4% | 5% | 2% |
| cirrostratus | 5% | 5% | 5% | 4% | 4% |

Storms don't depend on the biome; differences in the cumulonimbus row are sample noise.

## Storms

`stormFormations`, own streams. 7% of days that aren't night, any coast. Spec `storm`
(`"thunderstorm"`, `"squall"`).
- Cumulonimbus: calvus, or capillatus with a Ci spissatus anvil at ~9–10 km (50/50).
- Altostratus in 60%: opacus when the storm is dark (60% of storms), translucidus when bright.
- Scud (stratus fractus) under the base in 60%.
- Wind 14–22 m/s. Lightning in 75%, rain curtains 3–16 km out.
- **Shelf cloud** (arcus): ~40% of storms; tiered wedge under the base toward the rain, lighter
  sky under its lip. Spec `shelfCloud`.

## Cloud arrangement (`cloudArrangement.ts`)

A 2×2 transform on takram's weather-map lookup in cube-sphere uv, along
`weather.arrangement.headingDeg` (the wind). It applies to all layers. Not in storms. Spec
`cloudArrangement`.
- **Streets** (radiatus): along the wind. Main layer Cu (not congestus) or Sc, few or
  scattered, wind ≥ 5 m/s. 40% on tropical coasts (trade winds), 25% elsewhere.
- **Bands** (undulatus): across the wind. Main layer Ac, Cc or Sc, 30%.

## Special clouds

### In the sky shader

| Cloud | Height | Where and when | Weather | Spec |
|---|---|---|---|---|
| **Contrails** (`contrails.ts`) | 9.5–12 km | 0–5 by air traffic: busy N Atlantic and Mediterranean, fewer in the tropics, ~none on the Southern Ocean | persist and spread on humid (cirrus) days; none at night, overcast or storm | `contrails` |
| **Noctilucent** (`noctilucent.ts`) | 82 km | nordic and Southern Ocean coasts at 50–67°; late May–mid Aug / late Nov–mid Feb, peak at solstice | blue hour, clear | `noctilucent` |
| **Nacreous** | 22 km | Arctic and Southern Ocean, winter twilight, ~3% | clear twilight | `nacreous` |

Contrails are lit for their own height: pink at sunset, dark lines in the earth's shadow at
blue hour. Noctilucents are physically faint (optical depth ~1e-4; they need the sun 6–16°
down and our blue hour stops at −7°), so they stay subtle. Nacreous are pastel iridescent
lenses.

### Meshes (`props/waterspout.ts`, `skyEvents.ts`, `props/cloudEvents.ts`)

| Cloud | Where and when | Weather | Spec |
|---|---|---|---|
| **Waterspout** | Florida Keys/Caribbean May–Oct (peak Aug); Mediterranean Aug–Nov (peak Sep); other tropics in the wet season; 1 day in 3 years (too rare, plans/WATERSPOUT_FOG.md) | daytime, building cumulus, light wind (fair-weather spout); or under storms (tornadic). Forces towering cumulus | `waterspout` |
| **Morning Glory** (volutus) | tropical Indo-Pacific, dawn, Sep–Nov | – | `rollCloud` |
| **Lenticulars** | over mountains and volcanoes | wind ≥ 10 m/s | `lenticular` |
| **Pyrocumulus** (flammagenitus) | white cap on half the volcano plumes | – | – |

The waterspout is an opaque, curved, striated funnel 10–50 m wide reaching into its own
lowered soft base (a mesh can't see gaps in the deck), with a spray cascade. Morning Glory is
1–3 lumpy banded tubes across the view and gets a title. Lenticulars are stacked lenses.

## Coastal weather

Weather tied to a particular coast rather than a biome (PLAN_BIOMES.md; needs places,
phase 1a, which draws the place before the sky).

| Weather | Where and when | Look | Phase |
|---|---|---|---|
| Marine layer (June Gloom, camanchaca) | California May–Jul (~45% of mornings), Aug–Oct ~15%; Atacama–Peru Jun–Sep, weaker | stratus (60%) or Sc deck at ~350–650 m, golden hour to late morning (not evenings, midday), wind ≤ 6 m/s; never with storms. **Done** (`coastalWeather.ts`): Atacama Jun–Sep 30%, Oct 15%; 1 day in 2024–2026 (small places); spec `marineLayer` | 3 |
| Harmattan | West Africa Dec–Feb (~50% of days) | dust haze, visibility 2–10 km, ochre sky, dim red sun | 3 |
| Haar | Scotland, NE England, Norway, Apr–Jul | sea fog rolling in on warm days; check `fogSeason` first | 3 |
| Sea-breeze cumulus | warm sunny afternoons, mediterranean to tropical | Cu over land, clear over the sea | 13 (later) |
| Offshore winds | mistral, bora, Santa Ana, harmattan | clear air, smooth faces, spray blown back off crests | 13 (later) |

Sources: [June Gloom](https://en.wikipedia.org/wiki/June_Gloom),
[Namib fog and Benguela upwelling (ACP 2026)](https://acp.copernicus.org/articles/26/12565/2026/).

## Limits

takram draws at most 4 layers, all sharing one weather map and repeat (`localWeatherRepeat` ×
`cellScale`). The arrangement transform hits every layer. There are no per-object volumetric
shapes, so single clouds (spouts, rolls, lenticulars) are meshes.

## Not done yet

| Feature | Status | Approach |
|---|---|---|
| Virga / praecipitatio from showers | not started; rain shafts are storm-only | extend `RainShaftEffect` (`stormEffects.ts`) to Cu/Ac; virga fades partway down |
| Lacunosus (holes in Ac, Cc, Sc) | deferred: needs a per-layer hook (the arrangement patch is global) | `1 - weather` for one layer, or `weatherExponent` < 1 with a sharp `coverageFilterWidth` |
| Mammatus (Cb, Ac, Ci) | deferred: density term in takram's march; render-time risk | cellular-noise bumps under capillatus anvils, ~30% of those storms near golden hour |
| Cavum, pileus/velum, fluctus, asperitas | low priority, rare | only if a per-layer hook makes them cheap |

Not planned: murus, cauda, flumen (supercells, over land); silvagenitus (over land; maybe
forested coasts later); cataractagenitus (no waterfalls); ship tracks (seen only from
satellites); nitric-acid PSCs (invisible).

## Reference: WMO atlas (ICA 2017, current)

Allowed per genus (Table 2): species | varieties | supplementary features | accessory clouds.
- **Ci:** fibratus, uncinus, spissatus, castellanus, floccus | intortus, radiatus, vertebratus, duplicatus | mamma, fluctus | –
- **Cc:** stratiformis, lenticularis, castellanus, floccus | undulatus, lacunosus | virga, mamma, cavum | –
- **Cs:** fibratus, nebulosus | duplicatus, undulatus | – | –
- **Ac:** stratiformis, lenticularis, castellanus, floccus, volutus | translucidus, perlucidus, opacus, duplicatus, undulatus, radiatus, lacunosus | virga, mamma, cavum, fluctus, asperitas | –
- **As:** – | translucidus, opacus, duplicatus, undulatus, radiatus | virga, praecipitatio, mamma | pannus
- **Ns:** – | – | praecipitatio, virga | pannus
- **Sc:** stratiformis, lenticularis, castellanus, floccus, volutus | translucidus, perlucidus, opacus, duplicatus, undulatus, radiatus, lacunosus | virga, mamma, praecipitatio, fluctus, asperitas, cavum | –
- **St:** nebulosus, fractus | opacus, translucidus, undulatus | praecipitatio, fluctus | –
- **Cu:** humilis, mediocris, congestus, fractus | radiatus | virga, praecipitatio, arcus, fluctus, tuba | pileus, velum, pannus
- **Cb:** calvus, capillatus | – | praecipitatio, virga, incus, mamma, arcus, murus, cauda, tuba | pannus, pileus, velum, flumen

Special clouds: homogenitus/homomutatus (contrails), flammagenitus (fire, volcanoes),
silvagenitus (forests), cataractagenitus (waterfalls). Upper atmosphere: nacreous,
nitric-acid/water PSCs, noctilucent.

Sources: [WMO classification](https://cloudatlas.wmo.int/en/cloud-classification-summary.html),
[WMO new classifications](https://wmo.int/node/36164),
[WMO new edition](https://wmo.int/node/25382),
[RMetS](https://rmets.org/metmatters/international-cloud-atlas-and-new-cloud-classifications),
[ScienceAlert](https://www.sciencealert.com/it-s-official-there-are-now-12-new-types-of-cloud),
[Smithsonian](https://www.smithsonianmag.com/smart-news/cloud-atlas-adds-first-new-species-almost-70-years-180962654/),
[Weathergamut](https://www.weathergamut.com/2017/03/23/twelve-new-cloud-types-added-to-international-cloud-atlas/),
[WTOC](https://www.wtoc.com/story/35016011/new-cloud-species-added-to-international-cloud-atlas/).
