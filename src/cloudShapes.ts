import { Uniform } from 'three'
import type { CloudsEffect } from '@takram/three-clouds'

import { hashCell, hashGlsl } from './skyMirror'
import { RETURN, SAMPLE_END } from './stormCells'

// Shared base for cloud shapes drawn by the volumetric clouds (shelfCloud.ts,
// rollCloud.ts): a shape is one more takram layer whose density a patch of
// `sampleWeather` sets from the sample's world position. Checklist for a new
// shape: arch/SKY.md "A new cloud shape in the volumetric clouds".
//
// Each shape has a prefix (`shelf`, `roll`) for its GLSL names and uniforms:
//   <prefix>Position (vec3)   the sample's ECEF position, set where takram reads uv
//   <prefix>Seed (float)      the shape's integer noise seed (seedInt)
//   <prefix>Hash1/2, <prefix>Noise1(x, k), <prefix>Noise2(p, k)   value noise
//     matching valueNoise1/2 below (k: a noise stream added to the seed)
//   <prefix>World()           the sample's world position (x north, y up, z east)

/** The density at which takram shows a shape's edge: it doubles the density
 * before its detail noise (sampleMedia), so a soft edge shows at ~0.25, not
 * 0.5. CPU predictions of where an edge shows use this. */
export const VISIBLE_DENSITY = 0.25

/** Where every takram `sampleWeather` call gets its uv: `position` (ECEF) is
 * in scope there (clouds.frag ×2, shadow.frag ×1). */
export const CAPTURE = 'vec2 uv = getGlobeUv(position);'

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

/** 1D value noise in [0, 1], cells of 1 (smoothstep between cell hashes):
 * `<prefix>Noise1` in the GLSL. */
export function valueNoise1(seed: number, x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const t = f * f * (3 - 2 * f)
  return hashCell(seed, i) * (1 - t) + hashCell(seed, i + 1) * t
}

/** 2D value noise in [0, 1], cells of 1: `<prefix>Noise2` in the GLSL. */
export function valueNoise2(seed: number, x: number, y: number): number {
  const i = Math.floor(x)
  const j = Math.floor(y)
  const tx = (x - i) * (x - i) * (3 - 2 * (x - i))
  const ty = (y - j) * (y - j) * (3 - 2 * (y - j))
  const a = hashCell(seed, i, j) * (1 - tx) + hashCell(seed, i + 1, j) * tx
  const b = hashCell(seed, i, j + 1) * (1 - tx) + hashCell(seed, i + 1, j + 1) * tx
  return a * (1 - ty) + b * ty
}

/** A number in the GLSL: one decimal (metres and scales). */
export const f1 = (x: number): string => x.toFixed(1)

/** The GLSL every shape needs: its position and seed, the hash, value noise
 * matching valueNoise1/2, and its world position. */
export function shapeBaseGlsl(prefix: string): string {
  return /* glsl */ `
${hashGlsl(prefix)}
vec3 ${prefix}Position = vec3(0.0);
uniform float ${prefix}Seed;
float ${prefix}Noise1(const float x, const float k) {
  float i = floor(x);
  float f = x - i;
  float t = f * f * (3.0 - 2.0 * f);
  return mix(${prefix}Hash1(i, ${prefix}Seed + k), ${prefix}Hash1(i + 1.0, ${prefix}Seed + k), t);
}
float ${prefix}Noise2(const vec2 p, const float k) {
  vec2 i = floor(p);
  vec2 f = p - i;
  vec2 t = f * f * (3.0 - 2.0 * f);
  float a = mix(${prefix}Hash2(i, ${prefix}Seed + k), ${prefix}Hash2(i + vec2(1.0, 0.0), ${prefix}Seed + k), t.x);
  float b = mix(${prefix}Hash2(i + vec2(0.0, 1.0), ${prefix}Seed + k), ${prefix}Hash2(i + vec2(1.0), ${prefix}Seed + k), t.x);
  return mix(a, b, t.y);
}
vec3 ${prefix}World() {
  return (ecefToWorldMatrix * vec4(${prefix}Position - altitudeCorrection, 1.0)).xyz;
}
`
}

