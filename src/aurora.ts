import { Uniform, Vector3, Vector4, type Matrix4 } from 'three'
import type { SkyMaterial } from '@takram/three-atmosphere'

import { solarActivity } from './nightGlow'
import { airTransmittance, hashCell, hashGlsl, luminance, seedInt } from './skyMirror'
import type { Random } from './random'

// Aurora (NIGHT_SKY phase 6, STARS.md §8).
//
// Where: an oval round the geomagnetic pole (dipole, 80.8° N 72.7° W).
// Its equatorward edge sits at ~67° − 2° × Kp geomagnetic latitude; NOAA's
// scales put the aurora as far down as ~55° at Kp 6, 50° at Kp 7, 45° at
// Kp 8 and 40° at Kp 9 (seen low on the poleward horizon, ~5–10°
// equatorward of the overhead edge). The oval widens as it grows: its
// poleward edge moves only a little (~74° quiet, ~70° in a big storm;
// general). Under the oval it stands overhead; equatorward of it, a low arc
// toward the magnetic pole; poleward of it (Svalbard on quiet nights), an
// arc toward the equator.
//
// When: a daily Kp drawn from NOAA's storm-day counts per 11-year cycle
// (G1 900, G2 360, G3 130, G4 60, G5 4 days of 4,018), scaled with the solar
// cycle; dark night only (sun below −16°, our night) and gaps in the cloud.
//
// How bright: green-line kilorayleighs (IBC I ~1 kR, II ~10, III ~100,
// IV ~1000; general). 1 R of 557.7 nm = 2.83e-10 W m⁻² sr⁻¹ × 680 lm/W
// ≈ 1.93e-7 cd/m², so 10 kR is ~10× a dark sky.
//
// Drawn in takram's sky shader as layers through 92–320 km (`AURORA_LAYERS`):
// each samples the curtains' footprint (folded sheets along the magnetic
// east–west, fine vertical rays), weighted by the emission profile (green
// peaking ~110 km, red ~230 km on a wider sheet, a magenta type-B lower
// border ~97 km on the brightest arc of strong displays), plus in storms a
// diffuse red glow (~250 km) over the oval and equatorward of it,
// on the main sky and the reflection cube (the sea mirrors it).
// `auroraRay` is the same march in TypeScript: tests, and the light the
// display sheds on the ground (`auroraLux`), use it.

type Vec3 = [number, number, number]
const DEG = Math.PI / 180
/** takram's ATMOSPHERE.bottom_radius (km). */
const EARTH_KM = 6360

/** Geomagnetic dipole north pole (IGRF, ~2025). */
export const DIPOLE_POLE = { lat: 80.8, lon: -72.7 }

/** A representative coast point (lat, lon) for each place the oval can
 * reach (|latitude| ≳ 40°). */
export const AURORA_SITES: Record<string, [number, number]> = {
  'norway-west': [61, 5],
  'norway-north': [69.5, 18],
  scotland: [57.5, -5],
  ireland: [53.5, -9],
  'cornwall-wales': [51, -4.5],
  'bristol-channel': [51.3, -3.5],
  'morecambe-bay': [54, -3],
  newfoundland: [48.5, -55],
  'nova-scotia': [45, -63],
  fundy: [45, -65],
  pei: [46.4, -63],
  maine: [44, -69],
  baltic: [56, 18],
  'wadden-north-sea': [54, 8],
  brittany: [48, -3.5],
  'mont-saint-michel': [48.6, -1.5],
  'iceland-faroe': [63, -15],
  iceland: [64.5, -20],
  'arctic-canada': [70, -100],
  greenland: [68, -45],
  'arctic-russia': [70, 60],
  svalbard: [78, 16],
  'alaska-north': [70.5, -156],
  'se-alaska': [57, -134],
  'gulf-alaska': [60, -147],
  'cook-inlet': [60.5, -151],
  'british-columbia': [51, -127],
  'pacific-northwest': [46, -124],
  'russian-far-east': [55, 150],
  'kamchatka-kurils-aleutians': [54, 160],
  'new-zealand-south': [-45, 169],
  'patagonia-fjords': [-48, -74],
  'tierra-del-fuego': [-54, -68],
  tasmania: [-42, 147],
  'south-georgia': [-54, -37],
  falklands: [-51.7, -59],
  'south-shetland': [-62.5, -60],
  'south-sandwich': [-57, -26.5],
  'kerguelen-heard': [-49.5, 70],
  'nz-subantarctic': [-51, 166]
}

/** Geomagnetic latitude (deg, + toward the pole of the place's hemisphere)
 * and the compass bearing (deg) to that pole, for a point. */
export function geomagnetic(latDeg: number, lonDeg: number): { lat: number; bearingDeg: number } {
  const south = latDeg < 0
  // The southern dipole pole is the antipode.
  const pLat = (south ? -DIPOLE_POLE.lat : DIPOLE_POLE.lat) * DEG
  const pLon = (south ? DIPOLE_POLE.lon + 180 : DIPOLE_POLE.lon) * DEG
  const [phi, lam] = [latDeg * DEG, lonDeg * DEG]
  const lat = Math.asin(Math.sin(phi) * Math.sin(pLat) + Math.cos(phi) * Math.cos(pLat) * Math.cos(lam - pLon)) / DEG
  const y = Math.sin(pLon - lam) * Math.cos(pLat)
  const x = Math.cos(phi) * Math.sin(pLat) - Math.sin(phi) * Math.cos(pLat) * Math.cos(pLon - lam)
  return { lat, bearingDeg: ((Math.atan2(y, x) / DEG) % 360 + 360) % 360 }
}

