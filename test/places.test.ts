import { describe, expect, it } from 'vitest'

import { CLIMATES, PLACES, placeNamed, placesFor, plantsFor, REGION_IDS, type Climate } from '../src/places'
import { OCEANS } from '../src/oceans'
import { allParams, scene, scenes, share } from './days'

describe('places', () => {
  const days = allParams()

  it('weights places by √ of region length: nordic ≈ 42%, tropical 23%, mediterranean 14%, volcanic 13%, desert 9%', () => {
    expect(PLACES.reduce((sum, p) => sum + p.weight, 0)).toBeCloseTo(1, 6)
    const weight = (biome: string) => PLACES.filter(p => p.biome === biome).reduce((sum, p) => sum + p.weight, 0)
    expect(weight('nordic')).toBeCloseTo(0.42, 1)
    expect(weight('tropical')).toBeCloseTo(0.23, 1)
    expect(weight('mediterranean')).toBeCloseTo(0.14, 1)
    expect(weight('volcanic')).toBeCloseTo(0.13, 1)
    expect(weight('desert')).toBeCloseTo(0.09, 1)
    // Over three real years, within a few points.
    for (const biome of ['nordic', 'tropical', 'mediterranean', 'volcanic', 'desert']) {
      expect(Math.abs(share(days, p => p.biome.name === biome) - weight(biome))).toBeLessThan(0.04)
    }
    // A region's places split its weight by length.
    const norway = PLACES.filter(p => p.region === 'norway')
    expect(norway[0].weight / norway[1].weight).toBeCloseTo(norway[0].km / norway[1].km, 6)
  })

  it('gives every place valid choices, a signed latitude range and a known region', () => {
    for (const p of PLACES) {
      const oceans = Object.entries(p.ocean)
      const climates = Object.entries(p.climate)
      expect(oceans.length).toBeGreaterThan(0)
      expect(climates.length).toBeGreaterThan(0)
      for (const [ocean, w] of oceans) {
        expect(Object.keys(OCEANS)).toContain(ocean)
        expect(w).toBeGreaterThan(0)
      }
      for (const [climate] of climates) expect(CLIMATES).toContain(climate)
      expect(p.latitude[0]).toBeLessThanOrEqual(p.latitude[1])
      expect(Math.abs(p.latitude[0])).toBeLessThanOrEqual(90)
      expect(REGION_IDS).toContain(p.region)
      for (const [climate] of climates) expect(plantsFor(p, climate as Climate, null, 45).length).toBeGreaterThan(0)
    }
    expect(new Set(PLACES.map(p => p.id)).size).toBe(PLACES.length)
  })

  it('draws each day within its place: ocean, climate, latitude and hemisphere', () => {
    for (const p of days) {
      const place = placeNamed(p.place.id)
      expect(p.biome.name).toBe(place.biome)
      expect(p.place.region).toBe(place.region)
      expect(place.ocean[p.sea.ocean] ?? 0).toBeGreaterThan(0)
      expect(place.climate[p.place.climate] ?? 0).toBeGreaterThan(0)
      expect(p.latitudeDeg).toBeGreaterThanOrEqual(place.latitude[0])
      expect(p.latitudeDeg).toBeLessThanOrEqual(place.latitude[1])
      expect(p.place.hemisphere).toBe(p.latitudeDeg < 0 ? 'south' : 'north')
    }
    // Southern places are south.
    expect(scene({ place: 'tasmania' }).latitudeDeg).toBeLessThan(0)
    expect(scene({ place: 'svalbard' }).latitudeDeg).toBeGreaterThan(75)
    expect(share(days, p => p.place.hemisphere === 'south')).toBeGreaterThan(0.1)
  })

  it('forces a place, a region, a biome, an ocean or a climate', () => {
    for (const p of scenes({ place: 'scotland' }, 10)) expect(p.place.id).toBe('scotland')
    for (const p of scenes({ place: 'atlantic-canada' }, 20)) expect(p.place.region).toBe('atlantic-canada')
    for (const p of scenes({ biome: 'desert' }, 20)) expect(p.biome.name).toBe('desert')
    for (const p of scenes({ ocean: 'arctic' }, 20)) {
      expect(p.sea.ocean).toBe('arctic')
      expect(placeNamed(p.place.id).ocean.arctic).toBeGreaterThan(0)
    }
    for (const p of scenes({ climate: 'subtropical' }, 20)) expect(p.place.climate).toBe('subtropical')
    // Forcing a choice the place only sometimes makes.
    for (const p of scenes({ place: 'norway-north', ocean: 'arctic', climate: 'polar' }, 10)) {
      expect([p.sea.ocean, p.place.climate]).toEqual(['arctic', 'polar'])
    }
  })

  it('throws on combinations no place has', () => {
    expect(() => scene({ biome: 'tropical', ocean: 'arctic' })).toThrow(/no place/)
    expect(() => scene({ place: 'svalbard', biome: 'desert' })).toThrow(/no place/)
    expect(() => placesFor({ climate: 'arid', ocean: 'southern' })).toThrow(/no place/)
  })

  it('puts no mountains, volcanoes or high islands by flat coasts', () => {
    for (const place of ['florida-carolinas', 'wadden-north-sea', 'maldives', 'bahamas-bermuda']) {
      expect(placeNamed(place).mountains).toBe(false)
      for (const p of scenes({ place }, 30)) expect(p.landform, place).toBeNull()
      for (const p of scenes({ place }, 30)) expect(['cay', 'skerries', undefined]).toContain(p.islands?.kind)
    }
    expect(scenes({ place: 'florida-carolinas', landform: 'range' }, 3).every(p => p.landform?.kind === 'range')).toBe(true)
    expect(scenes({ place: 'iceland' }, 60).some(p => p.landform != null)).toBe(true)
  })
})
