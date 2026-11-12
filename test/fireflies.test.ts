import { describe, expect, it } from 'vitest'

import { groundCoverAt } from '../src/groundCover'
import type { SceneParams } from '../src/params'
import { PLACES } from '../src/places'
import { FIREFLY_KINDS, FIREFLY_REGIONS, fireflyLights, firefliesFor, fireflyWeather, MAX_FIREFLIES, type FirefliesTonight } from '../src/props/fireflies'
import type { MangroveStand } from '../src/props/mangroves'
import { createVegetation } from '../src/props/vegetation'
import { Random } from '../src/random'
import { parseSceneSpec, type SceneSpec } from '../src/sceneSpec'
import { allParams, expectEvery, expectShare, scene, viewOf } from './days'

// NATURE_PLAN phase 13: what's out tonight and where (props/fireflies.ts), no
// drawing. Rules: the table by place and local month, the evening, the moon,
// the weather by kind; lights over vegetation only.

const NIGHT: SceneSpec = { eclipse: null, coast: 'beach', timeOfDay: 'night', storm: null, fog: null, snow: null, weather: 'clear' }
const MANGROVES = { kind: 'rhizophora' } as unknown as MangroveStand
/** A night with every factor at its best: a dark moon, still air. */
const calm = (p: SceneParams, patch: Partial<SceneParams> = {}): SceneParams => ({ ...p, moonElevationDeg: -10, ocean: { ...p.ocean, airWindSpeed: 1 }, ...patch })
/** Out or not, on each of `n` seeds. */
const nights = (p: SceneParams, mangroves: MangroveStand | null = null, n = 400): boolean[] => Array.from({ length: n }, (_, i) => firefliesFor(p, new Random(`s${i}`), mangroves) != null)
const share = (p: SceneParams, mangroves: MangroveStand | null = null): number => nights(p, mangroves).filter(Boolean).length / 400
const expectOut = (p: SceneParams, target: number): void => expectShare(nights(p), x => x, target)

