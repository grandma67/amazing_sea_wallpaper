import {
  AerialPerspectiveEffect,
  getECIToECEFRotationMatrix,
  getSunLightColor,
  PrecomputedTexturesGenerator,
  SkyLightProbe,
  SkyMaterial,
  StarsGeometry,
  StarsMaterial
} from '@takram/three-atmosphere'
import { ArrayBufferLoader, Ellipsoid, Geodetic, radians } from '@takram/three-geospatial'
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
  PlaneGeometry,
  Points,
  Scene,
  Uniform,
  Vector3,
  WebGLCubeRenderTarget,
  WebGLRenderer,
  WebGLRenderTarget
} from 'three'

import { AccumulatePass } from './accumulate'
import { createCamera } from './camera'
import { createClouds, loadCloudAssets, renderCloudyEnvironment } from './clouds'
import { meterScene } from './exposure'
import { createMoon, placeMoon } from './moon'
import { createOcean } from './ocean'
import type { SceneParams } from './params'
import { PropContext } from './props/context'
import { createProps } from './props'
import { setStormBrightness } from './props/storm'
import { renderPlanarReflection } from './reflection'
import { stormEffects } from './stormEffects'
import { bindCloudShadow, bindShadow } from './shadow'
import { createTerrain } from './terrain'

const DEG = Math.PI / 180
const REAL_MOON_ANGULAR_RADIUS = 0.0045

