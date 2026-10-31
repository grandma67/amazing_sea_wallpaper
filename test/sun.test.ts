import { describe, expect, it } from 'vitest'

import { REAL_SUN_LATITUDE, solarDeclinationDeg, sunAzimuthDeg, sunLimits } from '../src/celestial'
import { sunRange, timeWeights, type SceneParams } from '../src/params'
import { allParams, DAYS, expectShare, scene } from './days'

// PLAN_BIOMES 12: the real sun of the place and date.

/** The sun's compass azimuth in a scene (0 = north = −z, clockwise). */
const sunAzimuth = (p: SceneParams): number => {
  const [x, , z] = p.sunDirection
  return ((Math.atan2(x, -z) * 180) / Math.PI + 360) % 360
}
const fromNorth = (az: number): number => Math.min(az, 360 - az)
const month = (d: string): number => Number(d.slice(5, 7))

describe('sun limits', () => {
  it('follows the declination through the year', () => {
    expect(solarDeclinationDeg('2025-06-21')).toBeCloseTo(23.44, 0)
    expect(solarDeclinationDeg('2025-12-21')).toBeCloseTo(-23.44, 0)
    expect(Math.abs(solarDeclinationDeg('2025-03-20'))).toBeLessThan(0.6)
    expect(Math.abs(solarDeclinationDeg('2025-09-23'))).toBeLessThan(0.6)
  })

  it('gives polar night, the midnight sun and an equatorial noon', () => {
    const svalbardWinter = sunLimits(78, '2025-12-21')
    expect(svalbardWinter.max).toBeCloseTo(-11.4, 0)
    const svalbardSummer = sunLimits(78, '2025-06-21')
    expect(svalbardSummer.min).toBeCloseTo(11.4, 0)
    expect(svalbardSummer.max).toBeCloseTo(35.4, 0)
    // Tromsø's polar night: civil twilight at noon.
    expect(sunLimits(69.6, '2025-12-21').max).toBeGreaterThan(-6)
    expect(sunLimits(69.6, '2025-12-21').max).toBeLessThan(0)
    expect(sunLimits(0, '2025-03-20').max).toBeGreaterThan(89)
    // Southern hemisphere mirrored.
    expect(sunLimits(-78, '2025-06-21').max).toBeCloseTo(svalbardWinter.max, 1)
  })

  it('puts the low midnight sun in the north and the noon sun in the south', () => {
    const { min, max } = sunLimits(78, '2025-06-21')
    expect(fromNorth(sunAzimuthDeg(78, '2025-06-21', min + 0.01, true))).toBeLessThan(5)
    expect(fromNorth(sunAzimuthDeg(78, '2025-06-21', max - 0.01, true))).toBeGreaterThan(175)
    // Evening west of the meridian, morning east.
    expect(sunAzimuthDeg(78, '2025-06-21', 20, true)).toBeGreaterThan(180)
    expect(sunAzimuthDeg(78, '2025-06-21', 20, false)).toBeLessThan(180)
    // In the south the noon sun is in the north.
    expect(fromNorth(sunAzimuthDeg(-45, '2025-12-21', sunLimits(-45, '2025-12-21').max - 0.01, true))).toBeLessThan(5)
  })
})

