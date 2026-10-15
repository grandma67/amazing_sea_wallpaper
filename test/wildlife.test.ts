import { describe, expect, it } from 'vitest'

import { Random } from '../src/random'
import {
  lizardGeometry,
  monkeyGeometry,
  nestingSpecies,
  trackGeometry,
  turtleGeometry,
  wildlifeFor,
  type LizardKind,
  type MonkeyKind,
  type TurtleSpecies
} from '../src/props/wildlife'
import { allParams, scenes, share } from './days'

describe('beach wildlife', () => {
  const days = allParams()
  const life = (p: (typeof days)[number]) => wildlifeFor(p, Random.derive(p.seed, 'props/wildlife'))
  const month = (p: (typeof days)[number]) => Number(p.date.slice(5, 7))

  it('nests each species in its season', () => {
    expect(nestingSpecies('mediterranean', 7, 0)).toBe('loggerhead')
    expect(nestingSpecies('mediterranean', 1, 0)).toBeNull()
    expect(nestingSpecies('caribbean', 4, 0)).toBe('leatherback')
    expect(nestingSpecies('caribbean', 12, 0)).toBeNull()
    expect(nestingSpecies('central-america', 9, 0)).toBe('olive-ridley')
    expect(nestingSpecies('galapagos', 2, 0)).toBe('green')
    expect(nestingSpecies(null, 7, 0)).toBeNull()
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
      if (l.turtle === 'loggerhead') expect([6, 7, 8, 9, 10]).toContain(month(p))
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

  it('can be forced and removed', () => {
    for (const p of scenes({ coast: 'beach', biome: 'tropical', props: { wildlife: { monkey: 'capuchin' } } }, 10)) {
      expect(life(p)!.monkey).toBe('capuchin')
      expect(life(p)!.monkeys).toBeGreaterThan(0)
    }
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
      ...(['marine-iguana', 'green-iguana', 'monitor', 'spiny-tailed'] as LizardKind[]).map(k => lizardGeometry(new Random(k), k))
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
