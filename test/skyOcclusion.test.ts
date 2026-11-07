import { BoxGeometry, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { createVegetation } from '../src/props/vegetation'
import { CROWN, crownOpacity, crownReach, crownsOf, discViewFactor, skyOpenField, skyOpenness, type Crown } from '../src/props/skyOcclusion'
import type { SceneSpec } from '../src/sceneSpec'
import { scene, view } from './days'

const spec = (extra: SceneSpec = {}): SceneSpec => ({ eclipse: null, place: 'brittany', composition: 'framed', timeOfDay: 'midday', fog: null, ...extra, props: { vegetation: ['broadleaf'], ...extra.props } })

describe('discViewFactor', () => {
  it('is r² / (r² + h²) right under the disc', () => {
    expect(discViewFactor(3, 6, 0)).toBeCloseTo(9 / 45, 6)
    expect(discViewFactor(4, 1e-3, 0)).toBeCloseTo(1, 3)
  })

  it('falls off to the side and tends to r²h² / (d² + h²)² far away', () => {
    const f = [0, 2, 5, 10, 30].map(d => discViewFactor(3, 6, d))
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeLessThan(f[i - 1])
    expect(discViewFactor(1, 5, 60) / ((1 * 25) / (3600 + 25) ** 2)).toBeCloseTo(1, 1)
  })
})

describe('skyOpenness', () => {
  const crown: Crown = { x: 0, z: 0, height: 6, radius: 4, opacity: 0.8 }

  it('hides the sky under a crown by its opacity times its view factor, and none past its reach', () => {
    expect(skyOpenness([crown], 0, 0)).toBeCloseTo(1 - 0.8 * discViewFactor(4, 6, 0), 6)
    expect(skyOpenness([crown], crownReach(crown) + 0.1, 0)).toBe(1)
    // The cut is where it hid only a sliver.
    expect(1 - skyOpenness([crown], crownReach(crown) - 0.1, 0)).toBeLessThan(0.02)
  })

  it('multiplies crowns: two together leave less sky than either', () => {
    const other = { ...crown, x: 3 }
    expect(skyOpenness([crown, other], 1.5, 0)).toBeCloseTo(skyOpenness([crown], 1.5, 0) * skyOpenness([other], 1.5, 0), 6)
  })
})

describe('crowns', () => {
  it('give every kind but grass a canopy, mostly-closed but never opaque', () => {
    expect(CROWN.grass).toBeUndefined()
    for (const c of Object.values(CROWN)) {
      expect(c.opacity).toBeGreaterThanOrEqual(0.4)
      expect(c.opacity).toBeLessThan(1)
      expect(c.height).toBeGreaterThan(0)
      expect(c.height).toBeLessThanOrEqual(1)
    }
  })

  it('let more sky through a bare deciduous wood in winter than in summer', () => {
    const summer = scene(spec(), '2025-07-15')
    const winter = scene(spec(), '2025-01-15')
    expect(crownOpacity('broadleaf', winter)).toBeLessThan(0.5 * crownOpacity('broadleaf', summer))
    // Evergreens keep theirs.
    expect(crownOpacity('cypress', winter)).toBe(crownOpacity('cypress', summer))
  })

  it("follow each instance's matrix: a leaning tree's crown is over its fronds, not its foot", () => {
    const geometry = new BoxGeometry(4, 10, 4).translate(2, 5, 0)
    const mesh = new InstancedMesh(geometry, new MeshStandardMaterial(), 2)
    mesh.userData.plantKind = 'palm'
    mesh.setMatrixAt(0, new Matrix4().compose(new Vector3(10, 1, 0), new Quaternion(), new Vector3(1, 1, 1)))
    mesh.setMatrixAt(1, new Matrix4().compose(new Vector3(0, 0, 0), new Quaternion(), new Vector3(0, 0, 0)))
    const crowns = crownsOf(scene(spec()), [mesh])
    // The hidden (zero-scaled) one is left out.
    expect(crowns).toHaveLength(1)
    expect(crowns[0].x).toBeCloseTo(12)
    expect(crowns[0].height).toBeCloseTo(10 * CROWN.palm!.height)
    expect(crowns[0].radius).toBeCloseTo(2)
  })
})

describe('the map on a day', () => {
  it('darkens the ground under a framed shot\'s trees and is open at its rim', () => {
    const ctx = view(spec(), 1080, '2025-07-15')
    const field = skyOpenField(ctx, createVegetation(ctx))
    expect(field).not.toBeNull()
    expect(field!.least).toBeLessThan(0.85)
    expect(field!.least).toBeGreaterThan(0.05)
    const { data, width } = field!.texture.image as { data: Uint8Array; width: number }
    for (let i = 0; i < width; i++) {
      expect(data[i]).toBe(255)
      expect(data[(width - 1) * width + i]).toBe(255)
    }
  })

  it('is null with no plants', () => {
    const ctx = view(spec({ props: { vegetation: [] } }), 1080)
    expect(skyOpenField(ctx, [])).toBeNull()
  })
})
