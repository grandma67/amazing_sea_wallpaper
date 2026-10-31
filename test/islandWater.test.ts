import { Mesh } from 'three'
import { describe, expect, it } from 'vitest'

import { createColony } from '../src/props/colony'
import { waterIslandsOf } from '../src/props/index'
import { createIslands, islandHeight, outlineOfIsland, type Shape } from '../src/props/islands'
import { createLighthouse } from '../src/props/lighthouse'
import { islandWaves, OUTLINE_POINTS, outlineOfMesh, outlineRadius, type WaterIsland } from '../src/props/surf'
import { scene, scenes, viewOf } from './days'

const KINDS = ['skerries', 'rocky', 'cay', 'karst', 'high'] as const

describe('islands and big rocks in the sea', () => {
  it('outlineOfIsland follows the shoreline of every kind', () => {
    for (const kind of KINDS) {
      for (const seed of [1, 2, 3]) {
        const shape: Shape = { kind, rx: 300, ry: 180, height: kind === 'cay' ? 2 : 60, seed }
        // Local x along world x, local y along world z.
        const outline = outlineOfIsland(shape, { x: 1, z: 0 }, { x: 0, z: 1 })
        expect(outline).toHaveLength(OUTLINE_POINTS)
        outline.forEach((r, k) => {
          const a = (k / OUTLINE_POINTS) * Math.PI * 2
          const at = (f: number): number => islandHeight(shape, Math.cos(a) * r * f, Math.sin(a) * r * f)
          expect(at(0.97), `${kind} ${seed} k=${k}`).toBeGreaterThan(0)
          expect(at(1.03), `${kind} ${seed} k=${k}`).toBeLessThan(0)
        })
      }
    }
  })

  it('outlineRadius interpolates round the circle', () => {
    const outline = Array.from({ length: OUTLINE_POINTS }, (_, k) => 10 + k)
    expect(outlineRadius(outline, 0)).toBeCloseTo(10)
    expect(outlineRadius(outline, (0.5 / OUTLINE_POINTS) * Math.PI * 2)).toBeCloseTo(10.5)
    expect(outlineRadius(outline, -1e-9)).toBeCloseTo(10, 3)
    // Between the last point and the first.
    expect(outlineRadius(outline, ((OUTLINE_POINTS - 0.5) / OUTLINE_POINTS) * Math.PI * 2)).toBeCloseTo((10 + 10 + OUTLINE_POINTS - 1) / 2)
  })

  it('outlineOfMesh on a colony stack is finite, inside its box and deterministic', () => {
    const p = scene({ colony: 'gannet', colonySite: 'island' }, '2015-04-19')
    const stack = () => createColony(viewOf(p)).find(o => o.userData.waterline != null) as Mesh
    const a = stack()
    const b = stack()
    expect(a).toBeInstanceOf(Mesh)
    const outline = outlineOfMesh(a)
    expect(outline).toEqual(outlineOfMesh(b))
    const half = Math.hypot(a.scale.x, a.scale.z) * 1.2
    for (const r of outline) {
      expect(Number.isFinite(r)).toBe(true)
      expect(r).toBeGreaterThan(0.2 * Math.min(a.scale.x, a.scale.z))
      expect(r).toBeLessThan(half)
    }
  })

  it('colonies: one entry for an island stack, none for a mainland headland', () => {
    // A forced site falls back to the other when nothing fits the frame:
    // tell a stack at sea from a headland by the water under it.
    let atSea = 0
    let ashore = 0
    for (const site of ['island', 'mainland'] as const) {
      for (const p of scenes({ colony: 'gannet', colonySite: site }, 12)) {
        const ctx = viewOf(p)
        const objects = createColony(ctx)
        const rocks = objects.filter(o => o.userData.island === true)
        const sea = rocks.filter(o => ctx.ground(o.position.x, o.position.z) < -3).length
        expect(waterIslandsOf(ctx, objects)).toHaveLength(sea)
        atSea += sea
        ashore += rocks.length - sea
      }
    }
    expect(atSea).toBeGreaterThanOrEqual(4)
    expect(ashore).toBeGreaterThanOrEqual(4)
  })

  it('islands: one entry per placed island within 5 km, none further', () => {
    let near = 0
    for (const kind of ['skerries', 'karst', 'high'] as const) {
      for (const p of scenes({ islands: kind, colony: null }, 6)) {
        const ctx = viewOf(p)
        const objects = createIslands(ctx, null)
        const tagged = objects.filter(o => o.userData.waterline != null)
        const within = tagged.filter(o => {
          const w = o.userData.waterline as WaterIsland
          return ctx.distance(w.x, w.z) <= 5000 && o.userData.distant !== true
        })
        const water = waterIslandsOf(ctx, objects)
        expect(water).toHaveLength(within.length)
        for (const w of water) expect(ctx.distance(w.x, w.z)).toBeLessThanOrEqual(5000)
        // High islands stand 8 km out and more.
        if (kind === 'high') expect(water).toHaveLength(0)
        near += water.length
      }
    }
    expect(near).toBeGreaterThan(5)
  })

  it('a lighthouse on a rock at sea is one; one on a point is not', () => {
    // A forced site falls back to the other kind when nothing fits the frame:
    // tell them by the water under the foot.
    let rocks = 0
    for (const site of ['rock', 'point'] as const) {
      for (const p of scenes({ lighthouse: site }, 8)) {
        const ctx = viewOf(p)
        const objects = createLighthouse(ctx, null)
        if (objects.length === 0) continue
        const foot = objects[0]
        const atSea = ctx.ground(foot.position.x, foot.position.z) < -3
        expect(waterIslandsOf(ctx, objects)).toHaveLength(atSea ? 1 : 0)
        if (atSea) rocks++
      }
    }
    expect(rocks).toBeGreaterThan(2)
  })

  it('waves break on a cliff island only with a real swell', () => {
    const p = scene({ colony: 'gannet', colonySite: 'island' }, '2015-04-19')
    const cliff = { top: 80, depth: 40 }
    expect(islandWaves(p.coast, cliff, 0.1).breaks).toBeLessThan(0.05)
    expect(islandWaves(p.coast, cliff, 2.5).breaks).toBeGreaterThan(0.95)
  })
})
