import { DoubleSide, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three'

import { cloudBase } from '../cloudTypes'
import { dirFromAzEl } from '../params'
import type { RollCloudParams, ShelfCloudParams } from '../skyEvents'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { curvatureDrop } from './landforms'
import { fbm3 } from './noise'

// Cloud events drawn as opaque meshes (skyEvents.ts chooses them): a mesh
// can't be see-through here (it wouldn't composite with the volumetric
// clouds and haze), so they're solid, vertex-coloured, lit by the sun and
// faded with distance by aerial perspective.

type RGB = [number, number, number]

/**
 * The shelf: a long wedge across the view along the storm's gust front.
 * Seen from ahead: a smooth, layered face rising from a sharp lip a few
 * hundred metres up to the storm's base, its underside sloping up into the
 * storm. Built as a sheet of
 * profiles along the front, bowed toward the camera in the middle.
 */
export function shelfGeometry(shelf: ShelfCloudParams, toStorm: Vector3, origin: Vector3, base: number): MeshBuilder {
  const b = new MeshBuilder()
  const across = new Vector3(-toStorm.z, 0, toStorm.x)
  const h = shelf.lipHeightM
  const D = shelf.depthM
  // It hangs under the storm's base (the volumetric deck hides anything
  // above it): from the lip the face rises in tiers to the base, and the
  // underside slopes up from the lip into the storm.
  const top = Math.max(h + 150, base + 60)
  const rise = top - h
  // (back from the lip toward the storm, up), from the far underside
  // through the lip and up the face to the top.
  const profile: [number, number, RGB][] = [
    [D, h + rise * 0.8, [0.08, 0.085, 0.1]],
    [D * 0.6, h + rise * 0.6, [0.1, 0.105, 0.12]],
    [D * 0.25, h + rise * 0.3, [0.13, 0.14, 0.16]],
    [60, h + 10, [0.3, 0.31, 0.34]],
    [0, h, [0.62, 0.63, 0.66]]
  ]
  const tiers = shelf.tiers
  const step = rise / (tiers + 1)
  for (let i = 1; i <= tiers; i++) {
    // Each shelf: a sloping face, then a small step back.
    const y0 = h + (i - 1) * step
    profile.push([i * 400 - 250, y0 + step * 0.7, [0.72, 0.73, 0.76]], [i * 400, y0 + step * 0.8, [0.5, 0.51, 0.55]], [i * 400 + 60, y0 + step, [0.66, 0.67, 0.7]])
  }
  profile.push([tiers * 400 + 700, top, [0.6, 0.61, 0.64]], [D, top + 40, [0.5, 0.51, 0.54]])

  const half = 40_000
  const stations = 160
  const rows: number[][] = []
  for (let k = 0; k <= stations; k++) {
    const s = -half + (2 * half * k) / stations
    // Bowed toward the camera, with scallops along the lip.
    const bow = -1500 * (1 - (s / half) ** 2)
    const wobble = 350 * (fbm3(s / 6000, 0.5, 0.5, shelf.seed) - 0.5)
    const lift = 120 * (fbm3(s / 3000, 1.5, 0.5, shelf.seed) - 0.5)
    const row = profile.map(([back, up, color], j) => {
      const p = origin
        .clone()
        .addScaledVector(across, s)
        .addScaledVector(toStorm, back + bow + wobble)
      const shade = 0.92 + 0.16 * fbm3(s / 1500, j * 0.7, 0.5, shelf.seed)
      p.y = up + lift - curvatureDrop(p.x - origin.x, p.z - origin.z)
      return b.vertex(p, [color[0] * shade, color[1] * shade, color[2] * shade])
    })
    rows.push(row)
  }
  for (let k = 0; k < stations; k++)
    for (let j = 0; j < profile.length - 1; j++) b.quad(rows[k][j], rows[k + 1][j], rows[k + 1][j + 1], rows[k][j + 1])
  return b
}

export function createShelfCloud(ctx: PropContext): Object3D[] {
  const shelf = ctx.params.storm?.shelf
  if (shelf == null) return []
  const [dx, , dz] = dirFromAzEl(shelf.azimuthDeg, 0)
  const toStorm = new Vector3(dx, 0, dz)
  const origin = ctx.camera.position.clone().setY(0).addScaledVector(toStorm, shelf.distanceM)
  const mesh = new Mesh(shelfGeometry(shelf, toStorm, origin, cloudBase(ctx.params.weather.formations, 'cumulonimbus')).build(), new MeshStandardMaterial({ vertexColors: true, roughness: 1, side: DoubleSide }))
  mesh.frustumCulled = false
  mesh.userData.distant = true
  return [mesh]
}

/**
 * Morning Glory: one to three long tubes of cloud lying across the view,
 * kilometres long, ~1 km thick, base a few hundred metres up. A smooth,
 * lumpy roll, lit on top and shaded underneath, with a ragged flatter base.
 */
export function rollGeometry(roll: RollCloudParams, axis: Vector3, centre: Vector3): MeshBuilder {
  const b = new MeshBuilder()
  const toBack = new Vector3(axis.z, 0, -axis.x)
  for (let k = 0; k < roll.rolls; k++) {
    const r = (roll.diameterM / 2) * (1 - k * 0.15)
    const mid = centre.clone().addScaledVector(toBack, k * roll.spacingM)
    const half = 45_000
    const steps = 240
    const path: Vector3[] = []
    for (let i = 0; i <= steps; i++) {
      const s = -half + (2 * half * i) / steps
      const p = mid.clone().addScaledVector(axis, s).addScaledVector(toBack, 600 * (fbm3(s / 9000, k, 0.5, roll.seed) - 0.5))
      p.y = roll.baseM + r + 120 * (fbm3(s / 4000, k + 3, 0.5, roll.seed) - 0.5) - curvatureDrop(p.x - centre.x, p.z - centre.z)
      path.push(p)
    }
    const rings = b.tube(
      path,
      (t, angle) => {
        // Lumpy along and round; the base (sin < 0) flattened.
        const lumps =
          1 +
          0.3 * (fbm3(t * 40, Math.cos(angle) * 1.5, Math.sin(angle) * 1.5, roll.seed + k) - 0.5) +
          0.15 * (fbm3(t * 300, Math.cos(angle) * 4, Math.sin(angle) * 4, roll.seed + k) - 0.5)
        const flat = Math.sin(angle) < -0.4 ? 0.85 : 1
        return r * lumps * flat
      },
      (t, angle) => {
        // Brighter on top, grey underneath.
        const up = Math.sin(angle)
        // Bands along the roll, as the air turns over.
        const bands = 0.08 * Math.sin(angle * 3 + 6 * fbm3(t * 80, 0.5, 0.5, roll.seed))
        const v = 0.66 + 0.2 * up + bands + 0.12 * (fbm3(t * 120, angle, 0.5, roll.seed) - 0.5)
        return [v, v, v * 1.02]
      },
      28
    )
    b.cap(rings[0], axis.clone().negate(), [0.6, 0.6, 0.62])
    b.cap(rings[rings.length - 1], axis, [0.6, 0.6, 0.62])
  }
  return b
}

export function createRollCloud(ctx: PropContext): Object3D[] {
  const roll = ctx.params.rollCloud
  if (roll == null) return []
  const [ax, , az] = dirFromAzEl(roll.axisDeg, 0)
  const axis = new Vector3(ax, 0, az)
  const [hx, , hz] = dirFromAzEl(ctx.params.camera.headingDeg, 0)
  const centre = ctx.camera.position.clone().setY(0).addScaledVector(new Vector3(hx, 0, hz), roll.distanceM)
  // Tubes stack away from the camera.
  if (new Vector3(axis.z, 0, -axis.x).dot(new Vector3(hx, 0, hz)) < 0) axis.negate()
  const mesh = new Mesh(rollGeometry(roll, axis, centre).build(), new MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
  mesh.frustumCulled = false
  mesh.userData.distant = true
  return [mesh]
}

