// Fruits, cones, catkins and propagules on the trees by season (NATURE.md
// §1.4). Like phenology: no draws. Each row says on which plant kind it hangs,
// where, and today's crop and stages (colour, size, how it hangs); the tree
// builders (props/trees.ts `fruits`) place them at twig tips by hash, so a
// tree's shape never changes with them.
//
// Clocks: `season` rows read the northern-equivalent day (seasonDay: south of
// the equator half a year on), `local` rows the calendar day of the place
// (a place row, as turtle nesting). Flowers that colour the crown are
// phenology.ts `BLOOM` rows; this table holds what is drawn as its own shape.

import type { Climate, RGB, VegetationKind } from './biome'
import { hashCell } from './cellNoise'
import { band, deciduousShare, LEAF_DAYS, type Phenology, type PhenologyDay, type PlantSeason } from './phenology'
import { seasonDay } from './seasons'
import { SHRUBS, shrubGrows, type ShrubKind } from './shrubs'

/** Every fruit kind (the spec validator reads this list: sceneSpec.ts). */
export const FRUIT_KINDS = [
  'coconut',
  'palm-dates',
  'sabal',
  'pandanus',
  'stone-pine-cones',
  'spruce-cones',
  'olive-fruit',
  'almond-fruit',
  'birch-catkins',
  'propagules',
  'sea-buckthorn',
  'rugosa-rose',
  'blackthorn',
  'hawthorn',
  'lentisk',
  'strawberry-tree',
  'myrtle',
  'sea-grape',
  'naupaka',
  'saw-palmetto',
  'coast-banksia',
  'salal',
  'willow',
  'calafate',
  'natal-plum'
] as const
export type FruitKind = (typeof FRUIT_KINDS)[number]

/** How a fruit is drawn: an egg (`ball`), a scaled egg (`cone`), a thin
 * hanging tail (`catkin`), a long hanging spindle (`propagule`), or a big
 * hanging bunch under a palm's crown (`cluster`). */
export type FruitShape = 'ball' | 'cone' | 'catkin' | 'propagule' | 'cluster'

/** One stage of a fruit on the tree today. */
export interface FruitStage {
  /** Linear albedo. */
  color: RGB
  /** Share of today's fruits at this stage (the stages' shares are normalised). */
  share: number
  /** Length as a share of the row's full size (young cones are smaller). */
  size: number
  /** 0: points up off the twig (a young spruce cone), 1: hangs straight down. */
  hang: number
}

export interface FruitRow {
  kind: FruitKind
  /** The kind it hangs on; `rhizophora`: the red mangrove (props/mangroves.ts). */
  plant: VegetationKind | 'rhizophora'
  where: (day: PhenologyDay) => boolean
  clock: 'season' | 'local'
  /** Today's crop (0–1: the share of the full count) and stages, from the
   * day of the year on the row's clock. */
  today: (d: number, day: PhenologyDay) => { crop: number; stages: readonly FruitStage[] }
  /** The day a forced row (`props.fruit`) is drawn at, on its clock. */
  peak: number
  shape: FruitShape
  /** Full length (m) and width as a share of it. */
  length: number
  width: number
  /** Fruits per twig tip at crop 1 (palms: per crown; pandanus: per arm). */
  perTip: number
  /** Only the top of the crown (tips above this share of its height): spruce
   * cones near the top; 0: anywhere. */
  top: number
  /** Only the crowns that are the deciduous species of a mixed kind
   * (tropical broadleaf: the tropical almond is the one that sheds). */
  deciduousOnly?: boolean
  /** Berries borne in clusters: `count` fruits of `length` packed within
   * `spread` m of each other (stretched along the axis by `along`), each
   * an 8-triangle berry; `perTip` counts clusters. */
  cluster?: { count: number; spread: number; along?: number }
  /** A shrub species' fruit (shrubs.ts): only on that species' bushes,
   * which props/vegetation.ts crownBlossom picks; never on the plain mesh. */
  species?: ShrubKind
}

/** A row on a kind's trees today. */
export interface Fruiting {
  row: FruitRow
  crop: number
  stages: readonly FruitStage[]
  /** Share of the kind's crowns that bear it (by the crown's hash). */
  crowns: number
}

const stage = (color: RGB, share: number, size = 1, hang = 1): FruitStage => ({ color, share, size, hang })

