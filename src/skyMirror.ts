import type { SceneParams } from './params'
import { dirFromAzEl, type Vec3 } from './skyFrame'

// Tools for the CPU mirrors of sky-shader features (aurora.ts `auroraRay`,
// nightGlow.ts `nightGlowS10`): lines of sky directions, the air's
// transmittance as takram draws it, and `lineStats`, which tells bands
// (a period) from grain, stars and smooth structure. The render's line
// probe (`params.debug.probeLine`, probe.ts) reports the same stats on real
// pixels, so a mirror and a render compare number for number.
// `params.mjs --line` runs a mirror line on any spec (tools/PARAMS.md).

const DEG = Math.PI / 180
/** takram's ATMOSPHERE.bottom_radius (km). */
const EARTH_KM = 6360

/** A line of sky directions: `az` from the view (deg, + right, as the
 * probe's), `el` above the horizon (deg); one of them a [from, to] range,
 * sampled every `step` deg (default 0.05, about a 1080p pixel at 20 mm). */
export interface SkyLine {
  az: number | [number, number]
  el: number | [number, number]
  step?: number
}

export interface LinePoint {
  /** View-relative azimuth and elevation (deg). */
  az: number
  el: number
  /** World direction. */
  dir: Vec3
}

/** The directions along a line, for a camera heading. */
export function lineDirections(p: Pick<SceneParams, 'camera'>, line: SkyLine): LinePoint[] {
  const step = line.step ?? 0.05
  const range = (v: number | [number, number]): number[] => {
    if (typeof v === 'number') return [v]
    const n = Math.max(1, Math.round(Math.abs(v[1] - v[0]) / step))
    return Array.from({ length: n + 1 }, (_, i) => v[0] + ((v[1] - v[0]) * i) / n)
  }
  const azs = range(line.az)
  const els = range(line.el)
  if (azs.length > 1 && els.length > 1) throw new Error('lineDirections: give a range for az or el, not both')
  if (azs.length * els.length > 2000) throw new Error('lineDirections: more than 2000 samples; raise step')
  return azs.flatMap(az => els.map(el => ({ az, el, dir: dirFromAzEl(p.camera.headingDeg + az, el) })))
}

export interface LineStats {
  n: number
  stepDeg: number
  mean: number
  min: number
  max: number
  /** Repeating structure finer than `windowDeg`: its period (deg) and how
   * regular it is (autocorrelation, 0–1); null when there is none. */
  periodDeg: number | null
  periodCorr: number
  /** RMS of the detrended line, relative to the trend (0.01 = ±1%). */
  ripple: number
  /** Samples far above the trend (stars, planets): left out of the above. */
  spikes: number
  /** One line for a terminal. */
  summary: string
}

const median = (v: number[]): number => {
  const s = [...v].sort((a, b) => a - b)
  return s.length % 2 ? s[(s.length - 1) / 2] : 0.5 * (s[s.length / 2 - 1] + s[s.length / 2])
}

/**
 * Bands or grain? The line's values (any brightness unit) minus a running
 * median `windowDeg` wide: structure wider than that (an arc, the horizon's
 * glow) is trend, not ripple. Stars and planets (far above the trend) are
 * counted and left out. A period is reported when the residual's
 * autocorrelation has a clear peak (> 0.3) after it first falls below zero
 * and the residual crosses zero about twice per period: stripes repeat,
 * grain and the leftovers of an arc's edge don't.
 */
