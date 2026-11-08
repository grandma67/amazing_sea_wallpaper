import {
  BackSide,
  BoxGeometry,
  Color,
  CubeCamera,
  DepthTexture,
  FloatType,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Plane,
  Scene,
  ShaderMaterial,
  Vector3,
  Vector4,
  WebGLCubeRenderTarget,
  WebGLRenderTarget,
  type Object3D,
  type Texture,
  type WebGLRenderer
} from 'three'

// Planar reflection of the land and everything on it (rocks, sea stacks,
// trees, boats, birds) in the sea surface. The scene is rendered once from a
// camera mirrored below sea level, with an oblique clip plane so nothing below
// the water leaks in, into a transparent target: the ocean shader blends it
// over the sky reflection wherever it has content. Same idea as three.js'
// Reflector, done once for a still.

/** The mirror image's uniforms, for a shader that doesn't declare them
 * itself (terrain.ts; ocean.ts has its own): the target, its depth, the
 * world → target matrix and the depth unprojection, and the haze over the
 * object → water leg (seaHaze.ts reflectionExtinction). */
export const MIRROR_UNIFORMS_GLSL = /* glsl */ `
uniform sampler2D planarMap;
uniform mat4 planarMatrix;
uniform sampler2D planarDepth;
uniform mat4 planarProjInv;
uniform vec3 reflectionAir;
uniform float reflectionSeaHaze;
`

/** Looking up the mirror image along a reflected ray, shared by the sea and
 * the water films on the shore (plans/REFLECTION.md phases 2–5). Needs the
 * uniforms of MIRROR_UNIFORMS_GLSL. The target is cleared to transparent
 * black, so its mips hold premultiplied colour. */
