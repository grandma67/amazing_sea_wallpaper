// Phenology: what the plants look like on the day (knowledge/SEASONS.md §2,
// plans/SEASONS_PLAN.md). Deciduous leaves turn and fall, grass dries, by
// the day's climate and in its own hemisphere (seasons.ts seasonDay). Not
// random: no draws, so a tree's shape never changes with the season, only
// its leaves (props/trees.ts hashes each leaf).

import type { Climate, RGB, VegetationKind } from './biome'
import { hashCell } from './cellNoise'
import { PLACES, type DrySeason } from './places'
import { seasonDay, type Day } from './seasons'

/** What phenology reads from a day (SceneParams has all of it). */
export interface PhenologyDay extends Day {
  place: { id: string; climate: Climate }
  overrides?: { phenology?: boolean; bloom?: boolean | readonly BloomKind[]; heath?: boolean | HeathStage }
  sea?: { ocean: string }
}

export interface Phenology {
  /** Deciduous leaves: the share still on the tree, the share of those
   * turned to autumn colours, and spring's fresh green (each 0–1). */
  on: number
  turned: number
  fresh: number
  /** Grass and ground cover: 0 green … 1 straw. */
  dry: number
  climate: Climate
  /** The tropical almond's twice-yearly red (a different clock). */
  tropical: { on: number; turned: number }
  /** Fallen leaves: how much lies on the ground under a deciduous tree, and
   * how fresh it is (1 still coloured … 0 weathered brown; each 0–1). */
  litter: number
  litterFresh: number
  placeId: string
  south: boolean
  /** Bush and tree blossom flowering today (`BLOOM`). */
  bloom: readonly Blooming[]
}

/** What a plant builder needs: the leaves of a deciduous tree (`deciduous`
 * is the share of trees that are) and the grass's dryness. */
export interface PlantSeason {
  on: number
  turned: number
  fresh: number
  dry: number
  deciduous: number
  autumn: readonly RGB[]
  /** The blossom flowering on this kind today (`bloomFor`). Each tree takes
   * one row or none by its position (props/vegetation.ts); its mesh is the
   * variant's flowering twin (`withBlossom`). */
  bloom?: readonly Blooming[]
  /** This mesh's blossom (a flowering twin's). */
  blossom?: Blossom
}

/** Every blossom kind (the spec validator reads this list: sceneSpec.ts). */
export const BLOOM_KINDS = ['rock-rose', 'gorse', 'wattle', 'flamboyant', 'pohutukawa'] as const
export type BloomKind = (typeof BLOOM_KINDS)[number]

/** A plant in flower on a kind's crowns (NATURE_PLAN phases 3–4). */
export interface BloomRow {
  kind: BloomKind
  plant: VegetationKind
  /** Where it grows (place ids). */
  places: readonly string[]
  /** Today's flowering: `strength` 0–1 scales the crowns in flower
   * (`scales: 'crowns'`) or the cards in flower on each (`'leaves'`); `on`
   * thins a flowering crown's leaves (flamboyant flowers nearly bare);
   * `leaves` overrides the row's card share. A place row reads local
   * calendar months (as turtle nesting; LESSONS.md "Seasons"). */
  today: (day: PhenologyDay) => { strength: number; on?: number; leaves?: number }
  scales: 'crowns' | 'leaves'
  /** Share of the kind's crowns in flower, and of a flowering crown's leaf
   * cards that are flowers, at strength 1. */
  crowns: number
  leaves: number
  /** Flower colours (linear albedo, measured: NATURE_PLAN §1), one per crown. */
  colors: readonly RGB[]
  /** A flower card's length as a share of a leaf card's (est.: cistus
   * flowers 4–6 cm, gorse 1.5–2.5 cm in clusters, wattle in sprays, against
   * 8–13 cm leaf cards; flamboyant and pōhutukawa clusters a leaf's size). */
  size: number
  /** Only trees this near the shore (m inland of s = 0): pōhutukawa lines
   * the coast's first trees. */
  nearShoreM?: number
  /** Tints the far woods (false: too few crowns, or only along the shore). */
  far: boolean
}

