import {
  AerialPerspectiveEffect,
  AtmosphereParameters,
  METER_TO_LENGTH_UNIT,
  getSunLightColor,
  PrecomputedTexturesGenerator,
  type PrecomputedTextures,
  SkyLightProbe,
  SkyMaterial,
  StarsGeometry
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
  AmbientLight,
  DirectionalLight,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix3,
  Matrix4,
  Mesh,
  NoToneMapping,
  type Object3D,
  PCFShadowMap,
  PlaneGeometry,
  Points,
  RepeatWrapping,
  Scene,
  Texture,
  Uniform,
  Vector3,
  Vector4,
  WebGLCubeRenderTarget,
  WebGLRenderer,
  WebGLRenderTarget
} from 'three'

import { AccumulatePass } from './accumulate'
import { assetUrl } from './assets'
import type { RGB } from './biome'
import { createCamera } from './camera'
import { moonlight as phaseLight } from './celestial'
import { createClouds, loadCloudAssets, loadImageTexture, primeCloudShadow, renderCloudyEnvironment } from './clouds'
import { patchSkyContrails } from './contrails'
import { patchSkyNoctilucent } from './noctilucent'
import { patchSkyMeteors } from './meteors'
import { auroraLux, auroraScale, patchCloudsAurora, patchSkyAurora } from './aurora'
import { extinction, GLITTER_MAGNITUDE, planetStarData, PLANET_MAGNITUDES, PLANETS } from './planets'
import { glowScale, patchSkyNightGlow, type GlowFrame } from './nightGlow'
import { eclipseSky } from './eclipse'
import type { DebugPass } from './debug'
import { ICE_REFLECTANCE, meterScene } from './exposure'
import { frameBoost, frameBoostRule, FrameMeterPass, longExposureLook, shutterSeconds } from './frameMeter'
import { cloudDrift } from './cloudArrangement'
import { windDirection } from './props/wind'
import { FogEffect } from './fog'
import { fogSunTransmittance } from './fogLayer'
import { LighthouseBeamEffect } from './lighthouse'
import { createMoon, placeMoon } from './moon'
import { createOcean, MAX_LAMPS, setOceanIslands, setOceanRocks, setOceanShips } from './ocean'
import { SUN_ANGULAR_RADIUS, type SceneParams } from './params'
import { PropContext } from './props/context'
import type { LanternInfo } from './props/lighthouse'
import { createProps } from './props'
import type { LitterField } from './props/leafLitter'
import type { SkyOpenField } from './props/skyOcclusion'
import { reportProps } from './props/report'
import { desertBloomFor } from './bloomYears'
import { setFireflyBrightness } from './props/fireflies'
import { loadScan } from './props/scans'
import { lampsForOcean, lampSprites, setLampBrightness, skyLuminance } from './props/shipLights'
import { setGlowBrightness } from './props/storm'
import { setSprayLighting, type WaterIsland } from './props/surf'
import { foldedSkyCube, renderPlanarReflection } from './reflection'
import { apply, ECLIPTIC_POLE, skyRotation, sunECI } from './skyClock'
import { darkZenithLuminance, elongationDeg, renderPerLux, starScale, STARLIT_LUX } from './starLight'
import { createStarsMaterial } from './stars'
import { synthesizeOceanAsync } from './spectrum'
import { SkyFillEffect, StillScenePass } from './stillScene'
import { stormCells } from './stormCells'
import { FLASH_RADIANCE, flashGlows, stormEffects } from './stormEffects'
import { dustSkylight, dustTransmittance, reflectionExtinction } from './seaHaze'
import { shadeProps } from './propShade'
import { bindCloudShadow, bindLandShadow, bindShadow, FINE_SHADOW_SIZE, fineShadowScale, fitFineShadow, landCloudUniforms, renderLandShadow } from './shadow'
import { cloudSkylightRatio, measureSkylight, skyOpenUniforms } from './skylight'
import { SkyDenoiseEffect } from './skyDenoise'
import { GpuResources, trackUploads } from './dispose'
import { createTerrain, createTerrainCaster, hasLand, terrainHeight } from './terrain'
import { NIGHT_WHITE_BALANCE_K, whiteBalanceGains } from './whiteBalance'
import { probeResult, ProbePass, readCanvas, readCube, type ProbeBox } from './probe'
import { probeTerrain } from './terrainTerms'
import { countWater } from './waterCount'
import { lineDirections, lineStats } from './skyMirror'
import { dirFromAzEl as skyDir, pixelOf } from './skyFrame'

const DEG = Math.PI / 180
/** Reflection cube map size (texels per face). */
const ENV_SIZE = 256
const REAL_MOON_ANGULAR_RADIUS = 0.0045

/** Exposure and the camera's white balance, applied before bloom/tone
 * mapping. A camera has no rods: night frames keep their colours
 * (whiteBalance.ts). */
