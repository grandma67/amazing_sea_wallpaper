import { describe, expect, it } from 'vitest'

import type { Climate } from '../src/biome'
import { GpuResources } from '../src/dispose'
import { createTerrain } from '../src/terrain'
import { CLIMATES } from '../src/places'
import { fallenLeafSize, LITTER_DAYS, phenologyFor, type PhenologyDay } from '../src/phenology'
import { createLeafLitter, deciduousTrees, fallenLeafGeometry, leafShare, litterField, litterFor, MAX_LEAVES, treeLeaf } from '../src/props/leafLitter'
import { createVegetation } from '../src/props/vegetation'
import type { SceneSpec } from '../src/sceneSpec'
import { allParams, scene, view, viewOf } from './days'

const day = (date: string, climate: Climate, latitudeDeg = 50): PhenologyDay => ({ date, latitudeDeg, place: { id: 'x', climate } })
const litter = (date: string, climate: Climate, lat = 50): number => phenologyFor(day(date, climate, lat)).litter

const spec = (extra: SceneSpec): SceneSpec => ({ eclipse: null, place: 'brittany', composition: 'framed', timeOfDay: 'midday', fog: null, ...extra, props: { vegetation: ['broadleaf'], ...extra.props } })

describe('litter curve', () => {
  it('builds after peak colour, stays the winter on temperate ground, and goes with spring', () => {
    expect(litter('2025-08-15', 'temperate')).toBe(0)
    expect(litter('2025-11-15', 'temperate')).toBeGreaterThan(0.3)
    expect(litter('2025-01-15', 'temperate')).toBe(1)
    expect(litter('2025-04-30', 'temperate')).toBeGreaterThan(0)
    expect(litter('2025-06-15', 'temperate')).toBe(0)
  })

  it('goes under the first lasting snow in boreal and polar climates', () => {
    expect(litter('2025-10-20', 'boreal')).toBe(1)
    expect(litter('2025-12-20', 'boreal')).toBe(0)
    expect(litter('2025-01-15', 'boreal')).toBe(0)
    expect(litter('2025-09-25', 'polar')).toBeGreaterThan(0.9)
    expect(litter('2025-10-20', 'polar')).toBe(0)
  })

  it('flips with the hemisphere, weathers, and stays 0..1 in every climate and month', () => {
    expect(litter('2025-07-15', 'temperate', -45)).toBe(litter('2025-01-14', 'temperate', 45))
    expect(phenologyFor(day('2025-11-01', 'temperate')).litterFresh).toBeGreaterThan(phenologyFor(day('2025-01-20', 'temperate')).litterFresh)
    for (const climate of CLIMATES) {
      for (let m = 1; m <= 12; m++) {
        const p = phenologyFor(day(`2025-${String(m).padStart(2, '0')}-15`, climate))
        expect(p.litter).toBeGreaterThanOrEqual(0)
        expect(p.litter).toBeLessThanOrEqual(1)
        if (LITTER_DAYS[climate] == null && climate !== 'tropical') expect(p.litter).toBe(0)
      }
    }
  })

  it('has none where nothing is deciduous, and the switches take it away', () => {
    expect(litter('2025-10-15', 'mediterranean', 38)).toBe(0)
    expect(litterFor(scene(spec({ props: { leafLitter: false } }), '2025-01-15'))).toBeNull()
    expect(litterFor(scene(spec({ props: { phenology: false } }), '2025-01-15'))).toBeNull()
    expect(litterFor(scene(spec({}), '2025-07-15'))).toBeNull()
    expect(litterFor(scene(spec({}), '2025-01-15'))).not.toBeNull()
  })
})

describe('a leaf', () => {
  const tree = { x: 12.5, y: 3, z: -40.25, radius: 5, kind: 'broadleaf' as const }

  it('is fixed by its tree and index, whatever else is asked', () => {
    expect(treeLeaf(tree, 7)).toEqual(treeLeaf({ ...tree }, 7))
    expect(treeLeaf(tree, 7)).not.toEqual(treeLeaf(tree, 8))
    expect(treeLeaf(tree, 7)).not.toEqual(treeLeaf({ ...tree, x: 13.5 }, 7))
  })

  it('lies round the crown, thickest under it', () => {
    const leaves = Array.from({ length: 2000 }, (_, i) => treeLeaf(tree, i))
    const radii = leaves.map(l => Math.hypot(l.x - tree.x, l.z - tree.z))
    expect(Math.max(...radii)).toBeLessThanOrEqual(tree.radius * 1.3 + 1e-6)
    // Uniform over the area would put 4/9 of them inside 2/3 of the radius.
    expect(radii.filter(r => r < (tree.radius * 1.3 * 2) / 3).length / radii.length).toBeGreaterThan(0.5)
  })

  it('stays while it is big on screen and is left to the ground colour when tiny', () => {
    expect(leafShare(0.1, 5, 0.0005)).toBe(1)
    expect(leafShare(0.1, 25, 0.0005)).toBeGreaterThan(0)
    expect(leafShare(0.1, 25, 0.0005)).toBeLessThan(1)
    expect(leafShare(0.1, 80, 0.0005)).toBe(0)
    expect(leafShare(0.1, 25, 0.00025)).toBeGreaterThan(leafShare(0.1, 25, 0.0005))
  })

  it('has real sizes by tree', () => {
    const phen = phenologyFor(day('2025-11-01', 'temperate'))
    expect(fallenLeafSize('broadleaf', phen)).toBeGreaterThan(fallenLeafSize('birch', phen))
    expect(fallenLeafSize('birch', phen)).toBeGreaterThan(fallenLeafSize('bush', phenologyFor(day('2025-09-25', 'polar'))))
  })

  it('is a small, deterministic, finite mesh lying on y = 0', () => {
    for (let v = 0; v < 4; v++) {
      const g = fallenLeafGeometry(v)
      const pos = g.attributes.position
      expect(Array.from(pos.array)).toEqual(Array.from(fallenLeafGeometry(v).attributes.position.array))
      expect(g.index!.count / 3).toBe(8)
      for (const value of [...pos.array, ...g.attributes.normal.array]) expect(Number.isFinite(value)).toBe(true)
      g.computeBoundingBox()
      expect(g.boundingBox!.min.y).toBeGreaterThanOrEqual(0)
      expect(g.boundingBox!.max.y).toBeLessThan(0.3)
    }
  })
})

