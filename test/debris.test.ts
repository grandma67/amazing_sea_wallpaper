import { describe, expect, it } from 'vitest'

import { branchGeometry, debrisFor, logGeometry } from '../src/props/debris'
import { Random } from '../src/random'
import { allParams, scenes, share } from './days'

describe('shore debris', () => {
  const days = allParams()
  const beaches = days.filter(p => p.coast.type === 'beach')
  const spec = (p: (typeof days)[number]) => debrisFor(p, Random.derive(p.seed, 'props/debris'))

  it('only washes up on a beach', () => {
    for (const p of scenes({ coast: 'open-sea' })) expect(spec(p)).toBeNull()
  })

  it('brings driftwood to forested and Arctic coasts, none to the Southern Ocean', () => {
    const wood = (biome: 'nordic' | 'mediterranean' | 'desert', ocean?: 'arctic'): number =>
      share(scenes({ coast: 'beach', biome, ocean }, 60), p => spec(p)!.driftwood > 0)
    expect(wood('nordic', 'arctic')).toBeGreaterThan(0.7)
    expect(wood('nordic')).toBeGreaterThan(wood('mediterranean'))
    expect(wood('desert')).toBeLessThan(0.2)
    for (const biome of ['nordic', 'volcanic'] as const) {
      for (const p of scenes({ coast: 'beach', biome, ocean: 'southern' })) expect(spec(p)!.driftwood).toBe(0)
    }
  })

  it('matches the wrack to the coast', () => {
    for (const p of beaches) {
      const { wrack, coconuts } = spec(p)!
      if (wrack === 'sargassum') expect(`${p.biome.name}/${p.sea.ocean}`).toBe('tropical/atlantic')
      if (wrack === 'kelp') expect(['nordic', 'volcanic', 'desert']).toContain(p.biome.name)
      if (coconuts > 0) expect(p.biome.name).toBe('tropical')
    }
    expect(share(scenes({ coast: 'beach', biome: 'mediterranean' }, 60), p => spec(p)!.wrack === 'seagrass')).toBeGreaterThan(0.5)
  })

  it('builds finite logs and branches lying on the ground', () => {
    for (let i = 0; i < 6; i++) {
      for (const g of [logGeometry(new Random(`log-${i}`), i % 2 === 0), branchGeometry(new Random(`branch-${i}`))]) {
        const pos = g.attributes.position.array as Float32Array
        const normals = g.attributes.normal.array as Float32Array
        for (let k = 0; k < pos.length; k++) expect(Number.isFinite(pos[k]) && Number.isFinite(normals[k])).toBe(true)
        g.computeBoundingBox()
        const box = g.boundingBox!
        // The trunk lies on y = 0; a flared butt and flattened roots sink into the sand a little.
        expect(box.min.y).toBeGreaterThan(-0.6)
        expect(box.max.y).toBeLessThan(3)
        expect(g.index!.count / 3).toBeLessThan(20_000)
      }
    }
  })

  it('is deterministic', () => {
    const a = logGeometry(new Random('same'), true).attributes.position.array
    const b = logGeometry(new Random('same'), true).attributes.position.array
    expect(a).toEqual(b)
  })
})
