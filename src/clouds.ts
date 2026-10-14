import { AerialPerspectiveEffect, type PrecomputedTextures } from '@takram/three-atmosphere'
import {
  CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
  CLOUD_SHAPE_TEXTURE_SIZE,
  CloudLayers,
  CloudsEffect
} from '@takram/three-clouds'
import { DataTextureLoader, parseUint8Array, STBNLoader } from '@takram/three-geospatial'
import { EffectComposer, EffectPass, RenderPass } from 'postprocessing'
import {
  CubeCamera,
  Data3DTexture,
  HalfFloatType,
  LinearFilter,
  LinearMipMapLinearFilter,
  Mesh,
  NoColorSpace,
  OrthographicCamera,
  PlaneGeometry,
  RedFormat,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  TextureLoader,
  Vector2,
  type Camera,
  type Matrix4,
  type PerspectiveCamera,
  type Texture,
  type Vector3,
  type WebGLCubeRenderTarget,
  type WebGLRenderer
} from 'three'

import { AccumulatePass } from './accumulate'
import { CLOUD_GENERA } from './cloudTypes'
import type { WeatherParams } from './params'

// Volumetric clouds (takram three-clouds). Assets are self-hosted in
// public/assets so the site has no runtime dependency on other servers.

export interface CloudAssets {
  localWeather: Texture
  shape: Data3DTexture
  shapeDetail: Data3DTexture
  turbulence: Texture
  stbn: Data3DTexture
}

const asset = (name: string): string => `${import.meta.env.BASE_URL}assets/${name}`

function repeat3D(texture: Data3DTexture): Data3DTexture {
  texture.format = RedFormat
  texture.minFilter = LinearFilter
  texture.magFilter = LinearFilter
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.wrapR = RepeatWrapping
  texture.colorSpace = NoColorSpace
  texture.needsUpdate = true
  return texture
}

function repeat2D(texture: Texture, mipmaps: boolean): Texture {
  texture.minFilter = mipmaps ? LinearMipMapLinearFilter : LinearFilter
  texture.magFilter = LinearFilter
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.colorSpace = NoColorSpace
  texture.needsUpdate = true
  return texture
}

let assets: Promise<CloudAssets> | null = null

export function loadCloudAssets(): Promise<CloudAssets> {
  assets ??= (async () => {
    const shapeLoader = new DataTextureLoader(Data3DTexture, parseUint8Array, {
      width: CLOUD_SHAPE_TEXTURE_SIZE,
      height: CLOUD_SHAPE_TEXTURE_SIZE,
      depth: CLOUD_SHAPE_TEXTURE_SIZE
    })
    const detailLoader = new DataTextureLoader(Data3DTexture, parseUint8Array, {
      width: CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
      height: CLOUD_SHAPE_DETAIL_TEXTURE_SIZE,
      depth: CLOUD_SHAPE_DETAIL_TEXTURE_SIZE
    })
    const [localWeather, shape, shapeDetail, turbulence, stbn] = await Promise.all([
      new TextureLoader().loadAsync(asset('local_weather.png')),
      shapeLoader.loadAsync(asset('shape.bin')),
      detailLoader.loadAsync(asset('shape_detail.bin')),
      new TextureLoader().loadAsync(asset('turbulence.png')),
      new STBNLoader().loadAsync(asset('stbn.bin'))
    ])
    return {
      localWeather: repeat2D(localWeather, true),
      shape: repeat3D(shape),
      shapeDetail: repeat3D(shapeDetail),
      turbulence: repeat2D(turbulence, false),
      stbn
    }
  })()
  return assets
}

