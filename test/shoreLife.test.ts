import { describe, expect, it } from 'vitest'

import { burrowGeometry, crabGeometry, FLOWERS, flowerGeometry, shellGeometry, shoreLifeFor, starfishGeometry, type FlowerKind } from '../src/props/shoreLife'
import { Random } from '../src/random'
import { allParams } from './days'

describe('shore life', () => {
  const days = allParams()
  const beaches = days.filter(p => p.coast.type === 'beach')
  const life = (p: (typeof days)[number]) => shoreLifeFor(p, Random.derive(p.seed, 'props/shore-life'))!

  it('only lives on a beach', () => {
    for (const p of days) if (p.coast.type !== 'beach') expect(shoreLifeFor(p, new Random(p.seed))).toBeNull()
  })

  it('puts ghost crabs on warm sand, out mostly at dusk and night', () => {
    const ghost = beaches.filter(p => life(p).crab === 'ghost')
    expect(ghost.length).toBeGreaterThan(50)
    for (const p of ghost) expect(['tropical', 'desert', 'mediterranean']).toContain(p.biome.name)
    const out = (test: (p: (typeof days)[number]) => boolean): number => {
      const some = ghost.filter(test)
      return some.reduce((sum, p) => sum + life(p).crabs, 0) / some.length
    }
    expect(out(p => p.timeOfDay === 'night')).toBeGreaterThan(out(p => p.timeOfDay === 'midday') * 2)
    for (const p of beaches) {
      const { crab } = life(p)
      if (crab === 'hermit') expect(p.biome.name).toBe('tropical')
      if (p.sea.ocean === 'southern' || p.sea.ocean === 'arctic') expect(crab).toBeNull()
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
    // Nothing in bloom on a northern beach in January.
    for (const p of beaches) if (p.biome.name === 'nordic' && p.date.slice(5, 7) === '01') expect(life(p).flowers).toEqual([])
  })

  it('washes up the shells of that coast', () => {
    for (const p of beaches) {
      const { shells } = life(p)
      expect(shells.length).toBeGreaterThan(0)
      if (shells.includes('sand-dollar')) expect(p.sea.ocean).toBe('pacific')
      if (p.sea.ocean === 'southern') expect(shells).toEqual(['mussel'])
    }
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