/** Day of the calendar year (1–365). */
const dayOfYear = (date: string): number => seasonDay({ date, latitudeDeg: 1 })
/** The first of a month on a clock (non-leap year). */
const first = (month: number): number => [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335][month - 1]
/** Inside a window of days that may wrap the year. */
const within = (d: number, from: number, to: number): boolean => (from <= to ? d >= from && d < to : d >= from || d < to)
/** A month's value from a 12-entry table, by day of the year. */
const monthOf = (d: number): number => {
  for (let m = 12; m >= 1; m--) if (d >= first(m)) return m
  return 1
}

/** A year's crop on a mast-seeding tree (0.15–1): a hash of the calendar year
 * and place, not a draw, so every day of a year agrees. Norway spruce masts
 * every 3–5 years (WSL MastWeb); here 1 year in 4 heavy, 1 in 3 middling. */
export function mastYear(year: number, placeId: string): number {
  let salt = 0
  for (let i = 0; i < placeId.length; i++) salt = (salt * 31 + placeId.charCodeAt(i)) | 0
  const h = hashCell(year, salt & 0xfffff) / 4294967296
  return h < 0.25 ? 1 : h < 0.6 ? 0.45 : 0.15
}

// Colours: linear albedo, est. from photos (hue) and the measured leaves and
// bark beside them (brightness): NATURE.md §1.4. Shiny chestnut stone-pine cones,
// ripe orange pandanus and Canary dates are the strongest.
const COCO_GREEN: RGB = [0.07, 0.12, 0.025]
const COCO_YELLOW: RGB = [0.24, 0.19, 0.04]
const COCO_BROWN: RGB = [0.12, 0.07, 0.03]
const CONE_GREEN: RGB = [0.08, 0.11, 0.04]
const CHESTNUT: RGB = [0.16, 0.075, 0.03]
const CONE_GREY: RGB = [0.16, 0.13, 0.1]
const SPRUCE_RED: RGB = [0.22, 0.03, 0.06]
const SPRUCE_BROWN: RGB = [0.14, 0.075, 0.035]
const OLIVE_GREEN: RGB = [0.1, 0.12, 0.03]
const OLIVE_PURPLE: RGB = [0.06, 0.02, 0.035]
const OLIVE_BLACK: RGB = [0.025, 0.018, 0.02]
const FRUIT_GREEN: RGB = [0.08, 0.13, 0.03]
const PANDAN_ORANGE: RGB = [0.5, 0.17, 0.02]
const PANDAN_RED: RGB = [0.35, 0.05, 0.02]
const ALMOND_RED: RGB = [0.28, 0.05, 0.03]
const ALMOND_PURPLE: RGB = [0.1, 0.025, 0.045]
// Measured (asset.mjs, 2026-11-14; BUSHES.md §2, TREES.md §2): the lit cluster.
const DATE_ORANGE: RGB = [0.44, 0.15, 0.01]
const PLUME_CREAM: RGB = [0.45, 0.38, 0.16]
const SABAL_BLACK: RGB = [0.03, 0.025, 0.025]
const CATKIN_BROWN: RGB = [0.09, 0.05, 0.04]
const CATKIN_YELLOW: RGB = [0.3, 0.24, 0.05]
const PROPAGULE_GREEN: RGB = [0.07, 0.11, 0.03]
const PROPAGULE_BROWN: RGB = [0.1, 0.07, 0.03]

const TROPICAL_PALMS = (day: PhenologyDay): boolean => day.place.climate === 'tropical'

/**
 * Birch catkins (Woodland Trust, Forestry Commission, USDA Woody Plant Seed
 * Manual): the male catkins form in late summer and hang closed, brown,
 * through the winter (3–4 cm); they open yellow and lengthen to 6–8 cm as the
 * leaves come (a few weeks round leaf-out: April–May in Britain); the female
 * catkins ripen green to brown from July and break up from September,
 * shedding their winged seeds into the winter. By the climate's leaf days.
 */