/** A row in flower today, ready for a crown. */
export interface Blooming {
  row: BloomRow
  strength: number
  /** Share of the kind's trees in flower, and of a flowering crown's cards. */
  crowns: number
  leaves: number
  /** A flowering crown's leaves on (1: as usual). */
  on: number
}

/** One flowering crown's look. */
export interface Blossom {
  kind: BloomKind
  leaves: number
  color: RGB
  size: number
  on: number
}

const MED = ['western-med', 'adriatic', 'aegean', 'north-africa-levant', 'portugal-morocco', 'canaries']
const monthly =
  (months: readonly number[]) =>
  (day: PhenologyDay): { strength: number } => ({ strength: months[Number(day.date.slice(5, 7)) - 1] })

/** Day of the calendar year (1–365) and the first of a month. */
const dayOfYear = (date: string): number => seasonDay({ date, latitudeDeg: 1 })
const firstOf = (month: number): number => dayOfYear(`2025-${String(month).padStart(2, '0')}-01`)

/** The place's dry season if this day is on its dry coast (its latitudes,
 * not the wetter coast on another ocean): what savanna grass and the
 * flamboyant's window read. */
export function onDryCoast(day: PhenologyDay): DrySeason | undefined {
  const season = PLACES.find(p => p.id === day.place.id)?.drySeason
  if (season == null) return undefined
  const [south, north] = season.latitudeDeg ?? [-90, 90]
  if (day.latitudeDeg < south || day.latitudeDeg > north) return undefined
  const wet = season.wetCoast
  if (wet != null && day.sea?.ocean === wet.ocean && day.latitudeDeg >= wet.latitudeDeg[0] && day.latitudeDeg <= wet.latitudeDeg[1]) return undefined
  return season
}

/** Days after `end` (the first day of the rains), wrapped to −182…182. */
const sinceEnd = (d: number, end: number): number => ((((d - end) % 365) + 365 + 182) % 365) - 182

const SCATTERED = 0.2
const FLAMBOYANT_DRY = ['north-australia', 'nw-australia', 'west-africa', 'central-america', 'east-africa', 'northeast-brazil', 'indonesia', 'india']
const FLAMBOYANT_CARIBBEAN = ['antilles', 'lesser-antilles-volcanic', 'bahamas-bermuda', 'yucatan-belize']
const FLAMBOYANT_SCATTERED = ['philippines', 'pacific-islands', 'hawaii', 'sri-lanka', 'andaman-lakshadweep', 'sumatra-java-south', 'maldives', 'comoros', 'reunion-mauritius']

/**
 * Flamboyant (NATURE.md §1.2, §8): on a dry coast it flowers at the end of
 * the dry season, nearly leafless, and on as the rains bring new leaves:
 * ramping in 45–30 days before the rains (`end`), full to 30 days after,
 * out by 45 (est. ramps); bare (on 0.4, est.) until the rains, its leaves back
 * by +45; flowers 0.8 of the cards, 0.5 as the leaves return (est.). The
 * Caribbean May–Sep, peak June; mainland SE Asia May–Jul; where there's no
 * clear dry season (and a dry place's wetter coasts) each tree keeps its own
 * rhythm: 0.2 any month, leaves on. Galápagos: none (planted in towns only).
 */
function flamboyantToday(day: PhenologyDay): { strength: number; on?: number; leaves?: number } {
  const id = day.place.id
  if (FLAMBOYANT_DRY.includes(id)) {
    const season = onDryCoast(day)
    if (season == null) return { strength: SCATTERED }
    const end = firstOf((season.months[1] % 12) + 1)
    const t = sinceEnd(dayOfYear(day.date), end)
    const strength = t < -45 || t > 45 ? 0 : t < -30 ? (t + 45) / 15 : t <= 30 ? 1 : (45 - t) / 15
    if (strength === 0) return { strength: SCATTERED }
    const back = Math.min(1, Math.max(0, t / 45))
    return { strength: Math.max(SCATTERED, strength), on: 0.4 + 0.6 * back, leaves: 0.8 - 0.3 * back }
  }
  if (FLAMBOYANT_CARIBBEAN.includes(id)) return monthly([0, 0, 0, 0, 0.7, 1, 1, 0.7, 0.5, 0, 0, 0])(day)
  if (id === 'mainland-se-asia') return monthly([0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0])(day)
  return { strength: SCATTERED }
}

