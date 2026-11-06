import { describe, expect, it } from 'vitest'

import { contrailsFor } from '../src/contrails'
import { Random } from '../src/random'
import { allParams, scene, share } from './days'

describe('contrails', () => {
  const days = allParams()

  it('shows them on a fair share of days, most over busy skies', () => {
    const withTrails = share(days, p => p.contrails.length > 0)
    expect(withTrails).toBeGreaterThan(0.1)
    expect(withTrails).toBeLessThan(0.6)
    const rate = (ocean: string) => share(days.filter(p => p.sea.ocean === ocean && p.timeOfDay !== 'night'), p => p.contrails.length > 0)
    expect(rate('atlantic')).toBeGreaterThan(rate('southern'))
  })

  it('is deterministic and forced by a spec', () => {
    const p = days[100]
    expect(contrailsFor(p, Random.derive(p.seed, 'contrails'))).toEqual(p.contrails)
    expect(scene({ contrails: 3, weather: 'few', timeOfDay: 'daylight', storm: null, fog: null, eclipse: null }).contrails).toHaveLength(3)
    expect(scene({ contrails: true, weather: 'few', timeOfDay: 'daylight', storm: null, fog: null, eclipse: null }).contrails.length).toBeGreaterThan(0)
    expect(scene({ contrails: null }).contrails).toEqual([])
  })
})
