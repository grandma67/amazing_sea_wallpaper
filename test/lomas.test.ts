import { describe, expect, it } from 'vitest'

import { LOMAS, lomasFor, type PhenologyDay } from '../src/phenology'
import { lomasPatch } from '../src/props/landforms'
import { fbm3 } from '../src/props/noise'
import { parseSceneSpec } from '../src/sceneSpec'
import { allParams, expectEvery, scene } from './days'

// NATURE_PLAN phase 15: lomas on Peru's fog hills (phenology.ts lomasFor;
// props/landforms.ts tints a range's 200–1000 m belt).

const day = (date: string, latitudeDeg = -15, id = LOMAS.place, overrides?: PhenologyDay['overrides']): PhenologyDay => ({ date, latitudeDeg, place: { id, climate: 'arid' }, overrides })

describe('lomas', () => {
  it('green June–November, full July–October, bare December–May', () => {
    expect(lomasFor(day('2025-08-15'))?.strength).toBe(1)
    expect(lomasFor(day('2025-10-20'))?.strength).toBe(1)
    expect(lomasFor(day('2025-06-15'))?.strength).toBeGreaterThan(0.3)
    expect(lomasFor(day('2025-06-15'))?.strength).toBeLessThan(0.7)
    for (const date of ['2025-01-15', '2025-03-15', '2025-05-15', '2025-12-15']) expect(lomasFor(day(date)), date).toBeUndefined()
  })

  it('amancaes only at the start of the season', () => {
    expect(lomasFor(day('2025-06-25'))?.fleck).toBeCloseTo(0.1)
    expect(lomasFor(day('2025-09-15'))?.fleck).toBe(0)
  })

  it('only on atacama-peru from 6°S to 30°S', () => {
    expect(lomasFor(day('2025-08-15', -4))).toBeUndefined()
    expect(lomasFor(day('2025-08-15', -31))).toBeUndefined()
    expect(lomasFor(day('2025-08-15', -15, 'central-chile'))).toBeUndefined()
  })

  it('forced, switched off, and off with phenology', () => {
    expect(lomasFor(day('2025-02-15', -15, 'aegean', { lomas: true }))?.strength).toBe(1)
    expect(lomasFor(day('2025-08-15', -15, LOMAS.place, { lomas: false }))).toBeUndefined()
    expect(lomasFor(day('2025-08-15', -15, LOMAS.place, { phenology: false }))).toBeUndefined()
    expect(() => parseSceneSpec({ props: { lomas: 'green' } })).toThrow(/spec\.props\.lomas/)
    const plain = scene({ eclipse: null, place: 'atacama-peru', coast: 'beach' }, '2025-08-15')
    const off = scene({ eclipse: null, place: 'atacama-peru', coast: 'beach', props: { lomas: false } }, '2025-08-15')
    expect({ ...off, overrides: undefined }).toEqual({ ...plain, overrides: undefined })
  })

  it('patches cover about half the fog belt', () => {
    let sum = 0
    const n = 20_000
    for (let i = 0; i < n; i++) sum += lomasPatch(fbm3(((i % 141) * 97) / 1500, (Math.floor(i / 141) * 89) / 1500, 4.3, 17))
    expect(sum / n).toBeGreaterThan(0.38)
    expect(sum / n).toBeLessThan(0.62)
  })

  it('on real days, only in its place and season', () => {
    expectEvery(allParams().filter(p => lomasFor(p) != null), p => p.place.id === LOMAS.place && p.latitudeDeg <= -6 && p.latitudeDeg >= -30, { what: p => [p.date, p.place.id] })
  })
})