function birchToday(d: number, day: PhenologyDay): { crop: number; stages: FruitStage[] } {
  const leaf = LEAF_DAYS[day.place.climate as Climate] ?? LEAF_DAYS.boreal!
  const open = band(d, leaf.out - 20, leaf.out - 5, leaf.out + 10, leaf.out + 20)
  const stages: FruitStage[] = []
  // Male catkins: formed from ~d 220, closed until they open, gone after.
  if (within(d, 220, leaf.out + 20)) stages.push(stage(CATKIN_BROWN, 1 - open, 0.5, 0.6))
  if (open > 0) stages.push(stage(CATKIN_YELLOW, open, 1, 1))
  // Female catkins: green from flowering, brown from early August, breaking
  // up from mid-September to early winter.
  const shatter = 1 - band(d, leaf.out, leaf.out + 30, 255, 330)
  if (within(d, leaf.out, 330)) {
    const brown = band(d, 215, 245, 330, 331)
    stages.push(stage(FRUIT_GREEN, 0.6 * (1 - brown) * (1 - shatter), 0.45, 0.8))
    stages.push(stage(CATKIN_BROWN, 0.6 * brown * (1 - shatter), 0.45, 0.9))
  }
  const total = stages.reduce((s, x) => s + x.share, 0)
  return { crop: Math.min(1, total), stages }
}

/**
 * Norway and Sitka spruce cones (Conifer Society, WSL MastWeb, Scandinavian
 * Mountains): ruby-red female cones stand upright at the top in May, turn green
 * and hang through the summer, brown and 10–15 cm by October; the seeds fall
 * over the winter and spring and the empty cones hang until the next autumn.
 * The crop is this year's mast (May on) plus last year's (until ~late
 * September).
 */
function spruceToday(d: number, day: PhenologyDay): { crop: number; stages: FruitStage[] } {
  const year = Number(day.date.slice(0, 4))
  // The cone year starts in May on the day's own clock (southern days a half year on).
  const shifted = day.latitudeDeg < 0 && Number(day.date.slice(5, 7)) < 7 ? year - 1 : year
  // This year's cones from mid-May; last year's (formed the May before)
  // shedding seed until then, hanging empty, fewer, until late September.
  const now = d >= 135 ? mastYear(shifted, day.place.id) : 0
  const old = d < 270 ? mastYear(shifted - 1, day.place.id) * (d < 135 ? 1 : 0.6) : 0
  const stages: FruitStage[] = []
  if (now > 0) {
    if (d < 160) stages.push(stage(SPRUCE_RED, now, 0.45, 0))
    else if (d < 245) stages.push(stage(CONE_GREEN, now, 0.6 + 0.4 * Math.min(1, (d - 160) / 60), 1))
    else stages.push(stage(SPRUCE_BROWN, now, 1, 1))
  }
  if (old > 0) stages.push(stage(d < 135 ? SPRUCE_BROWN : CONE_GREY, old, 1, 1))
  return { crop: Math.min(1, now + old), stages }
}

/**
 * Olives (FAO, IOC catalogue): fruit set after the late-spring flowering
 * (phenology.ts `BLOOM`), green and growing through the summer, yellow-green
 * then purple from October, violet-black by December; most are picked
 * October–January, the rest hang into late winter.
 */
function oliveToday(d: number): { crop: number; stages: FruitStage[] } {
  const m = monthOf(d)
  const crop = [0.4, 0.2, 0.05, 0, 0, 0.3, 0.8, 1, 1, 1, 0.8, 0.6][m - 1]
  const black = [1, 1, 1, 0, 0, 0, 0, 0, 0, 0.1, 0.4, 0.8][m - 1]
  const purple = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.4, 0.2][m - 1]
  const size = m === 6 ? 0.4 : m === 7 ? 0.7 : 1
  return {
    crop,
    stages: [stage(OLIVE_GREEN, 1 - black - purple, size, 1), stage(OLIVE_PURPLE, purple, 1, 1), stage(OLIVE_BLACK, black, 1, 1)].filter(s => s.share > 0)
  }
}

/**
 * Stone-pine cones (Gymnosperm Database, Conifer Society, Portuguese
 * phenology study): three years to ripen, so every crown carries green, round
 * cones of two years and the ripe ovoid ones, shiny chestnut-brown from
 * October–November; the seeds fall in the summer and the open grey cones hang
 * on a while.
 */
function stonePineToday(d: number): { crop: number; stages: FruitStage[] } {
  const ripe = within(d, first(10), first(6)) ? 0.35 : 0.15
  const open = within(d, first(6), first(10)) ? 0.3 : 0.15
  return { crop: 1, stages: [stage(CONE_GREEN, 1 - ripe - open, 0.65, 0.4), stage(CHESTNUT, ripe, 1, 0.4), stage(CONE_GREY, open, 1, 0.5)] }
}

