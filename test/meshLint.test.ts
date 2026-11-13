import type { BufferGeometry } from 'three'
import { describe, expect, it } from 'vitest'

import { gull, restingGull } from '../src/props/birds'
import { penguin } from '../src/props/colony'
import { marineGeometry } from '../src/props/marine'
import { migratoryGeometry } from '../src/props/migratory'
import { pinniped, swimmingHead } from '../src/props/pinnipeds'
import { crabGeometry, starfishGeometry } from '../src/props/shoreLife'
import { crocodileGeometry, hippoGeometry, lizardGeometry, monkeyGeometry, turtleGeometry } from '../src/props/wildlife'
import { Random } from '../src/random'
import { looseParts, openHoles } from './meshLint'

// Every animal in one piece and closed where you can see (test/meshLint.ts):
// no part floating free of the body, no open tube end you could look into.
// Each found a real defect when added (0.165): seals' front flippers, iguana
// crests, turtles' rear flippers, a walking monkey's head, the hippo's tail
// root, whale and dolphin snouts, a capuchin's tail tip, starfish arm tips.

const SAND: [number, number, number] = [0.6, 0.5, 0.4]
const animals: [string, (seed: string) => BufferGeometry][] = [
  ...(['seal', 'sea-lion', 'fur-seal', 'elephant-seal'] as const).flatMap(k =>
    (['lying', 'banana', 'sitting'] as const).map((pose): [string, (seed: string) => BufferGeometry] => [`${k} ${pose}`, s => pinniped(new Random(s), k, pose, 0)])
  ),
  ...(['seal', 'elephant-seal'] as const).map((k): [string, (seed: string) => BufferGeometry] => [`${k} head`, s => swimmingHead(new Random(s), k, 0.3)]),
  ['crocodile agape', s => crocodileGeometry(new Random(s), 'nile', 0.4)],
  ['crocodile shut', s => crocodileGeometry(new Random(s), 'saltwater', 0.03)],
  ...(['marine-iguana', 'green-iguana', 'monitor', 'spiny-tailed'] as const).map((k): [string, (seed: string) => BufferGeometry] => [k, s => lizardGeometry(new Random(s), k)]),
  ...(['green', 'hawksbill', 'leatherback'] as const).flatMap(k =>
    (['adult', 'nesting', 'hatchling'] as const).map((f): [string, (seed: string) => BufferGeometry] => [`${k} turtle ${f}`, s => turtleGeometry(new Random(s), k, SAND, f)])
  ),
  ['hippo', s => hippoGeometry(new Random(s), 0)],
  ...(['macaque', 'capuchin', 'vervet'] as const).flatMap(k =>
    (['walk', 'sit'] as const).map((pose): [string, (seed: string) => BufferGeometry] => [`${k} ${pose}`, s => monkeyGeometry(new Random(s), k, pose)])
  ),
  ...(['dolphin', 'orca', 'humpback', 'swordfish'] as const).map((k): [string, (seed: string) => BufferGeometry] => [k, s => marineGeometry(new Random(s), k)]),
  ['gull', () => gull(0.3, 0.2, false)],
  ['resting gull', () => restingGull(false)],
  ['penguin', () => penguin()],
  ...(['goose', 'duck', 'flamingo'] as const).map((k): [string, (seed: string) => BufferGeometry] => [k, () => migratoryGeometry(k, false)]),
  ['flamingo wading', () => migratoryGeometry('flamingo', true)],
  ...(['ghost', 'shore', 'hermit'] as const).map((k): [string, (seed: string) => BufferGeometry] => [`${k} crab`, s => crabGeometry(new Random(s), k, SAND)]),
  ['starfish', s => starfishGeometry(new Random(s))]
]

describe('animal meshes in one piece', () => {
  it.each(animals)('%s', (_name, build) => {
    for (const seed of ['a', 'b']) {
      const g = build(seed)
      const where = (vs: { x: number; y: number; z: number }[]): string => vs.map(v => `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`).join(' ')
      expect(where(looseParts(g)), `loose parts (${seed})`).toBe('')
      expect(where(openHoles(g)), `open holes (${seed})`).toBe('')
    }
  })
})
