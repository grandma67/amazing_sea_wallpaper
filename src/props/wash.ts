import type { Material, MeshStandardMaterial } from 'three'

// White water washing against the faces of islands and big rocks at sea
// (props/index.ts waterIslands). Seen from afar at a grazing angle, foam on
// the water round them is a fraction of a pixel tall; the white of waves
// running up the face is what shows the waterline. A ragged band from the
// local sea level (the Earth's curvature drops far islands and the sea
// alike) up to `washHeight`, brightest at the bottom, matte white.

interface WashUniforms {
  washHeight: { value: number }
  washStrength: { value: number }
}

/** Patches a standard material (after its own onBeforeCompile) with a wash
 * band, off (height 0) until setWash(). */
export function addWash(material: MeshStandardMaterial): void {
  if (material.userData.wash != null) return
  const uniforms: WashUniforms = { washHeight: { value: 0 }, washStrength: { value: 0 } }
  material.userData.wash = uniforms
  const previous = material.onBeforeCompile
  // The wrapper's source is the same for every material: keep the inner
  // patch's in the program key, or materials share the wrong program.
  const key = material.customProgramCacheKey()
  material.customProgramCacheKey = () => `${key}|wash`
  material.onBeforeCompile = (shader, renderer) => {
    previous.call(material, shader, renderer)
    shader.uniforms.washHeight = uniforms.washHeight
    shader.uniforms.washStrength = uniforms.washStrength
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWashWorld;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        mat4 washModel = modelMatrix;
        #ifdef USE_INSTANCING
          washModel = modelMatrix * instanceMatrix;
        #endif
        vWashWorld = (washModel * vec4(transformed, 1.0)).xyz;`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWashWorld;
        uniform float washHeight;
        uniform float washStrength;
        float washHash(vec3 p) {
          p = fract(p * 0.3183099 + 0.1);
          p *= 17.0;
          return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
        }
        float washNoise(vec3 x) {
          vec3 i = floor(x);
          vec3 f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(mix(washHash(i), washHash(i + vec3(1, 0, 0)), f.x), mix(washHash(i + vec3(0, 1, 0)), washHash(i + vec3(1, 1, 0)), f.x), f.y),
            mix(mix(washHash(i + vec3(0, 0, 1)), washHash(i + vec3(1, 0, 1)), f.x), mix(washHash(i + vec3(0, 1, 1)), washHash(i + vec3(1, 1, 1)), f.x), f.y),
            f.z);
        }`
      )
      .replace(
        '#include <metalnessmap_fragment>',
        `#include <metalnessmap_fragment>
        if (washHeight > 0.0) {
          // Height above the local sea level (ocean.ts drops the sea by
          // 0.9 r² / 2R round the camera).
          vec2 fromEye = vWashWorld.xz - cameraPosition.xz;
          float y = vWashWorld.y + 0.9 * dot(fromEye, fromEye) / (2.0 * 6371000.0);
          // Ragged top: run-up varies along the face by several metres.
          float along = washNoise(vec3(vWashWorld.xz / 4.0, 0.5)) * 0.65 + washNoise(vec3(vWashWorld.xz / 1.3, 2.5)) * 0.35;
          float top = washHeight * (0.35 + 1.0 * along);
          float band = (1.0 - smoothstep(0.0, top, y)) * step(-0.5, y);
          // Streaks and holes: foam draining down the rock.
          float lace = washNoise(vWashWorld * vec3(1.6, 3.5, 1.6));
          float foam = clamp(band * (0.55 + 0.9 * lace) - 0.25, 0.0, 1.0) * washStrength;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.85), foam);
          roughnessFactor = mix(roughnessFactor, 0.9, foam);
        }`
      )
  }
  material.needsUpdate = true
}

/** The wash on a material patched by addWash: band height (m above the
 * sea) and how white it is (0..1). */
export function setWash(material: Material, height: number, strength: number): void {
  const uniforms = material.userData.wash as WashUniforms | undefined
  if (uniforms == null) return
  uniforms.washHeight.value = height
  uniforms.washStrength.value = strength
}
