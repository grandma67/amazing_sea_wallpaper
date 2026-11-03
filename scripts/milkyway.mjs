#!/usr/bin/env node
// Builds public/assets/milkyway.png (NIGHT_SKY phase 3) from NASA SVS "Deep
// Star Maps 2020" (https://svs.gsfc.nasa.gov/4851, galactic, plate carrée):
//   milkyway_2020_4k_gal.exr  the sky without the Hipparcos/Tycho stars
//   hiptyc_2020_4k_gal.exr    those stars alone (to mag 11.5)
// The catalogue we draw as points (takram's BSC5, public/assets/stars.bin,
// to ~6.5) is masked out of the bright-star layer, the rest is added to the
// background and blurred to 0.35°/texel: what a photo shows as glow.
//
// Calibration (Masana et al. 2021, Gaia + Hipparcos, Table 4): integrated
// starlight at the zenith from 40° N, a 10° circle averaged over the year, is
// 75 nW m⁻² sr⁻¹ ≈ 68 S10 (their V zero point: 1 S10 ≈ 1.10 nW m⁻² sr⁻¹).
// The map is scaled so its own share plus the catalogue's there makes 68.
// (Burns's "2,000 first-magnitude stars" for the whole sky came out 3× too
// bright.) 1 S10 = one 10th-magnitude star per square degree = 27.78
// mag/arcsec².
//
// Encoding: 8-bit per channel, log2 of S10 over [LOG_MIN, LOG_MAX] (nightGlow.ts
// decodes it); row 0 is galactic latitude +90°, column 0 longitude +180°,
// longitude increasing to the left (the SVS layout).
//
//   node scripts/milkyway.mjs DIR_WITH_EXRS
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js'
import { FloatType } from 'three'

const LOG_MIN = -2
const LOG_MAX = 12
const OUT_W = 1024
/** Integrated starlight, zenith at 40° N, annual mean (S10). */
const ZENITH_40N_S10 = 75 / 1.1
/** Equatorial (J2000) → galactic (Hipparcos). */
const T = [
  [-0.0548755604, -0.8734370902, -0.4838350155],
  [0.4941094279, -0.44482963, 0.7469822445],
  [-0.867666149, -0.1980763734, 0.4559837762]
]

const dir = process.argv[2]
if (dir == null) throw new Error('usage: node scripts/milkyway.mjs DIR_WITH_EXRS')
const read = name => {
  const b = readFileSync(`${dir}/${name}`)
  const l = new EXRLoader()
  l.setDataType(FloatType)
  return l.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
}
const mw = read('milkyway_2020_4k_gal.exr')
const hip = read('hiptyc_2020_4k_gal.exr')
const { width: W, height: H } = mw
// EXRLoader's rows run bottom-up: row H-1 is b = +90.
const idx = (x, y) => ((H - 1 - y) * W + (((x % W) + W) % W)) * 4

// Mask the catalogue's stars out of the bright-star layer.
const sb = readFileSync(new URL('../public/assets/stars.bin', import.meta.url))
const i16 = new Int16Array(sb.buffer, sb.byteOffset, sb.byteLength / 2)
const u8 = new Uint8Array(sb.buffer, sb.byteOffset, sb.byteLength)
const catalogueStars = []
for (let k = 0; k < sb.byteLength / 10; k++) {
  const v = [0, 1, 2].map(j => i16[k * 5 + j] / 32767)
  const m = -2 + (10 * u8[k * 10 + 6]) / 255
  catalogueStars.push({ v, flux: 10 ** (-0.4 * (m - 10)) })
  const g = T.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2])
  const l = (Math.atan2(g[1], g[0]) * 180) / Math.PI
  const b = (Math.asin(Math.max(-1, Math.min(1, g[2]))) * 180) / Math.PI
  const x = Math.floor(((((0.5 - l / 360) % 1) + 1) % 1) * W)
  const y = Math.floor((0.5 - b / 180) * H)
  const r = m < 2 ? 8 : m < 4 ? 5 : 3
  for (let dx = -r; dx <= r; dx++)
    for (let dy = -r; dy <= r; dy++) {
      if (y + dy < 0 || y + dy >= H) continue
      const i = idx(x + dx, y + dy)
      hip.data[i] = hip.data[i + 1] = hip.data[i + 2] = 0
    }
}

// Sum the layers.
const sum = new Float32Array(W * H * 3)
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = idx(x, y)
    const o = (y * W + x) * 3
    for (let c = 0; c < 3; c++) sum[o + c] = mw.data[i + c] + hip.data[i + c]
  }

// Downsample (box) to OUT_W × OUT_W/2, in S10.
const OW = OUT_W
const OH = OUT_W / 2
const f = W / OW
const out = new Float32Array(OW * OH * 3)
for (let y = 0; y < OH; y++)
  for (let x = 0; x < OW; x++)
    for (let c = 0; c < 3; c++) {
      let s = 0
      for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) s += sum[((y * f + dy) * W + x * f + dx) * 3 + c]
      out[(y * OW + x) * 3 + c] = s / (f * f)
    }

