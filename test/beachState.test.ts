import { describe, expect, it } from 'vitest'

import {
  BEACH_STATES,
  beachStateFor,
  breakerHeight,
  CUSP_CHANCE,
  fallVelocity,
  GRAIN,
  omega,
  stateForOmega,
  wavePeriod
} from '../src/beachState'
import { hasBeach } from '../src/coastKind'
import { generateParams } from '../src/params'
import { barHeight, cuspHeight, cuspReach, ripGap, shoreToWorld, terrainHeight } from '../src/terrain'
import { allParams, scene, scenes, share } from './days'

const steep = (state: string): boolean => CUSP_CHANCE[state as keyof typeof CUSP_CHANCE] > 0

describe('fall velocity and Ω', () => {
  it('matches the Soulsby values in REGIONS.md §2', () => {
    const cm = (mm: number, sediment = GRAIN.golden): number => fallVelocity(mm, sediment) * 100
    expect(cm(0.2)).toBeCloseTo(2.5, 1)
    expect(cm(0.5)).toBeCloseTo(7.3, 1)
    expect(cm(1)).toBeCloseTo(12.0, 1)
    expect(cm(2)).toBeCloseTo(17.9, 1)
    expect(cm(0.35, GRAIN.black)).toBeCloseTo(5.7, 1)
    expect(cm(0.5, GRAIN.coral)).toBeCloseTo(5.6, 1)
  })

  it('gives the worked examples (quartz)', () => {
    const at = (mm: number, hb: number, t: number): number => omega(hb, fallVelocity(mm), t)
    expect(at(0.2, 0.5, 8)).toBeCloseTo(2.5, 1)
    expect(at(0.2, 1.5, 10)).toBeCloseTo(5.9, 1)
    expect(at(0.3, 1.5, 10)).toBeCloseTo(3.4, 0)
    expect(at(0.5, 0.5, 8)).toBeCloseTo(0.9, 1)
    expect(at(1, 2.5, 12)).toBeCloseTo(1.7, 1)
    expect(stateForOmega(at(0.5, 0.5, 8))).toBe('reflective')
    expect(stateForOmega(at(0.2, 1.5, 10))).toBe('dissipative')
    expect(stateForOmega(at(1, 2.5, 12))).toBe('low-tide-terrace')
  })

  it('reads the states from Ω (reflective < 1.5, dissipative > 5.5)', () => {
    expect(stateForOmega(1.4)).toBe('reflective')
    expect(stateForOmega(2)).toBe('low-tide-terrace')
    expect(stateForOmega(3)).toBe('transverse-bar-rip')
    expect(stateForOmega(3.6)).toBe('rhythmic-bar')
    expect(stateForOmega(5)).toBe('longshore-bar')
    expect(stateForOmega(5.6)).toBe('dissipative')
    // Each state's mean Ω (Wright, Short & Green 1985) falls in its own band.
    const means = { 'low-tide-terrace': 2.4, 'transverse-bar-rip': 3.15, 'rhythmic-bar': 3.5, 'longshore-bar': 4.7 } as const
    for (const [state, mean] of Object.entries(means)) expect(stateForOmega(mean)).toBe(state)
  })

  it('gets breakers and periods right', () => {
    // Komar & Gaynord: 1 m, 10 s offshore breaks at ~1.5 m (shoaling).
    expect(breakerHeight(1, 10)).toBeCloseTo(1.55, 1)
    expect(breakerHeight(2, 10)).toBeGreaterThan(breakerHeight(1, 10))
    expect(wavePeriod(156)).toBeCloseTo(10, 1)
  })

  it('keeps gravel reflective and a mixed beach at a terrace at most', () => {
    for (const material of ['shingle', 'cobble'] as const) {
      expect(beachStateFor(material, 0.2, 3, 12, GRAIN.golden, 1)).toBe('reflective')
    }
    expect(beachStateFor('mixed', 0.2, 3, 12)).toBe('low-tide-terrace')
    expect(beachStateFor('sand', 0.2, 3, 12)).toBe('dissipative')
  })

  it('moves a state toward dissipative in storms and winter', () => {
    expect(beachStateFor('sand', 0.5, 0.5, 8, GRAIN.golden, 1)).toBe('low-tide-terrace')
    expect(beachStateFor('sand', 0.2, 3, 12, GRAIN.golden, 1)).toBe('dissipative')
  })
})

