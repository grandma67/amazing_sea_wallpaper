import { describe, expect, it } from 'vitest'

import { apply, ECLIPTIC_POLE, eclipticLatitudeDeg, eclipticOffset, skyRotation, sunECI } from '../src/skyClock'
import { allParams, scenes } from './days'

// NIGHT_SKY phase 1: the stars, the sun and the moon agree.

type Vec3 = [number, number, number]
const DEG = Math.PI / 180
const angleDeg = (a: Vec3, b: Vec3): number => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / DEG
const elevationDeg = (d: Vec3): number => Math.asin(d[1]) / DEG
/** J2000 direction from right ascension (hours) and declination (degrees). */
const radec = (raH: number, decDeg: number): Vec3 => {
  const ra = raH * 15 * DEG
  const dec = decDeg * DEG
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)]
}
const POLARIS = radec(2 + 31 / 60 + 49 / 3600, 89.264)
const SIGMA_OCTANTIS = radec(21 + 8 / 60 + 47 / 3600, -88.956)

describe('sky clock', () => {
  it('finds the real sun for the date', () => {
    // Declination at the solstices and equinox.
    expect(Math.asin(sunECI('2025-06-21')[2]) / DEG).toBeCloseTo(23.44, 0)
    expect(Math.asin(sunECI('2025-12-21')[2]) / DEG).toBeCloseTo(-23.44, 0)
    expect(Math.abs(Math.asin(sunECI('2025-03-20')[2]) / DEG)).toBeLessThan(0.5)
  })

  it('turns the real sun onto the scene sun whenever that elevation happens that day', () => {
    let exact = 0
    for (const p of allParams()) {
      const { matrix, errorDeg } = skyRotation(p)
      if (errorDeg > 0.01) continue
      exact++
      expect(angleDeg(apply(matrix, sunECI(p.date)), p.sunDirection)).toBeLessThan(0.5)
    }
    // Only impossible elevations (midday in a high-latitude winter, nights
    // deeper than the sun sinks) are clamped: about 1 day in 10.
    expect(exact / allParams().length).toBeGreaterThan(0.85)
  })

  it('is a rotation', () => {
    for (const p of allParams().slice(0, 50)) {
      const m = skyRotation(p).matrix
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          const d = m[i] * m[j] + m[3 + i] * m[3 + j] + m[6 + i] * m[6 + j]
          expect(d).toBeCloseTo(i === j ? 1 : 0, 9)
        }
      }
      const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6])
      expect(det).toBeCloseTo(1, 9)
    }
  })

  it('keeps the pole star at the latitude, clamped days too', () => {
    for (const p of allParams()) {
      const m = skyRotation(p).matrix
      const pole = p.latitudeDeg >= 0 ? POLARIS : SIGMA_OCTANTIS
      // Both are within ~1° of their pole.
      expect(Math.abs(elevationDeg(apply(m, pole)) - Math.abs(p.latitudeDeg))).toBeLessThan(1.2)
    }
  })

  it('puts evening stars in the right place: Orion rises in the east on a December evening', () => {
    // 2025-12-21, 40° N, sun 20° below the western horizon: Betelgeuse
    // (RA 5.9 h, dec 7.4°) is low in the east, Vega (18.6 h, 38.8°) low in
    // the north-west.
    const sunDirection: Vec3 = [-Math.cos(-20 * DEG) * 0.9, Math.sin(-20 * DEG), -Math.cos(-20 * DEG) * 0.44]
    const n = Math.hypot(...sunDirection)
    const s = sunDirection.map(v => v / n) as Vec3
    const m = skyRotation({ date: '2025-12-21', latitudeDeg: 40, sunDirection: s, evening: true }).matrix
    const azimuth = (d: Vec3): number => ((Math.atan2(d[0], -d[2]) / DEG) % 360 + 360) % 360
    const sunAz = azimuth(s)
    const betelgeuse = apply(m, radec(5.92, 7.41))
    expect(elevationDeg(betelgeuse)).toBeGreaterThan(-5)
    expect(elevationDeg(betelgeuse)).toBeLessThan(25)
    // Opposite the sun, give or take.
    expect(Math.abs(((azimuth(betelgeuse) - sunAz + 540) % 360) - 180)).toBeGreaterThan(120)
  })

  it('is deterministic', () => {
    const p = allParams()[123]
    expect(skyRotation(p)).toEqual(skyRotation(p))
  })
})

describe('moon on the ecliptic', () => {
  it('keeps the elongation and stays within 5° of the ecliptic', () => {
    const sun: Vec3 = [0.6, 0.1, -Math.sqrt(1 - 0.37)]
    const helper: Vec3 = [0, 1, 0]
    const d = sun[0] * helper[0] + sun[1] * helper[1] + sun[2] * helper[2]
    const pole0: Vec3 = [helper[0] - d * sun[0], helper[1] - d * sun[1], helper[2] - d * sun[2]]
    const l = Math.hypot(...pole0)
    const pole = pole0.map(v => v / l) as Vec3
    for (const elong of [3, 30, 90, 150, 179]) {
      for (let u = 0; u < 1; u += 0.05) {
        const m = eclipticOffset(sun, pole, elong * DEG, u)
        expect(angleDeg(m, sun)).toBeCloseTo(elong, 6)
        expect(Math.abs(eclipticLatitudeDeg(m, pole))).toBeLessThanOrEqual(5.0001)
      }
    }
  })

  it('places the real days’ moons on the ecliptic', () => {
    for (const p of allParams()) {
      if (p.eclipse != null || p.moonElevationDeg <= 0) continue
      const rot = skyRotation(p)
      // Only where the sky clock is exact: elsewhere the ecliptic is the
      // clamped one.
      if (rot.errorDeg > 0.01) continue
      const pole = apply(rot.matrix, ECLIPTIC_POLE)
      expect(Math.abs(eclipticLatitudeDeg(p.moonDirection, pole))).toBeLessThanOrEqual(5.01)
    }
  })

  it('keeps moonlit nights and day moons in the frame', () => {
    const nights = scenes({ timeOfDay: 'night', nightSky: 'moonlit', eclipse: null }, 60)
    for (const p of nights) expect(p.moonElevationDeg).toBeGreaterThan(2)
  })
})
