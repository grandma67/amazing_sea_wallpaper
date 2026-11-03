import { describe, expect, it } from 'vitest'

import { project } from '../src/meteors'
import { extinction, planetsECI, planetStarData, PLANET_MAGNITUDES } from '../src/planets'
import { sunECI } from '../src/skyClock'
import { allParams, DAYS, scene } from './days'

// NIGHT_SKY phase 5: planets.

const DEG = Math.PI / 180
const angleDeg = (a: number[], b: number[]): number => Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) / DEG

describe('planets', () => {
  it('stand where they really were', () => {
    // Venus at greatest elongation (2025-01-10 east 47.2°, 2025-06-01 west
    // 45.9°) and near superior conjunction (2026-01-06).
    const sunVenus = (date: string): number => {
      const venus = planetsECI(date).find(p => p.id === 'venus')!
      return angleDeg(venus.eci, sunECI(date))
    }
    expect(sunVenus('2025-01-10')).toBeCloseTo(47.2, 0)
    expect(sunVenus('2025-06-01')).toBeCloseTo(45.9, 0)
    expect(sunVenus('2026-01-06')).toBeLessThan(2)
    // Magnitudes: Venus −3.8 to −4.9, Jupiter −1.6 to −2.9, Saturn under +1.5.
    for (const date of ['2024-03-01', '2025-01-10', '2026-08-15']) {
      const m = Object.fromEntries(planetsECI(date).map(p => [p.id, p.magnitude]))
      expect(m.venus).toBeLessThan(-3.7)
      expect(m.venus).toBeGreaterThan(-5)
      expect(m.jupiter).toBeLessThan(-1.5)
      expect(m.saturn).toBeLessThan(1.6)
      for (const v of Object.values(m)) {
        expect(v).toBeGreaterThan(PLANET_MAGNITUDES[0])
        expect(v).toBeLessThan(PLANET_MAGNITUDES[1])
      }
    }
  })

  it('are drawn only with the sun down, and Venus stays near the sun', () => {
    for (const p of allParams()) {
      expect(p.planets.length > 0).toBe(p.sunElevationDeg < 0)
      const venus = p.planets.find(q => q.id === 'venus')
      if (venus != null) expect(angleDeg(venus.direction, p.sunDirection)).toBeLessThan(48.5)
    }
  })

  it('frames Venus at blue hour only where it shows', () => {
    const blue = DAYS.filter((_, i) => i % 7 === 0).map(d => scene({ date: d, timeOfDay: 'blue-hour', weather: 'clear', eclipse: null, fog: null }, d))
    const framed = [...blue, ...allParams()].filter(p => p.title.includes('Venus'))
    expect(framed.length).toBeGreaterThan(5)
    for (const p of framed) {
      expect(p.timeOfDay).toBe('blue-hour')
      expect(['clear', 'few', 'cirrus']).toContain(p.weather.kind)
      expect(p.sunElevationDeg).toBeLessThan(-5.4)
      const venus = p.planets.find(q => q.id === 'venus')!
      const ndc = project(p, venus.direction)!
      expect(Math.abs(ndc[0])).toBeLessThan(1)
      expect(Math.abs(ndc[1])).toBeLessThan(1)
    }
    // Forced: in the title when it can be framed; off: no planets.
    expect(scene({ date: '2026-06-25', timeOfDay: 'blue-hour', eclipse: null, planets: null }).planets).toEqual([])
  })

  it('packs star records and dims low planets', () => {
    const data = new Uint8Array(planetStarData([{ id: 'venus', direction: [0, 1, 0], magnitude: -4 }], PLANET_MAGNITUDES))
    expect(data.length).toBe(10)
    expect(data[6]).toBe(Math.round(((-4 - PLANET_MAGNITUDES[0]) / (PLANET_MAGNITUDES[1] - PLANET_MAGNITUDES[0])) * 255))
    expect(extinction(90 * DEG)).toBeCloseTo(10 ** (-0.4 * 0.28), 3)
    expect(extinction(5 * DEG)).toBeLessThan(extinction(30 * DEG))
  })
})
