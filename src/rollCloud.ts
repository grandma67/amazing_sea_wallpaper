import { Uniform, Vector2, type Vector3, Vector4 } from 'three'
import type { CloudsEffect } from '@takram/three-clouds'

import { dirFromAzEl } from './params'
import { SHELF_VISIBLE_DENSITY, valueNoise1 } from './shelfCloud'
import type { RollCloudParams } from './skyEvents'
import { hashCell, hashGlsl, seedInt } from './skyMirror'
import { RETURN, SAMPLE_END } from './stormCells'

// The Morning Glory as cloud: tubes the volumetric clouds draw (as the shelf,
// shelfCloud.ts; plans/SHELF_VOLUMETRIC.md phase 7). The shape on the CPU,
// and the GLSL written from the same constants.
//
// Each roll is an ellipse across the tube: ~1 km deep, 1–2 km wide, its base
// a hundred or two metres over the sea and flattened; its axis wanders along
// its length. Cloud forms at the leading edge and evaporates at the trailing
// one (R. Smith, LMU Munich): a sharp edge on the camera's side, a soft one
// behind. takram's shape noise makes the billows.

export const ROLL_SHAPE = {
  /** Half a roll's length (m), and how far its ends fade. */
  halfLengthM: 45_000,
  endFadeM: 5_000,
  /** Each later roll, further back, is this much smaller. */
  shrinkPerRoll: 0.15,
  /** The axis wanders across (m) over ~9 km, and in height (m) over ~4 km. */
  wanderM: 300,
  wanderScaleM: 9_000,
  riseM: 60,
  riseScaleM: 4_000,
  /** The base is flattened: below the centre the tube is this much shallower. */
  baseFlatten: 0.8,
  /** Billows: the tube's radius varies ±18% over ~700 m along it and ~1/12
   * of the way round, ±8% over ~250 m and ~1/30 round (photo: Burketown from
   * the air; the 0.172 mesh had ±15% and ±7.5%). takram doubles the density,
   * so the inside is saturated: billows must move the surface. */
  lumpLarge: 0.18,
  lumpLargeScaleM: 700,
  lumpLargeAround: 2,
  lumpSmall: 0.08,
  lumpSmallScaleM: 250,
  lumpSmallAround: 5,
  /** Edge widths, as fractions of the half-width: the leading (camera) side
   * and the trailing side (round 1: 0.06 left no partial density for
   * takram's shape noise to bite, a smooth slab). */
  leadEdge: 0.12,
  trailEdge: 0.35,
  /** Room above the tallest roll's top in the layer (m). */
  layerTopM: 150
} as const

/** Where the rolls are measured from, in world x/z (x north, z east): the
 * first roll's middle, its axis, and the direction away from the camera. */
export interface RollFrame {
  centre: Vector2
  axis: Vector2
  toBack: Vector2
}

/** As the 0.172 mesh: the first roll `distanceM` ahead of the camera, the
 * tubes stacking away from it. */
export function rollFrame(roll: RollCloudParams, camera: Vector3, headingDeg: number): RollFrame {
  const [ax, , az] = dirFromAzEl(roll.axisDeg, 0)
  const [hx, , hz] = dirFromAzEl(headingDeg, 0)
  const axis = new Vector2(ax, az)
  const heading = new Vector2(hx, hz)
  let toBack = new Vector2(az, -ax)
  if (toBack.dot(heading) < 0) {
    axis.negate()
    toBack = new Vector2(axis.y, -axis.x)
  }
  return { centre: new Vector2(camera.x, camera.z).addScaledVector(heading, roll.distanceM), axis, toBack }
}

/** 2D value noise in [0, 1], cells of 1 (smoothstep between cell hashes):
 * the GLSL builds it the same way on `hashGlsl`. */
