import { Pass } from 'postprocessing'
import { FloatType, ShaderMaterial, Uniform, Vector2, WebGLRenderTarget, type Texture, type WebGLRenderer } from 'three'

// Metering the frame itself (plans/SHADOWS.md phase 6). The exposure is set
// from the clear sky (exposure.ts meterScene) before anything is drawn, so a
// frame under a cloud deck at night, or a beach in deep shade, comes out too
// dark to read. A photographer would look at the picture and open up: so,
// after the frames are averaged and before bloom and tone mapping, read the
// median of the exposed frame and, only if it is under a floor, raise it, as a
// longer shutter would. Frames already bright enough are left alone, so
// sunsets keep their mood and bright moonlit nights stay as they are.

/** Readback size: each texel averages a block of the frame (4×4 taps). */
const METER_W = 160
const METER_H = 90

export interface BoostRule {
  /** Exposed median (linear, before tone mapping) the frame is lifted to. */
  floor: number
  /** At most this many stops. */
  maxStops: number
}

/** The median of a list (NaN and infinities left out). */
export function median(values: ArrayLike<number>): number {
  const finite = Array.from(values).filter(Number.isFinite).sort((a, b) => a - b)
  if (finite.length === 0) return 0
  const mid = finite.length >> 1
  return finite.length % 2 === 1 ? finite[mid] : (finite[mid - 1] + finite[mid]) / 2
}

/** How much to open up: floor / median, never below 1 (no darkening), at most
 * 2^maxStops. */
export function frameBoost(medianExposed: number, rule: BoostRule): number {
  const most = 2 ** rule.maxStops
  if (!(medianExposed > 0)) return most
  return Math.min(Math.max(rule.floor / medianExposed, 1), most)
}

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`

/**
 * Reads the frame's median luminance (exposed, linear), sets the boost from
 * `boostFor`, and writes the frame times the boost for the passes after it.
 * Enable it on the last frame only, before bloom and tone mapping.
 */
export class FrameMeterPass extends Pass {
  /** The last reading: exposed median before the boost. */
  medianExposed = 0
  boost = 1
  private readonly small = new WebGLRenderTarget(METER_W, METER_H, { type: FloatType, depthBuffer: false })
  private readonly reduce = new ShaderMaterial({
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform vec2 texel;
      varying vec2 vUv;
      void main() {
        // A 4×4 grid over this texel's block of the frame, in luminance.
        float sum = 0.0;
        for (int j = 0; j < 4; j++) {
          for (int i = 0; i < 4; i++) {
            vec2 at = vUv + (vec2(float(i), float(j)) - 1.5) / 4.0 * texel;
            sum += dot(texture2D(map, at).rgb, vec3(0.2126, 0.7152, 0.0722));
          }
        }
        gl_FragColor = vec4(sum / 16.0, 0.0, 0.0, 1.0);
      }
    `,
    uniforms: { map: new Uniform<Texture | null>(null), texel: new Uniform(new Vector2(1 / METER_W, 1 / METER_H)) },
    depthTest: false,
    depthWrite: false
  })
  private readonly scale = new ShaderMaterial({
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform float boost;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(map, vUv);
        gl_FragColor = vec4(c.rgb * boost, c.a);
      }
    `,
    uniforms: { map: new Uniform<Texture | null>(null), boost: new Uniform(1) },
    depthTest: false,
    depthWrite: false
  })
  private readonly pixels = new Float32Array(METER_W * METER_H * 4)

  constructor(private readonly boostFor: (medianExposed: number) => number) {
    super('FrameMeterPass')
    this.needsSwap = true
  }

  override render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget, outputBuffer: WebGLRenderTarget | null): void {
    this.reduce.uniforms.map.value = inputBuffer.texture
    this.fullscreenMaterial = this.reduce
    renderer.setRenderTarget(this.small)
    renderer.render(this.scene, this.camera)
    renderer.readRenderTargetPixels(this.small, 0, 0, METER_W, METER_H, this.pixels)
    const lum = new Float32Array(METER_W * METER_H)
    for (let i = 0; i < lum.length; i++) lum[i] = this.pixels[i * 4]
    this.medianExposed = median(lum)
    this.boost = this.boostFor(this.medianExposed)

    this.scale.uniforms.map.value = inputBuffer.texture
    this.scale.uniforms.boost.value = this.boost
    this.fullscreenMaterial = this.scale
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
    renderer.render(this.scene, this.camera)
  }

  override dispose(): void {
    super.dispose()
    this.small.dispose()
    this.reduce.dispose()
    this.scale.dispose()
  }
}

/** What frameBoostRule reads of the day. */
export interface FrameMeterDay {
  timeOfDay: string
  weather: { kind: string }
  storm: unknown
}

/** Times of day with the sun up. */
const SUN_UP = new Set(['daylight', 'midday', 'golden-hour', 'sun-on-horizon'])

/**
 * The floor and the most a frame may be lifted, from medians measured over
 * every night and 60 days (plans/SHADOWS.md phase 6), null where the frame
 * is left alone:
 * - A night under broken or overcast cloud: the stars are hidden, so a
 *   photographer goes long. Floor 0.03, ~×8 on a typical one (median
 *   0.0035 exposed), the level decided on 2026-11-06; up to 6 stops.
 * - Open nights: stars and the moon's glitter carry the frame although its
 *   median is as low (0.008); a photographer keeps the shutter short so the
 *   stars stay points. Left as they are.
 * - Sun up, no storm: a beach in deep shade under cloud (median 0.04) lifts
 *   to 0.10, at most 1.5 stops. About 1 day in 60.
 * - Blue hour and storms stay dark: that is their look.
 */
export function frameBoostRule(day: FrameMeterDay): BoostRule | null {
  if (day.timeOfDay === 'night') return day.weather.kind === 'broken' || day.weather.kind === 'overcast' ? { floor: 0.03, maxStops: 6 } : null
  if (SUN_UP.has(day.timeOfDay) && day.storm == null) return { floor: 0.1, maxStops: 1.5 }
  return null
}

/** A reflected-light meter at f/2.8, ISO 1600: the shutter (s) that puts a
 * scene of luminance L (cd/m²) at mid-grey is ~0.061 / L (N²/t = L·S/12.5,
 * plans/SHADOWS.md phase 6; exposure tables disagree, so rough). */
const SHUTTER_PER_INV_CD = 0.061
/** Mid-grey, exposed (linear, before tone mapping). */
const MID_GREY = 0.18

/**
 * The shutter a photographer would have used for this frame: metered for its
 * median luminance (cd/m²), then lengthened or shortened to land the median
 * where the frame shows it (`finalExposed`, after the boost).
 */
export function shutterSeconds(medianCdM2: number, finalExposed: number): number {
  if (!(medianCdM2 > 0)) return 0
  return (SHUTTER_PER_INV_CD / medianCdM2) * (finalExposed / MID_GREY)
}

/**
 * How far the long-exposure look goes (0–1): nothing under half a second,
 * full past 30 s (water glassy, foam a haze, clouds streaked along the wind).
 * Log-spaced, as shutter speeds are.
 */
export function longExposureLook(seconds: number): number {
  if (!(seconds > 0.5)) return 0
  return Math.min(1, Math.log(seconds / 0.5) / Math.log(60))
}
