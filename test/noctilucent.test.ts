import { describe, expect, it } from 'vitest'

import { noctilucentSeason } from '../src/noctilucent'
import { DAYS, allParams, expectEvery, monthOf, scene, scenes } from './days'

describe('noctilucent clouds', () => {
  const days = allParams()

  it('show only at blue hour on clear nordic or Southern Ocean nights, 50–67°, in season', () => {
    // Rare on real days: add clear nordic blue hours on every date.
    const twilights = scenes({ biome: 'nordic', timeOfDay: 'blue-hour', weather: 'clear', eclipse: null }, DAYS.length)
    const nlc = [...days, ...twilights].filter(p => p.noctilucent != null)
    expect(nlc.length).toBeGreaterThan(0)
    for (const p of nlc) {
      expect(p.timeOfDay).toBe('blue-hour')
      expect(['clear', 'cirrus', 'few']).toContain(p.weather.kind)
      expect(p.biome.name === 'nordic' || p.sea.ocean === 'southern').toBe(true)
      expect(Math.abs(p.latitudeDeg)).toBeGreaterThanOrEqual(50)
      const month = Number(p.date.slice(5, 7))
      if (p.sea.ocean === 'southern') expect([11, 12, 1, 2]).toContain(month)
      else expect([5, 6, 7, 8]).toContain(month)
    }
  })

  it('follow the season round the solstice', () => {
    expect(noctilucentSeason(6, 21, false)).toBeCloseTo(1, 1)
    expect(noctilucentSeason(7, 20, false)).toBeGreaterThan(0)
    expect(noctilucentSeason(12, 15, false)).toBe(0)
    expect(noctilucentSeason(9, 15, false)).toBe(0)
    expect(noctilucentSeason(12, 21, true)).toBeCloseTo(1, 1)
    expect(noctilucentSeason(6, 21, true)).toBe(0)
  })

  it('are forced by a spec', () => {
    expect(scene({ noctilucent: true, timeOfDay: 'blue-hour' }, '2024-06-26').noctilucent).not.toBeNull()
    expect(scene({ noctilucent: null }, '2024-06-26').noctilucent).toBeNull()
  })

  it('nacreous clouds are rare, in polar winter twilight, and forced by a spec', () => {
    expect(days.filter(p => p.nacreous != null).length).toBeLessThan(10)
    // Too rare for three real years: add clear polar blue hours on every date.
    const twilights = (ocean: 'arctic' | 'southern') => scenes({ ocean, timeOfDay: 'blue-hour', weather: 'clear', eclipse: null }, DAYS.length).filter(p => p.nacreous != null)
    expectEvery(twilights('arctic'), p => [11, 12, 1, 2].includes(monthOf(p)))
    expectEvery(twilights('southern'), p => [5, 6, 7, 8].includes(monthOf(p)))
    expect(scene({ nacreous: true, ocean: 'arctic', timeOfDay: 'blue-hour' }, '2024-01-15').nacreous).not.toBeNull()
  })
})
