import {
  AerialPerspectiveEffect,
  getSunLightColor,
  PrecomputedTexturesGenerator,
  SkyLightProbe,
  SkyMaterial
} from '@takram/three-atmosphere'
import { Ellipsoid, Geodetic, radians } from '@takram/three-geospatial'
import {
  BlendFunction,
  BloomEffect,
  BrightnessContrastEffect,
  Effect,
  EffectComposer,
  EffectPass,
  HueSaturationEffect,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect
} from 'postprocessing'
import {
  Color,
  CubeCamera,
  DirectionalLight,
  HalfFloatType,
  LinearMipmapLinearFilter,
  Matrix4,
  Mesh,
  NoToneMapping,
  PCFShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  Uniform,
  Vector3,
  WebGLCubeRenderTarget,
  WebGLRenderer,
  WebGLRenderTarget
} from 'three'

import { AccumulatePass } from './accumulate'
import { createClouds, loadCloudAssets, renderCloudyEnvironment } from './clouds'
import { meterScene } from './exposure'
import { createMoon, placeMoon } from './moon'
import { createOcean } from './ocean'
import { EARTH_RADIUS, type SceneParams } from './params'
import { PropContext } from './props/context'
import { createProps } from './props'
import { bindShadow } from './shadow'
import { createTerrain, terrainHeight } from './terrain'

const DEG = Math.PI / 180
const REAL_MOON_ANGULAR_RADIUS = 0.0045