// Calibrate: the zenith at 40° N over a year (a 10° circle every 2° of RA).
const DEG = Math.PI / 180
const eq = (ra, dec) => [Math.cos(dec * DEG) * Math.cos(ra * DEG), Math.cos(dec * DEG) * Math.sin(ra * DEG), Math.sin(dec * DEG)]
const mapAt = v => {
  const g = T.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2])
  const l = Math.atan2(g[1], g[0]) / DEG
  const b = Math.asin(Math.max(-1, Math.min(1, g[2]))) / DEG
  const x = Math.floor(((((0.5 - l / 360) % 1) + 1) % 1) * OW)
  const y = Math.min(OH - 1, Math.floor((0.5 - b / 180) * OH))
  const i = (y * OW + x) * 3
  return 0.2126 * out[i] + 0.7152 * out[i + 1] + 0.0722 * out[i + 2]
}
const capDeg2 = (2 * Math.PI * (1 - Math.cos(10 * DEG))) / DEG ** 2
let mapMean = 0
let catalogue = 0
let n = 0
for (let ra = 0; ra < 360; ra += 2) {
  const z = eq(ra, 40)
  let s = 0
  let c = 0
  for (let dr = -10; dr <= 10; dr++)
    for (let dd = -10; dd <= 10; dd++) {
      if ((dr * Math.cos(40 * DEG)) ** 2 + dd * dd > 100) continue
      s += mapAt(eq(ra + dr, 40 + dd))
      c++
    }
  mapMean += s / c
  for (const st of catalogueStars) if (st.v[0] * z[0] + st.v[1] * z[1] + st.v[2] * z[2] > Math.cos(10 * DEG)) catalogue += st.flux / capDeg2
  n++
}
mapMean /= n
catalogue /= n
const k = (ZENITH_40N_S10 - catalogue) / mapMean
for (let i = 0; i < out.length; i++) out[i] *= k

// Report.
const lum = i => 0.2126 * out[i * 3] + 0.7152 * out[i * 3 + 1] + 0.0722 * out[i * 3 + 2]
const at = (l, b) => lum(Math.floor((0.5 - b / 180) * OH) * OW + Math.floor(((((0.5 - l / 360) % 1) + 1) % 1) * OW))
const sorted = Array.from({ length: OW * OH }, (_, i) => lum(i)).sort((a, b) => a - b)
const q = p => sorted[Math.floor(p * (sorted.length - 1))].toFixed(1)
console.log(`zenith 40° N: ${ZENITH_40N_S10.toFixed(0)} S10 = catalogue ${catalogue.toFixed(1)} + map ${(ZENITH_40N_S10 - catalogue).toFixed(1)} (k = ${k.toFixed(0)})`)
console.log(`S10: pole ${at(0, 89).toFixed(1)}, b=-60 ${at(100, -60).toFixed(1)}, anticentre ${at(180, 0).toFixed(1)}, Scutum (27,-2) ${at(27, -2).toFixed(1)}, Sgr cloud (2,-5) ${at(2, -5).toFixed(1)}, Cygnus (75,2) ${at(75, 2).toFixed(1)}, rift (40,3) ${at(40, 3).toFixed(1)}`)
console.log(`quantiles: 10% ${q(0.1)}, 50% ${q(0.5)}, 90% ${q(0.9)}, 99% ${q(0.99)}, 99.9% ${q(0.999)}, max ${q(1)}`)

// Encode: log2(S10) over [LOG_MIN, LOG_MAX] in 8 bits.
const rows = Buffer.alloc((OW * 3 + 1) * OH)
for (let y = 0; y < OH; y++) {
  rows[y * (OW * 3 + 1)] = 0
  for (let x = 0; x < OW * 3; x++) {
    const v = Math.log2(Math.max(out[y * OW * 3 + x], 2 ** LOG_MIN))
    rows[y * (OW * 3 + 1) + 1 + x] = Math.round(Math.max(0, Math.min(1, (v - LOG_MIN) / (LOG_MAX - LOG_MIN))) * 255)
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  return c >>> 0
})
const crc = buf => {
  let c = 0xffffffff
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
const chunk = (type, data) => {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const c = Buffer.alloc(4)
  c.writeUInt32BE(crc(td))
  return Buffer.concat([len, td, c])
}
const ihdr = Buffer.alloc(13)
ihdr.writeUInt32BE(OW, 0)
ihdr.writeUInt32BE(OH, 4)
ihdr[8] = 8
ihdr[9] = 2 // RGB
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(rows, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
])
const target = new URL('../public/assets/milkyway.png', import.meta.url)
writeFileSync(target, png)
console.log(`wrote ${target.pathname} (${(png.length / 1024).toFixed(0)} KB)`)