describe('beach state on real days', () => {
  const days = allParams()
  // Reef-fronted beaches have a lagoon instead of bars and rips (test/reef.test.ts).
  const beaches = days.filter(p => hasBeach(p.coast) && p.coast.reef == null)
  const sand = beaches.filter(p => p.coast.material === 'sand')

  it('spans the states on sand, mostly steep to intermediate', () => {
    for (const state of BEACH_STATES) expect(share(sand, p => p.coast.state === state)).toBeGreaterThan(0.02)
    expect(share(sand, p => p.coast.state === 'reflective' || p.coast.state === 'low-tide-terrace')).toBeGreaterThan(0.45)
    expect(share(sand, p => p.coast.state === 'dissipative')).toBeLessThan(0.2)
  })

  it('keeps gravel reflective, coarse sands steeper than fine ones', () => {
    for (const p of beaches.filter(p => p.coast.material === 'shingle' || p.coast.material === 'cobble')) expect(p.coast.state).toBe('reflective')
    const flat = (list: typeof sand): number => share(list, p => BEACH_STATES.indexOf(p.coast.state) >= 3)
    expect(flat(sand.filter(p => p.coast.grainMm > 0.5))).toBeLessThan(flat(sand.filter(p => p.coast.grainMm < 0.3)))
    // Big swell flattens beaches.
    expect(flat(sand.filter(p => p.ocean.swellHeight > 1.2))).toBeGreaterThan(flat(sand.filter(p => p.ocean.swellHeight < 0.5)))
  })

  it('shapes the profile by state', () => {
    const mean = (list: typeof sand, f: (p: (typeof sand)[number]) => number): number => list.reduce((s, p) => s + f(p), 0) / list.length
    const of = (state: string) => sand.filter(p => p.coast.state === state)
    expect(mean(of('reflective'), p => p.coast.beachSlope)).toBeGreaterThan(2 * mean(of('dissipative'), p => p.coast.beachSlope))
    expect(mean(of('reflective'), p => p.coast.nearshoreSlope)).toBeGreaterThan(mean(of('dissipative'), p => p.coast.nearshoreSlope))
    for (const p of beaches) {
      const { coast } = p
      const n = coast.bars.length
      if (coast.state === 'reflective') expect(n).toBe(0)
      if (coast.state === 'dissipative') expect(n).toBeGreaterThanOrEqual(2)
      expect(n).toBeLessThanOrEqual(3)
      // Every intermediate state has rips (Short 2006); terraces' are closest.
      expect(coast.rips != null).toBe(coast.state !== 'reflective' && coast.state !== 'dissipative')
      if (coast.rips != null) {
        const [lo, hi] = coast.state === 'low-tide-terrace' ? [40, 120] : coast.state === 'longshore-bar' ? [250, 500] : [150, 400]
        expect(coast.rips.spacing).toBeGreaterThanOrEqual(lo)
        expect(coast.rips.spacing).toBeLessThanOrEqual(hi)
        // Straight bars and terraces don't swing toward the shore.
        if (coast.state === 'low-tide-terrace' || coast.state === 'longshore-bar') expect(coast.rips.amplitude).toBe(0)
      }
      if (coast.state === 'longshore-bar') expect(coast.bars[0].distance).toBeGreaterThanOrEqual(100)
      if (coast.cusps != null) {
        expect(steep(coast.state)).toBe(true)
        expect(coast.cusps.spacing).toBeGreaterThanOrEqual(10)
        expect(coast.cusps.spacing).toBeLessThanOrEqual(52)
        expect(coast.cusps.relief).toBeLessThanOrEqual(0.4)
      }
      // Bars stay submerged, outer ones further out.
      coast.bars.forEach((b, i) => {
        const depth = coast.seabedDepth * (1 - Math.exp((-b.distance * coast.nearshoreSlope) / coast.seabedDepth))
        expect(b.height).toBeLessThan(0.8 * depth)
        if (i > 0) expect(b.distance).toBeGreaterThan(coast.bars[i - 1].distance)
      })
      expect(coast.beachSlope * coast.beachWidth).toBeLessThanOrEqual(5 + 1e-9)
    }
    // Faces: reflective 0.10–0.20, dissipative ~0.03 (Bosboom & Stive).
    expect(mean(of('reflective'), p => p.coast.beachSlope)).toBeGreaterThan(0.08)
    expect(mean(of('dissipative'), p => p.coast.beachSlope)).toBeGreaterThan(0.02)
    expect(mean(of('dissipative'), p => p.coast.beachSlope)).toBeLessThan(0.04)
    for (const p of beaches.filter(p => p.coast.material === 'shingle' || p.coast.material === 'cobble')) {
      expect(p.coast.beachSlope).toBeGreaterThanOrEqual(0.08)
      expect(p.coast.beachSlope).toBeLessThanOrEqual(0.24)
    }
    // Cusps show on most steep beaches.
    expect(share(beaches.filter(p => p.coast.state === 'reflective'), p => p.coast.cusps != null)).toBeGreaterThan(0.6)
  })

  it('is forced by the spec and keeps the rest of the day', () => {
    const flat = scenes({ beachState: 'dissipative', beachMaterial: 'sand', coast: 'beach', reef: null }, 60)
    for (const p of flat) {
      expect(p.coast.state).toBe('dissipative')
      expect(p.coast.bars.length).toBeGreaterThanOrEqual(2)
    }
    // "Two to occasionally three" bars.
    expect(share(flat, p => p.coast.bars.length === 3)).toBeGreaterThan(0)
    expect(share(flat, p => p.coast.bars.length === 3)).toBeLessThan(0.35)
    for (const p of sand.slice(0, 15)) {
      expect(scene({ beachState: p.coast.state }, p.date)).toEqual(p)
      const other = scene({ beachState: p.coast.state === 'reflective' ? 'dissipative' : 'reflective' }, p.date)
      expect(other.coast.noiseOffset).toEqual(p.coast.noiseOffset)
      expect(other.coast.grainMm).toBe(p.coast.grainMm)
      expect(other.camera).toEqual(p.camera)
      expect(other.place).toEqual(p.place)
    }
  })

  it('is deterministic', () => {
    for (const date of ['2024-03-08', '2025-07-01', '2026-12-30']) expect(generateParams(date).coast).toEqual(generateParams(date).coast)
  })
})