export const MIRROR_GLSL = /* glsl */ `
/** How far the mirrored ray runs past the water to what the mirror camera
 * sees at uv (1e5: nothing, a direction); D is the eye's distance to the water. */
float mirrorDistance(vec2 uv, float D) {
  float depth = textureLod(planarDepth, uv, 0.0).r;
  if (depth >= 1.0) return 1e5;
  vec4 view = planarProjInv * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  return max(length(view.xyz / view.w) - D, 0.0);
}

/** Follow the water's reflected ray Rm from P for t (the length of the
 * mirrored ray past the water) and look up where it lands (phase 2). The
 * mirror camera sees what's above the water itself, so the hit projects
 * straight in. A tilt turns Rm by twice its slope; the image moves by that
 * angle × t / (D + t) as the mirror camera sees it: contact hardening and
 * the lens come out of the projection. Waves finer than the pixel (α, per
 * axis α/√2) turn it ~2·atan(α/√2) more: tilt Rm up by that, see how far
 * the lookup moves, and blur over it (a box ~3.5× the offset has the same
 * spread as a Gaussian of that σ). With streaks: sideways tilts turn the ray
 * only ~sin(grazing) as far as tilts toward the eye (REFLECTION.md §1.3), so
 * blur along the streak, ×sin γ across it (at least a texel), with
 * anisotropic filtering and three taps: up to ~48:1 (phase 3). hazeT comes
 * back as the distance of the object the ray lands on. */
vec4 mirrorAlongRay(vec3 P, float D, float t, vec3 Rm, float alpha, float sinView, bool streaks, inout float hazeT) {
  vec4 hit = planarMatrix * vec4(P + Rm * t, 1.0);
  vec2 uv = hit.xy / hit.w;
  // The object the ray lands on (a tilt can turn it onto one the unshifted
  // point misses): its own distance sets the haze.
  float landDepth = textureLod(planarDepth, uv, 0.0).r;
  if (landDepth < 1.0) {
    vec4 view = planarProjInv * vec4(uv * 2.0 - 1.0, landDepth * 2.0 - 1.0, 1.0);
    hazeT = max(length(view.xyz / view.w) - D, 0.0);
  }
  vec3 up = vec3(0.0, 1.0, 0.0) - Rm * Rm.y;
  float spread = 2.0 * atan(alpha * 0.70710678);
  vec3 tilted = normalize(Rm + normalize(up + vec3(1e-6, 0.0, 0.0)) * tan(spread));
  vec4 hit2 = planarMatrix * vec4(P + tilted * t, 1.0);
  vec2 streak = hit2.xy / hit2.w - uv;
  float offsetPx = length(streak) * float(textureSize(planarMap, 0).y);
  if (streaks) {
    vec2 along = streak * (3.5 / 3.0);
    vec2 texel = 1.0 / vec2(textureSize(planarMap, 0));
    vec2 side = vec2(-along.y, along.x);
    float sideLength = max(length(side) * 3.0 * max(sinView, 0.0), texel.y);
    side = side * sideLength / max(length(side), 1e-9);
    return (textureGrad(planarMap, uv - along, along, side) +
      textureGrad(planarMap, uv, along, side) +
      textureGrad(planarMap, uv + along, along, side)) / 3.0;
  }
  return textureLod(planarMap, uv, clamp(log2(3.5 * offsetPx + 1e-3), 0.0, 9.0));
}

/** The mirror image's light crossed the air twice: object → water (hazeT)
 * and water → eye. The main pass hazes the second leg with the water's
 * pixel; this hazes the first (phase 4): the air's extinction per colour
 * plus the sea haze, which thins with height (takram's 1 km scale height,
 * averaged over the ray's rise R.y·t; seaHaze.ts reflectionTransmittance).
 * It fades toward the sky this ray mirrors (skyReflected): far land's image
 * sits just under the horizon, where that is the horizon sky in its azimuth,
 * and land lost in the haze leaves exactly the sky reflection, no patch. The
 * sea haze fades its share by (1 − T)², as takram's main pass does (it mixes
 * in a haze colour already scaled by its opacity, by that opacity again:
 * scripts/haze.mjs on 2003-03-11's islands); the air's by (1 − T).
 * Premultiplied: the coverage stays. */
vec4 hazeMirror(vec4 planar, float hazeT, vec3 R, vec3 skyReflected) {
  float x = max(R.y * hazeT, 0.0) / 1000.0;
  float thin = x < 1e-3 ? 1.0 - 0.5 * x : (1.0 - exp(-x)) / x;
  vec3 airT = exp(-reflectionAir * hazeT);
  float seaT = exp(-reflectionSeaHaze * thin * hazeT);
  vec3 fade = 1.0 - airT + (1.0 - seaT) * (1.0 - seaT);
  planar.rgb = planar.rgb * airT * seaT + clamp(planar.a, 0.0, 1.0) * skyReflected * min(fade, vec3(1.0));
  return planar;
}
`

export interface PlanarReflection {
  target: WebGLRenderTarget
  /** World position → reflection texture coordinates (projective). */
  textureMatrix: Matrix4
  /** Inverse of the mirror camera's (oblique) projection: unprojects the
   * target's depth texture to view space, whose length is how far the
   * mirrored ray travels to what it hits. */
  projectionInverse: Matrix4
}

/** The camera mirrored in the sea plane (y = 0) with an oblique near plane
 * at the water, and its world → reflection-texture matrix. No GPU: the
 * ocean shader's lookup is tested against it (test/reflection.test.ts). */