/** Canary date palm (NC State, STIHL): plumes in early summer, the hanging
 * bunches green and then orange from autumn into winter, a few dry ones left
 * by spring (est. for the winter tail). */
function datesToday(d: number): { crop: number; stages: FruitStage[] } {
  const m = monthOf(d)
  if (m === 6 || m === 7) return { crop: 0.7, stages: [stage(PLUME_CREAM, 1, 0.7, 0.7)] }
  if (m === 8 || m === 9) return { crop: 0.8, stages: [stage(FRUIT_GREEN, 1, 1, 1)] }
  if (m >= 10 || m <= 2) return { crop: 1, stages: [stage(DATE_ORANGE, 1, 1, 1)] }
  return { crop: 0.3, stages: [stage(COCO_BROWN, 1, 0.8, 1)] }
}

/** Cabbage palm, *Sabal palmetto* (IFAS, Coastal Carolina arboretum): cream
 * plumes June–July, round black fruit ripe October–November (late summer to
 * autumn), gone by winter (est.). */
function sabalToday(d: number): { crop: number; stages: FruitStage[] } {
  const m = monthOf(d)
  if (m === 6 || m === 7) return { crop: 0.8, stages: [stage(PLUME_CREAM, 1, 0.8, 0.6)] }
  if (m === 8 || m === 9) return { crop: 0.8, stages: [stage(FRUIT_GREEN, 1, 0.8, 1)] }
  if (m >= 10 && m <= 12) return { crop: m === 12 ? 0.5 : 1, stages: [stage(SABAL_BLACK, 1, 0.8, 1)] }
  return { crop: 0, stages: [] }
}

/**
 * Fruit by kind (NATURE.md §1.4). Not drawn (too small to see from where
 * trees stand, 9 m and more): cypress cones (2–4 cm), acorns, gumnuts, the
 * umbrella thorn's coiled pods; the flamboyant's 30–60 cm pods are a gap
 * (they hang on the trees that flowered, which only the flowering twins know).
 */