/** Pōhutukawa (RNZ, Te Papa, NZ Herald): full 15 Dec – 5 Jan, ramping in
 * from 15 Nov and out by 15 Jan. */
function pohutukawaToday(day: PhenologyDay): { strength: number } {
  return { strength: band(dayOfYear(day.date), firstOf(11) + 14, firstOf(12) + 14, 5, 15) }
}

/**
 * Blossom by place (NATURE.md §1; colours measured, NATURE_PLAN §1).
 * Rock rose: native Macaronesia to the eastern Mediterranean, not
 * California, Chile, the Cape or SW Australia (Kew POWO). Gorse: Atlantic
 * Europe, full Apr–May with flowers all year in mild winters (Woodland
 * Trust); invasive in New Zealand, Tasmania and Chile, where it flowers
 * May–Nov, spring and autumn flushes (NZ Flora, APWT, Hawke's Bay RC; the
 * spring peak est.). Wattle: late Aug – Sep, Jul and Oct–Nov a little.
 * Flamboyant and pōhutukawa on `broadleaf` (phase 4).
 */
export const BLOOM: readonly BloomRow[] = [
  {
    kind: 'rock-rose',
    plant: 'bush',
    places: MED,
    today: monthly([0, 0, 0, 0.3, 1, 1, 1, 0, 0, 0, 0, 0]),
    scales: 'leaves',
    crowns: 0.4,
    // 0.25 of the cards at half size covered ~6% of the crown: specks at 6 m,
    // where cistus in flower is spotted all over (mesh.mjs, 2026-11-12).
    leaves: 0.4,
    colors: [
      [0.41, 0.13, 0.41],
      [0.59, 0.62, 0.58]
    ],
    size: 0.6,
    far: true
  },
  {
    kind: 'gorse',
    plant: 'bush',
    places: ['cornwall-wales', 'brittany', 'ireland', 'scotland', 'bristol-channel', 'morecambe-bay'],
    today: monthly([0.4, 0.4, 0.4, 1, 1, 0.4, 0.1, 0.1, 0.1, 0.1, 0.1, 0.1]),
    scales: 'leaves',
    crowns: 0.5,
    leaves: 0.5,
    colors: [[0.62, 0.33, 0.01]],
    size: 0.7,
    far: true
  },
  {
    kind: 'gorse',
    plant: 'bush',
    places: ['new-zealand-south', 'new-zealand-north', 'tasmania', 'central-chile'],
    today: monthly([0.1, 0.1, 0.1, 0.1, 0.4, 0.4, 0.4, 1, 1, 1, 0.4, 0.1]),
    scales: 'leaves',
    crowns: 0.5,
    leaves: 0.5,
    colors: [[0.62, 0.33, 0.01]],
    size: 0.7,
    far: true
  },
  {
    kind: 'wattle',
    plant: 'bush',
    places: ['east-australia', 'tasmania', 'sw-australia'],
    today: monthly([0, 0, 0, 0, 0, 0, 0.3, 1, 1, 0.3, 0.3, 0]),
    scales: 'leaves',
    crowns: 0.35,
    leaves: 0.5,
    // The flower balls alone (two regions of the golden-wattle photo agree).
    colors: [[0.52, 0.55, 0.09]],
    size: 0.8,
    far: true
  },
  {
    kind: 'flamboyant',
    plant: 'broadleaf',
    places: [...FLAMBOYANT_DRY, ...FLAMBOYANT_CARIBBEAN, 'mainland-se-asia', ...FLAMBOYANT_SCATTERED],
    today: flamboyantToday,
    scales: 'crowns',
    // Tropical broadleaf is ~1.5 of 14.5 of the plant weight, so ~1 tree in 70
    // at full strength: about one flamboyant per framed view (est.).
    crowns: 0.15,
    leaves: 0.8,
    colors: [[0.41, 0.03, 0.02]],
    size: 1,
    far: false
  },
  {
    kind: 'pohutukawa',
    plant: 'broadleaf',
    places: ['new-zealand-north'],
    today: pohutukawaToday,
    scales: 'leaves',
    crowns: 0.6,
    // 0.7 made a solid red ball (mesh.mjs); in photos the crimson heads sit
    // among the leaves (a quarter of a close-up, more of a whole tree; est.).
    leaves: 0.45,
    colors: [[0.47, 0.02, 0.02]],
    size: 1,
    nearShoreM: 60,
    far: false
  }
]

