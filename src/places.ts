import { FUNDY_STONES, STONE_COLORS, type BeachMaterial } from './beach'
import { biomeNamed, climateBiome, type Biome, type Climate, type RGB, type SandStyle, type VegetationKind } from './biome'
import type { OceanName } from './oceans'
import type { CrocodileKind, LizardKind, MonkeyKind, TurtleSpecies } from './props/wildlife'
import type { Random } from './random'

// Places: each day draws one real stretch of coast first (PLAN_BIOMES 1a),
// and biome, ocean, climate and latitude follow from it. Data and weights:
// knowledge/REGIONS.md §1.
//
// A place has three kinds of field:
// - constants: `biome` (the look preset), `region`, the signed `latitude`
//   range (the sign is the hemisphere), `km` of coastline;
// - choose one: `ocean`, `climate`, `material`, `sand` (weighted, drawn on
//   their own streams; `material` and `sand` only where they differ from the
//   biome's, beach.ts and biome.ts);
// - choose many: `animals`, `plants` (pools; each feature's own rules pick
//   from them on the day);
// - `tide`: the mean tidal range, a span the day's beach draws in (tides.ts);
// - `reef`: the chance a beach day has a fringing reef offshore (reef.ts);
// - `coast`: the land kinds' weights, beach or rocky shore (rockShore.ts).
// A region is a group of places sharing defaults and a spec name; it's never
// drawn on its own. A place with no region is its own region. Defaults merge
// biome → region → place.
//
// Weights: √ of the region's coastline length, split among its places by
// length (decision 11): raw length would make ~70% of days Arctic and nordic.
// Result: nordic ≈ 42%, tropical 23%, mediterranean 14%, volcanic 13%,
// desert 9% of days.

export type { Climate }
export const CLIMATES: readonly Climate[] = ['polar', 'boreal', 'temperate', 'mediterranean', 'subtropical', 'tropical', 'arid']

export type Weights<K extends string> = Partial<Record<K, number>>
/** Months (1–12) from–to inclusive; may wrap the year (11–3). */
export type Months = readonly [number, number]

/** A beach animal a place can have. Nesting turtles: in-season entries are
 * weighted against each other; the rest are a chance per day. */
export type Animal =
  | { kind: 'turtle'; species: TurtleSpecies; months?: Months; weight?: number }
  | { kind: 'basking-turtle'; chance: number }
  | { kind: 'monkey'; species: MonkeyKind; chance: number }
  | { kind: 'lizard'; species: LizardKind; chance: number }
  | { kind: 'crocodile'; species: CrocodileKind; chance: number }
  | { kind: 'hippo'; chance: number }

type Plants = Biome['vegetation']
type SandName = SandStyle['name']

interface PlaceRow {
  id: string
  region?: string
  biome: Biome['name']
  /** Signed degrees, south negative. */
  latitude: readonly [number, number]
  km: number
  ocean: Weights<OceanName>
  climate: Weights<Climate>
  animals?: readonly Animal[]
  plants?: Plants
  material?: Weights<BeachMaterial>
  sand?: Weights<SandName>
  stones?: readonly RGB[]
}

/** What a region's places share, unless a place says otherwise. */
interface RegionDefaults {
  animals?: readonly Animal[]
  plants?: Plants
  material?: Weights<BeachMaterial>
  sand?: Weights<SandName>
  stones?: readonly RGB[]
}

export interface Place {
  id: string
  region: string
  biome: Biome['name']
  latitude: readonly [number, number]
  km: number
  /** Share of all days (sums to 1). */
  weight: number
  ocean: Weights<OceanName>
  climate: Weights<Climate>
  animals: readonly Animal[]
  /** The place's own plant pool; unset: the biome's in the day's climate
   * (plantsFor). */
  plants?: Plants
  /** Beach material chances; unset: the biome's (or polar) defaults
   * (beach.ts materialChances). */
  material?: Weights<BeachMaterial>
  /** The place's own sand colour chances; unset: the biome's in the day's
   * climate (sandChances). */
  sand?: Weights<SandName>
  /** Plants that grow leaning downwind (flag trees). */
  windBent: readonly VegetationKind[]
  /** Stone colours (linear albedo). */
  stones: readonly RGB[]
  /** Mean tidal range (m), a span: each day's beach draws one in it (tides.ts). */
  tide: readonly [number, number]
  /** Chance a beach day has a fringing reef offshore (reef.ts). */
  reef: number
  /** What the shore is on land days (not the open sea): a beach, a rocky
   * shore (rockShore.ts) or a tidal flat (tidalFlat.ts; a beach with a salt
   * marsh when the tide is at or above mid). */
  coast: Weights<LandKind>
  /** The mud of a tidal flat near its marsh (linear albedo; tidalFlat.ts). */
  mud: RGB
  /** Mountains or volcanoes can stand behind the coast (pickLandform); not
   * on flat barrier, delta and coral coasts. */
  mountains: boolean
  /** Night-sky darkness, Bortle class (nightGlow.ts). */
  bortle: 1 | 2 | 3 | 4
  /** A savanna coast's dry season, when its grass cures (phenology.ts);
   * unset: green all year. */
  drySeason?: DrySeason
}

export interface DrySeason {
  /** Real calendar months, not the day's season. */
  months: Months
  /** Only between these latitudes (°, signed, south to north); unset: all of
   * the place. */
  latitudeDeg?: readonly [number, number]
  /** A stretch of the place that stays green: the same latitudes as the dry
   * coast, on another ocean. */
  wetCoast?: { ocean: OceanName; latitudeDeg: readonly [number, number] }
}

export type LandKind = 'beach' | 'rock-shore' | 'tidal-flat'

const nest = (species: TurtleSpecies, months?: Months, weight = 1): Animal => ({ kind: 'turtle', species, months, weight })
const monkey = (species: MonkeyKind, chance: number): Animal => ({ kind: 'monkey', species, chance })
const lizard = (species: LizardKind, chance: number): Animal => ({ kind: 'lizard', species, chance })
const croc = (species: CrocodileKind, chance: number): Animal => ({ kind: 'crocodile', species, chance })
const hippo = (chance: number): Animal => ({ kind: 'hippo', chance })

