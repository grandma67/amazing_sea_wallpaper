import { describe, expect, it } from 'vitest'

import { burrowGeometry, crabGeometry, FLOWERS, flowerGeometry, shellGeometry, shoreLifeFor, starfishGeometry, type FlowerKind } from '../src/props/shoreLife'
import { Random } from '../src/random'
import { allParams, DAYS, scene, scenes } from './days'

describe('shore life', () => {
  const days = allParams()
  const beaches = days.filter(p => p.coast.type === 'beach')
  const life = (p: (typeof days)[number]) => shoreLifeFor(p, Random.derive(p.seed, 'props/shore-life'))!

  it('only lives on a beach', () => {
    for (const p of scenes({ coast: 'open-sea' })) expect(shoreLifeFor(p, new Random(p.seed))).toBeNull()
  })

  it('puts ghost crabs on warm sand, out mostly at dusk and night', () => {
    const ghost = beaches.filter(p => life(p).crab === 'ghost')
    expect(ghost.length).toBeGreaterThan(50)
    for (const p of ghost) expect(['tropical', 'desert', 'mediterranean']).toContain(p.biome.name)
    // The same tropical beaches by night and at midday.
    const out = (timeOfDay: 'night' | 'midday'): number => {
      const some = scenes({ coast: 'beach', biome: 'tropical', timeOfDay, eclipse: null }, 80).filter(p => life(p).crab === 'ghost')
      return some.reduce((sum, p) => sum + life(p).crabs, 0) / some.length
    }
    expect(out('night')).toBeGreaterThan(out('midday') * 2)
    for (const p of beaches) if (life(p).crab === 'hermit') expect(p.biome.name).toBe('tropical')
    for (const ocean of ['southern', 'arctic'] as const) {
      for (const biome of ['nordic', 'volcanic', 'tropical'] as const) {
        for (const p of scenes({ coast: 'beach', biome, ocean }, 10)) expect(life(p).crab).toBeNull()
      }
    }
  })

  it('blooms only where and when each flower does', () => {
    let seen = 0
    for (const p of beaches) {
      const month = Number(p.date.slice(5, 7))
      for (const kind of life(p).flowers) {
        seen++
        const where = FLOWERS[kind]
        expect(where.biomes).toContain(p.biome.name)
        expect(p.sea.ocean).not.toBe('southern')
        if (where.months != null) {
          expect(month).toBeGreaterThanOrEqual(where.months[0])
          expect(month).toBeLessThanOrEqual(where.months[1])
        }
      }
    }
    expect(seen).toBeGreaterThan(100)
    // Nothing in bloom on a northern beach in January; thrift in June.
    const january = DAYS.filter(d => d.slice(5, 7) === '01')
    for (const date of january) expect(life(scene({ coast: 'beach', biome: 'nordic', ocean: 'atlantic' }, date)).flowers).toEqual([])
    const june = DAYS.filter(d => d.slice(5, 7) === '06')
    const thrift = june.filter(date => life(scene({ coast: 'beach', biome: 'nordic', ocean: 'atlantic' }, date)).flowers.includes('thrift'))
    expect(thrift.length / june.length).toBeGreaterThan(0.5)
  })

  it('washes up the shells of that coast', () => {
    for (const p of beaches) {
      const { shells } = life(p)
      expect(shells.length).toBeGreaterThan(0)
      if (shells.includes('sand-dollar')) expect(p.sea.ocean).toBe('pacific')
    }
    for (const p of scenes({ coast: 'beach', biome: 'volcanic', ocean: 'southern' })) expect(life(p).shells).toEqual(['mussel'])
  })

  it('builds small, finite meshes standing on the ground', () => {
    const sand: [number, number, number] = [0.46, 0.36, 0.23]
    const geometries = [
      ...(['clam', 'cockle', 'scallop', 'mussel', 'razor', 'sand-dollar'] as const).map(k => shellGeometry(new Random(k), k)),
      starfishGeometry(new Random('star')),
      ...(['ghost', 'shore', 'hermit'] as const).map(k => crabGeometry(new Random(k), k, sand)),
      burrowGeometry(new Random('burrow'), sand),
      ...(Object.keys(FLOWERS) as FlowerKind[]).map(k => flowerGeometry(new Random(k), k))
    ]
    for (const g of geometries) {
      const pos = g.attributes.position.array as Float32Array
      const normals = g.attributes.normal.array as Float32Array
      for (let i = 0; i < pos.length; i++) expect(Number.isFinite(pos[i]) && Number.isFinite(normals[i])).toBe(true)
      g.computeBoundingBox()
      expect(g.boundingBox!.min.y).toBeGreaterThan(-0.05)
      expect(g.boundingBox!.max.y).toBeLessThan(0.6)
      expect(g.index!.count / 3).toBeLessThan(30_000)
    }
  })
})