class GradeEffect extends Effect {
  constructor(exposure: number, whiteBalance: Color) {
    super(
      'GradeEffect',
      /* glsl */ `
      uniform float exposure;
      uniform vec3 whiteBalance;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        // Clamp extreme highlights (the sun disc) so bloom doesn't ring.
        vec3 c = min(inputColor.rgb * exposure * whiteBalance, vec3(40.0));
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        blendFunction: BlendFunction.SET,
        uniforms: new Map<string, Uniform>([
          ['exposure', new Uniform(exposure)],
          ['whiteBalance', new Uniform(whiteBalance)]
        ])
      }
    )
  }
}

export interface RenderResult {
  params: SceneParams
  debug: Record<string, unknown>
  /** Releases the WebGL context (the canvas goes blank). Everything else the
   * render made is freed before renderScene returns; the canvas keeps the
   * picture (preserveDrawingBuffer). */
  dispose(): void
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
  const gpu = new GpuResources()
  const uploads = trackUploads()

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
  const oceanSurface = synthesizeOceanAsync(params.ocean, params.debug?.passes?.shortWaves !== false)
  const generator = new PrecomputedTexturesGenerator(renderer, { combinedScattering: false })
  const atmosphere = precomputeAtmosphere(renderer, generator)
  // The clouds pass also draws the sea haze: dust days need it under a clear sky.
  // Passes a debug spec switches off (debug.ts): on unless false.
  const pass = (name: DebugPass): boolean => params.debug?.passes?.[name] !== false
  const cloudAssetsLoaded =
    (params.weather.kind === 'clear' && params.weather.dust == null) || !pass('clouds') ? Promise.resolve(null) : loadCloudAssets()
  // The night sky's glow (nightGlow.ts) needs the Milky Way map.
  const glow = pass('glow') ? params.nightGlow : null
  const milkyWayLoaded =
    glow?.milkyWay === true
      ? loadImageTexture(assetUrl('milkyway.png')).then(t => {
          // Galactic longitude wraps; sampled at full size (0.35°/texel).
          t.wrapS = RepeatWrapping
          t.generateMipmaps = false
          t.minFilter = LinearFilter
          // A texture made from an image uploads only when told to.
          t.needsUpdate = true
          return t
        })
      : Promise.resolve(null)

  // --- Camera ---------------------------------------------------------------
  const { camera, dip } = createCamera(params, width, height)
  const vfov = camera.fov * DEG
  // Fog overhead dims the sun by the layer above the eye: inside it, all of
  // it; above an advection fog's top, almost none (fogLayer.ts).
  const fogSun = fogSunTransmittance(params.fog, camera.position.y, params.sunElevationDeg)
  const weather = { ...params.weather, sunVisibility: params.weather.sunVisibility * fogSun }

  // --- Props (CPU only) -------------------------------------------------------
  await atmosphere.issued
  const surface = await oceanSurface
  // Ocean and terrain first: three draws opaque meshes in material-creation
  // order, and equal-depth pixels (sand under props) depend on it.
  const ocean = createOcean(params, surface, renderer.capabilities.getMaxAnisotropy())
  const terrain = createTerrain(params, camera)
  // A bloom year's orange daisies are Poly Haven's Ursinia scan (a chunk of its own).
  if (desertBloomFor(params)?.plants.some(([p]) => p === 'orange-daisy')) await loadScan('ph_flower_ursinia')
  const props = createProps(new PropContext(params, camera, surface, vfov / height))
  const [textures, cloudAssets, milkyWayMap] = await Promise.all([atmosphere.textures, cloudAssetsLoaded, milkyWayLoaded])
  // The sky clock turns the catalogue so the real sun for the date lands on
  // the scene's sun (NIGHT_SKY phase 1); the glow and planets follow it.
  const eciToWorld = skyRotation(params).matrix

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
    material.sun = withSun && !night && weather.sunVisibility > 0.1
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
  const skyMaterial = makeSky(true)
  patchSkyNoctilucent(skyMaterial, params.noctilucent, params.nacreous)
  patchSkyContrails(skyMaterial, params.contrails, worldToECEF, AtmosphereParameters.DEFAULT.bottomRadius, METER_TO_LENGTH_UNIT)
  // Shooting stars in the stars' units (meteors.ts); too thin for the cube.
  if (pass('meteors')) patchSkyMeteors(skyMaterial, params.meteors, worldToECEF, starScale(params.nightSky, elongationDeg(params)), vfov)
  const sky = skyMesh(skyMaterial)
  sky.userData.sky = true
  scene.add(sky)

  // Environment map of the sky (without the sun disc; the ocean shader adds
  // sun glitter analytically) for water reflections.
  const envScene = new Scene()
  const envSkyMaterial = makeSky(false)
  envScene.add(skyMesh(envSkyMaterial))

  // The night's own light, on the sky and its reflection (smooth enough for
  // the cube). Patched last: it runs first, under the other sky patches. On a
  // starlit night it is the sky; otherwise it adds to the scattered light.
  // Northern lights on both skies (the sea mirrors them), before the glow's
  // patch so they add to the night sky it draws.
  const aurora = pass('aurora') ? params.aurora : null
  if (aurora != null) {
    const scale = auroraScale(renderPerLux(params.nightSky, elongationDeg(params)))
    for (const material of [skyMaterial, envSkyMaterial]) patchSkyAurora(material, aurora, worldToECEF, scale)
  }
  if (glow != null) {
    const az = (params.coast.seawardAzimuthDeg * Math.PI) / 180
    const frame: GlowFrame = {
      eciToWorld,
      worldToECEF: new Matrix3().setFromMatrix4(worldToECEF),
      eclipticPole: apply(eciToWorld, ECLIPTIC_POLE),
      realSun: apply(eciToWorld, sunECI(params.date)),
      inland: hasLand(params.coast) ? [-Math.sin(az), 0, Math.cos(az)] : null
    }
    const scale = glowScale(params.nightSky, elongationDeg(params))
    const map = milkyWayMap ?? new Texture()
    for (const material of [skyMaterial, envSkyMaterial]) patchSkyNightGlow(material, glow, frame, map, scale, night && !moonlit)
  }

  // Stars at night and late twilight: the real bright-star catalogue, turned
  // to the sky of this date and drawn behind the clouds.
  // Each star carries its real light in the sky's units (starLight.ts), so
  // twilight, the moon and the night's darkness decide which ones show.
  if ((night || params.sunElevationDeg < 0 || totality) && pass('stars')) {
    const data = await new ArrayBufferLoader().loadAsync(assetUrl('stars.bin'))
    const geometry = new StarsGeometry(data)
    const r = eciToWorld
    const starRotation = new Matrix4().set(r[0], r[1], r[2], 0, r[3], r[4], r[5], 0, r[6], r[7], r[8], 0, 0, 0, 0, 1)
    const scale = starScale(params.nightSky, elongationDeg(params))
    for (const target of [scene, envScene]) {
      // The reflection cube's faces are 90° and ENV_SIZE texels tall.
      const material =
        target === scene
          ? createStarsMaterial({ ...textures }, scale, height, height / 1080)
          : createStarsMaterial({ ...textures }, scale, ENV_SIZE, 1)
      material.worldToECEFMatrix.copy(worldToECEF)
      material.sunDirection.copy(lightECEF)
      const stars = new Points(geometry, material)
      stars.setRotationFromMatrix(starRotation)
      stars.frustumCulled = false
      stars.renderOrder = -0.5
      stars.userData.sky = true
      target.add(stars)
    }
  }

  // Planets (planets.ts): stars of their own, already in the world frame.
  // Main sky only: Venus and Jupiter reach the sea as a glint (below).
  const planets = pass('stars') ? params.planets : []
  if (planets.length > 0) {
    const geometry = new StarsGeometry(planetStarData(planets, PLANET_MAGNITUDES))
    const material = createStarsMaterial({ ...textures }, starScale(params.nightSky, elongationDeg(params)), height, height / 1080)
    material.magnitudeRange.set(...PLANET_MAGNITUDES)
    material.worldToECEFMatrix.copy(worldToECEF)
    material.sunDirection.copy(lightECEF)
    const points = new Points(geometry, material)
    points.frustumCulled = false
    points.renderOrder = -0.5
    points.userData.sky = true
    scene.add(points)
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

  const envTarget = new WebGLCubeRenderTarget(ENV_SIZE, {
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
    .multiplyScalar(weather.sunVisibility)
    // In totality no sunlight reaches us at all.
    .multiplyScalar(totality ? 0 : 1)
  // Harmattan dust dims and reddens the sun; the skylight gets it back below.
  const sunClear = sunIrradiance.clone()
  sunIrradiance.multiply(new Color(...dustTransmittance(params.weather, params.visibilityKm, params.sunElevationDeg)))
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
  skyIrradiance.setRGB(...dustSkylight(skyIrradiance.toArray() as RGB, sunClear.toArray() as RGB, sunIrradiance.toArray() as RGB, params.sunElevationDeg, params.weather))
  // A starlit night has no direct light: airglow and starlight come from the
  // whole sky (~0.002 lux, STARS.md §1), diffuse and shadowless. The stand-in
  // sun overhead only draws the sky; the ground gets the night's light as sky
  // light, in the sky's units (starLight.ts). Props see the sky cube too, so
  // they get the rest as an ambient light.
  let starlitAmbient: Color | null = null
  if (night && !moonlit) {
    sunIrradiance.setScalar(0)
    const lux = STARLIT_LUX * renderPerLux('starlit', 0) * weather.sunVisibility
    const probe = 0.2126 * skyIrradiance.r + 0.7152 * skyIrradiance.g + 0.0722 * skyIrradiance.b
    starlitAmbient = skyIrradiance.clone().multiplyScalar(Math.max(lux - probe, 0) / probe)
    skyIrradiance.multiplyScalar(lux / probe)
  }

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
  tu.stoneMeshRadius.value.set(...(props.userData.stoneRadius as [number, number, number]))
  const litter = props.userData.litter as LitterField | null
  if (litter != null) {
    tu.litterMap.value = litter.texture
    tu.litterRect.value.set(...litter.rect)
    tu.litterColor.value.setRGB(...litter.color)
    tu.litterAmount.value = litter.amount
  }
  scene.add(terrain)
  const terrainCaster = createTerrainCaster(terrain)
  scene.add(terrainCaster)

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
  // ~0.3 m along the light (depth range 6490 m): props do shade themselves, so
  // they need some, but more starts a shadow late on whatever it falls across.
  sun.shadow.bias = -0.00005
  sun.shadow.normalBias = 0.03
  scene.add(sun, sun.target)
  // The fine slice: no light of its own, only a shadow map over the view's
  // first 40 m, a few cm a texel (shadow.ts fitFineShadow). Added after the
  // sun so three lists it second (propShade.ts reads it as light 1).
  const fineSun = new DirectionalLight(0x000000, 0)
  fineSun.castShadow = pass('shadows')
  fineSun.shadow.mapSize.set(FINE_SHADOW_SIZE, FINE_SHADOW_SIZE)
  const ground = camera.position.y - params.camera.heightM
  const fineTexel = fineSun.castShadow ? fitFineShadow(fineSun, camera, lightDirectionWorld, Math.min(ground, 0) - 3, ground + 30) : 0
  if (fineSun.castShadow) scene.add(fineSun, fineSun.target)
  // Set again once the sky cube is drawn (below): the night's light less what
  // the cube gives.
  const starlitLight = starlitAmbient != null ? new AmbientLight(starlitAmbient, 1) : null
  if (starlitLight != null) scene.add(starlitLight)
  let auroraAmbient: AmbientLight | null = null
  // The aurora's own light on the ground: the display as drawn, integrated
  // over the sky (aurora.ts auroraLux), through the gaps in the cloud.
  if (aurora != null) {
    const auroraLight = new Color(...auroraLux(aurora)).multiplyScalar(renderPerLux(params.nightSky, elongation) * weather.sunVisibility)
    tu.skyIrradiance.value.add(auroraLight)
    u.skyIrradiance.value.add(auroraLight)
    auroraAmbient = new AmbientLight(auroraLight, 1)
    scene.add(auroraAmbient)
  }
  setOceanRocks(ocean, props.userData.waterRocks ?? [], camera.position)
  setOceanIslands(ocean, props.userData.waterIslands ?? [], camera.position)
  setOceanShips(ocean, props.userData.ships ?? [], camera.position)
  setSprayLighting(props, camera, height, lightDirectionWorld, sunIrradiance, skyIrradiance)
  scene.add(props)

  // --- Exposure ---------------------------------------------------------------
  // Meter the sky without the (artificially boosted) stars.
  const starFields = envScene.children.filter(o => o instanceof Points)
  starFields.forEach(o => (o.visible = false))
  // Nor the aurora: a photographer exposes for the scene, not for a display
  // overhead out of frame.
  const auroraUniform = envSkyMaterial.uniforms.auroraA?.value as Vector4 | undefined
  const auroraScaleValue = auroraUniform?.w ?? 0
  if (auroraUniform != null) auroraUniform.w = 0
  // A frozen sea is bright, and the meter sees it (seaIce.ts).
  const metered = meterScene(renderer, envScene, camera, dip, params.seaIce != null ? ICE_REFLECTANCE : undefined)
  if (auroraUniform != null) auroraUniform.w = auroraScaleValue
  const sceneLuminance = metered.luminance
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
  // An aurora photographer exposes for the aurora (10–25 s at high ISO):
  // ~1.5 stops more than a plain night frame.
  const auroraBias = aurora != null ? 1.5 : 0
  // Twilight under the Bruneton sky skews magenta; cool it toward the blue a
  // camera set to daylight white balance would record. Night frames are shot
  // at a night white balance (~4000 K): blue sky, colours kept.
  const whiteBalance =
    params.timeOfDay === 'blue-hour'
      ? new Color(0.6, 0.85, 1.25)
      : night
        ? new Color(...whiteBalanceGains(NIGHT_WHITE_BALANCE_K))
        : new Color(1, 1, 1)
  // The meter only sees the clear sky, but a thick deck hides the sun and
  // turns the light grey: open up and neutralise the blue skylight, as a
  // camera on auto exposure and white balance would.
  const storm = params.storm != null
  // Storms stay dark and moody: only a little of that lift.
  const gloom = (night ? 0 : 1 - weather.sunVisibility) * (storm ? 0.35 : 1)
  whiteBalance.lerp(new Color(1.12, 1.0, 0.84).multiply(whiteBalance), gloom)
  // A debug spec can fix it (diff.mjs --keep-exposure), so a sky or weather
  // change doesn't re-expose the whole frame.
  const exposure =
    params.debug?.exposure ??
    (0.16 / Math.max(sceneLuminance, 1e-9)) * nightScale * 2 **
      (evBias[params.timeOfDay] +
        eclipseBias +
        auroraBias +
        // Low suns light the clouds from below and the horizon stays bright.
        1.1 * gloom * Math.min(Math.max(params.sunElevationDeg / 15, 0), 1))
  // Lightning's glow on the cloud base, mirrored by the sea.
  const glows = flashGlows(params, camera)
  glows.forEach((g, i) => (u.flashGlows.value as Vector4[])[i].copy(g))
  u.flashCount.value = glows.length
  ;(u.flashRadiance.value as Color).setRGB(...FLASH_RADIANCE)

  // --- Post-processing ------------------------------------------------------
  const aerialPerspective = new AerialPerspectiveEffect(camera)
  Object.assign(aerialPerspective, textures)
  aerialPerspective.worldToECEFMatrix.copy(worldToECEF)
  aerialPerspective.sunDirection.copy(lightECEF)
  // In totality the air isn't sunlit: no haze glow over the distance.
  aerialPerspective.inscatter = !totality
  if (!pass('aerial')) aerialPerspective.blendMode.opacity.value = 0

  const composer = new EffectComposer(renderer, {
    frameBufferType: HalfFloatType,
    multisampling: 4
  })
  composer.setSize(width, height, false)
  // Lightning and rain shafts hang from storm cells in the Cb layer.
  const cells = stormCells(params.storm, camera.position)
  const clouds =
    cloudAssets != null
      ? createClouds(camera, weather, textures, cloudAssets, worldToECEF, lightECEF, params.visibilityKm, cells)
      : null
  // The sea haze off in the frame alone (the clouds stay, and the sky cube keeps
  // its haze): an object's unhazed colour under the same light (scripts/haze.mjs).
  if (clouds != null && !pass('seaHaze')) clouds.haze = false
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
  // The display lights the clouds (their edges toward it glow).
  if (clouds != null && aurora != null && pass('auroraClouds')) {
    patchCloudsAurora(clouds.cloudsPass.currentMaterial, worldToECEF, aurora, renderPerLux(params.nightSky, elongation))
  }
  if (clouds != null) {
    // Clouds are soft: ray march them at no more than ~1080p. Except on a
    // beach, where trees and ridges stand against the sky: each cloud ray
    // stops at the scene depth under its texel, and upsampled across a
    // silhouette, the rays that stopped at a tree (no cloud, no cloud
    // shadow in the air) let the bright clear sky behind the clouds show
    // through as a glowing rim, and a twig thinner than a texel takes the
    // sky's shadowed air. Only full resolution gets those right.
    clouds.resolution.scale = hasLand(params.coast) ? 1 : Math.min(1, 1920 / width)
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
    if (pass('skyFill')) composer.addPass(new EffectPass(camera, new SkyFillEffect(still!)))
  } else {
    composer.addPass(new EffectPass(camera, aerialPerspective))
  }
  setGlowBrightness(props, sceneLuminance)
  // Ships' lamps: candela into scene units by what the metered sky really is.
  const perCdM2 = sceneLuminance / skyLuminance(params)
  setLampBrightness(props, perCdM2)
  setFireflyBrightness(props, perCdM2)
  // Venus and Jupiter glitter on the sea like a lamp at infinity: a far
  // point (10,000 km: within ~0.1° of the same direction over the whole
  // sea) whose I / r² is the planet's irradiance through the air.
  const bright = planets.filter(p => p.magnitude < GLITTER_MAGNITUDE && p.direction[1] > 0)
  const lamps = lampsForOcean(props, camera.position, MAX_LAMPS - bright.length)
  lamps.forEach((lamp, i) => {
    ;(u.lampPositions.value as Vector3[])[i].copy(lamp.position)
    ;(u.lampIntensities.value as Vector3[])[i].copy(lamp.intensity).multiplyScalar(perCdM2)
  })
  const far = 1e7
  const scaleNow = starScale(params.nightSky, elongationDeg(params))
  bright.forEach((planet, k) => {
    const i = lamps.length + k
    const colour = PLANETS.find(q => q.id === planet.id)!.colour
    const irradiance = scaleNow * 10 ** (-0.4 * planet.magnitude) * extinction(Math.asin(planet.direction[1])) * far * far
    ;(u.lampPositions.value as Vector3[])[i].copy(camera.position).addScaledVector(new Vector3(...planet.direction), far)
    ;(u.lampIntensities.value as Vector3[])[i].set(...colour).multiplyScalar(irradiance)
  })
  u.lampCount.value = lamps.length + bright.length
  const grade = new GradeEffect(exposure, whiteBalance)
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
      ? [
          new LighthouseBeamEffect(
            params.lighthouse,
            lantern,
            params.fog,
            camera,
            sceneLuminance * beamScale[params.timeOfDay],
            pass('beamShadow') ? (x, z) => terrainHeight(params.coast, x, z) : null,
            pass('beamShadow') ? ((props.userData.waterIslands ?? []) as WaterIsland[]) : []
          )
        ]
      : []
  if (params.fog != null) {
    // Sunlight the fog layer takes out of the direct beam comes back as
    // diffuse light inside it.
    const { fog } = params
    const sinEl = Math.max(0.05, Math.sin(Math.max(params.sunElevationDeg, 0) * DEG))
    const beam = fogSun
    const above = sunIrradiance.clone().multiplyScalar(1 / Math.max(beam, 1e-12))
    const diffuse = skyIrradiance.clone().add(above.multiplyScalar((1 - beam) * sinEl * 0.7))
    composer.addPass(new EffectPass(camera, new FogEffect(fog, camera, lightDirectionWorld, sunIrradiance, diffuse), ...beams, grade))
  } else {
    composer.addPass(new EffectPass(camera, ...beams, grade))
  }
  const rain = stormEffects(params, camera, exposure)
  if (rain.length > 0) composer.addPass(new EffectPass(camera, ...rain))
  // Average stochastic cloud noise over frames, in linear HDR before bloom.
  const accumulate = clouds != null ? new AccumulatePass() : null
  if (accumulate != null) composer.addPass(accumulate)
  // What the average leaves of the light-shaft noise in the clouds, smoothed
  // once on the final frame.
  const skyDenoise =
    clouds != null ? new EffectPass(camera, new SkyDenoiseEffect(1 / clouds.resolution.scale)) : null
  if (skyDenoise != null) composer.addPass(skyDenoise)
  // Bloom and tone mapping only matter for the final frame.
  const bloom = new BloomEffect({
    mipmapBlur: true,
    luminanceThreshold: 1.0,
    luminanceSmoothing: 0.3,
    intensity: 0.45,
    radius: 0.75
  })
  if (!pass('bloom')) bloom.blendMode.opacity.value = 0
  const finish = new EffectPass(
    camera,
    bloom,
    new VignetteEffect({ offset: 0.35, darkness: 0.35 }),
    new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
    // AgX is neutral but flat; add a little punch.
    new HueSaturationEffect({ saturation: 0.15 - 0.3 * gloom }),
    new BrightnessContrastEffect({ contrast: 0.08 })
  )
  // The pixel probe reads the exposed image just before bloom and tone
  // mapping, on the last frame (probe.ts, debug.probe).
  const probes = params.debug?.probe ?? []
  const probeBoxes: (ProbeBox | null)[] = probes.map(at => {
    const half = params.debug?.probeHalf ?? 2
    let px: [number, number] | null
    if (Array.isArray(at)) px = [at[0] * (width - 1), at[1] * (height - 1)]
    else if ('world' in at || 'mirror' in at) {
      // A world point, or its mirror image in the sea plane, through the render camera.
      const [x, y, z] = 'world' in at ? at.world : at.mirror
      camera.updateMatrixWorld()
      const n = new Vector3(x, 'world' in at ? y : -y, z).project(camera)
      px = n.z < 1 && Math.abs(n.x) <= 1 && Math.abs(n.y) <= 1 ? [((n.x + 1) / 2) * (width - 1), ((1 - n.y) / 2) * (height - 1)] : null
    } else
      // The render's own aspect (createCamera), not the composed one.
      px = pixelOf({ camera: { ...params.camera, aspect: width / height } }, skyDir(params.camera.headingDeg + at.az, at.el), width, height, dip)
    if (px == null) return null
    const clampPx = (v: number, n: number): number => Math.min(n - 1 - half, Math.max(half, v))
    return { pixel: [clampPx(px[0], width), clampPx(px[1], height)], half }
  })
  // The line probe: one pixel per sample, after the points.
  const lines = [params.debug?.probeLine ?? []].flat()
  const linePoints = lines.map(line => lineDirections(params, line))
  const lineBoxes: (ProbeBox | null)[][] = linePoints.map(points =>
    points.map(pt => {
      const px = pixelOf({ camera: { ...params.camera, aspect: width / height } }, pt.dir, width, height, dip)
      return px == null ? null : { pixel: [Math.min(width - 1, Math.round(px[0])), Math.min(height - 1, Math.round(px[1]))], half: 0 }
    })
  )
  const allBoxes = [...probeBoxes, ...lineBoxes.flat()]
  // The frame's own meter (frameMeter.ts): opens up a frame too dark to read,
  // on the averaged frame before bloom; the probe sees the result. Off
  // (passes.frameMeter) or with a pinned exposure it still reads, at ×1.
  const boostRule = params.debug?.exposure == null && pass('frameMeter') ? frameBoostRule(params) : null
  const meter = new FrameMeterPass(m => (boostRule == null ? 1 : frameBoost(m, boostRule)))
  composer.addPass(meter)
  const probePass = allBoxes.length > 0 ? new ProbePass(allBoxes, height) : null
  if (probePass != null) composer.addPass(probePass)
  composer.addPass(finish)

  // --- Render once ------------------------------------------------------------
  // Land and cloud shade on the props (propShade.ts).
  const propUniforms: Record<string, { value: unknown }> = { ...landCloudUniforms(), ...skyOpenUniforms(), fineShadowScale: { value: new Vector3() } }
  // The sky the crowns hide (props/skyOcclusion.ts), on the ground and props.
  const skyOpen = pass('skyOcclusion') ? (props.userData.skyOpen as SkyOpenField | null) : null
  if (skyOpen != null) {
    for (const uniforms of [tu, propUniforms]) {
      uniforms.skyOpenMap.value = skyOpen.texture
      ;(uniforms.skyOpenRect.value as Vector4).set(...skyOpen.rect)
    }
  }
  let shadeCoverage: ReturnType<typeof shadeProps> = {}
  cubeCamera.update(renderer, envScene)
  // Clouds by day and under the moon: dust gives its own light back
  // (dustSkylight); starlit nights are set from the night's lux (below), and
  // totality keeps its own units.
  const lightFromClouds = cloudAssets != null && pass('cloudLight') && (!night || (moonlit && pass('nightSkylight'))) && !totality && weather.formations.length > 0 && weather.dust == null
  const clearSkylight = lightFromClouds ? measureSkylight(renderer, envTarget) : null
  let cloudSkylight: [number, number, number] | null = null
  if (cloudAssets != null) {
    // Reflections are blurry; they need far fewer frames than the main view.
    const envFrames = Math.max(2, Math.round(cloudFrames / 5))
    renderCloudyEnvironment(
      renderer,
      envScene,
      envTarget,
      camera.position,
      weather,
      textures,
      cloudAssets,
      worldToECEF,
      lightECEF,
      params.visibilityKm,
      cells,
      envFrames
    )
  }
  // What the sky cube gives a level surface: the props' sky light.
  const cubeSkylight = measureSkylight(renderer, envTarget)
  if (clearSkylight != null) {
    // The light the clouds scatter down, on what the clear sky gave.
    cloudSkylight = cloudSkylightRatio(clearSkylight, measureSkylight(renderer, envTarget))
    const [r, g, b] = cloudSkylight
    for (const c of [u.skyIrradiance.value as Color, tu.skyIrradiance.value as Color]) c.setRGB(c.r * r, c.g * g, c.b * b)
    setSprayLighting(props, camera, height, lightDirectionWorld, sunIrradiance, u.skyIrradiance.value as Color)
  }
  // At night props and ground must see the same sky light. The cube holds
  // more than the ground's skyIrradiance: airglow and the Milky Way, and on
  // moonlit nights the moon's (enlarged) disc, whose light the props already
  // get from the directional light. Opened up for a cloudy night, palms lit
  // 1.75–3× the sand around them went bright green (plans/SHADOWS.md phase 6).
  // So dim the cube to the ground's light, and on a starlit night top the
  // props up to it with the ambient light (the night's ~0.002 lux). An
  // aurora's light is in both already: its own ambient light would count it
  // twice (sea ice lit bright blue under one).
  if (night && !totality && pass('nightSkylight')) {
    const lum = (c: ArrayLike<number>): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    const want = lum((u.skyIrradiance.value as Color).toArray())
    const cube = lum(cubeSkylight)
    if (cube > want) scene.environmentIntensity = want / cube
    // The aurora is in both the cube and the ground's light already.
    if (auroraAmbient != null) auroraAmbient.intensity = 0
    starlitLight?.color.copy(u.skyIrradiance.value as Color).multiplyScalar(Math.max(want - Math.min(cube, want), 0) / Math.max(want, 1e-12))
  }

  // The sea and the shore's water films reflect the sky with its lower half
  // folded up (reflection.ts foldedSkyCube; plans/REFLECTION.md phase 6).
  if (pass('skyFold')) {
    const folded = foldedSkyCube(renderer, envTarget.texture, ENV_SIZE)
    gpu.add(folded)
    u.envMap.value = folded.texture
    tu.envMap.value = folded.texture
  }

  {
    // Render the shadow map once with the props and terrain, then let the custom
    // terrain and ocean shaders sample it.
    if (!pass('shadows')) props.traverse(o => (o.castShadow = false))
    const view = params.debug?.shadeView === true
    if (view) for (const material of [ocean.material, terrain.material]) material.defines = { ...material.defines, SHADE_VIEW: 1 }
    shadeCoverage = shadeProps(props, propUniforms, view)
    if (params.debug?.cloudShade != null) {
      for (const uniforms of [ocean.material.uniforms, terrain.material.uniforms, propUniforms]) uniforms.cloudShadeForce.value = params.debug.cloudShade
    }
    // The terrain casts through its caster (a disc round the camera), the sea doesn't.
    ocean.visible = false
    terrain.visible = false
    terrainCaster.visible = hasLand(params.coast) && pass('shadows')
    const scratch = new WebGLRenderTarget(4, 4)
    renderer.setRenderTarget(scratch)
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    scratch.dispose()
    terrainCaster.visible = false
    ocean.visible = true
    terrain.visible = hasLand(params.coast)
    bindShadow(ocean.material.uniforms, sun, fineSun.castShadow ? fineSun : undefined)
    bindShadow(terrain.material.uniforms, sun, fineSun.castShadow ? fineSun : undefined)
    if (fineSun.castShadow) (propUniforms.fineShadowScale.value as Vector3).copy(fineShadowScale(fineSun))
    // Hard fine-slice shadows, for diff.mjs (shadow.ts SOFT_SHADOW_GLSL).
    if (!pass('softShadows')) for (const uniforms of [ocean.material.uniforms, terrain.material.uniforms, propUniforms]) (uniforms.fineShadowScale.value as Vector3).setScalar(0)
    if (clouds != null && pass('cloudShade')) {
      primeCloudShadow(clouds, renderer, composer.inputBuffer)
      for (const uniforms of [ocean.material.uniforms, terrain.material.uniforms, propUniforms]) bindCloudShadow(uniforms, clouds, camera, lightDirectionWorld)
    }
    // Before the reflection: the sea mirrors land and props in their shade.
    renderer.shadowMap.autoUpdate = false
    const land = renderLandShadow(renderer, scene, props, camera, lightDirectionWorld)
    gpu.add(land.target)
    bindLandShadow(ocean.material.uniforms, land)
    bindLandShadow(terrain.material.uniforms, land)
    bindLandShadow(propUniforms, land, true)

    // Mirror image of land and props for the water (sky comes from the cube).
    if (pass('reflection') && (hasLand(params.coast) || scene.getObjectByName('props')!.children.length > 0)) {
      const hide = [
        ocean,
        ...scene.children.filter(o => o.userData.sky === true),
        // Cloud-like props (shelf clouds, roll clouds): the sky cube
        // mirrors clouds. Far land is mirrored and hazed over its path to
        // the water (ocean.ts reflectionHaze); with that off, as before
        // 0.133: everything distant left out, the haze's stand-in.
        ...props.children.filter(o => o.userData.skyLike === true || (!pass('reflectionHaze') && o.userData.distant === true)),
        // Lamps: the sea mirrors them as point lights (ocean.ts).
        ...lampSprites(props)
      ]
      const reflection = renderPlanarReflection(renderer, scene, camera, width, height, hide)
      gpu.add(reflection.target)
      ocean.material.uniforms.planarMap.value = reflection.target.texture
      ocean.material.uniforms.planarMatrix.value.copy(reflection.textureMatrix)
      ocean.material.uniforms.planarDepth.value = reflection.target.depthTexture
      ocean.material.uniforms.planarProjInv.value.copy(reflection.projectionInverse)
      ocean.material.uniforms.planarOn.value = 1
      const extinction = reflectionExtinction(params.visibilityKm, clouds != null)
      ;(ocean.material.uniforms.reflectionAir.value as Vector3).set(...extinction.air)
      ocean.material.uniforms.reflectionSeaHaze.value = extinction.haze
      // Pools and the swash film mirror it too (plans/REFLECTION.md phase 5).
      // Only now: the terrain is drawn into the target, and a target bound
      // while it is drawn into is a feedback loop.
      if (pass('wetMirror') && terrain.visible) {
        const tu = terrain.material.uniforms
        tu.planarMap.value = reflection.target.texture
        ;(tu.planarMatrix.value as Matrix4).copy(reflection.textureMatrix)
        tu.planarDepth.value = reflection.target.depthTexture
        ;(tu.planarProjInv.value as Matrix4).copy(reflection.projectionInverse)
        if (pass('reflectionHaze')) {
          ;(tu.reflectionAir.value as Vector3).set(...extinction.air)
          tu.reflectionSeaHaze.value = extinction.haze
        }
        tu.planarOn.value = 1
      }
    }
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
  // The long exposure (frameMeter.ts): on a night whose frame may be lifted
  // (stars hidden, so a photographer goes long), read the first frame, choose
  // the shutter, and if it's long enough to show, draw again with its look:
  // the sea averaged over the shutter, the clouds moving on frame by frame
  // (a streak along the wind over the averaged frames).
  const longShutter = night && boostRule != null && still != null && accumulate != null && pass('longExposure')
  const wbLum = 0.2126 * whiteBalance.r + 0.7152 * whiteBalance.g + 0.0722 * whiteBalance.b
  const cdPerUnit = 1 / renderPerLux(params.nightSky, elongationDeg(params))
  const shutterOf = (medianExposed: number, boost: number): number => shutterSeconds((medianExposed / (exposure * wbLum)) * cdPerUnit, medianExposed * boost)
  // The lighthouse's lens turns while the shutter is open. The shutter is the
  // sky meter's (the median cancels out of shutterOf) times the frame's boost,
  // which is known only after the first look: until then ×1.
  const sweepBeams = pass('beamSweep') ? (beams[0] ?? null) : null
  sweepBeams?.setShutter(shutterOf(1, 1))
  let look = 0
  let lookShutter = 0
  let restarted = false
  const baseWeather = clouds?.localWeatherOffset.clone()
  const baseShape = clouds?.shapeOffset.clone()
  // Wind at the clouds: ~2× the surface wind (estimate), at least 3 m/s.
  const aloft = Math.max(3, 2 * params.ocean.airWindSpeed)
  const drift =
    clouds != null ? cloudDrift(worldToECEF, windDirection(params), clouds.localWeatherRepeat, clouds.shapeRepeat, 1) : null
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
    const firstLook = longShutter && !restarted && i === 0
    if (look > 0 && clouds != null && drift != null && baseWeather != null && baseShape != null) {
      // Where the clouds are at this point of the shutter, centred on its middle.
      const metres = aloft * lookShutter * look * (frames > 1 ? i / (frames - 1) - 0.5 : 0)
      clouds.localWeatherOffset.copy(baseWeather).addScaledVector(drift.weather, metres)
      clouds.shapeOffset.copy(baseShape).addScaledVector(drift.shape, metres)
    }
    sweepBeams?.setJitter(halton(i + 1, 5))
    finish.enabled = last
    meter.enabled = last || firstLook
    if (probePass != null) probePass.enabled = last
    if (skyDenoise != null) skyDenoise.enabled = last
    composer.render(1 / 60)
    if (firstLook) {
      restarted = true
      lookShutter = shutterOf(meter.medianExposed, meter.boost)
      look = longExposureLook(lookShutter)
      if (look > 0) {
        sweepBeams?.setShutter(lookShutter)
        ocean.material.uniforms.longExposure.value = look
        still!.reset()
        accumulate!.reset()
        i = -1
        continue
      }
    }
    if (!last) {
      const done = gpuIdle(renderer.getContext() as WebGL2RenderingContext)
      if (previousFrame != null) await previousFrame
      previousFrame = done
    }
  }
  camera.clearViewOffset()
  // The shore's water films in numbers (plans/WATER_VIEW.md step 2).
  // And any of the terrain shader's terms asked for (terrainTerms.ts).
  const termScene = { renderer, scene, camera, terrain, props }
  const water = params.debug?.water === true ? countWater(termScene, width, height) : undefined
  const terrainProbe = params.debug?.terrainProbe != null ? probeTerrain(termScene, params.debug.terrainProbe, width, height) : undefined

  const gl = renderer.getContext()
  // What the frame was exposed at in all: the sky's meter, then the frame's.
  const exposed = exposure * meter.boost
  const probeGrade = {
    exposure: exposed,
    whiteBalance: whiteBalance.toArray() as [number, number, number],
    cdPerUnit: 1 / renderPerLux(params.nightSky, elongationDeg(params)),
    darkZenithCd: darkZenithLuminance()
  }
  const probe =
    probePass == null || probes.length === 0
      ? undefined
      : probes.map((at, k) => {
          const box = probeBoxes[k]
          return probeResult(at, box?.pixel ?? null, probePass.results[k] ?? null, box == null ? null : readCanvas(gl, box, height), probeGrade)
        })
  let offset = probes.length
  const probeLine =
    probePass == null || lines.length === 0
      ? undefined
      : lines.map((line, n) => {
          const samples = linePoints[n].flatMap((pt, k) => {
            const box = lineBoxes[n][k]
            if (box == null) return []
            const r = probeResult({ az: pt.az, el: pt.el }, box.pixel, probePass.results[offset + k] ?? null, readCanvas(gl, box, height), probeGrade)
            return r.cdm2 == null ? [] : [{ az: +pt.az.toFixed(3), el: +pt.el.toFixed(3), pixel: r.pixel, cdm2: r.cdm2, final: r.final!.mean }]
          })
          offset += linePoints[n].length
          return { line, samples, stats: samples.length > 0 ? lineStats(samples.map(s => s.cdm2), line.step ?? 0.05) : null }
        })
  // The sky cube in the asked directions, beside the frame's probes.
  const cubeProbe = params.debug?.cubeProbe
  const cubeRead =
    cubeProbe == null
      ? undefined
      : readCube(
          renderer,
          envTarget.texture,
          cubeProbe.map(at => new Vector3(...skyDir(params.camera.headingDeg + at.az, at.el))),
          cubeProbe.map(at => at.lod ?? params.debug?.cubeProbeLod ?? 0)
        ).map((raw, k) => ({ at: cubeProbe[k], raw }))
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
  const debug = {
      gpu: debugInfo != null ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : 'unknown',
      // In all (pin it with params.debug.exposure: diff.mjs --keep-exposure).
      exposure: exposed,
      // The frame's own meter (frameMeter.ts): its exposed median before the
      // boost, and the boost.
      frameMedian: meter.medianExposed,
      // The props' sky light: what the cube gives a level surface, and the
      // starlit top-up (ambient).
      cubeSkylight,
      starlitAmbient: starlitLight?.color.toArray() ?? null,
      frameBoost: meter.boost,
      // The shutter a photographer would have used (s), and how far its look
      // went (0–1; only where the stars are hidden: longShutter).
      shutterSeconds: shutterOf(meter.medianExposed, meter.boost),
      longExposure: look,
      sceneLuminance,
      skyZenith: metered.zenith,
      whiteBalance: whiteBalance.toArray(),
      ...(probe != null ? { probe } : {}),
      ...(probeLine != null ? { probeLine } : {}),
      ...(cubeRead != null ? { cubeProbe: cubeRead } : {}),
      ...(water != null ? { water } : {}),
      ...(terrainProbe != null ? { terrainProbe } : {}),
      nightScale,
      sunIrradiance: sunIrradiance.toArray(),
      skyIrradiance: skyIrradiance.toArray(),
      cloudSkylight,
      shadowCoverage: shadeCoverage,
      fineShadowTexelM: fineTexel,
      // The least sky the ground sees under the crowns (props/skyOcclusion.ts).
      skyOpenLeast: skyOpen?.least ?? 1,
      pitchDeg: camera.rotation.x / DEG,
      // Ground under the camera (diff.mjs --keep-camera).
      cameraGroundM: camera.position.y - params.camera.heightM,
      // World position (m): distances to probed world points (scripts/haze.mjs).
      cameraPosition: camera.position.toArray().map(v => +v.toFixed(2)),
      props: reportProps(props, camera, width, height),
      // CPU time (ms) each prop kind took to build.
      propTimes: Object.fromEntries(Object.entries(props.userData.times as Record<string, number>).map(([k, ms]) => [k, Math.round(ms)])),
      vfovDeg: vfov / DEG
  }

  // Let the last frame finish first: Chrome still queries the programs after
  // the GPU runs it, and a program deleted before then logs 'GL_INVALID_VALUE:
  // glGetProgramiv: Program object expected' once per program (~48 warnings).
  await gpuIdle(gl as WebGL2RenderingContext)

  // The picture is in the canvas: free everything else (knowledge/LEAKS.md).
  gpu.addTree(scene)
  gpu.addTree(envScene)
  gpu.add(composer, envTarget, sun, generator)
  Object.values(textures).forEach(texture => gpu.addTexture(texture))
  if (cloudAssets != null) Object.values(cloudAssets).forEach(texture => gpu.addTexture(texture))
  gpu.dispose()
  scene.clear()
  envScene.clear()
  uploads.stop()
  // Anything else uploaded: shared quads, targets and LUTs the libraries and
  // three itself keep (shadow depth materials, PMREM).
  const swept = uploads.sweep()
  // Then three's own caches (cube maps, render lists, binding states). The
  // context stays, and with it the picture, until dispose() below.
  renderer.dispose()
  const gpuAfterRender = { ...renderer.info.memory, programs: renderer.info.programs?.length ?? 0 }
  return {
    params,
    debug: { ...debug, gpuAfterRender, gpuSwept: swept },
    dispose: () => renderer.forceContextLoss()
  }
}
