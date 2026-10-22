import { describe, expect, it } from 'vitest'
import type { BufferGeometry } from 'three'

import { pinniped, swimmingHead } from '../src/props/pinnipeds'
import { Random } from '../src/random'

const kinds = ['seal', 'sea-lion', 'fur-seal', 'elephant-seal'] as const

/** Signed volume: positive when the triangles face outward. */
function signedVolume(g: BufferGeometry): number {
  const p = g.attributes.position.array
  const index = g.index?.array ?? Array.from({ length: p.length / 3 }, (_, i) => i)
  let v = 0
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = [index[i] * 3, index[i + 1] * 3, index[i + 2] * 3]
    v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])
  }
  return v / 6
}

function bounds(g: BufferGeometry): { min: number[]; max: number[] } {
  g.computeBoundingBox()
  const { min, max } = g.boundingBox!
  return { min: [min.x, min.y, min.z], max: [max.x, max.y, max.z] }
}

describe('swimming seal heads', () => {
  it('face outward (not inside out), and are deterministic and finite', () => {
    for (const kind of kinds) {
      for (const pitch of [0, 0.7]) {
        const g = swimmingHead(new Random('head'), kind, pitch)
        expect(Array.from(g.attributes.position.array).every(Number.isFinite)).toBe(true)
        expect(g.attributes.position.array).toEqual(swimmingHead(new Random('head'), kind, pitch).attributes.position.array)
        expect(signedVolume(g)).toBeGreaterThan(0)
        expect(signedVolume(pinniped(new Random('head'), kind, 'lying', 0))).toBeGreaterThan(0)
      }
    }
  })

  it('is head-sized: a few tens of cm above the water, the neck going under', () => {
    for (const kind of kinds) {
      const { min, max } = bounds(swimmingHead(new Random('size'), kind, 0))
      expect(min[1]).toBeLessThan(-0.05)
      expect(max[1]).toBeGreaterThan(0.1)
      expect(max[1]).toBeLessThan(0.6)
      expect(max[2] - min[2]).toBeLessThan(0.5)
    }
  })
})
