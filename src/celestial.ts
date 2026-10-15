import { EclipseKind, SearchGlobalSolarEclipse, SearchLunarEclipse } from 'astronomy-engine'

// Moonlight and eclipses.
//
// The moon's brightness falls much faster than its lit fraction: rough
// surfaces cast shadows except when lit from straight behind us (the
// opposition surge). Full moon gives ~0.25 lux; a half moon about a tenth of
// that; a thin crescent under a hundredth. Allen's fit for the moon's
// magnitude at phase angle α (degrees, 0 = full):
//   m(α) = −12.73 + 0.026|α| + 4·10⁻⁹ α⁴
//
// Eclipses happen on real dates. A solar eclipse is a new moon passing in
// front of the sun; seen from the narrow path of totality the sky goes dark
// as deep twilight with a sunset glow all round the horizon and the corona
// around the black moon; elsewhere it's a partial eclipse, a bite out of the
// sun. A lunar eclipse is a full moon in the earth's shadow: the umbra, about
// 2.7 moon diameters across, takes a dark bite, and in totality the moon
// glows copper-red with the sunsets of the whole earth bent into the shadow.

/** Moonlight relative to a full moon, for an elongation from the sun of
 * `elongationDeg` (180 = full). */
export function moonlight(elongationDeg: number): number {
  const alpha = Math.abs(180 - elongationDeg)
  return 10 ** (-0.4 * (0.026 * alpha + 4e-9 * alpha ** 4))
}

export type EclipseType = 'solar-partial' | 'solar-annular' | 'solar-total' | 'lunar-partial' | 'lunar-total'

export interface EclipseParams {
  type: EclipseType
  /** Fraction of the sun's (solar) or the moon's (lunar) disc covered. */
  obscuration: number
  /** Distance between the centres of the two discs, in units of the
   * covered body's radius, and the direction of the offset (radians, on the
   * sky round the covered body). */
  offset: number
  angle: number
  /** Radius of the covering disc (moon for solar, umbra for lunar) in units
   * of the covered body's radius. */
  ratio: number
}

/** Area of the overlap of two discs with radii 1 and `r` whose centres are
 * `d` apart, as a fraction of the unit disc. */
export function overlap(d: number, r: number): number {
  if (d >= 1 + r) return 0
  if (d <= Math.abs(r - 1)) return r >= 1 ? 1 : r * r
  const a = Math.acos((d * d + 1 - r * r) / (2 * d))
  const b = Math.acos((d * d + r * r - 1) / (2 * d * r))
  const area = a + r * r * b - 0.5 * Math.sqrt((-d + 1 + r) * (d + 1 - r) * (d - 1 + r) * (d + 1 + r))
  return area / Math.PI
}

/** The centre distance at which a disc of radius `r` covers `fraction` of
 * the unit disc (bisection; overlap falls as d grows). */
export function offsetFor(fraction: number, r: number): number {
  let lo = Math.max(0, Math.abs(r - 1))
  let hi = 1 + r
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    if (overlap(mid, r) > fraction) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

/** Umbra radius in moon radii at the moon's distance. */
export const UMBRA_RATIO = 2.7

/** The eclipse whose peak falls on `date` (YYYY-MM-DD, UTC), if any.
 * Penumbral lunar eclipses are left out: the eye barely sees them. `pick`
 * draws a number in [0, 1) for the choices the real eclipse leaves open
 * (how much of a partial one we see, the direction of the bite). */
export function eclipseOn(date: string, pick: () => number): EclipseParams | null {
  const start = new Date(`${date}T00:00:00Z`)
  const lunar = SearchLunarEclipse(start)
  if (lunar.peak.date.toISOString().slice(0, 10) === date && lunar.kind !== EclipseKind.Penumbral) {
    if (lunar.kind === EclipseKind.Total) return lunarEclipse(true, 1, lunar.sd_total, pick)
    return lunarEclipse(false, lunar.obscuration, 0, pick)
  }
  const solar = SearchGlobalSolarEclipse(start)
  if (solar.peak.date.toISOString().slice(0, 10) === date) {
    return solarEclipse(solar.kind === EclipseKind.Total ? 'solar-total' : solar.kind === EclipseKind.Annular ? 'solar-annular' : 'solar-partial', pick)
  }
  return null
}

/** A lunar eclipse; `totalityMinutes` is half the length of totality. */
function lunarEclipse(total: boolean, obscuration: number, totalityMinutes: number, pick: () => number): EclipseParams {
  // In totality the moon sits somewhere inside the umbra; a short
  // totality grazes its edge.
  const covered = total ? 1 : Math.max(0.05, obscuration)
  const offset = total
    ? (UMBRA_RATIO - 1) * Math.max(0.1, 1 - totalityMinutes / 55) * (0.8 + 0.2 * pick())
    : offsetFor(covered, UMBRA_RATIO)
  return { type: total ? 'lunar-total' : 'lunar-partial', obscuration: covered, offset, angle: pick() * 2 * Math.PI, ratio: UMBRA_RATIO }
}

function solarEclipse(type: 'solar-total' | 'solar-annular' | 'solar-partial', pick: () => number): EclipseParams {
  const angle = pick() * 2 * Math.PI
  // From the path of totality or annularity; or somewhere off it.
  if (type === 'solar-total') return { type, obscuration: 1, offset: 0.02 * pick(), angle, ratio: 1.04 }
  if (type === 'solar-annular') {
    const ratio = 0.92 + 0.05 * pick()
    return { type, obscuration: ratio * ratio, offset: (1 - ratio) * 0.5 * pick(), angle, ratio }
  }
  const obscuration = 0.3 + 0.55 * pick()
  return { type, obscuration, offset: offsetFor(obscuration, 1.02), angle, ratio: 1.02 }
}

/** An eclipse of this type on any day (scene specs): like a real one, with
 * a 50-minute half-totality or a 30–90% partial lunar eclipse. */
export function eclipseOfType(type: EclipseType, pick: () => number): EclipseParams {
  if (type === 'lunar-total') return lunarEclipse(true, 1, 50, pick)
  if (type === 'lunar-partial') return lunarEclipse(false, 0.3 + 0.6 * pick(), 0, pick)
  return solarEclipse(type, pick)
}
