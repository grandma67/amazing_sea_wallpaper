import { PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'

import { PropContext } from '../src/props/context'
import { windDirection, windStrength } from '../src/props/wind'
import { CASCADE_SIZE, synthesizeOcean } from '../src/spectrum'
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