/** Exposure and night-time colour grading, applied before bloom/tone mapping. */
class GradeEffect extends Effect {
  constructor(exposure: number, night: number) {
    super(
      'GradeEffect',
      /* glsl */ `
      uniform float exposure;
      uniform float night;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        // Clamp extreme highlights (the sun disc) so bloom doesn't ring.
        vec3 c = min(inputColor.rgb * exposure, vec3(40.0));
        // Scotopic vision: desaturate and shift toward blue in moonlight.
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 nightColor = lum * vec3(0.45, 0.7, 1.35);
        c = mix(c, mix(c, nightColor, 0.85), night);
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.SET,
        uniforms: new Map<string, Uniform>([
          ['exposure', new Uniform(exposure)],
          ['night', new Uniform(night)]
        ])
      }
    )
  }
}

export interface RenderResult {
  canvas: HTMLCanvasElement
  params: SceneParams
  debug: Record<string, unknown>
}

export async function renderScene(
  params: SceneParams,
  width: number,
  height: number,
  canvas?: HTMLCanvasElement
): Promise<RenderResult> {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance'
  })
  renderer.setPixelRatio(1)
  renderer.setSize(width, height, false)
  renderer.toneMapping = NoToneMapping

  // --- Atmosphere frame -----------------------------------------------------
  // World space is a local Y-up frame at sea level (X north, Z east), anchored
  // to a point on the WGS84 ellipsoid so the physical sky model works.
  const anchorECEF = new Geodetic(0, radians(params.latitudeDeg), 0).toECEF()
  const worldToECEF = Ellipsoid.WGS84.getNorthUpEastFrame(anchorECEF, new Matrix4())
  const toECEF = (v: [number, number, number]): Vector3 =>
    new Vector3(...v).transformDirection(worldToECEF)

  const night = params.timeOfDay === 'night'
  // At night the moon is the light source: moonlight is sunlight reflected by
  // the moon, so the sky is physically a very dim "day" sky lit from the moon's
  // direction. We render it at full strength and grade it down afterwards.
  const lightDirection = night ? params.moonDirection : params.sunDirection
  const lightDirectionWorld = new Vector3(...lightDirection)
  const lightECEF = toECEF(lightDirection)
  const moonECEF = toECEF(params.moonDirection)

  const generator = new PrecomputedTexturesGenerator(renderer, { combinedScattering: false })
  const [textures, cloudAssets] = await Promise.all([
    generator.update(),
    params.weather.kind === 'clear' ? Promise.resolve(null) : loadCloudAssets()
  ])

  // --- Camera ---------------------------------------------------------------
  const aspect = width / height
  const hfov = 2 * Math.atan(18 / params.camera.focalLengthMm)
  const vfov = 2 * Math.atan(Math.tan(hfov / 2) / aspect)
  const camera = new PerspectiveCamera(vfov / DEG, aspect, 0.5, 400_000)
  const ground = params.coast.type === 'beach' ? Math.max(terrainHeight(params.coast, 0, 0), 0) : 0
  const h = ground + params.camera.heightM
  camera.position.set(0, h, 0)
  // Solve pitch so the true (dipped) horizon lands at the chosen height.
  const dip = Math.acos(EARTH_RADIUS / (EARTH_RADIUS + h))
  const ndcY = 1 - 2 * params.camera.horizonFraction
  const pitch = -dip - Math.atan(ndcY * Math.tan(vfov / 2))
  camera.rotation.order = 'YXZ'
  camera.rotation.set(pitch, -params.camera.headingDeg * DEG, params.camera.rollDeg * DEG)
  camera.updateMatrixWorld()
  camera.updateProjectionMatrix()

  // --- Sky ------------------------------------------------------------------
  const makeSky = (withSun: boolean): SkyMaterial => {
    const material = new SkyMaterial({ ...textures })
    material.worldToECEFMatrix.copy(worldToECEF)
    material.sunDirection.copy(lightECEF)
    material.moonDirection.copy(moonECEF)
    material.moonAngularRadius = REAL_MOON_ANGULAR_RADIUS * params.moonScale
    // Under a closed overcast deck the sun disc can't be seen.
    material.sun = withSun && !night && params.weather.kind !== 'overcast'
    material.moon = !night
    // Below the sky model's horizon, show something sea-like rather than black
    // in case it peeks out under the ocean's polygonal silhouette.
    material.groundAlbedo.setRGB(0.2, 0.24, 0.28)
    return material
  }
  const skyMesh = (material: SkyMaterial): Mesh => {
    const mesh = new Mesh(new PlaneGeometry(2, 2), material)
    mesh.frustumCulled = false
    mesh.renderOrder = -1
    return mesh
  }

  const scene = new Scene()
  scene.add(skyMesh(makeSky(true)))

  // Environment map of the sky (without the sun disc; the ocean shader adds
  // sun glitter analytically) for water reflections.
  const envScene = new Scene()
  envScene.add(skyMesh(makeSky(false)))

  const moonAngularRadius = REAL_MOON_ANGULAR_RADIUS * params.moonScale
  if (night) {
    const moonDir = new Vector3(...params.moonDirection)
    for (const target of [scene, envScene]) {
      const moon = createMoon()
      placeMoon(moon, camera.position, moonDir, moonAngularRadius, new Vector3(...params.sunDirection))
      target.add(moon)
    }
  }

  const envTarget = new WebGLCubeRenderTarget(256, {
    type: HalfFloatType,
    generateMipmaps: true,
    minFilter: LinearMipmapLinearFilter
  })
  const cubeCamera = new CubeCamera(0.1, 400_000, envTarget)
  cubeCamera.position.copy(camera.position)

  // --- Lighting -------------------------------------------------------------
  const cameraECEF = camera.position.clone().applyMatrix4(worldToECEF)
  // Clouds dim the direct light reaching the scene (a global stand-in for
  // per-pixel cloud shadows in the custom shaders).
  const sunIrradiance = getSunLightColor(textures.transmittanceTexture, cameraECEF, lightECEF, new Color())
    .multiplyScalar(params.weather.sunVisibility)
  const skyProbe = new SkyLightProbe({ irradianceTexture: textures.irradianceTexture })
  skyProbe.worldToECEFMatrix.copy(worldToECEF)
  skyProbe.position.copy(camera.position)
  skyProbe.sunDirection.copy(lightECEF)
  skyProbe.updateMatrixWorld()
  skyProbe.update()
  // Recover horizontal-surface irradiance from the probe's constant SH term.
  const sh0 = skyProbe.sh.coefficients[0]
  const skyIrradiance = new Color(sh0.x, sh0.y, sh0.z).multiplyScalar(Math.sqrt(Math.PI))

  if (night) {
    // Moon radiance consistent with the moonlight illuminating the scene:
    // E = L · π r²  →  L = E / (π r²), using the real angular radius.
    const moonRadiance = sunIrradiance
      .clone()
      .multiplyScalar(1 / (Math.PI * REAL_MOON_ANGULAR_RADIUS ** 2))
    for (const target of [scene, envScene]) {
      target.traverse(o => {
        const mat = (o as Mesh).material as { uniforms?: Record<string, Uniform> }
        if (mat?.uniforms?.radiance) mat.uniforms.radiance.value.copy(moonRadiance)
      })
    }
  }

  // --- Ocean ----------------------------------------------------------------
  const ocean = createOcean(params, renderer.capabilities.getMaxAnisotropy())
  const u = ocean.material.uniforms
  u.envMap.value = envTarget.texture
  u.sunDirection.value.copy(lightDirectionWorld)
  u.sunIrradiance.value.copy(sunIrradiance)
  u.skyIrradiance.value.copy(skyIrradiance)
  scene.add(ocean)

  const terrain = createTerrain(params)
  const tu = terrain.material.uniforms
  tu.envMap.value = envTarget.texture
  tu.sunDirection.value.copy(lightDirectionWorld)
  tu.sunIrradiance.value.copy(sunIrradiance)
  tu.skyIrradiance.value.copy(skyIrradiance)
  scene.add(terrain)

  // --- Sun light, shadows and props -----------------------------------------
  // Standard-material props are lit by a directional light carrying the same
  // irradiance as the custom shaders, plus the sky cube map as environment.
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = PCFShadowMap
  scene.environment = envTarget.texture
  const sun = new DirectionalLight(sunIrradiance.clone(), 1)
  const forward = camera.getWorldDirection(new Vector3()).setY(0).normalize()
  const focus = camera.position.clone().addScaledVector(forward, 150).setY(0)
  sun.target.position.copy(focus)
  sun.position.copy(focus).addScaledVector(lightDirectionWorld, 3000)
  // Always render a shadow map: the custom shaders' shadow sampler must be
  // bound to a real depth texture. Below the horizon the light carries no
  // energy anyway.
  sun.castShadow = true
  sun.shadow.mapSize.set(4096, 4096)
  Object.assign(sun.shadow.camera, { left: -320, right: 320, top: 320, bottom: -320, near: 10, far: 6500 })
  sun.shadow.camera.updateProjectionMatrix()
  sun.shadow.bias = -0.0002
  sun.shadow.normalBias = 0.03
  scene.add(sun, sun.target)
  scene.add(createProps(new PropContext(params, camera)))

  // --- Exposure ---------------------------------------------------------------
  const sceneLuminance = meterScene(renderer, envScene, camera, dip)
  const evBias: Record<SceneParams['timeOfDay'], number> = {
    'golden-hour': 0,
    'sun-on-horizon': -0.3,
    'blue-hour': -1.2,
    daylight: 0,
    midday: 0,
    night: -3.3
  }
  const exposure = (0.16 / Math.max(sceneLuminance, 1e-9)) * 2 ** evBias[params.timeOfDay]

  // --- Post-processing ------------------------------------------------------
  const aerialPerspective = new AerialPerspectiveEffect(camera)
  Object.assign(aerialPerspective, textures)
  aerialPerspective.worldToECEFMatrix.copy(worldToECEF)
  aerialPerspective.sunDirection.copy(lightECEF)

  const composer = new EffectComposer(renderer, {
    frameBufferType: HalfFloatType,
    multisampling: 4
  })
  composer.setSize(width, height, false)
  composer.addPass(new RenderPass(scene, camera))
  const clouds =
    cloudAssets != null
      ? createClouds(camera, params.weather, textures, cloudAssets, worldToECEF, lightECEF)
      : null
  if (clouds != null) {
    // Clouds are soft: ray march them at no more than ~1080p.
    clouds.resolution.scale = Math.min(1, 1920 / width)
    // The clouds render into buffers that aerial perspective composites.
    clouds.events.addEventListener('change', event => {
      if (event.property === 'atmosphereOverlay') aerialPerspective.overlay = clouds.atmosphereOverlay
      if (event.property === 'atmosphereShadow') aerialPerspective.shadow = clouds.atmosphereShadow
      if (event.property === 'atmosphereShadowLength')
        aerialPerspective.shadowLength = clouds.atmosphereShadowLength
    })
    composer.addPass(new EffectPass(camera, clouds, aerialPerspective))
  } else {
    composer.addPass(new EffectPass(camera, aerialPerspective))
  }
  composer.addPass(new EffectPass(camera, new GradeEffect(exposure, night ? 1 : 0)))
  // Average stochastic cloud noise over frames, in linear HDR before bloom.
  if (clouds != null) composer.addPass(new AccumulatePass())
  composer.addPass(
    new EffectPass(
      camera,
      new BloomEffect({
        mipmapBlur: true,
        luminanceThreshold: 1.0,
        luminanceSmoothing: 0.3,
        intensity: 0.45,
        radius: 0.75
      }),
      new VignetteEffect({ offset: 0.35, darkness: 0.35 }),
      new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
      // AgX is neutral but flat; add a little punch.
      new HueSaturationEffect({ saturation: 0.15 }),
      new BrightnessContrastEffect({ contrast: 0.08 })
    )
  )

  // --- Render once ------------------------------------------------------------
  cubeCamera.update(renderer, envScene)
  if (cloudAssets != null) {
    renderCloudyEnvironment(renderer, envScene, envTarget, camera.position, params.weather, textures, cloudAssets, worldToECEF, lightECEF)
  }
  {
    // Render the shadow map once with only the props, then let the custom
    // terrain and ocean shaders sample it.
    ocean.visible = false
    terrain.visible = false
    const scratch = new WebGLRenderTarget(4, 4)
    renderer.setRenderTarget(scratch)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    scratch.dispose()
    ocean.visible = true
    terrain.visible = params.coast.type === 'beach'
    bindShadow(ocean.material.uniforms, sun)
    bindShadow(terrain.material.uniforms, sun)
    renderer.shadowMap.autoUpdate = false
  }
  // Volumetric clouds converge over frames (temporal upscaling and
  // stochastic sampling), so render the still repeatedly before capturing.
  const frames = clouds != null ? 64 : 1
  for (let i = 0; i < frames; i++) composer.render(1 / 60)

  generator.dispose({ textures: false })
  const gl = renderer.getContext()
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  return {
    canvas: renderer.domElement,
    params,
    debug: {
      gpu: debugInfo != null ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
      exposure,
      sceneLuminance,
      sunIrradiance: sunIrradiance.toArray(),
      skyIrradiance: skyIrradiance.toArray(),
      pitchDeg: pitch / DEG,
      vfovDeg: vfov / DEG
    }
  }
}
