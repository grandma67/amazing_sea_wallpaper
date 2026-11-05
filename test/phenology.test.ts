import { describe, expect, it } from 'vitest'

import { CLIMATES } from '../src/places'
import type { Climate, VegetationKind } from '../src/biome'
import { band, canopyTint, deciduousShare, groundCoverTint, phenologyFor, plantSeason, seasonalSnowLine, SNOW_SEASON, type PhenologyDay } from '../src/phenology'
import { birch, broadleaf, bush } from '../src/props/trees'
import { Random } from '../src/random'
import { seasonDay } from '../src/seasons'
import { allParams, scene } from './days'

const day = (date: string, climate: Climate, latitudeDeg = 50, id = 'x'): PhenologyDay => ({ date, latitudeDeg, place: { id, climate } })
const months = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}-15`)

describe('seasonDay', () => {
  it('counts the calendar day north and half a year on south', () => {
    expect(seasonDay({ date: '2025-01-01', latitudeDeg: 10 })).toBe(1)
    expect(seasonDay({ date: '2025-12-31', latitudeDeg: 10 })).toBe(365)
    expect(seasonDay({ date: '2024-12-31', latitudeDeg: 10 })).toBe(365)
    expect(seasonDay({ date: '2025-07-03', latitudeDeg: -40 })).toBe(1)
    expect(seasonDay({ date: '2025-01-01', latitudeDeg: -40 })).toBe(183)
  })
})

describe('band', () => {
  it('rises, holds and falls, wrapping the year', () => {
    expect(band(100, 100, 110, 200, 210)).toBe(0)
    expect(band(105, 100, 110, 200, 210)).toBeCloseTo(0.5)
    expect(band(150, 100, 110, 200, 210)).toBe(1)
    expect(band(220, 100, 110, 200, 210)).toBe(0)
    // Winter window 300 → 60.
    expect(band(10, 300, 320, 40, 60)).toBe(1)
    expect(band(200, 300, 320, 40, 60)).toBe(0)
  })
})

describe('phenology', () => {
  it('stays in 0..1 for every climate and month, both hemispheres', () => {
    for (const climate of CLIMATES) {
      for (const date of months) {
        for (const lat of [50, -40]) {
          const p = phenologyFor(day(date, climate, lat))
          for (const v of [p.on, p.turned, p.fresh, p.dry, p.tropical.on, p.tropical.turned]) {
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThanOrEqual(1)
          }
        }
      }
    }
  })

  it('turns temperate oaks in late October and leaves them bare in January', () => {
    const october = phenologyFor(day('2025-10-28', 'temperate'))
    expect(october.turned).toBeGreaterThan(0.6)
    expect(october.on).toBeGreaterThan(0.8)
    const january = phenologyFor(day('2025-01-15', 'temperate'))
    expect(january.on).toBe(0)
    const july = phenologyFor(day('2025-07-15', 'temperate'))
    expect([july.on, july.turned, july.fresh]).toEqual([1, 0, 0])
    const may = phenologyFor(day('2025-05-01', 'temperate'))
    expect(may.fresh).toBeGreaterThan(0.5)
  })

  it('runs six months later in the south', () => {
    const north = phenologyFor(day('2025-10-28', 'temperate', 50))
    const south = phenologyFor(day('2026-04-28', 'temperate', -45))
    expect(south.turned).toBeCloseTo(north.turned, 1)
    expect(south.on).toBeCloseTo(north.on, 1)
  })

  it('turns boreal birch in September, before temperate oak', () => {
    const date = '2025-09-22'
    expect(phenologyFor(day(date, 'boreal')).turned).toBeGreaterThan(0.6)
    expect(phenologyFor(day(date, 'temperate')).turned).toBe(0)
  })

  it('dries Mediterranean grass in summer, greens it in winter', () => {
    expect(phenologyFor(day('2025-08-10', 'mediterranean', 38)).dry).toBeGreaterThan(0.8)
    expect(phenologyFor(day('2025-02-10', 'mediterranean', 38)).dry).toBe(0)
    expect(phenologyFor(day('2025-08-10', 'temperate')).dry).toBe(0)
    expect(phenologyFor(day('2025-08-10', 'tropical', 10)).dry).toBe(0)
  })

  it('is off (summer) when a spec says so', () => {
    const p = phenologyFor({ ...day('2025-01-15', 'temperate'), overrides: { phenology: false } })
    expect([p.on, p.turned, p.dry]).toEqual([1, 0, 0])
  })
})

describe('which plants change', () => {
  const kinds: VegetationKind[] = ['palm', 'pandanus', 'stone-pine', 'olive', 'cypress', 'conifer', 'acacia']
  it('leaves evergreens alone everywhere', () => {
    for (const climate of CLIMATES) {
      const p = phenologyFor(day('2025-11-15', climate))
      for (const kind of kinds) expect(deciduousShare(kind, p)).toBe(0)
    }
  })

  it('keeps Mediterranean and subtropical broadleaves (holm and live oak) green', () => {
    for (const climate of ['mediterranean', 'subtropical'] as const) expect(deciduousShare('broadleaf', phenologyFor(day('2025-11-15', climate)))).toBe(0)
    expect(deciduousShare('broadleaf', phenologyFor(day('2025-05-15', 'temperate', -42, 'tasmania')))).toBe(0)
    expect(deciduousShare('broadleaf', phenologyFor(day('2025-05-15', 'temperate', -54, 'tierra-del-fuego')))).toBeGreaterThan(0)
  })

  it('gives no season to a plant that looks as in summer', () => {
    expect(plantSeason('broadleaf', phenologyFor(day('2025-07-15', 'temperate')))).toBeUndefined()
    expect(plantSeason('palm', phenologyFor(day('2025-01-15', 'mediterranean', 38)))).toBeUndefined()
    expect(plantSeason('grass', phenologyFor(day('2025-08-15', 'mediterranean', 38)))?.dry).toBeGreaterThan(0.8)
  })

  it('tints distant woods and ground only out of summer', () => {
    const foliage = [0.05, 0.1, 0.04] as [number, number, number]
    const plants = [['broadleaf', 3], ['conifer', 1], ['grass', 6]] as const
    expect(canopyTint(foliage, phenologyFor(day('2025-07-15', 'temperate')), plants)).toEqual(foliage)
    const october = canopyTint(foliage, phenologyFor(day('2025-10-28', 'temperate')), plants)
    expect(october[0]).toBeGreaterThan(foliage[0] * 1.5)
    expect(groundCoverTint(foliage, phenologyFor(day('2025-07-15', 'temperate')))).toEqual(foliage)
    expect(groundCoverTint(foliage, phenologyFor(day('2025-08-15', 'mediterranean', 38)))[0]).toBeGreaterThan(foliage[0] * 2)
  })
})

describe('seasonal trees', () => {
  const foliage = [0.05, 0.1, 0.04] as [number, number, number]
  const vertices = (build: typeof broadleaf, date: string, climate: Climate = 'temperate') =>
    build(new Random('tree'), foliage, plantSeason('birch', phenologyFor(day(date, climate)))).getAttribute('position').count

  it('are deterministic and keep their shape (draws) whatever the season', () => {
    for (const build of [broadleaf, birch, bush]) {
      expect(vertices(build, '2025-11-10')).toBe(vertices(build, '2025-11-10'))
      // The next draw after the tree is the same: no season changes the stream.
      const rngs = ['2025-07-15', '2025-01-15'].map(date => {
        const rng = new Random('tree')
        build(rng, foliage, plantSeason('birch', phenologyFor(day(date, 'temperate'))))
        return rng.float()
      })
      expect(rngs[0]).toBe(rngs[1])
    }
  })

  it('lose their leaves in winter and keep them in summer', () => {
    const summer = vertices(birch, '2025-07-15')
    const winter = vertices(birch, '2025-01-15')
    expect(winter).toBeLessThan(summer * 0.4)
    for (const v of [summer, winter]) expect(Number.isFinite(v)).toBe(true)
  })

  it('stay within the triangle budget when bare (twigs instead of leaves)', () => {
    for (const build of [broadleaf, birch, bush]) {
      const g = build(new Random('tree'), foliage, plantSeason('birch', phenologyFor(day('2025-01-15', 'temperate'))))
      expect(g.getIndex()!.count / 3).toBeLessThan(100_000)
    }
  })

  it('have finite positions in autumn', () => {
    const g = broadleaf(new Random('tree'), foliage, plantSeason('birch', phenologyFor(day('2025-11-20', 'temperate'))))
    const pos = g.getAttribute('position').array
    for (const v of pos) expect(Number.isFinite(v)).toBe(true)
  })
})

describe('real days', () => {
  it('never change a day in summer leaf and green grass', () => {
    // Days in July in the temperate north: summer look.
    const temperateJuly = allParams().filter(p => p.place.climate === 'temperate' && p.latitudeDeg > 0 && p.date.slice(5, 7) === '07')
    expect(temperateJuly.length).toBeGreaterThan(5)
    for (const p of temperateJuly) {
      const phen = phenologyFor(p)
      expect([phen.on, phen.turned, phen.dry]).toEqual([1, 0, 0])
    }
  })

  it('give a real northern temperate November day autumn trees', () => {
    const p = scene({ place: 'maine' }, '2025-10-20')
    const phen = phenologyFor(p)
    expect(phen.turned).toBeGreaterThan(0.5)
  })
})

describe('seasonal snow line', () => {
  const land = (snowLine: number, height = 2000, kind: 'range' | 'strato' = 'strato') => ({ snowLine, height, kind, seed: 1234 })
  const at = (date: string, latitudeDeg = 50) => ({ date, latitudeDeg })

  it('is lower in winter and higher in late summer, in the day\'s own hemisphere', () => {
    for (const climate of Object.keys(SNOW_SEASON) as Climate[]) {
      const winter = SNOW_SEASON[climate]!.winter
      expect(seasonalSnowLine(land(1000), climate, at('2025-02-01'))).toBeCloseTo(1000 * winter)
      expect(seasonalSnowLine(land(1000), climate, at('2025-08-25'))).toBeCloseTo(1200)
      expect(seasonalSnowLine(land(1000), climate, at('2025-05-31'))).toBeCloseTo(1000, -1)
      expect(seasonalSnowLine(land(1000), climate, at('2025-08-01', -40))).toBeCloseTo(1000 * winter)
    }
  })

  it('leaves tropical and arid mountains as drawn, every month', () => {
    for (const climate of ['tropical', 'arid'] as const) {
      for (const date of months) {
        expect(seasonalSnowLine(land(1500), climate, at(date))).toBe(1500)
        expect(seasonalSnowLine(land(Infinity, 3500), climate, at(date))).toBe(Infinity)
      }
    }
  })

  it('whitens a mountain bare in summer only in winter, only if it\'s tall enough', () => {
    for (const climate of Object.keys(SNOW_SEASON) as Climate[]) {
      const { bareFrom } = SNOW_SEASON[climate]!
      expect(seasonalSnowLine(land(Infinity, bareFrom), climate, at('2025-02-01'))).toBeLessThan(bareFrom * 0.9)
      expect(seasonalSnowLine(land(Infinity, bareFrom), climate, at('2025-07-15'))).toBe(Infinity)
      expect(seasonalSnowLine(land(Infinity, bareFrom - 1), climate, at('2025-02-01'))).toBe(Infinity)
    }
  })

  it('puts the winter line under a range\'s real peaks, and falls with the season', () => {
    // A range's peaks reach ~0.8 of its height.
    expect(seasonalSnowLine(land(Infinity, 2000, 'range'), 'temperate', at('2025-02-01'))).toBeLessThan(2000 * 0.8 * 0.9 + 1)
    // Nothing before the snow's noise can reach the top: above the peak by 6% of the height.
    const start = seasonalSnowLine(land(Infinity, 2000), 'temperate', at('2025-11-02'))
    expect(start).toBeGreaterThan(2000 * 1.06)
    const lines = ['2025-11-10', '2025-12-01', '2025-12-20', '2026-01-15'].map(date => seasonalSnowLine(land(Infinity, 2000), 'temperate', at(date)))
    for (let i = 1; i < lines.length; i++) expect(lines[i]).toBeLessThan(lines[i - 1])
  })

  it('over real days: deserts have none, lines follow the season, the off switch keeps the draw', () => {
    const days = allParams().filter(p => p.landform != null)
    const finite = (p: (typeof days)[number]) => Number.isFinite(p.landform!.snowLine)
    expect(days.filter(p => p.biome.name === 'desert').some(finite)).toBe(false)
    const coldClimate = days.filter(p => p.place.climate === 'temperate' || p.place.climate === 'boreal')
    const inMonth = (from: number, to: number) => coldClimate.filter(p => {
      const m = Number(p.date.slice(5, 7))
      const season = p.latitudeDeg < 0 ? ((m + 5) % 12) + 1 : m
      return season >= from && season <= to
    })
    const snowy = (list: typeof days) => list.filter(finite).length / list.length
    expect(snowy(inMonth(1, 2))).toBeGreaterThan(snowy(inMonth(7, 8)))
    const off = scene({ landform: 'strato', place: 'norway-west', props: { phenology: false } }, '2025-02-01').landform!
    const on = scene({ landform: 'strato', place: 'norway-west' }, '2025-02-01').landform!
    expect(on.snowLine).toBeCloseTo(off.snowLine * 0.6)
    expect({ ...on, snowLine: 0 }).toEqual({ ...off, snowLine: 0 })
  })
})
