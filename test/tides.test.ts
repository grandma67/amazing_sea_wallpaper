import { describe, expect, it } from 'vitest'

import { beachLines } from '../src/beach'
import { hasLand } from '../src/coastKind'
import { generateParams } from '../src/params'
import { placeNamed, PLACES } from '../src/places'
import { Random } from '../src/random'
import { shoreToWorld, terrainHeight } from '../src/terrain'
import { MICRO_TIDE, NEAP, SPRING, springFactor, terraceFor, tideFor, tideMarks, tideModified, waterlineAt } from '../src/tides'
import { allParams, scene, scenes } from './days'

const at = (coast: ReturnType<typeof scene>['coast'], s: number, a = 0): number => terrainHeight(coast, ...shoreToWorld(coast, s, a))
const beach = { coast: 'beach', beachMaterial: 'sand', eclipse: null } as const

describe('tide ranges', () => {
  // Classes (REGIONS.md §3): test the class, not ≈ values.
  const meanOf = (id: string): number => (placeNamed(id).tide[0] + placeNamed(id).tide[1]) / 2
  it('are micro-tidal in the Mediterranean, Caribbean and Baltic, mega-tidal at Fundy and Saint-Malo', () => {
    for (const id of ['aegean', 'western-med', 'antilles', 'baltic', 'hawaii']) expect(meanOf(id)).toBeLessThan(1)
    for (const id of ['wadden-north-sea', 'cornwall-wales', 'iceland']) {
      expect(meanOf(id)).toBeGreaterThanOrEqual(1.5)
      expect(meanOf(id)).toBeLessThan(5)
    }
    for (const id of ['fundy', 'mont-saint-michel', 'bristol-channel', 'cook-inlet', 'yellow-sea', 'nw-australia']) expect(meanOf(id)).toBeGreaterThan(6)
  })

  it('are set for every place, low to high', () => {
    for (const p of PLACES) {
      expect(p.tide[0]).toBeGreaterThan(0)
      expect(p.tide[1]).toBeGreaterThanOrEqual(p.tide[0])
      expect(p.tide[1]).toBeLessThan(13)
    }
  })
})

describe('tideFor', () => {
  it('has springs at new and full moon, neaps at the quarters', () => {
    expect(springFactor(18)).toBeCloseTo(SPRING)
    expect(springFactor(198)).toBeCloseTo(SPRING)
    expect(springFactor(108)).toBeCloseTo(NEAP)
    for (let phase = 0; phase < 360; phase += 7) {
      expect(springFactor(phase)).toBeGreaterThanOrEqual(NEAP - 1e-9)
      expect(springFactor(phase)).toBeLessThanOrEqual(SPRING + 1e-9)
    }
  })

  it('keeps the level within the range, and the spec forces stage and range', () => {
    for (let i = 0; i < 200; i++) {
      const t = tideFor([4, 8], i * 1.8, new Random(`t${i}`))
      expect(Math.abs(t.level)).toBeLessThanOrEqual(t.range / 2 + 1e-9)
      expect(t.range).toBeLessThanOrEqual(t.springRange + 1e-9)
      expect(t.mean).toBeGreaterThanOrEqual(4)
    }
    const high = tideFor([4, 8], 0, new Random('x'), { tide: 'high' })
    expect(high.level).toBeCloseTo(high.range / 2)
    expect(tideFor([4, 8], 0, new Random('x'), { tide: 'low' }).level).toBeCloseTo(-high.range / 2)
    expect(tideFor([4, 8], 0, new Random('x'), { tide: 'mid' }).level).toBeCloseTo(0)
    // Forcing draws the same, so the mean is the drawn one.
    expect(tideFor([4, 8], 0, new Random('x'), { tidalRange: 15 })).toMatchObject({ range: 15, springRange: 15, mean: high.mean })
  })
})

