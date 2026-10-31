import { describe, expect, it } from 'vitest'

import { hasBeach, hasLand, hasSurfZone } from '../src/coastKind'
import type { CoastParams } from '../src/params'
import { Random } from '../src/random'
import { bareRock, ROCK_KINDS, rockShoreFor, rockWaterline, scarpFoot, wobbleAtCamera } from '../src/rockShore'
import { shoreToWorld, terrainHeight, terrainNormal } from '../src/terrain'
import { placeNamed, PLACES } from '../src/places'
import { allParams, expectShare, scene, scenes } from './days'

const at = (coast: CoastParams, s: number, a = 0): number => terrainHeight(coast, ...shoreToWorld(coast, s, a))
const base = { eclipse: null, coast: 'rock-shore' } as const
const shores = ROCK_KINDS.flatMap(rockShore => scenes({ ...base, rockShore }, 15))

describe('rock shore shape', () => {
  it('has each drawn kind within its real ranges', () => {
    for (let i = 0; i < 300; i++) {
      for (const range of [0.3, 1.5, 4, 9]) {
        const rock = rockShoreFor(range, [[0.3, 0.3, 0.3]], Random.derive(`r${i}`, 'rock-shore'))
        expect(rock.top).toBeGreaterThan(range / 2)
        if (rock.kind === 'platform') {
          expect(rock.width).toBeGreaterThanOrEqual(25)
          expect(rock.width).toBeLessThanOrEqual(200)
          const slope = (rock.top - rock.edge) / rock.width
          // Sloping (1–4°) where the tide is big, near level where small.
          if (range >= 2) expect(slope).toBeGreaterThan(Math.tan((0.99 * Math.PI) / 180))
          else expect(slope).toBeLessThan(0.01)
          expect(slope).toBeLessThan(Math.tan((4.01 * Math.PI) / 180))
          expect(rock.backHeight).toBeLessThanOrEqual(12)
        }
        if (rock.kind === 'cliff') expect(rock.backHeight).toBeGreaterThanOrEqual(15)
        if (rock.kind === 'boulder') expect(rock.boulder).toBeGreaterThan(0)
      }
    }
  })

  it('draws a third cliffs and forces the kind without moving other draws', () => {
    const kinds = Array.from({ length: 3000 }, (_, i) => rockShoreFor(1, [[0.3, 0.3, 0.3]], Random.derive(`k${i}`, 'rock-shore')).kind)
    expect(kinds.filter(k => k === 'cliff').length / kinds.length).toBeCloseTo(0.33, 1)
    const drawn = rockShoreFor(1, [[0.3, 0.3, 0.3]], Random.derive('x', 'rock-shore'), { kind: 'platform' })
    const again = rockShoreFor(1, [[0.3, 0.3, 0.3]], Random.derive('x', 'rock-shore'), { kind: 'platform' })
    expect(again).toEqual(drawn)
    expect(rockShoreFor(1, [[0.3, 0.3, 0.3]], Random.derive('x', 'rock-shore'), { overlook: true }).kind).toBe('cliff')
    for (let i = 0; i < 50; i++) expect(rockShoreFor(1, [[0.3, 0.3, 0.3]], Random.derive(`o${i}`, 'rock-shore'), { overlook: false }).kind).not.toBe('cliff')
  })

  it('finds the water on its bare profile (rockWaterline inverts bareRock)', () => {
    for (const p of shores) {
      const { rock, nearshoreSlope, seabedDepth } = p.coast
      for (const level of [-3, -1, -0.2, 0, 0.4, 1.5, 3]) {
        const s = rockWaterline(rock!, nearshoreSlope, seabedDepth, level)
        if (level < rock!.top + rock!.backHeight) expect(bareRock(rock!, nearshoreSlope, seabedDepth, s)).toBeCloseTo(level, 4)
      }
    }
  })

  it('falls from the plateau to the seabed, continuous at every join', () => {
    for (const p of shores) {
      const { rock, nearshoreSlope, seabedDepth } = p.coast
      const r = rock!
      const h = (s: number): number => bareRock(r, nearshoreSlope, seabedDepth, s)
      const foot = scarpFoot(r)
      for (const join of [-r.backWidth, 0, r.width, foot.s]) expect(Math.abs(h(join + 1e-6) - h(join - 1e-6))).toBeLessThan(1e-3)
      for (let s = -r.backWidth - 50; s < 600; s += 3) expect(h(s + 3)).toBeLessThanOrEqual(h(s) + 1e-9)
      expect(h(5000)).toBeGreaterThan(-seabedDepth - 0.01)
    }
  })
})

