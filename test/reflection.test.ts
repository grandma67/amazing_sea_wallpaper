import { PerspectiveCamera, Vector3, Vector4 } from 'three'
import { describe, expect, it } from 'vitest'

import { mirrorCamera } from '../src/reflection'
import { reflectionExtinction, reflectionTransmittance } from '../src/seaHaze'

// The ocean shader's mirror lookup (ocean.ts, plans/REFLECTION.md phase 2),
// mirrored in TS: follow the reflected ray R from the sea point P for t (the
// mirrored ray's length past the water) and project the hit into the
// reflection texture.

function camera(fovDeg: number, height = 6): PerspectiveCamera {
  const c = new PerspectiveCamera(fovDeg, 16 / 9, 0.1, 200_000)
  c.position.set(0, height, 0)
  c.lookAt(0, height - 30, -3000) // a little below the horizon
  c.updateMatrixWorld()
  return c
}

function uvOf(cam: PerspectiveCamera, world: Vector3): [number, number] {
  const { textureMatrix } = mirrorCamera(cam)
  const v = new Vector4(world.x, world.y, world.z, 1).applyMatrix4(textureMatrix)
  return [v.x / v.w, v.y / v.w]
}

/** The shader's lookup for a sea point at distance `d` ahead, a wave normal
 * tilted by `tilt` rad toward the camera, and a hit `t` m past the water. */
function lookup(cam: PerspectiveCamera, d: number, tilt: number, t: number): [number, number] {
  const P = new Vector3(0, 0, -d)
  const V = cam.position.clone().sub(P).normalize()
  const N = new Vector3(0, Math.cos(tilt), Math.sin(tilt)) // +z points back at the camera
  const R = V.clone().negate().reflect(N)
  R.y = Math.abs(R.y)
  return uvOf(cam, P.clone().addScaledVector(R, t))
}

describe('mirror lookup along the reflected ray', () => {
  it('lands on the sea point itself on a flat sea, however far the ray goes', () => {
    const cam = camera(30)
    const base = uvOf(cam, new Vector3(0, 0, -500))
    for (const t of [5, 500, 5000, 1e5]) {
      const [u, v] = lookup(cam, 500, 0, t)
      expect(u).toBeCloseTo(base[0], 6)
      expect(v).toBeCloseTo(base[1], 6)
    }
  })

  it('turns by twice the tilt, scaled by t / (D + t): sharp at the contact, full far up', () => {
    const cam = camera(30)
    const vFov = 2 * Math.tan((15 * Math.PI) / 180)
    const flatV = lookup(cam, 300, 0, 2000)[1]
    const tilt = 0.002
    // Texture v spans 2·tan(fov/2) of image plane: × that is the angle near the centre.
    const angle = (t: number) => Math.abs(lookup(cam, 300, tilt, t)[1] - lookup(cam, 300, 0, t)[1]) * vFov
    const D = Math.hypot(300, 6)
    for (const t of [30, 300, 3000]) expect(angle(t) / ((2 * tilt * t) / (D + t))).toBeCloseTo(1, 1)
    expect(angle(1)).toBeLessThan(angle(3000) / 50)
    expect(flatV).toBeGreaterThan(0)
  })

  it('moves the image by the same angle with any lens', () => {
    const angle = (fov: number) => {
      const cam = camera(fov)
      const vFov = 2 * Math.tan((fov / 2) * (Math.PI / 180))
      return Math.abs(lookup(cam, 300, 0.002, 2000)[1] - lookup(cam, 300, 0, 2000)[1]) * vFov
    }
    expect(angle(15) / angle(60)).toBeCloseTo(1, 1)
  })
})

// Phase 4: the mirror image hazed over its path from the object to the water
// (ocean.ts reflectionHaze, seaHaze.ts reflectionTransmittance).
describe('reflection haze', () => {
  it('matches the plan for 2003-03-11 (visibility 32 km, sea haze)', () => {
    const ext = reflectionExtinction(32, true)
    expect(ext.haze + ext.air[1]).toBeCloseTo(3.912 / 32000, 8)
    expect(reflectionTransmittance(ext, 2900)[1]).toBeCloseTo(0.7, 2)
    expect(reflectionTransmittance(ext, 7350)[1]).toBeCloseTo(0.41, 2)
    expect(reflectionTransmittance(ext, 37000)[1]).toBeLessThan(0.015)
    // Blue fades first.
    const [r, g, b] = reflectionTransmittance(ext, 7350)
    expect(r).toBeGreaterThan(g)
    expect(g).toBeGreaterThan(b)
  })

  it('has only the air on clear days without the sea haze', () => {
    const ext = reflectionExtinction(32, false)
    expect(ext.haze).toBe(0)
    const T = reflectionTransmittance(ext, 34000)
    // The plan's clear-day mountain at 34 km: 0.71 / 0.55 / 0.28.
    expect(T[0]).toBeCloseTo(0.71, 2)
    expect(T[1]).toBeCloseTo(0.54, 1)
    expect(T[2]).toBeCloseTo(0.28, 2)
  })

  it('thins the sea haze with height, as takram does', () => {
    const ext = reflectionExtinction(20, true)
    const low = reflectionTransmittance(ext, 5000, 0)[1]
    const high = reflectionTransmittance(ext, 5000, 1000)[1]
    expect(high).toBeGreaterThan(low)
    expect(-Math.log(high) / 5000 - ext.air[1]).toBeCloseTo(ext.haze * (1 - Math.exp(-1)), 8)
  })
})
