import { ClampToEdgeWrapping, DataTexture, LinearFilter, Matrix4, RedFormat, UnsignedByteType, Vector3, type InstancedMesh } from 'three'

import type { VegetationKind } from '../biome'
import type { SceneParams } from '../params'
import { phenologyFor, plantSeason } from '../phenology'
import type { PropContext } from './context'

// Skylight under tree crowns (SHADOWS.md phase 4.1). The sun's shade under a
// tree comes from the shadow maps; what they can't give is that the ground
// there also sees less sky, so the shade under a crown is deeper than a
// shadow in the open. Each crown is a disc of leaves at its height; the sky
// it hides from a level point on the ground is the disc's view factor (the
// cosine-weighted share of the hemisphere it fills) times how much light the
// leaves stop. Crowns hide the sky independently, so openness is the product.
// Baked into a world map near the camera (≥ 0.25 m a texel): the terrain's
// skylight and ground-level props' indirect light read it (terrain.ts
// skyOpenMap, propShade.ts). Only which crowns go in reads the camera.

/** How much diffuse skylight a crown in full leaf stops, and where its leaves
 * are (the disc's height as a share of the plant's height). Estimates: crown
 * porosity of a leafy tree is ~10–30% (urban tree studies); palms and
 * acacias are open, cypresses dense. Grass casts no canopy. */
export const CROWN: Partial<Record<VegetationKind, { opacity: number; height: number }>> = {
  broadleaf: { opacity: 0.8, height: 0.65 },
  olive: { opacity: 0.7, height: 0.65 },
  birch: { opacity: 0.6, height: 0.65 },
  'stone-pine': { opacity: 0.8, height: 0.8 },
  conifer: { opacity: 0.75, height: 0.45 },
  cypress: { opacity: 0.85, height: 0.5 },
  palm: { opacity: 0.5, height: 0.9 },
  pandanus: { opacity: 0.6, height: 0.75 },
  acacia: { opacity: 0.5, height: 0.8 },
  bush: { opacity: 0.7, height: 0.55 }
}
/** A bare deciduous crown (twigs and branches) stops this share of what it
 * would in leaf (estimate). */
const BARE = 0.3
/** Crowns further than this from the camera (m) aren't in the map: the ground
 * under them is a few pixels and mostly hidden by the crowns themselves. */
export const MAP_RANGE = 200
const MAP_SIZE = 1024
const MAP_TEXEL = 0.25
/** A crown's reach is cut where it hides less than this of the sky. */
const MIN_HIDDEN = 0.01
/** The disc is never taken closer to the point than this (m): the view factor
 * runs to 1 right under it. */
const MIN_HEIGHT = 0.4

export interface Crown {
  /** Centre of the disc (world m); y is its height above the plant's foot. */
  x: number
  z: number
  height: number
  radius: number
  /** Share of the skylight the disc stops where it covers the sky. */
  opacity: number
}

/**
 * The view factor from a level point to a level disc of radius r, h above it
 * and d off its axis: the cosine-weighted share of the sky it fills, 0–1.
 * (Differential area to a parallel coaxial disc, offset.)
 */
export function discViewFactor(r: number, h: number, d: number): number {
  const a = h * h + d * d + r * r
  const root = Math.sqrt(Math.max(a * a - 4 * r * r * d * d, 1e-12))
  return Math.max(0, 0.5 * (1 - (h * h + d * d - r * r) / root))
}

/** How far out (m) a crown still hides MIN_HIDDEN of the sky. */
export function crownReach(c: Crown): number {
  const h = Math.max(c.height, MIN_HEIGHT)
  // Far off, F ≈ r²h² / (d² + h²)².
  const d2 = (c.radius * h) / Math.sqrt(MIN_HIDDEN / c.opacity) - h * h
  return Math.min(Math.max(c.radius, Math.sqrt(Math.max(d2, 0))), 40)
}

/** The share of the sky a level point on the ground sees past the crowns. */
export function skyOpenness(crowns: readonly Crown[], x: number, z: number): number {
  let open = 1
  for (const c of crowns) {
    const d = Math.hypot(x - c.x, z - c.z)
    if (d > crownReach(c)) continue
    open *= 1 - c.opacity * discViewFactor(c.radius, Math.max(c.height, MIN_HEIGHT), d)
  }
  return open
}

/** How much a kind's crown stops today: less as deciduous leaves fall. */
export function crownOpacity(kind: VegetationKind, params: SceneParams): number {
  const crown = CROWN[kind]
  if (crown == null) return 0
  const season = plantSeason(kind, phenologyFor(params))
  const leafless = season == null ? 0 : season.deciduous * (1 - season.on)
  return crown.opacity * (1 - leafless * (1 - BARE))
}

