import {
  AerialPerspectiveEffect,
  getECIToECEFRotationMatrix,
  getSunLightColor,
  PrecomputedTexturesGenerator,
  type PrecomputedTextures,
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
  type Object3D,
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
import { assetUrl } from './assets'
import { createCamera } from './camera'
import { moonlight as phaseLight } from './celestial'
import { createClouds, loadCloudAssets, renderCloudyEnvironment } from './clouds'
import { eclipseSky } from './eclipse'
import { meterScene } from './exposure'
import { FogEffect } from './fog'
import { LighthouseBeamEffect } from './lighthouse'
import { createMoon, placeMoon } from './moon'
import { createOcean, setOceanRocks } from './ocean'
import { SUN_ANGULAR_RADIUS, type SceneParams } from './params'
import { PropContext } from './props/context'
import type { LanternInfo } from './props/lighthouse'
import { createProps } from './props'
import { reportProps } from './props/report'
import { setGlowBrightness } from './props/storm'
import { setSprayLighting } from './props/surf'
import { renderPlanarReflection } from './reflection'
import { synthesizeOceanAsync } from './spectrum'
import { SkyFillEffect, StillScenePass } from './stillScene'
import { stormEffects } from './stormEffects'
import { bindCloudShadow, bindShadow } from './shadow'
import { SkyDenoiseEffect } from './skyDenoise'
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
  params: SceneParams
  debug: Record<string, unknown>
}

/** Resolves once the GPU has finished the commands issued so far. Waiting for
 * this between accumulation frames keeps the GPU from queueing seconds of
 * work at once, so the browser can still draw the page (the splash's
 * animation) in between, and gives the event loop a turn. */
function gpuIdle(gl: WebGL2RenderingContext): Promise<void> {
  const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
  gl.flush()
  return new Promise(resolve => {
    const poll = (): void => {
      const status = sync == null ? gl.ALREADY_SIGNALED : gl.clientWaitSync(sync, 0, 0)
      if (status === gl.TIMEOUT_EXPIRED) {
        setTimeout(poll, 2)
        return
      }
      if (sync != null) gl.deleteSync(sync)
      resolve()
    }
    setTimeout(poll, 0)
  })
}

/** Starts takram's atmosphere precompute (~1 s of GPU work, the same every
 * day). The generator yields to the event loop between its passes, so a
 * thread busy building the scene would leave the GPU idle; issue every pass
 * at once instead, so the GPU computes the sky while the CPU builds props.
 * `issued` resolves once the passes are queued: then the thread is free. */
function precomputeAtmosphere(
  renderer: WebGLRenderer,
  generator: PrecomputedTexturesGenerator
): { issued: Promise<void>; textures: Promise<PrecomputedTextures> } {
  const target = generator as unknown as { precompute?: (...args: unknown[]) => Iterable<void> }
  const passes = target.precompute?.bind(generator)
  if (passes == null) throw new Error('precomputeAtmosphere: takram generator has no precompute() any more')
  let markIssued!: () => void
  const issued = new Promise<void>(resolve => (markIssued = resolve))
  target.precompute = function* (...args: unknown[]) {
    for (const _ of passes(...args));
    renderer.getContext().flush()
    markIssued()
  }
  return { issued, textures: generator.update() }
}

/** Low-discrepancy sequence in [0, 1): well-spread sub-pixel offsets. */
function halton(index: number, base: number): number {
  let result = 0
  let f = 1 / base
  for (let i = index; i > 0; i = Math.floor(i / base), f /= base) result += f * (i % base)
  return result
}