/** Exposure and night-time colour grading, applied before bloom/tone mapping. */
class GradeEffect extends Effect {
  constructor(exposure: number, night: number, whiteBalance: Color) {
    super(
      'GradeEffect',
      /* glsl */ `
      uniform float exposure;
      uniform float night;
      uniform vec3 whiteBalance;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        // Clamp extreme highlights (the sun disc) so bloom doesn't ring.
        vec3 c = min(inputColor.rgb * exposure * whiteBalance, vec3(40.0));
        // Scotopic vision: desaturate and shift toward blue in moonlight.
        float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 nightColor = lum * vec3(0.33, 0.62, 1.4);
        c = mix(c, mix(c, nightColor, 0.85), night);
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.SET,
        uniforms: new Map<string, Uniform>([
          ['exposure', new Uniform(exposure)],
          ['night', new Uniform(night)],
          ['whiteBalance', new Uniform(whiteBalance)]
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
  canvas?: HTMLCanvasElement,
  /** Frames averaged when clouds are present (fewer = faster, grainier). */
  cloudFrames = 64
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
  const { camera, dip } = createCamera(params, width, height)
  const vfov = camera.fov * DEG

  // --- Sky ------------------------------------------------------------------
  const makeSky = (withSun: boolean): SkyMaterial => {
    const material = new SkyMaterial({ ...textures })
    material.worldToECEFMatrix.copy(worldToECEF)
    material.sunDirection.copy(lightECEF)
    material.moonDirection.copy(moonECEF)
    material.moonAngularRadius = REAL_MOON_ANGULAR_RADIUS * params.moonScale
    // Under a closed overcast deck the sun disc can't be seen.
    material.sun = withSun && !night && params.weather.sunVisibility > 0.1
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
  const sky = skyMesh(makeSky(true))
  sky.userData.sky = true
  scene.add(sky)

  // Environment map of the sky (without the sun disc; the ocean shader adds
  // sun glitter analytically) for water reflections.
  const envScene = new Scene()
  envScene.add(skyMesh(makeSky(false)))

  // Stars at night and late twilight: the real bright-star catalogue, turned
  // to the sky of this date and drawn behind the clouds.
  const starryTwilight = params.timeOfDay === 'blue-hour' && params.sunElevationDeg < -4
  if (night || starryTwilight) {
    const data = await new ArrayBufferLoader().loadAsync(`${import.meta.env.BASE_URL}assets/stars.bin`)
    const geometry = new StarsGeometry(data)
    const eciToWorld = new Matrix4()
      .extractRotation(worldToECEF)
      .transpose()
      .multiply(getECIToECEFRotationMatrix(new Date(`${params.date}T00:00:00Z`).getTime() + params.ocean.time * 1000))
    for (const target of [scene, envScene]) {
      const material = new StarsMaterial({ ...textures })
      material.worldToECEFMatrix.copy(worldToECEF)
      material.sunDirection.copy(lightECEF)
      // At night the sky is rendered at "daylight" scale and graded down
      // afterwards (see above), so the stars need the same boost.
      material.intensity = night ? 4000 : 6
      material.pointSize = Math.max(1, height / 1080)
      const stars = new Points(geometry, material)
      stars.setRotationFromMatrix(eciToWorld)
      stars.frustumCulled = false
      stars.renderOrder = -0.5
      stars.userData.sky = true
      target.add(stars)
    }
  }

  const moonAngularRadius = REAL_MOON_ANGULAR_RADIUS * params.moonScale
  if (night) {
    const moonDir = new Vector3(...params.moonDirection)
    for (const target of [scene, envScene]) {
      const moon = createMoon()
      placeMoon(moon, camera.position, moonDir, moonAngularRadius, new Vector3(...params.sunDirection))
      moon.userData.sky = true
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
  tu.pixelAngle.value = vfov / height
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
  const props = createProps(new PropContext(params, camera))
  scene.add(props)

  // --- Exposure ---------------------------------------------------------------
  // Meter the sky without the (artificially boosted) stars.
  const starFields = envScene.children.filter(o => o instanceof Points)
  starFields.forEach(o => (o.visible = false))
  const sceneLuminance = meterScene(renderer, envScene, camera, dip)
  starFields.forEach(o => (o.visible = true))
  const evBias: Record<SceneParams['timeOfDay'], number> = {
    'golden-hour': 0,
    'sun-on-horizon': -0.3,
    'blue-hour': -0.9,
    daylight: 0,
    midday: 0,
    night: -2.7
  }
  // Twilight under the Bruneton sky skews magenta; cool it toward the blue a
  // camera set to daylight white balance would record.
  const whiteBalance =
    params.timeOfDay === 'blue-hour' ? new Color(0.6, 0.85, 1.25) : new Color(1, 1, 1)
  // The meter only sees the clear sky, but a thick deck hides the sun and
  // turns the light grey: open up and neutralise the blue skylight, as a
  // camera on auto exposure and white balance would.
  const storm = params.storm != null
  // Storms stay dark and moody: only a little of that lift.
  const gloom = (night ? 0 : 1 - params.weather.sunVisibility) * (storm ? 0.35 : 1)
  whiteBalance.lerp(new Color(1.12, 1.0, 0.84).multiply(whiteBalance), gloom)
  // Night vision blends in from dusk: partly desaturated and blue at blue hour.
  const scotopic = night ? 1 : params.timeOfDay === 'blue-hour' ? 0.5 : 0
  const exposure = (0.16 / Math.max(sceneLuminance, 1e-9)) * 2 **
      (evBias[params.timeOfDay] +
        // Low suns light the clouds from below and the horizon stays bright.
        1.1 * gloom * Math.min(Math.max(params.sunElevationDeg / 15, 0), 1))

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
  setStormBrightness(props, sceneLuminance)
  composer.addPass(new EffectPass(camera, new GradeEffect(exposure, scotopic, whiteBalance)))
  const rain = stormEffects(params, camera)
  if (rain.length > 0) composer.addPass(new EffectPass(camera, ...rain))
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
      new HueSaturationEffect({ saturation: 0.15 - 0.3 * gloom }),
      new BrightnessContrastEffect({ contrast: 0.08 })
    )
  )

  // --- Render once ------------------------------------------------------------
  cubeCamera.update(renderer, envScene)
  if (cloudAssets != null) {
    // Reflections are blurry; they need far fewer frames than the main view.
    const envFrames = Math.max(2, Math.round(cloudFrames / 5))
    renderCloudyEnvironment(
      renderer,
      envScene,
      envTarget,
      camera.position,
      params.weather,
      textures,
      cloudAssets,
      worldToECEF,
      lightECEF,
      envFrames
    )
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
    bindCloudShadow(ocean.material.uniforms, params.weather, lightDirectionWorld)
    bindCloudShadow(terrain.material.uniforms, params.weather, lightDirectionWorld)

    // Mirror image of land and props for the water (sky comes from the cube).
    if (params.coast.type === 'beach' || scene.getObjectByName('props')!.children.length > 0) {
      const hide = [ocean, ...scene.children.filter(o => o.userData.sky === true)]
      const reflection = renderPlanarReflection(renderer, scene, camera, width, height, hide)
      ocean.material.uniforms.planarMap.value = reflection.target.texture
      ocean.material.uniforms.planarMatrix.value.copy(reflection.textureMatrix)
      ocean.material.uniforms.planarOn.value = 1
    }
    renderer.shadowMap.autoUpdate = false
  }
  // Volumetric clouds converge over frames (temporal upscaling and
  // stochastic sampling), so render the still repeatedly before capturing.
  const frames = clouds != null ? Math.max(1, cloudFrames) : 1
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
      pitchDeg: camera.rotation.x / DEG,
      vfovDeg: vfov / DEG
    }
  }
}