describe('bars, rips and cusps in the terrain', () => {
  const at = (coast: ReturnType<typeof scene>['coast'], s: number, a: number): number => terrainHeight(coast, ...shoreToWorld(coast, s, a))

  it('raises the bars and cuts the inner one at the rip channels', () => {
    for (const p of scenes({ beachState: 'transverse-bar-rip', beachMaterial: 'sand', coast: 'beach' }, 10)) {
      const { coast } = p
      const bar = coast.bars[0]
      // Along the shore, the bar's height there swings between a channel and the bar.
      const samples = Array.from({ length: 400 }, (_, i) => i * 4 - 800)
      const gaps = samples.filter(a => ripGap(coast, a) > 0.99)
      const onBar = samples.filter(a => ripGap(coast, a) < 0.01)
      expect(gaps.length).toBeGreaterThan(0)
      expect(onBar.length).toBeGreaterThan(gaps.length)
      const peak = (a: number): number => Math.max(...Array.from({ length: 200 }, (_, i) => barHeight(coast, i * 1.5, a)))
      for (const a of gaps.slice(0, 5)) {
        expect(peak(a)).toBeLessThan(0.05 * bar.height)
        // The channel is scoured below the bare profile.
        expect(barHeight(coast, 0.8 * bar.distance, a)).toBeLessThan(-0.5 * bar.height)
      }
      for (const a of onBar.slice(0, 5)) expect(peak(a)).toBeGreaterThan(0.9 * bar.height)
      // The terrain carries it: the bar crest stands above the bare profile.
      const withoutBars = { ...coast, bars: [] }
      const a = onBar[0]
      const crest = Array.from({ length: 200 }, (_, i) => i * 1.5).reduce((best, s) => (barHeight(coast, s, a) > barHeight(coast, best, a) ? s : best), 0)
      // (Bars are measured from the low-tide terrace's seaward edge.)
      const s = crest + coast.terrace.width
      expect(at(coast, s, a) - at(withoutBars, s, a)).toBeCloseTo(barHeight(coast, crest, a), 6)
    }
  })

  it('puts cusps on steep states only, in the swash zone', () => {
    for (const p of scenes({ beachState: 'reflective', beachMaterial: 'sand', coast: 'beach' }, 20).filter(p => p.coast.cusps != null)) {
      const { coast } = p
      const heights = Array.from({ length: 200 }, (_, i) => cuspHeight(coast, 0.3 * cuspReach(coast), i))
      expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.5 * coast.cusps!.relief)
      expect(Math.abs(cuspHeight(coast, 1.4 * cuspReach(coast), 10))).toBeLessThan(1e-12)
    }
    for (const p of scenes({ beachState: 'dissipative', beachMaterial: 'sand', coast: 'beach' }, 10)) {
      expect(p.coast.cusps).toBe(null)
      expect(cuspHeight(p.coast, 1, 10)).toBe(0)
    }
  })
})