export function createClouds(
  camera: Camera,
  weather: WeatherParams,
  textures: PrecomputedTextures,
  cloudAssets: CloudAssets,
  worldToECEF: Matrix4,
  lightECEF: Vector3
): CloudsEffect {
  const clouds = new CloudsEffect(camera)
  Object.assign(clouds, textures)
  clouds.localWeatherTexture = cloudAssets.localWeather
  clouds.shapeTexture = cloudAssets.shape
  clouds.shapeDetailTexture = cloudAssets.shapeDetail
  clouds.turbulenceTexture = cloudAssets.turbulence
  clouds.stbnTexture = cloudAssets.stbn
  clouds.worldToECEFMatrix.copy(worldToECEF)
  clouds.sunDirection.copy(lightECEF)
  clouds.qualityPreset = 'high'
  clouds.coverage = weather.coverage
  clouds.localWeatherOffset.set(...weather.weatherOffset)
  clouds.shapeOffset.set(...weather.shapeOffset)

  // One layer per cloud genus in today's sky; each étage reads its own
  // channel of the weather map so the layers don't line up.
  const channels = { low: 'r', middle: 'g', high: 'b' } as const
  const layers = new CloudLayers(
    weather.formations.map(genus => {
      const spec = CLOUD_GENERA[genus]
      const [expTerm, exponent, linearTerm, constantTerm] = spec.densityProfile
      return {
        channel: channels[spec.etage],
        altitude: spec.altitude,
        height: spec.height,
        densityScale: spec.densityScale,
        shapeAmount: spec.shapeAmount,
        shapeDetailAmount: spec.shapeDetailAmount,
        weatherExponent: spec.weatherExponent,
        shapeAlteringBias: spec.shapeAlteringBias,
        coverageFilterWidth: spec.coverageFilterWidth,
        densityProfile: { expTerm, exponent, linearTerm, constantTerm },
        // Only the lower, thicker layers cast noticeable shadows.
        shadow: spec.etage !== 'high'
      }
    })
  )
  clouds.cloudLayers.copy(layers)
  const cellScale = weather.formations.length > 0 ? (CLOUD_GENERA[weather.formations[0]].cellScale ?? 1) : 1
  clouds.localWeatherRepeat.multiplyScalar(cellScale)
  clouds.shapeRepeat.multiplyScalar(cellScale)
  return clouds
}

/**
 * Re-render the sky environment cube with clouds, so water and wet sand
 * reflect them. Each face goes through a small sky → clouds → aerial
 * perspective → accumulate pipeline and is then copied into the cube.
 */
export function renderCloudyEnvironment(
  renderer: WebGLRenderer,
  skyScene: Scene,
  target: WebGLCubeRenderTarget,
  position: Vector3,
  weather: WeatherParams,
  textures: PrecomputedTextures,
  cloudAssets: CloudAssets,
  worldToECEF: Matrix4,
  lightECEF: Vector3,
  frames = 12
): void {
  const size = target.width
  // EffectComposer.setSize also resizes the renderer; restore it afterwards.
  const rendererSize = renderer.getSize(new Vector2())
  const cubeCamera = new CubeCamera(0.5, 400_000, target)
  cubeCamera.position.copy(position)
  cubeCamera.coordinateSystem = renderer.coordinateSystem
  cubeCamera.updateCoordinateSystem()
  cubeCamera.updateMatrixWorld()

  const copy = new Mesh(
    new PlaneGeometry(2, 2),
    new ShaderMaterial({
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = position.xy * 0.5 + 0.5;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D map;
        varying vec2 vUv;
        void main() { gl_FragColor = texture2D(map, vUv); }`,
      uniforms: { map: { value: null as Texture | null } },
      depthTest: false,
      depthWrite: false
    })
  )
  copy.frustumCulled = false
  const copyScene = new Scene().add(copy)
  const copyCamera = new OrthographicCamera()

  const generateMipmaps = target.texture.generateMipmaps
  const faces = cubeCamera.children as PerspectiveCamera[]
  faces.forEach((faceCamera, face) => {
    const aerialPerspective = new AerialPerspectiveEffect(faceCamera)
    Object.assign(aerialPerspective, textures)
    aerialPerspective.worldToECEFMatrix.copy(worldToECEF)
    aerialPerspective.sunDirection.copy(lightECEF)
    const clouds = createClouds(faceCamera, weather, textures, cloudAssets, worldToECEF, lightECEF)
    clouds.qualityPreset = 'medium'
    clouds.temporalUpscale = false
    clouds.events.addEventListener('change', event => {
      if (event.property === 'atmosphereOverlay') aerialPerspective.overlay = clouds.atmosphereOverlay
      if (event.property === 'atmosphereShadow') aerialPerspective.shadow = clouds.atmosphereShadow
      if (event.property === 'atmosphereShadowLength')
        aerialPerspective.shadowLength = clouds.atmosphereShadowLength
    })
    const accumulate = new AccumulatePass()
    const composer = new EffectComposer(renderer, { frameBufferType: HalfFloatType })
    composer.autoRenderToScreen = false
    composer.addPass(new RenderPass(skyScene, faceCamera))
    composer.addPass(new EffectPass(faceCamera, clouds, aerialPerspective))
    composer.addPass(accumulate)
    composer.setSize(size, size, false)
    for (let i = 0; i < frames; i++) composer.render(1 / 60)

    copy.material.uniforms.map.value = accumulate.texture
    target.texture.generateMipmaps = face === 5 && generateMipmaps
    renderer.setRenderTarget(target, face)
    renderer.render(copyScene, copyCamera)
    composer.dispose()
  })
  target.texture.generateMipmaps = generateMipmaps
  renderer.setRenderTarget(null)
  renderer.setSize(rendererSize.x, rendererSize.y, false)
}
