import { Mesh } from 'three'
import { describe, expect, it } from 'vitest'

import type { IslandKind } from '../src/params'
import { createColony } from '../src/props/colony'
import { waterIslandsOf } from '../src/props/index'
import { createIslands, islandHeight, outlineOfIsland, type Shape } from '../src/props/islands'
import { createLighthouse } from '../src/props/lighthouse'
import { islandWaves, OUTLINE_POINTS, outlineOfMesh, outlineRadius, type WaterIsland } from '../src/props/surf'
import { allParams, scene, scenes, share, viewOf } from './days'

const KINDS = ['skerries', 'rocky', 'cay', 'karst', 'high'] as const

describe('islands at sea', () => {
  const days = allParams()

  it('show on about a quarter to a third of days', () => {
    const s = share(days, p => p.islands != null)
    expect(s).toBeGreaterThan(0.2)
    expect(s).toBeLessThan(0.4)
  })

  it('are the kinds each coast has', () => {
    const kinds: Record<string, IslandKind[]> = {
      nordic: ['skerries', 'rocky', 'high'],
      mediterranean: ['rocky'],
      tropical: ['cay', 'high', 'karst'],
      volcanic: ['high', 'rocky'],
      desert: ['rocky']
    }
    for (const p of days) if (p.islands != null) expect(kinds[p.biome.name]).toContain(p.islands.kind)
    // Skerries are the nordic archipelago's; cays are most tropical islands.
    const tropical = days.filter(p => p.islands != null && p.biome.name === 'tropical')
    expect(share(tropical, p => p.islands!.kind === 'cay')).toBeGreaterThan(0.35)
  })

  it('are sized and placed for their kind', () => {
    for (const p of scenes({ islands: true }, 60)) {
      const { kind, islands } = p.islands!
      expect(islands.length).toBeGreaterThan(0)
      for (const i of islands) {
        expect(Math.abs(i.offset)).toBeLessThanOrEqual(0.95)
        expect(i.height).toBeGreaterThan(0)
        // Karst towers can be taller than wide; the rest are broader.
        if (kind !== 'karst') expect(i.width).toBeGreaterThan(i.height)
        // Low islands near, high ones far: none so close it crowds the beach.
        expect(i.distance).toBeGreaterThan(kind === 'high' ? 7000 : 500)
        if (kind === 'cay') expect(i.height).toBeLessThan(4)
      }
    }
  })

  it('can be forced, and the title names them', () => {
    for (const kind of ['skerries', 'rocky', 'cay', 'karst', 'high'] as const) {
      for (const p of scenes({ islands: kind }, 5)) {
        expect(p.islands!.kind).toBe(kind)
        expect(p.title).toMatch(/skerries|island|islet/)
      }
    }
    for (const p of scenes({ islands: null }, 5)) expect(p.islands).toBeNull()
  })

  it('have a shoreline: land in the middle, sea round the edge', () => {
    for (const kind of ['skerries', 'rocky', 'cay', 'karst', 'high'] as const) {
      const shape = { kind, rx: 300, ry: 200, height: kind === 'cay' ? 2 : 100, seed: 7 }
      expect(islandHeight(shape, 0, 0)).toBeGreaterThan(0)
      for (let a = 0; a < 6.28; a += 0.3) {
        const h = islandHeight(shape, Math.cos(a) * 600, Math.sin(a) * 400)
        expect(h).toBeLessThan(0)
        expect(Number.isFinite(h)).toBe(true)
      }
      // Deterministic.
      expect(islandHeight(shape, 40, -30)).toBe(islandHeight({ ...shape }, 40, -30))
    }
  })
})

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
      for (const p of scenes({ colony: 'gannet', colonySite: site }, 6)) {
        const ctx = viewOf(p)
        const objects = createColony(ctx)
        const rocks = objects.filter(o => o.userData.island === true)
        const sea = rocks.filter(o => ctx.ground(o.position.x, o.position.z) < -3).length
        expect(waterIslandsOf(ctx, objects)).toHaveLength(sea)
        atSea += sea
        ashore += rocks.length - sea
      }
    }
    expect(atSea).toBeGreaterThanOrEqual(2)
    expect(ashore).toBeGreaterThanOrEqual(2)
  })

  it('islands: one entry per placed island within 5 km, none further', () => {
    let near = 0
    for (const kind of KINDS) {
      for (const p of scenes({ islands: kind, colony: null }, 2)) {
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
    expect(near).toBeGreaterThan(2)
  })

  it('drops an island with no room left, and never stacks two', () => {
    const p = scene({ coast: 'open-sea', islands: 'cay', colony: null }, '2025-07-10')
    const first = p.islands!.islands[0]
    const wide = Array.from({ length: 14 }, (_, seed) => ({ ...first, width: 2500, seed }))
    // First one so far out the Earth's curve hides it on every try: the rest are still placed.
    const ctx = viewOf({ ...p, islands: { ...p.islands!, islands: [{ ...first, distance: 5_000_000 }, ...wide] } })
    const placed = createIslands(ctx, null).flatMap(o => (o.userData.waterline == null ? [] : [o.userData.waterline as WaterIsland]))
    expect(placed.length).toBeGreaterThan(0)
    expect(placed.length).toBeLessThan(wide.length)
    for (const [i, a] of placed.entries()) for (const b of placed.slice(i + 1)) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(2500 * 1.1)
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
    expect(rocks).toBeGreaterThan(1)
  })

  it('waves break on a cliff island only with a real swell', () => {
    const p = scene({ colony: 'gannet', colonySite: 'island' }, '2015-04-19')
    const cliff = { top: 80, depth: 40 }
    expect(islandWaves(p.coast, cliff, 0.1).breaks).toBeLessThan(0.05)
    expect(islandWaves(p.coast, cliff, 2.5).breaks).toBeGreaterThan(0.95)
  })
})
