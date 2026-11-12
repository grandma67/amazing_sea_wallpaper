import type { RGB } from './biome'
import type { SceneParams } from './params'
import { isWetDay } from './phenology'
import { Random } from './random'

// Bloom years (NATURE_PLAN phase 16, NATURE.md §5): the choice, apart from
// the props (props/bloomYears.ts places the plants) so the terrain can tint
// the ground without importing them. The desert coasts that flower in some
// years or every spring: the Atacama's desierto florido after El Niño rain;
// Namaqualand, the Sandveld and the Cape West Coast every year at a strength
// of its own; Baja's Pacific slopes after a wet winter. Whether a year blooms
// comes from one stream per region and calendar year, so every day of a year
// agrees and a spec's seed doesn't change it.

export const BLOOM_PLANTS = ['cistanthe', 'cistanthe-yellow', 'nolana', 'orange-daisy', 'white-daisy', 'baja-gold', 'baja-purple'] as const
export type BloomPlant = (typeof BLOOM_PLANTS)[number]
export type BloomRegion = 'atacama' | 'namaqualand' | 'baja'

/** Linear albedo of each plant's flowers (NATURE_PLAN §16: Cistanthe and
 * Nolana est.; Ursinia measured from Poly Haven's scan, §1; white daisy and
 * Baja est.), its plant size (m) and how many flowers it carries. */
export const BLOOM_LOOK: Record<BloomPlant, { petal: RGB; centre: RGB; size: number; flowers: [number, number]; flower: number; daisy: boolean }> = {
  cistanthe: { petal: [0.46, 0.02, 0.26], centre: [0.6, 0.45, 0.05], size: 0.25, flowers: [12, 24], flower: 0.045, daisy: false },
  'cistanthe-yellow': { petal: [0.65, 0.44, 0.02], centre: [0.5, 0.3, 0.02], size: 0.25, flowers: [12, 24], flower: 0.045, daisy: false },
  nolana: { petal: [0.38, 0.35, 0.6], centre: [0.6, 0.55, 0.3], size: 0.3, flowers: [5, 12], flower: 0.03, daisy: false },
  'orange-daisy': { petal: [0.61, 0.19, 0.02], centre: [0.08, 0.05, 0.02], size: 0.3, flowers: [5, 10], flower: 0.04, daisy: true },
  'white-daisy': { petal: [0.72, 0.7, 0.66], centre: [0.25, 0.18, 0.05], size: 0.3, flowers: [5, 10], flower: 0.045, daisy: true },
  'baja-gold': { petal: [0.7, 0.45, 0.03], centre: [0.5, 0.3, 0.02], size: 0.3, flowers: [5, 12], flower: 0.04, daisy: false },
  'baja-purple': { petal: [0.3, 0.1, 0.35], centre: [0.4, 0.35, 0.1], size: 0.3, flowers: [6, 14], flower: 0.03, daisy: false }
}

/** The annuals' leaves (est.: succulent grey-green). */
export const BLOOM_LEAF: RGB = [0.07, 0.09, 0.055]

interface RegionRow {
  /** The region's plants and their shares. */
  plants: readonly [BloomPlant, number][]
}

export const BLOOM_REGIONS: Record<BloomRegion, RegionRow> = {
  atacama: { plants: [['cistanthe', 0.55], ['cistanthe-yellow', 0.2], ['nolana', 0.25]] },
  namaqualand: { plants: [['orange-daisy', 0.6], ['white-daisy', 0.4]] },
  baja: { plants: [['baja-gold', 0.6], ['baja-purple', 0.4]] }
}

/** Which region a day is in (place, ocean, latitude), or null. */
export function bloomRegion(params: Pick<SceneParams, 'place' | 'latitudeDeg' | 'sea'>): BloomRegion | null {
  const { id } = params.place
  // Chañaral to Vallenar and on south (Conaf; Universidad de Chile).
  if (id === 'atacama-peru' && params.latitudeDeg <= -26) return 'atacama'
  // Namaqualand and the Sandveld; the Cape West Coast north of 33.5°S on the Atlantic.
  if (id === 'namibia' && params.latitudeDeg <= -29) return 'namaqualand'
  if (id === 'cape' && params.sea.ocean === 'atlantic' && params.latitudeDeg >= -33.5) return 'namaqualand'
  // Baja's Pacific side (the Gulf side flowers after hurricanes only).
  if (id === 'baja-sonora' && params.sea.ocean === 'pacific') return 'baja'
  return null
}

/** Each bloom place's region, for a forced bloom. */
const PLACE_REGION: Partial<Record<string, BloomRegion>> = { 'atacama-peru': 'atacama', namibia: 'namaqualand', cape: 'namaqualand', 'baja-sonora': 'baja' }