/** The crowns of the plants (createVegetation's meshes), each disc placed by
 * its instance's matrix, so a leaning palm's is over where its fronds are. */
export function crownsOf(params: SceneParams, plants: readonly InstancedMesh[]): Crown[] {
  const crowns: Crown[] = []
  const m = new Matrix4()
  const centre = new Vector3()
  const foot = new Vector3()
  const s = new Vector3()
  for (const mesh of plants) {
    const kind = mesh.userData.plantKind as VegetationKind | undefined
    const crown = kind == null ? undefined : CROWN[kind]
    if (kind == null || crown == null) continue
    const opacity = crownOpacity(kind, params)
    if (opacity <= 0) continue
    mesh.geometry.computeBoundingBox()
    const box = mesh.geometry.boundingBox!
    const radius = (box.max.x - box.min.x + box.max.z - box.min.z) / 4
    const local = new Vector3((box.min.x + box.max.x) / 2, Math.max(0, box.max.y) * crown.height, (box.min.z + box.max.z) / 2)
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m)
      s.setFromMatrixColumn(m, 0)
      // Buried grass and hidden plants are scaled to nothing.
      if (s.lengthSq() === 0) continue
      centre.copy(local).applyMatrix4(m)
      foot.set(0, 0, 0).applyMatrix4(m)
      crowns.push({ x: centre.x, z: centre.z, height: centre.y - foot.y, radius: radius * s.length(), opacity })
    }
  }
  return crowns
}

export interface SkyOpenField {
  texture: DataTexture
  /** x0, z0, 1/width, 1/depth of the map (world m). */
  rect: [number, number, number, number]
  /** The darkest texel, for tests and debug. */
  least: number
}

/** The map of skylight under the crowns near the camera; null with none. */
export function skyOpenField(ctx: PropContext, plants: readonly InstancedMesh[]): SkyOpenField | null {
  const crowns = crownsOf(ctx.params, plants).filter(c => {
    const reach = crownReach(c)
    return ctx.distance(c.x, c.z) - reach < MAP_RANGE && ctx.visible(c.x, ctx.ground(c.x, c.z), c.z, reach + c.height)
  })
  if (crowns.length === 0) return null
  let [x0, x1, z0, z1] = [Infinity, -Infinity, Infinity, -Infinity]
  for (const c of crowns) {
    const r = crownReach(c)
    x0 = Math.min(x0, c.x - r)
    x1 = Math.max(x1, c.x + r)
    z0 = Math.min(z0, c.z - r)
    z1 = Math.max(z1, c.z + r)
  }
  // A rim of open sky, so past the map (clamped) nothing is hidden.
  const extent = Math.max(x1 - x0, z1 - z0, 1)
  const size = Math.min(MAP_SIZE, Math.ceil(extent / MAP_TEXEL) + 4)
  const texel = extent / (size - 4)
  x0 -= 2 * texel
  z0 -= 2 * texel
  const width = size * texel
  const open = new Float32Array(size * size).fill(1)
  for (const c of crowns) {
    const r = crownReach(c)
    const h = Math.max(c.height, MIN_HEIGHT)
    const [i0, i1] = [Math.floor((c.x - r - x0) / texel), Math.ceil((c.x + r - x0) / texel)]
    const [j0, j1] = [Math.floor((c.z - r - z0) / texel), Math.ceil((c.z + r - z0) / texel)]
    for (let j = Math.max(1, j0); j <= Math.min(size - 2, j1); j++) {
      const dz = (j + 0.5) * texel + z0 - c.z
      for (let i = Math.max(1, i0); i <= Math.min(size - 2, i1); i++) {
        const dx = (i + 0.5) * texel + x0 - c.x
        const d = Math.sqrt(dx * dx + dz * dz)
        if (d > r) continue
        open[j * size + i] *= 1 - c.opacity * discViewFactor(c.radius, h, d)
      }
    }
  }
  const data = new Uint8Array(size * size)
  let least = 1
  for (let k = 0; k < open.length; k++) {
    least = Math.min(least, open[k])
    data[k] = Math.round(255 * open[k])
  }
  const texture = new DataTexture(data, size, size, RedFormat, UnsignedByteType)
  texture.magFilter = LinearFilter
  texture.minFilter = LinearFilter
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.needsUpdate = true
  return { texture, rect: [x0, z0, 1 / width, 1 / width], least }
}