/** Days per 11-year cycle with Kp reaching 5…9 (NOAA scales). */
export const STORM_DAYS: Record<number, number> = { 5: 900, 6: 360, 7: 130, 8: 60, 9: 4 }
const CYCLE_DAYS = 4018
/** A storm day holds its level for about a third of its 3-hour intervals,
 * so a night's session sees it on that share (general). */
const STORM_SHARE = 1 / 3
/** Quiet sessions' Kp, shared out of the rest (long-term 3-hour Kp:
 * mostly 0–2; general). */
export const QUIET: Record<number, number> = { 1: 0.38, 2: 0.3, 3: 0.21, 4: 0.11 }

/** Kp during tonight's session from a uniform draw; storms scale with the
 * solar cycle (×0.5 at minimum, ×1.5 at maximum). Kp 0–1 → 1. */
export function kpFor(u: number, activity: number): number {
  const k = (0.5 + activity) * STORM_SHARE
  let acc = 0
  for (const kp of [9, 8, 7, 6, 5]) {
    acc += (STORM_DAYS[kp] / CYCLE_DAYS) * k
    if (u < acc) return kp
  }
  const rest = (u - acc) / (1 - acc)
  let q = 0
  for (const kp of [4, 3, 2, 1]) {
    q += QUIET[kp]
    if (rest < q) return kp
  }
  return 1
}

/** Equatorward edge of the overhead oval (corrected geomagnetic latitude):
 * with a low arc showing `ARC_REACH` beyond it, Kp 5 reaches ~53° (Maine),
 * 7 ~49° (Illinois), 9 ~45° (NOAA scales). */
export function ovalEdge(kp: number): number {
  return 67 - 2 * kp
}
/** The oval's width (deg): its poleward edge sits at ~74° on quiet nights
 * and only falls to ~70° in a big storm, so it widens as the equatorward
 * edge moves down (general). */
export function ovalWidth(kp: number): number {
  return 7 + 1.5 * kp
}
/** How far beyond the oval's edges a low arc shows: at ~450 km the
 * curtains' 300 km tops stand ~25° up, at 1,100 km only ~10° and faint. */
export const ARC_REACH = 4
/** Over Europe the dipole latitude runs ~2.5° above the corrected
 * geomagnetic latitude the oval follows (north Scotland ~60 vs ~57.5;
 * general). */
function cgmCorrection(lonDeg: number): number {
  return lonDeg > -20 && lonDeg < 45 ? -2.5 : 0
}

export interface AuroraParams {
  kp: number
  /** 'overhead': under the oval; 'arc': low on the horizon toward the oval. */
  kind: 'overhead' | 'arc'
  /** Geomagnetic latitude of the camera and the oval's two edges. */
  observerLat: number
  edgeLat: number
  polewardLat: number
  /** Azimuth toward the geomagnetic pole in the world frame (deg). */
  poleAzimuthDeg: number
  /** Brightest arc's column looking straight up through it (luminance, in
   * kR of green line). */
  strengthKR: number
  /** Up to four arcs: [km poleward of the camera, strength × strengthKR]. */
  arcs: [number, number][]
  /** Patchiness along the arcs: the fbm threshold below which an arc fades
   * out (0.1 quiet, near continuous; 0.25 active, broken). */
  patchy: number
  /** Shares of the arcs' luminance in red (630 nm, high) and the magenta
   * type-B lower border (N₂ first positive red and N₂⁺ blue under a
   * quenched green line; brightest arc of strong displays only); the rest is
   * green. */
  red: number
  fringe: number
  /** The field's dip below the horizon (deg; dipole: tan I = 2 tan
   * latitude). Rays and curtains follow field lines: higher up they lie
   * equatorward, (h − 110 km) / tan I. */
  dipDeg: number
  /** Storm-time diffuse red glow (630 nm, ~250 km) over the oval and ~3°
   * equatorward of it: its column's luminance (kR of green-equivalent). */
  redGlowKR: number
  seed: number
  /** Folds of the curtains: amplitude (km) and wavelength (km). */
  foldKm: [number, number]
  /** Turn of the scene's sky (deg, about the vertical) that frames the
   * display; applied in params.ts. */
  frameTurnDeg: number
}

export interface AuroraInput {
  date: string
  placeId: string
  latitudeDeg: number
  night: boolean
  weatherKind: string
  /** World azimuth of true north (where the sky clock puts the pole). */
  northAzimuthDeg: number
  headingDeg: number
}

/** Clear share for seeing the aurora. */
const SKY: Record<string, number> = { clear: 1, few: 1, cirrus: 0.9, scattered: 0.8, broken: 0.45 }

/** Luminance of 630 nm per unit radiance against 557.7 nm (photopic
 * V(630) / V(557.7)). */
const V_RED = 0.265
/** Luminance share of the red line for an intensity ratio I630/I557.7. */
export function redShare(ratio: number): number {
  return (V_RED * ratio) / (1 + V_RED * ratio)
}

/** Ground distance (km) at which a point `hKm` up stands `elDeg` above the
 * horizon (Earth's curve included). */
export function distanceForElevation(elDeg: number, hKm: number): number {
  let [lo, hi] = [0, 3000]
  for (let i = 0; i < 40; i++) {
    const d = (lo + hi) / 2
    if (elevationOf(d, hKm) > elDeg) lo = d
    else hi = d
  }
  return (lo + hi) / 2
}
export function elevationOf(dKm: number, hKm: number): number {
  const th = dKm / EARTH_KM
  const r = EARTH_KM + hKm
  return Math.atan2(r * Math.cos(th) - EARTH_KM, r * Math.sin(th)) / DEG
}

