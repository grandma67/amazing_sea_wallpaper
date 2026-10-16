import type { Biome } from './biome'
import type { OceanName } from './oceans'
import type { LandformParams, TimeOfDay, WeatherKind } from './params'
import type { Random } from './random'

// Cloud events tied to a place or a storm, each on its own stream (see
// params.ts): the shelf cloud at a storm's leading edge, the Morning Glory
// roll cloud, lenticular clouds over mountains, the pyrocumulus cap on an
// eruption plume. The meshes are in props/.

/** Shelf cloud (arcus): a long, low wedge along a storm's gust front. */
export interface ShelfCloudParams {
  /** Toward the storm (deg, world): the shelf faces the camera across it. */
  azimuthDeg: number
  /** Ground distance to its leading edge (m). */
  distanceM: number
  /** Height of the leading edge (m). */
  lipHeightM: number
  /** How far back it reaches into the storm (m). */
  depthM: number
  /** Stacked shelves on its face. */
  tiers: number
  seed: number
}

/** ~40% of storm days, toward the rain curtains. */
export function shelfCloudFor(
  storm: { curtains: { azimuthDeg: number }[] } | null,
  rng: Random,
  force?: boolean | null
): ShelfCloudParams | null {
  const drawn = rng.chance(0.4)
  const shelf: ShelfCloudParams = {
    azimuthDeg: 0,
    distanceM: rng.range(3500, 8000),
    lipHeightM: rng.range(220, 400),
    depthM: rng.range(2500, 4500),
    tiers: rng.int(1, 3),
    seed: rng.range(0, 1000)
  }
  if (storm == null || storm.curtains.length === 0 || !(force === undefined ? drawn : force === true)) return null
  // The storm comes from where its rain is: the curtains' mean direction.
  const [x, z] = storm.curtains.reduce(([sx, sz], c) => [sx + Math.sin((c.azimuthDeg * Math.PI) / 180), sz + Math.cos((c.azimuthDeg * Math.PI) / 180)], [0, 0])
  shelf.azimuthDeg = (Math.atan2(x, z) * 180) / Math.PI
  return shelf
}

/** Morning Glory roll cloud (volutus): long horizontal tubes rolling in at
 * dawn. The famous one is over the southern Gulf of Carpentaria
 * (Burketown, Queensland, ~17.5° S), from late September to early November,
 * seen on a good share of mornings in season (a 1979 expedition saw three
 * in two weeks). */
export interface RollCloudParams {
  /** Direction the tubes lie along (deg, world). */
  axisDeg: number
  /** Ground distance to the first tube, and its base and diameter (m). */
  distanceM: number
  baseM: number
  diameterM: number
  /** One to three tubes, one behind the other (m apart). */
  rolls: number
  spacingM: number
  seed: number
}

/** Tropical Indian/Pacific coasts in the south-of-equator band (our tropical
 * latitudes 10–23°), Sep–Nov, just after sunrise, not under heavy cloud. */
export function rollCloudFor(
  day: { biome: Biome['name']; ocean: OceanName; month: number; latitudeDeg: number; timeOfDay: TimeOfDay; evening: boolean; weather: WeatherKind; headingDeg: number },
  rng: Random,
  force?: boolean | null
): RollCloudParams | null {
  const place = day.biome === 'tropical' && (day.ocean === 'indian' || day.ocean === 'pacific') && day.latitudeDeg >= 10
  const season = day.month >= 9 && day.month <= 11
  const dawn = !day.evening && (day.timeOfDay === 'golden-hour' || day.timeOfDay === 'sun-on-horizon')
  const sky = day.weather === 'clear' || day.weather === 'cirrus' || day.weather === 'few' || day.weather === 'scattered'
  const drawn = rng.float() < (place && season && dawn && sky ? 0.2 : 0)
  const roll: RollCloudParams = {
    // Across the view, give or take.
    axisDeg: day.headingDeg + 90 + rng.normal(0, 12),
    distanceM: rng.range(3000, 7000),
    baseM: rng.range(200, 400),
    diameterM: rng.range(600, 1100),
    rolls: rng.weighted([[1, 3], [2, 2], [3, 1]] as const),
    spacingM: rng.range(2500, 5000),
    seed: rng.range(0, 1000)
  }
  return (force === undefined ? drawn : force === true) ? roll : null
}

/** Lenticular clouds (lenticularis): smooth lenses standing still in the
 * wave downwind of a mountain in strong, stable wind; often stacked. */
export interface LenticularParams {
  /** Lenses in the stack, bottom first. */
  count: number
  /** Height of the lowest above the peak (m), lens radius and thickness (m). */
  liftM: number
  radiusM: number
  thicknessM: number
  /** How far downwind of the peak (m). */
  downwindM: number
  seed: number
}

/** Half the days with a mountain or volcano in view and wind ≥ 10 m/s,
 * without a storm or a closed deck. */
export function lenticularFor(
  landform: LandformParams | null,
  windSpeed: number,
  weather: WeatherKind,
  rng: Random,
  force?: boolean | null
): LenticularParams | null {
  const drawn = rng.chance(0.5)
  const lens: LenticularParams = {
    count: rng.weighted([[1, 3], [2, 2], [3, 1]] as const),
    liftM: rng.range(600, 2000),
    radiusM: rng.range(900, 2000),
    thicknessM: rng.range(400, 900),
    downwindM: rng.range(0, 1500),
    seed: rng.range(0, 1000)
  }
  if (landform == null) return null
  const suits = windSpeed >= 10 && weather !== 'storm' && weather !== 'overcast'
  return (force === undefined ? suits && drawn : force === true) ? lens : null
}

