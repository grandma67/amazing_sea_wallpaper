import { describe, expect, it } from 'vitest'

import { fbm } from '../src/cellNoise'
import { HEATH_COVER, HEATH_MASK_EDGE, HEATH_MASK_TERRAIN, HEATH_PLACES, HEATH_STAGES, heathFor, type PhenologyDay } from '../src/phenology'
import { PLACES } from '../src/places'
import { heathPatch } from '../src/props/landforms'
import { fbm3 } from '../src/props/noise'
import { parseSceneSpec } from '../src/sceneSpec'
import { allParams, expectEvery, MONTHS, scene } from './days'

// NATURE_PLAN phase 5: heather on the ground cover of the heath coasts
// (phenology.ts heathFor; terrain.ts, props/landforms.ts, props/islands.ts).

const day = (date: string, id: string, overrides?: PhenologyDay['overrides']): PhenologyDay => {
  const place = PLACES.find(p => p.id === id)!
  const climate = Object.keys(place.climate)[0] as PhenologyDay['place']['climate']
  return { date, latitudeDeg: (place.latitude[0] + place.latitude[1]) / 2, place: { id, climate }, overrides }
}
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
/** Hue: flowering heath is mauve (blue above green), brown heath red-brown, green heath green. */
const hue = (c: readonly number[]): 'mauve' | 'brown' | 'green' => (c[1] > c[0] ? 'green' : c[2] > c[1] ? 'mauve' : 'brown')

describe('heath', () => {
  it('grows only in the heath places, every month', () => {
    for (const place of PLACES) {
      for (const date of MONTHS) expect(heathFor(day(date, place.id)) != null, `${place.id} ${date}`).toBe(HEATH_PLACES.includes(place.id))
    }
    expect(HEATH_PLACES.every(id => PLACES.some(p => p.id === id))).toBe(true)
    // Every heath place is northern: its months are local calendar months.
    expect(HEATH_PLACES.every(id => PLACES.find(p => p.id === id)!.latitude[0] > 0)).toBe(true)
  })

  it('flowers in August, is brown in January and green in May', () => {
    const at = (date: string) => heathFor(day(date, 'scotland'))!
    expect(hue(at('2025-08-15').color)).toBe('mauve')
    expect(at('2025-08-15').specks).toBeCloseTo(0.3)
    expect(hue(at('2025-01-15').color)).toBe('brown')
    expect(hue(at('2025-05-15').color)).toBe('green')
    for (const date of ['2025-01-15', '2025-05-15', '2025-11-15']) expect(at(date).specks).toBe(0)
    // Far, in full flower: the measured mauve (NATURE_PLAN §1).
    for (const [i, v] of [0.16, 0.07, 0.08].entries()) expect(at('2025-08-15').color[i]).toBeCloseTo(v, 2)
  })

  it('changes colour gradually through the year (no jump between days)', () => {
    let last = heathFor(day('2025-01-01', 'ireland'))!.color
    for (let i = 1; i <= 365; i++) {
      const date = new Date(Date.UTC(2025, 0, 1 + i)).toISOString().slice(0, 10)
      const c = heathFor(day(date, 'ireland'))!.color
      for (let k = 0; k < 3; k++) expect(Math.abs(c[k] - last[k]), date).toBeLessThan(0.01)
      last = c
    }
  })

  it('is forced by a stage or true anywhere, and switched off', () => {
    expect(heathFor(day('2025-01-15', 'aegean', { heath: true }))).toBeDefined()
    expect(hue(heathFor(day('2025-01-15', 'scotland', { heath: 'flower' }))!.color)).toBe('mauve')
    expect(hue(heathFor(day('2025-08-15', 'scotland', { heath: 'brown' }))!.color)).toBe('brown')
    expect(hue(heathFor(day('2025-08-15', 'scotland', { heath: 'green' }))!.color)).toBe('green')
    expect(heathFor(day('2025-08-15', 'scotland', { heath: false }))).toBeUndefined()
    expect(heathFor(day('2025-08-15', 'scotland', { phenology: false }))).toBeUndefined()
    expect(heathFor(day('2025-08-15', 'scotland', { phenology: false, heath: 'flower' }))).toBeUndefined()
    expect(() => parseSceneSpec({ props: { heath: 'purple' } })).toThrow(/spec\.props\.heath/)
    for (const stage of HEATH_STAGES) expect(() => parseSceneSpec({ props: { heath: stage } })).not.toThrow()
  })

  it('covers about HEATH_COVER of the ground, near (terrain mask) and far (landforms, islands)', () => {
    let near = 0
    let far = 0
    const n = 40_000
    for (let i = 0; i < n; i++) {
      // A grid over ~1.5 km (the terrain mask's patches are tens of metres).
      const [x, z] = [(i % 200) * 7.3 + 0.37, Math.floor(i / 200) * 7.9 + 0.11]
      near += smooth(HEATH_MASK_TERRAIN - HEATH_MASK_EDGE, HEATH_MASK_TERRAIN + HEATH_MASK_EDGE, fbm(x / 40 + 113, z / 40 + 113) * 0.65 + fbm(x / 6 + 127, z / 6 + 127) * 0.35)
      far += heathPatch(fbm3((x * 13) / 700, (z * 13) / 700, 9.7, 5))
    }
    expect(near / n).toBeGreaterThan(HEATH_COVER - 0.05)
    expect(near / n).toBeLessThan(HEATH_COVER + 0.05)
    expect(far / n).toBeGreaterThan(HEATH_COVER - 0.05)
    expect(far / n).toBeLessThan(HEATH_COVER + 0.05)
  })

  it('on real days, only in the heath places', () => {
    expectEvery(
      allParams().filter(p => heathFor(p) != null),
      p => HEATH_PLACES.includes(p.place.id),
      { what: p => [p.date, p.place.id] }
    )
  })

  it('a spec field that leaves every other value of the day alone', () => {
    const plain = scene({ place: 'scotland', coast: 'rock-shore' }, '2025-08-15')
    const off = scene({ place: 'scotland', coast: 'rock-shore', props: { heath: false } }, '2025-08-15')
    expect(heathFor(plain)).toBeDefined()
    expect(heathFor(off)).toBeUndefined()
    expect({ ...off, overrides: undefined }).toEqual({ ...plain, overrides: undefined })
  })
})
