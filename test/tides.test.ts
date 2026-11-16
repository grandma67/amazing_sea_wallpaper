import { describe, expect, it } from 'vitest'

import { beachLines } from '../src/beach'
import { hasLand } from '../src/coastKind'
import { placeNamed, PLACES } from '../src/places'
import { Random } from '../src/random'
import { GAUGE_KM, harmonicsFor, MICRO_TIDE, terraceFor, tideFor, tideHeight, tideMarks, tideModified, waterlineAt, type Harmonics } from '../src/tides'
import { TIDE_GAUGES } from '../src/tideGauges'
import { allParams, heightAt as at, scene, scenes } from './days'

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

// NOAA's constants (api.tidesandcurrents.noaa.gov harcon, metres, Greenwich
// phase) and its hourly predictions for 2025-07-10 (MSL, GMT), every 3 h.
const PENSACOLA: Harmonics = { lonEast: -87.21, M2: [0.017, 172.1], S2: [0.005, 175.9], K1: [0.125, 58.2], O1: [0.122, 47.9] }
const SAN_FRANCISCO: Harmonics = { lonEast: -122.47, M2: [0.576, 208.2], S2: [0.137, 216.2], K1: [0.37, 225.4], O1: [0.23, 208.4] }
const NOAA_PREDICTIONS: [Harmonics, number[], number][] = [
  [PENSACOLA, [-0.15, -0.25, -0.18, -0.01, 0.18, 0.31, 0.29, 0.1], 0.08],
  [SAN_FRANCISCO, [0.1, 0.5, 0.96, 0.16, -1.07, -0.93, 0.01, 0.45], 0.3]
]
/** A clock in GMT for a gauge: local solar hours from universal ones. */
const gmt = (h: Harmonics, date: string, ut: number) => ({ date, localHours: ut + h.lonEast / 15 })

describe('the harmonic tide', () => {
  it.each(NOAA_PREDICTIONS)('matches NOAA’s predictions (%#)', (h, values, tolerance) => {
    values.forEach((v, i) => expect(Math.abs(tideHeight(h, gmt(h, '2025-07-10', i * 3)) - v)).toBeLessThan(tolerance))
  })

  const highs = (h: Harmonics, date: string): number => {
    let n = 0
    const at = (t: number) => tideHeight(h, { date, localHours: 0 }, t)
    for (let t = 0.25; t < 24.84; t += 0.25) if (at(t) > at(t - 0.25) && at(t) >= at(t + 0.25)) n++
    return n
  }

  it('has one high water a day on a diurnal coast, two on a semidiurnal one', () => {
    expect(highs(PENSACOLA, '2025-07-10')).toBe(1)
    expect(highs(harmonicsFor('brittany'), '2025-07-10')).toBe(2)
  })

  it('has springs after new and full moon, neaps at the quarters (Brittany, 2025)', () => {
    const h = harmonicsFor('brittany')
    const range = (date: string) => {
      const v = Array.from({ length: 100 }, (_, i) => tideHeight(h, { date, localHours: 0 }, i * 0.25))
      return Math.max(...v) - Math.min(...v)
    }
    // New moon 2025-07-24, first quarter 2025-08-01 (springs a day or two late).
    expect(range('2025-07-25') / range('2025-08-02')).toBeGreaterThan(1.6)
  })

  it('brings spring high water at about the same clock time each fortnight', () => {
    const h = harmonicsFor('brittany')
    const hwTime = (date: string) => {
      let best = 0
      for (let t = 0; t < 12.42; t += 0.1) if (tideHeight(h, { date, localHours: t }) > tideHeight(h, { date, localHours: best })) best = t
      return best
    }
    // Two days after new moons through 2025.
    const times = ['2025-01-31', '2025-03-31', '2025-05-29', '2025-07-26', '2025-09-23', '2025-11-22'].map(hwTime)
    expect(Math.max(...times) - Math.min(...times)).toBeLessThan(1.5)
  })

  it('uses a gauge only near the place', () => {
    for (const [id, g] of Object.entries(TIDE_GAUGES)) {
      const h = harmonicsFor(id)
      if (g.km <= GAUGE_KM) expect(h.M2).toEqual(g.M2)
      else expect(h.M2[0]).toBe(1)
    }
  })
})

describe('tideFor', () => {
  const clock = { date: '2025-07-10', localHours: 15 }
  it('keeps the level between the day’s low and high, scaled to the drawn mean; the spec forces stage and range', () => {
    for (let i = 0; i < 60; i++) {
      const t = tideFor([4, 8], harmonicsFor('brittany'), { date: '2025-07-10', localHours: i * 0.7 }, new Random(`t${i}`))
      expect(t.level).toBeLessThanOrEqual(t.high + 1e-9)
      expect(t.level).toBeGreaterThanOrEqual(t.high - t.range - 1e-9)
      expect(t.range).toBeLessThanOrEqual(t.springRange + 1e-9)
      expect(t.mean).toBeGreaterThanOrEqual(4)
    }
    const h = harmonicsFor('brittany')
    const high = tideFor([4, 8], h, clock, new Random('x'), { tide: 'high' })
    expect(high.level).toBeCloseTo(high.high)
    expect(tideFor([4, 8], h, clock, new Random('x'), { tide: 'low' }).level).toBeCloseTo(high.high - high.range)
    expect(tideFor([4, 8], h, clock, new Random('x'), { tide: 'mid' }).level).toBeCloseTo(high.high - high.range / 2)
    // Forcing draws the same, so the mean is the drawn one.
    expect(tideFor([4, 8], h, clock, new Random('x'), { tidalRange: 15 })).toMatchObject({ range: 15, springRange: 15, mean: high.mean })
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
      expect(Math.abs(p.coast.tide.level - p.coast.tide.surge)).toBeLessThan(0.3)
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
  it('give most beach days a micro or meso tide, and about one in ten a big one', () => {
    const beaches = allParams().filter(p => hasLand(p.coast))
    const big = beaches.filter(p => p.coast.tide.springRange >= 4).length / beaches.length
    expect(big).toBeGreaterThan(0.04)
    expect(big).toBeLessThan(0.2)
  })
})
