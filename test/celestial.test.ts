import { describe, expect, it } from 'vitest'

import { eclipseOn, moonlight, offsetFor, overlap, UMBRA_RATIO } from '../src/celestial'
import { generateParams, SUN_ANGULAR_RADIUS } from '../src/params'
import { allParams } from './days'

describe('moonlight', () => {
  it('follows the phase law: a half moon gives about a tenth of a full one', () => {
    expect(moonlight(180)).toBeCloseTo(1)
    expect(moonlight(90)).toBeGreaterThan(0.07)
    expect(moonlight(90)).toBeLessThan(0.12)
    expect(moonlight(30)).toBeLessThan(0.01)
    for (let e = 10; e < 180; e += 10) expect(moonlight(e)).toBeLessThan(moonlight(e + 10))
  })

  it('makes a half-moon night darker than a full-moon one', () => {
    const nights = allParams().filter(p => p.nightSky === 'moonlit' && p.eclipse == null)
    const full = nights.filter(p => p.moonIllumination > 0.95)
    const half = nights.filter(p => p.moonIllumination > 0.4 && p.moonIllumination < 0.6)
    for (const f of full) for (const h of half) expect(h.moonlight).toBeLessThan(f.moonlight / 4)
  })
})

describe('disc overlap', () => {
  it('measures how much of a disc another covers', () => {
    expect(overlap(0, 1.1)).toBe(1)
    expect(overlap(0, 0.9)).toBeCloseTo(0.81)
    expect(overlap(3, 1)).toBe(0)
    expect(overlap(1, 1)).toBeCloseTo(0.391, 3)
    for (const f of [0.1, 0.5, 0.9]) expect(overlap(offsetFor(f, 1.02), 1.02)).toBeCloseTo(f, 4)
    expect(overlap(offsetFor(0.3, UMBRA_RATIO), UMBRA_RATIO)).toBeCloseTo(0.3, 4)
  })
})

describe('eclipses', () => {
  it('happen on their real dates', () => {
    const pick = (): number => 0.5
    expect(eclipseOn('2024-04-08', pick)?.type).toBe('solar-total') // North America
    expect(eclipseOn('2026-08-12', pick)?.type).toBe('solar-total') // Spain, Iceland
    expect(eclipseOn('2024-10-02', pick)?.type).toBe('solar-annular')
    expect(eclipseOn('2025-03-29', pick)?.type).toBe('solar-partial')
    expect(eclipseOn('2025-03-14', pick)?.type).toBe('lunar-total')
    expect(eclipseOn('2025-09-07', pick)?.type).toBe('lunar-total')
    expect(eclipseOn('2026-08-28', pick)?.type).toBe('lunar-partial')
    expect(eclipseOn('2024-03-25', pick)).toBeNull() // penumbral only
    expect(eclipseOn('2024-04-09', pick)).toBeNull()
  })

  it('shows a solar eclipse by day with the moon over the sun, in a clear sky', () => {
    for (const date of ['2024-04-08', '2024-10-02', '2025-03-29', '2026-08-12']) {
      const p = generateParams(date)
      expect(p.timeOfDay === 'daylight' || p.timeOfDay === 'golden-hour').toBe(true)
      expect(p.title).toContain('solar eclipse')
      const dot = p.sunDirection.reduce((s, v, i) => s + v * p.moonDirection[i], 0)
      const apart = Math.acos(Math.min(1, dot)) / (SUN_ANGULAR_RADIUS * p.sunScale)
      expect(apart).toBeCloseTo(p.eclipse!.offset, 2)
      expect(p.storm).toBeNull()
      expect(p.fog).toBeNull()
      if (p.eclipse!.type === 'solar-total') expect(p.weather.kind).toBe('clear')
      else expect(['clear', 'cirrus']).toContain(p.weather.kind)
      // In the frame: ahead, and low enough for the lens.
      expect(p.sunElevationDeg).toBeGreaterThan(2)
      expect(p.sunElevationDeg).toBeLessThan(13)
    }
  })

  it('shows a lunar eclipse at night, the moon low ahead and dimmed', () => {
    for (const date of ['2025-03-14', '2026-03-03', '2026-08-28']) {
      const p = generateParams(date)
      expect(p.timeOfDay).toBe('night')
      expect(p.nightSky).toBe('moonlit')
      expect(p.title).toContain('lunar eclipse')
      expect(p.moonElevationDeg).toBeGreaterThan(4)
      expect(p.moonlight).toBeLessThan(0.1)
    }
  })

  it('come a few times a year', () => {
    const eclipses = allParams().filter(p => p.eclipse != null)
    expect(eclipses.length).toBeGreaterThanOrEqual(6)
    expect(eclipses.length).toBeLessThanOrEqual(20)
  })
})
