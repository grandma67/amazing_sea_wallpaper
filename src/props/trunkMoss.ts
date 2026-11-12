import { BufferAttribute, Color, InstancedBufferAttribute, type InstancedMesh, type MeshStandardMaterial } from 'three'

import type { RGB } from '../biome'
import { MOSS_DRY, TRUNK_LICHEN, TRUNK_MOSS_TOP, trunkGrowth } from '../phenology'

// Moss and lichen on trunks (NATURE_PLAN phase 9, NATURE.md §4). Bark
// vertices carry `barkMoss` (MeshBuilder: 1, smooth gum bark 0.3, leaves 0);
// each tree carries `trunkGrowth` (moss, lichen) from where it stands
// (phenology.ts trunkGrowth). The shader puts moss on the trunk's base, in
// patches, on the side the water runs: a slight lean sends stemflow down the
// side the tree leans toward (a beech study: moss thicker on the downhill side
// of trees leaning ~6°); a steep one catches rain on its upper side (Ryan
// 1991, upper vs lower sides of leaning trunks). Never "the north side".
// Spray-belt lichen greys the whole bark.

export interface TrunkMossLook {
  /** Moss amount today (phenology.ts mossLook): cover and height. */
  amount: number
  /** Share mixed toward dry brown. */
  dry: number
  /** The spray belt (m above the belt line). */
  belt: number
  /** The rocks' moss green and lichen by biome (rockShore.ts); the lichen is
   * brought to the measured crust's brightness (`LICHEN_ALBEDO`). */
  mossColor: RGB
  lichenColor: RGB
}

/** Calibrated pale lichen crust (Poly Haven lichen_rock, NATURE_PLAN §1):
 * mean albedo ~0.2, where the rocks' `LICHEN` is 0.45–0.55. */
export const LICHEN_ALBEDO = 0.19

/** A biome's lichen hue at the measured crust's brightness. */
export function lichenAtAlbedo(c: RGB): RGB {
  const k = LICHEN_ALBEDO / ((c[0] + c[1] + c[2]) / 3)
  return [c[0] * k, c[1] * k, c[2] * k]
}

/** Patch `material` (the plants' standard material) with trunk moss. */
export function trunkMoss(material: MeshStandardMaterial, look: TrunkMossLook): void {
  const previous = material.onBeforeCompile
  const key = material.customProgramCacheKey()
  material.customProgramCacheKey = () => `${key}|trunkMoss`
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer)
    shader.uniforms.trunkMossTop = { value: TRUNK_MOSS_TOP * look.amount }
    shader.uniforms.trunkMossDry = { value: look.dry }
    shader.uniforms.trunkMossColor = { value: new Color(...look.mossColor) }
    shader.uniforms.trunkLichenColor = { value: new Color(...lichenAtAlbedo(look.lichenColor)) }
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
attribute float barkMoss;
#ifdef USE_INSTANCING
attribute vec2 trunkGrowth;
#endif
varying float vTrunkMoss;
varying float vTrunkH;
varying float vTrunkLichen;
varying vec3 vTrunkWorld;`
      )
      .replace(
        '#include <project_vertex>',
        /* glsl */ `#include <project_vertex>
