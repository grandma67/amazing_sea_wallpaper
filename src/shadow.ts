import type { CloudsEffect } from '@takram/three-clouds'
import {
  DepthTexture,
  FloatType,
  LessEqualCompare,
  LinearFilter,
  Matrix4,
  Mesh,
  MeshDepthMaterial,
  OrthographicCamera,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  type DirectionalLight,
  type Material,
  type Object3D,
  type PerspectiveCamera,
  type Scene,
  type Texture,
  type WebGLRenderer
} from 'three'

import { EARTH_RADIUS } from './params'

// Lets the custom terrain and ocean shaders receive the sun's shadow map,
// which three.js renders for the standard-material props (rocks, plants...).

export const SHADOW_GLSL = /* glsl */ `
uniform sampler2DShadow sunShadowMap;
uniform mat4 sunShadowMatrix;
uniform vec2 sunShadowTexel;
uniform float sunShadowOn;

// Depth offset as a fraction of the map's 6490 m range: ~0.13 m along the light.
// The sea and terrain aren't in this map, so they can't shade themselves; a
// bigger offset only cuts the shadow off short of what casts it.
float sunShadow(vec3 world) {
  if (sunShadowOn < 0.5) return 1.0;
  vec4 c = sunShadowMatrix * vec4(world, 1.0);
  c.xyz /= c.w;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float sum = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      sum += texture(sunShadowMap, vec3(c.xy + vec2(float(i), float(j)) * sunShadowTexel * 1.2, c.z - 0.00002));
    }
  }
  return sum / 9.0;
}

// Shade from mountains, volcanoes and islands kilometres away: a low sun or
// moon behind them leaves the sea in front in their shadow, glitter path and
// all. The near map above covers only a few hundred metres round the camera,
// so these get their own (renderLandShadow): one orthographic depth map along
// the light over the sea out to the horizon. Where both cover a rock, either
// one's shade is the same shade, so take the darker.
uniform sampler2DShadow landShadowMap;
uniform mat4 landShadowMatrix;
uniform vec2 landShadowTexel;
uniform float landShadowOn;

float landShadow(vec3 world) {
  if (landShadowOn < 0.5) return 1.0;
  vec4 c = landShadowMatrix * vec4(world, 1.0);
  c.xyz /= c.w;
  if (c.x < 0.0 || c.x > 1.0 || c.y < 0.0 || c.y > 1.0 || c.z > 1.0) return 1.0;
  float sum = 0.0;
  for (int j = 0; j < 2; j++) {
    for (int i = 0; i < 2; i++) {
      sum += texture(landShadowMap, vec3(c.xy + (vec2(float(i), float(j)) - 0.5) * landShadowTexel, c.z));
    }
  }
  return sum / 4.0;
}

// Shade from the volumetric clouds in the sky. The clouds effect ray-marches
// them toward the sun (or the moon at night) into cascaded maps of optical
// depth (takram's BSM; primed by primeCloudShadow in clouds.ts). The sea and
// sand are below every layer, so the full optical depth along the light ray
// applies. The sun's glint off the water is the same light: where a cloud
// hides the sun, the glitter path goes too.
uniform sampler2DArray cloudShadowMap;
uniform mat4 cloudShadowMatrices[4];
uniform vec2 cloudShadowIntervals[4];
uniform int cloudShadowCascades;
uniform float cloudShadowNear;
uniform float cloudShadowFar;

float cloudShadow(vec3 world) {
  if (cloudShadowCascades == 0) return 1.0;
  float viewZ = -(viewMatrix * vec4(world, 1.0)).z;
  float depth = (viewZ - cloudShadowNear) / (cloudShadowFar - cloudShadowNear);
  int cascade = cloudShadowCascades - 1;
  for (int i = 3; i >= 0; i--) {
    if (i < cloudShadowCascades && depth < cloudShadowIntervals[i].y) cascade = i;
  }
  vec4 clip = cloudShadowMatrices[cascade] * vec4(world, 1.0);
  vec2 uv = clip.xy / clip.w * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 1.0;
  // b: max optical depth marched, a: estimated tail beyond the march.
  vec4 bsm = texture(cloudShadowMap, vec3(uv, float(cascade)));
  return exp(-(bsm.b + bsm.a));
}

// Direct light reaching a point on the sea or sand: props nearby, land far
// away, then the clouds.
float lightReaching(vec3 world) {
  return min(sunShadow(world), landShadow(world)) * cloudShadow(world);
}
`

