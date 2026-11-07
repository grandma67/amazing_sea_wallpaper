import { ShaderChunk, type IUniform, type Material, type Object3D, type ShaderMaterial, type WebGLProgramParametersWithUniforms } from 'three'

import { LAND_CLOUD_GLSL, SOFT_SHADOW_GLSL } from './shadow'
import { SKY_OPEN_GLSL } from './skylight'

// Cloud and mountain shade on everything three.js lights. The near sun map
// already reaches props through their light; the land and cloud maps reach only
// the sea and terrain, whose shaders are ours. All standard materials take the
// sun in one place (`lights_fragment_begin`), so one patch covers every prop.
// Only direct light goes: sky light stays, as it does in real shade. Under a
// tree crown the sky light is less too (props/skyOcclusion.ts): near the
// ground, fading out over 0.5–3 m above each prop's foot, so a crown doesn't
// hide the sky from its own leaves (they have their depth baked in, trees.ts).

/** Prop kinds that are clouds themselves: they stand in the deck, so the map's
 * shade from above doesn't apply. */
const CLOUD_KINDS = new Set(['shelf-cloud', 'roll-cloud'])

const SUN_LINE = 'getDirectionalLightInfo( directionalLight, directLight );'

// three's shadow of directional light i; the sun is light 0 (scene.ts).
const SHADOW_CALL =
  'getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] )'

// The fine slice (light 1, no light of its own: shadow.ts fitFineShadow) takes
// over from the sun's near map where it covers the point, fading out over its
// outer 8% as SHADOW_GLSL's sunShadow does.
const FINE_SLICE = `float fineSunShadow = 1.0;
float fineSunWeight = 0.0;
#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 1
{
  vec3 fineCoord = vDirectionalShadowCoord[ 1 ].xyz / vDirectionalShadowCoord[ 1 ].w;
  fineSunWeight = fineCoord.z > 1.0 ? 0.0 : clamp(min(min(fineCoord.x, 1.0 - fineCoord.x), min(fineCoord.y, 1.0 - fineCoord.y)) / 0.08, 0.0, 1.0);
  // Depth offset scaled by the slope to the sun (tan, up to 8), from the face
  // as lit (\`normal\` is flipped on back faces): grass blades and fronds
  // are double-sided, and three's normal offset takes the unflipped normal,
  // pushing a sunlit back face into its own shadow. Hatching at 1 cm texels.
  float fineCos = max(abs(dot(normal, directionalLights[ 0 ].direction)), 0.124);
  float fineBias = directionalLightShadows[ 1 ].shadowBias * (1.0 + sqrt(1.0 - fineCos * fineCos) / fineCos);
  // Softened by each blocker's height (shadow.ts SOFT_SHADOW_GLSL); the bias is three's sign.
  if (fineSunWeight > 0.0) fineSunShadow = fineShadowScale.z > 0.0
    ? softShadow( directionalShadowMap[ 1 ], fineCoord, -fineBias, min(sqrt(1.0 - fineCos * fineCos) / fineCos, 8.0) )
    : getShadow( directionalShadowMap[ 1 ], directionalLightShadows[ 1 ].shadowMapSize, directionalLightShadows[ 1 ].shadowIntensity, fineBias, directionalLightShadows[ 1 ].shadowRadius, vDirectionalShadowCoord[ 1 ] );
}
#endif
`

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
      .replace('#include <common>', '#include <common>\nvarying vec3 vShadeWorld;\nvarying float vShadeRise;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        mat4 shadeModel = modelMatrix;
        #ifdef USE_INSTANCING
          shadeModel = modelMatrix * instanceMatrix;
        #endif
        vShadeWorld = (shadeModel * vec4(transformed, 1.0)).xyz;
        // Height above the prop's foot (builders put it on y = 0).
        vShadeRise = vShadeWorld.y - shadeModel[3].y;`
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vShadeWorld;\nvarying float vShadeRise;\n${LAND_CLOUD_GLSL}\n${SKY_OPEN_GLSL}`)
      .replace('#include <shadowmap_pars_fragment>', `#include <shadowmap_pars_fragment>\n${SOFT_SHADOW_GLSL}`)
      .replace(
        '#include <aomap_fragment>',
        `float skyOpenHere = mix(skyOpen(vShadeWorld), 1.0, smoothstep(0.5, 3.0, vShadeRise));
        reflectedLight.indirectDiffuse *= skyOpenHere;
        reflectedLight.indirectSpecular *= skyOpenHere;
        #include <aomap_fragment>`
      )
      .replace(
        '#include <lights_fragment_begin>',
        `float shadeHere = propShade(vShadeWorld);\n${FINE_SLICE}${ShaderChunk.lights_fragment_begin
          .replace(SUN_LINE, `${SUN_LINE}\n\t\tdirectLight.color *= shadeHere;`)
          .replace(SHADOW_CALL, `mix( ${SHADOW_CALL}, fineSunShadow, UNROLLED_LOOP_INDEX == 0 ? fineSunWeight : 0.0 )`)}`
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