/** A shape's takram layer: constant density profile (the shape sets the
 * density), its own shape and detail noise amounts, shadows on. */
export function shapeLayer(channel: 'r' | 'g' | 'b' | 'a', altitude: number, height: number, shapeAmount: number, shapeDetailAmount: number) {
  return {
    channel,
    altitude,
    height,
    densityScale: 0.3,
    shapeAmount,
    shapeDetailAmount,
    weatherExponent: 1,
    shapeAlteringBias: 0.35,
    coverageFilterWidth: 0.5,
    densityProfile: { expTerm: 0, exponent: 0, linearTerm: 0, constantTerm: 1 },
    shadow: true
  }
}

export interface ShapePatch {
  /** GLSL names' prefix (`shelf`, `roll`). */
  prefix: string
  /** The shape's own GLSL (functions reading `<prefix>World()` and the
   * noise), after shapeBaseGlsl. */
  glsl: string
  /** The shape's integer seed. */
  seed: number
  /** Code after the weather texture is read (`localWeather` in scope):
   * e.g. fill a host layer (the shelf's storm deck). */
  afterSample?: string
  /** Code before `return weather;`: set `weather.density.<layer>` (after the
   * coverage remap, so the day's coverage doesn't thin it). */
  beforeReturn: string
  /** The shape's uniforms (besides `<prefix>Seed`). */
  uniforms: Record<string, unknown>
}

/**
 * Patch the clouds' and their shadows' shaders for one shape. Throws if
 * takram's shader text has changed. Several shapes (and stormCells) can
 * patch the same shader: each keeps the text it found.
 */
export function patchCloudShape(clouds: CloudsEffect, patch: ShapePatch): void {
  for (const material of [clouds.cloudsPass.currentMaterial, clouds.shadowPass.currentMaterial]) {
    const source = material.fragmentShader
    if (source.split(SAMPLE_END).length !== 2 || source.split(RETURN).length !== 2 || !source.includes(CAPTURE))
      throw new Error(`patchCloudShape (${patch.prefix}): the clouds shader has changed; update the patch`)
    let next = source
      .replaceAll(CAPTURE, `${CAPTURE}\n    ${patch.prefix}Position = position;`)
      .replace('WeatherSample sampleWeather(', `${shapeBaseGlsl(patch.prefix)}${patch.glsl}\nWeatherSample sampleWeather(`)
    if (patch.afterSample != null) next = next.replace(SAMPLE_END, `${SAMPLE_END}${patch.afterSample}`)
    material.fragmentShader = next.replace(RETURN, `${patch.beforeReturn}${RETURN}`)
    material.uniforms[`${patch.prefix}Seed`] = new Uniform(patch.seed)
    for (const [name, value] of Object.entries(patch.uniforms)) material.uniforms[name] = new Uniform(value)
    material.needsUpdate = true
  }
}

/** `layer`'s density from a shape, masked in the shadow pass as takram masks
 * its own layers: the usual `beforeReturn`. */
export function setLayerDensity(layer: string, density: string): string {
  return `\n  weather.density.${layer} = ${density};\n  #ifdef SHADOW\n  weather.density.${layer} *= shadowLayerMask.${layer};\n  #endif`
}

/** A shape's constants with detail terms off (`params.debug.shelf`,
 * `.roll`): each term's amplitudes go to 0, on the CPU and in the GLSL
 * alike (both are written from the same object). */
export function withTermsOff<S extends Record<string, number>, T extends string>(
  shape: S,
  terms: Record<T, readonly (keyof S)[]>,
  off: Partial<Record<T, boolean>> | undefined
): S {
  const out: Record<string, number> = { ...shape }
  for (const [term, keys] of Object.entries(terms) as [T, readonly (keyof S)[]][]) if (off?.[term] === false) for (const k of keys) out[k as string] = 0
  return out as S
}
