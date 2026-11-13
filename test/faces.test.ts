import type { BufferAttribute, BufferGeometry } from 'three'
import { describe, expect, it } from 'vitest'

import { gull, restingGull } from '../src/props/birds'
import { marineGeometry } from '../src/props/marine'
import { migratoryGeometry } from '../src/props/migratory'
import { pinniped, swimmingHead } from '../src/props/pinnipeds'
import { crabGeometry } from '../src/props/shoreLife'
import { crocodileGeometry, hippoGeometry, lizardGeometry, monkeyGeometry, turtleGeometry } from '../src/props/wildlife'
import { Random } from '../src/random'

/** Vertices coloured as a pupil or nostril (near black). */
function darkVertices(g: BufferGeometry): number {
  const c = g.getAttribute('color') as BufferAttribute
  let n = 0
  for (let i = 0; i < c.count; i++) if (c.getX(i) < 0.016 && c.getY(i) < 0.016 && c.getZ(i) < 0.016) n++
  return n
}

describe('faces', () => {
  const animals: [string, () => BufferGeometry][] = [
    ...(['seal', 'sea-lion', 'fur-seal', 'elephant-seal'] as const).map((k): [string, () => BufferGeometry] => [k, () => pinniped(new Random('f'), k, 'lying', 0)]),
    ['seal head', () => swimmingHead(new Random('f'), 'seal', 0.2)],
    ['crocodile', () => crocodileGeometry(new Random('f'), 'nile', 0.3)],
    ...(['marine-iguana', 'green-iguana', 'monitor', 'spiny-tailed'] as const).map((k): [string, () => BufferGeometry] => [k, () => lizardGeometry(new Random('f'), k)]),
    ['turtle', () => turtleGeometry(new Random('f'), 'green', [0.6, 0.55, 0.45], 'adult')],
    ['hippo', () => hippoGeometry(new Random('f'), 0)],
    ['macaque', () => monkeyGeometry(new Random('f'), 'macaque', 'sit')],
    ...(['dolphin', 'orca', 'humpback', 'swordfish'] as const).map((k): [string, () => BufferGeometry] => [k, () => marineGeometry(new Random('f'), k)]),
    ['gull', () => gull(0.3, 0.2, false)],
    ['resting gull', () => restingGull(false)],
    ...(['goose', 'duck'] as const).map((k): [string, () => BufferGeometry] => [k, () => migratoryGeometry(k, false)]),
    ['flamingo', () => migratoryGeometry('flamingo', true)],
    ['shore crab', () => crabGeometry(new Random('f'), 'shore', [0.7, 0.65, 0.55])]
  ]
  it.each(animals)('%s has pupils (and nostrils)', (_name, build) => {
    expect(darkVertices(build())).toBeGreaterThanOrEqual(4) // two pupils at least
  })

  it('give seals whiskers out past the muzzle', () => {
    for (const kind of ['seal', 'sea-lion', 'fur-seal', 'elephant-seal'] as const) {
      const g = swimmingHead(new Random('w'), kind, 0)
      g.computeBoundingBox()
      expect(g.boundingBox!.max.z - g.boundingBox!.min.z, kind).toBeGreaterThan(0.25)
    }
  })

  it('spread gull and goose tails into a fan, wider at the end than the root', () => {
    for (const g of [gull(0.3, 0.2, false), migratoryGeometry('goose', false)]) {
      const p = g.getAttribute('position') as BufferAttribute
      let back = Infinity
      for (let i = 0; i < p.count; i++) back = Math.min(back, p.getX(i))
      // Vertices within 2 cm of the tail's end span more than a few cm.
      let lo = Infinity
      let hi = -Infinity
      for (let i = 0; i < p.count; i++) {
        if (p.getX(i) < back + 0.02) {
          lo = Math.min(lo, p.getZ(i))
          hi = Math.max(hi, p.getZ(i))
        }
      }
      expect(hi - lo).toBeGreaterThan(0.05)
    }
  })
})
