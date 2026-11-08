import { PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'

import { PropContext } from '../src/props/context'
import { windDirection, windStrength } from '../src/props/wind'
import { CASCADE_SIZE, coxMunkVariance, RIPPLE_FLOOR, rippleSlopeScale, shortWaveVariance, synthesizeOcean, windWaveOnset } from '../src/spectrum'
import { scene } from './days'

const base = scene({ date: '2026-10-15' })
/** A wind sea with next to no swell. */
const withWind = (wind: number) => scene({ date: '2026-10-15', wind, params: { ocean: { swellHeight: 0.05 } } }).ocean

describe('synthesizeOcean', () => {
  const calm = synthesizeOcean(withWind(3))
  const rough = synthesizeOcean(withWind(14))

  it('is deterministic for a wave seed', () => {
    const again = synthesizeOcean(withWind(3))
    expect(again.significantHeight).toBe(calm.significantHeight)
    expect(again.cascades[0].a).toEqual(calm.cascades[0].a)
  })

  it('builds three nested cascades of the right size', () => {
    expect(calm.cascades.length).toBe(3)
    for (const c of calm.cascades) expect(c.a.length).toBe(CASCADE_SIZE * CASCADE_SIZE * 4)
    expect(calm.cascades[0].size).toBeGreaterThan(calm.cascades[1].size)
    expect(calm.cascades[1].size).toBeGreaterThan(calm.cascades[2].size)
  })

  it('raises bigger waves in stronger wind, about as the sea-state tables say', () => {
    expect(rough.significantHeight).toBeGreaterThan(calm.significantHeight * 4)
    // Fully developed Pierson–Moskowitz: Hs ≈ 0.21 U² / g; this sea is
    // fetch-limited, so somewhat less.
    expect(rough.significantHeight).toBeLessThan((0.21 * 14 * 14) / 9.81 * 1.3)
    expect(calm.significantHeight).toBeGreaterThan(0.02)
  })

  it('floats things on a sea that averages out at sea level', () => {
    const ctx = new PropContext(base, new PerspectiveCamera(), rough)
    let sum = 0
    let sumSq = 0
    const n = 4000
    for (let i = 0; i < n; i++) {
      const h = ctx.seaLevel((i % 63) * 37.3, Math.floor(i / 63) * 41.9)
      sum += h
      sumSq += h * h
    }
    const mean = sum / n
    const std = Math.sqrt(sumSq / n - mean * mean)
    expect(Math.abs(mean)).toBeLessThan(0.15 * std)
    // Hs ≈ 4σ of the surface elevation.
    expect(4 * std).toBeGreaterThan(rough.significantHeight * 0.6)
    expect(4 * std).toBeLessThan(rough.significantHeight * 1.4)
  })

  it('has a flat sea without a surface', () => {
    expect(new PropContext(base, new PerspectiveCamera()).seaLevel(12, 34)).toBe(0)
  })
})

describe('wind', () => {
  it('blows horizontally toward the wind heading', () => {
    const d = windDirection(scene({ params: { ocean: { windHeadingDeg: 90 } } }))
    expect(d.x).toBeCloseTo(1)
    expect(d.y).toBe(0)
  })

  it('grows from calm to a strong breeze', () => {
    const at = (wind: number): number => windStrength(scene({ wind }))
    expect(at(1)).toBe(0)
    expect(at(14)).toBeCloseTo(1)
    expect(at(6)).toBeLessThan(at(10))
    expect(at(40)).toBeCloseTo(1.69)
  })
})

describe('short waves (plans/REFLECTION.md phase 1)', () => {
  /** A wind sea at a given development (0.35–0.9 drawn), next to no swell. */
  const sea = (wind: number, development: number) =>
    synthesizeOcean({ ...withWind(wind), seaDevelopment: development })

  it('draws far less slope than Cox–Munk on a windy sea: the gap the ripples fill', () => {
    const drawn = sea(10, 0.9).slopeVariance
    expect(drawn).toBeGreaterThan(0.003)
    expect(drawn).toBeLessThan(coxMunkVariance(10) / 2)
  })

  it('makes drawn + ripples + floor equal Cox–Munk from 3 m/s, at any development', () => {
    for (const development of [0.35, 0.9]) {
      for (const wind of [3, 5, 10, 15]) {
        const s = sea(wind, development)
        const total = s.slopeVariance + shortWaveVariance(wind, s.slopeVariance) + RIPPLE_FLOOR
        expect(total / coxMunkVariance(wind)).toBeCloseTo(1, 2)
        // The ripple layers carry exactly the tail.
        const finest = s.cascadeSlopeVariance[s.cascadeSlopeVariance.length - 1]
        expect(rippleSlopeScale(wind, s) ** 2 * finest).toBeCloseTo(shortWaveVariance(wind, s.slopeVariance), 6)
      }
    }
  })

  it('adds nothing in light air, where the drawn waves are already enough', () => {
    const s = sea(1, 0.6)
    expect(shortWaveVariance(1, s.slopeVariance)).toBe(0)
    expect(shortWaveVariance(0.5, s.slopeVariance)).toBe(0)
    expect(rippleSlopeScale(1, s)).toBe(0)
    // Half way in at 2 m/s.
    expect(shortWaveVariance(2, 0)).toBeCloseTo((coxMunkVariance(2) - RIPPLE_FLOOR) / 2, 6)
  })

  it('sums the cascades into the drawn variance', () => {
    const s = sea(5, 0.6)
    expect(s.cascadeSlopeVariance.length).toBe(3)
    expect(s.cascadeSlopeVariance.reduce((a, b) => a + b, 0)).toBeCloseTo(s.slopeVariance, 10)
  })
})

describe('wind waves wait for the wind (Kahma & Donelan 1988)', () => {
  it('fades the wind sea in from ~0.6 to ~1.6 m/s', () => {
    expect(windWaveOnset(0.3)).toBe(0)
    expect(windWaveOnset(0.6)).toBe(0)
    expect(windWaveOnset(1.1)).toBeCloseTo(0.5, 6)
    expect(windWaveOnset(1.6)).toBe(1)
    expect(windWaveOnset(10)).toBe(1)
  })

  it('leaves a glassy sea in light air, and the old sea with the switch off', () => {
    const glassy = synthesizeOcean(withWind(0.5))
    const before = synthesizeOcean(withWind(0.5), false)
    expect(glassy.slopeVariance).toBeLessThan(1e-5)
    expect(before.slopeVariance).toBeGreaterThan(glassy.slopeVariance * 50)
    // At 3 m/s nothing changes.
    expect(synthesizeOcean(withWind(3), false).significantHeight).toBe(synthesizeOcean(withWind(3)).significantHeight)
  })
})