const TREE_FRUIT: readonly FruitRow[] = [
  {
    // Coconuts: 12–15 spikes a year, 8–12 months from set to ripe, so every
    // palm carries nuts all year, green, a few yellow, drying brown
    // (World Agroforestry, FAO Ecocrop). The mesh's own nuts, recoloured.
    kind: 'coconut',
    plant: 'palm',
    where: TROPICAL_PALMS,
    clock: 'season',
    today: () => ({ crop: 1, stages: [stage(COCO_GREEN, 0.55), stage(COCO_YELLOW, 0.15), stage(COCO_BROWN, 0.3)] }),
    peak: 180,
    shape: 'ball',
    length: 0.34,
    width: 0.9,
    perTip: 1,
    top: 0
  },
  {
    // Florida's palms are cabbage palms: no coconuts.
    kind: 'sabal',
    plant: 'palm',
    where: day => day.place.climate !== 'tropical' && day.place.id === 'florida-carolinas',
    clock: 'season',
    today: sabalToday,
    peak: first(10) + 15,
    shape: 'cluster',
    length: 1,
    width: 0.45,
    perTip: 1,
    top: 0
  },
  {
    // Other subtropical palms: Canary date palms (est. for Asia's fan palms).
    kind: 'palm-dates',
    plant: 'palm',
    where: day => day.place.climate !== 'tropical' && day.place.id !== 'florida-carolinas',
    clock: 'season',
    today: datesToday,
    peak: first(11),
    shape: 'cluster',
    length: 1.1,
    width: 0.5,
    perTip: 1,
    top: 0
  },
  {
    // Screw pine (NParks, Agroforestry Net): a 15–25 cm pineapple-like head,
    // green for 1–2 years, then yellow, orange or red; trees carry heads of
    // every age, so all year. Per arm.
    kind: 'pandanus',
    plant: 'pandanus',
    where: () => true,
    clock: 'season',
    today: () => ({ crop: 0.7, stages: [stage(FRUIT_GREEN, 0.6, 1, 1), stage(PANDAN_ORANGE, 0.3, 1, 1), stage(PANDAN_RED, 0.1, 1, 1)] }),
    peak: 180,
    shape: 'ball',
    length: 0.22,
    width: 0.85,
    perTip: 1,
    top: 0
  },
  {
    kind: 'stone-pine-cones',
    plant: 'stone-pine',
    where: () => true,
    clock: 'season',
    today: stonePineToday,
    peak: first(11),
    shape: 'cone',
    length: 0.12,
    width: 0.75,
    // Two years of green cones and the ripe ones: dozens on a crown.
    perTip: 1,
    top: 0
  },
  {
    kind: 'spruce-cones',
    plant: 'conifer',
    where: () => true,
    clock: 'season',
    today: spruceToday,
    peak: first(10) + 10,
    shape: 'cone',
    length: 0.13,
    width: 0.3,
    // A mast year hangs clusters of them from every shoot at the top.
    perTip: 3,
    top: 0.65
  },
  {
    kind: 'olive-fruit',
    plant: 'olive',
    where: () => true,
    clock: 'season',
    today: oliveToday,
    peak: first(11) + 15,
    shape: 'ball',
    length: 0.022,
    width: 0.75,
    // Fewer than grow (a branch carries dozens): 2 cm drupes read as a speckle.
    perTip: 1.5,
    top: 0
  },
  {
    // Tropical almond (IFAS, WorldFloraDB): 5–7 cm drupes, green turning
    // red or dark purple; flowering and fruiting vary from tree to tree, so
    // all year.
    kind: 'almond-fruit',
    plant: 'broadleaf',
    where: day => day.place.climate === 'tropical',
    clock: 'season',
    today: () => ({ crop: 0.7, stages: [stage(FRUIT_GREEN, 0.5), stage(ALMOND_RED, 0.3), stage(ALMOND_PURPLE, 0.2)] }),
    peak: 200,
    shape: 'ball',
    length: 0.06,
    width: 0.65,
    perTip: 0.8,
    top: 0,
    deciduousOnly: true
  },
  {
    kind: 'birch-catkins',
    plant: 'birch',
    where: () => true,
    clock: 'season',
    today: birchToday,
    peak: 110,
    shape: 'catkin',
    length: 0.07,
    width: 0.09,
    perTip: 2,
    top: 0
  },
  {
    // Red mangrove (IFAS, Gill & Tomlinson 1971): 20–40 cm propagules hang
    // 9–10 months after summer flowering; in the tropics flowers and
    // propagules all year with a seasonal swing (est.: one level).
    kind: 'propagules',
    plant: 'rhizophora',
    where: () => true,
    clock: 'season',
    today: () => ({ crop: 0.6, stages: [stage(PROPAGULE_GREEN, 0.75, 1, 1), stage(PROPAGULE_BROWN, 0.25, 0.7, 1)] }),
    peak: 180,
    shape: 'propagule',
    length: 0.3,
    width: 0.05,
    perTip: 1,
    top: 0
  }
]

/** A shrub's fruit by local calendar month: `crops` per month and the
 * stages in month `m` (knowledge/BUSHES.md; colours est.). */
function shrubFruit(
  species: ShrubKind & FruitKind,
  crops: readonly number[],
  stages: (m: number) => FruitStage[],
  shape: FruitShape,
  length: number,
  width: number,
  perTip: number,
  peakMonth: number,
  cluster?: FruitRow['cluster']
): FruitRow {
  const s = SHRUBS.find(x => x.species === species)!
  return {
    kind: species,
    plant: 'bush',
    species,
    where: day => shrubGrows(s, day),
    clock: 'local',
    today: d => {
      const m = monthOf(d)
      return { crop: crops[m - 1], stages: crops[m - 1] > 0 ? stages(m) : [] }
    },
    peak: first(peakMonth) + 14,
    shape,
    length,
    width,
    perTip,
    top: 0,
    ...(cluster != null ? { cluster } : {})
  }
}

