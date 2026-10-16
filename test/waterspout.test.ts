import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { funnelGeometry, waterspoutChance } from '../src/props/waterspout'
import { Random } from '../src/random'
import { allParams, scene } from './days'

describe('waterspouts', () => {
  const days = allParams()

  it('are rare, by day, on warm seas in their season, with towering cumulus', () => {
    const spouts = days.filter(p => p.waterspout != null)
    expect(spouts.length).toBeGreaterThan(0)
    expect(spouts.length).toBeLessThan(days.length * 0.02)
    for (const p of spouts) {
      expect(['daylight', 'midday', 'golden-hour']).toContain(p.timeOfDay)
      expect(['tropical', 'mediterranean']).toContain(p.biome.name)
      expect(waterspoutChance(p.biome.name, p.sea.ocean, Number(p.date.slice(5, 7)))).toBeGreaterThan(0)
      if (p.weather.kind !== 'storm') {
        expect(p.weather.formations).toContain('cumulus-congestus')
        expect(p.waterspout!.kind).toBe('fair-weather')
      }
      expect(p.title).toContain('waterspout')
    }
  })

  it('follows the seasons: Keys in summer, Mediterranean in autumn', () => {
    expect(waterspoutChance('tropical', 'atlantic', 8)).toBeGreaterThan(waterspoutChance('tropical', 'atlantic', 2))
    expect(waterspoutChance('mediterranean', 'atlantic', 9)).toBeGreaterThan(waterspoutChance('mediterranean', 'atlantic', 5))
    expect(waterspoutChance('nordic', 'atlantic', 7)).toBe(0)
  })

  it('is forced by a spec, tornadic in a storm', () => {
    expect(scene({ waterspout: true, weather: 'scattered', timeOfDay: 'daylight', storm: null, eclipse: null }).waterspout?.kind).toBe('fair-weather')
    expect(scene({ waterspout: 'tornadic', storm: 'squall', timeOfDay: 'daylight', eclipse: null }).waterspout?.kind).toBe('tornadic')
    expect(scene({ waterspout: null }).waterspout).toBeNull()
  })

  it('builds a finite funnel from the sea to the cloud base, under budget', () => {
    const spout = scene({ waterspout: true, weather: 'scattered', timeOfDay: 'daylight', storm: null, eclipse: null }).waterspout!
    const a = funnelGeometry(spout, new Vector3(1, 0, 0), new Random('f')).build()
    const b = funnelGeometry(spout, new Vector3(1, 0, 0), new Random('f')).build()
    const pos = a.getAttribute('position')
    expect(Array.from(pos.array)).toEqual(Array.from(b.getAttribute('position').array))
    let minY = Infinity
    let maxY = -Infinity
    for (let i = 0; i < pos.count; i++) {
      expect(Number.isFinite(pos.getX(i) + pos.getY(i) + pos.getZ(i))).toBe(true)
      minY = Math.min(minY, pos.getY(i))
      maxY = Math.max(maxY, pos.getY(i))
    }
    // The foot ring tilts with the lean: within a fraction of its width of the sea.
    expect(Math.abs(minY)).toBeLessThan(spout.widthM * 0.3)
    expect(maxY).toBeGreaterThan(spout.cloudBaseM)
    expect(a.index!.count / 3).toBeLessThan(20_000)
  })
})