// Region pools reproduce the animals of the old warm-coast regions
// (props/wildlife.ts); places with no pool have none of these animals.
const REGIONS: Record<string, RegionDefaults> = {
  // Greens and hawksbills Apr–Sep, olive ridleys Nov–Mar.
  'se-asia': {
    animals: [nest('green', [4, 9], 0.7), nest('hawksbill', [4, 9], 0.3), nest('olive-ridley', [11, 3]), monkey('macaque', 0.3), lizard('monitor', 0.2), croc('saltwater', 0.12)]
  },
  'central-america': {
    animals: [nest('olive-ridley', [7, 12]), nest('green', [1, 6]), monkey('capuchin', 0.2), lizard('green-iguana', 0.25), croc('american', 0.12)]
  },
  'east-africa': { animals: [nest('green'), monkey('vervet', 0.25), croc('nile', 0.1), hippo(0.04)] },
  // Gabon: the largest leatherback rookery; hippos in Loango and the Bijagós.
  'west-africa': { animals: [nest('leatherback', [10, 3], 0.75), nest('olive-ridley', [10, 3], 0.25), croc('west-african', 0.12), hippo(0.15)] },
  caribbean: {
    animals: [nest('leatherback', [3, 6]), nest('green', [7, 10], 0.7), nest('hawksbill', [7, 10], 0.3), lizard('green-iguana', 0.2), croc('american', 0.08)]
  },
  galapagos: { animals: [nest('green'), lizard('marine-iguana', 0.85)] },
  hawaii: { animals: [{ kind: 'basking-turtle', chance: 0.45 }] },
  'mediterranean-sea': { animals: [nest('loggerhead', [6, 8], 0.85), nest('green', [6, 8], 0.15)] },
  arabia: { animals: [nest('green'), lizard('spiny-tailed', 0.25)] },
  // New places (decision 9).
  'south-asia-islands': { animals: [nest('green', undefined, 0.7), nest('hawksbill', undefined, 0.3)], material: { sand: 95, mixed: 5 } },
  // Saltwater crocodiles across the Top End, Cape York and the Kimberley.
  'north-australia': { animals: [nest('green', [10, 3], 0.7), nest('hawksbill', [10, 3], 0.3), croc('saltwater', 0.15)] },
  'nw-australia': { animals: [nest('green', [11, 3]), croc('saltwater', 0.08)] },
  // PNG and the Solomons have saltwater crocodiles and mangrove monitors; no monkeys.
  'pacific-islands': { animals: [nest('green', [11, 3], 0.7), nest('hawksbill', [11, 3], 0.3), lizard('monitor', 0.08), croc('saltwater', 0.04)] },
  // Odisha's olive-ridley arribadas, Bengal monitors, Bhitarkanika's crocodiles.
  india: { animals: [nest('olive-ridley', [11, 3]), lizard('monitor', 0.1), croc('saltwater', 0.04)] },
  'northeast-brazil': { animals: [nest('loggerhead', [9, 3], 0.5), nest('hawksbill', [9, 3], 0.3), nest('olive-ridley', [9, 3], 0.2)] },
  'florida-carolinas': { animals: [nest('loggerhead', [5, 8], 0.85), nest('green', [5, 8], 0.15)] },
  'horn-of-africa': { animals: [nest('green')] },
  'western-australia-desert': { animals: [nest('green', [11, 3], 0.7), nest('loggerhead', [11, 3], 0.3)] },
  comoros: { animals: [nest('green')] },
  // Beach materials (PLAN_BIOMES phase 2). Temperate shingle coasts: Chesil,
  // the Normandy galets, Nova Scotia's cobble barriers.
  'britain-ireland': { material: { sand: 30, mixed: 25, shingle: 35, cobble: 10 } },
  'brittany-normandy': { material: { sand: 35, mixed: 25, shingle: 30, cobble: 10 } },
  'atlantic-canada': { material: { sand: 25, mixed: 20, shingle: 30, cobble: 25 } }
}

// Places whose beaches differ from their region's or biome's.
const PLACE_MATERIAL: Record<string, Weights<BeachMaterial>> = {
  // Barrier islands of fine quartz sand.
  'wadden-north-sea': { sand: 95, mixed: 5 },
  'florida-carolinas': { sand: 97, mixed: 3 },
  // Red sandstone sand beaches.
  pei: { sand: 85, mixed: 10, shingle: 5 },
  // Sandy in the south (Denmark, Germany, Poland), moraine boulders and
  // shingle in the Swedish and Finnish archipelagos.
  baltic: { sand: 60, mixed: 25, shingle: 10, cobble: 5 },
  // The mediterranean biome's defaults are the Mediterranean Sea's own
  // (Nice, Liguria, Croatia: shingle). Its ocean-facing places are long
  // sand beaches with a few cobble coves.
  'portugal-morocco': { sand: 80, mixed: 10, shingle: 5, cobble: 5 },
  'north-africa-levant': { sand: 80, mixed: 10, shingle: 10 },
  california: { sand: 70, mixed: 10, shingle: 5, cobble: 15 },
  'central-chile': { sand: 80, mixed: 10, cobble: 10 },
  'south-brazil': { sand: 95, mixed: 5 },
  'east-australia': { sand: 95, mixed: 5 },
  'sw-australia': { sand: 95, mixed: 5 },
  natal: { sand: 90, mixed: 5, cobble: 5 },
  cape: { sand: 80, mixed: 10, cobble: 10 },
  'south-japan': { sand: 70, mixed: 15, shingle: 10, cobble: 5 },
  'taiwan-south-china': { sand: 75, mixed: 15, shingle: 5, cobble: 5 },
  'yellow-sea': { sand: 80, mixed: 15, shingle: 5 },
  // Oregon and Washington: long sand beaches between cobble headlands.
  'pacific-northwest': { sand: 65, mixed: 15, cobble: 20 },
  // Siberia's eroding permafrost bluffs shed sand and silt; Alaska's Arctic
  // coast is sand and gravel barrier islands.
  'arctic-russia': { sand: 50, mixed: 25, shingle: 15, cobble: 10 },
  'alaska-north': { sand: 40, mixed: 30, shingle: 30 },
  // Gravel beach ridges round Hudson Bay and the islands; sand and silt on
  // the Beaufort coast by the Mackenzie delta.
  'arctic-canada': { sand: 35, mixed: 25, shingle: 20, cobble: 20 },
  // Black volcanic sand on most of Japan's open coasts.
  japan: { sand: 60, mixed: 15, shingle: 10, cobble: 15 },
  // Coral and quartz sand coasts: no gravel source.
  'bahamas-bermuda': { sand: 97, mixed: 3 },
  'pacific-islands': { sand: 90, mixed: 5, cobble: 5 },
  india: { sand: 95, mixed: 5 },
  'west-africa': { sand: 95, mixed: 5 },
  'northeast-brazil': { sand: 95, mixed: 5 },
  // Coral sand coves between the lava.
  galapagos: { sand: 70, mixed: 10, cobble: 20 },
  hawaii: { sand: 70, mixed: 10, shingle: 5, cobble: 15 }
}

// Plant pools that replace the biome's. They are what grows there, so the
// polar filter (plantsFor) leaves them alone.
const PLACE_PLANTS: Record<string, Plants> = {
  // Magellanic forest of southern beech (lenga, coihue de Magallanes) behind
  // the beaches, bent by the westerlies; no conifers.
  'tierra-del-fuego': [
    ['grass', 6],
    ['broadleaf', 2],
    ['bush', 2]
  ],
  // Tussock grass only.
  'south-georgia': [['grass', 1]]
}
const WIND_BENT: Record<string, readonly VegetationKind[]> = { 'tierra-del-fuego': ['broadleaf'] }

