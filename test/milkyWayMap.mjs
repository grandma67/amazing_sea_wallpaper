// Decodes public/assets/milkyway.png (scripts/milkyway.mjs) for the tests:
// luminance in S10 at galactic (l, b). Plain JS: the tests' typecheck has
// no Node types.
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

export function milkyWayMap(log2Range) {
  const png = readFileSync(new URL('../public/assets/milkyway.png', import.meta.url))
  const parts = []
  let width = 0
  let height = 0
  for (let p = 8; p < png.length; ) {
    const len = png.readUInt32BE(p)
    const type = png.toString('latin1', p + 4, p + 8)
    if (type === 'IHDR') [width, height] = [png.readUInt32BE(p + 8), png.readUInt32BE(p + 12)]
    if (type === 'IDAT') parts.push(png.subarray(p + 8, p + 8 + len))
    p += 12 + len
  }
  const raw = inflateSync(Buffer.concat(parts))
  const [lo, hi] = log2Range
  return (l, b) => {
    const x = Math.floor(((((0.5 - l / 360) % 1) + 1) % 1) * width)
    const y = Math.min(height - 1, Math.floor((0.5 - b / 180) * height))
    const o = y * (width * 3 + 1) + 1 + x * 3
    const s10 = c => 2 ** (lo + (raw[o + c] / 255) * (hi - lo))
    return 0.2126 * s10(0) + 0.7152 * s10(1) + 0.0722 * s10(2)
  }
}
