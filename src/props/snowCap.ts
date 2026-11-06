import { ICE_SNOW_DROP } from '../seaIce'
import { DoubleSide, type MeshStandardMaterial } from 'three'

import type { SceneParams } from '../params'
import { tideMarks } from '../tides'

// Snow on what stands on the land (plans/SNOW.md): on upward faces above the
// sea's reach, in the same patches of the day's cover as the ground, from world
// position and normal alone, so it needs no per-object work and nothing about
// it reads the camera. On rocks, stones, plants, driftwood and marsh tufts.
// Where an ice foot stands, spray freezes on the rocks round the high-water
// line.

export interface SnowLook {
  /** Share of the open ground under snow (0–1). */
  cover: number
  /** World height where snow starts: above today's high water and swash. */
  line: number
  /** Frozen spray: 1 where an ice foot stands, else 0. */
  glaze: number
}

/** Where snow starts above today's reach (m). */
const ABOVE_REACH = 0.15

/** The day's snow for the materials and the terrain; null without any. */
export function snowLook(params: SceneParams): SnowLook | null {
  const { snow, coast } = params
  if (snow == null) return null
  return { cover: snow.cover, line: tideMarks(coast).high + coast.runup + ABOVE_REACH - (params.seaIce != null ? ICE_SNOW_DROP : 0), glaze: snow.iceFoot ? 1 : 0 }
}

/** Patches a standard material (after its own onBeforeCompile); nothing on a
 * snowless day. `amount`: how much of an upward face holds it. */
export function snowCap(material: MeshStandardMaterial, look: SnowLook | null, amount = 1): void {
  if (look == null) return
  const previous = material.onBeforeCompile
  // The wrapper's source is the same for every material: keep the inner
  // patch's in the program key, or materials share the wrong program.
  const key = material.customProgramCacheKey()
  material.customProgramCacheKey = () => `${key}|snow`
  // Thin parts have no outside: snow lies on whichever face is up.
  const up = material.side === DoubleSide ? 'abs(vSnowNormal.y)' : 'vSnowNormal.y'
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer)
    shader.uniforms.snowLook = { value: [look.cover, look.line, look.glaze, amount] }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSnowWorld;\nvarying vec3 vSnowNormal;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        mat4 snowModel = modelMatrix;
        #ifdef USE_INSTANCING
          snowModel = modelMatrix * instanceMatrix;
        #endif
        vSnowWorld = (snowModel * vec4(transformed, 1.0)).xyz;
        vSnowNormal = normalize(mat3(snowModel) * objectNormal);`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSnowWorld;
        varying vec3 vSnowNormal;
        uniform vec4 snowLook;
        float snowHash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float snowNoise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(snowHash(i), snowHash(i + vec3(1, 0, 0)), f.x), mix(snowHash(i + vec3(0, 1, 0)), snowHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(snowHash(i + vec3(0, 0, 1)), snowHash(i + vec3(1, 0, 1)), f.x), mix(snowHash(i + vec3(0, 1, 1)), snowHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }`
      )
      // Colour and roughness are final by here, after every inner patch.
      .replace(
        '#include <normal_fragment_begin>',
        `#include <normal_fragment_begin>
        {
          vec3 q = vSnowWorld;
          float fine = snowNoise(q * 4.0) * 0.6 + snowNoise(q * 13.0) * 0.4;
          float wide = snowNoise(q / 9.0) * 0.6 + snowNoise(q / 2.3) * 0.4;
          float open = 0.75 - 0.55 * snowLook.x;
          float lying = smoothstep(open - 0.1, open + 0.1, wide);
          float above = smoothstep(snowLook.y, snowLook.y + 0.4, q.y + 0.3 * (fine - 0.5));
          float capped = smoothstep(0.3, 0.72, ${up} + 0.45 * (fine - 0.5)) * lying * above * snowLook.w;
          // Frozen spray: a glassy sheath low on every face, not patches: thin
          // enough to see the rock through, its top edge running in drips.
          float spray = snowLook.z * smoothstep(snowLook.y - 1.0, snowLook.y - 0.5, q.y) * (1.0 - smoothstep(snowLook.y + 0.1, snowLook.y + 0.9, q.y + 0.7 * (wide - 0.5))) * (0.75 + 0.25 * wide);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45, 0.52, 0.56), 0.45 * spray);
          roughnessFactor = mix(roughnessFactor, 0.2, spray);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.82, 0.84, 0.87), capped);
          roughnessFactor = mix(roughnessFactor, 0.9, capped);
        }`
      )
  }
}