// Sand colours that differ from the biome's (PLAN_BIOMES 3). Rare on purpose
// (decision 4): pink and red beaches are a few named places.
const PLACE_SAND: Record<string, Weights<SandName>> = {
  // Pink coral sand (Homotrema): Bermuda, Harbour Island, the Exumas.
  'bahamas-bermuda': { white: 65, golden: 10, pink: 25 },
  // Komodo's Pink Beach.
  indonesia: { white: 64, golden: 33, pink: 3 },
  // Red sandstone: nearly every PEI beach, the Fundy shore's red mud and sand.
  pei: { red: 60, golden: 25, grey: 15 },
  fundy: { red: 40, grey: 35, golden: 25 },
  // Shell sand (up to ~50% carbonate on the beach, more in the machair
  // behind): the white beaches of the Hebrides and the west of Ireland.
  scotland: { golden: 45, white: 30, grey: 25 },
  ireland: { golden: 55, grey: 30, white: 15 },
  // Maui's Kaihalulu (red cinder).
  hawaii: { black: 64, grey: 32, red: 4 },
  // Iron-red sand under the Hajar and Red Sea hills.
  'oman-yemen': { golden: 65, white: 32, red: 3 },
  'red-sea': { golden: 65, white: 32, red: 3 }
}

// Mean tidal ranges (m) by place or region (REGIONS.md §3; ≈: not checked
// against tide tables); everything else 1–2 m. Springs are × 1.2, neaps × 0.8
// (tides.ts).
const DEFAULT_TIDE = [1, 2] as const
const TIDE: Record<string, readonly [number, number]> = {
  // Micro-tidal seas.
  'mediterranean-sea': [0.1, 0.4],
  caribbean: [0.1, 0.3],
  'bahamas-bermuda': [0.7, 0.9],
  baltic: [0.02, 0.2],
  hawaii: [0.4, 0.7],
  'south-asia-islands': [0.6, 1],
  // Red Sea: near zero at the central amphidrome, ~0.6 m at the ends.
  'red-sea': [0.1, 0.6],
  'persian-gulf': [1, 2.5], // ≈
  california: [1.1, 1.7],
  pei: [0.6, 1.2],
  'alaska-north': [0.1, 0.3], // ≈ Beaufort and Chukchi coasts
  // Norway: an amphidrome off the southwest, the range rising northward.
  'norway-west': [0.3, 1.2],
  'norway-north': [1.5, 2.4],
  'patagonia-fjords': [1.5, 2.5],
  // Meso-tidal.
  'wadden-north-sea': [1.5, 3.5],
  'britain-ireland': [2, 5],
  iceland: [1.5, 3.5],
  'iceland-faroe': [1.5, 3.5],
  svalbard: [1, 3], // ≈
  greenland: [1, 3], // ≈
  'british-columbia': [3, 5], // ≈
  'se-alaska': [3.5, 5],
  'gulf-alaska': [2.5, 4], // ≈
  maine: [2.5, 5], // ≈ Portland ~2.9 m, Eastport ~5.5 m
  'east-africa': [2.5, 3.5], // ≈
  'tierra-del-fuego': [2, 6], // ≈ Beagle Channel small, Atlantic side large
  'baja-sonora': [1, 4], // ≈ Pacific side small, upper Gulf 7–9 m
  // Macro- and mega-tidal.
  brittany: [4, 8],
  'mont-saint-michel': [8, 11],
  'bristol-channel': [8, 11],
  'morecambe-bay': [6, 8], // ≈
  fundy: [6, 12],
  'cook-inlet': [7, 9.5],
  'yellow-sea': [5, 8],
  'nw-australia': [5, 9]
}

// Dry seasons of savanna coasts (SEASONS.md §2.2). Where a place also holds
// wetter coasts, the latitudes keep them green: the Chocó, Kenya's two rains,
// Recife and Salvador, Tamil Nadu and Kerala, the wet side of Indonesia.
const DRY_SEASON: Record<string, DrySeason> = {
  // Queensland's wet tropics (Cooktown to Cardwell) stay green; Townsville dries.
  'north-australia': { months: [5, 10], wetCoast: { ocean: 'pacific', latitudeDeg: [-18.5, -15.5] } },
  'nw-australia': { months: [5, 10] },
  'west-africa': { months: [11, 4], latitudeDeg: [5, 15] },
  'central-america': { months: [12, 4], latitudeDeg: [9, 20] },
  'east-africa': { months: [5, 10], latitudeDeg: [-26, -10] },
  'northeast-brazil': { months: [8, 12], latitudeDeg: [-5, -3] },
  india: { months: [12, 5], latitudeDeg: [15, 22] },
  indonesia: { months: [5, 10], latitudeDeg: [-11, -8] }
}

// Fringing reefs (PLAN_BIOMES 7; COASTS.md "Reef-fronted beaches"), by place
// or region; none elsewhere. Islands of carbonate sand and clear water are
// mostly reef-fronted; continental coasts much less (river mud and sand,
// upwelling: West Africa and India have almost none). Hawaii's young islands
// have little fringing reef (Oahu, Molokai, Kauai's north shore).
const REEF: Record<string, number> = {
  maldives: 0.95,
  'andaman-lakshadweep': 0.75,
  'sri-lanka': 0.35,
  'pacific-islands': 0.8,
  philippines: 0.7,
  indonesia: 0.65,
  'mainland-se-asia': 0.25,
  'north-australia': 0.4,
  'nw-australia': 0.1,
  antilles: 0.65,
  'bahamas-bermuda': 0.8,
  'yucatan-belize': 0.6,
  'central-america': 0.15,
  'east-africa': 0.45,
  // Recife's sandstone and coral reefs along Pernambuco and Alagoas.
  'northeast-brazil': 0.3,
  india: 0.05,
  'reunion-mauritius': 0.6,
  comoros: 0.4,
  'lesser-antilles-volcanic': 0.25,
  hawaii: 0.2,
  'red-sea': 0.2,
  // Ningaloo.
  'western-australia-desert': 0.1
}

