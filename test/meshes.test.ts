import { Vector3, type BufferAttribute, type BufferGeometry } from 'three'
import { describe, expect, it } from 'vitest'

import type { Climate, RGB } from '../src/biome'
import { bloomFor, phenologyFor, plantSeason, withBlossom } from '../src/phenology'
import { slabGeometry as beachrockSlab } from '../src/props/beachrock'
import { restingGull } from '../src/props/birds'
import { branchGeometry, logGeometry } from '../src/props/debris'
import { cakeGeometry } from '../src/props/iceFoot'
import { fallenLeafGeometry } from '../src/props/leafLitter'
import { pinniped, swimmingHead } from '../src/props/pinnipeds'
import { glasswortGeometry, grassTuftGeometry } from '../src/props/saltMarsh'
import { lumpGeometry, slabGeometry as iceSlab } from '../src/props/seaIce'
import { dinghy, expeditionShip, icebreaker } from '../src/props/ships'
import { burrowGeometry, crabGeometry, FLOWERS, flowerGeometry, shellGeometry, starfishGeometry, type FlowerKind } from '../src/props/shoreLife'
import { stoneGeometry } from '../src/props/stones'
import * as trees from '../src/props/trees'
import { crocodileGeometry, hippoGeometry, lizardGeometry, monkeyGeometry, turtleGeometry, type CrocodileKind, type LizardKind, type MonkeyKind, type TurtleSpecies } from '../src/props/wildlife'
import { rockGeometry } from '../src/props/rocks'
import { unitSphere } from '../src/props/sphere'
import { Random } from '../src/random'
import { expectMesh, type MeshRules } from './mesh'

// Every small mesh a prop instances, against its real size and budget. Add a
// new mesh here (CLAUDE.md "A new mesh, in this order"). Meshes built from a
// scene's params stay beside their feature (waterspout, cloud events, towers).

type Build = (seed: string) => BufferGeometry
type Row = [name: string, build: Build]
const FOLIAGE: RGB = [0.1, 0.18, 0.05]
const SAND: RGB = [0.46, 0.36, 0.23]
const WARM: RGB = [0.1, 0.2, 0.05]
const INF = Infinity

/** Each row of a family keeps the family's rules. */
function family(name: string, rules: MeshRules, rows: Row[]): void {
  describe(name, () => {
    it.each(rows)('%s', (_, build) => expectMesh(build, rules))
  })
}

// Instanced by the dozen; each on its own copy of the welded sphere.
family('rocks', { base: [-0.8, -0.2], top: [0.7, 1.3], width: 2.6, length: 2.6, minTriangles: 19_000, maxTriangles: 20_000, maxVertices: 10_000, solid: true }, [
  ['boulder', seed => rockGeometry(new Random(seed), false)],
  ['sea stack', seed => rockGeometry(new Random(seed), true)]
])

describe('unitSphere', () => {
  it('is welded, on the unit sphere, and a copy each time', () => {
    const a = unitSphere(6)
    expect(a.attributes.position.count).toBeLessThan(a.index!.count / 3)
    expect(new Vector3().fromBufferAttribute(a.attributes.position as BufferAttribute, 5).length()).toBeCloseTo(1, 5)
    const [x] = a.attributes.position.array
    a.attributes.position.setX(0, x + 1)
    a.index!.setX(0, 1)
    const b = unitSphere(6)
    expect(b.attributes.position.array[0]).toBe(x)
    expect(b.index!.getX(0)).not.toBe(1)
  })
})

const TREES = ['broadleaf', 'olive', 'birch', 'acacia', 'stonePine', 'bush', 'cypress', 'conifer', 'pandanus'] as const
// Every tree is instanced hundreds of times.
family(
  'trees',
  { base: [-0.5, INF], top: [0.5, INF], maxTriangles: 100_000 },
  TREES.map((name): Row => [name, seed => trees[name](new Random(seed), FOLIAGE)])
)