function blooming(row: BloomRow, strength: number, extra: { on?: number; leaves?: number } = {}): Blooming {
  const leaves = extra.leaves ?? row.leaves
  return {
    row,
    strength,
    crowns: row.scales === 'crowns' ? row.crowns * strength : row.crowns,
    leaves: row.scales === 'leaves' ? leaves * strength : leaves,
    on: extra.on ?? 1
  }
}

/** The rows in flower today: by place and date, or as a spec forces
 * (`props.bloom`: true, every row that grows here at full strength; a list,
 * those rows at full strength wherever the day is; false, none). */
function bloomToday(day: PhenologyDay): Blooming[] {
  const force = day.overrides?.bloom
  if (force === false) return []
  if (Array.isArray(force)) {
    // One row per kind (the first: the northern gorse), wherever the day is.
    return force.map(kind => blooming(BLOOM.find(r => r.kind === kind)!, 1))
  }
  return BLOOM.filter(r => r.places.includes(day.place.id)).flatMap(row => {
    const t = row.today(day)
    if (force === true) return [blooming(row, 1, t.strength === 1 ? t : {})]
    return t.strength > 0 ? [blooming(row, t.strength, t)] : []
  })
}

/** The blossom on `kind` today. */
export function bloomFor(kind: VegetationKind, phen: Phenology): readonly Blooming[] {
  return phen.bloom.filter(b => b.row.plant === kind)
}

/** `season` as a flowering twin of a crown: `row`'s blossom in colour `color`. */
export function withBlossom(season: PlantSeason, b: Blooming, color: number): PlantSeason {
  return { ...season, blossom: { kind: b.row.kind, leaves: b.leaves, color: b.row.colors[color % b.row.colors.length], size: b.row.size, on: b.on } }
}

/** Plants in full summer leaf: what every day looked like before. */
export const SUMMER: Omit<Phenology, 'climate' | 'placeId' | 'south'> = { on: 1, turned: 0, fresh: 0, dry: 0, tropical: { on: 1, turned: 0 }, litter: 0, litterFresh: 0, bloom: [] }

/**
 * A value that rises from 0 at day `a` to 1 at `b`, holds, and falls back to
 * 0 from `c` to `e` (days of the year, 1–365; the window may wrap the year).
 */
export function band(d: number, a: number, b: number, c: number, e: number): number {
  const off = (x: number): number => (((x - a) % 365) + 365) % 365
  const x = off(d)
  const [B, C, E] = [off(b), off(c), off(e)]
  if (x < B) return x / B
  if (x < C) return 1
  if (x < E) return 1 - (x - C) / (E - C)
  return 0
}

/** Deciduous leaves by climate (SEASONS.md §2.1): leaf-out and full leaf,
 * first tint, peak colour, bare (northern-hemisphere days). */
export const LEAF_DAYS: Partial<Record<Climate, { out: number; full: number; tint: number; peak: number; bare: number }>> = {
  // Tundra shrubs: green for two months, red in early September.
  polar: { out: 166, full: 182, tint: 227, peak: 248, bare: 268 },
  // Birch and aspen: yellow by the third week of September.
  boreal: { out: 140, full: 156, tint: 244, peak: 263, bare: 288 },
  // Oak and beech (Nature's Calendar): first tint ~2 Oct, full tint early
  // November, bare ~1 December.
  temperate: { out: 105, full: 130, tint: 268, peak: 300, bare: 335 }
}

/** Fallen leaves by climate (SEASONS.md §2.5; `band`): building from peak
 * colour to bare, then gone under the spring's growth (temperate) or the first
 * lasting snow (boreal, polar: phase 9's months). */
export const LITTER_DAYS: Partial<Record<Climate, { a: number; b: number; c: number; e: number }>> = {
  polar: { a: 248, b: 268, c: 269, e: 285 },
  boreal: { a: 263, b: 288, c: 320, e: 340 },
  temperate: { a: 300, b: 335, c: 105, e: 135 }
}

/** Days after peak colour until fallen leaves have weathered brown (est.). */
const LITTER_WEATHERS = 90

