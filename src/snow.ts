// Lying snow and the ice foot (SEASONS.md §4.1, plans/SNOW.md): the day's choice,
// by climate, place and date in the day's own hemisphere. How it looks follows
// from this and world position alone: terrain.ts, props/snowCap.ts,
// props/iceFoot.ts. Pure, no three.js.

import type { Climate } from './biome'
import { band } from './phenology'
import { Random } from './random'
import { seasonDay, type Day } from './seasons'

export interface SnowParams {
  /** How much of the open ground lies under snow (0–1). */
  cover: number
  /** An ice foot at the spring high water, and frozen spray on the rocks. */
  iceFoot: boolean
}

/** A season: rising from day `a` to `b`, full, falling from `c` to `e`
 * (northern-equivalent days, `band`), and the chance per day at its peak. */
interface SnowSeason {
  a: number
  b: number
  c: number
  e: number
  chance: number
}

/** When snow lies, by climate; other climates' coasts have none. */
export const SNOW_COVER: Partial<Record<Climate, SnowSeason>> = {
  // Svalbard's pack is gone within 2–3 weeks of early June; first lasting snow
  // as the tundra's leaves finish (SEASONS.md §2.5).
  polar: { a: 258, b: 305, c: 140, e: 175, chance: 0.95 },
  boreal: { a: 296, b: 335, c: 85, e: 130, chance: 0.6 },
  temperate: { a: 325, b: 355, c: 50, e: 80, chance: 0.04 }
}

/** One place's peak chance, where it differs from its climate's (SEASONS.md
 * §4.1). A place with two climates has a row for each that differs. */
export const SNOW_PLACES: Readonly<Record<string, Partial<Record<Climate, number>>>> = {
  // Mild, wet subantarctic islands: snow comes and goes at sea level.
  'kerguelen-heard': { polar: 0.35 },
  'nz-subantarctic': { polar: 0.1, temperate: 0 },
  'south-georgia': { polar: 0.7 },
  'south-shetland': { polar: 0.85 },
  'tierra-del-fuego': { polar: 0.3, temperate: 0.2 },
  // Tromsø: 188 days a year with ≥ 5 cm on the ground (met.no, 1971–2000).
  'norway-north': { boreal: 0.95 },
  'kamchatka-kurils-aleutians': { boreal: 0.85 },
  'cook-inlet': { boreal: 0.9 },
  'russian-far-east': { boreal: 0.8 },
  'gulf-alaska': { boreal: 0.5 },
  'se-alaska': { boreal: 0.4, temperate: 0.25 },
  // Helsinki: a snow season of almost 100 days.
  baltic: { boreal: 0.7, temperate: 0.25 },
  iceland: { boreal: 0.45 },
  'iceland-faroe': { boreal: 0.2, temperate: 0.12 },
  // Continental winters on a temperate coast.
  maine: { temperate: 0.5 },
  pei: { temperate: 0.6 },
  'nova-scotia': { boreal: 0.6, temperate: 0.5 },
  newfoundland: { boreal: 0.7, temperate: 0.5 },
  'yellow-sea': { temperate: 0.15 },
  japan: { temperate: 0.15 },
  // Bergen: snow on about 14% of days, November–March.
  'norway-west': { temperate: 0.12 },
  'wadden-north-sea': { temperate: 0.08 },
  scotland: { temperate: 0.06 },
  falklands: { temperate: 0.08 },
  'patagonia-fjords': { temperate: 0.08 },
  // Almost never at sea level.
  'new-zealand-north': { temperate: 0 },
  'new-zealand-south': { temperate: 0.01 },
  tasmania: { temperate: 0 },
  'portugal-morocco': { temperate: 0 },
  brittany: { temperate: 0.01 },
  'mont-saint-michel': { temperate: 0.02 },
  'cornwall-wales': { temperate: 0.01 },
  'bristol-channel': { temperate: 0.02 }
}

/** When an ice foot stands, given snow: freeze-up comes last, after the beach
 * freezes and snow lies (Short & Wiseman); about six months at Nome. */
const ICE_FOOT_SEASON = { a: 295, b: 325, c: 135, e: 165 }

/** The chance of an ice foot on a snow day: the polar climate's, and where
 * else the sea freezes along the shore. Open, ice-free coasts have none
 * (north Norway, the subantarctic islands). */
const ICE_FOOT_POLAR = 0.8
export const ICE_FOOT_PLACES: Readonly<Record<string, number>> = {
  'kerguelen-heard': 0,
  'nz-subantarctic': 0,
  'tierra-del-fuego': 0,
  'south-georgia': 0.1,
  'norway-north': 0,
  baltic: 0.5,
  'russian-far-east': 0.6,
  'cook-inlet': 0.6,
  'kamchatka-kurils-aleutians': 0.2,
  newfoundland: 0.3,
  pei: 0.3
}

/** The chance of lying snow on this day here (0–1). No draw. */
export function snowChance(placeId: string, climate: Climate, day: Day): number {
  const season = SNOW_COVER[climate]
  if (season == null) return 0
  const peak = SNOW_PLACES[placeId]?.[climate] ?? season.chance
  return peak * band(seasonDay(day), season.a, season.b, season.c, season.e)
}

/** The chance of an ice foot on a snow day here (0–1). No draw. */
export function iceFootChance(placeId: string, climate: Climate, day: Day): number {
  const share = ICE_FOOT_PLACES[placeId] ?? (climate === 'polar' ? ICE_FOOT_POLAR : 0)
  return share * band(seasonDay(day), ICE_FOOT_SEASON.a, ICE_FOOT_SEASON.b, ICE_FOOT_SEASON.c, ICE_FOOT_SEASON.e)
}

/**
 * The day's snow, on its own stream. Thin and patchy in the season's shoulders
 * and where snow comes and goes; nearly closed in deep polar winter. A number
 * forces the cover, `true` a typical one for the date (a winter's, out of
 * season); `phenology: false` is the summer look, so none unless forced.
 */
export function pickSnow(
  seed: string,
  placeId: string,
  climate: Climate,
  day: Day,
  force?: boolean | number | null,
  forceFoot?: boolean,
  phenology?: boolean
): SnowParams | null {
  const rng = Random.derive(seed, 'snow')
  const lies = rng.float() < snowChance(placeId, climate, day)
  const roll = rng.float()
  const footRoll = rng.float()
  const present = force === undefined ? lies && phenology !== false : force !== null && force !== false
  if (!present) return null
  const season = SNOW_COVER[climate]
  const peak = SNOW_PLACES[placeId]?.[climate] ?? season?.chance ?? 0
  const inSeason = season == null ? 0 : band(seasonDay(day), season.a, season.b, season.c, season.e)
  const deep = Math.max(inSeason, force === undefined ? 0 : 0.7) * (0.4 + 0.6 * peak)
  const cover = typeof force === 'number' ? force : 0.3 + 0.55 * deep + (0.2 - 0.05 * deep) * roll
  return { cover: Math.min(1, cover), iceFoot: forceFoot ?? footRoll < iceFootChance(placeId, climate, day) }
}
