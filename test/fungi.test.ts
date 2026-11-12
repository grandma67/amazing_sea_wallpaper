import { describe, expect, it } from 'vitest'

import type { Climate } from '../src/biome'
import { fairyRingCell, fairyRingPoint, FAIRY_CELL } from '../src/fairyRings'
import { groundCoverAt } from '../src/groundCover'
import { fungiSeason, type PhenologyDay } from '../src/phenology'
import { PLACES } from '../src/places'
import { createFungi, FUNGI, FUNGUS_KINDS, fungiFor, fungusSpots, MAX_FUNGI } from '../src/props/fungi'
import { createVegetation } from '../src/props/vegetation'
import { parseSceneSpec, type SceneSpec } from '../src/sceneSpec'
import { allParams, expectEvery, scene, scenes, viewOf } from './days'

// NATURE_PLAN phase 12: mushrooms (props/fungi.ts; season in phenology.ts
// fungiSeason; the turf from groundCover.ts, the rings from fairyRings.ts).

const CLIMATES: Climate[] = ['polar', 'boreal', 'temperate', 'mediterranean', 'subtropical', 'tropical', 'arid']
const day = (date: string, climate: Climate, latitudeDeg = 50, id = 'test'): PhenologyDay => ({ date, latitudeDeg, place: { id, climate } })