/** Grass and ground cover dryness by climate (SEASONS.md §2.2): rise, hold,
 * fall (days), and how dry at most. */
export const DRY_DAYS: Partial<Record<Climate, { a: number; b: number; c: number; e: number; max: number }>> = {
  // Summer dormancy: golden June–October, green again after the autumn rains.
  mediterranean: { a: 145, b: 196, c: 288, e: 334, max: 0.85 },
  // Dull winter pasture and dead tops.
  temperate: { a: 305, b: 340, c: 50, e: 90, max: 0.3 },
  subtropical: { a: 330, b: 350, c: 40, e: 60, max: 0.15 },
  // Straw from the first frosts to after the snow.
  boreal: { a: 258, b: 288, c: 135, e: 165, max: 0.8 },
  polar: { a: 228, b: 250, c: 166, e: 190, max: 0.9 }
}

/** How dry a savanna's grass gets at the end of its dry season (SEASONS.md §2.2). */
const SAVANNA_DRY = 0.8

/** The grass of a savanna coast (`Place.drySeason`): cures over the first six
 * weeks of the dry season, holds, and greens in the month after it. Other
 * places: 0. */
function savannaDry(day: PhenologyDay): number {
  const season = onDryCoast(day)
  if (season == null) return 0
  const start = firstOf(season.months[0])
  const end = firstOf((season.months[1] % 12) + 1)
  return SAVANNA_DRY * band(dayOfYear(day.date), start, start + 45, end, end + 30)
}

/** The day's phenology; the summer look when a spec switches it off. */
export function phenologyFor(day: PhenologyDay): Phenology {
  const climate = day.place.climate
  const base = { climate, placeId: day.place.id, south: day.latitudeDeg < 0 }
  if (day.overrides?.phenology === false) return { ...SUMMER, ...base }
  const d = seasonDay(day)
  const leaf = LEAF_DAYS[climate]
  let [on, turned, fresh] = [1, 0, 0]
  if (leaf != null) {
    on = 1 - band(d, leaf.peak, leaf.bare, leaf.out, leaf.full)
    turned = band(d, leaf.tint, (leaf.peak + leaf.bare) / 2, leaf.out - 1, leaf.out)
    fresh = band(d, leaf.out, leaf.out + 1, leaf.full, leaf.full + 21)
  }
  const dryDays = DRY_DAYS[climate]
  const dry = dryDays == null ? savannaDry(day) : dryDays.max * band(d, dryDays.a, dryDays.b, dryDays.c, dryDays.e)
  // Tropical almond: red and shedding in January–February and July–August
  // (calendar months: two dry seasons a year).
  const doy = seasonDay({ date: day.date, latitudeDeg: 1 })
  const almond = Math.max(band(doy, 1, 25, 40, 60), band(doy, 182, 205, 222, 243))
  // Fallen leaves: the almond's rot within weeks, so they follow its shedding.
  const fall = LITTER_DAYS[climate]
  const litter = climate === 'tropical' ? almond : fall == null ? 0 : band(d, fall.a, fall.b, fall.c, fall.e)
  const litterFresh = climate === 'tropical' || fall == null ? 1 : Math.max(0, 1 - ((((d - fall.a) % 365) + 365) % 365) / LITTER_WEATHERS)
  return { ...base, on, turned, fresh, dry, tropical: { on: 1 - 0.5 * almond, turned: almond }, litter, litterFresh, bloom: bloomToday(day) }
}

/** Coasts that don't follow the Caribbean's sargassum months: West Africa has
 * its own peaks (March–May, September), and we found no calendar for northeast
 * Brazil (SEASONS.md §2.4). They keep it all year. */
const SARGASSUM_ALL_YEAR = new Set(['west-africa', 'northeast-brazil'])

/** The share of drawn sargassum wrack that is on the beach today: full in the
 * bloom and beaching season, April–September, and a fifth of it otherwise. Real
 * calendar months, not the day's season: it is one Atlantic bloom, not a local
 * summer. A spec's `phenology: false` keeps the wrack as drawn. */
export function sargassumSeason(day: PhenologyDay): number {
  if (day.overrides?.phenology === false || SARGASSUM_ALL_YEAR.has(day.place.id)) return 1
  const month = Number(day.date.slice(5, 7))
  return month >= 4 && month <= 9 ? 1 : 0.2
}

