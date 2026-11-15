import { describe, expect, it } from 'vitest'

import { PLACES } from '../src/places'
import { SHELF, surgeFor, tideMarks, type SurgeDay } from '../src/tides'
import { terrainHeight } from '../src/terrain'
import { allParams, expectShare, scene } from './days'

// The weather's part of the water level (tides.ts surgeFor, REGIONS.md §3.2):
// wind setup, the inverse barometer, the sea's season.

const CALM: SurgeDay = { windSpeed: 0, windHeadingDeg: 0, seawardAzimuthDeg: 0, shelf: 'shelf', weather: 'scattered', month: 6 }

describe('surgeFor', () => {
  it('piles the sea up under an onshore gale, ~3 m at 30 m/s on a shallow shelf (1953)', () => {
    // The coast faces north (0°); an onshore wind blows toward the south (180°).
    expect(surgeFor({ ...CALM, shelf: 'shallow', windSpeed: 30, windHeadingDeg: 180 })).toBeCloseTo(2.98, 1)
    expect(surgeFor({ ...CALM, shelf: 'steep', windSpeed: 30, windHeadingDeg: 180 })).toBeLessThan(0.3)
  })

  it('goes as the square of the wind, and half as far down offshore', () => {
    const on = (u: number) => surgeFor({ ...CALM, windSpeed: u, windHeadingDeg: 180 })
    expect(on(20) / on(10)).toBeCloseTo(4)
    expect(surgeFor({ ...CALM, windSpeed: 20, windHeadingDeg: 0 })).toBeCloseTo(-on(20) / 2)
    // Along the shore: nothing.
    expect(surgeFor({ ...CALM, windSpeed: 20, windHeadingDeg: 90 })).toBeCloseTo(0)
  })

  it('lifts the sea 1 cm per hPa under a low', () => {
    expect(surgeFor({ ...CALM, weather: 'storm' })).toBeCloseTo(0.25)
    expect(surgeFor({ ...CALM, weather: 'clear' })).toBeCloseTo(-0.08)
  })

  it('follows the sea’s season: the Baltic high in December, low in June', () => {
    const baltic = PLACES.find(p => p.id === 'baltic')!.seaSeason!
    expect(surgeFor({ ...CALM, season: baltic, month: 12 })).toBeCloseTo(0.1)
    expect(surgeFor({ ...CALM, season: baltic, month: 6 })).toBeCloseTo(-0.1)
  })

  it('orders the shelves', () => {
    expect(SHELF.shallow).toBeGreaterThan(SHELF.shelf)
    expect(SHELF.shelf).toBeGreaterThan(SHELF.steep)
  })
})

describe('the surge on real days', () => {
  it('is small most days and a storm’s fraction of a metre at most', () => {
    const land = allParams().filter(p => p.coast.type !== 'open-sea')
    expectShare(land, p => Math.abs(p.coast.tide.surge) < 0.1, 0.87)
    for (const p of land) expect(Math.abs(p.coast.tide.surge)).toBeLessThan(1.5)
  })

  it('sits in the level: today’s high water rises with it, the spring line doesn’t', () => {
    const base = { eclipse: null, place: 'wadden-north-sea', coast: 'beach', tide: 'mid', composition: 'shoreline' } as const
    const [calm, surged] = [scene({ ...base, surge: null }), scene({ ...base, surge: 1 })]
    expect(surged.coast.tide.level - calm.coast.tide.level).toBeCloseTo(1)
    // World heights: the land sits 1 m lower, today's high water 0 lower.
    expect(tideMarks(surged.coast).high).toBeCloseTo(tideMarks(calm.coast).high)
    expect(tideMarks(surged.coast).spring).toBeCloseTo(tideMarks(calm.coast).spring - 1)
    // The water comes up the beach, the camera with it.
    expect(surged.coast.waterline).toBeLessThan(calm.coast.waterline)
    expect(surged.coast.distanceToWater - calm.coast.distanceToWater).toBeCloseTo(calm.coast.waterline - surged.coast.waterline)
  })

  // A surge must not wet a camera: the same day without one is the baseline.
  it.each([2, 1, -1])('keeps cameras dry under a %s m surge', surge => {
    const cases = [
      ...['wadden-north-sea', 'brittany', 'scotland'].flatMap(place => [
        { place, coast: 'beach' as const },
        { place, rockShore: 'platform' as const }
      ]),
      { place: 'wadden-north-sea', coast: 'tidal-flat' as const }
    ]
    let checked = 0
    for (const c of cases) {
      for (const tide of ['low', 'mid', 'high'] as const) {
        for (const date of ['2024-02-01', '2024-12-31', '2025-06-15', '2026-09-30']) {
          const spec = { eclipse: null, ...c, tide }
          const [calm, surged] = [scene({ ...spec, surge: null }, date), scene({ ...spec, surge }, date)]
          const before = terrainHeight(calm.coast, 0, 0)
          const after = terrainHeight(surged.coast, 0, 0)
          const where = `${date} ${tide} ${surged.coast.composition} (${surged.coast.type}, ${c.place})`
          // Heights are above today's sea, which the surge raises: a camera
          // dry by 10 cm stays dry; a marginal one gets no wetter than 10 cm.
          if (before > 0.1) expect(after, where).toBeGreaterThan(0)
          else expect(after, where).toBeGreaterThan(before - 0.1)
          checked++
        }
      }
    }
    expect(checked).toBe(84)
  })
})
