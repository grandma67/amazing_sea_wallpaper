import { describe, expect, it } from 'vitest'

import { noctilucentSeason } from '../src/noctilucent'
import { allParams, scene } from './days'

describe('noctilucent clouds', () => {
  const days = allParams()

  it('show only at blue hour on clear nordic or Southern Ocean nights, 50–67°, in season', () => {
    const nlc = days.filter(p => p.noctilucent != null)
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

  it('are forced by a spec, and absent by day without one', () => {
    expect(scene({ noctilucent: true, timeOfDay: 'blue-hour' }, '2024-06-26').noctilucent).not.toBeNull()
    expect(scene({ noctilucent: null }, '2024-06-26').noctilucent).toBeNull()
    for (const p of days.filter(q => q.timeOfDay === 'midday' || q.timeOfDay === 'night')) expect(p.noctilucent).toBeNull()
  })

  it('nacreous clouds only in polar winter twilight, rarely', () => {
    const ncr = days.filter(p => p.nacreous != null)
    expect(ncr.length).toBeLessThan(10)
    for (const p of ncr) {
      expect(p.timeOfDay).toBe('blue-hour')
      expect(['arctic', 'southern']).toContain(p.sea.ocean)
    }
    expect(scene({ nacreous: true, ocean: 'arctic', timeOfDay: 'blue-hour' }, '2024-01-15').nacreous).not.toBeNull()
  })
})