/** Places whose autumn is red, not yellow: eastern North America's maples,
 * East Asia's, Patagonia's lenga. Europe's is yellow (SEASONS.md §2.1). */
export const AUTUMN_RED = new Set(['maine', 'nova-scotia', 'pei', 'fundy', 'newfoundland', 'yellow-sea', 'south-japan', 'russian-far-east', 'tierra-del-fuego', 'patagonia-fjords'])

// Turned leaves (linear albedo, about twice a summer leaf's brightness).
const YELLOW: RGB = [0.3, 0.2, 0.025]
const GOLD: RGB = [0.25, 0.14, 0.025]
const ORANGE: RGB = [0.26, 0.09, 0.02]
const COPPER: RGB = [0.16, 0.065, 0.025]
const RED: RGB = [0.22, 0.035, 0.025]
const BROWN: RGB = [0.11, 0.065, 0.03]

/** The share of a kind's trees that are deciduous here (SEASONS.md §2.1). */
export function deciduousShare(kind: VegetationKind, phen: Phenology): number {
  const { climate, placeId, south } = phen
  const cool = climate === 'temperate' || climate === 'boreal' || climate === 'polar'
  if (kind === 'birch') return 1
  if (kind === 'broadleaf') {
    if (placeId === 'tierra-del-fuego') return 0.6
    if (placeId === 'patagonia-fjords') return 0.3
    if (climate === 'tropical') return 0.4
    return cool && !south ? 0.9 : 0
  }
  if (kind === 'bush' && !south) return climate === 'polar' ? 0.8 : climate === 'boreal' ? 0.6 : climate === 'temperate' ? 0.3 : 0
  return 0
}

/** The colours a kind's leaves turn here. */
export function autumnColors(kind: VegetationKind, phen: Phenology): readonly RGB[] {
  if (phen.climate === 'tropical') return [RED, RED, ORANGE, BROWN]
  if (kind === 'birch') return [YELLOW, YELLOW, GOLD]
  if (phen.climate === 'polar') return [RED, ORANGE, RED, GOLD]
  if (AUTUMN_RED.has(phen.placeId)) return [RED, ORANGE, GOLD, RED, YELLOW]
  if (phen.climate === 'boreal') return [YELLOW, GOLD, YELLOW, ORANGE]
  return [GOLD, ORANGE, COPPER, YELLOW, BROWN]
}

/** A fallen leaf's length here (m, est.: oak and beech ~10 cm, the southern
 * beeches' ~4 cm, birch ~5 cm, tundra shrubs ~2.5 cm, tropical almond ~20 cm). */
export function fallenLeafSize(kind: VegetationKind, phen: Phenology): number {
  if (phen.climate === 'tropical') return 0.2
  if (kind === 'birch') return 0.05
  if (kind === 'bush') return phen.climate === 'temperate' ? 0.04 : 0.025
  return phen.south ? 0.04 : 0.1
}

/** A leaf weathered on the ground. */
export const LITTER_BROWN: RGB = [0.075, 0.048, 0.026]

/** The colour fallen leaves give the ground, seen from afar: the turned
 * colours of the day's deciduous `kinds`, weathering brown, and dimmer than one
 * lit leaf (they shade each other and the ground shows between them). */
export function litterTint(kinds: readonly VegetationKind[], phen: Phenology): RGB {
  if (kinds.length === 0) return LITTER_BROWN
  const fresh = mean(kinds.map(k => mean(autumnColors(k, phen))))
  return mix(LITTER_BROWN, fresh.map(v => v * 0.45) as RGB, 0.7 * phen.litterFresh)
}

/** What a plant builder gets for `kind` today; undefined when it looks as
 * in summer (evergreen, or deciduous in full summer leaf with green grass). */
