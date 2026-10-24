import { describe, expect, it } from 'vitest'

import { SAND_STYLES } from '../src/biome'
import { HIGH_ARCTIC_DEG, PLACES, placeNamed } from '../src/places'
import { allParams, scene, scenes, share } from './days'

const RED_PLACES = ['pei', 'fundy', 'hawaii', 'oman-yemen', 'red-sea']

describe('sand colour', () => {
  it('gives every place valid chances', () => {
    for (const place of PLACES) {
      const entries = Object.entries(place.sand)
      expect(entries.length).toBeGreaterThan(0)
      for (const [name, weight] of entries) {
        expect(Object.keys(SAND_STYLES)).toContain(name)
        expect(weight).toBeGreaterThan(0)
      }
    }
  })

  it('is pink only on tropical coasts and red only in the listed places', () => {
    for (const place of PLACES) {
      if ((place.sand.pink ?? 0) > 0) expect(place.biome).toBe('tropical')
      if ((place.sand.red ?? 0) > 0) expect(RED_PLACES).toContain(place.id)
    }
    for (const p of allParams()) {
      if (p.coast.sand.name === 'pink') expect(p.biome.name).toBe('tropical')
      if (p.coast.sand.name === 'red') expect(RED_PLACES).toContain(p.place.id)
    }
  })

  it('is rare overall (decision 4)', () => {
    const beaches = allParams().filter(p => p.coast.type === 'beach')
    expect(share(beaches, p => p.coast.sand.name === 'pink' || p.coast.sand.name === 'red')).toBeLessThan(0.02)
  })

  it('follows the place roughly as often as the table says', () => {
    const red = (place: string) => share(scenes({ place, coast: 'beach' }, 200), p => p.coast.sand.name === 'red')
    const pink = (place: string) => share(scenes({ place, coast: 'beach' }, 200), p => p.coast.sand.name === 'pink')
    // 200 days: ±0.035 sampling noise, so ±0.1 bounds.
    const near = (value: number, target: number) => expect(Math.abs(value - target)).toBeLessThan(0.1)
    near(red('pei'), 0.6)
    near(red('fundy'), 0.4)
    expect(red('nova-scotia')).toBe(0)
    near(pink('bahamas-bermuda'), 0.25)
    expect(pink('indonesia')).toBeLessThan(0.08)
    expect(placeNamed('philippines').sand.pink).toBe(1)
  })

  it('is forced by the spec on any place, keeping the rest of the day', () => {
    const date = '2025-03-14'
    const drawn = scene({ place: 'scotland', coast: 'beach', beachMaterial: 'sand' }, date)
    const pink = scene({ place: 'scotland', coast: 'beach', beachMaterial: 'sand', sand: 'pink' }, date)
    expect(pink.coast.sand.name).toBe('pink')
    expect(pink.title).toContain('pink sand beach')
    expect({ ...pink.coast, sand: null }).toEqual({ ...drawn.coast, sand: null })
    expect(pink.camera).toEqual(drawn.camera)
  })
})

describe('plants', () => {
  const has = (p: { biome: { vegetation: readonly (readonly [string, number])[] } }, kind: string) => p.biome.vegetation.some(([k]) => k === kind)

  it('drops birch above 74° in the Arctic, keeps it below', () => {
    const arctic = allParams().filter(p => p.sea.ocean === 'arctic')
    for (const p of arctic) {
      if (Math.abs(p.latitudeDeg) >= HIGH_ARCTIC_DEG) expect(has(p, 'birch')).toBe(false)
    }
    const svalbard = scenes({ place: 'svalbard' }, 20)
    expect(svalbard.every(p => !has(p, 'birch') && p.biome.vegetation.every(([k]) => k === 'grass' || k === 'bush'))).toBe(true)
    expect(arctic.some(p => Math.abs(p.latitudeDeg) < HIGH_ARCTIC_DEG && has(p, 'birch'))).toBe(true)
  })

  it('has trees on Southern Ocean coasts only in Tierra del Fuego (southern beech, wind-bent)', () => {
    const southern = allParams().filter(p => p.sea.ocean === 'southern')
    for (const p of southern) {
      const trees = p.biome.vegetation.filter(([k]) => k !== 'grass' && k !== 'bush')
      if (p.place.id === 'tierra-del-fuego') expect(trees.map(([k]) => k)).toEqual(['broadleaf'])
      else expect(trees).toEqual([])
    }
    expect(scenes({ place: 'tierra-del-fuego' }, 10).every(p => has(p, 'broadleaf') && !has(p, 'conifer'))).toBe(true)
    expect(scenes({ place: 'south-georgia' }, 10).every(p => p.biome.vegetation.length === 1 && has(p, 'grass'))).toBe(true)
    for (const place of PLACES) expect(place.windBent).toEqual(place.id === 'tierra-del-fuego' ? ['broadleaf'] : [])
  })
})