/**
 * Stand-in for a shadow map not rendered yet (or never: no sun, no land
 * map). A sampler2DShadow must always see a depth texture with comparison
 * on: three.js r186 falls back to its own `emptyShadowTexture` for null, but
 * never uploads it, so it binds a plain RGBA texture and the GPU drops the
 * whole draw ("Mismatch between texture format and sampler type"). That hid
 * the terrain from the sea's reflection, which is drawn before the land
 * shadow exists. The shaders skip the map while its "On" flag is 0, so its
 * contents don't matter. Each material gets its own (disposed with it, or
 * when the real map replaces it).
 */
function noShadowMap(): DepthTexture {
  const texture = new DepthTexture(1, 1, FloatType)
  texture.compareFunction = LessEqualCompare
  texture.userData.noShadow = true
  texture.needsUpdate = true
  return texture
}

/** Point a shadow sampler at `map`, freeing its stand-in. */
function setShadowMap(uniform: { value: unknown }, map: Texture): void {
  const old = uniform.value as Texture | null
  if (old !== map && old?.userData.noShadow === true) old.dispose()
  uniform.value = map
}

export function shadowUniforms(): Record<string, { value: unknown }> {
  return {
    cloudShadowMap: { value: null as Texture | null },
    cloudShadowMatrices: { value: [0, 1, 2, 3].map(() => new Matrix4()) },
    cloudShadowIntervals: { value: [0, 1, 2, 3].map(() => new Vector2()) },
    cloudShadowCascades: { value: 0 },
    cloudShadowNear: { value: 0 },
    cloudShadowFar: { value: 1 },
    sunShadowMap: { value: noShadowMap() as Texture },
    sunShadowMatrix: { value: new Matrix4() },
    sunShadowTexel: { value: new Vector2(1, 1) },
    sunShadowOn: { value: 0 },
    landShadowMap: { value: noShadowMap() as Texture },
    landShadowMatrix: { value: new Matrix4() },
    landShadowTexel: { value: new Vector2(1, 1) },
    landShadowOn: { value: 0 }
  }
}

/** Point the shader uniforms at the clouds' (already primed) shadow map. */
export function bindCloudShadow(
  uniforms: Record<string, { value: unknown }>,
  clouds: CloudsEffect,
  camera: PerspectiveCamera
): void {
  const maps = clouds.shadowMaps
  uniforms.cloudShadowMap.value = clouds.shadowPass.outputBuffer
  maps.cascades.forEach((cascade, i) => {
    ;(uniforms.cloudShadowMatrices.value as Matrix4[])[i].copy(cascade.matrix)
    ;(uniforms.cloudShadowIntervals.value as Vector2[])[i].copy(cascade.interval)
  })
  uniforms.cloudShadowCascades.value = maps.cascadeCount
  uniforms.cloudShadowNear.value = camera.near
  uniforms.cloudShadowFar.value = maps.far
}

/** Point the shader uniforms at the light's (already rendered) shadow map. */
export function bindShadow(
  uniforms: Record<string, { value: unknown }>,
  light: DirectionalLight
): void {
  const map = light.shadow.map
  if (map?.depthTexture == null) return
  setShadowMap(uniforms.sunShadowMap, map.depthTexture)
  ;(uniforms.sunShadowMatrix.value as Matrix4).copy(light.shadow.matrix)
  ;(uniforms.sunShadowTexel.value as Vector2).set(1 / map.width, 1 / map.height)
  uniforms.sunShadowOn.value = 1
}

const LAND_SHADOW_SIZE = 2048

/**
 * Depth of everything on land and at sea that blocks the light, seen from the
 * light over a disc of sea round the camera out to its horizon (the rest is
 * too far to show a shade). Casters are the props that cast shadows anyway
 * plus the landforms and islands; the sea and sand only receive.
 */
