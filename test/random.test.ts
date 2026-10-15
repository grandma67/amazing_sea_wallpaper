import { describe, expect, it } from 'vitest'

import { Random } from '../src/random'

describe('Random', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = new Random('2026-10-15')
    const b = new Random('2026-10-15')
    for (let i = 0; i < 100; i++) expect(a.float()).toBe(b.float())
  })

  it('gives different sequences for different seeds', () => {
    const a = new Random('2026-10-15')
    const b = new Random('2026-10-16')
    const same = Array.from({ length: 20 }, () => a.float() === b.float()).filter(Boolean)
    expect(same.length).toBe(0)
  })

  it('derives streams independent of draws on other streams', () => {
    const first = Random.derive('seed', 'fog').float()
    const main = new Random('seed')
    for (let i = 0; i < 50; i++) main.float()
    expect(Random.derive('seed', 'fog').float()).toBe(first)
    expect(Random.derive('seed', 'lighthouse').float()).not.toBe(first)
  })

  it('keeps floats, ranges and ints in bounds', () => {
    const rng = new Random('bounds')
    for (let i = 0; i < 5000; i++) {
      const f = rng.float()
      expect(f).toBeGreaterThanOrEqual(0)
      expect(f).toBeLessThan(1)
      const r = rng.range(-3, 7)
      expect(r).toBeGreaterThanOrEqual(-3)
      expect(r).toBeLessThan(7)
      const n = rng.int(2, 5)
      expect(Number.isInteger(n)).toBe(true)
      expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(5)
    }
  })

  it('hits every int in a range, roughly uniformly', () => {
    const rng = new Random('uniform')
    const counts = [0, 0, 0, 0]
    for (let i = 0; i < 8000; i++) counts[rng.int(0, 3)]++
    for (const c of counts) expect(c).toBeGreaterThan(1800)
  })

  it('draws chance, normal and weighted with the right statistics', () => {
    const rng = new Random('stats')
    const n = 20000
    let hits = 0
    let sum = 0
    let sumSq = 0
    const picks = { a: 0, b: 0 }
    for (let i = 0; i < n; i++) {
      if (rng.chance(0.3)) hits++
      const x = rng.normal(5, 2)
      sum += x
      sumSq += x * x
      picks[rng.weighted([['a', 1], ['b', 3]] as const)]++
    }
    expect(hits / n).toBeCloseTo(0.3, 1)
    const mean = sum / n
    expect(mean).toBeCloseTo(5, 1)
    expect(Math.sqrt(sumSq / n - mean * mean)).toBeCloseTo(2, 1)
    expect(picks.b / n).toBeCloseTo(0.75, 1)
  })

  it('never picks a zero-weight item and picks from a list', () => {
    const rng = new Random('weights')
    for (let i = 0; i < 1000; i++) {
      expect(rng.weighted([['never', 0], ['always', 1]] as const)).toBe('always')
      expect(['x', 'y', 'z']).toContain(rng.pick(['x', 'y', 'z']))
    }
  })
})