const ORANGE_BERRY: RGB = [0.48, 0.08, 0.012]
const HIP_RED: RGB = [0.4, 0.035, 0.03]
const SLOE: RGB = [0.05, 0.05, 0.09]
const HAW_RED: RGB = [0.15, 0.022, 0.011]
const BERRY_RED: RGB = [0.3, 0.03, 0.03]
const BLUE_BLACK: RGB = [0.04, 0.03, 0.07]
const ARBUTUS_RED: RGB = [0.4, 0.05, 0.02]
const ARBUTUS_ORANGE: RGB = [0.5, 0.18, 0.02]
const ARBUTUS_YELLOW: RGB = [0.45, 0.35, 0.05]
const GRAPE_PURPLE: RGB = [0.12, 0.03, 0.08]
const NAUPAKA_WHITE: RGB = [0.6, 0.6, 0.58]
const PALMETTO_ORANGE: RGB = [0.5, 0.3, 0.03]
const BANKSIA_YELLOW: RGB = [0.5, 0.43, 0.13]
const OLD_CONE: RGB = [0.15, 0.13, 0.11]
const SALAL_PURPLE: RGB = [0.05, 0.02, 0.05]
const PLUM_CRIMSON: RGB = [0.35, 0.02, 0.04]
const WILLOW_SILVER: RGB = [0.35, 0.34, 0.27]
const WILLOW_YELLOW: RGB = [0.42, 0.33, 0.06]
const WILLOW_FLUFF: RGB = [0.6, 0.6, 0.58]

/** Green turning to `ripe` over the months in `turning` (share ripe). */
const ripening = (ripe: RGB, share: readonly number[], size = 1) => (m: number): FruitStage[] =>
  [stage(FRUIT_GREEN, 1 - share[m - 1], size * (share[m - 1] > 0 ? 1 : 0.8)), stage(ripe, share[m - 1], size)].filter(x => x.share > 0)

/**
 * Willow catkins on northern scrub (Salix: silky grey "pussy willow" buds
 * opening yellow as the leaves come, red female ones on arctic willow; then
 * white seed fluff blowing for a few weeks): by the climate's leaf days.
 */
function willowToday(d: number, day: PhenologyDay): { crop: number; stages: FruitStage[] } {
  const leaf = LEAF_DAYS[day.place.climate as Climate] ?? LEAF_DAYS.boreal!
  const catkin = band(d, leaf.out - 25, leaf.out - 15, leaf.out + 5, leaf.out + 12)
  const fluff = band(d, leaf.out + 8, leaf.out + 15, leaf.out + 35, leaf.out + 45)
  const open = band(d, leaf.out - 12, leaf.out - 5, leaf.out + 5, leaf.out + 12)
  const stages: FruitStage[] = []
  if (catkin > 0) stages.push(stage(WILLOW_SILVER, catkin * (1 - open), 0.7, 0.2), stage(WILLOW_YELLOW, catkin * open, 1, 0.3))
  if (fluff > 0) stages.push(stage(WILLOW_FLUFF, fluff, 1.2, 0.4))
  const total = stages.reduce((a, x) => a + x.share, 0)
  return { crop: Math.min(1, total), stages: stages.filter(x => x.share > 0) }
}

/** Bushes' fruit (knowledge/BUSHES.md). Spanish broom's pods, mānuka's and
 * tea-tree's capsules and lupine pods aren't drawn (dry, brown, small). */
