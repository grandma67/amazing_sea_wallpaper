import { describe, expect, it } from 'vitest'

import { shoreLifeFor } from '../src/props/shoreLife'
import { Random } from '../src/random'
import { monthInSeason, season, seasonMonth } from '../src/seasons'
import { DAYS, scene } from './days'

const north = { latitudeDeg: 52 }
const south = { latitudeDeg: -32 }
const at = (month: number, where: { latitudeDeg: number }) => ({ date: `2025-${String(month).padStart(2, '0')}-15`, ...where })

describe('seasons', () => {
  it('keep northern months as they are', () => {
    for (let m = 1; m <= 12; m++) expect(seasonMonth(at(m, north))).toBe(m)
    expect(season(at(1, north))).toBe('winter')
    expect(season(at(4, north))).toBe('spring')
    expect(season(at(7, north))).toBe('summer')
    expect(season(at(10, north))).toBe('autumn')
  })

  it('shift southern months by six', () => {
    expect([1, 6, 7, 12].map(m => seasonMonth(at(m, south)))).toEqual([7, 12, 1, 6])
    expect(season(at(7, south))).toBe('winter')
    expect(season(at(1, south))).toBe('summer')
    expect(monthInSeason(at(1, south), 6, 9)).toBe(true)
    expect(monthInSeason(at(7, south), 11, 2)).toBe(true)
  })

  it('follow the place: SW Australia is in winter in July and summer in January', () => {
    const july = scene({ place: 'sw-australia' }, '2025-07-15')
    const january = scene({ place: 'sw-australia' }, '2025-01-15')
    expect(july.place.hemisphere).toBe('south')
    expect(season(july)).toBe('winter')
    expect(season(january)).toBe('summer')
  })

  it('bloom in the southern summer, not its winter', () => {
    const flowers = (month: string) =>
      DAYS.filter(d => d.slice(5, 7) === month)
        .map(d => scene({ place: 'sw-australia', coast: 'beach' }, d))
        .flatMap(p => shoreLifeFor(p, Random.derive(p.seed, 'props/shore-life'))!.flowers)
    expect(flowers('07')).toEqual([])
    expect(flowers('01').length).toBeGreaterThan(0)
  })
})
