import {
  AdditiveBlending,
  DataTexture,
  RGBAFormat,
  Sprite,
  SpriteMaterial,
  UnsignedByteType,
  Vector3,
  type Object3D,
  type PerspectiveCamera
} from 'three'

import type { SceneParams } from '../params'
import type { ShipKind } from '../sceneSpec'
import type { HullSize } from './ships'

// Navigation lights (COLREGs Rules 21–26, Annex I), shown from sunset to
// sunrise. A power-driven vessel underway: white masthead light over 225°
// ahead (a second, higher one aft from 50 m), red port / green starboard
// sidelights over 112.5° each, white stern light over the 135° behind.
// Sailing vessels: sidelights and stern light, under 20 m as a tricolour at
// the masthead. At anchor: all-round white (two from 50 m). Trawling: green
// over white all-round; fishing boats also work under deck floodlights.
// Intensities are Annex I §8's minimum for the required range (I =
// 3.43e6·T·D²·K^-D, T = 2e-7 lx, K = 0.8): 1 nm 0.9 cd, 2 nm 4.3, 3 nm 12,
// 5 nm 52, 6 nm 94. Ships' accommodation windows and deck lights add a few
// warm lamps. A lamp is a point: its sprite carries intensity / area, so the
// light reaching the camera is right whatever the sprite's size; the sea
// mirrors the brightest as point lights (ocean.ts shipLamps).

type RGB = [number, number, number]

export const WHITE: RGB = [1, 0.93, 0.82]
export const RED: RGB = [1, 0.06, 0.03]
export const GREEN: RGB = [0.08, 1, 0.55]
const WARM: RGB = [1, 0.72, 0.42]

/** Annex I §8: luminous intensity (cd) for a visible range in nautical miles. */
export const RANGE_CD: Record<number, number> = { 1: 0.9, 2: 4.3, 3: 12, 5: 52, 6: 94 }

export interface ShipLight {
  /** Ship frame: bow +x, up +y, starboard +z (m). */
  position: [number, number, number]
  color: RGB
  intensity: number
  /** Arc it shows over, degrees from the bow toward starboard; null = all round. */
  sector: [number, number] | null
}

const MASTHEAD: [number, number] = [-112.5, 112.5]
const STARBOARD: [number, number] = [0, 112.5]
const PORT: [number, number] = [-112.5, 0]
const STERN: [number, number] = [112.5, 247.5]

/** Lights are on from sunset to sunrise. */
export function lightsOn(params: Pick<SceneParams, 'timeOfDay'>): boolean {
  return params.timeOfDay === 'night' || params.timeOfDay === 'blue-hour' || params.timeOfDay === 'sun-on-horizon'
}

/**
 * The lights a vessel shows. `top` is its highest point (the masthead, in
 * the ship frame); `speed` through the water (m/s), 0 = lying still.
 */