/** The year's draw for a region: one stream per region and calendar year. */
export function bloomYear(region: BloomRegion, year: number): { blooms: boolean; strength: number; early: boolean } {
  const rng = Random.derive(`amazing-sea:${year}`, `bloom:${region}`)
  const [a, b, c] = [rng.float(), rng.float(), rng.float()]
  if (region === 'atacama') {
    // 13 events in 35 years (0.37), 1 in 3 strong (1997, 2015); an early
    // Jul–Aug flush in 1 bloom year in 4 (2024, est.).
    return { blooms: a < 0.37, strength: b < 1 / 3 ? 1 : 0.5, early: c < 0.25 }
  }
  // Namaqualand every year, 0.3–1 (est.); Baja in 0.3 of years (est.:
  // southern California's superblooms 2017, 2019, 2023, 2024).
  if (region === 'namaqualand') return { blooms: true, strength: 0.3 + 0.7 * b, early: false }
  return { blooms: a < 0.3, strength: 0.6 + 0.4 * b, early: false }
}

const dayOf = (date: string): number => {
  const [y, m, d] = date.split('-').map(Number)
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000)
}
const ramp = (d: number, a: number, b: number, c: number, e: number): number => (d < a || d > e ? 0 : d < b ? (d - a) / (b - a) : d <= c ? 1 : (e - d) / (e - c))

/** The season's share on this local calendar day (0..1). */
function seasonShare(region: BloomRegion, params: SceneParams, early: boolean): number {
  const d = dayOf(params.date)
  const m = Number(params.date.slice(5, 7))
  if (region === 'atacama') return Math.max(ramp(d, 244, 263, 304, 324), early ? 0.3 * ramp(d, 182, 196, 229, 243) : 0)
  if (region === 'namaqualand') {
    // The Cape West Coast: Aug 1 – Sep 30 (West Coast NP).
    if (params.place.id === 'cape') return m === 8 || m === 9 ? 1 : 0
    return m === 8 || m === 9 ? 1 : m === 7 || m === 10 ? 0.4 : 0
  }
  return m === 2 || m === 3 ? 1 : m === 4 ? 0.4 : 0
}

export interface DesertBloom {
  region: BloomRegion
  /** 0..1: how much is in flower today (year × season, closed by cloud). */
  strength: number
  plants: readonly [BloomPlant, number][]
  /** The flowers' mean colour, for far ground and slopes. */
  far: RGB
  /** Far patches are one flower's: the main one's colour, the rest's mean
   * and their share (fields are sheets of one colour, not a mix). */
  farMain: RGB
  farRest: RGB
  restShare: number
}

/**
 * Today's bloom, or null. `props.desertBloom`: true, a strong bloom where the
 * place has a region row; a number, that strength; false, none. Daisies
 * close on cloudy days (×0.3, est.). No draws on the day's streams.
 */
export function desertBloomFor(params: SceneParams): DesertBloom | null {
  const force = params.overrides?.desertBloom
  if (force === false || params.overrides?.phenology === false || params.coast.type === 'open-sea') return null
  // Forced: the place's region, whatever the day's latitude or ocean.
  const region = bloomRegion(params) ?? (force != null ? PLACE_REGION[params.place.id] ?? null : null)
  if (region == null) return null
  let strength: number
  if (force === true) strength = 1
  else if (typeof force === 'number') strength = force
  else {
    const year = bloomYear(region, Number(params.date.slice(0, 4)))
    strength = year.blooms ? year.strength * seasonShare(region, params, year.early) : 0
  }
  if (params.snow != null) return null
  const plants = BLOOM_REGIONS[region].plants
  const closed = region === 'namaqualand' && isWetDay(params) ? 0.3 : 1
  strength *= closed
  if (strength <= 0) return null
  // From afar a carpet is flowers facing the sun over their leaves (85 : 15,
  // est.). Averaging orange and white daisies gave a salmon as pale as the
  // soil: each far patch is one flower's colour instead.
  const seen = (c: RGB): RGB => [0, 1, 2].map(i => 0.85 * c[i] + 0.15 * BLOOM_LEAF[i]) as RGB
  const [main, ...rest] = plants
  const restShare = rest.reduce((s, [, w]) => s + w, 0)
  const farMain = seen(BLOOM_LOOK[main[0]].petal)
  const farRest = restShare > 0 ? seen([0, 1, 2].map(i => rest.reduce((s, [p, w]) => s + BLOOM_LOOK[p].petal[i] * w, 0) / restShare) as RGB) : farMain
  const far = [0, 1, 2].map(i => farMain[i] * (1 - restShare) + farRest[i] * restShare) as RGB
  return { region, strength, plants, far, farMain, farRest, restShare }
}

