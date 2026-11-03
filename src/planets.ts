import { Body, GeoVector, Illumination } from 'astronomy-engine'

import type { SceneParams } from './params'
import { apply, skyRotation, type SkyClockInput } from './skyClock'

// Planets (NIGHT_SKY phase 5, STARS.md §4): Mercury, Venus, Mars, Jupiter
// and Saturn at their real places among the stars for the date
// (astronomy-engine: geocentric J2000 directions, magnitudes from distance
// and phase), turned into the scene by the sky clock and drawn as stars (the
// phase-2 point spread: at our lenses every disc is under a pixel). Venus and
// Jupiter, brighter than any star, also leave a glitter path on the sea (an
// analytic glint, like a ship's lamp at infinity). At blue hour some days
// frame Venus, the evening or morning "star".

type Vec3 = [number, number, number]

export interface PlanetInfo {
  id: PlanetId
  name: string
  body: Body
  /** Luminance-normalised colour (linear). */
  colour: Vec3
}

export type PlanetId = 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn'

const unit = (c: Vec3): Vec3 => {
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  return [c[0] / l, c[1] / l, c[2] / l]
}

/** Colours as photos show them: Venus white with a little yellow, Jupiter
 * cream, Mars orange, Saturn pale yellow, Mercury pinkish grey (general). */
export const PLANETS: readonly PlanetInfo[] = [
  { id: 'mercury', name: 'Mercury', body: Body.Mercury, colour: unit([1.0, 0.92, 0.85]) },
  { id: 'venus', name: 'Venus', body: Body.Venus, colour: unit([1.0, 0.97, 0.88]) },
  { id: 'mars', name: 'Mars', body: Body.Mars, colour: unit([1.0, 0.62, 0.38]) },
  { id: 'jupiter', name: 'Jupiter', body: Body.Jupiter, colour: unit([1.0, 0.94, 0.82]) },
  { id: 'saturn', name: 'Saturn', body: Body.Saturn, colour: unit([1.0, 0.9, 0.7]) }
]

export interface Planet {
  id: PlanetId
  /** Unit vector, world frame. */
  direction: Vec3
  magnitude: number
}

/** Each planet's J2000 direction and magnitude at noon UTC on `date`. */
export function planetsECI(date: string): { id: PlanetId; eci: Vec3; magnitude: number }[] {
  const t = new Date(`${date}T12:00:00Z`)
  return PLANETS.map(p => {
    const v = GeoVector(p.body, t, true)
    const l = Math.hypot(v.x, v.y, v.z)
    return { id: p.id, eci: [v.x / l, v.y / l, v.z / l], magnitude: Illumination(p.body, t).mag }
  })
}

/** The planets in the scene's sky (all five, above the horizon or not). */
export function planetsIn(input: SkyClockInput): Planet[] {
  const rot = skyRotation(input).matrix
  return planetsECI(input.date).map(p => ({ id: p.id, direction: apply(rot, p.eci), magnitude: p.magnitude }))
}

/** Planets for a scene: only with the sun below the horizon (by day only
 * Venus could show, at the edge of seeing); `off` takes them away. */
export function planetsFor(params: Pick<SceneParams, 'date' | 'latitudeDeg' | 'sunDirection' | 'evening' | 'sunElevationDeg'>, off: boolean): Planet[] {
  if (off || params.sunElevationDeg >= 0) return []
  return planetsIn(params)
}

/** Planets bright enough to leave a glitter path on calm water. */
export const GLITTER_MAGNITUDE = -2.5

/** Visual extinction (Kasten–Young airmass, 0.28 mag per airmass at sea
 * level, STARS.md §2). */
export function extinction(elevationRad: number): number {
  const s = Math.sin(Math.max(elevationRad, 0))
  const airmass = 1 / (s + 0.50572 * (Math.max(elevationRad, 0) * (180 / Math.PI) + 6.07995) ** -1.6364)
  return 10 ** (-0.4 * 0.28 * airmass)
}

/** Planets as takram star records (StarsGeometry: 3 × int16 direction,
 * uint8 magnitude over `range`, uint8 colour), world frame. */
export function planetStarData(planets: Planet[], range: [number, number]): ArrayBuffer {
  const buffer = new ArrayBuffer(planets.length * 10)
  const i16 = new Int16Array(buffer)
  const u8 = new Uint8Array(buffer)
  planets.forEach((p, k) => {
    for (let j = 0; j < 3; j++) i16[k * 5 + j] = Math.round(p.direction[j] * 32767)
    u8[k * 10 + 6] = Math.round(Math.max(0, Math.min(1, (p.magnitude - range[0]) / (range[1] - range[0]))) * 255)
    // The material takes the colour's ratios only (stars.ts normalises it).
    const c = PLANETS.find(q => q.id === p.id)!.colour
    const m = Math.max(...c)
    for (let j = 0; j < 3; j++) u8[k * 10 + 7 + j] = Math.round((c[j] / m) * 255)
  })
  return buffer
}

/** The magnitude range planet records span (Venus to Saturn at its faintest). */
export const PLANET_MAGNITUDES: [number, number] = [-6, 4]