export function shipLightsFor(kind: ShipKind, size: HullSize, top: Vector3, speed: number, sailing: boolean): ShipLight[] {
  const L = size.length
  const halfBeam = size.beam / 2 + size.spacing
  const deck = size.freeboard
  const big = L >= 50
  const masthead = RANGE_CD[big ? 6 : L >= 20 ? 5 : L >= 12 ? 3 : 2]
  const side = RANGE_CD[big ? 3 : L >= 12 ? 2 : 1]
  const stern = RANGE_CD[big ? 3 : 2]
  const allRound = RANGE_CD[big ? 3 : 2]
  const at = (x: number, y: number, z: number): [number, number, number] => [x, y, z]
  const lights: ShipLight[] = []
  const mastTop = at(top.x, top.y + 0.3, top.z)

  if (sailing) {
    if (L < 20) {
      // Tricolour at the masthead.
      lights.push(
        { position: mastTop, color: GREEN, intensity: side, sector: STARBOARD },
        { position: mastTop, color: RED, intensity: side, sector: PORT },
        { position: mastTop, color: WHITE, intensity: stern, sector: STERN }
      )
    } else {
      lights.push(
        { position: at(L * 0.35, deck + 0.5, halfBeam), color: GREEN, intensity: side, sector: STARBOARD },
        { position: at(L * 0.35, deck + 0.5, -halfBeam), color: RED, intensity: side, sector: PORT },
        { position: at(-L / 2, deck + 0.5, 0), color: WHITE, intensity: stern, sector: STERN }
      )
    }
    return lights
  }

  // Small open boats (under 7 m) may show one all-round white.
  if (kind === 'dinghy') return [{ position: at(-L * 0.4, deck + 1.2, 0), color: WHITE, intensity: RANGE_CD[2], sector: null }]

  const working = big ? 4 : kind === 'trawler' ? 2 : 0
  const decks: ShipLight[] = Array.from({ length: working }, (_, i) => ({
    position: at(top.x - L * 0.05 + (i % 2) * L * 0.1, deck + (top.y - deck) * (0.45 + 0.1 * i), (i % 2 ? 1 : -1) * halfBeam * 0.5),
    color: WARM,
    intensity: big ? 60 : 30,
    sector: null
  }))

  if (speed === 0) {
    // At anchor: all-round white forward (and a lower one aft from 50 m);
    // big ships light their decks (Rule 30c).
    lights.push({ position: at(L * 0.45, deck + (big ? 8 : 2), 0), color: WHITE, intensity: allRound, sector: null })
    if (big) {
      lights.push({ position: at(-L * 0.48, deck + 4, 0), color: WHITE, intensity: allRound, sector: null })
      for (let i = 0; i < 4; i++)
        lights.push({ position: at(L * (0.3 - i * 0.2), deck + 6, 0), color: WARM, intensity: 400, sector: null })
    }
    return [...lights, ...decks]
  }

  const trawling = kind === 'trawler' && speed < 4.5 * 0.5144
  if (trawling) {
    // Green over white all-round, the white below, and her work lights.
    lights.push(
      { position: mastTop, color: GREEN, intensity: allRound, sector: null },
      { position: at(top.x, top.y - 1.5, top.z), color: WHITE, intensity: allRound, sector: null },
      { position: at(top.x, deck + 2.5, 0), color: WARM, intensity: 800, sector: null }
    )
  } else if (big) {
    // Forward masthead light lower, aft one on the bridge mast.
    lights.push(
      { position: at(L * 0.3, Math.max(deck + 6, top.y - 6), 0), color: WHITE, intensity: masthead, sector: MASTHEAD },
      { position: mastTop, color: WHITE, intensity: masthead, sector: MASTHEAD }
    )
  } else {
    lights.push({ position: mastTop, color: WHITE, intensity: masthead, sector: MASTHEAD })
  }
  // Sidelights on the bridge wings (ships) or the cabin sides, stern light aft.
  const sideX = big ? top.x : L * 0.15
  const sideY = big ? deck + (top.y - deck) * 0.6 : deck + 0.6
  lights.push(
    { position: at(sideX, sideY, halfBeam), color: GREEN, intensity: side, sector: STARBOARD },
    { position: at(sideX, sideY, -halfBeam), color: RED, intensity: side, sector: PORT },
    { position: at(-L / 2, deck + (big ? 2 : 0.5), 0), color: WHITE, intensity: stern, sector: STERN }
  )
  return [...lights, ...decks]
}

/** Does a light show toward a bearing (degrees from the bow toward starboard)? */
export function shows(light: ShipLight, bearingDeg: number): boolean {
  if (light.sector == null) return true
  const [from, to] = light.sector
  const b = ((((bearingDeg - from) % 360) + 360) % 360) + from
  return b <= to
}

/**
 * The sky's real luminance (cd/m²) for the time of day the lamps are lit:
 * what the metered scene luminance stands for, so a lamp's intensity can be
 * put in the scene's units. Civil twilight ~10 cd/m² at the sun 4° down, ~1
 * at 7°; a clear moonless night ~2e-4, full moonlight ~0.03.
 */