describe('rock shore days', () => {
  it('are land with surf but no beach: no terrace, bars, rips, cusps, ridges, reef or stones', () => {
    for (const p of shores) {
      const c = p.coast
      expect(hasLand(c) && hasSurfZone(c) && !hasBeach(c)).toBe(true)
      expect(c.terrace.width).toBe(0)
      expect(c.bars).toEqual([])
      expect([c.rips, c.cusps, c.reef, c.shelter]).toEqual([null, null, null, null])
      expect(c.ridges).toEqual([])
      expect(c.stoneSize).toBe(0)
      expect(p.title).toMatch(/rock platform|boulder shore|sea cliffs/)
    }
    expect(scene({ eclipse: null, coast: 'beach' }).coast.rock).toBeNull()
  })

  it("is near sea level at today's water (± the relief), rock behind and seabed in front", () => {
    for (const p of shores) {
      const c = p.coast
      const r = c.rock!
      const near: number[] = []
      for (let a = -200; a <= 200; a += 5) near.push(Math.abs(at(c, c.waterline, a)))
      near.sort((x, y) => x - y)
      expect(near[near.length >> 1]).toBeLessThan(r.relief + r.gully + 1.5)
      expect(at(c, scarpFoot(r).s + 150)).toBeLessThan(0)
      expect(Number.isFinite(at(c, -3000))).toBe(true)
    }
  })

  it('stands the camera on rock above the water, on top of the cliff on overlooks', () => {
    for (const p of shores) {
      const c = p.coast
      const ground = terrainHeight(c, 0, 0)
      expect(ground).toBeGreaterThan(-0.3)
      // Never on the back face.
      const u = c.distanceToWater + wobbleAtCamera(c)
      expect(u < -0.5 || u >= c.rock!.backWidth + 2 - 1e-9).toBe(true)
      if (c.rock!.kind === 'cliff') {
        expect(c.composition).toBe('overlook')
        expect(ground).toBeGreaterThan(14)
      } else expect(c.composition).not.toBe('overlook')
      const n = terrainNormal(c, 0, 0)
      expect(Number.isFinite(n[0] + n[1] + n[2])).toBe(true)
    }
  })

  it('makes overlook a cliff and a forced kind win', () => {
    for (const p of scenes({ ...base, composition: 'overlook' }, 10)) expect(p.coast.rock!.kind).toBe('cliff')
    for (const p of scenes({ ...base, composition: 'shoreline' }, 10)) expect(p.coast.rock!.kind).not.toBe('cliff')
    for (const p of scenes({ eclipse: null, rockShore: 'boulder' }, 5)) {
      expect(p.coast.type).toBe('rock-shore')
      expect(p.coast.rock!.kind).toBe('boulder')
    }
  })
})

describe('rock shore shares', () => {
  const land = allParams().filter(p => hasLand(p.coast))

  it('are about 37% of land days, a quarter of all days, the rest beaches (params.mjs --expect)', () => {
    expectShare(land, p => p.coast.type === 'rock-shore', 0.366)
    for (const p of land) expect(['beach', 'rock-shore', 'tidal-flat']).toContain(p.coast.type)
  })

  it('follow the place: fjords and the North Atlantic most, the tropics and barrier coasts least', () => {
    for (const p of PLACES) {
      const rock = p.coast['rock-shore'] ?? 0
      expect(rock + (p.coast.beach ?? 0) + (p.coast['tidal-flat'] ?? 0)).toBeCloseTo(1)
      if (p.biome === 'tropical') expect(rock).toBeLessThanOrEqual(0.2)
    }
    for (const id of ['norway-west', 'scotland', 'nova-scotia', 'iceland', 'california', 'british-columbia']) expect(placeNamed(id).coast['rock-shore']).toBeGreaterThanOrEqual(0.5)
    for (const id of ['florida-carolinas', 'wadden-north-sea', 'pei']) expect(placeNamed(id).coast['rock-shore']).toBeLessThanOrEqual(0.1)
    const tropical = land.filter(p => p.biome.name === 'tropical')
    expectShare(tropical, p => p.coast.type === 'rock-shore', 0.15)
    const nordic = land.filter(p => ['norway', 'britain-ireland', 'atlantic-canada'].includes(p.place.region) && !['pei', 'fundy', 'bristol-channel', 'morecambe-bay'].includes(p.place.id))
    expectShare(nordic, p => p.coast.type === 'rock-shore', 0.55)
  })

  it('make cliffs a third, each kind with its compositions', () => {
    const rocky = land.filter(p => p.coast.rock != null)
    expectShare(rocky, p => p.coast.rock!.kind === 'cliff', 0.33)
    for (const p of rocky) expect(p.coast.composition === 'overlook').toBe(p.coast.rock!.kind === 'cliff')
  })
})
