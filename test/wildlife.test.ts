import { describe, expect, it } from 'vitest'

import { Random } from '../src/random'
import { restingGull } from '../src/props/birds'
import { shoreLifeFor } from '../src/props/shoreLife'
import {
  crocodileGeometry,
  hippoGeometry,
  inWater,
  lizardGeometry,
  monkeyGeometry,
  nestingSpecies,
  trackGeometry,
  turtleGeometry,
  wildlifeFor,
  type CrocodileKind,
  type LizardKind,
  type MonkeyKind,
  type TurtleSpecies
} from '../src/props/wildlife'
import { placeNamed } from '../src/places'
import { allParams, scenes, share } from './days'

describe('beach wildlife', () => {
  const days = allParams()
  const life = (p: (typeof days)[number]) => wildlifeFor(p, Random.derive(p.seed, 'props/wildlife'))
  const month = (p: (typeof days)[number]) => Number(p.date.slice(5, 7))

  it('nests each species in its season', () => {
    const pool = (id: string) => placeNamed(id).animals
    expect(nestingSpecies(pool('aegean'), 7, 0)).toBe('loggerhead')
    expect(nestingSpecies(pool('aegean'), 1, 0)).toBeNull()
    expect(nestingSpecies(pool('antilles'), 4, 0)).toBe('leatherback')
    expect(nestingSpecies(pool('antilles'), 12, 0)).toBeNull()
    expect(nestingSpecies(pool('central-america'), 9, 0)).toBe('olive-ridley')
    expect(nestingSpecies(pool('galapagos'), 2, 0)).toBe('green')
    expect(nestingSpecies(pool('norway-west'), 7, 0)).toBeNull()
  })

  it('keeps animals to warm coasts and their hours', () => {
    for (const p of days) {
      const l = life(p)
      if (l == null) {
        expect(p.coast.type).toBe('open-sea')
        continue
      }
      const dark = p.timeOfDay === 'night' || p.timeOfDay === 'blue-hour'
      if (l.monkey != null || l.lizard != null || l.basking > 0) expect(dark).toBe(false)
      if (l.nesting) expect(dark).toBe(true)
      if (l.turtle != null) expect(['tropical', 'mediterranean', 'volcanic', 'desert']).toContain(p.biome.name)
      // Loggerheads nest in summer: Jun–Aug in the Mediterranean, May–Aug in
      // Florida, Sep–Mar in Brazil, Nov–Mar in Western Australia (hatchlings
      // two months on).
      if (l.turtle === 'loggerhead') {
        const south = p.place.hemisphere === 'south'
        expect(south ? [9, 10, 11, 12, 1, 2, 3, 4, 5] : [5, 6, 7, 8, 9, 10]).toContain(month(p))
      }
      if (l.monkey != null) expect(p.biome.name).toBe('tropical')
      if (l.lizard === 'marine-iguana') expect(p.biome.name).toBe('volcanic')
      if (['nordic'].includes(p.biome.name)) expect(l.turtle ?? l.monkey ?? l.lizard).toBeNull()
    }
  })

  it('shows something on a fair share of tropical beach days, and not every day', () => {
    const tropical = days.filter(p => p.coast.type === 'beach' && p.biome.name === 'tropical')
    const any = share(tropical, p => {
      const l = life(p)!
      return l.turtle != null || l.monkey != null || l.lizard != null
    })
    expect(any).toBeGreaterThan(0.2)
    expect(any).toBeLessThan(0.8)
  })

  it('keeps crocodiles and hippos to their coasts and hours', () => {
    let crocs = 0
    let hippos = 0
    for (const p of days) {
      const l = life(p)
      if (l == null) continue
      if (l.region === 'west-africa') expect([p.biome.name, p.sea.ocean]).toEqual(['tropical', 'atlantic'])
      if (l.crocodile != null) {
        crocs++
        expect(p.biome.name).toBe('tropical')
        expect(p.timeOfDay === 'night' || p.timeOfDay === 'blue-hour').toBe(false)
        if (l.crocodile === 'saltwater') expect(['se-asia', 'pacific-islands', 'india', 'north-australia', 'nw-australia', 'south-asia-islands']).toContain(l.region)
        if (l.crocodile === 'american') expect(['central-america', 'caribbean']).toContain(l.region)
      }
      if (l.hippos > 0) {
        hippos++
        expect(['west-africa', 'east-africa']).toContain(l.region)
      }
      if (l.region === 'west-africa' && l.turtle != null && l.turtle !== 'green') expect([10, 11, 12, 1, 2, 3]).toContain(month(p))
    }
    // Rare: a handful over three years.
    expect(crocs).toBeGreaterThan(3)
    expect(crocs).toBeLessThan(60)
    expect(hippos).toBeGreaterThan(0)
    expect(hippos).toBeLessThan(25)
  })

  it('puts hippos in the water by day and on the beach from dusk, both in the water in storms', () => {
    const at = (spec: Parameters<typeof scenes>[0]) => scenes({ coast: 'beach', eclipse: null, ...spec }, 3)
    for (const p of at({ timeOfDay: 'midday', storm: null })) {
      expect(inWater(p, 'hippo')).toBe(true)
      expect(inWater(p, 'crocodile')).toBe(false)
    }
    for (const p of at({ timeOfDay: 'night', storm: null })) expect(inWater(p, 'hippo')).toBe(false)
    for (const p of at({ timeOfDay: 'daylight', storm: 'squall' })) {
      expect(inWater(p, 'hippo')).toBe(true)
      expect(inWater(p, 'crocodile')).toBe(true)
    }
  })

  it('sends monkeys, lizards, basking turtles and crabs under cover in a storm', () => {
    for (const p of scenes({ coast: 'beach', biome: 'tropical', timeOfDay: 'daylight', storm: 'squall', eclipse: null }, 30)) {
      const l = life(p)!
      expect(l.monkeys + l.lizards + l.basking).toBe(0)
      expect(shoreLifeFor(p, Random.derive(p.seed, 'props/shore-life'))?.crabs ?? 0).toBe(0)
    }
  })

  it('can be forced and removed', () => {
    for (const p of scenes({ coast: 'beach', biome: 'tropical', props: { wildlife: { monkey: 'capuchin' } } }, 10)) {
      expect(life(p)!.monkey).toBe('capuchin')
      expect(life(p)!.monkeys).toBeGreaterThan(0)
    }
    for (const p of scenes({ coast: 'beach', biome: 'tropical', props: { wildlife: { crocodile: 'nile' } } }, 10)) expect(life(p)!.crocodiles).toBeGreaterThan(0)
    for (const p of scenes({ coast: 'beach', biome: 'tropical', props: { wildlife: null } }, 10)) expect(life(p)).toBeNull()
  })

  it('builds finite animals standing on the ground', () => {
    const sand: [number, number, number] = [0.6, 0.55, 0.45]
    const geometries = [
      ...(['green', 'loggerhead', 'leatherback', 'hawksbill', 'olive-ridley'] as TurtleSpecies[]).flatMap(s => [
        turtleGeometry(new Random(s), s, sand, 'adult'),
        turtleGeometry(new Random(s), s, sand, 'hatchling')
      ]),
      ...(['macaque', 'capuchin', 'vervet'] as MonkeyKind[]).flatMap(k => [monkeyGeometry(new Random(k), k, 'walk'), monkeyGeometry(new Random(k), k, 'sit')]),
      ...(['marine-iguana', 'green-iguana', 'monitor', 'spiny-tailed'] as LizardKind[]).map(k => lizardGeometry(new Random(k), k)),
      ...(['saltwater', 'american', 'nile', 'west-african'] as CrocodileKind[]).flatMap(k => [crocodileGeometry(new Random(k), k, 0.4), crocodileGeometry(new Random(k), k, 0.03)]),
      hippoGeometry(new Random('h'), 0),
      hippoGeometry(new Random('h'), 1),
      restingGull(false)
    ]
    for (const g of geometries) {
      const pos = g.attributes.position.array as Float32Array
      expect(pos.every(Number.isFinite)).toBe(true)
      g.computeBoundingBox()
      expect(g.boundingBox!.min.y).toBeGreaterThan(-0.15)
      expect(g.boundingBox!.min.y).toBeLessThan(0.05)
      expect(pos.length / 3).toBeLessThan(50_000)
    }
  })

  it('sinks the sand a nesting turtle throws up into the beach, not deeper', () => {
    const g = turtleGeometry(new Random('n'), 'leatherback', [0.6, 0.55, 0.45], 'nesting')
    g.computeBoundingBox()
    expect(g.boundingBox!.min.y).toBeGreaterThan(-0.3)
    expect(g.boundingBox!.max.y).toBeLessThan(0.6)
  })

  it('lays a track on the ground', () => {
    const path: [number, number][] = Array.from({ length: 40 }, (_, i) => [i * 0.15, 0])
    const g = trackGeometry(path, () => 0.5, 1.1, true, [0.6, 0.55, 0.45], 1)
    const pos = g.attributes.position.array as Float32Array
    for (let i = 1; i < pos.length; i += 3) {
      expect(pos[i]).toBeGreaterThanOrEqual(0.5)
      expect(pos[i]).toBeLessThan(0.6)
    }
  })
})
