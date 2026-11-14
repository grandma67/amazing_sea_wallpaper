import { Uniform, Vector2, type Vector3, Vector4 } from 'three'
import type { CloudsEffect } from '@takram/three-clouds'

import { dirFromAzEl } from './params'
import type { ShelfCloudParams } from './skyEvents'
import { hashCell, hashGlsl, seedInt } from './skyMirror'
import { RETURN, SAMPLE_END } from './stormCells'

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

// --- The shader patch ------------------------------------------------------

/** What the clouds need to draw the shelf: its frame (fixed to the main
 * camera's view, so the reflection cube's clouds put it in the same place),
 * its params and the storm's base. */
export interface ShelfSky {
  frame: ShelfFrame
  shelf: ShelfCloudParams
  base: number
}

/** How far in front of the lip the storm's deck is filled (m): the deck
 * stands over the shelf, not ahead of it. */
const BAND_FRONT_M = 500
/** ...and how far past the shelf's back (m). */
const BAND_BACK_M = 1500

/** The shelf's cloud layer: from near the sea to its top in the deck. Its
 * density comes from shelfDensity, not the weather map; the shape noise is
 * low (a smooth, laminar face) and the detail moderate (takram's "whippy
 * at the bottom" tears the underside). */
export function shelfLayer(sky: ShelfSky, channel: 'r' | 'g' | 'b' | 'a') {
  const top = shelfTop(sky.base) + SHELF_SHAPE.topEdgeM
  return {
    channel,
    altitude: 100,
    height: top - 100,
    densityScale: 0.3,
    shapeAmount: 0.3,
    shapeDetailAmount: 0.6,
    weatherExponent: 1,
    shapeAlteringBias: 0.35,
    coverageFilterWidth: 0.5,
    densityProfile: { expTerm: 0, exponent: 0, linearTerm: 0, constantTerm: 1 },
    shadow: true
  }
}

const f1 = (x: number): string => x.toFixed(1)

/** shelfDensity in GLSL (and the deck's band over it), from SHELF_SHAPE. */
export function shelfGlsl(): string {
  const S = SHELF_SHAPE
  return /* glsl */ `
${hashGlsl('shelf')}
// The sample's position (takram's ECEF), stored where each sampleWeather
// call gets its uv.
vec3 shelfPosition = vec3(0.0);
uniform vec2 shelfOrigin;
uniform vec2 shelfAcross;
uniform vec2 shelfToStorm;
// Lip height, depth, top, face run (m).
uniform vec4 shelfShape;
uniform float shelfSeed;
float shelfNoise1(const float x) {
  float i = floor(x);
  float f = x - i;
  float t = f * f * (3.0 - 2.0 * f);
  return mix(shelfHash1(i, shelfSeed), shelfHash1(i + 1.0, shelfSeed), t);
}
// (the shelf's density, 1 where the storm's deck must be full over it).
vec2 shelfSample(const float height) {
  vec3 world = (ecefToWorldMatrix * vec4(shelfPosition - altitudeCorrection, 1.0)).xyz;
  vec2 d = world.xz - shelfOrigin;
  float s = dot(d, shelfAcross);
  float b = dot(d, shelfToStorm);
  float ends = 1.0 - smoothstep(${f1(S.halfLengthM - S.endFadeM)}, ${f1(S.halfLengthM)}, abs(s));
  if (ends <= 0.0) return vec2(0.0);
  float q = s / ${f1(S.halfLengthM)};
  float back = b + ${f1(S.bowM)} * (1.0 - q * q) - ${f1(S.wobbleM)} * (shelfNoise1(s / ${f1(S.wobbleScaleM)}) - 0.5);
  float lip = shelfShape.x;
  float depth = shelfShape.y;
  float top = shelfShape.z;
  float rise = top - lip;
  float u = clamp((height - lip) / rise, 0.0, 1.0);
  float faceBack = shelfShape.w * (0.25 * u + 0.75 * pow(u, 1.6));
  float f = clamp(back / depth, 0.0, 1.0);
  float under = lip + rise * ${S.undersideRise.toFixed(3)} * pow(f, 1.3);
  float density = ends
    * smoothstep(${f1(-S.faceEdgeM)}, ${f1(S.faceEdgeM)}, back - faceBack)
    * smoothstep(${f1(-S.undersideEdgeM)}, ${f1(S.undersideEdgeM)}, height - under)
    * (1.0 - smoothstep(top - ${f1(S.topEdgeM)}, top + ${f1(S.topEdgeM)}, height))
    * (1.0 - smoothstep(depth - ${f1(S.backFadeM)}, depth, back));
  float band = ends * smoothstep(${f1(-BAND_FRONT_M)}, 0.0, back) * (1.0 - smoothstep(depth, depth + ${f1(BAND_BACK_M)}, back));
  return vec2(density, band);
}
`
}

const CAPTURE = 'vec2 uv = getGlobeUv(position);'

/**
 * Patch the clouds' and their shadows' shaders: the shelf's layer (index
 * `index`) takes shelfDensity as its density, after takram's coverage remap
 * so the day's coverage doesn't thin it, and the storm's layer (`cbIndex`)
 * is full over it. Call after patchStormCells (both edit the same two
 * places and keep the text they found).
 */
export function patchShelfCloud(clouds: CloudsEffect, sky: ShelfSky, index: number, cbIndex: number): void {
  if (index < 0 || index > 3 || cbIndex < 0 || cbIndex > 3) return
  const layer = 'xyzw'[index]
  const cb = 'xyzw'[cbIndex]
  const { frame, shelf } = sky
  const run = SHELF_SHAPE.faceRunM + SHELF_SHAPE.faceRunPerTierM * shelf.tiers
  for (const material of [clouds.cloudsPass.currentMaterial, clouds.shadowPass.currentMaterial]) {
    const source = material.fragmentShader
    const captures = source.split(CAPTURE).length - 1
    if (source.split(SAMPLE_END).length !== 2 || source.split(RETURN).length !== 2 || captures < 1)
      throw new Error('patchShelfCloud: the clouds shader has changed; update the patch')
    material.fragmentShader = source
      .replaceAll(CAPTURE, `${CAPTURE}\n    shelfPosition = position;`)
      .replace('WeatherSample sampleWeather(', `${shelfGlsl()}\nWeatherSample sampleWeather(`)
      .replace(SAMPLE_END, `${SAMPLE_END}  vec2 shelfHere = shelfSample(height);\n  localWeather.${cb} = max(localWeather.${cb}, shelfHere.y);\n`)
      .replace(
        RETURN,
        `\n  weather.density.${layer} = shelfHere.x;\n  #ifdef SHADOW\n  weather.density.${layer} *= shadowLayerMask.${layer};\n  #endif${RETURN}`
      )
    material.uniforms.shelfOrigin = new Uniform(frame.origin.clone())
    material.uniforms.shelfAcross = new Uniform(frame.across.clone())
    material.uniforms.shelfToStorm = new Uniform(frame.toStorm.clone())
    material.uniforms.shelfShape = new Uniform(new Vector4(shelf.lipHeightM, shelf.depthM, shelfTop(sky.base), run))
    material.uniforms.shelfSeed = new Uniform(seedInt(shelf.seed))
    material.needsUpdate = true
  }
}
