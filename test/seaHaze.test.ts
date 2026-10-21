import { describe, expect, it } from 'vitest'

import { Random } from '../src/random'
import { hazeLight, MAX_VISIBILITY_KM, MIN_VISIBILITY_KM, visibilityFor } from '../src/seaHaze'
import { allParams, scene, share } from './days'

describe('sea haze', () => {
  const days = allParams()
  const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)]
  const visibility = (test: (p: (typeof days)[number]) => boolean) => median(days.filter(test).map(p => p.visibilityKm))

  it('sees 30–60 km on most days, within limits', () => {
    for (const p of days) {
      expect(p.visibilityKm).toBeGreaterThanOrEqual(MIN_VISIBILITY_KM)
      expect(p.visibilityKm).toBeLessThanOrEqual(MAX_VISIBILITY_KM)
    }
    expect(share(days, p => p.visibilityKm >= 30 && p.visibilityKm <= 60)).toBeGreaterThan(0.5)
    expect(median(days.map(p => p.visibilityKm))).toBeGreaterThan(40)
    expect(median(days.map(p => p.visibilityKm))).toBeLessThan(55)
  })

  it('is clearest in polar air, dustiest off deserts, hazier in rain', () => {
    expect(visibility(p => p.sea.ocean === 'arctic' || p.sea.ocean === 'southern')).toBeGreaterThan(visibility(p => p.biome.name === 'tropical'))
    expect(visibility(p => p.biome.name === 'desert')).toBeLessThan(30)
    expect(visibility(p => p.weather.kind === 'storm')).toBeLessThan(visibility(p => p.weather.kind === 'few'))
  })

  it('is deterministic and forced by a spec', () => {
    const p = days[100]
    expect(visibilityFor(p, Random.derive(p.seed, 'visibility'))).toBe(p.visibilityKm)
    expect(scene({ visibilityKm: 12 }).visibilityKm).toBe(12)
    // Forcing it changes nothing else.
    const { visibilityKm: _a, ...forced } = scene({ visibilityKm: 12 })
    const { visibilityKm: _b, ...drawn } = scene({})
    expect(forced).toEqual(drawn)
  })

  it('lights the haze less under thicker cloud', () => {
    expect(hazeLight({ kind: 'few', sunVisibility: 1 })).toBe(1)
    expect(hazeLight({ kind: 'overcast', sunVisibility: 0.002 })).toBeLessThan(0.35)
    expect(hazeLight({ kind: 'storm', sunVisibility: 0 })).toBeLessThan(hazeLight({ kind: 'overcast', sunVisibility: 0 }))
  })
})