// Rocky shores (PLAN_BIOMES 8; plans/ROCK_SHORE.md): the share of land days
// whose shore is rock, by place or region, else by biome. About a third of
// the world's coast is rock and half is cliff-backed (Coastal Wiki); glaciated
// and fjord coasts, the North Atlantic and North Pacific most; barrier-island,
// tidal-flat and sandy coasts least.
const ROCK_BY_BIOME: Record<Biome['name'], number> = { nordic: 0.45, volcanic: 0.45, mediterranean: 0.3, desert: 0.2, tropical: 0.15 }
const ROCK: Record<string, number> = {
  // Fjords, skerries and glaciated rock.
  'norway-west': 0.55,
  'norway-north': 0.55,
  greenland: 0.55,
  svalbard: 0.55,
  'british-columbia': 0.55,
  'se-alaska': 0.55,
  'gulf-alaska': 0.55,
  'patagonia-fjords': 0.55,
  'tierra-del-fuego': 0.55,
  'south-georgia': 0.55,
  'new-zealand-south': 0.55,
  tasmania: 0.55,
  // North Atlantic granite and slate: Newfoundland, Peggy's Cove, Maine,
  // Scotland, the west of Ireland, Cornwall, Brittany, Iceland.
  newfoundland: 0.55,
  'nova-scotia': 0.55,
  maine: 0.55,
  scotland: 0.55,
  ireland: 0.55,
  'cornwall-wales': 0.55,
  brittany: 0.55,
  'iceland-faroe': 0.55,
  iceland: 0.55,
  // Big Sur, the Chilean coast, the Kurils; lava coasts.
  california: 0.55,
  'central-chile': 0.55,
  'kamchatka-kurils-aleutians': 0.55,
  hawaii: 0.55,
  canaries: 0.55,
  'azores-madeira': 0.6,
  galapagos: 0.6,
  // Limestone and flysch: the Mediterranean's rocky half, the Algarve, the Cape.
  'mediterranean-sea': 0.4,
  'portugal-morocco': 0.4,
  cape: 0.4,
  'pacific-northwest': 0.4,
  fundy: 0.4,
  'bristol-channel': 0.4,
  // Skerry archipelagos in Sweden and Finland, sand in the south.
  baltic: 0.4,
  'atacama-peru': 0.35,
  'baja-sonora': 0.3,
  // Low permafrost bluffs and gravel.
  'arctic-russia': 0.25,
  // Barrier islands, tidal flats and sand.
  'north-africa-levant': 0.2,
  'florida-carolinas': 0.1,
  'wadden-north-sea': 0.1,
  pei: 0.1,
  'morecambe-bay': 0.1,
  'mont-saint-michel': 0.1,
  'alaska-north': 0.1,
  namibia: 0.15
}

// Tidal flats (PLAN_BIOMES 9; plans/TIDAL_FLAT.md): the share of land days
// whose shore is a tidal flat, in meso- and macro-tidal places with flats
// (the Wadden mainland coast, Morecambe Bay, the bay of Mont-Saint-Michel,
// Korea's west coast; Fundy's Minas Basin among its cliffs). Only when the
// tide is below mid; at or above it the day is a beach with a salt marsh.
const FLAT: Record<string, number> = {
  'wadden-north-sea': 0.5,
  'morecambe-bay': 0.5,
  'mont-saint-michel': 0.5,
  'yellow-sea': 0.45,
  fundy: 0.25
}

// Tidal-flat mud (PLAN_BIOMES 9; plans/TIDAL_FLAT.md), linear albedo: grey-
// brown silt and clay, Fundy's red-brown from the Triassic red beds,
// Mont-Saint-Michel's pale grey tangue (shell-rich silt).
const DEFAULT_MUD: RGB = [0.16, 0.14, 0.11]
const MUD: Record<string, RGB> = {
  fundy: [0.22, 0.11, 0.07],
  'mont-saint-michel': [0.19, 0.18, 0.16],
  'yellow-sea': [0.17, 0.14, 0.1]
}

// Night-sky darkness on the Bortle scale (NIGHT_SKY phase 3, STARS.md §9),
// for a wild beach of the place, not its towns: 1 the polar and desert
// coasts and remote islands, 2 (the default) thinly settled coasts, 3 coasts
// with towns along them (light domes on the horizon), 4 the densely lit
// shores (the North Sea, the Mediterranean, Florida, east Asia, the Gulf).
// From the world atlas of artificial sky brightness's broad pattern
// (general; not read place by place).
const BORTLE: Record<string, 1 | 2 | 3 | 4> = {
  'arctic-canada': 1, greenland: 1, 'arctic-russia': 1, svalbard: 1, 'alaska-north': 1, 'se-alaska': 1, 'gulf-alaska': 1,
  'russian-far-east': 1, 'kamchatka-kurils-aleutians': 1, 'new-zealand-south': 1, 'patagonia-fjords': 1, 'tierra-del-fuego': 1,
  'south-georgia': 1, falklands: 1, 'south-shetland': 1, 'south-sandwich': 1, 'kerguelen-heard': 1, 'nz-subantarctic': 1,
  galapagos: 1, 'horn-of-africa': 1, 'western-australia-desert': 1, 'nw-australia': 1, 'north-australia': 1,
  'sahara-atlantic': 1, namibia: 1,
  'cornwall-wales': 3, brittany: 3, baltic: 3, maine: 3, pei: 3, 'pacific-northwest': 3, 'east-australia': 3, 'south-brazil': 3,
  'central-chile': 3, cape: 3, natal: 3, india: 3, 'sri-lanka': 3, 'mainland-se-asia': 3, indonesia: 3, philippines: 3,
  antilles: 3, 'yucatan-belize': 3, canaries: 3, 'reunion-mauritius': 3, 'red-sea': 3, 'northeast-brazil': 3, 'west-africa': 3,
  'lesser-antilles-volcanic': 3, japan: 3, 'portugal-morocco': 3, 'sumatra-java-south': 3, aegean: 3, california: 3,
  'wadden-north-sea': 4, 'bristol-channel': 4, 'morecambe-bay': 4, 'mont-saint-michel': 4, 'western-med': 4, adriatic: 4,
  'north-africa-levant': 4, 'florida-carolinas': 4, 'south-japan': 4, 'taiwan-south-china': 4, 'yellow-sea': 4, 'persian-gulf': 4
}

// Flat hinterlands: no mountain range or volcano in view (the barrier islands
// of Florida and the Carolinas, the Wadden and Baltic lowlands, coral
// platforms, the Persian Gulf and Libyan coasts, the Arctic coastal plains).
const FLAT_LAND = new Set([
  'florida-carolinas',
  'wadden-north-sea',
  'baltic',
  'pei',
  'mont-saint-michel',
  'bahamas-bermuda',
  'maldives',
  'yucatan-belize',
  'persian-gulf',
  'north-africa-levant',
  'alaska-north',
  'arctic-russia'
])

/** Every place, from REGIONS.md §1. Animals listed on a row replace the
 * region's. */
