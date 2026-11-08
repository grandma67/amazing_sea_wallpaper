import { Pass } from 'postprocessing'
import { DataUtils, FloatType, HalfFloatType, type WebGLRenderer, type WebGLRenderTarget } from 'three'

import type { ProbeAt } from './debug'

// The pixel probe (`params.debug.probe`, knowledge/tools/DEBUG.md): what the
// render really holds at a few pixels or sky directions, in three stages:
// - raw: the scene's radiance before exposure and white balance (render
//   units; also cd/m² and, at night, mag/arcsec²);
// - exposed: after exposure and white balance, before bloom and tone
//   mapping (1 ≈ a mid-bright sky; the grade clamps at 40);
// - final: the 8-bit colour on the canvas.
// For "how bright is X against the sky behind it" without guessing from a
// JPEG. Each probe reads a small box: mean and peak (a star or a planet is
// a peak, a sky a mean).

export type { ProbeAt }

export interface ProbeBox {
  /** Pixel centre (x right, y down from the top-left). */
  pixel: [number, number]
  half: number
}

/** Mean and peak (by luminance) of a box of RGB values. */
export interface Stat {
  mean: [number, number, number]
  peak: [number, number, number]
}

const LUMA = [0.2126, 0.7152, 0.0722]
const luma = (c: number[]): number => c[0] * LUMA[0] + c[1] * LUMA[1] + c[2] * LUMA[2]

/** Mean and peak of RGBA values read row by row. */
export function stat(values: ArrayLike<number>): Stat {
  const n = values.length / 4
  const mean: [number, number, number] = [0, 0, 0]
  let peak: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < n; i++) {
    const c: [number, number, number] = [values[i * 4], values[i * 4 + 1], values[i * 4 + 2]]
    for (let k = 0; k < 3; k++) mean[k] += c[k] / n
    if (luma(c) > luma(peak)) peak = c
  }
  return { mean, peak }
}

/** Reads the boxes from the exposed HDR image on the last frame (put it
 * just before the final bloom/tone-mapping pass). */
export class ProbePass extends Pass {
  readonly results: (Stat | null)[] = []
  constructor(
    private readonly boxes: (ProbeBox | null)[],
    private readonly height: number
  ) {
    super('ProbePass')
    this.needsSwap = false
  }

  override render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget): void {
    this.results.length = 0
    for (const box of this.boxes) this.results.push(box == null ? null : readBox(renderer, inputBuffer, box, this.height))
  }
}

function readBox(renderer: WebGLRenderer, target: WebGLRenderTarget, box: ProbeBox, height: number): Stat {
  const size = 2 * box.half + 1
  const x0 = Math.round(box.pixel[0]) - box.half
  // WebGL rows run bottom-up.
  const y0 = height - 1 - Math.round(box.pixel[1]) - box.half
  const type = target.texture.type
  if (type === HalfFloatType) {
    const raw = new Uint16Array(size * size * 4)
    renderer.readRenderTargetPixels(target, x0, y0, size, size, raw)
    return stat(Array.from(raw, v => DataUtils.fromHalfFloat(v)))
  }
  if (type !== FloatType) throw new Error('ProbePass: the frame buffer is neither half float nor float')
  const values = new Float32Array(size * size * 4)
  renderer.readRenderTargetPixels(target, x0, y0, size, size, values)
  return stat(values)
}

/** The final 8-bit colour of the boxes on the canvas (preserveDrawingBuffer). */
export function readCanvas(gl: WebGL2RenderingContext | WebGLRenderingContext, box: ProbeBox, height: number): Stat {
  const size = 2 * box.half + 1
  const values = new Uint8Array(size * size * 4)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.readPixels(Math.round(box.pixel[0]) - box.half, height - 1 - Math.round(box.pixel[1]) - box.half, size, size, gl.RGBA, gl.UNSIGNED_BYTE, values)
  return stat(values)
}

/** What a probe reports in `debug.probe`. */
export interface ProbeResult {
  at: ProbeAt
  /** null: out of frame. */
  pixel: [number, number] | null
  raw?: Stat
  /** Luminance of the raw mean (cd/m²) and as a surface brightness. */
  cdm2?: number
  magArcsec2?: number
  exposed?: Stat
  final?: Stat
  /** The exposed peak reached the grade's clamp (40): raw is a floor. */
  clipped?: boolean
}

/** Combine the exposed reading, the canvas and the frame's grade. */
export function probeResult(
  at: ProbeAt,
  pixel: [number, number] | null,
  exposed: Stat | null,
  final: Stat | null,
  grade: { exposure: number; whiteBalance: [number, number, number]; cdPerUnit: number; darkZenithCd: number }
): ProbeResult {
  if (pixel == null || exposed == null || final == null) return { at, pixel: null }
  const unexpose = (c: [number, number, number]): [number, number, number] => [0, 1, 2].map(k => c[k] / (grade.exposure * grade.whiteBalance[k])) as [number, number, number]
  const raw = { mean: unexpose(exposed.mean), peak: unexpose(exposed.peak) }
  const cdm2 = luma(raw.mean) * grade.cdPerUnit
  const round = (s: Stat, d: number): Stat => ({
    mean: s.mean.map(v => +v.toPrecision(d)) as [number, number, number],
    peak: s.peak.map(v => +v.toPrecision(d)) as [number, number, number]
  })
  return {
    at,
    pixel: [Math.round(pixel[0]), Math.round(pixel[1])],
    raw: round(raw, 4),
    cdm2: +cdm2.toPrecision(4),
    magArcsec2: cdm2 > 0 ? +(21.6 - 2.5 * Math.log10(cdm2 / grade.darkZenithCd)).toFixed(2) : undefined,
    exposed: round(exposed, 4),
    final: { mean: final.mean.map(Math.round) as [number, number, number], peak: final.peak.map(Math.round) as [number, number, number] },
    clipped: Math.max(...exposed.peak) >= 39.9
  }
}