describe('on a day', () => {
  const near = (s: SceneSpec, date: string) => {
    const ctx = view(s, 1080, date)
    const plants = createVegetation(ctx)
    return { ctx, plants, leaves: createLeafLitter(ctx, plants), field: litterField(ctx, plants) }
  }

  it('lays leaves on dry ground under a January oak, within the budget', () => {
    const { ctx, leaves, plants } = near(spec({}), '2025-01-15')
    const count = leaves.reduce((n, m) => n + m.count, 0)
    expect(deciduousTrees(plants).length).toBeGreaterThan(0)
    expect(count).toBeGreaterThan(200)
    expect(count).toBeLessThanOrEqual(MAX_LEAVES)
    for (const mesh of leaves) {
      const a = mesh.instanceMatrix.array
      for (let i = 0; i < mesh.count; i++) {
        const [x, y, z] = [a[i * 16 + 12], a[i * 16 + 13], a[i * 16 + 14]]
        expect(Number.isFinite(y)).toBe(true)
        expect(Math.abs(y - ctx.ground(x, z))).toBeLessThan(0.05)
        expect(y).toBeGreaterThan(0)
      }
    }
  })

  it('lays the same leaves each time', () => {
    const a = near(spec({}), '2025-01-15').leaves
    const b = near(spec({}), '2025-01-15').leaves
    expect(Array.from(a[0].instanceMatrix.array)).toEqual(Array.from(b[0].instanceMatrix.array))
  })

  it('weathers its leaves brown by late winter', () => {
    const warmth = (date: string): number => {
      const mesh = near(spec({}), date).leaves[0]
      const c = mesh.instanceColor!.array
      let red = 0
      for (let i = 0; i < mesh.count; i++) red += c[i * 3] / Math.max(c[i * 3 + 2], 1e-3)
      return red / mesh.count
    }
    expect(warmth('2025-11-12')).toBeGreaterThan(warmth('2025-02-20') * 1.3)
  })

  it('has nothing in July, nor with the switch off', () => {
    for (const s of [{ s: spec({}), date: '2025-07-15' }, { s: spec({ props: { leafLitter: false } }), date: '2025-01-15' }]) {
      const { leaves, field } = near(s.s, s.date)
      expect(leaves).toEqual([])
      expect(field).toBeNull()
    }
  })

  it('leaves the plants as they were', () => {
    const [on, off] = [near(spec({}), '2025-01-15').plants, near(spec({ props: { leafLitter: false } }), '2025-01-15').plants]
    expect(on.length).toBe(off.length)
    expect(Array.from(on[0].instanceMatrix.array)).toEqual(Array.from(off[0].instanceMatrix.array))
  })

  it('maps the ground under the trees in view, empty at the rim', () => {
    const { field, plants } = near(spec({}), '2025-01-15')
    expect(field).not.toBeNull()
    const { texture, rect } = field!
    const size = texture.image.width
    const data = texture.image.data as Uint8Array
    expect(Math.max(...data)).toBeGreaterThan(100)
    for (let i = 0; i < size; i++) {
      expect(data[i]).toBe(0)
      expect(data[size * (size - 1) + i]).toBe(0)
    }
    const tree = deciduousTrees(plants)[0]
    const u = (tree.x - rect[0]) * rect[2]
    const v = (tree.z - rect[1]) * rect[3]
    if (u > 0 && u < 1 && v > 0 && v < 1) expect(data[Math.floor(v * size) * size + Math.floor(u * size)]).toBeGreaterThan(50)
  })
})

describe('the map on the GPU', () => {
  it('is freed with the terrain that holds it', () => {
    const ctx = view(spec({}), 1080, '2025-01-15')
    const field = litterField(ctx, createVegetation(ctx))!
    const terrain = createTerrain(ctx.params, ctx.camera)
    terrain.material.uniforms.litterMap.value = field.texture
    let freed = false
    field.texture.addEventListener('dispose', () => (freed = true))
    const gpu = new GpuResources()
    gpu.addMaterial(terrain.material)
    gpu.dispose()
    expect(freed).toBe(true)
  })
})

describe('real days', () => {
  it('only where the season and plants allow', () => {
    const days = allParams().filter(p => litterFor(p) != null)
    expect(days.length / allParams().length).toBeGreaterThan(0.1)
    for (const p of days) expect(['temperate', 'boreal', 'polar', 'tropical']).toContain(p.place.climate)
    for (const p of days.slice(0, 40)) {
      const ctx = viewOf(p)
      const plants = createVegetation(ctx)
      expect(createLeafLitter(ctx, plants).reduce((n, m) => n + m.count, 0)).toBeLessThanOrEqual(MAX_LEAVES)
    }
  })
})