const ROWS: readonly PlaceRow[] = [

  // Nordic
  { id: 'norway-west', region: 'norway', biome: 'nordic', latitude: [58, 64], km: 40_000, ocean: { atlantic: 1 }, climate: { temperate: 1 } }, // Stavanger to Trøndelag
  { id: 'norway-north', region: 'norway', biome: 'nordic', latitude: [64, 71], km: 43_000, ocean: { atlantic: 70, arctic: 30 }, climate: { boreal: 80, polar: 20 } }, // Nordland, Lofoten, Troms, Finnmark
  { id: 'scotland', region: 'britain-ireland', biome: 'nordic', latitude: [55, 59], km: 6_000, ocean: { atlantic: 1 }, climate: { temperate: 1 } }, // Scotland, Hebrides, Orkney, Shetland
  { id: 'ireland', region: 'britain-ireland', biome: 'nordic', latitude: [51, 55], km: 1_700, ocean: { atlantic: 1 }, climate: { temperate: 1 } }, // Ireland
  { id: 'cornwall-wales', region: 'britain-ireland', biome: 'nordic', latitude: [50, 53], km: 2_500, ocean: { atlantic: 1 }, climate: { temperate: 1 } }, // Cornwall, Wales
  { id: 'bristol-channel', region: 'britain-ireland', biome: 'nordic', latitude: [51, 51], km: 500, ocean: { atlantic: 1 }, climate: { temperate: 1 } }, // Bristol Channel
  { id: 'morecambe-bay', region: 'britain-ireland', biome: 'nordic', latitude: [54, 54], km: 300, ocean: { atlantic: 1 }, climate: { temperate: 1 } }, // Morecambe Bay
  { id: 'newfoundland', region: 'atlantic-canada', biome: 'nordic', latitude: [46, 52], km: 9_600, ocean: { atlantic: 1 }, climate: { boreal: 70, temperate: 30 } }, // Newfoundland, Labrador south
  { id: 'nova-scotia', region: 'atlantic-canada', biome: 'nordic', latitude: [43, 47], km: 7_400, ocean: { atlantic: 1 }, climate: { temperate: 70, boreal: 30 } }, // Nova Scotia Atlantic shore, Gulf of St Lawrence
  { id: 'fundy', region: 'atlantic-canada', biome: 'nordic', latitude: [44, 46], km: 1_500, ocean: { atlantic: 1 }, climate: { temperate: 1 }, stones: FUNDY_STONES }, // Bay of Fundy
  { id: 'pei', region: 'atlantic-canada', biome: 'nordic', latitude: [46, 47], km: 1_100, ocean: { atlantic: 1 }, climate: { temperate: 1 } }, // Prince Edward Island, Northumberland Strait
  { id: 'maine', region: 'atlantic-canada', biome: 'nordic', latitude: [43, 45], km: 5_600, ocean: { atlantic: 1 }, climate: { temperate: 1 } }, // Maine
  { id: 'baltic', biome: 'nordic', latitude: [54, 66], km: 10_000, ocean: { atlantic: 1 }, climate: { boreal: 70, temperate: 30 } }, // Sweden, Finland, Estonia, Danish islands
  { id: 'wadden-north-sea', biome: 'nordic', latitude: [52, 57], km: 3_000, ocean: { atlantic: 1 }, climate: { temperate: 1 } }, // Netherlands, Germany, Denmark North Sea
  { id: 'brittany', region: 'brittany-normandy', biome: 'nordic', latitude: [47, 49], km: 2_700, ocean: { atlantic: 1 }, climate: { temperate: 1 } }, // Brittany, Normandy coast
  { id: 'mont-saint-michel', region: 'brittany-normandy', biome: 'nordic', latitude: [48, 49], km: 300, ocean: { atlantic: 1 }, climate: { temperate: 1 } }, // Saint-Malo, Mont-Saint-Michel, Chausey
  { id: 'iceland-faroe', biome: 'nordic', latitude: [62, 66], km: 3_600, ocean: { atlantic: 1 }, climate: { boreal: 60, temperate: 40 } }, // Iceland's non-volcanic beaches, Faroes
  { id: 'arctic-canada', biome: 'nordic', latitude: [58, 78], km: 150_000, ocean: { arctic: 1 }, climate: { polar: 1 } }, // Canadian Arctic Archipelago, Hudson Bay, Ungava
  { id: 'greenland', biome: 'nordic', latitude: [60, 78], km: 44_000, ocean: { arctic: 70, atlantic: 30 }, climate: { polar: 1 } }, // Greenland west and east coasts
  { id: 'arctic-russia', biome: 'nordic', latitude: [66, 78], km: 25_000, ocean: { arctic: 1 }, climate: { polar: 1 } }, // Kola, White Sea, Siberian coast
  { id: 'svalbard', biome: 'nordic', latitude: [76, 80], km: 3_600, ocean: { arctic: 1 }, climate: { polar: 1 } }, // Svalbard
  { id: 'alaska-north', region: 'alaska', biome: 'nordic', latitude: [69, 71], km: 1_700, ocean: { arctic: 1 }, climate: { polar: 1 } }, // Alaska's Arctic coast (Beaufort, Chukchi)
  { id: 'se-alaska', region: 'alaska', biome: 'nordic', latitude: [54, 59], km: 3_000, ocean: { pacific: 1 }, climate: { temperate: 60, boreal: 40 } }, // SE Alaska Inside Passage
  { id: 'gulf-alaska', region: 'alaska', biome: 'nordic', latitude: [56, 61], km: 5_000, ocean: { pacific: 1 }, climate: { boreal: 1 } }, // Gulf of Alaska, Kodiak
  { id: 'cook-inlet', region: 'alaska', biome: 'nordic', latitude: [59, 61], km: 700, ocean: { pacific: 1 }, climate: { boreal: 1 } }, // Cook Inlet, Turnagain Arm
  { id: 'british-columbia', biome: 'nordic', latitude: [48, 55], km: 26_000, ocean: { pacific: 1 }, climate: { temperate: 1 } }, // BC outer coast and fjords, Haida Gwaii
  { id: 'pacific-northwest', biome: 'nordic', latitude: [42, 48], km: 1_500, ocean: { pacific: 1 }, climate: { temperate: 1 } }, // Washington, Oregon
  { id: 'russian-far-east', biome: 'nordic', latitude: [48, 60], km: 8_000, ocean: { pacific: 1 }, climate: { boreal: 1 } }, // Okhotsk Sea, Sakhalin
  { id: 'new-zealand-south', biome: 'nordic', latitude: [-47, -41], km: 6_000, ocean: { pacific: 1 }, climate: { temperate: 1 } }, // NZ South Island
  { id: 'patagonia-fjords', biome: 'nordic', latitude: [-55, -42], km: 5_000, ocean: { southern: 70, pacific: 30 }, climate: { temperate: 1 } }, // Chilean fjords, Patagonia
  { id: 'tierra-del-fuego', biome: 'nordic', latitude: [-56, -53], km: 1_500, ocean: { southern: 1 }, climate: { temperate: 70, polar: 30 } }, // Tierra del Fuego, Beagle Channel
  { id: 'tasmania', biome: 'nordic', latitude: [-44, -41], km: 1_500, ocean: { southern: 1 }, climate: { temperate: 1 } }, // Tasmania's south and west coasts
  { id: 'south-georgia', region: 'south-georgia-falklands', biome: 'nordic', latitude: [-55, -54], km: 1_000, ocean: { southern: 1 }, climate: { polar: 1 } }, // South Georgia
  { id: 'falklands', region: 'south-georgia-falklands', biome: 'nordic', latitude: [-52, -51], km: 1_300, ocean: { southern: 60, atlantic: 40 }, climate: { temperate: 1 } }, // Falklands

  // Mediterranean
  { id: 'aegean', region: 'mediterranean-sea', biome: 'mediterranean', latitude: [35, 41], km: 19_000, ocean: { atlantic: 1 }, climate: { mediterranean: 1 } }, // Greece, Aegean Turkey, Cyprus
  { id: 'adriatic', region: 'mediterranean-sea', biome: 'mediterranean', latitude: [40, 46], km: 9_000, ocean: { atlantic: 1 }, climate: { mediterranean: 70, subtropical: 30 } }, // Croatia, Adriatic Italy, Albania, Montenegro
  { id: 'western-med', region: 'mediterranean-sea', biome: 'mediterranean', latitude: [36, 44], km: 10_000, ocean: { atlantic: 1 }, climate: { mediterranean: 1 } }, // Mediterranean Spain and France, Tyrrhenian Italy, Corsica, Sardinia, Sicily
  { id: 'north-africa-levant', region: 'mediterranean-sea', biome: 'mediterranean', latitude: [31, 37], km: 6_000, ocean: { atlantic: 1 }, climate: { mediterranean: 1 } }, // Tunisia, Libya, Egypt, Levant, Algeria
  { id: 'portugal-morocco', biome: 'mediterranean', latitude: [30, 43], km: 5_000, ocean: { atlantic: 1 }, climate: { mediterranean: 80, temperate: 20 } }, // Portugal, Atlantic Spain, Atlantic Morocco
  { id: 'florida-carolinas', biome: 'mediterranean', latitude: [25, 35], km: 3_000, ocean: { atlantic: 1 }, climate: { subtropical: 1 } }, // Florida, Georgia, Carolinas (barrier islands)
  { id: 'south-brazil', biome: 'mediterranean', latitude: [-35, -25], km: 2_000, ocean: { atlantic: 1 }, climate: { subtropical: 1 } }, // South Brazil, Uruguay
  { id: 'california', biome: 'mediterranean', latitude: [32, 42], km: 1_400, ocean: { pacific: 1 }, climate: { mediterranean: 1 } }, // California
  { id: 'central-chile', biome: 'mediterranean', latitude: [-38, -30], km: 1_400, ocean: { pacific: 1 }, climate: { mediterranean: 1 } }, // Central Chile
  { id: 'east-australia', biome: 'mediterranean', latitude: [-35, -25], km: 2_500, ocean: { pacific: 1 }, climate: { subtropical: 1 } }, // Southern Queensland, NSW
  { id: 'south-japan', region: 'east-asia-subtropical', biome: 'mediterranean', latitude: [26, 35], km: 10_000, ocean: { pacific: 1 }, climate: { subtropical: 1 } }, // Kyushu, Shikoku, south Honshu, Okinawa
  { id: 'taiwan-south-china', region: 'east-asia-subtropical', biome: 'mediterranean', latitude: [22, 26], km: 6_000, ocean: { pacific: 1 }, climate: { subtropical: 1 } }, // Taiwan, Hong Kong, Matsu, South China coast
  { id: 'yellow-sea', region: 'east-asia-subtropical', biome: 'mediterranean', latitude: [34, 38], km: 5_000, ocean: { pacific: 1 }, climate: { temperate: 60, subtropical: 40 } }, // Korea's west coast, Incheon
  { id: 'sw-australia', biome: 'mediterranean', latitude: [-35, -30], km: 2_500, ocean: { indian: 1 }, climate: { mediterranean: 1 } }, // Perth, Margaret River, Esperance
  { id: 'cape', biome: 'mediterranean', latitude: [-35, -33], km: 1_000, ocean: { indian: 60, atlantic: 40 }, climate: { mediterranean: 1 } }, // Western and Southern Cape
  { id: 'natal', biome: 'mediterranean', latitude: [-31, -25], km: 1_500, ocean: { indian: 1 }, climate: { subtropical: 1 } }, // KwaZulu-Natal, south Mozambique

  // Tropical
  { id: 'philippines', region: 'se-asia', biome: 'tropical', latitude: [5, 19], km: 36_000, ocean: { pacific: 1 }, climate: { tropical: 1 } }, // Philippines
  { id: 'indonesia', region: 'se-asia', biome: 'tropical', latitude: [-11, 6], km: 54_700, ocean: { pacific: 50, indian: 50 }, climate: { tropical: 1 } }, // Indonesia
  { id: 'mainland-se-asia', region: 'se-asia', biome: 'tropical', latitude: [1, 21], km: 9_000, ocean: { pacific: 60, indian: 40 }, climate: { tropical: 1 } }, // Vietnam, Thailand, Malaysia
  { id: 'pacific-islands', biome: 'tropical', latitude: [-23, 10], km: 23_000, ocean: { pacific: 1 }, climate: { tropical: 1 } }, // PNG, Solomons, Vanuatu, Fiji, Samoa, Tahiti, Micronesia
  { id: 'central-america', biome: 'tropical', latitude: [2, 20], km: 8_000, ocean: { pacific: 1 }, climate: { tropical: 1 } }, // Pacific Mexico (tropical), Costa Rica, Panama, Colombia
  { id: 'india', biome: 'tropical', latitude: [8, 22], km: 7_000, ocean: { indian: 1 }, climate: { tropical: 1 } }, // India's west and east coasts
  { id: 'maldives', region: 'south-asia-islands', biome: 'tropical', latitude: [-1, 7], km: 650, ocean: { indian: 1 }, climate: { tropical: 1 } }, // Maldives
  { id: 'sri-lanka', region: 'south-asia-islands', biome: 'tropical', latitude: [6, 10], km: 1_300, ocean: { indian: 1 }, climate: { tropical: 1 } }, // Sri Lanka
  { id: 'andaman-lakshadweep', region: 'south-asia-islands', biome: 'tropical', latitude: [8, 14], km: 1_900, ocean: { indian: 1 }, climate: { tropical: 1 } }, // Andaman, Nicobar, Lakshadweep
  { id: 'east-africa', biome: 'tropical', latitude: [-26, -1], km: 9_000, ocean: { indian: 1 }, climate: { tropical: 1 } }, // Kenya, Tanzania, Mozambique, Madagascar
  { id: 'north-australia', biome: 'tropical', latitude: [-23, -10], km: 10_000, ocean: { pacific: 50, indian: 50 }, climate: { tropical: 1 } }, // Top End, Cape York, Great Barrier Reef coast
  { id: 'nw-australia', biome: 'tropical', latitude: [-20, -13], km: 7_000, ocean: { indian: 1 }, climate: { tropical: 1 } }, // Kimberley, Broome
  { id: 'antilles', region: 'caribbean', biome: 'tropical', latitude: [12, 23], km: 10_000, ocean: { atlantic: 1 }, climate: { tropical: 1 } }, // Greater and Lesser Antilles
  { id: 'yucatan-belize', region: 'caribbean', biome: 'tropical', latitude: [16, 21], km: 1_800, ocean: { atlantic: 1 }, climate: { tropical: 1 } }, // Yucatán, Belize, Holbox
  { id: 'bahamas-bermuda', region: 'caribbean', biome: 'tropical', latitude: [21, 32], km: 4_000, ocean: { atlantic: 1 }, climate: { tropical: 1 } }, // Bahamas, Turks and Caicos, Bermuda
  { id: 'west-africa', biome: 'tropical', latitude: [-5, 15], km: 6_500, ocean: { atlantic: 1 }, climate: { tropical: 1 } }, // Senegal to Gabon, Bijagós, Loango
  { id: 'northeast-brazil', biome: 'tropical', latitude: [-15, -3], km: 3_500, ocean: { atlantic: 1 }, climate: { tropical: 1 } }, // Bahia to Ceará

  // Volcanic
  { id: 'hawaii', biome: 'volcanic', latitude: [19, 22], km: 1_200, ocean: { pacific: 1 }, climate: { tropical: 1 } }, // Hawaiian Islands
  { id: 'galapagos', biome: 'volcanic', latitude: [-1, 1], km: 1_300, ocean: { pacific: 1 }, climate: { tropical: 1 } }, // Galápagos
  { id: 'japan', biome: 'volcanic', latitude: [31, 43], km: 15_000, ocean: { pacific: 1 }, climate: { temperate: 70, subtropical: 30 } }, // Honshu, Kyushu volcanic coasts, Izu Islands, Hokkaido
  { id: 'kamchatka-kurils-aleutians', region: 'kamchatka-kurils', biome: 'volcanic', latitude: [43, 60], km: 6_000, ocean: { pacific: 1 }, climate: { boreal: 1 } }, // Kamchatka, Kurils, Aleutians
  { id: 'new-zealand-north', biome: 'volcanic', latitude: [-40, -36], km: 4_000, ocean: { pacific: 1 }, climate: { subtropical: 50, temperate: 50 } }, // Taranaki, Bay of Plenty, Auckland
  { id: 'iceland', biome: 'volcanic', latitude: [63, 66], km: 2_500, ocean: { atlantic: 1 }, climate: { boreal: 1 } }, // Reynisfjara, Snæfellsnes
  { id: 'canaries', biome: 'volcanic', latitude: [27, 29], km: 1_600, ocean: { atlantic: 1 }, climate: { subtropical: 1 } }, // Canary Islands
  { id: 'azores-madeira', biome: 'volcanic', latitude: [32, 39], km: 1_100, ocean: { atlantic: 1 }, climate: { subtropical: 1 } }, // Azores, Madeira
  { id: 'lesser-antilles-volcanic', biome: 'volcanic', latitude: [13, 17], km: 1_800, ocean: { atlantic: 1 }, climate: { tropical: 1 } }, // Montserrat, St Lucia, Martinique, Cape Verde
  { id: 'reunion-mauritius', biome: 'volcanic', latitude: [-21, -20], km: 400, ocean: { indian: 1 }, climate: { tropical: 1 } }, // Réunion, Mauritius
  { id: 'comoros', biome: 'volcanic', latitude: [-13, -11], km: 340, ocean: { indian: 1 }, climate: { tropical: 1 } }, // Comoros
  { id: 'sumatra-java-south', biome: 'volcanic', latitude: [-9, -6], km: 2_500, ocean: { indian: 1 }, climate: { tropical: 1 } }, // Indian Ocean coasts of Java and Sumatra
  { id: 'south-shetland', biome: 'volcanic', latitude: [-63, -62], km: 1_000, ocean: { southern: 1 }, climate: { polar: 1 } }, // Deception Island, South Shetlands
  { id: 'south-sandwich', biome: 'volcanic', latitude: [-60, -56], km: 300, ocean: { southern: 1 }, climate: { polar: 1 } }, // South Sandwich Islands
  { id: 'kerguelen-heard', biome: 'volcanic', latitude: [-53, -49], km: 2_900, ocean: { southern: 1 }, climate: { polar: 1 } }, // Kerguelen, Heard Island
  { id: 'nz-subantarctic', biome: 'volcanic', latitude: [-53, -50], km: 500, ocean: { southern: 1 }, climate: { temperate: 50, polar: 50 } }, // Auckland, Campbell Islands

  // Desert
  { id: 'red-sea', region: 'arabia', biome: 'desert', latitude: [13, 28], km: 4_500, ocean: { indian: 1 }, climate: { arid: 1 } }, // Red Sea coasts (Egypt, Saudi Arabia, Sudan)
  { id: 'oman-yemen', region: 'arabia', biome: 'desert', latitude: [12, 24], km: 4_000, ocean: { indian: 1 }, climate: { arid: 1 } }, // Oman, Yemen
  { id: 'persian-gulf', region: 'arabia', biome: 'desert', latitude: [24, 30], km: 4_800, ocean: { indian: 1 }, climate: { arid: 1 } }, // UAE, Qatar, Kuwait, Bahrain, Saudi Gulf, south Iran
  { id: 'horn-of-africa', biome: 'desert', latitude: [-2, 18], km: 5_500, ocean: { indian: 1 }, climate: { arid: 1 } }, // Somalia, Eritrea, Djibouti
  { id: 'western-australia-desert', biome: 'desert', latitude: [-27, -20], km: 4_000, ocean: { indian: 1 }, climate: { arid: 1 } }, // Shark Bay, Ningaloo, Pilbara
  { id: 'atacama-peru', biome: 'desert', latitude: [-27, -5], km: 3_900, ocean: { pacific: 1 }, climate: { arid: 1 } }, // Atacama, Peru
  { id: 'baja-sonora', biome: 'desert', latitude: [23, 31], km: 4_500, ocean: { pacific: 1 }, climate: { arid: 1 } }, // Baja California, Gulf of California
  { id: 'sahara-atlantic', biome: 'desert', latitude: [18, 29], km: 2_400, ocean: { atlantic: 1 }, climate: { arid: 1 } }, // Mauritania, Western Sahara, south Morocco
  { id: 'namibia', biome: 'desert', latitude: [-29, -17], km: 2_000, ocean: { atlantic: 1 }, climate: { arid: 1 } }, // Skeleton Coast, Walvis Bay
]

