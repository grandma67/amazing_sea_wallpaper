import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'

import type { RGB } from '../src/biome'
import { FRUIT, fruitFor, withFruit, type FruitDay } from '../src/fruits'
import { BLOOM, bloomGrows, phenologyFor, type PhenologyDay } from '../src/phenology'
import { PLACES } from '../src/places'
import { crownBlossom, type CrownShrubs } from '../src/props/vegetation'
import { bush } from '../src/props/trees'
import { Random } from '../src/random'
import { SHRUB_KINDS, SHRUBS, shrubGrows, shrubsHere } from '../src/shrubs'
import { expectEvery, MONTHS, scene } from './days'

// Bushes as real shrub species (shrubs.ts, knowledge/BUSHES.md).

const FOLIAGE: RGB = [0.05, 0.1, 0.03]
const day = (date: string, id: string, overrides?: FruitDay['overrides']): FruitDay => {
  const place = PLACES.find(p => p.id === id)!
  const climate = Object.keys(place.climate)[0] as FruitDay['place']['climate']
  return { date, latitudeDeg: (place.latitude[0] + place.latitude[1]) / 2, place: { id, climate }, overrides }
}
const flowering = (d: PhenologyDay) => phenologyFor(d).bloom.map(b => b.row.kind)
const fruiting = (d: FruitDay) => fruitFor('bush', d).map(f => f.row.kind)
const triangles = (g: BufferGeometry): number => (g.index?.count ?? 0) / 3
/** A bush crown config as props/vegetation.ts builds it. */
const shrubsOf = (d: FruitDay): CrownShrubs => ({
  species: shrubsHere(d),
  offset: BLOOM.filter(r => r.plant === 'bush' && r.species == null && bloomGrows(r, d)).reduce((s, r) => s + r.crowns, 0),
  fruit: fruitFor('bush', d).filter(f => f.row.species != null)
})
const coast = scene({ place: 'cornwall-wales', coast: 'beach', eclipse: null }).coast
const SPOTS = Array.from({ length: 3000 }, (_, i) => [((i * 7919) % 2000) - 1000, ((i * 104729) % 1500) - 200] as const)

describe('the shrub table', () => {
  it('names real places, and leaves room under 1 with the older rows, every place × climate (no sampling)', () => {
    const ids = new Set(PLACES.map(p => p.id))
    for (const s of SHRUBS) expectEvery(s.places ?? [], id => ids.has(id), { allowEmpty: s.where != null })
    for (const place of PLACES) {
      for (const climate of Object.keys(place.climate) as FruitDay['place']['climate'][]) {
        for (const latitudeDeg of place.latitude) {
          const d: FruitDay = { date: '2025-06-15', latitudeDeg, place: { id: place.id, climate } }
          const c = shrubsOf(d)
          const total = c.offset + c.species.reduce((s, x) => s + x.share, 0)
          expect(total, `${place.id} ${climate}`).toBeLessThanOrEqual(1)
        }
      }
    }
  })

  it('gives every species flowers or fruit, and every species row a species that exists', () => {
    for (const kind of SHRUB_KINDS) {
      const rows = [...BLOOM.filter(r => r.species === kind), ...FRUIT.filter(r => r.species === kind)]
      expect(rows.length, kind).toBeGreaterThan(0)
    }
    for (const r of [...BLOOM, ...FRUIT]) if (r.species != null) expect(SHRUBS.some(s => s.species === r.species)).toBe(true)
  })

  it('flowers and fruits each species only where it grows, in its months', () => {
    for (const place of PLACES) {
      for (const date of MONTHS) {
        const d = day(date, place.id)
        for (const b of phenologyFor(d).bloom) if (b.row.species != null) expect(shrubGrows(SHRUBS.find(s => s.species === b.row.species)!, d), `${b.row.kind} ${place.id}`).toBe(true)
        for (const f of fruitFor('bush', d)) expect(shrubGrows(SHRUBS.find(s => s.species === f.row.species)!, d), `${f.row.kind} ${place.id}`).toBe(true)
      }
    }
  })
})

