import { describe, expect, it } from 'vitest'

import { Random } from '../src/random'
import { capillaryFringe, drainRate, exitPoint, harmonicsFor, SINCE_CAP, surfaceMoisture, tideFor, tideFlowFor, type TideFlow } from '../src/tides'
import { allParams, expectShare, scene } from './days'

// Ebb and flow (REGIONS.md §3.4): the last tide's history, the beach's
// seepage face and how long its sand has been out.

const clock = { date: '2025-07-10', localHours: 9 }
const wadden = harmonicsFor('wadden-north-sea')
const at = (tide: 'low' | 'mid' | 'high', tideFlow?: 'ebb' | 'flood') =>
  tideFor([2, 2], wadden, clock, new Random('x'), { tide, tidalRange: 2, ...(tideFlow != null ? { tideFlow } : {}) })

describe('the flow', () => {
  it('runs the forced way at half tide, at the same level', () => {
    const ebb = at('mid', 'ebb')
    const flood = at('mid', 'flood')
    expect(ebb.flow!.rate).toBeLessThan(-0.2)
    expect(flood.flow!.rate).toBeGreaterThan(0.2)
    expect(ebb.level).toBeCloseTo(flood.level)
  })

  it('stands still at high and low water', () => {
    expect(Math.abs(at('high').flow!.rate)).toBeLessThan(0.05)
    expect(Math.abs(at('low').flow!.rate)).toBeLessThan(0.05)
  })

  it('counts hours since each height was wet, rising with height', () => {
    for (const t of [at('mid', 'ebb'), at('mid', 'flood'), at('low')]) {
      const { since } = t.flow!
      expect(since[0]).toBe(0)
      for (let i = 1; i < since.length; i++) expect(since[i]).toBeGreaterThanOrEqual(since[i - 1])
      expect(since[since.length - 1]).toBeLessThan(SINCE_CAP)
    }
    // At half tide the sand above the water has been out minutes on the ebb, hours on the flood.
    expect(at('mid', 'ebb').flow!.since[2]).toBeLessThan(1.5)
    expect(at('mid', 'flood').flow!.since[2]).toBeGreaterThan(4)
  })
})

describe('the seepage face', () => {
  const seep = (t: ReturnType<typeof at>, grain: number, material: 'sand' | 'shingle' = 'sand') =>
    exitPoint(wadden, clock, t.flow!.scale, t.flow!.moment, drainRate(material, grain))

  it('covers about the lower third of a 2 m tide on fine sand at low water (Brakenhoff et al. 2019)', () => {
    const s = seep(at('low'), 0.2)
    expect(s / 2).toBeGreaterThan(0.25)
    expect(s / 2).toBeLessThan(0.45)
  })

  it('shrinks with coarser grain and is gone on stones', () => {
    const low = at('low')
    expect(seep(low, 0.3)).toBeLessThan(seep(low, 0.2))
    expect(seep(low, 0.6)).toBeLessThan(0.05)
    expect(seep(low, 20, 'shingle')).toBe(0)
  })

  it('is wider on the ebb than on the flood at the same level', () => {
    expect(seep(at('mid', 'ebb'), 0.2)).toBeGreaterThan(seep(at('mid', 'flood'), 0.2) + 0.2)
  })

  it('keeps fine sand moist higher than coarse (the capillary fringe)', () => {
    expect(capillaryFringe('sand', 0.1)).toBeGreaterThan(0.4)
    expect(capillaryFringe('sand', 1)).toBeLessThan(0.1)
  })
})

describe('the sand', () => {
  const flowOf = (t: ReturnType<typeof at>, grain: number): TideFlow => ({
    ...t.flow!,
    seep: exitPoint(wadden, clock, t.flow!.scale, t.flow!.moment, drainRate('sand', grain)),
    fringe: capillaryFringe('sand', grain)
  })

  it('is wetter above the swash on the ebb than on the flood', () => {
    const ebb = flowOf(at('mid', 'ebb'), 0.3)
    const flood = flowOf(at('mid', 'flood'), 0.3)
    for (const h of [0.4, 0.6, 0.8]) expect(surfaceMoisture(ebb, h, 0.2)).toBeGreaterThan(surfaceMoisture(flood, h, 0.2) + 0.2)
  })

  it('is saturated on the seepage face and dry above the last high water', () => {
    const ebb = flowOf(at('mid', 'ebb'), 0.2)
    expect(ebb.seep).toBeGreaterThan(0.1)
    expect(surfaceMoisture(ebb, ebb.seep / 2, 0)).toBe(1)
    expect(surfaceMoisture(ebb, ebb.lastHigh + 0.5, 0)).toBeLessThan(0.01)
  })
})

describe('on real days', () => {
  const beaches = allParams().filter(p => p.coast.type === 'beach')

  it('has a flow on every day, about as often ebb as flood', () => {
    for (const p of allParams()) expect(p.coast.tide.flow).not.toBeNull()
    const moving = beaches.filter(p => Math.abs(p.coast.tide.flow!.rate) > 0.05)
    expectShare(moving, p => p.coast.tide.flow!.rate > 0, 0.5, 4)
  })

  it('seeps only on sand, and mostly on the ebb', () => {
    for (const p of beaches) if (p.coast.material === 'shingle' || p.coast.material === 'cobble') expect(p.coast.tide.flow!.seep).toBe(0)
    const seeping = beaches.filter(p => p.coast.tide.flow!.seep > 0.1)
    expect(seeping.length).toBeGreaterThan(30)
    expect(seeping.filter(p => p.coast.tide.flow!.rate <= 0.05).length / seeping.length).toBeGreaterThan(0.6)
  })

  it('is switched off by the spec', () => {
    expect(scene({ coast: 'beach', tideFlow: null, eclipse: null }).coast.tide.flow).toBeNull()
  })

  it('history is deterministic and unforced days stand at now', () => {
    const p = beaches[0]
    expect(p.coast.tide.flow!.moment).toBe(0)
    expect(tideFlowFor(harmonicsFor(p.place.id), { date: p.date, localHours: 0 }, 1, 0)).toEqual(tideFlowFor(harmonicsFor(p.place.id), { date: p.date, localHours: 0 }, 1, 0))
  })
})
