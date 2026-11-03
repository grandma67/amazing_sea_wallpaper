// Where a world direction lands in the frame, without WebGL or the terrain:
// the composition's lens, yaw, pitch and roll, exactly as camera.ts builds
// the render camera (it takes its pitch from here). For anything placed in
// the sky by a choice in params.ts (meteors, planets, the Milky Way's core,
// an aurora) and for questions in params.mjs (`src.skyFrame.project(p, d)`).
//
// World frame: y up, azimuth 0 = −z, clockwise seen from above
// (dirFromAzEl). Normalised device coordinates: x right, y up, ±1 at the
// frame's edges.

import type { SceneParams } from './params'

export type Vec3 = [number, number, number]
type Lens = Pick<SceneParams, 'camera'>

const DEG = Math.PI / 180

/** Unit vector toward azimuth/elevation (degrees), world frame. */
export function dirFromAzEl(azDeg: number, elDeg: number): Vec3 {
  const az = azDeg * DEG
  const el = elDeg * DEG
  return [Math.cos(el) * Math.sin(az), Math.sin(el), -Math.cos(el) * Math.cos(az)]
}

/** Azimuth (deg, 0–360) and elevation (deg) of a world direction. */
export function azEl(d: Vec3): { azDeg: number; elDeg: number } {
  return {
    azDeg: ((Math.atan2(d[0], -d[2]) / DEG) % 360 + 360) % 360,
    elDeg: Math.asin(Math.max(-1, Math.min(1, d[1] / Math.hypot(...d)))) / DEG
  }
}

/** The frame's full field (radians): the 36 mm side lies along the long side. */
export function frameFov(p: Lens): { h: number; v: number } {
  const longHalf = Math.atan(18 / p.camera.focalLengthMm)
  const a = p.camera.aspect
  return a >= 1 ? { h: 2 * longHalf, v: 2 * Math.atan(Math.tan(longHalf) / a) } : { h: 2 * Math.atan(Math.tan(longHalf) * a), v: 2 * longHalf }
}

/** Camera pitch (radians, up positive) that puts the horizon, dipped by
 * `dip` (radians, from the eye's height), at `horizonFraction` down the
 * frame. camera.ts uses this. */
export function cameraPitch(p: Lens, dip = 0): number {
  const { v } = frameFov(p)
  return -dip - Math.atan((1 - 2 * p.camera.horizonFraction) * Math.tan(v / 2))
}

/** NDC of a world direction (null if behind the camera). `dip`: the
 * horizon's dip for the eye's height (camera.ts; ~0.04° at 2 m, 0.4° at
 * 160 m), 0 when unknown. */
export function project(p: Lens, d: Vec3, dip = 0): [number, number] | null {
  const { h, v } = frameFov(p)
  const pitch = cameraPitch(p, dip)
  const yaw = p.camera.headingDeg * DEG
  const roll = p.camera.rollDeg * DEG
  // Undo the yaw (about y), the pitch (about x), then the roll (about z):
  // the inverse of camera.ts's 'YXZ' Euler rotation.
  const x1 = d[0] * Math.cos(yaw) + d[2] * Math.sin(yaw)
  const z1 = -d[0] * Math.sin(yaw) + d[2] * Math.cos(yaw)
  const y2 = d[1] * Math.cos(pitch) + z1 * Math.sin(pitch)
  const z2 = -d[1] * Math.sin(pitch) + z1 * Math.cos(pitch)
  const x3 = x1 * Math.cos(roll) + y2 * Math.sin(roll)
  const y3 = -x1 * Math.sin(roll) + y2 * Math.cos(roll)
  if (z2 >= -1e-9) return null
  return [x3 / -z2 / Math.tan(h / 2), y3 / -z2 / Math.tan(v / 2)]
}

/** World direction through NDC (nx, ny): the inverse of `project`. */
export function unproject(p: Lens, nx: number, ny: number, dip = 0): Vec3 {
  const { h, v } = frameFov(p)
  const pitch = cameraPitch(p, dip)
  const yaw = p.camera.headingDeg * DEG
  const roll = p.camera.rollDeg * DEG
  const x3 = nx * Math.tan(h / 2)
  const y3 = ny * Math.tan(v / 2)
  const z2 = -1
  // Redo the roll, the pitch, then the yaw.
  const x1 = x3 * Math.cos(roll) - y3 * Math.sin(roll)
  const y2 = x3 * Math.sin(roll) + y3 * Math.cos(roll)
  const y = y2 * Math.cos(pitch) - z2 * Math.sin(pitch)
  const z1 = y2 * Math.sin(pitch) + z2 * Math.cos(pitch)
  const x = x1 * Math.cos(yaw) - z1 * Math.sin(yaw)
  const z = x1 * Math.sin(yaw) + z1 * Math.cos(yaw)
  const l = Math.hypot(x, y, z)
  return [x / l, y / l, z / l]
}

/** Is a direction inside the inner `margin` of the frame (NDC) and above
 * `minElevationDeg`? */
export function inSky(p: Lens, d: Vec3, margin = 0.9, minElevationDeg = 4, dip = 0): boolean {
  const ndc = project(p, d, dip)
  return ndc != null && Math.abs(ndc[0]) < margin && Math.abs(ndc[1]) < margin && d[1] > Math.sin(minElevationDeg * DEG)
}

/** Pixel (x right, y down, from the top-left) of a direction in a
 * `width` × `height` image, or null if out of frame. */
export function pixelOf(p: Lens, d: Vec3, width: number, height: number, dip = 0): [number, number] | null {
  const ndc = project(p, d, dip)
  if (ndc == null || Math.abs(ndc[0]) > 1 || Math.abs(ndc[1]) > 1) return null
  return [((ndc[0] + 1) / 2) * width, ((1 - ndc[1]) / 2) * height]
}
