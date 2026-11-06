import { ShaderChunk, type IUniform, type Material, type Object3D, type ShaderMaterial, type WebGLProgramParametersWithUniforms } from 'three'

import { LAND_CLOUD_GLSL } from './shadow'

// Cloud and mountain shade on everything three.js lights. The near sun map
// already reaches props through their light; the land and cloud maps reach only
// the sea and terrain, whose shaders are ours. All standard materials take the
// sun in one place (`lights_fragment_begin`), so one patch covers every prop.
// Only direct light goes: sky light stays, as it does in real shade.

/** Prop kinds that are clouds themselves: they stand in the deck, so the map's
 * shade from above doesn't apply. */
const CLOUD_KINDS = new Set(['shelf-cloud', 'roll-cloud'])

const SUN_LINE = 'getDirectionalLightInfo( directionalLight, directLight );'

/** What each prop kind has, for debug.shadowCoverage. */
export interface ShadeCoverage {
  /** Objects with a lit material. */
  lit: number
  /** ...that read the shade. Anything less than `lit` is a bug. */
  shaded: number
  /** Unlit objects (lamps, lava, lightning): the sun doesn't touch them. */
  unlit: number
  /** Spray, through its own shader. */
  spray: number
  /** Clouds: left out on purpose. */
  clouds: number
  casts: number
  receives: number
}

type Uniforms = Record<string, IUniform>

/** Takes three's lights, by the same test as WebGLRenderer. Our own
 * ShaderMaterials don't: they have their own light. */
function isLit(material: Material): boolean {
  const m = material as Material & Record<string, unknown>
  return m.isMeshStandardMaterial === true || m.isMeshLambertMaterial === true || m.isMeshPhongMaterial === true || m.isMeshToonMaterial === true
}

/** Patch a standard material (after its own onBeforeCompile). */
export function shadeMaterial(material: Material, uniforms: Uniforms, view: boolean): void {
  const previous = material.onBeforeCompile
  // The wrapper's source is the same for every material: keep the inner
  // patch's in the program key, or materials share the wrong program.
  const key = material.customProgramCacheKey()
  material.customProgramCacheKey = () => `${key}|shade${view ? 'View' : ''}`
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    previous.call(material, shader, renderer)
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vShadeWorld;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        mat4 shadeModel = modelMatrix;
        #ifdef USE_INSTANCING
          shadeModel = modelMatrix * instanceMatrix;
        #endif
        vShadeWorld = (shadeModel * vec4(transformed, 1.0)).xyz;`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vShadeWorld;\n${LAND_CLOUD_GLSL}`)
      .replace(
        '#include <lights_fragment_begin>',
        `float shadeHere = propShade(vShadeWorld);\n${ShaderChunk.lights_fragment_begin.replace(
          SUN_LINE,
          `${SUN_LINE}\n\t\tdirectLight.color *= shadeHere;`
        )}`
      )
    if (view) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        '#include <opaque_fragment>\ngl_FragColor = vec4(vec3(shadeHere) * 0.25, 1.0);'
      )
    }
  }
}

/** Spray takes the shade per droplet, in its own vertex shader (props/surf.ts). */
function shadeSpray(material: ShaderMaterial, uniforms: Uniforms): void {
  material.vertexShader = `${LAND_CLOUD_GLSL}\n${material.vertexShader.replace('vShade = 1.0;', 'vShade = propShade(world.xyz);')}`
  Object.assign(material.uniforms, uniforms)
  material.needsUpdate = true
}

/** Give every lit material under `root` the shade, and report by prop kind. */
export function shadeProps(root: Object3D, uniforms: Uniforms, view = false): Record<string, ShadeCoverage> {
  const done = new WeakSet<Material>()
  const coverage: Record<string, ShadeCoverage> = {}
  root.traverse(o => {
    const value = (o as Object3D & { material?: Material | Material[] }).material
    if (value == null) return
    let kindOf: unknown = o.userData.prop
    o.traverseAncestors(a => (kindOf ??= a.userData.prop))
    const kind = typeof kindOf === 'string' ? kindOf : 'other'
    const row = (coverage[kind] ??= { lit: 0, shaded: 0, unlit: 0, spray: 0, clouds: 0, casts: 0, receives: 0 })
    if (o.castShadow) row.casts++
    if (o.receiveShadow) row.receives++
    if (CLOUD_KINDS.has(kind)) {
      row.clouds++
      return
    }
    if (o.userData.spray === true) {
      const material = value as ShaderMaterial
      if (!done.has(material)) shadeSpray(material, uniforms)
      done.add(material)
      row.spray++
      return
    }
    const materials = Array.isArray(value) ? value : [value]
    if (!materials.some(isLit)) {
      row.unlit++
      return
    }
    row.lit++
    for (const material of materials.filter(isLit)) {
      if (!done.has(material)) shadeMaterial(material, uniforms, view)
      done.add(material)
    }
    row.shaded++
  })
  return coverage
}