export function plantSeason(kind: VegetationKind, phen: Phenology): PlantSeason | undefined {
  const deciduous = deciduousShare(kind, phen)
  const leaves = phen.climate === 'tropical' ? { ...phen.tropical, fresh: 0 } : phen
  const leafy = deciduous > 0 && (leaves.on < 1 || leaves.turned > 0 || leaves.fresh > 0)
  const bloom = bloomFor(kind, phen)
  if (!leafy && phen.dry === 0 && bloom.length === 0) return undefined
  return {
    on: leaves.on,
    turned: leaves.turned,
    fresh: leaves.fresh,
    dry: phen.dry,
    deciduous: leafy ? deciduous : 0,
    autumn: autumnColors(kind, phen),
    ...(bloom.length > 0 ? { bloom } : {})
  }
}

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const mean = (cs: readonly RGB[]): RGB => cs.reduce<RGB>((s, c) => [s[0] + c[0] / cs.length, s[1] + c[1] / cs.length, s[2] + c[2] / cs.length], [0, 0, 0])

/** Bare twigs and the ground between them, seen from afar. */
const BARE: RGB = [0.07, 0.06, 0.05]

/**
 * A distant wood's colour this season: `foliage` turned toward its autumn
 * colours and, as the leaves fall, toward bare grey-brown. `plants` is the
 * day's plant pool (the deciduous share of the trees in it decides how much).
 */
export function canopyTint(foliage: RGB, phen: Phenology, plants: readonly (readonly [VegetationKind, number])[]): RGB {
  const trees = plants.filter(([k]) => k !== 'grass')
  const total = trees.reduce((s, [, w]) => s + w, 0)
  if (total === 0) return foliage
  const share = trees.reduce((s, [k, w]) => s + w * deciduousShare(k, phen), 0) / total
  if (share === 0) return blossomTint(foliage, phen, trees, total)
  const leaves = phen.climate === 'tropical' ? phen.tropical : phen
  // Far away the turned crowns are dimmer than a lit leaf (shade inside the crown).
  const turned = mix(foliage, mean(autumnColors('broadleaf', phen)).map(v => v * 0.6) as RGB, share * leaves.on * leaves.turned)
  return blossomTint(mix(turned, BARE, share * (1 - leaves.on)), phen, trees, total)
}

/** Far crowns in flower: mixed toward the flowers' mean colour by the share
 * of the plant pool's crowns and cards in flower (a faint haze on far maquis). */
function blossomTint(color: RGB, phen: Phenology, trees: readonly (readonly [VegetationKind, number])[], total: number): RGB {
  let out = color
  for (const [kind, w] of trees) {
    for (const b of bloomFor(kind, phen)) if (b.row.far) out = mix(out, mean(b.row.colors), b.crowns * b.leaves * (w / total))
  }
  return out
}

/**
 * The mountains' snow by climate (SEASONS.md §4): how far the drawn line drops
 * in deep winter; how tall a mountain with no snow in summer must be to whiten
 * in winter (m); and the altitudes its winter line comes down to (m). Tropical
 * and arid climates aren't here: their snow doesn't follow these seasons, so
 * their line stays as drawn.
 */
export const SNOW_SEASON: Partial<Record<Climate, { winter: number; bareFrom: number; level: readonly [number, number] }>> = {
  polar: { winter: 0.6, bareFrom: 900, level: [100, 400] },
  boreal: { winter: 0.6, bareFrom: 900, level: [200, 600] },
  temperate: { winter: 0.6, bareFrom: 1500, level: [800, 1300] },
  mediterranean: { winter: 0.7, bareFrom: 2000, level: [1200, 1700] },
  subtropical: { winter: 0.85, bareFrom: 2500, level: [1800, 2300] }
}

/** A range's real peaks reach about this share of its `height` (the envelope
 * and ridges in props/landforms.ts); a volcano's cone reaches all of it. */
const RANGE_PEAK = 0.8

/**
 * The day's snow line (m) from the drawn one: lowest mid-January to mid-March,
 * as drawn at the end of May and on 1 November, highest mid-August to
 * mid-September. A mountain drawn with no snow (Infinity) whitens from the top
 * down in winter if it's tall enough; `seed` keeps its line stable through the
 * season. A function of the date: no draw.
 */
