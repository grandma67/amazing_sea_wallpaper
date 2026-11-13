import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'

import type { RGB } from '../src/biome'
import { FRUIT, FRUIT_KINDS, fruitFor, mastYear, withFruit, type FruitDay, type FruitKind } from '../src/fruits'
import { phenologyFor } from '../src/phenology'
import { PLACES } from '../src/places'
import { palm } from '../src/props/vegetation'
import { birch, broadleaf, conifer, olive, pandanus, rhizophora, stonePine } from '../src/props/trees'
import { Random } from '../src/random'
import { parseSceneSpec } from '../src/sceneSpec'
import { expectEvery, MONTHS } from './days'

// Fruits, cones, catkins and propagules (fruits.ts, knowledge/TREES.md).

const FOLIAGE: RGB = [0.05, 0.1, 0.03]
const day = (date: string, id: string, overrides?: FruitDay['overrides'], latitudeDeg?: number): FruitDay => {
  const place = PLACES.find(p => p.id === id)!
  const climate = Object.keys(place.climate)[0] as FruitDay['place']['climate']
  return { date, latitudeDeg: latitudeDeg ?? (place.latitude[0] + place.latitude[1]) / 2, place: { id, climate }, overrides }
}
const on = (plant: Parameters<typeof fruitFor>[0], d: FruitDay, kind: FruitKind) => fruitFor(plant, d).find(f => f.row.kind === kind)
const colorOf = (plant: Parameters<typeof fruitFor>[0], d: FruitDay, kind: FruitKind): RGB[] => on(plant, d, kind)?.stages.map(s => s.color) ?? []
const triangles = (g: BufferGeometry): number => (g.index?.count ?? 0) / 3

