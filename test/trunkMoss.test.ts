import type { BufferAttribute, InstancedMesh } from 'three'
import { describe, expect, it } from 'vitest'

import type { RGB } from '../src/biome'
import { BELT_FADE, SPRAY_INLAND, sprayBelt, trunkGrowth } from '../src/phenology'
import * as trees from '../src/props/trees'
import { createVegetation } from '../src/props/vegetation'
import { Random } from '../src/random'
import type { SceneSpec } from '../src/sceneSpec'
import { view } from './days'

// NATURE_PLAN phase 9: moss and spray-belt lichen on trunks (phenology.ts
// trunkGrowth; props/trunkMoss.ts; bark weights baked by MeshBuilder).

const FOLIAGE: RGB = [0.1, 0.18, 0.05]
const values = (m: BufferAttribute | undefined): number[] => (m == null ? [] : Array.from(m.array as Float32Array))

describe('trunkGrowth', () => {
  const exposed = { amount: 1.3, belt: sprayBelt('scotland') }
  const sheltered = { amount: 1, belt: sprayBelt('baltic') }

  it('turns a tree in the spray belt near the shore to lichen, without moss', () => {
    expect(trunkGrowth(exposed, 2, 10)).toEqual({ moss: 0, lichen: 1 })
  })

  it('gives moss above the belt and beyond spray’s reach', () => {
    expect(trunkGrowth(exposed, exposed.belt + BELT_FADE + 0.1, 10)).toEqual({ moss: 1.3, lichen: 0 })
    expect(trunkGrowth(exposed, 2, SPRAY_INLAND[1] + 1)).toEqual({ moss: 1.3, lichen: 0 })
  })

  it('reaches further inland on exposed coasts than on sheltered ones', () => {
    expect(trunkGrowth(exposed, 0.5, 40).lichen).toBe(1)
    expect(trunkGrowth(sheltered, 0.5, 40).lichen).toBe(0)
    expect(trunkGrowth(sheltered, 0.5, 2).lichen).toBe(1)
  })

  it('shares the trunk between moss and lichen, and gives no moss on arid coasts', () => {
    for (const inland of [0, 20, 60, 100, 200]) {
      for (const above of [-1, 2, 8, 14, 20]) {
        const g = trunkGrowth(exposed, above, inland)
        expect(g.moss).toBeCloseTo(exposed.amount * (1 - g.lichen))
        expect(g.lichen).toBeGreaterThanOrEqual(0)
        expect(g.lichen).toBeLessThanOrEqual(1)
        expect(trunkGrowth({ amount: 0, belt: 3.5 }, above, inland).moss).toBe(0)
      }
    }
  })
})

describe('bark weights', () => {
  it('bark carries moss, leaves don’t', () => {
    const g = trees.broadleaf(new Random('a'), FOLIAGE)
    const w = values(g.getAttribute('barkMoss') as BufferAttribute)
    expect(w.length).toBe(g.getAttribute('position').count)
    expect(w.some(v => v === 1)).toBe(true)
    expect(w.some(v => v === 0)).toBe(true)
    expect(w.every(v => v === 0 || v === 1)).toBe(true)
  })

  it('smooth gum bark carries a third, rough eucalyptus bark all', () => {
    const weights = new Set(['a', 'b', 'c', 'd', 'e', 'f'].flatMap(s => values(trees.eucalyptus(new Random(s), FOLIAGE).getAttribute('barkMoss') as BufferAttribute).map(v => Math.round(v * 10) / 10)))
    expect(weights).toEqual(new Set([0, 0.3, 1]))
  })

  it('spruce has it on the trunk', () => {
    for (const g of [trees.conifer(new Random('a'), FOLIAGE)]) expect(values(g.getAttribute('barkMoss') as BufferAttribute)).toContain(1)
  })
})

describe('trunk moss on placed plants', () => {
  const BASE: SceneSpec = { eclipse: null, coast: 'beach', composition: 'framed', storm: null, fog: null, timeOfDay: 'daylight', weather: 'few' }
  const growth = (m: InstancedMesh) => m.geometry.getAttribute('trunkGrowth') as BufferAttribute | undefined
  const lichen = (ms: InstancedMesh[]) => ms.filter(m => m.userData.plantKind !== 'grass').flatMap(m => values(growth(m)).filter((_, i) => i % 2 === 1))

  it('gives every plant mesh its growth per tree, and the off switch none, the plants unchanged', () => {
    const spec: SceneSpec = { ...BASE, place: 'british-columbia' }
    const on = createVegetation(view(spec, 1080, '2025-06-10'))
    expect(on.length).toBeGreaterThan(0)
    for (const m of on) {
      expect(growth(m)?.count).toBe(m.count)
      expect(m.geometry.getAttribute('barkMoss')).toBeDefined()
    }
    const off = createVegetation(view({ ...spec, props: { moss: false } }, 1080, '2025-06-10'))
    expect(off.every(m => growth(m) == null)).toBe(true)
    expect(off.map(m => [m.userData.plantKind, m.count, Array.from(m.instanceMatrix.array)])).toEqual(on.map(m => [m.userData.plantKind, m.count, Array.from(m.instanceMatrix.array)]))
  })

  it('greys the shore’s first trees on an exposed coast, not on a sheltered sea', () => {
    const grey = (place: string) => {
      const l = lichen(createVegetation(view({ ...BASE, place }, 1080, '2025-07-10')))
      expect(l.length, place).toBeGreaterThan(0)
      return l.filter(v => v > 0.5).length / l.length
    }
    expect(grey('scotland')).toBeGreaterThan(0.3)
    expect(grey('baltic')).toBe(0)
  })

  it('gives no moss on an arid coast', () => {
    const ms = createVegetation(view({ ...BASE, place: 'namibia', props: { vegetation: ['broadleaf', 'bush'] } }, 1080, '2025-03-10'))
    const moss = ms.flatMap(m => values(growth(m)).filter((_, i) => i % 2 === 0))
    expect(moss.length).toBeGreaterThan(0)
    expect(moss.every(v => v === 0)).toBe(true)
  })
})
