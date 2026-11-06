import { PerspectiveCamera } from 'three'
import { describe, expect, it } from 'vitest'

import type { CoastParams } from '../src/params'
import { PropContext } from '../src/props/context'
import { cascadeShelter, chopFactor, shelterAt, shelterFetch, shelterUniforms, type Shelter } from '../src/shelter'
import { synthesizeOcean } from '../src/spectrum'
import { shoreToWorld, surfWave } from '../src/terrain'
import { scene } from './days'

/** A test lagoon: a reef 250 m out stopping 80% of the swell. */
const reef: Shelter = { strength: 0.8, line: 250, basins: [], blur: 60 }
const beach = scene({ coast: 'beach', beachMaterial: 'sand', tide: 'mid', reef: null })
const lagoon: CoastParams = { ...beach.coast, shelter: reef, surfAmplitude: 1.2, surfWavelength: 30 }

describe('shelter mask', () => {
  it('leaves the ocean as it was without a reef', () => {
    expect(shelterAt(beach.coast, 100, 0)).toBe(0)
    const u = shelterUniforms(beach.coast, 8, 6)
    expect(u.shelterStrength.value).toBe(0)
  })

  it('is calm behind the line and open past it, with a soft edge', () => {
    expect(shelterAt(lagoon, 100, 0)).toBeCloseTo(0.8)
    expect(shelterAt(lagoon, 250 - 60, 0)).toBeCloseTo(0.8)
    expect(shelterAt(lagoon, 250, 0)).toBe(0)
    expect(shelterAt(lagoon, 400, 0)).toBe(0)
    const mid = shelterAt(lagoon, 220, 0)
    expect(mid).toBeGreaterThan(0.1)
    expect(mid).toBeLessThan(0.7)
  })

  it('calms ellipses: full inside, none outside', () => {
    const fjord: CoastParams = { ...lagoon, shelter: { strength: 1, line: null, basins: [{ s: 500, a: 0, halfS: 300, halfA: 800 }], blur: 50 } }
    expect(shelterAt(fjord, 500, 0)).toBe(1)
    expect(shelterAt(fjord, 500, 700)).toBe(1)
    expect(shelterAt(fjord, 900, 0)).toBe(0)
    expect(shelterAt(fjord, 500, 900)).toBe(0)
    expect(shelterFetch(fjord)).toBe(1100)
  })

  it('keeps the lagoon surf at most 0.3 of the offshore waves', () => {
    // The unbroken incoming wave at the same depth (Green's law from half a
    // wavelength down, as surfWave shoals it).
    const half = 0.5 * lagoon.surfWavelength
    const incoming = (depth: number): number => 1.3 * lagoon.surfAmplitude * (half / Math.min(depth, half)) ** 0.25
    for (let depth = 0.2; depth < 10; depth += 0.1) {
      const inside = surfWave(lagoon, depth, 1, shelterAt(lagoon, 100, 0))
      expect(inside.height).toBeLessThanOrEqual(0.3 * incoming(depth))
    }
    // Outside the reef the same depth still carries the full wave.
    expect(surfWave(lagoon, 6, 1, shelterAt(lagoon, 400, 0)).height).toBeCloseTo(incoming(6))
  })
})

describe('chop inside', () => {
  it('grows with the fetch as fetch-limited seas do (Hs ∝ √F)', () => {
    const near = chopFactor(200, 10, 6.5)
    const far = chopFactor(800, 10, 6.5)
    expect(far / near).toBeCloseTo(2)
    // A 10 m/s wind needs a few km to raise 6.5 m waves.
    expect(chopFactor(3000, 10, 6.5)).toBeGreaterThan(0.8)
    expect(chopFactor(100_000, 10, 6.5)).toBe(1)
    expect(chopFactor(0, 10, 6.5)).toBe(0)
  })

  it('takes the swell cascade out and leaves the shortest', () => {
    expect(cascadeShelter(0, 0.3)).toEqual([1, 1, 1])
    const [swell, middle, short] = cascadeShelter(1, 0.3)
    expect(swell).toBe(0)
    expect(middle).toBeCloseTo(0.3)
    expect(short).toBe(1)
  })
})

describe('seaLevel follows the mask', () => {
  const ocean = scene({ seaIce: null, coast: 'beach', wind: 10, params: { ocean: { swellHeight: 2 } } })
  const surface = synthesizeOcean(ocean.ocean)
  const open = new PropContext(ocean, new PerspectiveCamera(), surface)
  const calm = new PropContext({ ...ocean, coast: { ...ocean.coast, shelter: { strength: 1, line: 2000, basins: [], blur: 50 } } }, new PerspectiveCamera(), surface)

  const spread = (ctx: PropContext): number => {
    let sumSq = 0
    const n = 2000
    for (let i = 0; i < n; i++) {
      const [x, z] = shoreToWorld(ocean.coast, 300 + (i % 40) * 13.7, (Math.floor(i / 40) - 25) * 17.1)
      sumSq += ctx.seaLevel(x, z) ** 2
    }
    return Math.sqrt(sumSq / n)
  }

  it('drops the swell in sheltered water', () => {
    expect(spread(calm)).toBeLessThan(0.25 * spread(open))
    expect(spread(calm)).toBeGreaterThan(0)
  })
})
