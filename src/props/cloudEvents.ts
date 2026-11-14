import { Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three'

import { dirFromAzEl } from '../params'
import type { RollCloudParams } from '../skyEvents'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { curvatureDrop } from './landforms'
import { fbm3 } from './noise'

// The Morning Glory roll cloud, still an opaque mesh (skyEvents.ts chooses
// it): solid, vertex-coloured, lit by the sun and faded with distance by
// aerial perspective. The shelf cloud moved into the volumetric clouds in
// 0.174 (shelfCloud.ts); the roll cloud may follow (plans/SHELF_VOLUMETRIC.md
// phase 7).

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
  // Cloud-like: the sky cube mirrors clouds, so the planar mirror leaves it out.
  mesh.userData.skyLike = true
  return [mesh]
}