/**
 * Tonight's aurora, if any. `force`: true at least a display (Kp raised to
 * reach the place), 'strong' a big storm, false/null none.
 */
export function auroraFor(input: AuroraInput, rng: Random, framing: number, force?: boolean | 'strong' | null): AuroraParams | null {
  // Always the same draws.
  const [uKp, uShow, uSky, uStrength, uRed, uFrame] = [rng.float(), rng.float(), rng.float(), rng.float(), rng.float(), rng.float()]
  const seed = rng.range(0, 100)
  const foldKm: [number, number] = [rng.range(15, 60), rng.range(120, 400)]
  const frameNoise = rng.normal(0, 12 * framing)
  // The arcs: where the first stands (its base's elevation), how many,
  // their spacing and strengths (appended draws).
  const firstEl = rng.range(8, 18)
  const uCount = rng.float()
  const gaps = [rng.range(60, 180), rng.range(60, 180), rng.range(60, 180)]
  const weights = [rng.range(0.35, 0.75), rng.range(0.35, 0.75), rng.range(0.35, 0.75)]
  // Storm colours (appended draws): the type-B border, the red glow.
  const [uTypeB, uGlow] = [rng.float(), rng.float()]
  const site = AURORA_SITES[input.placeId]
  if (site == null || force === false || force === null) return null
  // The day's latitude within the place shifts the geomagnetic one by as much.
  const g = geomagnetic(site[0], site[1])
  const observerLat = g.lat + cgmCorrection(site[1]) + (Math.abs(input.latitudeDeg) - Math.abs(site[0]))
  let kp = kpFor(uKp, solarActivity(input.date))
  const reachKp = (lat: number): number => Math.ceil((67 + ARC_REACH * 0.5 - lat) / 2)
  if (force === 'strong') kp = Math.max(kp, Math.min(9, reachKp(observerLat) + 2), 6)
  else if (force === true) kp = Math.max(kp, Math.min(9, reachKp(observerLat)))
  const edge = ovalEdge(kp)
  const poleEdge = edge + ovalWidth(kp)
  const under = observerLat >= edge && observerLat <= poleEdge
  const equatorward = observerLat < edge && edge - observerLat < ARC_REACH
  const poleward = observerLat > poleEdge && observerLat - poleEdge < ARC_REACH
  if (!under && !equatorward && !poleward) return null
  // A display during a ~4 h session: likely under the oval, less at its
  // reach; then dark and with gaps in the cloud.
  const reach = under ? 1 : 1 - (equatorward ? edge - observerLat : observerLat - poleEdge) / ARC_REACH
  const show = (kp >= 3 ? 0.85 : 0.6) * (0.4 + 0.6 * reach)
  const forced = force === true || force === 'strong'
  if (!forced && (!input.night || uShow > show || uSky > (SKY[input.weatherKind] ?? 0))) return null
  // Brightness grows with Kp. A photographed display is the session's
  // peak: at a substorm's onset quiet arcs brighten to IBC II (~10 kR);
  // storms reach 30–100 kR (II–III). Seen across from 300–500 km, an arc
  // gives about its column, against a sky ~2.5× the zenith low down.
  const base = [8, 9, 11, 13, 16, 21, 28, 36, 46, 60][Math.min(9, Math.max(0, kp))]
  const strengthKR = base * Math.exp((uStrength - 0.5) * 1.2) * (under ? 1 : 0.6 + 0.4 * reach)
  // The bearing is to the hemisphere's own dipole pole (south: the antipode).
  const poleAzimuthDeg = input.northAzimuthDeg + g.bearingDeg
  // Toward the display: the pole's side, the equator's from poleward of
  // the oval, and under it toward the oval's middle (a frame shows the
  // horizon, where an overhead display's far arcs stand).
  const towardEquator = poleward || (under && observerLat > (edge + poleEdge) / 2)
  const arcAz = towardEquator ? poleAzimuthDeg + 180 : poleAzimuthDeg
  const frameTurnDeg = uFrame < 0.75 ? wrap(input.headingDeg - arcAz + frameNoise) : 0
  // Arcs (km poleward of the camera). Quiet displays are one or two bright,
  // continuous arcs; active ones more, broken and folded.
  const [edgeKm, poleKm] = [(edge - observerLat) * 111, (poleEdge - observerLat) * 111]
  const count = kp <= 3 ? (uCount < 0.4 ? 2 : 1) : kp <= 6 ? 3 : 4
  let first: number
  let step: number
  if (equatorward) [first, step] = [edgeKm, 1]
  else if (poleward) [first, step] = [poleKm, -1]
  else {
    // Under the oval: the brightest arc where the frame looks, its base
    // 8–18° up (the classic view: an arc 250–450 km off), on the oval.
    const heading = wrap(input.headingDeg - (poleAzimuthDeg + frameTurnDeg))
    step = Math.cos(heading * DEG) >= 0 ? 1 : -1
    first = Math.min(poleKm, Math.max(edgeKm, step * distanceForElevation(firstEl, 110)))
  }
  const arcs: [number, number][] = [[first, 1]]
  let x = first
  for (let i = 1; i < count; i++) {
    x += step * gaps[i - 1]
    if (x < edgeKm - 1 || x > poleKm + 1) break
    arcs.push([x, weights[i - 1]])
  }
  // Red: the 630 nm line is ~0.1–0.3 of the green in kR in ordinary
  // displays (the ratio falls as the green brightens), so a few % of the
  // luminance. In storms it climbs (low-energy electrons, a hot, expanded
  // upper atmosphere): photos of the 2024 great storms at 50–57° are red and
  // magenta, and the May 2024 mid-latitude aurora had I630/I557.7 up to
  // 15–30 (Beletsky 2024). ~0.2 at Kp 5, ~0.5 at 7, ~1.2 at 9 (more would turn the arcs in front of other arcs' red tops orange; the storm's red sky is the glow below); equatorward
  // arcs in big storms (type A, SAR) twice that.
  const ratio = (kp <= 4 ? 0.1 + 0.02 * kp : 0.2 * 1.55 ** (kp - 5)) * (0.8 + 0.4 * uRed) * (kp >= 7 && !under ? 2 : 1)
  const red = redShare(ratio)
  // The red adds to the green, it doesn't replace it: the green keeps the
  // luminance it has with a quiet night's ratio.
  const quietRed = redShare(Math.min(ratio, (0.1 + 0.02 * kp) * (0.8 + 0.4 * uRed)))
  // Type-B lower border: on fast, bright curtains reaching down to ~90 km
  // the green line is quenched and N₂ glows red with N₂⁺ blue: a magenta
  // edge. Kp ≥ 5, more often in bigger storms; always in a forced 'strong'.
  const typeB = kp >= 5 && (force === 'strong' || uTypeB < 0.35 + 0.1 * (kp - 5))
  const fringe = typeB ? 0.03 + 0.0125 * (kp - 5) : 0
  // The storm's diffuse red: ~25 kR of 630 nm (≈ 6.6 kR luminance) at the
  // May 2024 peak over Irkutsk. As a share of the arcs' column (a brighter
  // storm is brighter in both), 0.8% at Kp 5 to 3% at 9: ~1–3.5 kR at Kp 9,
  // which leaves the arcs green in front of it.
  const redGlowKR = strengthKR * [0, 0, 0, 0, 0, 0.008, 0.014, 0.02, 0.025, 0.03][Math.min(9, Math.max(0, kp))] * (0.7 + 0.6 * uGlow)
  return {
    kp,
    kind: under ? 'overhead' : 'arc',
    observerLat,
    edgeLat: edge,
    polewardLat: poleEdge,
    poleAzimuthDeg: poleAzimuthDeg + frameTurnDeg,
    strengthKR: strengthKR * (1 - quietRed) / (1 - red),
    arcs,
    patchy: kp <= 3 ? 0.1 : 0.25,
    red,
    fringe,
    redGlowKR,
    dipDeg: dipFor(observerLat),
    seed,
    foldKm,
    frameTurnDeg
  }
}

