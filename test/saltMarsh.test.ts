import { describe, expect, it } from 'vitest'
import type { BufferGeometry, InstancedMesh } from 'three'

import { createRocks } from '../src/props/rocks'
import { createSaltMarsh, glasswortGeometry, grassTuftGeometry, MARSH_TUFT_COUNT, saltMarshFor } from '../src/props/saltMarsh'
import { Random } from '../src/random'
import { MARSH_LOOK } from '../src/tidalFlat'
import { allParams, scene, view } from './days'

const base = { eclipse: null, storm: null, fog: null, timeOfDay: 'daylight', weather: 'few' } as const
const flatSpec = { ...base, coast: 'tidal-flat', tide: 'low', place: 'wadden-north-sea' } as const
const marshSpec = { ...base, coast: 'beach', saltMarsh: true, tide: 'high', place: 'wadden-north-sea' } as const

const triangles = (g: BufferGeometry): number => (g.index?.count ?? g.attributes.position.count) / 3

describe('salt-marsh tufts', () => {
  it('come with every salt marsh and nowhere else, unless forced off', () => {
    for (const p of allParams()) {
      const c = saltMarshFor(p, Random.derive(p.seed, 'props/salt-marsh'))
      expect(c != null).toBe(p.coast.marsh != null)
    }
    const p = scene({ ...flatSpec, props: { saltMarsh: false } })
    expect(saltMarshFor(p, Random.derive(p.seed, 'props/salt-marsh'))).toBeNull()
  })

  it('take the month: green in July with purple, red in September, straw in January', () => {
    const at = (date: string) => {
      const p = scene(flatSpec, date)
      return saltMarshFor(p, Random.derive(p.seed, 'props/salt-marsh'))!
    }
    const july = at('2025-07-10')
    expect(july.color[1]).toBeGreaterThan(july.color[0])
    expect(july.accent[2]).toBeGreaterThan(july.accent[1])
    expect(at('2025-09-20').accent[0]).toBeGreaterThan(3 * at('2025-09-20').accent[1])
    expect(at('2025-01-15').amount).toBe(0)
    expect(MARSH_LOOK).toHaveLength(12)
  })

  it('build deterministic, finite meshes at real size, base on y = 0, within budget', () => {
    for (const build of [grassTuftGeometry, glasswortGeometry]) {
      const a = build(Random.derive('t', 'mesh'))
      const b = build(Random.derive('t', 'mesh'))
      expect(Array.from(a.attributes.position.array)).toEqual(Array.from(b.attributes.position.array))
      a.computeBoundingBox()
      const box = a.boundingBox!
      expect(box.min.y).toBeCloseTo(0, 5)
      expect(box.max.y).toBeLessThan(0.45)
      expect(box.max.y).toBeGreaterThan(0.05)
      for (const v of a.attributes.position.array) expect(Number.isFinite(v)).toBe(true)
      expect(triangles(a)).toBeLessThan(200)
    }
  })

  it('stand on the dry marsh near the camera, many in view, off the flat and the water', () => {
    // Eye-height views (beach along-shore views are 5–18 m up a quarter of
    // the time, seeing no marsh within 45 m).
    const cases = [
      [flatSpec, 'framed'],
      [flatSpec, 'along-beach'],
      [marshSpec, 'framed']
    ] as const
    for (const [spec, composition] of cases) {
      {
        const ctx = view({ ...spec, composition }, 1080, '2025-07-10')
        const meshes = createSaltMarsh(ctx)
        let count = 0
        let tris = 0
        for (const mesh of meshes as InstancedMesh[]) {
          count += mesh.count
          tris += mesh.count * triangles(mesh.geometry)
          for (let i = 0; i < mesh.count; i++) {
            const m = mesh.instanceMatrix.array
            const [x, y, z] = [m[i * 16 + 12], m[i * 16 + 13], m[i * 16 + 14]]
            expect(y).toBeGreaterThan(ctx.params.coast.runup - 0.02)
            expect(Math.hypot(x - ctx.camera.position.x, z - ctx.camera.position.z)).toBeLessThan(46)
          }
        }
        expect(count, `${spec.coast} ${composition}`).toBeGreaterThan(300)
        expect(count).toBeLessThanOrEqual(MARSH_TUFT_COUNT)
        expect(tris).toBeLessThan(300_000)
      }
    }
  })

  it('leave no boulders or sea stacks on flats and marsh beaches', () => {
    for (const spec of [flatSpec, marshSpec]) for (const date of ['2025-07-10', '2024-03-02', '2026-05-20']) expect(createRocks(view(spec, 1080, date))).toEqual([])
  })
})