const SHRUB_FRUIT: readonly FruitRow[] = [
  // Sea buckthorn: orange berries packed along the twigs, ripe August–
  // September, hanging all winter unless the birds take them.
  shrubFruit('sea-buckthorn', [1, 0.6, 0.2, 0, 0, 0, 0.3, 0.8, 1, 1, 1, 1], ripening(ORANGE_BERRY, [1, 1, 1, 0, 0, 0, 0, 0.7, 1, 1, 1, 1]), 'ball', 0.008, 0.8, 0.7, 10, { count: 14, spread: 0.02, along: 5 }),
  // Japanese rose: hips like small tomatoes, red-orange from August, into January.
  shrubFruit('rugosa-rose', [0.2, 0.1, 0, 0, 0, 0, 0.2, 0.6, 1, 1, 0.7, 0.4], ripening(HIP_RED, [1, 1, 0, 0, 0, 0, 0, 0.5, 1, 1, 1, 1]), 'ball', 0.022, 0.95, 0.6, 9),
  // Blackthorn: sloes blue-black September–October, a few into winter.
  shrubFruit('blackthorn', [0.2, 0, 0, 0, 0, 0.2, 0.4, 0.7, 1, 1, 0.8, 0.4], ripening(SLOE, [1, 0, 0, 0, 0, 0, 0, 0.3, 1, 1, 1, 1], 1), 'ball', 0.013, 0.95, 1.5, 10),
  // Hawthorn: haws deep red from late September, on the bush into winter.
  shrubFruit('hawthorn', [0.4, 0.2, 0, 0, 0, 0, 0.3, 0.6, 1, 1, 1, 0.7], ripening(HAW_RED, [1, 1, 0, 0, 0, 0, 0, 0.3, 0.8, 1, 1, 1]), 'ball', 0.01, 0.85, 0.5, 10, { count: 9, spread: 0.025 }),
  // Lentisk: clusters of 5 mm drupes, red through summer and autumn,
  // blackening into winter.
  shrubFruit(
    'lentisk',
    [0.6, 0.3, 0, 0, 0, 0.2, 0.5, 0.8, 1, 1, 1, 0.8],
    m => {
      const black = [0.9, 1, 0, 0, 0, 0, 0, 0, 0.1, 0.3, 0.5, 0.7][m - 1]
      const red = m >= 6 && m <= 8 ? 0.5 : 1 - black
      return [stage(FRUIT_GREEN, Math.max(0, 1 - black - red)), stage(BERRY_RED, red), stage(OLIVE_BLACK, black)].filter(x => x.share > 0)
    },
    'ball',
    0.005,
    1,
    0.6,
    10,
    { count: 12, spread: 0.02 }
  ),
  // Strawberry tree: a year to ripen, green, yellow, orange, red; ripe
  // October–December with the next flowers.
  shrubFruit(
    'strawberry-tree',
    [0.3, 0.2, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.9, 1, 1, 0.6],
    m =>
      m >= 10 || m === 1
        ? [stage(ARBUTUS_RED, 0.5), stage(ARBUTUS_ORANGE, 0.3), stage(ARBUTUS_YELLOW, 0.2)]
        : m === 9
          ? [stage(ARBUTUS_YELLOW, 0.5), stage(FRUIT_GREEN, 0.5, 0.9)]
          : [stage(FRUIT_GREEN, 1, 0.6)],
    'ball',
    0.02,
    1,
    0.8,
    11
  ),
  // Myrtle: blue-black berries November–January (est.).
  shrubFruit('myrtle', [0.8, 0.4, 0, 0, 0, 0, 0, 0.3, 0.6, 0.8, 1, 1], ripening(BLUE_BLACK, [1, 1, 0, 0, 0, 0, 0, 0, 0, 0.3, 0.9, 1]), 'ball', 0.009, 0.85, 0.5, 12, { count: 4, spread: 0.02 }),
  // Sea grape: hanging bunches, green from early summer, deep purple late
  // summer (IFAS); ripening unevenly.
  shrubFruit('sea-grape', [0, 0, 0, 0, 0, 0.4, 0.8, 1, 1, 0.5, 0.1, 0], ripening(GRAPE_PURPLE, [0, 0, 0, 0, 0, 0, 0.2, 0.6, 0.8, 0.9, 1, 0]), 'cluster', 0.2, 0.3, 0.25, 9),
  // Beach naupaka: berries green turning white, all year.
  shrubFruit('naupaka', [0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7, 0.7], () => [stage(FRUIT_GREEN, 0.4, 0.8), stage(NAUPAKA_WHITE, 0.6)], 'ball', 0.01, 0.9, 0.5, 6, { count: 4, spread: 0.02 }),
  // Saw palmetto: drupes in bunches, green, orange-yellow, then blue-black
  // (FNA), late summer to autumn (est. months).
  shrubFruit(
    'saw-palmetto',
    [0, 0, 0, 0, 0, 0.3, 0.6, 0.9, 1, 0.8, 0.3, 0],
    m => (m <= 7 ? [stage(FRUIT_GREEN, 1)] : m === 8 ? [stage(FRUIT_GREEN, 0.4), stage(PALMETTO_ORANGE, 0.6)] : [stage(PALMETTO_ORANGE, 0.3), stage(BLUE_BLACK, 0.7)]),
    'cluster',
    0.25,
    0.35,
    0.15,
    9
  ),
  // Coast banksia: pale yellow spikes January–July (local), standing up off
  // the twigs, withering to grey seed cones that stay for years.
  shrubFruit(
    'coast-banksia',
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    m => {
      const spike = [0.5, 0.7, 1, 1, 1, 0.8, 0.5, 0, 0, 0, 0, 0.2][m - 1] * 0.6
      return [stage(BANKSIA_YELLOW, spike, 1, 0), stage(OLD_CONE, 1 - spike, 0.9, 0.1)].filter(x => x.share > 0)
    },
    'cone',
    0.11,
    0.6,
    0.15,
    4
  ),
  // Salal: dark purple berries in August–September (local).
  shrubFruit('salal', [0, 0, 0, 0, 0, 0, 0.4, 1, 0.8, 0.3, 0, 0], ripening(SALAL_PURPLE, [0, 0, 0, 0, 0, 0, 0.2, 0.9, 1, 1, 0, 0]), 'ball', 0.009, 0.95, 0.5, 8, { count: 8, spread: 0.02, along: 3 }),
  // Calafate: blue-black berries, ripe late February – March (local).
  shrubFruit('calafate', [0.3, 0.8, 1, 0.5, 0, 0, 0, 0, 0, 0, 0, 0.1], ripening(BLUE_BLACK, [0, 0.6, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0]), 'ball', 0.01, 0.95, 0.6, 3, { count: 5, spread: 0.02 }),
  // Natal plum: crimson plums 3–5 cm, summer into autumn (local), some all year.
  shrubFruit('natal-plum', [1, 1, 0.8, 0.6, 0.4, 0.2, 0.1, 0.1, 0.1, 0.1, 0.2, 0.6], ripening(PLUM_CRIMSON, [0.8, 1, 1, 1, 1, 1, 1, 1, 1, 0.5, 0.2, 0.4]), 'ball', 0.04, 0.8, 0.4, 2),
  {
    kind: 'willow',
    plant: 'bush',
    species: 'willow',
    where: day => shrubGrows(SHRUBS.find(x => x.species === 'willow')!, day),
    clock: 'season',
    today: willowToday,
    // Catkins on boreal willows, seed fluff on temperate ones (a forced row).
    peak: 128,
    shape: 'catkin',
    length: 0.03,
    width: 0.4,
    perTip: 2,
    top: 0
  }
]
/** Every fruit row: trees', then bushes'. */
export const FRUIT: readonly FruitRow[] = [...TREE_FRUIT, ...SHRUB_FRUIT]