// Overrides of the region pools.
const PLACE_ANIMALS: Record<string, readonly Animal[]> = {
  // Bermuda and the Bahamas: turtles, but no green iguanas or crocodiles.
  'bahamas-bermuda': [nest('green', [6, 10], 0.7), nest('hawksbill', [6, 10], 0.3)],
  maldives: [nest('green', undefined, 0.7), nest('hawksbill', undefined, 0.3)],
  // Toque macaques, water monitors, mugger and saltwater crocodiles.
  'sri-lanka': [nest('green', undefined, 0.7), nest('hawksbill', undefined, 0.3), monkey('macaque', 0.1), lizard('monitor', 0.15), croc('saltwater', 0.05)],
  'andaman-lakshadweep': [nest('green', undefined, 0.7), nest('hawksbill', undefined, 0.3), lizard('monitor', 0.1), croc('saltwater', 0.08)]
}

function resolve(): Place[] {
  const regionKm = new Map<string, number>()
  for (const row of ROWS) regionKm.set(row.region ?? row.id, (regionKm.get(row.region ?? row.id) ?? 0) + row.km)
  const raw = ROWS.map(row => {
    const region = row.region ?? row.id
    const km = regionKm.get(region)!
    return { row, region, weight: (Math.sqrt(km) * row.km) / km }
  })
  const total = raw.reduce((sum, r) => sum + r.weight, 0)
  return raw.map(({ row, region, weight }) => {
    const defaults = REGIONS[region] ?? {}
    return {
      id: row.id,
      region,
      biome: row.biome,
      latitude: row.latitude,
      km: row.km,
      weight: weight / total,
      ocean: row.ocean,
      climate: row.climate,
      animals: row.animals ?? PLACE_ANIMALS[row.id] ?? defaults.animals ?? [],
      plants: row.plants ?? PLACE_PLANTS[row.id] ?? defaults.plants,
      windBent: WIND_BENT[row.id] ?? [],
      material: row.material ?? PLACE_MATERIAL[row.id] ?? defaults.material,
      sand: row.sand ?? PLACE_SAND[row.id] ?? defaults.sand,
      stones: row.stones ?? defaults.stones ?? STONE_COLORS[row.biome],
      tide: TIDE[row.id] ?? TIDE[region] ?? DEFAULT_TIDE,
      reef: REEF[row.id] ?? REEF[region] ?? 0,
      coast: landKinds(ROCK[row.id] ?? ROCK[region] ?? ROCK_BY_BIOME[row.biome], FLAT[row.id] ?? 0),
      mud: MUD[row.id] ?? DEFAULT_MUD,
      mountains: !FLAT_LAND.has(row.id),
      bortle: BORTLE[row.id] ?? BORTLE[region] ?? 2,
      drySeason: DRY_SEASON[row.id]
    }
  })
}