describe('the fruit table', () => {
  it('gives crops and shares in 0..1, stages that sum to 1, every place × month (no sampling)', () => {
    let checked = 0
    for (const place of PLACES) {
      for (const climate of Object.keys(place.climate) as FruitDay['place']['climate'][]) {
        for (const date of MONTHS) {
          for (const latitudeDeg of place.latitude) {
            const d: FruitDay = { date, latitudeDeg, place: { id: place.id, climate } }
            for (const row of FRUIT) {
              for (const f of fruitFor(row.plant, d)) {
                expect(f.crop, `${f.row.kind} ${place.id} ${date}`).toBeGreaterThan(0)
                expect(f.crop).toBeLessThanOrEqual(1)
                expect(f.crowns).toBeGreaterThan(0)
                expect(f.crowns).toBeLessThanOrEqual(1)
                expect(f.stages.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1)
                expectEvery(f.stages.flatMap(s => [...s.color, s.hang]), v => v >= 0 && v <= 1)
                checked++
              }
            }
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000)
  })

  it('has one row per kind, every kind forceable in a spec', () => {
    expect(FRUIT.map(r => r.kind).sort()).toEqual([...FRUIT_KINDS].sort())
    expect(() => parseSceneSpec(JSON.stringify({ props: { fruit: [...FRUIT_KINDS] } }))).not.toThrow()
    expect(() => parseSceneSpec(JSON.stringify({ props: { fruit: ['acorn'] } }))).toThrow()
  })

  it('hangs coconuts on tropical palms, dates on the Canaries’ and black sabal fruit in Florida', () => {
    expect(fruitFor('palm', day('2025-03-15', 'antilles')).map(f => f.row.kind)).toEqual(['coconut'])
    expect(fruitFor('palm', day('2025-11-15', 'canaries')).map(f => f.row.kind)).toEqual(['palm-dates'])
    expect(colorOf('palm', day('2025-11-15', 'florida-carolinas'), 'sabal')[0][0]).toBeLessThan(0.05)
    expect(fruitFor('palm', day('2025-03-15', 'florida-carolinas'))).toEqual([])
  })

  it('turns olives green to black through the autumn, in each hemisphere’s own season', () => {
    const green = colorOf('olive', day('2025-08-15', 'aegean'), 'olive-fruit')
    expect(green).toHaveLength(1)
    expect(green[0][1]).toBeGreaterThan(green[0][0])
    expect(on('olive', day('2025-01-15', 'aegean'), 'olive-fruit')!.stages.at(-1)!.share).toBe(1)
    expect(on('olive', day('2025-04-15', 'aegean'), 'olive-fruit')).toBeUndefined()
    // Chile's August is the Aegean's February.
    expect(on('olive', day('2025-08-15', 'central-chile', undefined, -33), 'olive-fruit')?.crop).toBeCloseTo(0.2)
  })

  it('reddens spruce cones in May, hangs them brown by October, and keeps last year’s till autumn', () => {
    const at = (date: string) => on('conifer', day(date, 'norway-west'), 'spruce-cones')
    expect(at('2025-05-20')!.stages[0].hang).toBe(0)
    expect(at('2025-05-20')!.stages[0].color[0]).toBeGreaterThan(at('2025-05-20')!.stages[0].color[1] * 4)
    expect(at('2025-10-20')!.stages[0].size).toBe(1)
    // A heavy year is followed by its empty cones the next summer.
    const year = Array.from({ length: 30 }, (_, i) => 2000 + i).find(y => mastYear(y, 'norway-west') === 1)!
    expect(on('conifer', day(`${year + 1}-03-15`, 'norway-west'), 'spruce-cones')!.crop).toBe(1)
  })

  it('masts about one year in four (hashed by year and place, not drawn)', () => {
    const years = Array.from({ length: 400 }, (_, i) => 1800 + i)
    const heavy = years.filter(y => mastYear(y, 'baltic') === 1).length / years.length
    expect(heavy).toBeGreaterThan(0.17)
    expect(heavy).toBeLessThan(0.33)
    expect(mastYear(2025, 'baltic')).toBe(mastYear(2025, 'baltic'))
  })

  it('opens birch catkins at leaf-out and leaves them closed and brown in winter', () => {
    const april = colorOf('birch', day('2025-04-25', 'scotland'), 'birch-catkins')
    expect(april.some(c => c[0] > 0.25)).toBe(true)
    const jan = on('birch', day('2025-01-15', 'scotland'), 'birch-catkins')!
    expect(jan.stages.every(s => s.color[0] < 0.1)).toBe(true)
  })

  it('bears almonds only on the deciduous share of tropical broadleaf', () => {
    expect(on('broadleaf', day('2025-06-15', 'antilles'), 'almond-fruit')!.crowns).toBeCloseTo(0.4)
    expect(fruitFor('broadleaf', day('2025-06-15', 'scotland'))).toEqual([])
  })

  it('is forced by props.fruit and switched off by it and by phenology: false', () => {
    // Forced: at its peak stage and full crop, out of season.
    expect(on('olive', day('2025-04-15', 'aegean', { fruit: true }), 'olive-fruit')!.crop).toBe(1)
    expect(fruitFor('conifer', day('2025-04-15', 'antilles', { fruit: ['spruce-cones'] }))).toHaveLength(1)
    expect(fruitFor('palm', day('2025-04-15', 'antilles', { fruit: false }))).toEqual([])
    expect(fruitFor('palm', day('2025-04-15', 'antilles', { phenology: false }))).toEqual([])
  })
})

describe('fruit meshes', () => {
  const forced = (plant: Parameters<typeof fruitFor>[0], kind: FruitKind) => {
    const d = day('2025-06-15', 'antilles', { fruit: [kind] })
    return withFruit(undefined, fruitFor(plant, d), phenologyFor(d))
  }
  const builds = [
    ['coconut', 'palm', palm],
    ['palm-dates', 'palm', palm],
    ['pandanus', 'pandanus', pandanus],
    ['stone-pine-cones', 'stone-pine', stonePine],
    ['spruce-cones', 'conifer', conifer],
    ['olive-fruit', 'olive', olive],
    ['almond-fruit', 'broadleaf', broadleaf],
    ['birch-catkins', 'birch', birch],
    ['propagules', 'rhizophora', rhizophora]
  ] as const

  it('keep the tree’s draws, add a bounded number of finite triangles, deterministically', () => {
    for (const [kind, plant, build] of builds) {
      for (const seed of ['a', 'b', 'c']) {
        const plainRng = new Random(seed)
        const plain = build(plainRng, FOLIAGE)
        const rng = new Random(seed)
        const season = forced(plant, kind)
        // Almonds hang only on deciduous crowns: count them on all.
        const all = kind === 'almond-fruit' ? { ...season!, fruit: season!.fruit!.map(f => ({ ...f, crowns: 1 })) } : season
        const fruited = build(rng, FOLIAGE, all)
        // Same draws: the stream moves on exactly as without fruit.
        expect(rng.float(), kind).toBe(plainRng.float())
        const added = triangles(fruited) - triangles(plain)
        // Palms trade their nuts for bunches; every other kind gains fruit.
        if (plant !== 'palm') expect(added, `${kind} ${seed}`).toBeGreaterThan(0)
        expect(triangles(fruited), kind).toBeLessThan(100_000)
        expect(added, kind).toBeLessThan(20_000)
        expectEvery(fruited.getAttribute('position').array as Float32Array, v => Number.isFinite(v), { what: () => kind })
        expect(triangles(build(new Random(seed), FOLIAGE, all))).toBe(triangles(fruited))
      }
    }
  })
})