/** Dip of a dipole field at a geomagnetic latitude (deg): tan I = 2 tan λ. */
export function dipFor(latDeg: number): number {
  return Math.atan(2 * Math.tan(Math.max(1, latDeg) * DEG)) / DEG
}

function wrap(deg: number): number {
  return ((deg % 360) + 540) % 360 - 180
}

/** Green-line radiance (cd/m²) of 1 R. */
export const RAYLEIGH_CD = 1.93e-7
/** An arc's width across the oval (km; discrete arcs and bands are ~10–50
 * km): the kR a photometer reads looking up through one; seen across at a
 * distance it is a fraction of that, along its length many times more. */
export const ARC_KM = 25
/** The diffuse aurora's column against the brightest arc's: a faint even
 * glow over the oval (diffuse ~0.1–1 kR beside 10–100 kR arcs), on its own
 * thin, low profile (`DIFFUSE_KM`). */
export const DIFFUSE = 0.012
export const DIFFUSE_KM: [number, number] = [112, 10]
/** The red's sheet across the arcs (km): the 630 nm line lives ~110 s, so
 * its glow spreads wider and softer than the green curtains (general). */
export const RED_KM = 60
/** The arcs' red profile (centre, below, above; km): O(¹D) is quenched by
 * N₂ below ~200 km, so the red has a steep underside and a broad top, and
 * stands clear of the green curtains (general). */
export const RED_KM_PROFILE: [number, number, number] = [240, 35, 60]
/** The storm red glow's profile (centre, below, above; km): a broad layer
 * peaking ~250 km (cut at the shell's top). */
export const RED_GLOW_KM: [number, number, number] = [250, 40, 70]
/** Layers through the emitting shell. */
export const AURORA_LAYERS = 28
const BOTTOM_KM = 92
const TOP_KM = 320
const DH = (TOP_KM - BOTTOM_KM) / AURORA_LAYERS
const shellIntegral = (c: number, lo: number, hi: number): number => layerMean((BOTTOM_KM + TOP_KM) / 2, TOP_KM - BOTTOM_KM, c, lo, hi) * (TOP_KM - BOTTOM_KM)
const RED_NORM = shellIntegral(...RED_KM_PROFILE)
/** The red glow profile's integral inside the shell (its top above 320 km
 * isn't drawn; the drawn part carries the column). */
const RED_GLOW_NORM = shellIntegral(...RED_GLOW_KM)
/** The rays' mean (their period along the arc is 1.5 + i km per arc). */
const RAY_MEAN = 1 - 0.55 * 0.5
/** How far the folded sheet moves across per km along it, per (amplitude /
 * wavelength): ~2 for the fbm's typical slope (×2 for its 2A swing). A sheet
 * is widened to the step between layers' samples across it, its own
 * motion included: sampled at under its width it doesn't ripple (a Gaussian
 * at 1.4σ steps left 1–2% bands parallel to the arcs). */