describe('fireflies tonight', () => {
  it('the table names real places, months 1–12', () => {
    for (const row of FIREFLY_REGIONS) {
      for (const id of row.places) expect(PLACES.some(p => p.id === id), id).toBe(true)
      for (const m of [...row.months, ...(row.peak ?? [])]) expect(m >= 1 && m <= 12).toBe(true)
    }
  })

  it('out at the peak in a region on ~70% of calm dark nights, none outside its months', () => {
    const june = calm(scene({ ...NIGHT, place: 'maine' }, '2025-06-20'))
    expectOut(june, 0.7)
    expect(share(calm(scene({ ...NIGHT, place: 'maine' }, '2025-01-20')))).toBe(0)
    // Off peak (August): ×0.4.
    expectOut(calm(scene({ ...NIGHT, place: 'maine' }, '2025-08-20')), 0.28)
    // No region: never (the Pacific coast of North America, New Zealand).
    for (const place of ['pacific-northwest', 'new-zealand-north']) expect(share(calm(scene({ ...NIGHT, place }, '2025-07-01')))).toBe(0)
  })

  it('never by day, at dawn, on open sea or in snow', () => {
    const june = calm(scene({ ...NIGHT, place: 'maine' }, '2025-06-20'))
    for (const timeOfDay of ['daylight', 'midday', 'golden-hour', 'sun-on-horizon'] as const) expect(share({ ...june, timeOfDay })).toBe(0)
    expect(share({ ...june, timeOfDay: 'blue-hour', evening: false })).toBe(0)
    expect(share({ ...june, timeOfDay: 'blue-hour', evening: true })).toBeGreaterThan(0.5)
    expect(share({ ...june, coast: { ...june.coast, type: 'open-sea' } })).toBe(0)
    expect(share({ ...june, snow: { cover: 0.8 } as SceneParams['snow'] })).toBe(0)
    // Forced too: still not by day or on open sea.
    expect(firefliesFor({ ...june, timeOfDay: 'midday', overrides: { fireflies: true } }, new Random('x'), null)).toBeNull()
    expect(firefliesFor({ ...june, coast: { ...june.coast, type: 'open-sea' }, overrides: { fireflies: true } }, new Random('x'), null)).toBeNull()
  })

  it('flash: none in a storm or at ≥ 8 m/s wind; glow: still out in wind and overcast', () => {
    const p = calm(scene({ ...NIGHT, place: 'maine' }, '2025-06-20'))
    expect(fireflyWeather({ ...p, ocean: { ...p.ocean, airWindSpeed: 8 } }, 'flash')).toBe(0)
    expect(fireflyWeather({ ...p, ocean: { ...p.ocean, airWindSpeed: 3 } }, 'flash')).toBe(1)
    expect(fireflyWeather({ ...p, ocean: { ...p.ocean, airWindSpeed: 8 } }, 'synchronous')).toBeGreaterThan(0)
    expect(fireflyWeather({ ...p, weather: { ...p.weather, kind: 'storm' } }, 'flash')).toBe(0)
    expect(fireflyWeather({ ...p, ocean: { ...p.ocean, airWindSpeed: 12 } }, 'glow')).toBe(1)
    expect(fireflyWeather({ ...p, weather: { ...p.weather, kind: 'overcast' } }, 'glow')).toBe(1)
    expect(fireflyWeather({ ...p, weather: { ...p.weather, kind: 'storm' } }, 'glow')).toBe(0)
  })

  it('fewer under a full moon', () => {
    const p = calm(scene({ ...NIGHT, place: 'maine' }, '2025-06-20'))
    expectOut({ ...p, moonElevationDeg: 30, moonIllumination: 0.95 }, 0.21)
  })

  it('glow-worms in an evening blue hour only once the sun is 6° down; never at dawn', () => {
    const p = calm(scene({ ...NIGHT, place: 'scotland' }, '2025-07-01'))
    expect(share({ ...p, timeOfDay: 'blue-hour', evening: true, sunElevationDeg: -4 })).toBe(0)
    expectOut({ ...p, timeOfDay: 'blue-hour', evening: true, sunElevationDeg: -6.5 }, 0.35)
    expect(share({ ...p, timeOfDay: 'blue-hour', evening: false, sunElevationDeg: -6.5 })).toBe(0)
    expect(firefliesFor(p, new Random('s1'), null)?.kind ?? 'glow').toBe('glow')
  })

  it('synchronous only where mangroves are drawn; Sri Lanka flashes without them', () => {
    const indo = calm(scene({ ...NIGHT, place: 'indonesia' }, '2025-11-20'))
    expect(share(indo, null)).toBe(0)
    expect(share(indo, MANGROVES)).toBeGreaterThan(0.5)
    const lanka = calm(scene({ ...NIGHT, place: 'sri-lanka' }, '2025-06-15'))
    const kinds = new Set(Array.from({ length: 50 }, (_, i) => firefliesFor(lanka, new Random(`k${i}`), null)?.kind).filter(Boolean))
    expect([...kinds]).toEqual(['flash'])
  })

  it('a spec forces a kind or switches them off, leaving the day as drawn', () => {
    const p = calm(scene({ ...NIGHT, place: 'maine' }, '2025-01-20'))
    expect(firefliesFor({ ...p, overrides: { fireflies: 'glow' } }, new Random('x'), null)).toEqual({ kind: 'glow', month: 1, forced: true })
    expect(firefliesFor({ ...p, overrides: { fireflies: true } }, new Random('x'), null)?.kind).toBe('flash')
    expect(firefliesFor({ ...calm(scene({ ...NIGHT, place: 'maine' }, '2025-06-20')), overrides: { fireflies: false } }, new Random('x'), null)).toBeNull()
    expect(() => parseSceneSpec({ props: { fireflies: 'blink' } })).toThrow(/spec\.props\.fireflies/)
    for (const kind of FIREFLY_KINDS) expect(() => parseSceneSpec({ props: { fireflies: kind } })).not.toThrow()
    const plain = scene({ ...NIGHT, place: 'maine' }, '2025-07-01')
    const forced = scene({ ...NIGHT, place: 'maine', props: { fireflies: 'flash' } }, '2025-07-01')
    expect({ ...forced, overrides: undefined }).toEqual({ ...plain, overrides: undefined })
  })

  it('on real days: only at night or an evening blue hour, on land, in a region', () => {
    expectEvery(
      allParams().filter(p => firefliesFor(p, Random.derive(p.seed, 'props/fireflies'), null) != null),
      p => p.coast.type !== 'open-sea' && (p.timeOfDay === 'night' || (p.timeOfDay === 'blue-hour' && p.evening)) && FIREFLY_REGIONS.some(r => r.places.includes(p.place.id)),
      { what: p => [p.date, p.place.id] }
    )
  })
})

describe('firefly lights', () => {
  const tonight: FirefliesTonight = { kind: 'flash', month: 1, forced: true }

  it('over vegetation, 5–60 m off, in budget, the same each time', () => {
    let total = 0
    for (const date of ['2025-07-02', '2025-07-10', '2025-07-16']) {
      const p = scene({ ...NIGHT, place: 'maine', composition: 'framed', props: { fireflies: 'flash' } }, date)
      const ctx = viewOf(p)
      const plants = createVegetation(ctx)
      const lights = fireflyLights(ctx, tonight, plants)
      expect(fireflyLights(ctx, tonight, plants)).toEqual(lights)
      expect(lights.length).toBeLessThanOrEqual(MAX_FIREFLIES)
      for (const l of lights) {
        const d = ctx.distance(l.x, l.z)
        expect(d).toBeGreaterThanOrEqual(5)
        expect(d).toBeLessThanOrEqual(60)
        const above = l.y - ctx.ground(l.x, l.z)
        expect(above).toBeGreaterThanOrEqual(0.5)
        expect(above).toBeLessThanOrEqual(3)
      }
      // Glow-worms on the turf itself.
      for (const l of fireflyLights(ctx, { ...tonight, kind: 'glow' }, plants)) expect(groundCoverAt(p.coast, l.x, l.z)).toBeGreaterThanOrEqual(0.3)
      total += lights.length
    }
    expect(total).toBeGreaterThan(0)
    expect(fireflyLights(viewOf(scene({ ...NIGHT, place: 'maine' }, '2025-07-02')), null, [])).toEqual([])
  })
})
