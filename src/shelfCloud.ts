import { Vector2, type Vector3 } from 'three'

import { dirFromAzEl } from './params'
import type { ShelfCloudParams } from './skyEvents'
import { hashCell, seedInt } from './skyMirror'

// The shelf cloud as cloud: a density the volumetric clouds draw (the shader
// patch is in phase 2 of plans/SHELF_VOLUMETRIC.md). This file holds the
// shape on the CPU: the frame it's measured in, its density at a point, and
// the constants the GLSL is written from, so both sides share one source.
// The shader gets each sample's world position from its ECEF one (takram's
// ecefToWorldMatrix), not from the weather map's uv: the cube-sphere uv has a
// seam on cube edges (latitude 45° at our longitude 0), and a linear uv →
// metres map across it put points tens of kilometres off.
//
// The cross-section (photos and sources in the plan): a lip a few hundred
// metres up, the leading edge; the face rising from it and sloping back
// toward the storm; the underside rising from the lip into the storm; the
// top merging into the storm's base. Along the front it bows toward the
// camera in the middle and wanders in kilometre scallops.

/** Every number of the shape, written into the GLSL as is. */
export const SHELF_SHAPE = {
  /** Half the front's length (m), and how far its ends fade. */
  halfLengthM: 40_000,
  endFadeM: 5_000,
  /** How far the middle bows toward the camera (m), as the 0.172 mesh. */
  bowM: 1_500,
  /** Scallops of the lip line along the front: amplitude (m) and size (m). */
  wobbleM: 350,
  wobbleScaleM: 6_000,
  /** The face's run back toward the storm from lip to top (m): a base and
   * per tier. */
  faceRunM: 500,
  faceRunPerTierM: 400,
  /** The top stands this far above the storm's base (m), inside the deck. */
  topAboveBaseM: 300,
  /** Of the rise from lip to top, how much the underside climbs over its depth. */
  undersideRise: 0.75,
  /** Edge widths (m): the face and lip, the underside, the top. */
  faceEdgeM: 40,
  undersideEdgeM: 60,
  topEdgeM: 80,
  /** The back end fades into the storm's deck over this (m). */
  backFadeM: 800
} as const

/** Where the shelf is measured from, in world x/z (x north, z east): the lip
 * line's middle, the along-front axis and the axis toward the storm. */
export interface ShelfFrame {
  origin: Vector2
  across: Vector2
  toStorm: Vector2
}

export function shelfFrame(shelf: ShelfCloudParams, camera: Vector3): ShelfFrame {
  const [dx, , dz] = dirFromAzEl(shelf.azimuthDeg, 0)
  const toStorm = new Vector2(dx, dz)
  return {
    origin: new Vector2(camera.x, camera.z).addScaledVector(toStorm, shelf.distanceM),
    across: new Vector2(-dz, dx),
    toStorm
  }
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** 1D value noise in [0, 1], cells of 1 (smoothstep between cell hashes):
 * the GLSL builds it the same way on `hashGlsl`. */
export function valueNoise1(seed: number, x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const t = f * f * (3 - 2 * f)
  return hashCell(seed, i) * (1 - t) + hashCell(seed, i + 1) * t
}

/** Height of the storm's base the shelf hangs from, and the shelf's top (m). */
export function shelfTop(base: number): number {
  return base + SHELF_SHAPE.topAboveBaseM
}

/**
 * The shelf's density at a world point (x, z, height above the sea), 0–1:
 * 1 inside the wedge, falling to 0 over its soft edges, 0 off its ends and
 * past its back (where the storm's deck takes over).
 */
export function shelfDensity(frame: ShelfFrame, shelf: ShelfCloudParams, base: number, x: number, z: number, heightM: number): number {
  const S = SHELF_SHAPE
  const dx = x - frame.origin.x
  const dz = z - frame.origin.y
  const s = dx * frame.across.x + dz * frame.across.y
  const b = dx * frame.toStorm.x + dz * frame.toStorm.y
  const ends = 1 - smoothstep(S.halfLengthM - S.endFadeM, S.halfLengthM, Math.abs(s))
  if (ends <= 0) return 0
  const seed = seedInt(shelf.seed)
  // Distance behind the lip line, which bows toward the camera and wanders.
  const bow = -S.bowM * (1 - (s / S.halfLengthM) ** 2)
  const wobble = S.wobbleM * (valueNoise1(seed, s / S.wobbleScaleM) - 0.5)
  const back = b - bow - wobble
  const lip = shelf.lipHeightM
  const top = shelfTop(base)
  const rise = top - lip
  // Face: how far back the face stands at this height.
  const u = Math.min(1, Math.max(0, (heightM - lip) / rise))
  const run = S.faceRunM + S.faceRunPerTierM * shelf.tiers
  const faceBack = run * (0.25 * u + 0.75 * u ** 1.6)
  // Underside: its height this far back.
  const f = Math.min(1, Math.max(0, back / shelf.depthM))
  const under = lip + rise * S.undersideRise * f ** 1.3
  return (
    ends *
    smoothstep(-S.faceEdgeM, S.faceEdgeM, back - faceBack) *
    smoothstep(-S.undersideEdgeM, S.undersideEdgeM, heightM - under) *
    (1 - smoothstep(top - S.topEdgeM, top + S.topEdgeM, heightM)) *
    (1 - smoothstep(shelf.depthM - S.backFadeM, shelf.depthM, back))
  )
}
