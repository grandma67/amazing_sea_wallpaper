import { describe, expect, it } from 'vitest'

import { branchGeometry, debrisFor, logGeometry } from '../src/props/debris'
import { Random } from '../src/random'
import { allParams, share } from './days'

describe('shore debris', () => {
  const days = allParams()
  const beaches = days.filter(p => p.coast.type === 'beach')
  const spec = (p: (typeof days)[number]) => debrisFor(p, Random.derive(p.seed, 'props/debris'))

  it('only washes up on a beach', () => {
    for (const p of days) if (p.coast.type !== 'beach') expect(spec(p)).toBeNull()
  })

  it('brings driftwood to forested and Arctic coasts, none to the Southern Ocean', () => {
    const wood = (test: (p: (typeof days)[number]) => boolean): number =>
      share(beaches.filter(test), p => spec(p)!.driftwood > 0)
    expect(wood(p => p.sea.ocean === 'arctic')).toBeGreaterThan(0.7)
    expect(wood(p => p.biome.name === 'nordic')).toBeGreaterThan(wood(p => p.biome.name === 'mediterranean'))
    expect(wood(p => p.biome.name === 'desert')).toBeLessThan(0.2)
    for (const p of beaches) if (p.sea.ocean === 'southern') expect(spec(p)!.driftwood).toBe(0)
  })

  it('matches the wrack to the coast', () => {
    for (const p of beaches) {
      const { wrack, coconuts } = spec(p)!
      if (wrack === 'sargassum') expect(`${p.biome.name}/${p.sea.ocean}`).toBe('tropical/atlantic')
      if (wrack === 'kelp') expect(['nordic', 'volcanic', 'desert']).toContain(p.biome.name)
      if (coconuts > 0) expect(p.biome.name).toBe('tropical')
    }
    expect(share(beaches.filter(p => p.biome.name === 'mediterranean'), p => spec(p)!.wrack === 'seagrass')).toBeGreaterThan(0.5)
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