export function lineStats(values: number[], stepDeg: number, windowDeg = 2): LineStats {
  const n = values.length
  const half = Math.max(2, Math.round(windowDeg / stepDeg / 2))
  const trend = values.map((_, i) => median(values.slice(Math.max(0, i - half), Math.min(n, i + half + 1))))
  let r = values.map((v, i) => (trend[i] > 0 ? (v - trend[i]) / trend[i] : 0))
  const mad = median(r.map(Math.abs)) * 1.4826
  const spikeAt = Math.max(6 * mad, 0.05)
  let spikes = 0
  r = r.map(x => {
    if (x > spikeAt) {
      spikes++
      return 0
    }
    return x
  })
  // Leave out the half-window at each end (the median is one-sided there).
  const core = n > 4 * half ? r.slice(half, n - half) : r
  const m = core.reduce((s, x) => s + x, 0) / Math.max(1, core.length)
  const c = core.map(x => x - m)
  const energy = c.reduce((s, x) => s + x * x, 0)
  const ripple = Math.sqrt(energy / Math.max(1, c.length))
  let periodDeg: number | null = null
  let periodCorr = 0
  if (energy > 0 && c.length > 12) {
    const corr = (k: number): number => {
      let s = 0
      for (let i = 0; i + k < c.length; i++) s += c[i] * c[i + k]
      return s / energy
    }
    let k = 1
    while (k < c.length / 3 && corr(k) > 0) k++
    let best = 0
    let bestK = 0
    for (; k < c.length / 3; k++) {
      const v = corr(k)
      if (v > best) [best, bestK] = [v, k]
      else if (best > 0 && v < best - 0.2) break
    }
    // A real band repeats: its residual crosses zero about twice per period
    // (an arc's or an edge's leftover after the median crosses a few times).
    let crossings = 0
    let sign = 0
    for (const x of c) {
      if (Math.abs(x) < 0.2 * ripple) continue
      if (sign !== 0 && Math.sign(x) !== sign) crossings++
      sign = Math.sign(x)
    }
    const expected = bestK > 0 ? (2 * c.length) / bestK : 0
    if (best > 0.3 && crossings >= Math.max(6, 0.5 * expected)) [periodDeg, periodCorr] = [bestK * stepDeg, best]
  }
  const mean = values.reduce((s, x) => s + x, 0) / Math.max(1, n)
  const pct = (x: number): string => `${(100 * x).toFixed(x < 0.01 ? 2 : 1)}%`
  const summary =
    (periodDeg != null ? `bands every ${periodDeg.toFixed(2)}° (corr ${periodCorr.toFixed(2)}), ±${pct(ripple)}` : `no bands, ±${pct(ripple)} ripple`) +
    `; mean ${mean.toExponential(2)}, ${Math.min(...values).toExponential(2)}–${Math.max(...values).toExponential(2)}` +
    (spikes > 0 ? `; ${spikes} spikes (stars) left out` : '')
  return { n, stepDeg, mean, min: Math.min(...values), max: Math.max(...values), periodDeg, periodCorr, ripple, spikes, summary }
}

export interface MirrorLine {
  points: (LinePoint & { value: number; grain: number })[]
  stats: LineStats
  /** Largest spread between layer offsets at one point, relative (what a
   * per-pixel offset turns into grain). */
  grain: number
}

/**
 * A mirror along a line: `f(dir, jitter)` per direction, averaged over
 * `jitters` layer offsets (1: a single offset at 0.5, as one pixel sees it).
 * Use the stats of the average for bands (the per-pixel offset leaves them),
 * `grain` for the noise the offsets make.
 */
export function mirrorLine(p: Pick<SceneParams, 'camera'>, line: SkyLine, f: (dir: Vec3, jitter: number) => number, jitters = 8): MirrorLine {
  const points = lineDirections(p, line).map(pt => {
    const v = Array.from({ length: jitters }, (_, j) => f(pt.dir, jitters === 1 ? 0.5 : (j + 0.5) / jitters))
    const value = v.reduce((s, x) => s + x, 0) / v.length
    return { ...pt, value, grain: value > 0 ? (Math.max(...v) - Math.min(...v)) / value : 0 }
  })
  const step = line.step ?? 0.05
  return { points, stats: lineStats(points.map(q => q.value), step), grain: Math.max(...points.map(q => q.grain)) }
}

/** A row of characters showing a line's shape (min to max). */
export function sparkline(values: number[], width = 60): string {
  const bars = '▁▂▃▄▅▆▇█'
  const cells = Array.from({ length: Math.min(width, values.length) }, (_, i) => {
    const a = Math.floor((i * values.length) / Math.min(width, values.length))
    const b = Math.max(a + 1, Math.floor(((i + 1) * values.length) / Math.min(width, values.length)))
    return values.slice(a, b).reduce((s, x) => s + x, 0) / (b - a)
  })
  const [lo, hi] = [Math.min(...cells), Math.max(...cells)]
  return cells.map(v => bars[hi > lo ? Math.min(7, Math.floor(((v - lo) / (hi - lo)) * 8)) : 0]).join('')
}

// --- The air's transmittance, as takram's atmosphere has it ---------------

/** Rayleigh scattering (km⁻¹, RGB) with an 8 km scale height; Mie
 * extinction with 1.2 km; ozone absorption in a tent from 10 to 40 km
 * (peak at 25). takram's defaults (AtmosphereParameters). */
const RAYLEIGH: Vec3 = [5.802e-3, 13.558e-3, 33.1e-3]
const MIE = 4.44e-3
const OZONE: Vec3 = [0.65e-3, 1.881e-3, 0.085e-3]
let table: Vec3[] | null = null
const TABLE_STEP = 0.25

