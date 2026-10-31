import { describe, expect, it } from 'vitest'

import { beachLines, seabedAlbedo, STONE_LEVELS, STONE_SIZES, stoneAt, stoneCell, stoneCover, stoneGridCell, stoneLevel, stoneMean } from '../src/beach'
import { MAX_RADIUS, MAX_STONES, meshRadius, meshStones, stoneGeometry } from '../src/props/stones'
import { Random } from '../src/random'
import { stoneUniforms } from '../src/terrain'
import { allParams, scene, view, viewOf } from './days'

const cobble = scene({ place: 'nova-scotia', beachMaterial: 'cobble' }).coast
const mixed = scene({ place: 'scotland', beachMaterial: 'mixed' }).coast

describe('stone cells', () => {
  it('gives stony days a stone size in range, sand days none', () => {
    for (const p of allParams().filter(p => p.coast.type === 'beach')) {
      const { material, stoneSize } = p.coast
      if (material === 'sand') expect(stoneSize).toBe(0)
      else {
        expect(stoneSize).toBeGreaterThanOrEqual(STONE_SIZES[material][0])
        expect(stoneSize).toBeLessThanOrEqual(STONE_SIZES[material][1])
      }
    }
  })

  it('finds the stone whose centre it is asked about, deterministically', () => {
    for (const [s, a] of [[-3, 0], [-10, 25], [-20, -60]]) {
      const stone = stoneCell(cobble, s, a)!
      expect(stoneCell(cobble, s, a)).toEqual(stone)
      expect(Math.hypot(stone.s - s, stone.a - a)).toBeLessThan(stone.size * 1.5)
      // Asked at its own centre (same size class there), it is found again.
      if (stoneLevel(cobble, -stone.s, stone.a) === stone.level) {
        expect(stoneCell(cobble, stone.s, stone.a)!.cell).toEqual(stone.cell)
      }
      expect(stone.size).toBeCloseTo(cobble.stoneSize * STONE_LEVELS[stone.level], 9)
      for (const c of stone.color) expect(c).toBeGreaterThan(0)
    }
    expect(stoneCell(scene({ beachMaterial: 'sand' }).coast, -5, 0)).toBeNull()
  })

  it('puts each cell centre inside its own grid cell', () => {
    for (let level = 0; level < 3; level++) {
      for (let i = 0; i < 20; i++) {
        const stone = stoneAt(cobble, level, 100 + i, -40 + 3 * i)
        expect(stoneGridCell(cobble, level, -stone.s, stone.a)).toEqual(stone.cell)
      }
    }
  })

  it('grades coarser on the storm ridge, finer below the high-tide line', () => {
    const crest = cobble.ridges[0].distance
    const { highTide } = beachLines(cobble)
    const mean = (u: number): number => {
      let sum = 0
      for (let a = 0; a < 400; a += 2) sum += stoneLevel(cobble, u, a)
      return sum / 200
    }
    expect(mean(crest)).toBeGreaterThan(mean(highTide * 0.2))
  })

  it('covers a mixed beach with stones above the high tide line, sand below', () => {
    const { highTide } = beachLines(mixed)
    const cover = (u: number): number => {
      let sum = 0
      for (let a = 0; a < 400; a += 2) sum += stoneCover(mixed, u, a)
      return sum / 200
    }
    expect(cover(0)).toBeLessThan(0.05)
    expect(cover(highTide * 1.5)).toBeGreaterThan(0.5)
    expect(stoneCover(cobble, 0, 0)).toBe(1)
  })

  it('feeds the shader a palette that fits its uniforms, and the seabed its colour', () => {
    for (const p of allParams().filter(p => p.coast.material !== 'sand').slice(0, 50)) {
      expect(p.coast.stoneColors.length).toBeLessThanOrEqual(6)
      const u = stoneUniforms(p.coast)
      expect(u.stoneMaterial.value).toBeGreaterThan(0)
    }
    expect(stoneUniforms(scene({ coast: 'open-sea' }).coast).stoneMaterial.value).toBe(0)
    expect(seabedAlbedo(cobble)).toEqual(stoneMean(cobble.stoneColors))
    const sand = scene({ coast: 'beach', beachMaterial: 'sand' }).coast
    expect(seabedAlbedo(sand)).toEqual(sand.sand.albedo)
  })
})

describe('mesh stones', () => {
  it('builds small, finite stones resting on y = 0, deterministically', () => {
    for (let i = 0; i < 12; i++) {
      const g = stoneGeometry(new Random(`stone-${i}`), 0.1, i % 2 === 1)
      const position = g.attributes.position.array
      const normal = g.attributes.normal.array
      expect([...position, ...normal].every(Number.isFinite)).toBe(true)
      g.computeBoundingBox()
      const box = g.boundingBox!
      expect(box.min.y).toBeCloseTo(0, 6)
      expect(box.max.y).toBeGreaterThan(0.02)
      expect(box.max.x - box.min.x).toBeLessThan(0.15)
      const tris = (g.index?.count ?? 0) / 3
      expect(tris).toBeGreaterThanOrEqual(50)
      expect(tris).toBeLessThanOrEqual(150)
    }
    const a = stoneGeometry(new Random('same'), 1, true).attributes.position.array
    const b = stoneGeometry(new Random('same'), 1, true).attributes.position.array
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  it('sizes the mesh radius by pixels on screen', () => {
    // 50 mm lens, 1080p: ~0.25 mrad per pixel vertically.
    expect(meshRadius(0.01, 0.00025)).toBe(0)
    expect(meshRadius(0.03, 0.00025)).toBeCloseTo(12, 6)
    expect(meshRadius(0.3, 0.00025)).toBe(MAX_RADIUS)
    expect(meshRadius(0.04, 0.0005)).toBeLessThan(meshRadius(0.04, 0.00025))
  })

  it('puts one mesh stone on each nearby shader stone, nearest first, within budget', () => {
    for (const material of ['shingle', 'cobble', 'mixed'] as const) {
      for (const composition of ['shoreline', 'along-beach'] as const) {
        for (const height of [1080, 2160]) {
          const ctx = view({ place: 'nova-scotia', beachMaterial: material, composition, eclipse: null }, height)
          const { stones, radius } = meshStones(ctx)
          expect(stones.length).toBeLessThanOrEqual(MAX_STONES)
          const coast = ctx.params.coast
          for (const m of stones.slice(0, 200)) {
            expect(m.distance).toBeLessThanOrEqual(radius[m.stone.level] + 1e-9)
            // The shader draws this very stone there.
            if (m.stone.presence < stoneCover(coast, -m.stone.s, m.stone.a)) {
              expect(stoneCell(coast, m.stone.s, m.stone.a)!.cell).toEqual(m.stone.cell)
            }
          }
          for (let i = 1; i < stones.length; i++) expect(stones[i].distance).toBeGreaterThanOrEqual(stones[i - 1].distance)
        }
      }
    }
  })

  it('places nothing on sand or at sea', () => {
    expect(meshStones(view({ beachMaterial: 'sand' })).stones).toHaveLength(0)
    expect(meshStones(view({ coast: 'open-sea' })).stones).toHaveLength(0)
  })

  it('stays within the instance and triangle budget on real stony days', () => {
    const days = allParams()
      .filter(p => p.coast.type === 'beach' && p.coast.material !== 'sand')
      .slice(0, 40)
    for (const p of days) {
      const { stones } = meshStones(viewOf(p, 2160))
      expect(stones.length * 80).toBeLessThanOrEqual(1_000_000)
    }
  }, 60_000)
})
