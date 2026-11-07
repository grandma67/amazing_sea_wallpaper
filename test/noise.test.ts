import { describe, expect, it } from 'vitest'

import { fbm, hillNoise, vnoise } from '../src/cellNoise'
import { fbm3, noise3 } from '../src/props/noise'
import { expectEvery } from './days'

// The noise all terrain and rock stand on, and the shortcuts that skip it. Its
// bits are checked by what depends on them; here, what a wrong corner breaks:
// a cell that doesn't meet its neighbour shows as a step in the ground.

const EDGE = 1e-7
/** Points all over a few cells, by a low-discrepancy walk: no two runs differ. */
const points = (count: number): [number, number, number][] => Array.from({ length: count }, (_, i) => [((i * 0.6180339887) % 37) - 18, ((i * 0.4142135624) % 41) - 20, ((i * 0.7320508076) % 29) - 14])

describe('value noise', () => {
  const fields: [name: string, f: (x: number, y: number, z: number) => number, axes: number][] = [
    ['vnoise', (x, y) => vnoise(x, y), 2],
    ['fbm', (x, y) => fbm(x, y), 2],
    ['noise3', (x, y, z) => noise3(x, y, z, 17), 3],
    ['noise3, another seed', (x, y, z) => noise3(x, y, z, 90210), 3]
  ]

  it.each(fields)('%s is in [0, 1] and meets the next cell at every edge', (_, f, axes) => {
    const samples = points(4000)
    expectEvery(samples, ([x, y, z]) => {
      const v = f(x, y, z)
      return v >= 0 && v <= 1
    })
    for (let axis = 0; axis < axes; axis++) {
      expectEvery(samples, p => {
        const before = [...p] as typeof p
        const after = [...p] as typeof p
        const edge = Math.ceil(p[axis])
        before[axis] = edge - EDGE
        after[axis] = edge + EDGE
        // fbm's octaves cross their own edges elsewhere, as smoothly.
        return Math.abs(f(...before) - f(...after)) < 1e-4
      }, { what: p => ({ axis, p }) })
    }
  })

  it('noise3 takes the seed at all eight corners, and fbm3 at every octave', () => {
    // Exactly on a corner, only that corner's hash counts.
    for (const [dx, dy, dz] of [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]]) {
      const at = (seed: number) => noise3(3 + dx * (1 - 1e-12), 5 + dy * (1 - 1e-12), 7 + dz * (1 - 1e-12), seed)
      expect(at(1), `corner ${[dx, dy, dz]}`).not.toBeCloseTo(at(2), 3)
    }
    expect(fbm3(0.3, 0.4, 0.5, 1)).not.toBe(fbm3(0.3, 0.4, 0.5, 2))
  })

  it('is spread over its range, not stuck on a few values', () => {
    const values = points(4000).map(([x, y, z]) => noise3(x, y, z, 3))
    const mean = values.reduce((a, b) => a + b) / values.length
    expect(mean).toBeGreaterThan(0.4)
    expect(mean).toBeLessThan(0.6)
    expect(Math.min(...values)).toBeLessThan(0.15)
    expect(Math.max(...values)).toBeGreaterThan(0.85)
  })
})

describe('hillNoise', () => {
  it('rises with the mask from nothing, and is nothing without hills', () => {
    const noise = (height: number, mask: number) => hillNoise(height, mask, 1234, -567)
    expect(noise(100, 0)).toBe(0)
    expect(noise(0, 1)).toBe(0)
    for (const mask of [1e-6, 0.01, 0.3, 0.7, 1]) expect(noise(100, mask) / mask).toBeCloseTo(noise(100, 1), 6)
    expect(noise(100, 1)).toBeGreaterThan(0)
    expect(noise(100, 1)).toBeLessThanOrEqual(100)
  })
})