export function mirrorCamera(camera: PerspectiveCamera): { mirror: PerspectiveCamera; textureMatrix: Matrix4 } {
  const normal = new Vector3(0, 1, 0)
  const planePoint = new Vector3(0, 0, 0)

  // Mirror the camera position, view target and up vector in the plane.
  const rotation = new Matrix4().extractRotation(camera.matrixWorld)
  const eye = camera.position.clone()
  const position = planePoint.clone().sub(eye).reflect(normal).negate().add(planePoint)
  const lookAt = new Vector3(0, 0, -1).applyMatrix4(rotation).add(eye)
  const target = planePoint.clone().sub(lookAt).reflect(normal).negate().add(planePoint)
  const mirror = new PerspectiveCamera()
  mirror.position.copy(position)
  mirror.up.set(0, 1, 0).applyMatrix4(rotation).reflect(normal)
  mirror.lookAt(target)
  mirror.near = camera.near
  mirror.far = camera.far
  mirror.updateMatrixWorld()
  mirror.projectionMatrix.copy(camera.projectionMatrix)
  mirror.projectionMatrixInverse.copy(camera.projectionMatrixInverse)

  const textureMatrix = new Matrix4()
    .set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1)
    .multiply(mirror.projectionMatrix)
    .multiply(mirror.matrixWorldInverse)

  // Oblique near plane at sea level (Lengyel): clip everything underwater.
  const plane = new Plane().setFromNormalAndCoplanarPoint(normal, planePoint)
  plane.applyMatrix4(mirror.matrixWorldInverse)
  const clip = new Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant)
  const p = mirror.projectionMatrix.elements
  const q = new Vector4(
    (Math.sign(clip.x) + p[8]) / p[0],
    (Math.sign(clip.y) + p[9]) / p[5],
    -1,
    (1 + p[10]) / p[14]
  )
  clip.multiplyScalar(2 / clip.dot(q))
  p[2] = clip.x
  p[6] = clip.y
  p[10] = clip.z + 1 - 0.003
  p[14] = clip.w
  mirror.projectionMatrixInverse.copy(mirror.projectionMatrix).invert()
  return { mirror, textureMatrix }
}

export function renderPlanarReflection(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  width: number,
  height: number,
  hide: Object3D[]
): PlanarReflection {
  const { mirror, textureMatrix } = mirrorCamera(camera)

  const renderTarget = new WebGLRenderTarget(Math.ceil(width / 2), Math.ceil(height / 2), {
    type: HalfFloatType,
    samples: 4,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter,
    magFilter: LinearFilter
  })
  // Depth of what each mirrored ray hits: the ocean blurs the reflection by
  // how far the ray travels past the water (sharp where an object meets it).
  // The ocean blurs it along vertical streaks (textureGrad): let the GPU
  // filter anisotropically. Explicit-lod lookups are unaffected.
  renderTarget.texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
  renderTarget.depthTexture = new DepthTexture(renderTarget.width, renderTarget.height, FloatType)

  const visibility = hide.map(o => o.visible)
  hide.forEach(o => (o.visible = false))
  const clearColor = renderer.getClearColor(new Color())
  const clearAlpha = renderer.getClearAlpha()
  renderer.setClearColor(0x000000, 0)
  renderer.setRenderTarget(renderTarget)
  renderer.clear()
  renderer.render(scene, mirror)
  renderer.setRenderTarget(null)
  renderer.setClearColor(clearColor, clearAlpha)
  hide.forEach((o, i) => (o.visible = visibility[i]))

  return { target: renderTarget, textureMatrix, projectionInverse: mirror.projectionMatrixInverse.clone() }
}

/**
 * The sky cube as water sees it: its lower half replaced by the upper half
 * mirrored (y → |y|). The cube holds a dark "ground" below the horizon
 * (30× darker than the horizon at dusk), and a blurred lookup near the
 * horizon (a rough sea's high mip level) averaged it in: a windy sea's
 * horizon reflection came out several times too dark. Water's facets that
 * would reflect downward are hidden behind the next wave, which the shaders
 * already mimic per sample with abs(R.y); this makes the mips agree. Only
 * the sea and the shore's water films read it; props keep the real cube
 * (their undersides do face the ground). plans/REFLECTION.md phase 6.
 */
export function foldedSkyCube(renderer: WebGLRenderer, sky: Texture, size: number): WebGLCubeRenderTarget {
  const target = new WebGLCubeRenderTarget(size, { type: HalfFloatType, generateMipmaps: true, minFilter: LinearMipmapLinearFilter })
  const material = new ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform samplerCube sky;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        d.y = abs(d.y);
        gl_FragColor = vec4(textureLod(sky, d, 0.0).rgb, 1.0);
      }`,
    uniforms: { sky: { value: sky } },
    side: BackSide,
    depthTest: false,
    depthWrite: false
  })
  const box = new Mesh(new BoxGeometry(2, 2, 2), material)
  box.frustumCulled = false
  const camera = new CubeCamera(0.1, 10, target)
  camera.update(renderer, new Scene().add(box))
  material.dispose()
  box.geometry.dispose()
  return target
}
