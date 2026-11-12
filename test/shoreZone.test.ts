import { describe, expect, it } from 'vitest'

import { BELT_RUNUP, LAVER, shoreWeed, sprayBelt, type PhenologyDay } from '../src/phenology'
import { PLACES } from '../src/places'
import { parseSceneSpec } from '../src/sceneSpec'
import { tideMarks } from '../src/tides'
import { MONTHS, scene } from './days'

// NATURE_PLAN phase 8: the spray belt (no moss inside it), laver and sea
// lettuce on the upper rocky shore (phenology.ts sprayBelt, shoreWeed).

const day = (date: string, id: string, latitudeDeg?: number, overrides?: Record<string, unknown>): PhenologyDay => {
  const place = PLACES.find(p => p.id === id)!
  return { date, latitudeDeg: latitudeDeg ?? (place.latitude[0] + place.latitude[1]) / 2, place: { id, climate: Object.keys(place.climate)[0] as PhenologyDay['place']['climate'] }, overrides }
}

describe('the spray belt', () => {
  it('has a height for every place: 1.5 m sheltered, 12 m exposed, 3.5–3.9 m otherwise', () => {
    for (const place of PLACES) expect([1.5, 3.5, 3.9, 12], place.id).toContain(sprayBelt(place.id))
    expect(sprayBelt('baltic')).toBe(1.5)
    expect(sprayBelt('scotland')).toBe(12)
    expect(sprayBelt('british-columbia')).toBe(3.9)
    expect(sprayBelt('california')).toBe(3.5)
    // Two climates: the main one's default (Portugal 80% Mediterranean).
    expect(sprayBelt('portugal-morocco')).toBe(3.5)
  })

  it('stands at the same height whatever the tide, the composition or the swell (forced extremes)', () => {
    const heights = new Set<string>()
    for (const tide of ['low', 'mid', 'high'] as const) {
      for (const rockShore of ['platform', 'boulder', 'cliff'] as const) {
        for (const swellHeight of [0.2, 4]) {
          const p = scene({ eclipse: null, place: 'scotland', rockShore, tide, swellHeight }, '2025-07-10')
          // In the land's frame (tides lower the land: + today's level), as
          // the shader's h − tideSpring is.
          heights.add((tideMarks(p.coast).spring + p.coast.tide.level + BELT_RUNUP + sprayBelt(p.place.id)).toFixed(3))
        }
      }
    }
    expect([...heights]).toHaveLength(1)
  })
})

describe('laver and sea lettuce', () => {
  it('grow only in a row’s places, in its months, every place × month', () => {
    const rowPlaces = new Set(LAVER.flatMap(r => r.places))
    for (const id of rowPlaces) expect(PLACES.some(p => p.id === id), id).toBe(true)
    for (const place of PLACES) {
      for (const date of MONTHS) {
        const w = shoreWeed(day(date, place.id, place.latitude[1]))
        if (!rowPlaces.has(place.id)) expect(w, `${place.id} ${date}`).toEqual({ laver: 0, seaLettuce: 0 })
        expect(w.laver).toBeGreaterThanOrEqual(0)
        expect(w.laver).toBeLessThanOrEqual(1)
      }
    }
  })

  it('laver in January in Scotland and Cornwall, in July only in Scotland; BC in February, not August', () => {
    expect(shoreWeed(day('2025-01-15', 'scotland')).laver).toBe(1)
    expect(shoreWeed(day('2025-01-15', 'cornwall-wales')).laver).toBe(1)
    expect(shoreWeed(day('2025-07-15', 'scotland')).laver).toBe(1)
    expect(shoreWeed(day('2025-07-15', 'cornwall-wales')).laver).toBe(0)
    expect(shoreWeed(day('2025-02-15', 'british-columbia')).laver).toBe(1)
    expect(shoreWeed(day('2025-08-15', 'british-columbia')).laver).toBe(0)
  })

  it('keeps to its latitude limits: Portugal north of 41°N, California north of 40°N', () => {
    expect(shoreWeed(day('2025-01-15', 'portugal-morocco', 42)).laver).toBe(1)
    expect(shoreWeed(day('2025-01-15', 'portugal-morocco', 38)).laver).toBe(0)
    expect(shoreWeed(day('2025-01-15', 'california', 41)).laver).toBe(1)
    expect(shoreWeed(day('2025-01-15', 'california', 35)).laver).toBe(0)
  })

  it('sea lettuce full Apr–Sep, 0.3 otherwise; the switches', () => {
    expect(shoreWeed(day('2025-06-15', 'scotland')).seaLettuce).toBe(1)
    expect(shoreWeed(day('2025-12-15', 'scotland')).seaLettuce).toBe(0.3)
    expect(shoreWeed(day('2025-06-15', 'scotland', undefined, { shoreWeed: false }))).toEqual({ laver: 0, seaLettuce: 0 })
    expect(shoreWeed(day('2025-06-15', 'scotland', undefined, { phenology: false }))).toEqual({ laver: 0, seaLettuce: 0 })
    expect(() => parseSceneSpec({ props: { shoreWeed: false } })).not.toThrow()
  })
})