export function renderLandShadow(
  renderer: WebGLRenderer,
  scene: Scene,
  props: Object3D,
  camera: PerspectiveCamera,
  lightDirection: Vector3
): LandShadow {
  const eye = camera.position
  // Horizon distance, with room for the sea near it.
  const radius = Math.min(40_000, 1.5 * Math.sqrt(2 * EARTH_RADIUS * Math.max(eye.y, 1)) + 1000)
  const L = lightDirection.clone().normalize()
  // Light-space height of the sea disc (it's seen edge-on when the light is
  // low) and of the land above it.
  const sinEl = Math.max(L.y, 0)
  const cosEl = Math.sqrt(1 - sinEl * sinEl)
  const halfHeight = radius * sinEl + 300 * cosEl
  const reach = 160_000
  const shadowCamera = new OrthographicCamera(-radius, radius, halfHeight, -halfHeight, 0, reach + radius)
  shadowCamera.position.copy(eye).setY(0).addScaledVector(L, reach)
  shadowCamera.up.set(0, 1, 0)
  if (Math.abs(L.y) > 0.99) shadowCamera.up.set(0, 0, -1)
  shadowCamera.lookAt(eye.x, 0, eye.z)
  shadowCamera.updateMatrixWorld()
  shadowCamera.updateProjectionMatrix()

  const height = Math.max(256, Math.min(LAND_SHADOW_SIZE, Math.ceil((LAND_SHADOW_SIZE * halfHeight) / radius / 64) * 64))
  const depth = new DepthTexture(LAND_SHADOW_SIZE, height, FloatType)
  depth.compareFunction = LessEqualCompare
  depth.minFilter = depth.magFilter = LinearFilter
  const target = new WebGLRenderTarget(LAND_SHADOW_SIZE, height, { depthTexture: depth, depthBuffer: true })

  // Only the casters, in plain depth.
  const hidden: Object3D[] = []
  scene.traverse(o => {
    if (o.visible && o !== scene && !isCaster(o, props)) {
      // Keep groups that hold casters.
      let holds = false
      o.traverse(c => (holds ||= c !== o && isCaster(c, props)))
      if (!holds) hidden.push(o)
    }
  })
  hidden.forEach(o => (o.visible = false))
  const override = scene.overrideMaterial
  scene.overrideMaterial = new MeshDepthMaterial()
  renderer.setRenderTarget(target)
  renderer.clear()
  renderer.render(scene, shadowCamera)
  renderer.setRenderTarget(null)
  scene.overrideMaterial.dispose()
  scene.overrideMaterial = override
  hidden.forEach(o => (o.visible = true))

  const matrix = new Matrix4()
    .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
    .multiply(shadowCamera.projectionMatrix)
    .multiply(shadowCamera.matrixWorldInverse)
  return { target, matrix, texel: new Vector2(1 / LAND_SHADOW_SIZE, 1 / height) }
}

export interface LandShadow {
  target: WebGLRenderTarget
  matrix: Matrix4
  texel: Vector2
}

/** Solid props that block the light: shadow casters, landforms, islands. */
function isCaster(o: Object3D, props: Object3D): boolean {
  if (!(o instanceof Mesh)) return false
  const materials = Array.isArray(o.material) ? o.material : [o.material]
  if (materials.some(m => (m as Material).transparent)) return false
  let inProps = false
  o.traverseAncestors(a => (inProps ||= a === props))
  if (!inProps) return false
  let kind: unknown = null
  o.traverseAncestors(a => (kind ??= a.userData.prop))
  kind = o.userData.prop ?? kind
  return o.castShadow || kind === 'landforms' || kind === 'islands'
}

export function bindLandShadow(uniforms: Record<string, { value: unknown }>, shadow: LandShadow): void {
  setShadowMap(uniforms.landShadowMap, shadow.target.depthTexture!)
  ;(uniforms.landShadowMatrix.value as Matrix4).copy(shadow.matrix)
  ;(uniforms.landShadowTexel.value as Vector2).copy(shadow.texel)
  uniforms.landShadowOn.value = 1
}
