import { Matrix4, Vector3, type InstancedMesh } from 'three'
import { describe, expect, it } from 'vitest'

import { isStony } from '../src/beach'
import { createDebris } from '../src/props/debris'
import { createPinnipeds } from '../src/props/pinnipeds'
import { rockChanceFor } from '../src/props/rocks'
import { FLOWERS, growsOn, shoreLifeFor } from '../src/props/shoreLife'
import { wildlifeFor } from '../src/props/wildlife'
import { Random } from '../src/random'
import { worldToShore } from '../src/terrain'
import { allParams, DAYS, scene, scenes, view } from './days'

// Other props on stony beaches (PLAN_BIOMES 2e).

const life = (p: ReturnType<typeof allParams>[number]) => shoreLifeFor(p, Random.derive(p.seed, 'props/shore-life'))!
const allStones = (m: string | undefined) => m === 'shingle' || m === 'cobble'

/** Instance positions of a set of meshes. */
function positions(meshes: InstancedMesh[]): Vector3[] {
  const m = new Matrix4()
  return meshes.flatMap(mesh => Array.from({ length: mesh.count }, (_, i) => new Vector3().setFromMatrixPosition((mesh.getMatrixAt(i, m), m))))
}

describe('stony beach props', () => {
  const beaches = allParams().filter(p => p.coast.type === 'beach')
  const stony = beaches.filter(p => allStones(p.coast.material))

  it('has no ghost crabs or sand dollars on shingle and cobble, and fewer shells', () => {
    expect(stony.length).toBeGreaterThan(60)
    for (const p of stony) {
      expect(life(p).crab).not.toBe('ghost')
      expect(life(p).burrows).toBe(0)
      expect(life(p).shells).not.toContain('sand-dollar')
    }
    // Tropical cobble would have had ghost crabs most days.
    for (const p of scenes({ coast: 'beach', biome: 'tropical', beachMaterial: 'cobble', storm: null }, 40)) expect(life(p).crab).not.toBe('ghost')
    const mean = (list: typeof beaches) => list.reduce((sum, p) => sum + life(p).shellCount, 0) / list.length
    const sand = beaches.filter(p => p.coast.material === 'sand')
    expect(mean(stony)).toBeLessThan(mean(sand) * 0.4)
  })

  it('grows shingle flowers on stones, dune flowers on sand, both on mixed', () => {
    const seen = new Set<string>()
    for (const p of beaches) {
      for (const kind of life(p).flowers) {
        expect(growsOn(FLOWERS[kind].ground, p.coast.material)).toBe(true)
        if (FLOWERS[kind].ground === 'stones') {
          expect(isStony(p.coast.material)).toBe(true)
          seen.add(kind)
        }
      }
    }
    expect([...seen].sort()).toEqual(['horned-poppy', 'sea-campion', 'sea-kale', 'sea-pea'])
    // A June shingle beach in Britain is in flower.
    const june = DAYS.filter(d => d.slice(5, 7) === '06').map(date => scene({ place: 'britain-ireland', coast: 'beach', beachMaterial: 'shingle' }, date))
    const flowering = june.filter(p => life(p).flowers.some(k => FLOWERS[k].ground === 'stones'))
    expect(flowering.length / june.length).toBeGreaterThan(0.5)
  })

  it('lets no turtle nest on shingle or cobble', () => {
    for (const p of scenes({ place: 'florida-carolinas', beachMaterial: 'cobble', timeOfDay: 'night', eclipse: null }, 60)) {
      const w = wildlifeFor(p, Random.derive(p.seed, 'props/wildlife'))!
      expect(w.nesting).toBe(false)
      expect(w.tracks).toBe(0)
      expect(w.hatchlings).toBe(0)
    }
  })

  it('has boulders more often on cobble, less on shingle', () => {
    for (const c of [0.4, 0.75, 0.95]) {
      expect(rockChanceFor(c, 'cobble')).toBeGreaterThan(c)
      expect(rockChanceFor(c, 'cobble')).toBeLessThanOrEqual(1)
      expect(rockChanceFor(c, 'shingle')).toBeLessThan(c)
      expect(rockChanceFor(c, 'sand')).toBe(c)
      expect(rockChanceFor(c, 'mixed')).toBe(c)
    }
  })

  it('leaves driftwood on the storm ridge crest', () => {
    for (const composition of ['along-beach', 'shoreline'] as const) {
      const ctx = view({ place: 'nova-scotia', beachMaterial: 'cobble', composition, eclipse: null, props: { debris: { driftwood: 1, wrack: null, coconuts: 0 } } })
      const { coast } = ctx.params
      const ridge = coast.ridges[0]
      const logs = positions(createDebris(ctx))
      expect(logs.length).toBeGreaterThan(5)
      const inland = logs.map(p => -worldToShore(coast, p.x, p.z)[0])
      // Most pieces (sticks wander down the beach) on the crest or its back.
      const onRidge = inland.filter(u => u > ridge.distance - ridge.width && u < ridge.distance + 2 * ridge.width)
      expect(onRidge.length / inland.length).toBeGreaterThan(0.4)
    }
  })

  it('hauls seals out above the swash, below the ridge crest, lying along the slope', () => {
    const spec = { place: 'scotland', beachMaterial: 'shingle', pinnipeds: 'seal', composition: 'along-beach', storm: null, eclipse: null } as const
    let hauled = 0
    const ups: number[] = []
    for (const p of scenes(spec, 12)) {
      if (p.pinnipeds?.site !== 'beach') continue
      const ctx = view(spec, 1080, p.date)
      const { coast } = ctx.params
      const m = new Matrix4()
      for (const mesh of createPinnipeds(ctx, null) as InstancedMesh[]) {
        for (let i = 0; i < mesh.count; i++) {
          mesh.getMatrixAt(i, m)
          const at = new Vector3().setFromMatrixPosition(m)
          const ground = ctx.ground(at.x, at.z)
          // Heads in the water.
          if (ground < 0) continue
          hauled++
          expect(ground).toBeGreaterThanOrEqual(coast.runup - 0.01)
          expect(-worldToShore(coast, at.x, at.z)[0]).toBeLessThanOrEqual(coast.ridges[0].distance + 0.01)
          ups.push(new Vector3().setFromMatrixColumn(m, 1).normalize().y)
        }
      }
    }
    expect(hauled).toBeGreaterThan(0)
    // Their up axes lean with the steep face (level on the crest).
    expect(Math.min(...ups)).toBeLessThan(0.995)
  })
})