const FOLD_SLOPE = 4

const unit = (c: Vec3): Vec3 => {
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  return [c[0] / l, c[1] / l, c[2] / l]
}
/** Luminance-normalised colours of the lines as a camera records them. */
export const AURORA_COLOURS = { green: unit([0.25, 1.0, 0.35]), red: unit([1.0, 0.08, 0.12]), fringe: unit([1.0, 0.1, 0.55]) }

/** erf, to ~1e-4 (Winitzki). */
function erf(x: number): number {
  const x2 = x * x
  return Math.sign(x) * Math.sqrt(1 - Math.exp((-x2 * (4 / Math.PI + 0.147 * x2)) / (1 + 0.147 * x2)))
}
/** Mean of exp(−((u − c)/s)²) over the layer [h − dh/2, h + dh/2]; s is
 * `lo` below c and `hi` above. Exact for the Gaussians, so a profile
 * thinner than the layers (the 5 km fringe, the green underside) keeps its
 * light whatever the layers' offset: point samples made 10–30% grain. */
function layerMean(h: number, dh: number, c: number, lo: number, hi = lo): number {
  const [a, b] = [h - dh / 2, h + dh / 2]
  let sum = 0
  if (a < c) sum += 0.886227 * lo * (erf((Math.min(b, c) - c) / lo) - erf((a - c) / lo))
  if (b > c) sum += 0.886227 * hi * (erf((b - c) / hi) - erf((Math.max(a, c) - c) / hi))
  return sum / dh
}
/** Emission profiles (per km) averaged over the layer at `hKm`, each
 * integrating to 1 over height (Gaussian halves: ∫ = √π σ / 2 each). */
export function profiles(hKm: number, dh = DH): { green: number; red: number; fringe: number; diffuse: number; redGlow: number } {
  return {
    green: layerMean(hKm, dh, 110, 9, 35) / (0.886227 * 44),
    red: layerMean(hKm, dh, RED_KM_PROFILE[0], RED_KM_PROFILE[1], RED_KM_PROFILE[2]) / RED_NORM,
    fringe: layerMean(hKm, dh, 97, 5) / (1.772454 * 5),
    diffuse: layerMean(hKm, dh, DIFFUSE_KM[0], DIFFUSE_KM[1]) / (1.772454 * DIFFUSE_KM[1]),
    redGlow: layerMean(hKm, dh, RED_GLOW_KM[0], RED_GLOW_KM[1], RED_GLOW_KM[2]) / RED_GLOW_NORM
  }
}

// --- The march, in TypeScript (mirrors GLSL below line for line) ----------

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}
/** The noise cells' hash (skyMirror.ts hashCell: bit for bit the shader's,
 * so the mirror sees the shader's own folds, patches and rays). */
function auHash(x: number, seed: number): number {
  return hashCell(seedInt(seed), x)
}
function auNoise(x: number, seed: number): number {
  const i = Math.floor(x)
  const t = x - i
  return auHash(i, seed) + (auHash(i + 1, seed) - auHash(i, seed)) * t * t * (3 - 2 * t)
}
function auFbm(x: number, seed: number): number {
  return 0.5 * auNoise(x, seed) + 0.3 * auNoise(x * 2.3 + 5, seed) + 0.2 * auNoise(x * 5.1 + 9, seed)
}

/** The arcs' footprint at (across, along) km from the camera, per arc
 * column: `width` the sheet's width at this sample (km), `dy` how far the
 * sample moves along the arcs between layers (rays finer than that can't be
 * sampled: keep their mean). */
function footprint(a: AuroraParams, x: number, y: number, width: number, dy: number, soft: number, redWidth: number): Vec3 {
  let sum = 0
  let sumSoft = 0
  let sumRed = 0
  for (let i = 0; i < 4; i++) {
    const arc = a.arcs[i]
    if (arc == null) break
    const centre = arc[0] + a.foldKm[0] * (auFbm(y / a.foldKm[1] + i * 3.7, a.seed) - 0.5) * 2
    const d = (x - centre) / width
    const period = 1.5 + i
    const fine = 0.45 + 0.55 * auNoise(y / period + i * 11, a.seed)
    // Sampled under two per period they alias: keep only their mean.
    const rays = RAY_MEAN + (fine - RAY_MEAN) * (1 - smooth(0.5, 1, dy / period))
    const patchy = smooth(a.patchy, a.patchy + 0.4, auFbm(y / (a.foldKm[1] * 1.7) + i * 5.3, a.seed))
    const ds = (x - centre) / soft
    const dr = (x - centre) / redWidth
    const w = arc[1] * rays * patchy
    sum += w * Math.exp(-d * d)
    // The type-B border: the brightest arc only.
    if (i === 0) sumSoft += w * Math.exp(-ds * ds)
    sumRed += w * Math.exp(-dr * dr)
  }
  return [sum, sumSoft, sumRed]
}

/** Inside the oval (0–1), with soft edges; km poleward of the camera. */
function insideOval(a: AuroraParams, x: number): number {
  const [e, p] = [(a.edgeLat - a.observerLat) * 111, (a.polewardLat - a.observerLat) * 111]
  const soft = 0.15 * (p - e)
  return smooth(e, e + soft, x) * (1 - smooth(p - soft, p, x))
}
/** Where the storm red glow lies (0–1): from ~3° equatorward of the oval
 * (SAR arcs, stable red) over the oval, fading poleward. */