function landKinds(rock: number, flat: number): Weights<LandKind> {
  return flat > 0 ? { beach: 1 - rock - flat, 'rock-shore': rock, 'tidal-flat': flat } : { beach: 1 - rock, 'rock-shore': rock }
}

export const PLACES: readonly Place[] = resolve()
export const REGION_IDS: readonly string[] = [...new Set(PLACES.map(p => p.region))]

/** The coast's word in titles (decision 2): the climate ("temperate
 * shingle beach", "subtropical beach"), except where the biome says more:
 * volcanic coasts keep their name, arid ones are deserts. */
export function climateTitle(biome: Biome['name'], climate: Climate): string {
  if (biome === 'volcanic') return 'volcanic'
  return climate === 'arid' ? 'desert' : climate
}

/** The place called `id`. */
export function placeNamed(id: string): Place {
  const place = PLACES.find(p => p.id === id)
  if (place == null) throw new Error(`no place ${JSON.stringify(id)}`)
  return place
}

/** Above this latitude the Arctic has no birch trees: only dwarf willow and
 * birch under 30 cm, which read as grass and bush (Svalbard, the high
 * Canadian Arctic, north Greenland). */
export const HIGH_ARCTIC_DEG = 74

/** The place's biome as it looks in `climate` (biome.ts climateBiome). */
export function placeBiome(place: Place, climate: Climate): Biome {
  return climateBiome(biomeNamed(place.biome), climate)
}