#ifdef USE_INSTANCING
{
  mat3 trunkFrame = mat3(instanceMatrix);
  float trunkScale = length(trunkFrame[1]);
  // Height above the tree's foot (before the wind's bend: the base hardly moves).
  float trunkH = max(position.y, 0.0) * trunkScale;
  vec2 lean = trunkFrame[1].xz / trunkScale;
  float tilt = length(lean);
  vec2 facing = normalize(trunkFrame * objectNormal).xz;
  float toward = dot(facing / max(length(facing), 1e-4), lean / max(tilt, 1e-4));
  // Stemflow side (toward the lean) up to ~10°, the upper side past ~20°.
  float sideSign = mix(1.0, -1.0, smoothstep(0.17, 0.35, tilt));
  float side = mix(1.0, 0.3 + 0.7 * (0.5 + 0.5 * sideSign * toward), smoothstep(0.02, 0.1, tilt));
  vTrunkMoss = barkMoss * min(1.0, trunkGrowth.x) * side;
  vTrunkH = trunkH;
  vTrunkLichen = barkMoss * trunkGrowth.y;
  vTrunkWorld = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
}
#else
vTrunkMoss = 0.0;
vTrunkH = 0.0;
vTrunkLichen = 0.0;
vTrunkWorld = vec3(0.0);
#endif`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
uniform float trunkMossDry;
uniform float trunkMossTop;
uniform vec3 trunkMossColor;
uniform vec3 trunkLichenColor;
varying float vTrunkMoss;
varying float vTrunkH;
varying float vTrunkLichen;
varying vec3 vTrunkWorld;
float trunkHash(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float trunkNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(trunkHash(i), trunkHash(i + vec3(1, 0, 0)), f.x), mix(trunkHash(i + vec3(0, 1, 0)), trunkHash(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(trunkHash(i + vec3(0, 0, 1)), trunkHash(i + vec3(1, 0, 1)), f.x), mix(trunkHash(i + vec3(0, 1, 1)), trunkHash(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}`
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
if (vTrunkMoss + vTrunkLichen > 0.001) {
  vec3 q = vTrunkWorld;
  // Spray-belt lichen: many small thalli over the whole bark (a few cm),
  // gathered loosely in broader patches.
  float crust = 0.5 + 0.5 * smoothstep(0.35, 0.65, trunkNoise(q * 3.0)) + 0.6 * smoothstep(0.45, 0.6, trunkNoise(q * 35.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, trunkLichenColor, min(1.0, ${TRUNK_LICHEN.toFixed(2)} * vTrunkLichen * crust));
  // Moss: densest at the foot, thinning upward to a ragged top edge (the
  // edge wanders by ±30% of the height), in cushions with bark between.
  float ragged = (trunkNoise(q * 3.0) - 0.5) * 0.6 + (trunkNoise(q * 11.0) - 0.5) * 0.3;
  float up = vTrunkH / max(trunkMossTop, 0.05) + ragged;
  float cover = vTrunkMoss * (1.0 - smoothstep(0.1, 1.0, up));
  float patches = trunkNoise(q * 7.0) * 0.6 + trunkNoise(q * 22.0) * 0.4;
  float mossMask = smoothstep(0.95 - cover * 0.9, 1.0 - cover * 0.9, patches) * step(0.001, cover);
  // Cushions vary from dark to yellow-green (measured spread 0.04–0.14 R).
  float tone = trunkNoise(q * 15.0);
  vec3 mossLive = trunkMossColor * (0.65 + 0.7 * tone) + vec3(0.03, 0.02, 0.0) * smoothstep(0.6, 0.9, trunkNoise(q * 5.0));
  vec3 mossC = mix(mossLive, vec3(${MOSS_DRY.join(', ')}), trunkMossDry);
  diffuseColor.rgb = mix(diffuseColor.rgb, mossC, mossMask);
}`
      )
  }
}

/** Give a plant mesh its trunks' growth: `barkMoss` 0 where the geometry has
 * none (grass, leaves only), and each instance's `trunkGrowth` from its foot
 * (`aboveLine`, `inland`: phenology.ts trunkGrowth). */
export function setTrunkGrowth(
  mesh: InstancedMesh,
  look: { amount: number; belt: number },
  foot: (i: number) => { aboveLine: number; inland: number }
): void {
  const geometry = mesh.geometry
  if (geometry.getAttribute('barkMoss') == null) {
    geometry.setAttribute('barkMoss', new BufferAttribute(new Float32Array(geometry.getAttribute('position').count), 1))
  }
  const growth = new Float32Array(mesh.count * 2)
  for (let i = 0; i < mesh.count; i++) {
    const f = foot(i)
    const g = trunkGrowth(look, f.aboveLine, f.inland)
    growth[i * 2] = g.moss
    growth[i * 2 + 1] = g.lichen
  }
  geometry.setAttribute('trunkGrowth', new InstancedBufferAttribute(growth, 2))
}