export function skyLuminance(params: Pick<SceneParams, 'timeOfDay' | 'sunElevationDeg' | 'moonIllumination' | 'moonElevationDeg'>): number {
  if (params.timeOfDay === 'sun-on-horizon') return 300
  if (params.timeOfDay === 'blue-hour') return 10 * 10 ** (Math.max(-3, Math.min(0, (params.sunElevationDeg + 4) / 3)))
  const moonUp = Math.max(0, Math.sin((params.moonElevationDeg * Math.PI) / 180))
  return 2e-4 + 0.03 * params.moonIllumination * Math.min(1, moonUp * 2)
}

let lampTexture: DataTexture | null = null
/** A soft round dot; its mean over the square. */
const LAMP_MEAN = (() => {
  let sum = 0
  const n = 16
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) sum += Math.exp(-((x + 0.5 - n / 2) ** 2 + (y + 0.5 - n / 2) ** 2) / 8)
  return sum / (n * n)
})()

function texture(): DataTexture {
  if (lampTexture != null) return lampTexture
  const n = 16
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const v = Math.round(255 * Math.exp(-((x + 0.5 - n / 2) ** 2 + (y + 0.5 - n / 2) ** 2) / 8))
      data.set([v, v, v, 255], (y * n + x) * 4)
    }
  lampTexture = new DataTexture(data, n, n, RGBAFormat, UnsignedByteType)
  lampTexture.needsUpdate = true
  return lampTexture
}

export interface Lamp {
  color: RGB
  /** Luminous intensity toward the camera (cd). */
  intensity: number
  /** The sprite's area (m²) times its texture's mean. */
  area: number
}

/** One lamp as a sprite in the ship's frame, at least ~2.5 px across at
 * 1080 lines (smaller, it would flicker in and out between pixels). */
export function lampSprite(light: ShipLight, distance: number, camera: PerspectiveCamera): Sprite {
  const pixel = (2 * Math.tan((camera.fov * Math.PI) / 360)) / 1080
  const size = Math.max(0.4, 2.5 * pixel * distance)
  const sprite = new Sprite(
    new SpriteMaterial({ map: texture(), blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false, toneMapped: false })
  )
  sprite.position.set(...light.position)
  sprite.scale.setScalar(size)
  sprite.frustumCulled = false
  const lamp: Lamp = { color: light.color, intensity: light.intensity, area: size * size * LAMP_MEAN }
  sprite.userData.lamp = lamp
  return sprite
}

/** Put the lamps in the scene's units once the meter has run: `perCdM2` is
 * scene radiance per cd/m² (metered luminance / skyLuminance). */
export function setLampBrightness(root: Object3D, perCdM2: number): void {
  root.traverse(o => {
    const lamp = o.userData.lamp as Lamp | undefined
    if (lamp == null) return
    const radiance = (lamp.intensity / lamp.area) * perCdM2
    ;((o as Sprite).material as SpriteMaterial).color.setRGB(...lamp.color).multiplyScalar(radiance)
  })
}

/** The lamps as point lights for the sea: world position and intensity×colour
 * (cd), brightest at the camera first. */
export function lampsForOcean(root: Object3D, camera: Vector3, max: number): { position: Vector3; intensity: Vector3 }[] {
  const lamps: { position: Vector3; intensity: Vector3; seen: number }[] = []
  root.updateMatrixWorld(true)
  root.traverse(o => {
    const lamp = o.userData.lamp as Lamp | undefined
    if (lamp == null) return
    const position = o.getWorldPosition(new Vector3())
    lamps.push({ position, intensity: new Vector3(...lamp.color).multiplyScalar(lamp.intensity), seen: lamp.intensity / position.distanceToSquared(camera) })
  })
  return lamps.sort((a, b) => b.seen - a.seen).slice(0, max)
}

/** Every lamp sprite under `root` (hidden from the sea's mirror pass). */
export function lampSprites(root: Object3D): Object3D[] {
  const sprites: Object3D[] = []
  root.traverse(o => {
    if (o.userData.lamp != null) sprites.push(o)
  })
  return sprites
}
