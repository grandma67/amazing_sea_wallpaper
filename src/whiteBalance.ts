// A camera's white balance (linear Rec. 709 gains).
//
// The renderer's white is daylight (the sun drawn white, D65). A camera set
// to a colour temperature T neutralises a black body at T: its gains are
// white(D65) / white(T), scaled to keep luminance. Night photographers
// mostly shoot at ~3800–4500 K: the moonlit or starlit sky goes blue, while
// the aurora stays green, sodium-lit towns orange and the Milky Way and the
// stars keep their colours. A camera has no rods, so there is no night-vision
// grey (STARS.md §9).

export type RGB = [number, number, number]

/** The white balance night frames are shot at (K). */
export const NIGHT_WHITE_BALANCE_K = 4000

/** Chromaticity (CIE 1931 xy) of a black body at `kelvin` (Kim et al.
 * 2002 cubic fit of the Planckian locus, 1667–25000 K). */
export function planckXY(kelvin: number): [number, number] {
  const t = Math.max(1667, Math.min(25000, kelvin))
  const x =
    t <= 4000
      ? -0.2661239e9 / t ** 3 - 0.2343589e6 / t ** 2 + 0.8776956e3 / t + 0.17991
      : -3.0258469e9 / t ** 3 + 2.1070379e6 / t ** 2 + 0.2226347e3 / t + 0.24039
  const y =
    t <= 2222
      ? -1.1063814 * x ** 3 - 1.3481102 * x ** 2 + 2.18555832 * x - 0.20219683
      : t <= 4000
        ? -0.9549476 * x ** 3 - 1.37418593 * x ** 2 + 2.09137015 * x - 0.16748867
        : 3.081758 * x ** 3 - 5.8733867 * x ** 2 + 3.75112997 * x - 0.37001483
  return [x, y]
}

/** Linear Rec. 709 colour of a chromaticity at unit luminance. */
export function xyToRgb([x, y]: [number, number]): RGB {
  const X = x / y
  const Z = (1 - x - y) / y
  return [3.2406 * X - 1.5372 - 0.4986 * Z, -0.9689 * X + 1.8758 + 0.0415 * Z, 0.0557 * X - 0.204 + 1.057 * Z]
}

const LUMA: RGB = [0.2126, 0.7152, 0.0722]

/** Gains of a camera balanced for a black body at `kelvin`, for a render
 * whose white is daylight; luminance of a grey stays the same. */
export function whiteBalanceGains(kelvin: number): RGB {
  const w = xyToRgb(planckXY(kelvin))
  const d65 = xyToRgb([0.3127, 0.329])
  const g: RGB = [d65[0] / w[0], d65[1] / w[1], d65[2] / w[2]]
  const l = g[0] * LUMA[0] + g[1] * LUMA[1] + g[2] * LUMA[2]
  return [g[0] / l, g[1] / l, g[2] / l]
}
