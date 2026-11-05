// Phenology: what the plants look like on the day (knowledge/SEASONS.md §2,
// plans/SEASONS_PLAN.md). Deciduous leaves turn and fall, grass dries, by
// the day's climate and in its own hemisphere (seasons.ts seasonDay). Not
// random: no draws, so a tree's shape never changes with the season, only
// its leaves (props/trees.ts hashes each leaf).

import type { Climate, RGB, VegetationKind } from './biome'
import { hashCell } from './cellNoise'
import { PLACES } from './places'
import { seasonDay, type Day } from './seasons'

/** What phenology reads from a day (SceneParams has all of it). */
export interface PhenologyDay extends Day {
  place: { id: string; climate: Climate }
  overrides?: { phenology?: boolean }
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
  placeId: string
  south: boolean
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
}

/** Plants in full summer leaf: what every day looked like before. */
export const SUMMER: Omit<Phenology, 'climate' | 'placeId' | 'south'> = { on: 1, turned: 0, fresh: 0, dry: 0, tropical: { on: 1, turned: 0 } }

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
  const season = PLACES.find(p => p.id === day.place.id)?.drySeason
  if (season == null) return 0
  const [south, north] = season.latitudeDeg ?? [-90, 90]
  if (day.latitudeDeg < south || day.latitudeDeg > north) return 0
  const wet = season.wetCoast
  if (wet != null && day.sea?.ocean === wet.ocean && day.latitudeDeg >= wet.latitudeDeg[0] && day.latitudeDeg <= wet.latitudeDeg[1]) return 0
  const dayOfYear = (date: string): number => seasonDay({ date, latitudeDeg: 1 })
  const firstOf = (month: number): number => dayOfYear(`2025-${String(month).padStart(2, '0')}-01`)
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
  return { ...base, on, turned, fresh, dry, tropical: { on: 1 - 0.5 * almond, turned: almond } }
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

/** What a plant builder gets for `kind` today; undefined when it looks as
 * in summer (evergreen, or deciduous in full summer leaf with green grass). */
export function plantSeason(kind: VegetationKind, phen: Phenology): PlantSeason | undefined {
  const deciduous = deciduousShare(kind, phen)
  const leaves = phen.climate === 'tropical' ? { ...phen.tropical, fresh: 0 } : phen
  const leafy = deciduous > 0 && (leaves.on < 1 || leaves.turned > 0 || leaves.fresh > 0)
  if (!leafy && phen.dry === 0) return undefined
  return { on: leaves.on, turned: leaves.turned, fresh: leaves.fresh, dry: phen.dry, deciduous: leafy ? deciduous : 0, autumn: autumnColors(kind, phen) }
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
  if (share === 0) return foliage
  const leaves = phen.climate === 'tropical' ? phen.tropical : phen
  // Far away the turned crowns are dimmer than a lit leaf (shade inside the crown).
  const turned = mix(foliage, mean(autumnColors('broadleaf', phen)).map(v => v * 0.6) as RGB, share * leaves.on * leaves.turned)
  return mix(turned, BARE, share * (1 - leaves.on))
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

/** Ground cover (terrain) with the grass dried toward straw. */
const STRAW: RGB = [0.2, 0.15, 0.075]
export function groundCoverTint(cover: RGB, phen: Phenology): RGB {
  return mix(cover, STRAW, phen.dry * 0.75)
}