export function valueNoise2(seed: number, x: number, y: number): number {
  const i = Math.floor(x)
  const j = Math.floor(y)
  const tx = (x - i) * (x - i) * (3 - 2 * (x - i))
  const ty = (y - j) * (y - j) * (3 - 2 * (y - j))
  const a = hashCell(seed, i, j) * (1 - tx) + hashCell(seed, i + 1, j) * tx
  const b = hashCell(seed, i, j + 1) * (1 - tx) + hashCell(seed, i + 1, j + 1) * tx
  return a * (1 - ty) + b * ty
}

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** The rolls' density at a world point (0–1). */
export function rollDensity(frame: RollFrame, roll: RollCloudParams, x: number, z: number, heightM: number): number {
  const R = ROLL_SHAPE
  const dx = x - frame.centre.x
  const dz = z - frame.centre.y
  const along = dx * frame.axis.x + dz * frame.axis.y
  const across = dx * frame.toBack.x + dz * frame.toBack.y
  const ends = 1 - smoothstep(R.halfLengthM - R.endFadeM, R.halfLengthM, Math.abs(along))
  if (ends <= 0) return 0
  const seed = seedInt(roll.seed)
  let density = 0
  for (let k = 0; k < roll.rolls; k++) {
    const scale = 1 - R.shrinkPerRoll * k
    const halfW = (roll.widthM / 2) * scale
    const halfD = (roll.depthM / 2) * scale
    const c = across - k * roll.spacingM - R.wanderM * 2 * (valueNoise1(seed + 2 * k, along / R.wanderScaleM) - 0.5)
    const centreH = roll.baseM + halfD + R.riseM * 2 * (valueNoise1(seed + 2 * k + 1, along / R.riseScaleM) - 0.5)
    const dh = heightM - centreH
    const v = dh / (dh < 0 ? halfD * R.baseFlatten : halfD)
    const u = c / halfW
    // Billows: the radius varies along the tube and round it (the seam of
    // the angle's noise sits at the back, on the trailing side).
    const angle = Math.atan2(v, u)
    const lumps =
      1 +
      R.lumpLarge * 2 * (valueNoise2(seed + 10 + k, along / R.lumpLargeScaleM, angle * R.lumpLargeAround) - 0.5) +
      R.lumpSmall * 2 * (valueNoise2(seed + 20 + k, along / R.lumpSmallScaleM, angle * R.lumpSmallAround) - 0.5)
    const e = Math.sqrt(u * u + v * v) / lumps
    const edge = c < 0 ? R.leadEdge : R.trailEdge
    density = Math.max(density, 1 - smoothstep(1 - edge, 1 + edge, e))
  }
  return ends * density
}

/** The rolls' cloud layer: from the sea to above the first (tallest) roll. */
export function rollLayer(roll: RollCloudParams, channel: 'r' | 'g' | 'b' | 'a') {
  return {
    channel,
    altitude: 0,
    height: roll.baseM + roll.depthM * (1 + ROLL_SHAPE.lumpLarge + ROLL_SHAPE.lumpSmall) + ROLL_SHAPE.riseM + ROLL_SHAPE.layerTopM,
    densityScale: 0.3,
    shapeAmount: 0.6,
    shapeDetailAmount: 0.8,
    weatherExponent: 1,
    shapeAlteringBias: 0.35,
    coverageFilterWidth: 0.5,
    densityProfile: { expTerm: 0, exponent: 0, linearTerm: 0, constantTerm: 1 },
    shadow: true
  }
}

const f1 = (x: number): string => x.toFixed(1)