function redGlowShape(a: AuroraParams, x: number): number {
  const [e, p] = [(a.edgeLat - a.observerLat) * 111, (a.polewardLat - a.observerLat) * 111]
  const soft = 0.15 * (p - e)
  return smooth(e - 450, e - 150, x) * (1 - smooth(p - soft, p, x)) * (1 - 0.6 * smooth(e, p, x))
}

/**
 * The aurora's radiance toward a direction: `azDeg` from the geomagnetic
 * pole (+ toward magnetic east), `elDeg` above the horizon; luminance-
 * normalised RGB in kR (× 1000 RAYLEIGH_CD for cd/m²), before the air's
 * extinction. `jitter`: the per-pixel offset of the layers (0–1).
 */
export function auroraRay(a: AuroraParams, azDeg: number, elDeg: number, jitter = 0.5): Vec3 {
  if (elDeg <= 0) return [0, 0, 0]
  const [ce, se, ca, sa] = [Math.cos(elDeg * DEG), Math.sin(elDeg * DEG), Math.cos(azDeg * DEG), Math.sin(azDeg * DEG)]
  // Local frame: up z, pole x, y along the arcs as the shader's
  // `cross(up, pole)`, which points 90° left of the pole (azimuth − 90°):
  // a direction `azDeg` right of the pole has y = −cos(el) sin(az).
  const dir: Vec3 = [ce * ca, -ce * sa, se]
  const r = EARTH_KM + 0.002
  const out: Vec3 = [0, 0, 0]
  const [G, R, F] = [AURORA_COLOURS.green, AURORA_COLOURS.red, AURORA_COLOURS.fringe]
  const lean = 1 / Math.tan(a.dipDeg * DEG)
  for (let i = 0; i < AURORA_LAYERS; i++) {
    const h = BOTTOM_KM + (i + jitter) * DH
    const shell = EARTH_KM + h
    const bq = r * dir[2]
    const t = -bq + Math.sqrt(Math.max(bq * bq - r * r + shell * shell, 0))
    const p: Vec3 = [dir[0] * t, dir[1] * t, r + dir[2] * t]
    // Sample the curtains at the foot (110 km) of this point's field line:
    // higher up it lies equatorward of its foot.
    const x = p[0] + (h - 110) * lean
    const y = p[1]
    const n = Math.hypot(...p)
    const sinEl = Math.max((dir[0] * p[0] + dir[1] * p[1] + dir[2] * p[2]) / n, 0.02)
    const path = DH / sinEl
    const dy = Math.abs(dir[1]) * path
    // Between layers the foot moves across by the ray's own step and the
    // field's lean.
    const step = Math.abs(dir[0] * path + DH * lean) + (FOLD_SLOPE * a.foldKm[0] / a.foldKm[1]) * dy
    const width = Math.max(ARC_KM, step)
    const soft = Math.max(width, 2 * step)
    const redWidth = Math.max(RED_KM, step)
    const [sharp, blurred, wide] = footprint(a, x, y, width, dy, soft, redWidth)
    const arcs = sharp * (ARC_KM / width)
    const fringeArcs = blurred * (ARC_KM / soft)
    const redArcs = wide * (ARC_KM / redWidth)
    const pr = profiles(h)
    const diffuse = DIFFUSE * insideOval(a, x) * pr.diffuse
    const green = (1 - a.red - a.fringe) * pr.green * arcs + diffuse
    const red = a.red * pr.red * redArcs + (a.redGlowKR / a.strengthKR) * redGlowShape(a, x) * pr.redGlow
    const fringe = a.fringe * pr.fringe * fringeArcs
    for (let c = 0; c < 3; c++) out[c] += (green * G[c] + red * R[c] + fringe * F[c]) * path * a.strengthKR
  }
  return out
}

/** The aurora's radiance toward a direction through the air (RGB, cd/m²
 * of luminance-normalised colour): the shader's `colour × transmittance`. */
export function auroraThroughAir(a: AuroraParams, azDeg: number, elDeg: number, jitter = 0.5): Vec3 {
  const c = auroraRay(a, azDeg, elDeg, jitter)
  const T = airTransmittance(elDeg)
  return [0, 1, 2].map(k => c[k] * T[k] * 1000 * RAYLEIGH_CD) as Vec3
}
/** The aurora's luminance (cd/m²) toward a direction: `azDeg` from the
 * geomagnetic pole. Compare with nightGlow.ts `nightSkyCd`. */
export function auroraCd(a: AuroraParams, azDeg: number, elDeg: number, jitter = 0.5): number {
  return luminance(auroraThroughAir(a, azDeg, elDeg, jitter))
}
/** The same toward a world direction (skyMirror.ts lines). */
export function auroraCdToward(a: AuroraParams, dir: Vec3, jitter = 0.5): number {
  const az = Math.atan2(dir[0], -dir[2]) / DEG - a.poleAzimuthDeg
  return auroraCd(a, az, Math.asin(Math.max(-1, Math.min(1, dir[1]))) / DEG, jitter)
}

/** Light the display sheds on level ground (lux, RGB in the lines'
 * colours): the march integrated over the sky, cos-weighted (24 azimuths ×
 * 10 elevations, a few ms once per render). */