/** Optical depth (RGB) from the ground toward an elevation, through the
 * whole atmosphere: a numerical march over the curved shells. */
function opticalDepth(elDeg: number): Vec3 {
  const mu = Math.sin(Math.max(elDeg, 0) * DEG)
  const r0 = EARTH_KM + 0.002
  // Up to 100 km; steps finer near the ground where the air is.
  const top = EARTH_KM + 100
  const tMax = -r0 * mu + Math.sqrt(r0 * r0 * mu * mu - r0 * r0 + top * top)
  const n = 400
  const out: Vec3 = [0, 0, 0]
  for (let i = 0; i < n; i++) {
    // Quadratic spacing: dense low down.
    const [a, b] = [(i / n) ** 2 * tMax, ((i + 1) / n) ** 2 * tMax]
    const t = 0.5 * (a + b)
    const h = Math.sqrt(r0 * r0 + t * t + 2 * r0 * t * mu) - EARTH_KM
    const ray = Math.exp(-h / 8)
    const mie = Math.exp(-h / 1.2)
    const oz = h < 10 || h > 40 ? 0 : h < 25 ? (h - 10) / 15 : (40 - h) / 15
    for (let k = 0; k < 3; k++) out[k] += (RAYLEIGH[k] * ray + MIE * mie + OZONE[k] * oz) * (b - a)
  }
  return out
}

/** Transmittance (RGB) from the ground to space toward an elevation (deg),
 * as takram's `transmittance` in the sky shader (sea-level camera). */
export function airTransmittance(elDeg: number): Vec3 {
  table ??= Array.from({ length: Math.round(90 / TABLE_STEP) + 1 }, (_, i) => opticalDepth(i * TABLE_STEP).map(t => Math.exp(-t)) as Vec3)
  const x = Math.min(90, Math.max(0, elDeg)) / TABLE_STEP
  const i = Math.min(table.length - 2, Math.floor(x))
  const f = x - i
  return [0, 1, 2].map(k => table![i][k] * (1 - f) + table![i + 1][k] * f) as Vec3
}

export const luminance = (c: readonly number[]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

// --- A hash both sides compute bit for bit ---------------------------------
//
// Sky shaders with a CPU mirror hash their noise cells with integers (PCG,
// Jarzynski & Olano 2020): uint arithmetic is exact in WebGL2 and in JS
// (Math.imul), so the mirror's noise is the GPU's noise. A float hash
// (`fract(sin(x)·43758)`, or even sine-free ones) ends in a fract of a
// large product that float32 rounds differently: a cell near the wrap flips
// from ~1 to ~0, and every octave touching it differs (the airglow mirror
// read 0.63 where the GPU had 0.22).

/** PCG output hash of a 32-bit integer. */
export function pcg(v: number): number {
  const state = (Math.imul(v >>> 0, 747796405) + 2891336453) >>> 0
  const word = Math.imul(((state >>> ((state >>> 28) + 4)) ^ state) >>> 0, 277803737) >>> 0
  return ((word >>> 22) ^ word) >>> 0
}
/** A noise seed as the integer the shader gets (exact in a float uniform). */
export function seedInt(seed: number): number {
  return Math.floor(seed * 1000) % 16_000_000
}
/** Hash of an integer cell (1D or 2D) and an integer seed, in [0, 1]. */
export function hashCell(seed: number, x: number, y?: number): number {
  const s = pcg(seed)
  const h = y == null ? pcg(((x | 0) + s) >>> 0) : pcg(((x | 0) + pcg(((y | 0) + s) >>> 0)) >>> 0)
  return h / 4294967295
}
/** The same in GLSL: `<prefix>Hash1(float cell, float seed)` and
 * `<prefix>Hash2(vec2 cell, float seed)`, cells and seed integer-valued
 * floats. Each shader patch gets its own prefix (they share one shader). */
export function hashGlsl(prefix: string): string {
  return /* glsl */ `
uint ${prefix}Pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float ${prefix}Hash1(float x, float seed) {
  return float(${prefix}Pcg(uint(int(x)) + ${prefix}Pcg(uint(seed)))) * (1.0 / 4294967295.0);
}
float ${prefix}Hash2(vec2 p, float seed) {
  return float(${prefix}Pcg(uint(int(p.x)) + ${prefix}Pcg(uint(int(p.y)) + ${prefix}Pcg(uint(seed))))) * (1.0 / 4294967295.0);
}
`
}
