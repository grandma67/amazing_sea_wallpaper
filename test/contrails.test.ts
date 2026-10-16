import { describe, expect, it } from 'vitest'

import { contrailsFor, MAX_CONTRAILS } from '../src/contrails'
import { Random } from '../src/random'
import { allParams, scene, share } from './days'

describe('contrails', () => {
  const days = allParams()

  it('never shows them at night, under overcast or in storms', () => {
    for (const p of days)
      if (p.timeOfDay === 'night' || p.weather.kind === 'overcast' || p.weather.kind === 'storm') expect(p.contrails).toEqual([])
  })

  it('shows them on a fair share of days, most over busy skies', () => {
    const withTrails = share(days, p => p.contrails.length > 0)
    expect(withTrails).toBeGreaterThan(0.1)
    expect(withTrails).toBeLessThan(0.6)
    const rate = (ocean: string) => share(days.filter(p => p.sea.ocean === ocean && p.timeOfDay !== 'night'), p => p.contrails.length > 0)
    expect(rate('atlantic')).toBeGreaterThan(rate('southern'))
    for (const p of days) expect(p.contrails.length).toBeLessThanOrEqual(MAX_CONTRAILS)
  })

  it('keeps old spread trails to humid days', () => {
    for (const p of days)
      for (const c of p.contrails) {
        expect(c.altitudeM).toBeGreaterThanOrEqual(9000)
        expect(c.altitudeM).toBeLessThanOrEqual(12000)
        expect(c.widthM).toBeGreaterThan(30)
        if (c.ageMin > 30) expect(['clear', 'cirrus', 'few', 'scattered', 'broken']).toContain(p.weather.kind)
      }
  })

  it('is deterministic and forced by a spec', () => {
    const p = days[100]
    expect(contrailsFor(p, Random.derive(p.seed, 'contrails'))).toEqual(p.contrails)
    expect(scene({ contrails: 3, weather: 'few', timeOfDay: 'daylight', storm: null, fog: null, eclipse: null }).contrails).toHaveLength(3)
    expect(scene({ contrails: true, weather: 'few', timeOfDay: 'daylight', storm: null, fog: null, eclipse: null }).contrails.length).toBeGreaterThan(0)
    expect(scene({ contrails: null }).contrails).toEqual([])
  })
})
