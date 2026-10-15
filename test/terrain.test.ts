import { describe, expect, it } from 'vitest'

import { shoreToWorld, surfCycle, surfSets, terrainHeight, terrainNormal, worldToShore } from '../src/terrain'
import { allParams } from './days'

const beaches = allParams()
  .filter(p => p.coast.type === 'beach')
  .slice(0, 40)
  .map(p => p.coast)

describe('shore frame', () => {
  it('worldToShore and shoreToWorld are inverses', () => {
    for (const coast of beaches) {
      for (const [s, a] of [[0, 0], [30, -120], [-60, 400], [500, 15]]) {
        const [x, z] = shoreToWorld(coast, s, a)
        const [s2, a2] = worldToShore(coast, x, z)
        expect(s2).toBeCloseTo(s, 6)
        expect(a2).toBeCloseTo(a, 6)
      }
    }
  })
})

describe('terrainHeight', () => {
  it('is deep water everywhere on the open sea', () => {
    const open = allParams().find(p => p.coast.type === 'open-sea')!.coast
    expect(terrainHeight(open, 0, 0)).toBe(-200)
  })

  it('is near sea level at the waterline, land behind and seabed in front', () => {
    for (const coast of beaches) {
      const at = (s: number): number => terrainHeight(coast, ...shoreToWorld(coast, s, 0))
      expect(Math.abs(at(0))).toBeLessThan(1.5)
      expect(at(-coast.beachWidth * 0.5)).toBeGreaterThan(0)
      expect(at(200)).toBeLessThan(0)
      expect(at(5000)).toBeGreaterThanOrEqual(-coast.seabedDepth - 0.01)
      expect(Number.isFinite(at(-3000))).toBe(true)
    }
  })

  it('has upward normals', () => {
    for (const coast of beaches.slice(0, 10)) {
      const [x, z] = shoreToWorld(coast, -10, 30)
      const n = terrainNormal(coast, x, z)
      expect(Math.hypot(...n)).toBeCloseTo(1)
      expect(n[1]).toBeGreaterThan(0.5)
    }
  })
})

describe('surf', () => {
  it('keeps the cycle in [0, 1) and set strength in [0, 1]', () => {
    for (const coast of beaches.slice(0, 10)) {
      for (let s = 0; s < 200; s += 7) {
        const c = surfCycle(coast, s, s * 3)
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThan(1)
        const k = surfSets(coast, s, -s)
        expect(k).toBeGreaterThanOrEqual(0)
        expect(k).toBeLessThanOrEqual(1)
      }
    }
  })

  it('repeats every surf wavelength seaward', () => {
    const coast = beaches[0]
    const c0 = surfCycle(coast, 10, 5)
    const c1 = surfCycle(coast, 10 + coast.surfWavelength, 5)
    const d = Math.abs(c0 - c1)
    expect(Math.min(d, 1 - d)).toBeLessThan(1e-9)
  })
})
