import { describe, expect, it } from 'vitest'

import { FAIRY_CELL, FAIRY_CHANCE, FAIRY_DEAD_SHARE, fairyRingAt, fairyRingCell } from '../src/fairyRings'
import { FAIRY_SEASON, fairyRingsFor, type PhenologyDay } from '../src/phenology'
import type { Climate } from '../src/biome'
import { parseSceneSpec } from '../src/sceneSpec'
import { allParams, expectEvery, scene } from './days'

// NATURE_PLAN phase 10: fairy rings on the turf (fairyRings.ts; season in
// phenology.ts fairyRingsFor; drawn in terrain.ts's ground cover).

const day = (date: string, climate: PhenologyDay['place']['climate'], latitudeDeg = 50, overrides?: PhenologyDay['overrides']): PhenologyDay => ({
  date,
  latitudeDeg,
  place: { id: 'test', climate },
  overrides
})

const CLIMATES: Climate[] = ['polar', 'boreal', 'temperate', 'mediterranean', 'subtropical', 'tropical', 'arid']

describe('fairy rings', () => {
  it('are fixed in the world: ~1.6 a hectare, mostly 2–10 m across, some with a dead band', () => {
    const rings = []
    for (let x = -100; x < 100; x++) for (let z = -100; z < 100; z++) rings.push(fairyRingCell(x, z))
    const found = rings.filter(r => r != null)
    const perHa = found.length / ((rings.length * FAIRY_CELL * FAIRY_CELL) / 10_000)
    expect(perHa).toBeGreaterThan(FAIRY_CHANCE * 16 * 0.9)
    expect(perHa).toBeLessThan(FAIRY_CHANCE * 16 * 1.1)
    const common = found.filter(r => r.r >= 1 && r.r <= 5).length / found.length
    expect(common).toBeGreaterThan(0.65)
    expect(common).toBeLessThan(0.85)
    // The 3 × 3 cell search must reach every ring over a point.
    expect(Math.max(...found.map(r => r.r * 1.1 + r.band + 0.2))).toBeLessThan(FAIRY_CELL)
    const dead = found.filter(r => r.dead > 0).length / found.length
    expect(Math.abs(dead - FAIRY_DEAD_SHARE)).toBeLessThan(0.05)
    expect(fairyRingCell(17, -4)).toEqual(fairyRingCell(17, -4))
  })

  it('draws a narrow dark band round each ring, broken into arcs, and the dead band inside it', () => {
    const ring = [...Array(400).keys()].map(i => [i % 20, Math.floor(i / 20)]).map(([x, z]) => fairyRingCell(x, z)).find(r => r != null && r.dead > 0 && r.r > 3)!
    let onBand = 0
    let deadInside = 0
    const n = 360
    for (let i = 0; i < n; i++) {
      const t = (i / n) * 2 * Math.PI
      // Across the band's wobble (±6%), take the strongest.
      let best = 0
      let deadBest = 0
      for (let k = -0.08; k <= 0.08; k += 0.005) {
        const at = fairyRingAt(ring.x + Math.cos(t) * ring.r * (1 + k), ring.z + Math.sin(t) * ring.r * (1 + k))
        best = Math.max(best, at.dark)
        deadBest = Math.max(deadBest, at.dead)
      }
      onBand += best > 0.5 ? 1 : 0
      deadInside += deadBest > 0.5 ? 1 : 0
    }
    // Most of the circle, not all of it (est.: about a quarter in gaps).
    expect(onBand / n).toBeGreaterThan(0.5)
    expect(onBand / n).toBeLessThan(0.97)
    expect(deadInside / n).toBeGreaterThan(0.4)
    // Nothing at the centre or well outside.
    expect(fairyRingAt(ring.x, ring.z).dark).toBe(0)
    expect(fairyRingAt(ring.x + ring.r * 1.5, ring.z).dark).toBe(0)
  })

  it('show in the growing season by climate, both hemispheres, fainter out of it', () => {
    for (const climate of CLIMATES) {
      const row = FAIRY_SEASON[climate]
      for (let m = 1; m <= 12; m++) {
        const date = `2025-${String(m).padStart(2, '0')}-15`
        const v = fairyRingsFor(day(date, climate))
        if (row == null) expect(v, `${climate} ${m}`).toBe(0)
        else {
          expect(v).toBeGreaterThanOrEqual(row.off)
          expect(v).toBeLessThanOrEqual(1)
        }
      }
    }
    expect(fairyRingsFor(day('2025-08-15', 'temperate'))).toBe(1)
    expect(fairyRingsFor(day('2025-01-15', 'temperate'))).toBeCloseTo(0.3)
    // Southern: the months swap.
    expect(fairyRingsFor(day('2025-01-15', 'temperate', -40))).toBe(1)
    expect(fairyRingsFor(day('2025-08-15', 'temperate', -40))).toBeCloseTo(0.3)
    // Mediterranean: the wet winter, not the dry summer.
    expect(fairyRingsFor(day('2025-01-15', 'mediterranean'))).toBe(1)
    expect(fairyRingsFor(day('2025-08-15', 'mediterranean'))).toBeCloseTo(0.3)
    expect(fairyRingsFor(day('2025-07-15', 'boreal'))).toBe(1)
    expect(fairyRingsFor(day('2025-07-15', 'arid'))).toBe(0)
  })

  it('are forced and switched off by the spec', () => {
    expect(fairyRingsFor(day('2025-07-15', 'arid', 20, { fairyRings: true }))).toBe(1)
    expect(fairyRingsFor(day('2025-07-15', 'temperate', 50, { fairyRings: false }))).toBe(0)
    expect(fairyRingsFor(day('2025-07-15', 'temperate', 50, { phenology: false }))).toBe(0)
    expect(() => parseSceneSpec({ props: { fairyRings: 'yes' } })).toThrow(/spec\.props\.fairyRings/)
    const plain = scene({ place: 'scotland', coast: 'beach' }, '2025-08-15')
    const off = scene({ place: 'scotland', coast: 'beach', props: { fairyRings: false } }, '2025-08-15')
    expect(fairyRingsFor(plain)).toBe(1)
    expect(fairyRingsFor(off)).toBe(0)
    expect({ ...off, overrides: undefined }).toEqual({ ...plain, overrides: undefined })
  })

  it('on real days, only in climates with a season row', () => {
    expectEvery(
      allParams().filter(p => fairyRingsFor(p) > 0),
      p => FAIRY_SEASON[p.place.climate] != null,
      { what: p => [p.date, p.place.id] }
    )
  })
})