describe('the beach for its range', () => {
  it('has no terrace on micro-tidal beaches and one within 400 m on big tides', () => {
    expect(terraceFor(MICRO_TIDE)).toEqual({ height: 0, width: 0 })
    for (const range of [3, 6, 10, 14]) {
      const t = terraceFor(range)
      expect(2 * t.height).toBeCloseTo(range - MICRO_TIDE)
      expect(t.width).toBeLessThanOrEqual(400 + 1e-9)
      expect(t.width).toBeGreaterThan(50)
    }
  })

  it('puts the water at today’s waterline, the land lowered by the level', () => {
    for (const p of scenes({ ...beach, place: 'brittany' }, 12)) {
      const { coast } = p
      expect(Math.abs(at(coast, coast.waterline))).toBeLessThan(0.6)
      expect(at(coast, coast.waterline - 30)).toBeGreaterThan(0)
      expect(at(coast, coast.waterline + 30)).toBeLessThan(0)
      // The same beach at another level is the same land, shifted.
      const low = { ...coast, tide: { ...coast.tide, level: coast.tide.level - 1 } }
      for (const s of [-30, 0, 50, 200]) expect(at(low, s, 7) - at(coast, s, 7)).toBeCloseTo(1, 9)
      expect(waterlineAt(coast, coast.tide.level)).toBe(coast.waterline)
    }
  })

  it('moves the water hundreds of metres on mega-tidal beaches, keeping the camera by it', () => {
    const date = '2024-05-08'
    const low = scene({ ...beach, place: 'mont-saint-michel', tide: 'low', composition: 'along-beach' }, date)
    const high = scene({ ...beach, place: 'mont-saint-michel', tide: 'high', composition: 'along-beach' }, date)
    expect(low.coast.waterline - high.coast.waterline).toBeGreaterThan(250)
    for (const p of [low, high]) {
      const toWater = p.coast.distanceToWater + p.coast.waterline
      expect(toWater).toBeGreaterThanOrEqual(8)
      expect(toWater).toBeLessThanOrEqual(p.coast.beachWidth * 0.8)
    }
    // The lines on the land stay where they were.
    expect(beachLines(low.coast)).toEqual(beachLines(high.coast))
  })

  it('puts the wrack line above the spring high water, and plants above that', () => {
    for (const p of scenes({ ...beach, place: 'fundy' }, 10)) {
      const { coast } = p
      const { highTide } = beachLines(coast)
      expect(at(coast, -highTide) + coast.tide.level).toBeGreaterThan(coast.tide.springRange / 2)
      expect(tideMarks(coast).spring).toBeCloseTo(coast.tide.springRange / 2 - coast.tide.level)
    }
  })

  it('leaves micro-tidal days within a few centimetres of mean sea', () => {
    for (const p of scenes({ ...beach, place: 'aegean' }, 20)) {
      expect(p.coast.terrace.width).toBe(0)
      expect(Math.abs(p.coast.tide.level)).toBeLessThan(0.3)
    }
  })
})

describe('tide-modified beach states', () => {
  it('follow the relative tide range (Masselink & Short 1993)', () => {
    expect(tideModified('longshore-bar', 'sand', 2)).toBe('longshore-bar')
    expect(tideModified('reflective', 'sand', 5)).toBe('low-tide-terrace')
    expect(tideModified('rhythmic-bar', 'sand', 5)).toBe('transverse-bar-rip')
    expect(tideModified('dissipative', 'sand', 5)).toBe('dissipative')
    expect(tideModified('transverse-bar-rip', 'sand', 12)).toBe('dissipative')
    expect(tideModified('reflective', 'shingle', 50)).toBe('reflective')
    expect(tideModified('rhythmic-bar', 'mixed', 5)).toBe('low-tide-terrace')
  })

  it('are the rule on mega-tidal sand beaches', () => {
    for (const p of scenes({ ...beach, place: 'bristol-channel', beachMaterial: 'sand' }, 20)) {
      expect(['low-tide-terrace', 'transverse-bar-rip', 'dissipative']).toContain(p.coast.state)
    }
  })
})

describe('tides over real days', () => {
  it('is deterministic, and a forced stage keeps the rest of the day', () => {
    expect(generateParams('2025-02-03').coast.tide).toEqual(generateParams('2025-02-03').coast.tide)
    const drawn = scene({ ...beach, place: 'brittany' }, '2025-02-03')
    const high = scene({ ...beach, place: 'brittany', tide: 'high' }, '2025-02-03')
    expect(high.coast.tide.mean).toBe(drawn.coast.tide.mean)
    expect(high.coast.terrace).toEqual(drawn.coast.terrace)
    expect(high.title).toBe(drawn.title)
  })

  it('give most beach days a micro or meso tide, and about one in ten a big one', () => {
    const beaches = allParams().filter(p => hasLand(p.coast))
    const big = beaches.filter(p => p.coast.tide.springRange >= 4).length / beaches.length
    expect(big).toBeGreaterThan(0.04)
    expect(big).toBeLessThan(0.2)
  })
})
