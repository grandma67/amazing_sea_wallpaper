import { readAll, termPass, type TermScene } from './terrainTerms'

// The shore's water films in numbers (`params.debug.water`,
// plans/WATER_VIEW.md step 2): the terrain's terms `kind`, `dist` and
// `mirror` (terrainTerms.ts) at 1/8 size, tallied. A pool behind a boulder
// isn't counted (props hide the ground); ground under today's still water is
// its own kind (`seabed`). The picture is already on the canvas: this
// changes nothing in it.

/** Film kinds as the shader writes them (red channel). */
export const WATER_KINDS = ['dry', 'damp', 'wetRock', 'swash', 'pool', 'seabed'] as const
export type WaterKind = (typeof WATER_KINDS)[number]

/** The nearest pixel of a kind: distance (m) and where it is in the image
 * (fractions, x right, y down: a `probe` point). */
export interface Nearest {
  m: number
  at: [number, number]
  /** Pixels of the kind within 5% (≥ 1 m) of that distance: 1 is a single
   * pixel (a sliver, or noise), many a patch. */
  pixels: number
}

export interface WaterCount {
  /** The target the counts come from (px). */
  size: [number, number]
  /** Each kind's share of the frame's pixels (0–1); the rest is sky, sea
   * hidden ground, and props. */
  share: Record<WaterKind, number>
  /** Nearest pixel of each film (null: none in frame). */
  nearest: Record<Exclude<WaterKind, 'dry' | 'seabed'>, Nearest | null>
  /** Share of the frame that is pool within 15 m of the camera. */
  poolWithin15m: number
  /** Mean mirror weight over pool pixels (gloss × mirror × (1 − own); null:
   * no pools). */
  poolMirror: number | null
}

/** Count the encoded pixels (RGBA floats, rows bottom-up as WebGL reads
 * them): r kind index + 1 (0: not terrain), g distance (m), b mirror
 * weight, a 1 on terrain. */
export function tallyWater(values: ArrayLike<number>, width: number, height: number): WaterCount {
  const counts = new Array<number>(WATER_KINDS.length).fill(0)
  type Film = keyof WaterCount['nearest']
  const films: Film[] = ['damp', 'wetRock', 'swash', 'pool']
  const best: Record<Film, { m: number; col: number; row: number } | null> = { damp: null, wetRock: null, swash: null, pool: null }
  let near15 = 0
  let mirror = 0
  const kindAt = (i: number): number => (values[i + 3] < 0.5 ? -1 : Math.round(values[i]) - 1)
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4
      const k = kindAt(i)
      if (k < 0 || k >= WATER_KINDS.length) continue
      const kind = WATER_KINDS[k]
      counts[k]++
      const m = values[i + 1]
      if (kind === 'pool') {
        mirror += values[i + 2]
        if (m <= 15) near15++
      }
      if (kind !== 'dry' && kind !== 'seabed') {
        const b = best[kind]
        if (b == null || m < b.m) best[kind] = { m, col, row }
      }
    }
  }
  const round = (v: number, d = 4): number => +v.toFixed(d)
  const nearest = {} as WaterCount['nearest']
  for (const film of films) {
    const b = best[film]
    if (b == null) {
      nearest[film] = null
      continue
    }
    // How many pixels of the film lie about as near.
    const k = WATER_KINDS.indexOf(film)
    const reach = Math.max(b.m * 1.05, b.m + 1)
    let pixels = 0
    for (let i = 0; i < width * height * 4; i += 4) if (kindAt(i) === k && values[i + 1] <= reach) pixels++
    nearest[film] = { m: round(b.m, 1), at: [round((b.col + 0.5) / width, 3), round(1 - (b.row + 0.5) / height, 3)], pixels }
  }
  const total = width * height
  const pools = counts[WATER_KINDS.indexOf('pool')]
  return {
    size: [width, height],
    share: Object.fromEntries(WATER_KINDS.map((kind, k) => [kind, round(counts[k] / total)])) as Record<WaterKind, number>,
    nearest,
    poolWithin15m: round(near15 / total),
    poolMirror: pools > 0 ? round(mirror / pools, 3) : null
  }
}

/** Draw the terrain's kind, distance and mirror weight at 1/`scale` size
 * and count them. */
export function countWater(ctx: TermScene, width: number, height: number, scale = 8): WaterCount {
  const w = Math.max(1, Math.round(width / scale))
  const h = Math.max(1, Math.round(height / scale))
  return tallyWater(termPass(ctx, ['kind', 'dist', 'mirror'], w, h, readAll(ctx.renderer, w, h)), w, h)
}
