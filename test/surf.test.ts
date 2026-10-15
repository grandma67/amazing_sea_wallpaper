import { describe, expect, it } from 'vitest'

import { breakerIndex, surfBreakDepth, surfProfile, surfWave } from '../src/terrain'
import { scene } from './days'

const coast = { ...scene({ coast: 'beach' }).coast, surfAmplitude: 1, surfWavelength: 30, nearshoreSlope: 0.02 }

describe('surf: shoaling and breaking', () => {
  it('uses McCowan’s breaker index, higher on steeper beaches', () => {
    expect(breakerIndex({ ...coast, nearshoreSlope: 0.01 })).toBeCloseTo(0.776, 3)
    expect(breakerIndex({ ...coast, nearshoreSlope: 0.035 })).toBeGreaterThan(breakerIndex(coast))
  })

  it('grows as the water shallows, until it breaks at H = index × depth', () => {
    const db = surfBreakDepth(coast)
    const deep = surfWave(coast, 20)
    const shoaling = surfWave(coast, db * 1.5)
    expect(shoaling.height).toBeGreaterThan(deep.height)
    expect(shoaling.broken).toBe(0)
    // At the break point the wave height is the breaker index times the depth.
    const atBreak = surfWave(coast, db)
    expect(atBreak.height / db).toBeCloseTo(breakerIndex(coast), 2)
    expect(atBreak.steepness).toBeCloseTo(1, 2)
    // Inside the surf zone it's broken and depth-limited.
    const inside = surfWave(coast, db * 0.5)
    expect(inside.broken).toBe(1)
    expect(inside.height).toBeCloseTo(breakerIndex(coast) * db * 0.5, 5)
  })

  it('breaks the bigger waves of a set farther out', () => {
    expect(surfBreakDepth(coast, 1)).toBeGreaterThan(surfBreakDepth(coast, 0.5))
    // A 1 m swell on a gentle beach breaks a couple of metres deep.
    expect(surfBreakDepth(coast)).toBeGreaterThan(1.5)
    expect(surfBreakDepth(coast)).toBeLessThan(4)
  })
})

describe('surf: wave profile', () => {
  const sample = (steep: number, broken: number, n = 2000): number[] =>
    Array.from({ length: n }, (_, i) => surfProfile((i + 0.5) / n, steep, broken))

  it('keeps the mean water level: the crest is fed from the trough', () => {
    for (const [steep, broken] of [[0, 0], [0.7, 0], [1, 0.5], [1, 1]]) {
      const p = sample(steep, broken)
      const mean = p.reduce((a, b) => a + b, 0) / p.length
      expect(Math.abs(mean)).toBeLessThan(0.03)
      // Trough to crest is about one wave height.
      expect(Math.max(...p) - Math.min(...p)).toBeGreaterThan(0.9)
      expect(Math.max(...p) - Math.min(...p)).toBeLessThan(1.4)
    }
  })

  it('has a peaked crest higher than the trough is deep', () => {
    const p = sample(0.5, 0)
    expect(Math.max(...p)).toBeGreaterThan(-Math.min(...p) * 1.5)
  })

  it('draws the water down in front of a steep wave, lowest at the foot of its face', () => {
    const p = sample(1, 0)
    const lowest = p.indexOf(Math.min(...p)) / p.length
    // The face is the last part of the cycle (x → 1); the trough sits at its foot.
    expect(lowest).toBeGreaterThan(0.8)
    expect(lowest).toBeLessThan(0.95)
    // Deeper than a gentle swell's trough.
    expect(Math.min(...p)).toBeLessThan(Math.min(...sample(0, 0)))
  })

  it('steepens its front face as it nears breaking', () => {
    const faceSlope = (steep: number, broken: number): number => {
      const p = sample(steep, broken)
      let max = 0
      for (let i = 1; i < p.length; i++) max = Math.max(max, (p[i] - p[i - 1]) * p.length)
      return max
    }
    expect(faceSlope(1, 0)).toBeGreaterThan(faceSlope(0, 0) * 1.5)
    expect(faceSlope(1, 1)).toBeGreaterThan(faceSlope(1, 0))
  })

  it('never makes a face narrower than the grid can show', () => {
    const p = Array.from({ length: 2000 }, (_, i) => surfProfile((i + 0.5) / 2000, 1, 1, 0.3))
    let max = 0
    for (let i = 1; i < p.length; i++) max = Math.max(max, (p[i] - p[i - 1]) * p.length)
    expect(max).toBeLessThan(6)
  })
})

describe('waves on rocks', () => {
  it('break on a rock that stands higher than the crests, wash over one that doesn’t', async () => {
    const { waveOnRock } = await import('../src/props/surf')
    const depth = 1.5
    const { crest } = waveOnRock(coast, { top: 10, depth }, 0)
    expect(crest).toBeGreaterThan(0.3)
    expect(waveOnRock(coast, { top: crest * 2, depth }, 0).breaks).toBe(1)
    expect(waveOnRock(coast, { top: crest * 0.5, depth }, 0).breaks).toBe(0)
    // Offshore, past the surf, the open sea's waves count: a stack in a
    // 3 m sea takes 1.5 m crests.
    const offshore = waveOnRock(coast, { top: 1, depth: 30 }, 3)
    expect(offshore.crest).toBeCloseTo(1.5, 5)
    expect(offshore.breaks).toBe(0)
    expect(waveOnRock(coast, { top: 20, depth: 30 }, 3).breaks).toBe(1)
  })

  it('crest in the surf is the depth-limited wave’s', async () => {
    const { waveOnRock } = await import('../src/props/surf')
    // Shallower water, smaller broken waves: the same rock breaks them sooner.
    const shallow = waveOnRock(coast, { top: 0.6, depth: 0.5 }, 0)
    const deeper = waveOnRock(coast, { top: 0.6, depth: 2 }, 0)
    expect(shallow.crest).toBeLessThan(deeper.crest)
    expect(shallow.breaks).toBeGreaterThan(deeper.breaks)
  })
})