/** Out of leaf: bare twigs in winter, turned leaves in autumn. */
const inSeason = (date: string, climate: Climate = 'temperate') => plantSeason('birch', phenologyFor({ date, latitudeDeg: 50, place: { id: 'x', climate } }))
family(
  'trees out of leaf',
  { maxTriangles: 100_000 },
  (['broadleaf', 'birch', 'bush'] as const).flatMap(name => [
    [`${name}, bare`, seed => trees[name](new Random(seed), FOLIAGE, inSeason('2025-01-15'))],
    [`${name}, autumn`, seed => trees[name](new Random(seed), FOLIAGE, inSeason('2025-11-20'))],
    [`${name}, new leaves`, seed => trees[name](new Random(seed), FOLIAGE, inSeason('2025-05-01'))],
    [`${name}, a polar autumn`, seed => trees[name](new Random(seed), FOLIAGE, inSeason('2025-09-05', 'polar'))]
  ] satisfies Row[])
)

/** In flower (phenology.ts BLOOM): a forced row's flowering twin. */
const inFlower = (plant: 'bush' | 'broadleaf', kind: 'rock-rose' | 'gorse' | 'wattle' | 'flamboyant' | 'pohutukawa') => {
  const phen = phenologyFor({ date: '2025-06-01', latitudeDeg: 18, place: { id: 'india', climate: 'tropical' }, overrides: { bloom: [kind] } })
  const b = bloomFor(plant, phen)[0]
  return withBlossom(plantSeason(plant, phen)!, kind === 'flamboyant' ? { ...b, on: 0.4 } : b, 0)
}
family(
  'plants in flower',
  { base: [-0.5, INF], top: [0.5, INF], maxTriangles: 100_000 },
  [
    ...(['rock-rose', 'gorse', 'wattle'] as const).map((kind): Row => [kind, seed => trees.bush(new Random(seed), FOLIAGE, inFlower('bush', kind))]),
    ...(['flamboyant', 'pohutukawa'] as const).map((kind): Row => [kind, seed => trees.broadleaf(new Random(seed), FOLIAGE, inFlower('broadleaf', kind))])
  ]
)

// About 100k at most: 1 seed in 60 runs up to 109k (either kind, 60 seeds).
family('mangroves, rooted at the mud', { base: [-0.5, 0.05], maxTriangles: 120_000 }, [
  ['rhizophora', seed => trees.rhizophora(new Random(seed), WARM)],
  ['avicennia', seed => trees.avicennia(new Random(seed), WARM)]
])

// A trunk lies on y = 0; a flared butt and flattened roots sink in a little.
family('driftwood', { base: [-0.6, INF], top: [-INF, 3], maxTriangles: 20_000 }, [
  ['log with roots', seed => logGeometry(new Random(seed), true)],
  ['log', seed => logGeometry(new Random(seed), false)],
  ['branch', seed => branchGeometry(new Random(seed))]
])

family('shore life, small on the ground', { base: [-0.05, INF], top: [-INF, 0.6], maxTriangles: 30_000 }, [
  ...(['clam', 'cockle', 'scallop', 'mussel', 'razor', 'sand-dollar'] as const).map((kind): Row => [kind, seed => shellGeometry(new Random(seed), kind)]),
  ['starfish', seed => starfishGeometry(new Random(seed))],
  ...(['ghost', 'shore', 'hermit'] as const).map((kind): Row => [`${kind} crab`, seed => crabGeometry(new Random(seed), kind, SAND)]),
  ['burrow', seed => burrowGeometry(new Random(seed), SAND)],
  ...(Object.keys(FLOWERS) as FlowerKind[]).map((kind): Row => [kind, seed => flowerGeometry(new Random(seed), kind)])
])

