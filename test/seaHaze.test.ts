import { describe, expect, it } from 'vitest'

import { Random } from '../src/random'
import { dustSkylight, dustTransmittance, HARMATTAN, hazeLight, hazeTint, MAX_VISIBILITY_KM, MIN_VISIBILITY_KM, visibilityFor } from '../src/seaHaze'
import { allParams, scene, scenes, share } from './days'

describe('sea haze', () => {
  const days = allParams()
  const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)]
  const visibility = (test: (p: (typeof days)[number]) => boolean) => median(days.filter(test).map(p => p.visibilityKm))

  it('sees 30–60 km on most days, within limits', () => {
    for (const p of days) {
      expect(p.visibilityKm).toBeGreaterThanOrEqual(p.weather.dust != null ? HARMATTAN[0] : MIN_VISIBILITY_KM)
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

  describe('harmattan', () => {
    it('blows only in West Africa, December to February, on about half the days', () => {
      for (const p of days) {
        if (p.weather.dust == null) continue
        expect(p.place.id).toBe('west-africa')
        expect([12, 1, 2]).toContain(Number(p.date.slice(5, 7)))
      }
      const winter = Array.from({ length: 120 }, (_, i) => scene({ place: 'west-africa', seed: `harmattan-${i}` }, '2025-01-10'))
      expect(Math.abs(share(winter, p => p.weather.dust === 'harmattan') - 0.5)).toBeLessThan(0.12)
      const july = Array.from({ length: 20 }, (_, i) => scene({ place: 'west-africa', seed: `july-${i}` }, '2025-07-10'))
      expect(july.every(p => p.weather.dust == null)).toBe(true)
    })

    it('cuts visibility to 2–10 km, tints the haze and dims and reddens the sun', () => {
      for (const p of scenes({ place: 'west-africa', dust: 'harmattan' }, 30)) {
        expect(p.visibilityKm).toBeGreaterThanOrEqual(2)
        expect(p.visibilityKm).toBeLessThanOrEqual(10)
        expect(p.storm).toBeNull()
        expect(p.rainbow).toBeNull()
      }
      const [r, g, b] = dustTransmittance({ dust: 'harmattan' }, 5, 20)
      expect(g).toBeLessThan(0.6)
      expect(r).toBeGreaterThan(g)
      expect(g).toBeGreaterThan(b)
      // Lower sun, longer path: dimmer.
      expect(dustTransmittance({ dust: 'harmattan' }, 5, 5)[1]).toBeLessThan(g)
      expect(dustTransmittance({ dust: null }, 5, 20)).toEqual([1, 1, 1])
      expect(hazeTint({ dust: 'harmattan' })[2]).toBeLessThan(hazeTint({ dust: 'harmattan' })[0])
      expect(hazeTint({ dust: null })).toEqual([1, 1, 1])
      // The scattered sunlight comes back as warm skylight.
      const sky = [0.2, 0.3, 0.5] as const
      const sun = [3, 3, 3] as const
      const dusty = dustTransmittance({ dust: 'harmattan' }, 5, 30).map(t => 3 * t) as [number, number, number]
      const lit = dustSkylight([...sky], [...sun], dusty, 30, { dust: 'harmattan' })
      expect(lit[0] + lit[1] + lit[2]).toBeGreaterThan(sky[0] + sky[1] + sky[2])
      expect(lit[0] / lit[2]).toBeGreaterThan(sky[0] / sky[2])
      expect(dustSkylight([...sky], [...sun], dusty, 30, { dust: null })).toEqual([...sky])
    })

    it('is forced and switched off by the spec without moving the place or camera', () => {
      const on = scene({ place: 'west-africa', dust: 'harmattan' }, '2025-01-10')
      const off = scene({ place: 'west-africa', dust: null }, '2025-01-10')
      expect(on.weather.dust).toBe('harmattan')
      expect(off.weather.dust).toBeNull()
      expect(on.camera).toEqual(off.camera)
      expect(on.place).toEqual(off.place)
    })
  })
})