export function auroraLux(a: AuroraParams): Vec3 {
  const [nAz, nEl] = [24, 10]
  const out: Vec3 = [0, 0, 0]
  const dAz = (2 * Math.PI) / nAz
  const dEl = (Math.PI / 2) / nEl
  for (let j = 0; j < nEl; j++) {
    const el = (j + 0.5) * dEl
    const w = Math.sin(el) * Math.cos(el) * dEl * dAz
    for (let i = 0; i < nAz; i++) {
      const c = auroraThroughAir(a, ((i + 0.5) * dAz) / DEG, el / DEG)
      for (let k = 0; k < 3; k++) out[k] += c[k] * w
    }
  }
  return out
}

// --- The march in the sky shader ------------------------------------------

const f = (x: number): string => x.toFixed(5)
const vec = (c: Vec3): string => `vec3(${c.map(f).join(', ')})`

const GLSL = /* glsl */ `
uniform vec4 auroraA; // pole direction (ECEF, horizontal, unit), radiance scale (render units per kR)
uniform vec4 auroraB; // the oval's equatorward and poleward edges (km poleward of the camera), red share, fringe share
uniform vec4 auroraC; // fold amplitude (km), fold wavelength (km), seed (integer), strength (kR)
uniform vec4 auroraD; // the arcs' positions (km poleward of the camera)
uniform vec4 auroraE; // the arcs' strengths (0: none)
uniform vec4 auroraF; // red glow (column ÷ strength), the field's lean (1 / tan dip), 0, 0
uniform float auroraPatchy;

${hashGlsl('au')}
// An integer hash (skyMirror.ts): aurora.ts auHash matches it bit for bit.
float auHash(float x) { return auHash1(x, auroraC.z); }
float auNoise(float x) {
  float i = floor(x);
  float t = fract(x);
  return mix(auHash(i), auHash(i + 1.0), t * t * (3.0 - 2.0 * t));
}
float auFbm(float x) {
  return 0.5 * auNoise(x) + 0.3 * auNoise(x * 2.3 + 5.0) + 0.2 * auNoise(x * 5.1 + 9.0);
}
float auErf(float x) {
  float x2 = x * x;
  return sign(x) * sqrt(1.0 - exp(-x2 * (1.27324 + 0.147 * x2) / (1.0 + 0.147 * x2)));
}
// A profile's mean over the layer (aurora.ts layerMean).
float auLayer(float h, float dh, float c, float lo, float hi) {
  float a = h - 0.5 * dh;
  float b = h + 0.5 * dh;
  float sum = 0.0;
  if (a < c) sum += 0.886227 * lo * (auErf((min(b, c) - c) / lo) - auErf((a - c) / lo));
  if (b > c) sum += 0.886227 * hi * (auErf((b - c) / hi) - auErf((max(a, c) - c) / hi));
  return sum / dh;
}

// The arcs' footprint at (across, along) km from the camera (aurora.ts
// footprint): folded sheets, vertical rays (their mean where the samples
// step past them), patchy along their length.
vec3 auroraFootprint(float x, float y, float width, float dy, float soft, float redWidth) {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    float w = auroraE[i];
    if (w <= 0.0) break;
    float fi = float(i);
    float centre = auroraD[i] + auroraC.x * (auFbm(y / auroraC.y + fi * 3.7) - 0.5) * 2.0;
    float d = (x - centre) / width;
    float period = 1.5 + fi;
    float fine = 0.45 + 0.55 * auNoise(y / period + fi * 11.0);
    float rays = mix(fine, ${f(RAY_MEAN)}, smoothstep(0.5, 1.0, dy / period));
    float patchy = smoothstep(auroraPatchy, auroraPatchy + 0.4, auFbm(y / (auroraC.y * 1.7) + fi * 5.3));
    float ds = (x - centre) / soft;
    float dr = (x - centre) / redWidth;
    // The type-B border: the brightest arc only.
    sum += w * rays * patchy * vec3(exp(-d * d), i == 0 ? exp(-ds * ds) : 0.0, exp(-dr * dr));
  }
  return sum;
}

vec3 aurora(vec3 radiance, const vec3 transmittance, const vec3 cameraPosition, const vec3 rayDirection) {
  float r = length(cameraPosition);
  vec3 up = cameraPosition / r;
  float mu = dot(up, rayDirection);
  if (RayIntersectsGround(ATMOSPHERE, r, mu)) return radiance;
  vec3 pole = auroraA.xyz;
  // Along the arcs, 90° left of the pole (aurora.ts auroraRay's y).
  vec3 east = normalize(cross(up, pole));
  // One offset of the layers per pixel: what aliasing is left becomes
  // grain, not stripes. Interleaved gradient noise (Jimenez 2014): sin()
  // hashes of pixel coordinates lose precision in float32 and pattern.
  float jitter = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
  float ovalSoft = 0.15 * (auroraB.y - auroraB.x);
  vec3 colour = vec3(0.0);
  float dh = ${f(DH)};
  float bq = dot(cameraPosition, rayDirection);
  for (int i = 0; i < ${AURORA_LAYERS}; i++) {
    float h = ${f(BOTTOM_KM)} + (float(i) + jitter) * dh;
    float shell = ATMOSPHERE.bottom_radius + h;
    float t = -bq + sqrt(max(bq * bq - dot(cameraPosition, cameraPosition) + shell * shell, 0.0));
    vec3 p = cameraPosition + rayDirection * t;
    vec3 v = p - cameraPosition;
    // At the foot (110 km) of this point's field line (aurora.ts auroraRay).
    float x = dot(v, pole) + (h - 110.0) * auroraF.y;
    float y = dot(v, east);
    // The slant path through this layer. Neighbouring layers' samples land
    // that far apart along the arcs and across them, the folds' drift
    // included: a thin sheet is widened to that so it is neither missed nor
    // banded (its light is kept).
    float sinEl = max(dot(rayDirection, normalize(p)), 0.02);
    float path = dh / sinEl;
    float dy = abs(dot(rayDirection, east)) * path;
    float step = abs(dot(rayDirection, pole) * path + dh * auroraF.y) + ${f(FOLD_SLOPE)} * auroraC.x / auroraC.y * dy;
    float width = max(${f(ARC_KM)}, step);
    // The fringe lives in one layer's height: on a sheet as sharp as the
    // step it lands on or off by chance (grain); give it a softer one.
    float soft = max(width, 2.0 * step);
    float redWidth = max(${f(RED_KM)}, step);
    vec3 sheets = auroraFootprint(x, y, width, dy, soft, redWidth);
    float arcs = sheets.x * (${f(ARC_KM)} / width);
    float fringeArcs = sheets.y * (${f(ARC_KM)} / soft);
    float redArcs = sheets.z * (${f(ARC_KM)} / redWidth);
    float inside = smoothstep(auroraB.x, auroraB.x + ovalSoft, x) * (1.0 - smoothstep(auroraB.y - ovalSoft, auroraB.y, x));
    // The storm red glow (aurora.ts redGlowShape).
    float glow = auroraF.x > 0.0
      ? auroraF.x * smoothstep(auroraB.x - 450.0, auroraB.x - 150.0, x) * (1.0 - smoothstep(auroraB.y - ovalSoft, auroraB.y, x))
        * (1.0 - 0.6 * smoothstep(auroraB.x, auroraB.y, x))
        * auLayer(h, dh, ${f(RED_GLOW_KM[0])}, ${f(RED_GLOW_KM[1])}, ${f(RED_GLOW_KM[2])}) / ${f(RED_GLOW_NORM)}
      : 0.0;
    float g = auLayer(h, dh, 110.0, 9.0, 35.0) / ${f(0.886227 * 44)};
    float red = auLayer(h, dh, ${f(RED_KM_PROFILE[0])}, ${f(RED_KM_PROFILE[1])}, ${f(RED_KM_PROFILE[2])}) / ${f(RED_NORM)};
    float fringe = auroraB.w > 0.0 ? auLayer(h, dh, 97.0, 5.0, 5.0) / ${f(1.772454 * 5)} : 0.0;
    float diffuse = ${f(DIFFUSE)} * inside * auLayer(h, dh, ${f(DIFFUSE_KM[0])}, ${f(DIFFUSE_KM[1])}, ${f(DIFFUSE_KM[1])}) / ${f(1.772454 * DIFFUSE_KM[1])};
    vec3 e = ((1.0 - auroraB.z - auroraB.w) * g * arcs + diffuse) * ${vec(AURORA_COLOURS.green)}
      + (auroraB.z * red * redArcs + glow) * ${vec(AURORA_COLOURS.red)}
      + auroraB.w * fringe * fringeArcs * ${vec(AURORA_COLOURS.fringe)};
    colour += e * path;
  }
  // The air in front dims it like a star.
  return radiance + colour * auroraC.w * auroraA.w * transmittance;
}
`