export function seasonalSnowLine(land: { snowLine: number; height: number; kind: 'range' | 'strato' | 'shield'; seed: number }, climate: Climate, day: Day): number {
  const table = SNOW_SEASON[climate]
  if (table == null) return land.snowLine
  const d = seasonDay(day)
  const winter = band(d, 305, 15, 75, 150)
  if (Number.isFinite(land.snowLine)) return land.snowLine * (1 - (1 - table.winter) * winter + 0.2 * band(d, 150, 227, 258, 305))
  if (winter === 0 || land.height < table.bareFrom) return Infinity
  const peak = land.height * (land.kind === 'range' ? RANGE_PEAK : 1)
  const [low, high] = table.level
  const level = Math.min(low + (high - low) * (hashCell(land.seed, 5) / 4294967295), peak * 0.85)
  // Starts above the peak, past the reach of the snow edge's noise (landforms.ts).
  return peak * 1.3 + (level - peak * 1.3) * winter
}

/** Heath coasts: heather (*Calluna*, with bell heather) on the land behind
 * a rocky shore and on far slopes (NATURE_PLAN phase 5, NATURE.md §1.1).
 * Norway's coastal heath *(est.)*; not the Baltic. */
export const HEATH_PLACES: readonly string[] = ['cornwall-wales', 'brittany', 'ireland', 'scotland', 'norway-west']
export const HEATH_STAGES = ['flower', 'brown', 'green'] as const
export type HeathStage = (typeof HEATH_STAGES)[number]

/** Share of the ground cover that is heath (est.): the patch masks' thresholds
 * are this share's quantile of their noise (terrain `fbm` mix, props `fbm3`). */
export const HEATH_COVER = 0.35
export const HEATH_MASK_TERRAIN = 0.537
export const HEATH_MASK_FAR = 0.545
/** Half-width of the masks' soft edge (in noise units). */
export const HEATH_MASK_EDGE = 0.03

/** Heath in full flower from afar: hue measured (mauve, not purple), the
 * brightness est.; the flowers seen near (bell heather, measured); dead
 * flowers and wiry stems Oct–Mar, the foliage Apr–Jun (est.). NATURE_PLAN §1. */
const HEATH_FAR: RGB = [0.16, 0.07, 0.08]
const HEATH_FLOWER: RGB = [0.25, 0.14, 0.26]
const HEATH_BROWN: RGB = [0.08, 0.04, 0.034]
const HEATH_GREEN: RGB = [0.06, 0.08, 0.04]
/** In full flower, the share of a near patch that is flowers (est.); the
 * stems and foliage between them make up the far colour. */
const HEATH_SPECKS = 0.3
const HEATH_STEMS = HEATH_FAR.map((v, i) => Math.max(0.005, (v - HEATH_SPECKS * HEATH_FLOWER[i]) / (1 - HEATH_SPECKS))) as RGB
/** A stage forced by a spec: its day of the calendar year. */
const HEATH_STAGE_DAY: Record<HeathStage, number> = { flower: 228, brown: 15, green: 135 }

/** Heath's look today: the stems' and foliage's colour, the flowers' and
 * their share of a near patch; `color` the mean, what far slopes show. */
export interface Heath {
  stems: RGB
  flower: RGB
  specks: number
  color: RGB
}

/**
 * Heath in today's colour (local calendar months: every heath place is
 * northern), or undefined where there's none. Foliage green from April,
 * brown from mid-September to March; flowers July–September, full in
 * August. No draws. `overrides.heath` forces (true: heath here in today's
 * colour, whatever the place; a stage: in that colour) or switches it off
 * (false); `phenology: false` switches it off too.
 */
export function heathFor(day: PhenologyDay): Heath | undefined {
  const force = day.overrides?.heath
  if (force === false || day.overrides?.phenology === false) return undefined
  if (force == null && !HEATH_PLACES.includes(day.place.id)) return undefined
  const d = typeof force === 'string' ? HEATH_STAGE_DAY[force] : dayOfYear(day.date)
  const foliage = mix(HEATH_BROWN, HEATH_GREEN, band(d, 91, 121, 258, 288))
  const f = band(d, 182, 213, 243, 274)
  const stems = mix(foliage, HEATH_STEMS, f)
  const specks = HEATH_SPECKS * f
  return { stems, flower: HEATH_FLOWER, specks, color: mix(stems, HEATH_FLOWER, specks) }
}

/** Ground cover (terrain) with the grass dried toward straw. */
const STRAW: RGB = [0.2, 0.15, 0.075]
export function groundCoverTint(cover: RGB, phen: Phenology): RGB {
  return mix(cover, STRAW, phen.dry * 0.75)
}
