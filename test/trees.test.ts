import { describe, expect, it } from 'vitest'

import type { RGB } from '../src/biome'
import * as trees from '../src/props/trees'
import { Random } from '../src/random'

const foliage: RGB = [0.1, 0.18, 0.05]
const species = ['broadleaf', 'olive', 'birch', 'acacia', 'stonePine', 'bush', 'cypress', 'conifer', 'pandanus'] as const

describe('tree meshes', () => {
  for (const name of species) {
    it(`${name}: deterministic, finite, standing on the ground, within budget`, () => {
      const a = trees[name](new Random(`tree-${name}`), foliage)
      const b = trees[name](new Random(`tree-${name}`), foliage)
      const pos = a.attributes.position.array as Float32Array
      expect(pos).toEqual(b.attributes.position.array)
      const normals = a.attributes.normal.array as Float32Array
      for (let i = 0; i < pos.length; i++) expect(Number.isFinite(pos[i]) && Number.isFinite(normals[i])).toBe(true)
      const index = a.index!.array
      for (let i = 0; i < index.length; i++) expect(index[i]).toBeLessThan(pos.length / 3)
      a.computeBoundingBox()
      const box = a.boundingBox!
      expect(box.min.y).toBeGreaterThan(-0.5)
      expect(box.max.y).toBeGreaterThan(0.5)
      // Every tree is instanced hundreds of times: keep it under ~100k triangles.
      expect(index.length / 3).toBeLessThan(100_000)
    })
  }
})
