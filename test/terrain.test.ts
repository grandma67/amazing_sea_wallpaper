import { describe, expect, it } from 'vitest'

import { ridgeHeight, shoreToWorld, surfBreakDepth, surfCycle, surfSets, terrainHeight, terrainNormal, worldToShore } from '../src/terrain'
import type { SceneSpec } from '../src/sceneSpec'
import { scene, scenes } from './days'

// Every camera position on the shore, on days across the years.
const beaches = (['shoreline', 'along-beach', 'framed', 'overlook'] as const).flatMap(composition =>
  scenes({ composition }, 10).map(p => p.coast)
)

describe('shore frame', () => {
  it('worldToShore and shoreToWorld are inverses', () => {
    for (const coast of beaches) {
      for (const [s, a] of [[0, 0], [30, -120], [-60, 400], [500, 15]]) {
        const [x, z] = shoreToWorld(coast, s, a)
        const [s2, a2] = worldToShore(coast, x, z)
        expect(s2).toBeCloseTo(s, 6)
        expect(a2).toBeCloseTo(a, 6)
      }
    }
  })
})

describe('terrainHeight', () => {
  it('is deep water everywhere on the open sea', () => {
    const open = scene({ coast: 'open-sea' }).coast
    expect(terrainHeight(open, 0, 0)).toBe(-200)
  })

  it("is near sea level at today's waterline, land behind and seabed in front", () => {
    for (const coast of beaches) {
      const at = (s: number): number => terrainHeight(coast, ...shoreToWorld(coast, s, 0))
      const w = coast.waterline
      expect(Math.abs(at(w))).toBeLessThan(1.5)
      expect(at(w - coast.beachWidth * 0.5)).toBeGreaterThan(0)
      expect(at(w + 200)).toBeLessThan(0)
      expect(at(5000)).toBeGreaterThanOrEqual(-coast.seabedDepth - coast.terrace.height - coast.tide.level - 0.01)
      expect(Number.isFinite(at(-3000))).toBe(true)
    }
  })

  // Height skips each noise where its mask is 0 (dunes, hills, bumps, all the
  // land out at sea). A shortcut that skips too much shows as a step in the
  // ground; real ground, at its steepest, climbs 7 mm in these 2 cm.
  const SHORES: [name: string, spec: SceneSpec][] = [
    ['sand', { eclipse: null, coast: 'beach', beachMaterial: 'sand' }],
    ['a salt marsh', { eclipse: null, saltMarsh: true, place: 'wadden-north-sea' }],
    ['a platform', { eclipse: null, rockShore: 'platform', place: 'scotland' }],
    ['a cliff top', { eclipse: null, rockShore: 'cliff', place: 'scotland' }],
    ['boulders', { eclipse: null, rockShore: 'boulder', place: 'scotland' }],
    ['a tidal flat', { eclipse: null, coast: 'tidal-flat', place: 'wadden-north-sea' }]
  ]
  it.each(SHORES)('has no step from the waterline to the hills: %s', (_, spec) => {
    for (const { coast } of scenes(spec, 3)) {
      // A rock's face and rough band end 25 m behind its top; a flat's creeks at the marsh.
      const back = coast.rock != null ? coast.rock.backWidth + 26 : coast.flat != null ? coast.marsh!.width : -2
      for (const a of [30, -170]) {
        let before = NaN
        for (let s = -back - 620; s <= -back; s += 0.02) {
          const h = terrainHeight(coast, ...shoreToWorld(coast, s, a))
          if (Math.abs(h - before) > 0.012) expect.fail(`a step of ${Math.abs(h - before)} m at s = ${s}, a = ${a}`)
          before = h
        }
      }
    }
  })

  it('has upward normals', () => {
    for (const coast of beaches.slice(0, 10)) {
      const [x, z] = shoreToWorld(coast, -10, 30)
      const n = terrainNormal(coast, x, z)
      expect(Math.hypot(...n)).toBeCloseTo(1)
      expect(n[1]).toBeGreaterThan(0.5)
    }
  })
})

describe('storm ridges', () => {
  const stony = (['shingle', 'cobble', 'mixed'] as const).flatMap(beachMaterial =>
    scenes({ beachMaterial, composition: 'along-beach' }, 10).map(p => p.coast)
  )

  it('raise the stony beach at each crest, and nothing on sand', () => {
    for (const coast of stony) {
      // Without the cusps, which share the berm's band.
      const at = (s: number, a: number): number => terrainHeight({ ...coast, cusps: null }, ...shoreToWorld(coast, s, a))
      for (const r of coast.ridges) {
        // Find the crest near the drawn distance (it wanders ±1.5 m along the
        // shore) and check it stands above the straight line between its feet.
        let crest = r.distance
        for (let u = r.distance - 2; u <= r.distance + 2; u += 0.1) if (ridgeHeight(coast, u, 0) > ridgeHeight(coast, crest, 0)) crest = u
        const bump = ridgeHeight(coast, crest, 0)
        expect(bump).toBeGreaterThan(0.6 * r.height)
        expect(bump).toBeLessThan(1.3 * coast.ridges.reduce((sum, q) => sum + q.height, 0))
        // The terrain carries the ridge (heights only; bumps noise ±0.18 m),
        // where both feet are on land (a berm metres up a steep cobble face
        // has its seaward foot in the water).
        if (crest - 2.5 * r.width < 0) continue
        const feet = (at(-(crest - 2.5 * r.width), 0) + at(-(crest + 2.5 * r.width), 0)) / 2
        expect(at(-crest, 0) - feet).toBeGreaterThan(0.5 * bump - 0.4)
      }
      expect(Math.abs(at(0, 0))).toBeLessThan(1.5)
    }
    for (const coast of beaches.filter(c => c.material === 'sand')) {
      expect(coast.ridges).toEqual([])
      expect(ridgeHeight(coast, 10, 0)).toBe(0)
    }
  })

  it('make waves break right on the beach (a narrow surf zone)', () => {
    for (const coast of stony.filter(c => c.material !== 'mixed')) {
      expect(surfBreakDepth(coast) / coast.nearshoreSlope).toBeLessThan(30)
    }
  })
})

describe('surf', () => {
  it('keeps the cycle in [0, 1) and set strength in [0, 1]', () => {
    for (const coast of beaches.slice(0, 10)) {
      for (let s = 0; s < 200; s += 7) {
        const c = surfCycle(coast, s, s * 3)
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThan(1)
        const k = surfSets(coast, s, -s)
        expect(k).toBeGreaterThanOrEqual(0)
        expect(k).toBeLessThanOrEqual(1)
      }
    }
  })

  it('repeats every surf wavelength seaward', () => {
    const coast = beaches[0]
    const c0 = surfCycle(coast, 10, 5)
    const c1 = surfCycle(coast, 10 + coast.surfWavelength, 5)
    const d = Math.abs(c0 - c1)
    expect(Math.min(d, 1 - d)).toBeLessThan(1e-9)
  })
})
