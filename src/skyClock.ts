import { Body, GeoVector } from 'astronomy-engine'

// The sky clock (NIGHT_SKY phase 1): stars, sun and moon agree.
//
// The scene has no real longitude or clock time: it has a date, a latitude,
// the sun's elevation, morning or evening, and a free compass (below 63°).
// The real sun's direction among the stars for the date (J2000 equator,
// `GeoVector`) gives its declination δ; the hour angle H that puts it at the
// scene's elevation h at latitude φ follows from
//   cos H = (sin h − sin φ sin δ) / (cos φ cos δ),
// west (H > 0) in the evening. That fixes where the celestial pole stands
// (elevation φ, due north) relative to the sun, so the sky is turned about
// the vertical until the real sun's azimuth lands on the scene's. Every sun
// and camera choice stays; only the stars move.
//
// If the scene's elevation is impossible that day (H has no solution), H is
// clamped to the nearest culmination: the pole stays exact and the sun keeps
// its bearing round the pole, `errorDeg` off the scene's sun.

type Vec3 = [number, number, number]

const DEG = Math.PI / 180
/** Obliquity of the ecliptic (J2000). */
const OBLIQUITY = 23.4393 * DEG
/** The ecliptic's north pole in the J2000 equatorial frame. */
export const ECLIPTIC_POLE: Vec3 = [0, -Math.sin(OBLIQUITY), Math.cos(OBLIQUITY)]
/** The moon's orbit is tilted ~5.1° to the ecliptic. */
export const MOON_MAX_ECLIPTIC_LATITUDE = 5

export interface SkyClockInput {
  date: string
  latitudeDeg: number
  /** Unit vector toward the scene's sun, world frame (y up, −z = compass 0). */
  sunDirection: Vec3
  evening: boolean
}

export interface SkyRotation {
  /** J2000 equatorial (ECI) → world, row-major 3×3. */
  matrix: number[]
  /** Angle between the turned real sun and the scene's sun (0 unless the
   * scene's sun elevation is impossible for the latitude and date). */
  errorDeg: number
}

/** The real sun's direction (unit, J2000 equatorial) at noon UTC on `date`. */
export function sunECI(date: string): Vec3 {
  const v = GeoVector(Body.Sun, new Date(`${date}T12:00:00Z`), true)
  return normalize([v.x, v.y, v.z])
}

/** The rotation from the star catalogue's frame (ECI) to the scene's world. */
export function skyRotation(input: SkyClockInput): SkyRotation {
  const { latitudeDeg, sunDirection: S, evening } = input
  const sun = sunECI(input.date)
  const phi = latitudeDeg * DEG
  const dec = Math.asin(sun[2])
  const el = Math.asin(clamp(S[1], -1, 1))
  const cosH = (Math.sin(el) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec))
  const H = Math.acos(clamp(cosH, -1, 1)) * (evening ? 1 : -1)
  // The real sun at hour angle H, in a compass frame (x east, y up, −z north).
  const east = -Math.cos(dec) * Math.sin(H)
  const north = Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(H)
  // Turn about the vertical so its azimuth matches the scene's sun. At the
  // zenith the azimuth is undefined; any turn will do.
  const azReal = Math.atan2(east, north)
  const azScene = Math.atan2(S[0], -S[2])
  const turn = Math.hypot(S[0], S[2]) < 1e-9 ? 0 : azScene - azReal
  // The north celestial pole: due north (compass 0), elevation φ, turned.
  const pole: Vec3 = [Math.cos(phi) * Math.sin(turn), Math.sin(phi), -Math.cos(phi) * Math.cos(turn)]
  // Two frames: (pole, sun ⟂ pole, third) in ECI and in the world.
  const a = frame([0, 0, 1], sun)
  const b = frame(pole, S)
  // R = B Aᵀ.
  const matrix: number[] = []
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) matrix.push(b[0][r] * a[0][c] + b[1][r] * a[1][c] + b[2][r] * a[2][c])
  }
  const turned = apply(matrix, sun)
  const errorDeg = Math.acos(clamp(dot(turned, S), -1, 1)) / DEG
  return { matrix, errorDeg }
}

/** `m` (row-major 3×3) times `v`. */
export function apply(m: readonly number[], v: Vec3): Vec3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2]
  ]
}

/** A direction (world) at angle `elongation` (radians) from the sun along
 * the ecliptic, within `MOON_MAX_ECLIPTIC_LATITUDE` of it. `u` ∈ [0, 1)
 * chooses the side (east of the sun below 0.5, west above) and the ecliptic
 * latitude (spread evenly over ±5°), so it takes the same draw as a free
 * angle round the sun. `eclipticPole` is the ecliptic's pole in the world. */
export function eclipticOffset(sun: Vec3, eclipticPole: Vec3, elongation: number, u: number): Vec3 {
  // The sun lies on the ecliptic, so the pole is perpendicular to it (up to
  // rounding): project to be sure.
  const n = normalize(sub(eclipticPole, scale(sun, dot(eclipticPole, sun))))
  // Eastward along the ecliptic (increasing longitude).
  const t = cross(n, sun)
  const east = u < 0.5
  const v = (u % 0.5) * 2
  const beta = (2 * v - 1) * MOON_MAX_ECLIPTIC_LATITUDE * DEG
  const s = Math.sin(elongation)
  const sinTheta = s < 1e-9 ? 0 : clamp(Math.sin(beta) / s, -1, 1)
  const cosTheta = Math.sqrt(1 - sinTheta * sinTheta) * (east ? 1 : -1)
  const ce = Math.cos(elongation)
  return normalize([
    ce * sun[0] + s * (cosTheta * t[0] + sinTheta * n[0]),
    ce * sun[1] + s * (cosTheta * t[1] + sinTheta * n[1]),
    ce * sun[2] + s * (cosTheta * t[2] + sinTheta * n[2])
  ])
}

/** Ecliptic latitude (degrees) of a world direction. */
export function eclipticLatitudeDeg(d: Vec3, eclipticPole: Vec3): number {
  return Math.asin(clamp(dot(d, eclipticPole), -1, 1)) / DEG
}

/** Orthonormal columns: `p`, `q` made perpendicular to it, and p × q. */
function frame(p: Vec3, q: Vec3): [Vec3, Vec3, Vec3] {
  const e1 = normalize(p)
  const e2 = normalize(sub(q, scale(e1, dot(q, e1))))
  return [e1, e2, cross(e1, e2)]
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x))
}
function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}
function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}
function scale(a: Vec3, k: number): Vec3 {
  return [a[0] * k, a[1] * k, a[2] * k]
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
}
function normalize(a: Vec3): Vec3 {
  const l = Math.hypot(a[0], a[1], a[2])
  return [a[0] / l, a[1] / l, a[2] / l]
}