/** rollDensity in GLSL, from ROLL_SHAPE: the same steps as the TS. */
export function rollGlsl(): string {
  const R = ROLL_SHAPE
  return /* glsl */ `
${hashGlsl('roll')}
vec3 rollPosition = vec3(0.0);
uniform vec2 rollCentre;
uniform vec2 rollAxis;
uniform vec2 rollBack;
// Base, depth, width, spacing (m).
uniform vec4 rollShape;
uniform float rollCount;
uniform float rollSeed;
float rollNoise2(const vec2 p, const float k) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 t = f * f * (3.0 - 2.0 * f);
  float a = mix(rollHash2(i, rollSeed + k), rollHash2(i + vec2(1.0, 0.0), rollSeed + k), t.x);
  float b = mix(rollHash2(i + vec2(0.0, 1.0), rollSeed + k), rollHash2(i + vec2(1.0), rollSeed + k), t.x);
  return mix(a, b, t.y);
}
float rollNoise1(const float x, const float k) {
  float i = floor(x);
  float f = x - i;
  float t = f * f * (3.0 - 2.0 * f);
  return mix(rollHash1(i, rollSeed + k), rollHash1(i + 1.0, rollSeed + k), t);
}
float rollSample(const float height) {
  if (height > rollShape.x + rollShape.y * ${(1 + R.lumpLarge + R.lumpSmall).toFixed(3)} + ${f1(R.riseM + R.layerTopM)}) return 0.0;
  vec3 world = (ecefToWorldMatrix * vec4(rollPosition - altitudeCorrection, 1.0)).xyz;
  vec2 d = world.xz - rollCentre;
  float along = dot(d, rollAxis);
  float across = dot(d, rollBack);
  float ends = 1.0 - smoothstep(${f1(R.halfLengthM - R.endFadeM)}, ${f1(R.halfLengthM)}, abs(along));
  if (ends <= 0.0) return 0.0;
  float density = 0.0;
  for (int k = 0; k < 3; k++) {
    float fk = float(k);
    if (fk >= rollCount) break;
    float scale = 1.0 - ${R.shrinkPerRoll.toFixed(3)} * fk;
    float halfW = rollShape.z * 0.5 * scale;
    float halfD = rollShape.y * 0.5 * scale;
    // Far from this tube (beyond its widest lump and softest edge, plus the
    // wander) its density is surely 0: skip its noise. Rays near the horizon
    // cross the layer for tens of km; without this the rolls cost +45%.
    if (abs(across - fk * rollShape.w) > halfW * ${((1 + R.trailEdge) * (1 + R.lumpLarge + R.lumpSmall)).toFixed(3)} + ${f1(R.wanderM)}) continue;
    float c = across - fk * rollShape.w - ${f1(R.wanderM * 2)} * (rollNoise1(along / ${f1(R.wanderScaleM)}, 2.0 * fk) - 0.5);
    float centreH = rollShape.x + halfD + ${f1(R.riseM * 2)} * (rollNoise1(along / ${f1(R.riseScaleM)}, 2.0 * fk + 1.0) - 0.5);
    float dh = height - centreH;
    float v = dh / (dh < 0.0 ? halfD * ${R.baseFlatten.toFixed(3)} : halfD);
    float u = c / halfW;
    float angle = atan(v, u);
    float lumps = 1.0
      + ${(R.lumpLarge * 2).toFixed(3)} * (rollNoise2(vec2(along / ${f1(R.lumpLargeScaleM)}, angle * ${f1(R.lumpLargeAround)}), 10.0 + fk) - 0.5)
      + ${(R.lumpSmall * 2).toFixed(3)} * (rollNoise2(vec2(along / ${f1(R.lumpSmallScaleM)}, angle * ${f1(R.lumpSmallAround)}), 20.0 + fk) - 0.5);
    float e = sqrt(u * u + v * v) / lumps;
    float edge = c < 0.0 ? ${R.leadEdge.toFixed(3)} : ${R.trailEdge.toFixed(3)};
    density = max(density, 1.0 - smoothstep(1.0 - edge, 1.0 + edge, e));
  }
  return ends * density;
}
`
}

const CAPTURE = 'vec2 uv = getGlobeUv(position);'

/** Patch the clouds' and their shadows' shaders: the rolls' layer (`index`)
 * takes rollDensity as its density, after takram's coverage remap. */
export function patchRollCloud(clouds: CloudsEffect, roll: RollCloudParams, frame: RollFrame, index: number): void {
  if (index < 0 || index > 3) return
  const layer = 'xyzw'[index]
  for (const material of [clouds.cloudsPass.currentMaterial, clouds.shadowPass.currentMaterial]) {
    const source = material.fragmentShader
    if (source.split(SAMPLE_END).length !== 2 || source.split(RETURN).length !== 2 || !source.includes(CAPTURE))
      throw new Error('patchRollCloud: the clouds shader has changed; update the patch')
    material.fragmentShader = source
      .replaceAll(CAPTURE, `${CAPTURE}\n    rollPosition = position;`)
      .replace('WeatherSample sampleWeather(', `${rollGlsl()}\nWeatherSample sampleWeather(`)
      .replace(
        RETURN,
        `\n  weather.density.${layer} = rollSample(height);\n  #ifdef SHADOW\n  weather.density.${layer} *= shadowLayerMask.${layer};\n  #endif${RETURN}`
      )
    material.uniforms.rollCentre = new Uniform(frame.centre.clone())
    material.uniforms.rollAxis = new Uniform(frame.axis.clone())
    material.uniforms.rollBack = new Uniform(frame.toBack.clone())
    material.uniforms.rollShape = new Uniform(new Vector4(roll.baseM, roll.depthM, roll.widthM, roll.spacingM))
    material.uniforms.rollCount = new Uniform(roll.rolls)
    material.uniforms.rollSeed = new Uniform(seedInt(roll.seed))
    material.needsUpdate = true
  }
}

/** Is a point in a roll as takram shows it (for CPU predictions). */
export function rollVisible(frame: RollFrame, roll: RollCloudParams, x: number, z: number, heightM: number): boolean {
  return rollDensity(frame, roll, x, z, heightM) > SHELF_VISIBLE_DENSITY
}