export async function renderScene(
  params: SceneParams,
  width: number,
  height: number,
  canvas?: HTMLCanvasElement | OffscreenCanvas,
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
  const moonlit = params.nightSky === 'moonlit'
  // At night the moon is the light source: moonlight is sunlight reflected by
  // the moon, so the sky is physically a very dim "day" sky lit from the moon's
  // direction. We render it at full strength and grade it down afterwards.
  // With the moon down, starlight and airglow light the night evenly: a dim
  // light from overhead stands in for them.
  const starlight: [number, number, number] = [0.2, 0.96, 0.2]
  const lightDirection = night ? (moonlit ? params.moonDirection : starlight) : params.sunDirection
  const eclipse = params.eclipse
  const solarEclipse = eclipse != null && eclipse.type.startsWith('solar')
  const totality = eclipse?.type === 'solar-total'
  // How far the camera opens up for a darker night: partly, as the eye
  // adapts, so a half moon is dimmer than a full one and starlight dimmer
  // still (a long exposure under the stars alone).
  const nightScale = !night ? 1 : moonlit ? Math.max(params.moonlight, 0.06) ** 0.5 : 0.5
  const lightDirectionWorld = new Vector3(...lightDirection)
  const lightECEF = toECEF(lightDirection)
  const moonECEF = toECEF(params.moonDirection)

  // The ocean spectrum is synthesized on a worker and the props are built
  // here while the GPU precomputes the atmosphere.
  const oceanSurface = synthesizeOceanAsync(params.ocean)
  const generator = new PrecomputedTexturesGenerator(renderer, { combinedScattering: false })
  const atmosphere = precomputeAtmosphere(renderer, generator)
  const cloudAssetsLoaded = params.weather.kind === 'clear' ? Promise.resolve(null) : loadCloudAssets()

  // --- Camera ---------------------------------------------------------------
  const { camera, dip } = createCamera(params, width, height)
  const vfov = camera.fov * DEG

  // --- Props (CPU only) -------------------------------------------------------
  await atmosphere.issued
  const surface = await oceanSurface
  // Ocean and terrain first: three draws opaque meshes in material-creation
  // order, and equal-depth pixels (sand under props) depend on it.
  const ocean = createOcean(params, surface, renderer.capabilities.getMaxAnisotropy())
  const terrain = createTerrain(params)
  const props = createProps(new PropContext(params, camera, surface))
  const [textures, cloudAssets] = await Promise.all([atmosphere.textures, cloudAssetsLoaded])

  // --- Sky ------------------------------------------------------------------
  const makeSky = (withSun: boolean): SkyMaterial => {
    const material = new SkyMaterial({ ...textures })
    material.worldToECEFMatrix.copy(worldToECEF)
    material.sunDirection.copy(lightECEF)
    material.moonDirection.copy(moonECEF)
    material.moonAngularRadius = REAL_MOON_ANGULAR_RADIUS * params.moonScale
    material.sunAngularRadius = SUN_ANGULAR_RADIUS * params.sunScale
    if (solarEclipse) eclipseSky(material, eclipse, moonECEF, REAL_MOON_ANGULAR_RADIUS * params.moonScale)
    // Under a closed overcast deck the sun disc can't be seen.
    material.sun = withSun && !night && params.weather.sunVisibility > 0.1
    material.moon = !night
    // takram keeps the moon's light fixed, so a disc drawn bigger is dimmer;
    // keep its surface brightness (a real moon is clearly seen by day).
    material.lunarRadianceScale = params.moonScale ** 2
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
  const starryTwilight = (params.timeOfDay === 'blue-hour' && params.sunElevationDeg < -4) || totality
  if (night || starryTwilight) {
    const data = await new ArrayBufferLoader().loadAsync(assetUrl('stars.bin'))
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
      // Darker nights show more of them (not in the sea's reflection: one
      // star fills a texel of the small reflection cube).
      const boost = target === scene ? nightScale ** -1.2 : 1
      // In totality only the brightest stars and planets come out.
      material.intensity = night ? 4000 * boost : totality ? 2.5 : 6
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
  if (moonlit) {
    const moonDir = new Vector3(...params.moonDirection)
    for (const target of [scene, envScene]) {
      const moon = createMoon()
      placeMoon(moon, camera.position, moonDir, moonAngularRadius, new Vector3(...params.sunDirection))
      if (eclipse != null && !solarEclipse) {
        const mu = moon.material.uniforms
        mu.umbra.value = 1
        mu.umbraCenter.value.set(Math.cos(eclipse.angle), Math.sin(eclipse.angle)).multiplyScalar(eclipse.offset)
        mu.umbraRadius.value = eclipse.ratio
      }
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
    // In totality no sunlight reaches us at all.
    .multiplyScalar(totality ? 0 : 1)
  const skyProbe = new SkyLightProbe({ irradianceTexture: textures.irradianceTexture })
  skyProbe.worldToECEFMatrix.copy(worldToECEF)
  skyProbe.position.copy(camera.position)
  skyProbe.sunDirection.copy(lightECEF)
  skyProbe.updateMatrixWorld()
  skyProbe.update()
  // Recover horizontal-surface irradiance from the probe's constant SH term.
  const sh0 = skyProbe.sh.coefficients[0]
  const skyIrradiance = new Color(sh0.x, sh0.y, sh0.z).multiplyScalar(Math.sqrt(Math.PI))
  // ...only the dark sky and the glow round the horizon (eclipse.ts).
  if (totality) skyIrradiance.multiply(new Color(0.012, 0.009, 0.007))

  const elongation =
    Math.acos(Math.max(-1, Math.min(1, new Vector3(...params.moonDirection).dot(new Vector3(...params.sunDirection))))) / DEG
  if (moonlit) {
    // Moon radiance consistent with the moonlight illuminating the scene:
    // E = L · π r²  →  L = E / (π r²), using the real angular radius. That
    // holds for a full moon; a partly lit moon has the same surface
    // brightness but sheds far less light (the phase law), and the scene is
    // lit at a full moon's strength, so its disc is that much brighter
    // against it.
    const moonRadiance = sunIrradiance
      .clone()
      .multiplyScalar(1 / (Math.PI * REAL_MOON_ANGULAR_RADIUS ** 2 * phaseLight(elongation)))
    for (const target of [scene, envScene]) {
      target.traverse(o => {
        const mat = (o as Mesh).material as { uniforms?: Record<string, Uniform> }
        if (mat?.uniforms?.radiance) mat.uniforms.radiance.value.copy(moonRadiance)
        // Earthshine: the dark side lit by the earth, a few hundred-thousandths
        // of a full moon's surface whatever the phase.
        if (mat?.uniforms?.earthshine) mat.uniforms.earthshine.value = 2e-5 * phaseLight(elongation)
      })
    }
  }

  // A lunar eclipse takes the moonlight away (the sky only through the
  // night's exposure): what's left is the umbra's dim copper glow.
  if (eclipse != null && !solarEclipse) {
    sunIrradiance.multiplyScalar(params.moonlight / phaseLight(elongation))
    if (eclipse.type === 'lunar-total') sunIrradiance.multiply(new Color(1, 0.35, 0.15))
  }

  // --- Ocean ----------------------------------------------------------------
  const u = ocean.material.uniforms
  u.envMap.value = envTarget.texture
  u.sunDirection.value.copy(lightDirectionWorld)
  u.sunIrradiance.value.copy(sunIrradiance)
  u.skyIrradiance.value.copy(skyIrradiance)
  scene.add(ocean)

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
  // In totality the props would catch the corona and the horizon glow at
  // daylight strength from the environment map; they're silhouettes.
  if (totality) scene.environmentIntensity = 0.1
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
  setOceanRocks(ocean, props.userData.waterRocks ?? [], camera.position)
  setSprayLighting(props, camera, height, lightDirectionWorld, sunIrradiance, skyIrradiance)
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
  // A dark sky in totality, metered off its bright horizon.
  const eclipseBias = totality ? -1.6 : 0
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
  const exposure = (0.16 / Math.max(sceneLuminance, 1e-9)) * nightScale * 2 **
      (evBias[params.timeOfDay] +
        eclipseBias +
        // Low suns light the clouds from below and the horizon stays bright.
        1.1 * gloom * Math.min(Math.max(params.sunElevationDeg / 15, 0), 1))

  // --- Post-processing ------------------------------------------------------
  const aerialPerspective = new AerialPerspectiveEffect(camera)
  Object.assign(aerialPerspective, textures)
  aerialPerspective.worldToECEFMatrix.copy(worldToECEF)
  aerialPerspective.sunDirection.copy(lightECEF)
  // In totality the air isn't sunlit: no haze glow over the distance.
  aerialPerspective.inscatter = !totality

  const composer = new EffectComposer(renderer, {
    frameBufferType: HalfFloatType,
    multisampling: 4
  })
  composer.setSize(width, height, false)
  const clouds =
    cloudAssets != null
      ? createClouds(camera, params.weather, textures, cloudAssets, worldToECEF, lightECEF)
      : null
  // Accumulated frames only redraw what changes: the spray sprites.
  const spray: Object3D[] = []
  props.traverse(o => {
    if (o.userData.spray === true) spray.push(o)
  })
  const skyObjects: Object3D[] = []
  scene.traverse(o => {
    if (o.userData.sky === true) skyObjects.push(o)
  })
  const still = clouds != null ? new StillScenePass(scene, camera, spray, skyObjects) : null
  composer.addPass(still ?? new RenderPass(scene, camera))
  if (clouds != null) {
    // Clouds are soft: ray march them at no more than ~1080p. Except on a
    // beach, where trees and ridges stand against the sky: each cloud ray
    // stops at the scene depth under its texel, and upsampled across a
    // silhouette, the rays that stopped at a tree (no cloud, no cloud
    // shadow in the air) let the bright clear sky behind the clouds show
    // through as a glowing rim, and a twig thinner than a texel takes the
    // sky's shadowed air. Only full resolution gets those right.
    clouds.resolution.scale = params.coast.type === 'beach' ? 1 : Math.min(1, 1920 / width)
    // A still doesn't need temporal upscaling (one ray per 4×4 block per
    // frame): march every pixel every frame, and the accumulated frames
    // below supersample them.
    clouds.temporalUpscale = false
    // The clouds render into buffers that aerial perspective composites.
    clouds.events.addEventListener('change', event => {
      if (event.property === 'atmosphereOverlay') aerialPerspective.overlay = clouds.atmosphereOverlay
      if (event.property === 'atmosphereShadow') aerialPerspective.shadow = clouds.atmosphereShadow
      if (event.property === 'atmosphereShadowLength')
        aerialPerspective.shadowLength = clouds.atmosphereShadowLength
    })
    composer.addPass(new EffectPass(camera, clouds, aerialPerspective))
    composer.addPass(new EffectPass(camera, new SkyFillEffect(still!)))
  } else {
    composer.addPass(new EffectPass(camera, aerialPerspective))
  }
  setGlowBrightness(props, sceneLuminance)
  const grade = new GradeEffect(exposure, scotopic, whiteBalance)
  // A lit lighthouse's beams in the haze, in the scene's radiance units: a
  // fixed lamp, so they stand out more the darker the sky.
  let lantern: LanternInfo | null = null
  props.traverse(o => {
    if (o.userData.lighthouse != null) lantern = o.userData.lighthouse as LanternInfo
  })
  const beamScale: Record<SceneParams['timeOfDay'], number> = {
    night: 5e6,
    'blue-hour': 1.2e6,
    'sun-on-horizon': 5e5,
    'golden-hour': 1.5e5,
    daylight: 1e5,
    midday: 1e5
  }
  const beams =
    lantern != null && params.lighthouse?.lit === true
      ? [new LighthouseBeamEffect(params.lighthouse, lantern, params.fog, camera, sceneLuminance * beamScale[params.timeOfDay])]
      : []
  if (params.fog != null) {
    // Sunlight the fog layer takes out of the direct beam comes back as
    // diffuse light inside it.
    const { fog } = params
    const sinEl = Math.max(0.05, Math.sin(Math.max(params.sunElevationDeg, 0) * DEG))
    const beam = fog.start === 0 ? Math.exp(-((3.912 / fog.visibility) * fog.height) / sinEl) : 1
    const above = sunIrradiance.clone().multiplyScalar(1 / Math.max(beam, 1e-12))
    const diffuse = skyIrradiance.clone().add(above.multiplyScalar((1 - beam) * sinEl * 0.7))
    composer.addPass(new EffectPass(camera, new FogEffect(fog, camera, lightDirectionWorld, sunIrradiance, diffuse), ...beams, grade))
  } else {
    composer.addPass(new EffectPass(camera, ...beams, grade))
  }
  const rain = stormEffects(params, camera)
  if (rain.length > 0) composer.addPass(new EffectPass(camera, ...rain))
  // Average stochastic cloud noise over frames, in linear HDR before bloom.
  if (clouds != null) composer.addPass(new AccumulatePass())
  // What the average leaves of the light-shaft noise in the clouds, smoothed
  // once on the final frame.
  const skyDenoise =
    clouds != null ? new EffectPass(camera, new SkyDenoiseEffect(1 / clouds.resolution.scale)) : null
  if (skyDenoise != null) composer.addPass(skyDenoise)
  // Bloom and tone mapping only matter for the final frame.
  const finish = new EffectPass(
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
  composer.addPass(finish)

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
      const hide = [
        ocean,
        ...scene.children.filter(o => o.userData.sky === true),
        // Distant mountains are hazed by aerial perspective, which the
        // reflection pass doesn't apply: their mirror image would be far too
        // dark and sharp.
        ...props.children.filter(o => o.userData.distant === true)
      ]
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
  // Each frame looks through a different point of every cloud pixel. The
  // ray marcher only jitters samples along its rays, so without this the
  // fine detail noise aliases into the same speckle in every frame and never
  // averages out (worst at the grazing angles of beach views). Frame 0 is
  // unjittered: it is the one the still scene is cached from.
  const cloudPixel = clouds != null ? 1 / clouds.resolution.scale : 1
  // Wait for the frame before the last one: the GPU always has a frame
  // queued while the next is issued, and never more than two.
  let previousFrame: Promise<void> | null = null
  for (let i = 0; i < frames; i++) {
    if (i > 0) {
      const dx = (halton(i, 2) - 0.5) * cloudPixel
      const dy = (halton(i, 3) - 0.5) * cloudPixel
      camera.setViewOffset(width, height, dx, dy, width, height)
    }
    const last = i === frames - 1
    finish.enabled = last
    if (skyDenoise != null) skyDenoise.enabled = last
    composer.render(1 / 60)
    if (!last) {
      const done = gpuIdle(renderer.getContext() as WebGL2RenderingContext)
      if (previousFrame != null) await previousFrame
      previousFrame = done
    }
  }
  camera.clearViewOffset()

  generator.dispose({ textures: false })
  const gl = renderer.getContext()
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  return {
    params,
    debug: {
      gpu: debugInfo != null ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
      exposure,
      sceneLuminance,
      nightScale,
      sunIrradiance: sunIrradiance.toArray(),
      skyIrradiance: skyIrradiance.toArray(),
      pitchDeg: camera.rotation.x / DEG,
      props: reportProps(props, camera, width, height),
      vfovDeg: vfov / DEG
    }
  }
}
