// In-place 2D complex FFT (iterative radix-2) on N×N grids stored row-major in
// separate real/imaginary arrays. Used once per render to synthesize the ocean.

const cache = new Map<number, { cos: Float64Array; sin: Float64Array; rev: Uint32Array }>()

function tables(n: number): { cos: Float64Array; sin: Float64Array; rev: Uint32Array } {
  let t = cache.get(n)
  if (t != null) return t
  const bits = Math.log2(n)
  if (!Number.isInteger(bits)) throw new Error(`FFT size must be a power of two: ${n}`)
  const cos = new Float64Array(n / 2)
  const sin = new Float64Array(n / 2)
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((2 * Math.PI * i) / n)
    sin[i] = Math.sin((2 * Math.PI * i) / n)
  }
  const rev = new Uint32Array(n)
  for (let i = 0; i < n; i++) {
    let r = 0
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
    rev[i] = r
  }
  t = { cos, sin, rev }
  cache.set(n, t)
  return t
}

/** 1D inverse FFT (no 1/N scaling) over `n` elements spaced `stride` apart. */
function ifft1d(
  re: Float64Array,
  im: Float64Array,
  offset: number,
  stride: number,
  n: number
): void {
  const { cos, sin, rev } = tables(n)
  for (let i = 0; i < n; i++) {
    const j = rev[i]
    if (j > i) {
      const a = offset + i * stride
      const b = offset + j * stride
      let t = re[a]
      re[a] = re[b]
      re[b] = t
      t = im[a]
      im[a] = im[b]
      im[b] = t
    }
  }
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2
    const step = n / size
    for (let start = 0; start < n; start += size) {
      for (let k = 0; k < half; k++) {
        // Inverse transform: twiddle e^{+2πik/size}.
        const wr = cos[k * step]
        const wi = sin[k * step]
        const a = offset + (start + k) * stride
        const b = offset + (start + k + half) * stride
        const xr = re[b] * wr - im[b] * wi
        const xi = re[b] * wi + im[b] * wr
        re[b] = re[a] - xr
        im[b] = im[a] - xi
        re[a] += xr
        im[a] += xi
      }
    }
  }
}

/** 2D inverse FFT without normalization: f(x) = Σ_k F(k) e^{ik·x}. */
export function ifft2d(re: Float64Array, im: Float64Array, n: number): void {
  for (let row = 0; row < n; row++) ifft1d(re, im, row * n, 1, n)
  for (let col = 0; col < n; col++) ifft1d(re, im, col, n, n)
}