/** Render units per kR of green line, for the sky as drawn. */
export function auroraScale(renderPerLux: number): number {
  return 1000 * RAYLEIGH_CD * renderPerLux
}

/** Patch a sky material (main or cube) with tonight's aurora. Call it
 * before the night glow's patch, so its line runs after the glow's (on a
 * starlit night the glow replaces the sky first). */
export function patchSkyAurora(material: SkyMaterial, a: AuroraParams, worldToECEF: Matrix4, scale: number): void {
  const az = a.poleAzimuthDeg * DEG
  const pole = new Vector3(Math.sin(az), 0, -Math.cos(az)).transformDirection(worldToECEF)
  const arc = (i: number): [number, number] => a.arcs[i] ?? [0, 0]
  Object.assign(material.uniforms, {
    auroraA: new Uniform(new Vector4(pole.x, pole.y, pole.z, scale)),
    auroraB: new Uniform(new Vector4((a.edgeLat - a.observerLat) * 111, (a.polewardLat - a.observerLat) * 111, a.red, a.fringe)),
    auroraC: new Uniform(new Vector4(a.foldKm[0], a.foldKm[1], seedInt(a.seed), a.strengthKR)),
    auroraD: new Uniform(new Vector4(arc(0)[0], arc(1)[0], arc(2)[0], arc(3)[0])),
    auroraE: new Uniform(new Vector4(arc(0)[1], arc(1)[1], arc(2)[1], arc(3)[1])),
    auroraF: new Uniform(new Vector4(a.redGlowKR / a.strengthKR, 1 / Math.tan(a.dipDeg * DEG), 0, 0)),
    auroraPatchy: new Uniform(a.patchy)
  })
  const source = material.fragmentShader
  const call = /(vec3 radiance = GetSkyRadiance\([^;]*\);)/
  if (!source.includes('vec3 getSkyRadiance(') || !call.test(source)) {
    throw new Error('patchSkyAurora: the sky shader has changed; update the patch')
  }
  material.fragmentShader = source
    .replace('vec3 getSkyRadiance(', `${GLSL}\nvec3 getSkyRadiance(`)
    .replace(call, '$1\n  radiance = aurora(radiance, transmittance, cameraPosition, rayDirection);')
  material.needsUpdate = true
}