/** The day's sand colour chances: the place's own, else its biome's in the
 * climate (pale quartz on subtropical coasts). */
export function sandChances(place: Place, climate: Climate): Weights<SandName> {
  return place.sand ?? placeBiome(place, climate).sands
}

/** The day's plant pool: the place's own (already what grows there), else
 * its biome's in the climate. On polar water or in a polar climate, tundra:
 * grass and shrubs, and birch in the low Arctic. */
export function plantsFor(place: Place, climate: Climate, polar: 'arctic' | 'southern' | null, latitudeDeg: number): Plants {
  if (place.plants != null) return place.plants
  const pool = placeBiome(place, climate).vegetation
  if (polar == null && climate !== 'polar') return pool
  const arctic = polar === 'arctic' || (polar == null && latitudeDeg > 0)
  const hardy: VegetationKind[] = arctic && Math.abs(latitudeDeg) < HIGH_ARCTIC_DEG ? ['grass', 'bush', 'birch'] : ['grass', 'bush']
  const plants = pool.filter(([kind]) => hardy.includes(kind))
  return plants.length > 0 ? plants : [['grass', 1]]
}

/** What a scene spec can ask of the place. */
export interface PlaceSpec {
  /** A place id, or a region id (any of its places). */
  place?: string
  biome?: Biome['name']
  ocean?: OceanName
  climate?: Climate
}

const has = <K extends string>(weights: Weights<K>, key: K): boolean => (weights[key] ?? 0) > 0

/** The places a spec allows; throws when none does. */
export function placesFor(spec: PlaceSpec): readonly Place[] {
  if (spec.place == null && spec.biome == null && spec.ocean == null && spec.climate == null) return PLACES
  const list = PLACES.filter(
    p =>
      (spec.place == null || p.id === spec.place || p.region === spec.place) &&
      (spec.biome == null || p.biome === spec.biome) &&
      (spec.ocean == null || has(p.ocean, spec.ocean)) &&
      (spec.climate == null || has(p.climate, spec.climate))
  )
  if (list.length === 0) {
    const asked = (['place', 'biome', 'ocean', 'climate'] as const).filter(k => spec[k] != null).map(k => `${k} ${JSON.stringify(spec[k])}`)
    throw new Error(`scene spec: no place has ${asked.join(', ')}`)
  }
  return list
}

/** The day's place: one draw from `rng` (the main stream's first), among the
 * places the spec allows. A restricted spec still makes exactly one draw. */
export function pickPlace(rng: Random, spec: PlaceSpec = {}): Place {
  const list = placesFor(spec)
  return rng.weighted(list.map(p => [p, p.weight] as const))
}

/** A choose-one field: drawn from the place's weights, then forced. */
export function choose<K extends string>(rng: Random, weights: Weights<K>, force?: K): K {
  const drawn = rng.weighted(Object.entries(weights) as [K, number][])
  return force ?? drawn
}

/** Latitude within the place's range (signed). */
export function latitudeIn(place: Place, rng: Random): number {
  return rng.range(place.latitude[0], place.latitude[1])
}

/** Is `month` (1–12) within `months`, wrapping the year? */
export const inMonths = (month: number, [from, to]: Months): boolean =>
  from <= to ? month >= from && month <= to : month >= from || month <= to