/** What the fruit table reads from a day, with the spec's force. */
export interface FruitDay extends PhenologyDay {
  overrides?: PhenologyDay['overrides'] & { fruit?: boolean | readonly FruitKind[] }
}

/** The rows on `plant` today (`props.fruit`: true, every row that grows
 * here at its peak; a list, those rows at their peak wherever the day is;
 * false, none). `phenology: false` keeps the mesh's own coconuts only. */
export function fruitFor(plant: FruitRow['plant'], day: FruitDay): readonly Fruiting[] {
  const force = day.overrides?.fruit
  if (force === false || day.overrides?.phenology === false) return []
  const rows = FRUIT.filter(r => r.plant === plant && (Array.isArray(force) ? force.includes(r.kind) : r.where(day)))
  return rows.flatMap(row => {
    const d = force != null ? row.peak : row.clock === 'local' ? dayOfYear(day.date) : seasonDay(day)
    const t = row.today(d, day)
    const total = t.stages.reduce((s, x) => s + x.share, 0)
    const crop = force != null ? 1 : t.crop
    if (crop <= 0 || total <= 0) return []
    const crowns = row.deciduousOnly === true && plant !== 'rhizophora' ? deciduousShare(plant, { climate: day.place.climate, placeId: day.place.id, south: day.latitudeDeg < 0 }) : 1
    return [{ row, crop, crowns, stages: t.stages.map(s => ({ ...s, share: s.share / total })) }]
  })
}

/** The stage a fruit with hash `h` (0–1) takes. */
export function fruitStage(f: Fruiting, h: number): FruitStage {
  let acc = 0
  for (const s of f.stages) {
    acc += s.share
    if (h < acc) return s
  }
  return f.stages[f.stages.length - 1]
}

/** `season` with today's fruit on it; a kind in plain summer leaf (no
 * season) gets one that changes nothing else. */
export function withFruit(season: PlantSeason | undefined, fruit: readonly Fruiting[], phen: Phenology): PlantSeason | undefined {
  if (fruit.length === 0) return season
  return { ...(season ?? { on: 1, turned: 0, fresh: 0, dry: phen.dry, deciduous: 0, autumn: [] }), fruit }
}