describe('time of day from the real sun', () => {
  const svalbard = (months: number[]) => DAYS.filter(d => months.includes(month(d))).map(d => scene({ place: 'svalbard', eclipse: null }, d))

  it('offers only night and blue hour in the polar night', () => {
    const december = svalbard([12])
    for (const p of december) {
      expect(['night', 'blue-hour'], p.date).toContain(p.timeOfDay)
      expect(p.sunElevationDeg).toBeLessThanOrEqual(sunLimits(p.latitudeDeg, p.date).max + 1e-9)
    }
    // At 76–80° the December noon is below −6°: no blue hour at all.
    expect(december.every(p => p.timeOfDay === 'night')).toBe(true)
    // Tromsø's latitude keeps a civil-twilight noon.
    const north = DAYS.filter(d => month(d) === 12).map(d => scene({ place: 'norway-north', eclipse: null }, d))
    const polarNight = north.filter(p => sunLimits(p.latitudeDeg, p.date).max < -0.6)
    expect(polarNight.length).toBeGreaterThan(10)
    for (const p of polarNight) expect(['night', 'blue-hour']).toContain(p.timeOfDay)
    expect(polarNight.some(p => p.timeOfDay === 'blue-hour')).toBe(true)
  })

  it('has no night under the midnight sun, which stands in the north round midnight', () => {
    const june = svalbard([6])
    for (const p of june) {
      const { min, max } = sunLimits(p.latitudeDeg, p.date)
      expect(p.timeOfDay, p.date).not.toBe('night')
      expect(p.timeOfDay).not.toBe('blue-hour')
      expect(p.sunElevationDeg).toBeGreaterThanOrEqual(min - 1e-9)
      expect(p.sunElevationDeg).toBeLessThanOrEqual(max + 1e-9)
      // The sun's direction is its real compass bearing.
      expect(Math.abs(sunAzimuth(p) - sunAzimuthDeg(p.latitudeDeg, p.date, p.sunElevationDeg, p.evening))).toBeLessThan(0.01)
    }
    const midnight = june.filter(p => p.sunElevationDeg < sunLimits(p.latitudeDeg, p.date).min + 1)
    expect(midnight.length).toBeGreaterThan(0)
    for (const p of midnight) expect(fromNorth(sunAzimuth(p))).toBeLessThan(30)
    // Every June day with its sun forced just above the midnight low.
    for (const p of june) {
      const low = scene({ place: 'svalbard', eclipse: null, sunElevationDeg: sunLimits(p.latitudeDeg, p.date).min + 0.5 }, p.date)
      expect(fromNorth(sunAzimuth(low)), p.date).toBeLessThan(30)
    }
  })

  it('names the polar night and the midnight sun in the title', () => {
    expect(scene({ place: 'svalbard', eclipse: null }, '2025-12-21').title).toMatch(/^Polar night/)
    expect(scene({ place: 'svalbard', eclipse: null, sunElevationDeg: 12 }, '2025-06-21').title).toMatch(/^Midnight sun/)
    expect(scene({ place: 'scotland', eclipse: null, timeOfDay: 'night' }, '2025-12-21').title).not.toMatch(/Polar/)
  })

  it('lets explicit times and elevations win', () => {
    const forced = scene({ place: 'svalbard', timeOfDay: 'midday', eclipse: null }, '2025-12-21')
    expect(forced.timeOfDay).toBe('midday')
    expect(forced.sunElevationDeg).toBeGreaterThanOrEqual(35)
    expect(scene({ place: 'svalbard', sunElevationDeg: 20, eclipse: null }, '2025-12-21').sunElevationDeg).toBe(20)
    expect(sunRange('midday', sunLimits(78, '2025-12-21'))).toEqual([35, 70])
  })

  it('drops solar eclipses in the polar night, keeps them elsewhere', () => {
    // A real partial solar eclipse on 2029-01-14.
    expect(scene({ place: 'scotland' }, '2029-01-14').eclipse?.type).toBe('solar-partial')
    expect(scene({ place: 'svalbard' }, '2029-01-14').eclipse).toBeNull()
    expect(scene({ place: 'svalbard', eclipse: 'solar-partial' }, '2029-01-14').eclipse?.type).toBe('solar-partial')
  })

  it('changes nothing below 63°', () => {
    expect(timeWeights(null).map(([, w]) => w)).toEqual([30, 12, 10, 23, 15, 10])
    const low = allParams().filter(p => Math.abs(p.latitudeDeg) < REAL_SUN_LATITUDE)
    expectShare(low, p => p.timeOfDay === 'midday', 0.15)
    expectShare(low, p => p.timeOfDay === 'night', 0.1)
    // Scotland in December still gets the odd (unreal) midday: the filter
    // starts at 63° (a real sun everywhere is "Later and skipped").
    expect(timeWeights(null).length).toBe(6)
  })

  it('makes about a tenth of the year-end days night or blue hour above 63°, where polar places are', () => {
    const winter = allParams().filter(p => month(p.date) === 12 || month(p.date) === 1)
    const high = winter.filter(p => Math.abs(p.latitudeDeg) >= REAL_SUN_LATITUDE && p.latitudeDeg > 0)
    for (const p of high) expect(p.sunElevationDeg).toBeLessThanOrEqual(sunLimits(p.latitudeDeg, p.date).max + 1e-9)
    expect(high.filter(p => p.timeOfDay === 'midday' || p.timeOfDay === 'daylight')).toEqual([])
  })
})