describe('mushroom season', () => {
  it('follows the climate, in both hemispheres', () => {
    for (const climate of CLIMATES) for (let m = 1; m <= 12; m++) {
      const v = fungiSeason(day(`2025-${String(m).padStart(2, '0')}-15`, climate))
      expect(v, `${climate} ${m}`).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(fungiSeason(day('2025-10-15', 'temperate'))).toBe(1)
    expect(fungiSeason(day('2025-04-15', 'temperate', -40))).toBe(1)
    expect(fungiSeason(day('2025-07-15', 'temperate'))).toBe(0)
    expect(fungiSeason(day('2025-06-01', 'temperate'))).toBeCloseTo(0.2)
    expect(fungiSeason(day('2025-09-01', 'boreal'))).toBe(1)
    expect(fungiSeason(day('2025-11-20', 'mediterranean'))).toBe(1)
    expect(fungiSeason(day('2025-08-01', 'mediterranean'))).toBe(0)
    expect(fungiSeason(day('2025-08-01', 'polar', 70))).toBe(1)
    expect(fungiSeason(day('2025-08-01', 'subtropical', 28))).toBe(1)
    expect(fungiSeason(day('2025-01-15', 'subtropical', 28))).toBeCloseTo(0.3)
    expect(fungiSeason(day('2025-07-15', 'arid'))).toBe(0)
  })

  it('in the tropics, none in a place’s dry months, half all year without a dry season', () => {
    for (const place of PLACES.filter(p => p.drySeason != null && Object.keys(p.climate)[0] === 'tropical')) {
      const [from] = place.drySeason!.months
      const lat = place.drySeason!.latitudeDeg != null ? (place.drySeason!.latitudeDeg[0] + place.drySeason!.latitudeDeg[1]) / 2 : (place.latitude[0] + place.latitude[1]) / 2
      expect(fungiSeason(day(`2025-${String(from).padStart(2, '0')}-15`, 'tropical', lat, place.id)), place.id).toBe(0)
    }
    expect(fungiSeason(day('2025-03-15', 'tropical', 0, 'maldives'))).toBe(0.5)
  })

  it('is stronger on a wet day, gone under snow, forced and switched off by the spec', () => {
    const base: SceneSpec = { eclipse: null, place: 'scotland', coast: 'beach', storm: null, fog: null, snow: null }
    const clear = fungiFor(scene({ ...base, weather: 'clear' }, '2025-10-15'))!
    const wet = fungiFor(scene({ ...base, weather: 'overcast' }, '2025-10-15'))!
    expect(wet.strength).toBeCloseTo(clear.strength * 1.5)
    expect(wet.ringStrength).toBeCloseTo(clear.ringStrength * 2)
    expect(fungiFor(scene({ ...base, snow: true }, '2025-01-15'))).toBeNull()
    expect(fungiFor(scene({ ...base, weather: 'clear' }, '2025-07-15'))).toBeNull()
    expect(fungiFor(scene({ ...base, weather: 'clear', props: { fungi: true } }, '2025-07-15'))?.strength).toBe(1)
    expect(fungiFor(scene({ ...base, props: { fungi: false } }, '2025-10-15'))).toBeNull()
    expect(fungiFor(scene({ ...base, props: { phenology: false } }, '2025-10-15'))).toBeNull()
    // Forced where the climate has no kinds: the temperate ones.
    expect(fungiFor(scene({ eclipse: null, place: 'namibia', coast: 'beach', props: { fungi: true } }, '2025-10-15'))?.kinds).toContain('field-mushroom')
    expect(() => parseSceneSpec({ props: { fungi: 'yes' } })).toThrow(/spec\.props\.fungi/)
    const plain = scene({ ...base, weather: 'clear' }, '2025-07-15')
    const forced = scene({ ...base, weather: 'clear', props: { fungi: true } }, '2025-07-15')
    expect({ ...forced, overrides: undefined }).toEqual({ ...plain, overrides: undefined })
  })

  it('on real days, only where the climate has a season and kinds', () => {
    expectEvery(
      allParams().filter(p => fungiFor(p) != null),
      p => p.place.climate !== 'arid' && fungiSeason(p) > 0,
      { what: p => [p.date, p.place.id] }
    )
  })

  it('every kind grows somewhere, in its own climates', () => {
    for (const kind of FUNGUS_KINDS) expect(FUNGI[kind].climates.length, kind).toBeGreaterThan(0)
    for (const climate of CLIMATES.filter(c => c !== 'arid')) expect(FUNGUS_KINDS.some(k => FUNGI[k].climates.includes(climate)), climate).toBe(true)
  })
})

describe('mushroom placement', () => {
  const forest: SceneSpec = { eclipse: null, place: 'scotland', coast: 'beach', composition: 'framed', timeOfDay: 'midday', weather: 'few', storm: null, fog: null, snow: null, props: { vegetation: ['birch', 'conifer', 'grass'], fungi: true } }

  it('under host crowns and on open turf only, fixed in the world', () => {
    let total = 0
    for (const p of scenes(forest, 4)) {
      const ctx = viewOf(p)
      const plants = createVegetation(ctx)
      const spots = fungusSpots(ctx, plants)
      total += spots.length
      expect(fungusSpots(ctx, plants)).toEqual(spots)
      for (const s of spots) {
        if (FUNGI[s.kind].hosts === 'grass') expect(groundCoverAt(p.coast, s.x, s.z), s.kind).toBeGreaterThanOrEqual(0.5)
        expect(ctx.distance(s.x, s.z)).toBeLessThan(60)
      }
      expect(createFungi(ctx, plants).reduce((n, m) => n + m.count, 0)).toBeLessThanOrEqual(MAX_FUNGI)
    }
    expect(total).toBeGreaterThan(0)
  })

  it('champignons stand on the rings’ bands, not in their gaps', () => {
    let on = 0
    for (let i = 0; i < 400 && on < 50; i++) {
      const ring = fairyRingCell(i % 20, Math.floor(i / 20))
      if (ring == null) continue
      for (let k = 0; k < 24; k++) {
        const p = fairyRingPoint(ring, (k / 24) * Math.PI * 2)
        expect(Math.hypot(p.x - ring.x, p.z - ring.z)).toBeLessThan(ring.r * 1.07)
        expect(Math.hypot(p.x - ring.x, p.z - ring.z)).toBeGreaterThan(ring.r * 0.93)
        on++
      }
    }
    expect(on).toBeGreaterThan(0)
    expect(FAIRY_CELL).toBeGreaterThan(0)
  })

  it('switched off: nothing', () => {
    const p = scenes({ ...forest, props: { vegetation: ['birch', 'conifer', 'grass'], fungi: false } }, 1)[0]
    const ctx = viewOf(p)
    expect(createFungi(ctx, createVegetation(ctx))).toEqual([])
  })
})