describe('the calendars', () => {
  it('Atlantic hedges: blackthorn white in April, hawthorn in May, sloes and haws in October', () => {
    expect(flowering(day('2025-04-10', 'cornwall-wales'))).toContain('blackthorn')
    expect(flowering(day('2025-05-15', 'cornwall-wales'))).toContain('hawthorn')
    expect(fruiting(day('2025-10-15', 'cornwall-wales'))).toEqual(expect.arrayContaining(['blackthorn', 'hawthorn']))
    expect(fruiting(day('2025-04-15', 'cornwall-wales'))).toEqual([])
  })

  it('dunes: Japanese rose in flower in July, hips and sea buckthorn orange in October, buckthorn into winter', () => {
    expect(flowering(day('2025-07-10', 'baltic'))).toContain('rugosa-rose')
    expect(fruiting(day('2025-10-10', 'baltic'))).toEqual(expect.arrayContaining(['rugosa-rose', 'sea-buckthorn']))
    expect(fruiting(day('2025-01-10', 'wadden-north-sea'))).toContain('sea-buckthorn')
  })

  it('southern places in their own months: calafate berries in March, mānuka in December', () => {
    expect(fruiting(day('2025-03-10', 'tierra-del-fuego'))).toContain('calafate')
    expect(fruiting(day('2025-09-10', 'tierra-del-fuego'))).toEqual([])
    expect(flowering(day('2025-12-10', 'new-zealand-north'))).toContain('manuka')
  })

  it('willow catkins round leaf-out on northern scrub, then seed fluff', () => {
    const at = (date: string) => fruitFor('bush', day(date, 'iceland')).find(f => f.row.kind === 'willow')
    const catkins = at('2025-05-10')
    expect(catkins).toBeDefined()
    expect(at('2025-06-10')!.stages.some(s => s.color[0] > 0.55)).toBe(true)
    expect(at('2025-09-10')).toBeUndefined()
  })
})

describe('bush crowns', () => {
  it('keep their species all year: the bushes in flower in April are those with sloes in October', () => {
    const spring = shrubsOf(day('2025-04-10', 'cornwall-wales'))
    const autumn = shrubsOf(day('2025-10-10', 'cornwall-wales'))
    const april = phenologyFor(day('2025-04-10', 'cornwall-wales')).bloom
    const october = phenologyFor(day('2025-10-10', 'cornwall-wales')).bloom
    let both = 0
    for (const [x, z] of SPOTS) {
      const a = crownBlossom(april, 'bush', x, z, coast, 0, spring)
      const o = crownBlossom(october, 'bush', x, z, coast, 0, autumn)
      if (a?.b?.row.kind === 'blackthorn') {
        expect(o?.fruit?.row.kind).toBe('blackthorn')
        both++
      }
    }
    expect(both).toBeGreaterThan(100)
  })

  it('leave the older rows’ crowns exactly as before', () => {
    const d = day('2025-05-10', 'cornwall-wales')
    const bloom = phenologyFor(d).bloom
    const old = bloom.filter(b => b.row.species == null)
    for (const [x, z] of SPOTS) {
      const before = crownBlossom(old, 'bush', x, z, coast)
      const after = crownBlossom(bloom, 'bush', x, z, coast, 0, shrubsOf(d))
      if (before != null) expect(after).toEqual(before)
      else expect(after?.b?.row.species ?? after?.fruit?.row.species ?? 'none').not.toBe('gorse')
    }
  })

  it('share the bushes roughly by the table', () => {
    const d = day('2025-10-10', 'baltic')
    const c = shrubsOf(d)
    const hits = SPOTS.filter(([x, z]) => crownBlossom(phenologyFor(d).bloom, 'bush', x, z, coast, 0, c)?.fruit?.row.kind === 'sea-buckthorn').length
    expect(hits / SPOTS.length).toBeGreaterThan(0.2)
    expect(hits / SPOTS.length).toBeLessThan(0.3)
  })
})

describe('bush fruit meshes', () => {
  it('keep the bush’s draws and add bounded, finite triangles for every species fruit', () => {
    for (const row of FRUIT.filter(r => r.plant === 'bush')) {
      const d = day('2025-06-15', 'cornwall-wales', { fruit: [row.kind] })
      const fruit = fruitFor('bush', d).map(f => ({ ...f, crowns: 1 }))
      expect(fruit.length, row.kind).toBe(1)
      for (const seed of ['a', 'b']) {
        const r1 = new Random(seed)
        const plain = bush(r1, FOLIAGE)
        const r2 = new Random(seed)
        const g = bush(r2, FOLIAGE, withFruit(undefined, fruit, phenologyFor(d)))
        expect(r2.float(), row.kind).toBe(r1.float())
        const added = triangles(g) - triangles(plain)
        expect(added, row.kind).toBeGreaterThan(0)
        expect(added, row.kind).toBeLessThan(15_000)
        expectEvery(g.getAttribute('position').array as Float32Array, v => Number.isFinite(v), { what: () => row.kind })
      }
    }
  })
})
