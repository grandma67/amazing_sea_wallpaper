import { describe, expect, it } from 'vitest'

import type { Climate } from '../src/biome'
import { MOSS, MOSS_WET_PLACES, mossAmount, mossLook, mossWetness, type MossDay } from '../src/phenology'
import { PLACES } from '../src/places'
import { MOSS_COLOR } from '../src/rockShore'
import { allParams, expectEvery, scene } from './days'

// NATURE_PLAN phase 7: moss on rock by climate and place, coloured by today's
// wetness (phenology.ts mossLook; props/rocks.ts, the rock-shore terrain).

const CLIMATES = Object.keys(MOSS) as Climate[]
const day = (date: string, id: string, climate: Climate, weather: Partial<MossDay['weather']> = {}, extra: Partial<MossDay> = {}): MossDay => {
  const place = PLACES.find(p => p.id === id)!
  return {
    date,
    latitudeDeg: (place.latitude[0] + place.latitude[1]) / 2,
    place: { id, climate },
    weather: { kind: 'few', marineLayer: false, ...weather },
    storm: null,
    fog: null,
    ...extra
  }
}

describe('moss', () => {
  it('has an amount for every climate and place, none on arid coasts, more on the wettest', () => {
    for (const place of PLACES) {
      for (const climate of Object.keys(place.climate) as Climate[]) {
        const a = mossAmount(day('2025-06-15', place.id, climate))!
        expect(a, `${place.id} ${climate}`).toBeGreaterThanOrEqual(0)
        expect(a).toBeLessThanOrEqual(1.3)
        if (climate === 'arid') expect(a).toBe(0)
        if (MOSS_WET_PLACES.includes(place.id) && climate === 'temperate') expect(a).toBeCloseTo(1.3)
      }
    }
    expect(MOSS_WET_PLACES.every(id => PLACES.some(p => p.id === id))).toBe(true)
    expect(CLIMATES.every(c => MOSS[c] >= 0 && MOSS[c] <= 1)).toBe(true)
  })

  it('is wet in temperate, boreal and polar climates all year, in both hemispheres', () => {
    for (const [id, climate] of [['scotland', 'temperate'], ['new-zealand-south', 'temperate'], ['baltic', 'boreal'], ['greenland', 'polar']] as const) {
      for (let m = 1; m <= 12; m++) expect(mossWetness(day(`2025-${String(m).padStart(2, '0')}-15`, id, climate)), `${id} ${m}`).toBe(1)
    }
  })

  it('dries in a Mediterranean summer, by the local season, and is wet on an overcast or foggy day there', () => {
    expect(mossWetness(day('2025-08-15', 'western-med', 'mediterranean'))).toBeLessThan(0.1)
    expect(mossWetness(day('2025-01-15', 'western-med', 'mediterranean'))).toBe(1)
    // South: August is winter.
    expect(mossWetness(day('2025-08-15', 'sw-australia', 'mediterranean'))).toBe(1)
    expect(mossWetness(day('2025-02-15', 'sw-australia', 'mediterranean'))).toBeLessThan(0.1)
    expect(mossWetness(day('2025-08-15', 'western-med', 'mediterranean', { kind: 'overcast' }))).toBe(1)
    expect(mossWetness(day('2025-08-15', 'western-med', 'mediterranean', {}, { fog: { kind: 'advection' } }))).toBe(1)
    expect(mossWetness(day('2025-08-15', 'western-med', 'mediterranean', { marineLayer: true }))).toBe(1)
  })

  it('is wet in the humid tropics, dry in a savanna’s dry season and on arid coasts', () => {
    expect(mossWetness(day('2025-03-15', 'philippines', 'tropical'))).toBe(1)
    const savanna = PLACES.find(p => p.drySeason != null && p.drySeason.latitudeDeg == null)!
    const months = Array.from({ length: 12 }, (_, i) => mossWetness(day(`2025-${String(i + 1).padStart(2, '0')}-15`, savanna.id, Object.keys(savanna.climate)[0] as Climate)))
    expect(Math.min(...months), savanna.id).toBeLessThan(0.3)
    expect(Math.max(...months), savanna.id).toBe(1)
    expect(mossWetness(day('2025-03-15', 'namibia', 'arid'))).toBe(0)
  })

  it('dries to brown by half at most, and the switches', () => {
    const dry = mossLook(day('2025-08-15', 'western-med', 'mediterranean'))!
    expect(dry.dry).toBeGreaterThan(0.45)
    expect(dry.dry).toBeLessThanOrEqual(0.5)
    expect(mossLook(day('2025-08-15', 'western-med', 'mediterranean', {}, { overrides: { moss: false } }))).toBeUndefined()
    expect(mossLook(day('2025-08-15', 'western-med', 'mediterranean', {}, { overrides: { phenology: false } }))!.dry).toBe(0)
  })

  it('keeps the green by biome (rockShore.ts MOSS_COLOR, read by rocks and the shore alike)', () => {
    expect(Object.keys(MOSS_COLOR).sort()).toEqual(['desert', 'mediterranean', 'nordic', 'tropical', 'volcanic'])
  })

  it('on real days: none on arid days, and a look on every land day', () => {
    const land = allParams().filter(p => p.coast.type !== 'open-sea')
    expectEvery(land, p => mossLook(p) != null && (p.place.climate !== 'arid' || mossLook(p)!.amount === 0), { what: p => [p.date, p.place.id] })
  })

  it('a spec switch that leaves the day as drawn', () => {
    const plain = scene({ place: 'scotland', coast: 'rock-shore' }, '2025-08-15')
    const off = scene({ place: 'scotland', coast: 'rock-shore', props: { moss: false } }, '2025-08-15')
    expect(mossLook(off)).toBeUndefined()
    expect({ ...off, overrides: undefined }).toEqual({ ...plain, overrides: undefined })
  })
})