family('animals standing on the ground', { base: [-0.15, 0.05], maxVertices: 50_000 }, [
  ...(['green', 'loggerhead', 'leatherback', 'hawksbill', 'olive-ridley'] as TurtleSpecies[]).flatMap((s): Row[] => [
    [`${s} turtle`, seed => turtleGeometry(new Random(seed), s, SAND, 'adult')],
    [`${s} hatchling`, seed => turtleGeometry(new Random(seed), s, SAND, 'hatchling')]
  ]),
  ...(['macaque', 'capuchin', 'vervet'] as MonkeyKind[]).flatMap((k): Row[] => [
    [`${k} walking`, seed => monkeyGeometry(new Random(seed), k, 'walk')],
    [`${k} sitting`, seed => monkeyGeometry(new Random(seed), k, 'sit')]
  ]),
  ...(['marine-iguana', 'green-iguana', 'monitor', 'spiny-tailed'] as LizardKind[]).map((k): Row => [k, seed => lizardGeometry(new Random(seed), k)]),
  ...(['saltwater', 'american', 'nile', 'west-african'] as CrocodileKind[]).flatMap((k): Row[] => [
    [`${k} crocodile, wet`, seed => crocodileGeometry(new Random(seed), k, 0.4)],
    [`${k} crocodile, dry`, seed => crocodileGeometry(new Random(seed), k, 0.03)]
  ]),
  ['hippo, dry', seed => hippoGeometry(new Random(seed), 0)],
  ['hippo, wet', seed => hippoGeometry(new Random(seed), 1)],
  ['resting gull', () => restingGull(false)]
])

// The sand she throws up sinks into the beach, no deeper.
family('a nesting turtle', { base: [-0.3, INF], top: [-INF, 0.6] }, [['leatherback', seed => turtleGeometry(new Random(seed), 'leatherback', SAND, 'nesting')]])

family('boats floating at the waterline', { base: [-INF, 0], top: [0, INF], maxVertices: 100_000 }, [
  ['dinghy', seed => dinghy(new Random(seed))],
  ['expedition ship', seed => expeditionShip(new Random(seed))],
  ['icebreaker', seed => icebreaker(new Random(seed))]
])

family('mesh stones, small, resting on y = 0', { base: [-5e-7, 5e-7], top: [0.02, INF], width: 0.15, minTriangles: 50, maxTriangles: 150 }, [
  ['rounded', seed => stoneGeometry(new Random(seed), 0.1, false)],
  ['faceted', seed => stoneGeometry(new Random(seed), 0.1, true)]
])

family(
  'fallen leaves, lying on y = 0',
  { base: [0, INF], top: [-INF, 0.3], minTriangles: 8, maxTriangles: 8 },
  [0, 1, 2, 3].map((v): Row => [`variant ${v}`, () => fallenLeafGeometry(v)])
)

family('salt-marsh tufts, on y = 0', { base: [-5e-6, 5e-6], top: [0.05, 0.45], maxTriangles: 200 }, [
  ['grass', seed => grassTuftGeometry(Random.derive(seed, 'mesh'))],
  ['glasswort', seed => glasswortGeometry(Random.derive(seed, 'mesh'))]
])

describe('sea ice rubble', () => {
  it.each<[string, Build, number]>([
    ['near slab', seed => iceSlab(new Random(seed)), 100],
    ['far slab, cheaper', seed => iceSlab(new Random(seed), false), 50],
    ['lump', seed => lumpGeometry(new Random(seed)), 320]
  ])('%s', (_, build, maxTriangles) => expectMesh(build, { base: [-0.15, 0.15], maxTriangles }))
})

family('beachrock slab, tiny', { base: [-0.005, 0.005], maxTriangles: 30 }, [['slab', seed => beachrockSlab(new Random(seed))]])

family('ice foot cake', { base: [-0.2, INF], maxVertices: 3000 }, [['cake', () => cakeGeometry(1)]])

// Head-sized: a few tens of cm above the water, the neck going under; not inside
// out. An elephant seal's head is the longest, up to 52 cm over 60 seeds.
describe('seals', () => {
  const kinds = ['seal', 'sea-lion', 'fur-seal', 'elephant-seal'] as const
  describe.each(kinds)('%s', kind => {
    it.each([0, 0.7])('swimming head, pitch %s', pitch => expectMesh(seed => swimmingHead(new Random(seed), kind, pitch), { solid: true, base: [-INF, -0.05], top: [0.1, 0.6], length: 0.55 }))
    it('lying', () => expectMesh(seed => pinniped(new Random(seed), kind, 'lying', 0), { solid: true }))
  })
})
