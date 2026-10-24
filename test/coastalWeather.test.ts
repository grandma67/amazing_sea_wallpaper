import { describe, expect, it } from 'vitest'

import { marineLayerChance, MARINE_LAYER } from '../src/coastalWeather'
import { PLACES } from '../src/places'
import { allParams, expectShare, scene, scenes } from './days'

describe('marine layer', () => {
  const morning = { timeOfDay: 'golden-hour', evening: false, eclipse: null } as const

  it('happens only in its places, months and mornings', () => {
    for (const id of Object.keys(MARINE_LAYER)) expect(PLACES.some(p => p.id === id)).toBe(true)
    expect(marineLayerChance({ place: 'california', month: 6, timeOfDay: 'golden-hour', evening: false })).toBe(0.45)
    expect(marineLayerChance({ place: 'california', month: 9, timeOfDay: 'daylight', evening: false })).toBe(0.15)
    expect(marineLayerChance({ place: 'california', month: 1, timeOfDay: 'golden-hour', evening: false })).toBe(0)
    expect(marineLayerChance({ place: 'california', month: 6, timeOfDay: 'golden-hour', evening: true })).toBe(0)
    expect(marineLayerChance({ place: 'california', month: 6, timeOfDay: 'midday', evening: false })).toBe(0)
    expect(marineLayerChance({ place: 'california', month: 6, timeOfDay: 'night', evening: false })).toBe(0)
    expect(marineLayerChance({ place: 'atacama-peru', month: 8, timeOfDay: 'sun-on-horizon', evening: false })).toBe(0.3)
    expect(marineLayerChance({ place: 'western-med', month: 6, timeOfDay: 'golden-hour', evening: false })).toBe(0)
    for (const p of allParams()) {
      if (!p.weather.marineLayer) continue
      expect(Object.keys(MARINE_LAYER)).toContain(p.place.id)
      expect(p.evening).toBe(false)
    }
  })

  it('is roughly as often as the table on June mornings in California', () => {
    const days = Array.from({ length: 120 }, (_, i) => scene({ ...morning, place: 'california', seed: `june-${i}` }, '2025-06-14'))
    expectShare(days, p => p.weather.marineLayer, 0.45)
  })

  it('is a low overcast deck with a light wind, never a storm', () => {
    for (const p of scenes({ place: 'california', marineLayer: true, timeOfDay: 'golden-hour', evening: false, eclipse: null }, 30)) {
      expect(p.weather.marineLayer).toBe(true)
      expect(p.weather.kind).toBe('overcast')
      expect(p.storm).toBeNull()
      expect(p.ocean.windSpeed).toBeLessThanOrEqual(6)
      expect(p.weather.formations.length).toBe(1)
      expect(['stratus', 'stratocumulus']).toContain(p.weather.formations[0])
      expect(p.title).toContain('marine layer')
    }
  })

  it('is forced on and off by the spec, leaving the place and camera alone', () => {
    const base = { place: 'california', timeOfDay: 'golden-hour', evening: false, eclipse: null } as const
    const on = scene({ ...base, marineLayer: true }, '2025-06-14')
    const off = scene({ ...base, marineLayer: null }, '2025-06-14')
    expect(on.weather.marineLayer).toBe(true)
    expect(off.weather.marineLayer).toBe(false)
    expect(on.camera).toEqual(off.camera)
    expect(on.place).toEqual(off.place)
    expect(on.coast.composition).toBe(off.coast.composition)
    // A forced sky wins over a drawn marine layer.
    expect(scenes({ ...base, weather: 'clear' }, 20).every(p => !p.weather.marineLayer)).toBe(true)
  })
})
