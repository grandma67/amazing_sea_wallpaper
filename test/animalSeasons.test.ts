import { describe, expect, it } from 'vitest'

import { colonyInSeason, ghostCrabSeason, gullSeason, haulOutSeason, humpbackSeason, lizardAwake, shoreCrabsOut, waterfowlSeason } from '../src/animalSeasons'
import type { Climate } from '../src/biome'
import { CLIMATES } from '../src/places'
import { seasonMonth } from '../src/seasons'
import { allParams, propsOf, share } from './days'

const at = (date: string, climate: Climate, latitudeDeg = 50, id = 'x') => ({ date, latitudeDeg, place: { id, climate } })
const months = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}-15`)

describe('colonies', () => {
  it('have puffins from April to mid-August and gannets from late February to October', () => {
    const puffins = months.filter(d => colonyInSeason('puffin', { date: d, latitudeDeg: 58 })).map(d => Number(d.slice(5, 7)))
    expect(puffins).toEqual([4, 5, 6, 7, 8])
    const gannets = months.filter(d => colonyInSeason('gannet', { date: d, latitudeDeg: 56 })).map(d => Number(d.slice(5, 7)))
    expect(gannets).toEqual([3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('fill southern gannetries in the austral summer; penguins and boobies all year', () => {
    expect(colonyInSeason('gannet', { date: '2025-12-15', latitudeDeg: -40 })).toBe(true)
    expect(colonyInSeason('gannet', { date: '2025-06-15', latitudeDeg: -40 })).toBe(false)
    for (const d of months) {
      expect(colonyInSeason('penguin', { date: d, latitudeDeg: -54 })).toBe(true)
      expect(colonyInSeason('tropical', { date: d, latitudeDeg: 10 })).toBe(true)
    }
  })
})

describe('humpbacks', () => {
  it('feed at high latitudes in summer and breed in the tropics in winter', () => {
    expect(humpbackSeason(at('2025-07-15', 'boreal', 65))).toBe(1)
    expect(humpbackSeason(at('2025-01-15', 'boreal', 65))).toBeLessThan(0.2)
    expect(humpbackSeason(at('2025-02-15', 'tropical', 20))).toBe(1)
    expect(humpbackSeason(at('2025-07-15', 'tropical', 20))).toBeLessThan(0.2)
    // Western Australia's breeding season, June–October.
    expect(humpbackSeason(at('2025-08-15', 'tropical', -20))).toBe(1)
    expect(humpbackSeason(at('2025-08-15', 'arid', 18, 'oman-yemen'))).toBe(1)
  })

  it('are rarer on real tropical days in the northern summer than in winter', () => {
    const tropicalNorth = allParams().filter(p => p.place.climate === 'tropical' && p.latitudeDeg > 0)
    const humpback = (m: number[]) => share(tropicalNorth.filter(p => m.includes(seasonMonth(p))), p => propsOf(p).marine === 'humpback')
    expect(humpback([6, 7, 8, 9])).toBeLessThan(humpback([12, 1, 2, 3]))
  })
})

describe('seals', () => {
  it('haul out less in winter', () => {
    expect(haulOutSeason('seal', { date: '2025-01-15', latitudeDeg: 57 })).toBeLessThan(haulOutSeason('seal', { date: '2025-07-15', latitudeDeg: 57 }))
    expect(haulOutSeason('elephant-seal', { date: '2025-07-15', latitudeDeg: -54 })).toBeLessThan(0.2)
    expect(haulOutSeason('elephant-seal', { date: '2025-01-15', latitudeDeg: 36 })).toBe(1)
    for (const d of months) expect(haulOutSeason('sea-lion', { date: d, latitudeDeg: 36 })).toBe(1)
  })
})

describe('winter sleep', () => {
  it('keeps subtropical ghost crabs in their burrows in winter, tropical ones out all year', () => {
    expect(ghostCrabSeason(at('2025-01-15', 'subtropical', 30)).out).toBe(0)
    expect(ghostCrabSeason(at('2025-07-15', 'subtropical', 30)).out).toBe(1)
    for (const d of months) expect(ghostCrabSeason(at(d, 'tropical', 10)).out).toBe(1)
    expect(shoreCrabsOut({ date: '2025-01-15', latitudeDeg: 55 })).toBe(false)
    expect(lizardAwake('spiny-tailed', { date: '2025-12-15', latitudeDeg: 24 })).toBe(false)
    expect(lizardAwake('spiny-tailed', { date: '2025-05-15', latitudeDeg: 24 })).toBe(true)
    expect(lizardAwake('monitor', { date: '2025-12-15', latitudeDeg: 5 })).toBe(true)
  })

  it('shows no ghost crabs out on real winter days away from the tropics', () => {
    for (const p of allParams()) {
      const life = propsOf(p).shoreLife
      if (life?.crab !== 'ghost' || p.place.climate === 'tropical' || p.place.climate === 'arid') continue
      const m = seasonMonth(p)
      if (m === 12 || m <= 2) expect(life.crabs).toBe(0)
    }
  })

  it('shows no spiny-tailed lizards in winter on real days', () => {
    for (const p of allParams()) {
      const w = propsOf(p).wildlife
      if (w?.lizard === 'spiny-tailed') expect(lizardAwake('spiny-tailed', p)).toBe(true)
    }
  })
})

describe('waterfowl and gulls', () => {
  it('stay in 0..1 for every climate and month', () => {
    for (const climate of CLIMATES)
      for (const d of months)
        for (const lat of [50, -40]) {
          const w = waterfowlSeason(at(d, climate, lat))
          for (const v of [w.goose, w.duck, gullSeason(at(d, climate, lat))]) {
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThanOrEqual(1)
          }
        }
  })

  it('leave the Arctic in winter and winter on Mediterranean coasts', () => {
    expect(waterfowlSeason(at('2025-01-15', 'polar', 70)).goose).toBe(0)
    expect(waterfowlSeason(at('2025-07-15', 'polar', 70)).goose).toBeGreaterThan(0)
    expect(waterfowlSeason(at('2025-01-15', 'mediterranean', 38)).goose).toBeGreaterThan(0)
    expect(waterfowlSeason(at('2025-07-15', 'mediterranean', 38)).goose).toBe(0)
    expect(gullSeason(at('2025-01-15', 'polar', 70))).toBeLessThan(1)
  })

  it('shows no geese on real polar winter days', () => {
    for (const p of allParams()) {
      if (p.place.climate !== 'polar') continue
      const m = seasonMonth(p)
      if (m >= 10 || m <= 4) expect(propsOf(p).migratory).not.toBe('goose')
    }
  })
})
