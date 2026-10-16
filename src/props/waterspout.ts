import { Color, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three'

import type { Biome } from '../biome'
import type { OceanName } from '../oceans'
import { dirFromAzEl, type TimeOfDay, type WeatherKind } from '../params'
import type { Random } from '../random'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { noise3 } from './noise'
import { SprayBuilder } from './surf'
import { windDirection } from './wind'

// Waterspouts (tuba): a thin funnel from the flat base of a towering cumulus
// line down to the sea, with a ring of spray (the "cascade") where it
// touches. Fair-weather spouts are the common kind: warm shallow sea, light
// wind, summer; tornadic ones come out of thunderstorms.
//
// Where and when (NWS Key West; Sioutas, Aegean 1957–2012; Balearics
// 1989–2020; Croatian Adriatic 2001–2011):
// - Florida Keys and the Bahamas: the world's hotspot, May–October, peak in
//   August; tens a year.
// - Mediterranean: autumn, when the sea is still warm under the first cold
//   air: 65% of Balearic spouts in Sep–Nov, September the most; the Aegean
//   peaks Sep–Oct.
// - Other tropical seas: in the wet season, less often reported.
// Funnels are 3–100 m wide (most 10–50 m) and reach the cloud base,
// ~600–900 m up; each lasts 5–20 minutes.

type BiomeName = Biome['name']

export type WaterspoutKind = 'fair-weather' | 'tornadic'

export interface WaterspoutParams {
  kind: WaterspoutKind
  /** Azimuth from the camera (deg, world) and distance (m). */
  bearingDeg: number
  distanceM: number
  /** Funnel width near the sea and at the cloud base (m). */
  widthM: number
  cloudBaseM: number
  seed: number
}

/** Chance on a day that suits them, by coast and month (1-based). */
export function waterspoutChance(biome: BiomeName, ocean: OceanName, month: number): number {
  if (biome === 'tropical') {
    // Keys and Bahamas: May–Oct, August the peak; elsewhere a smaller,
    // flatter wet-season rate.
    if (ocean === 'atlantic') return month === 8 ? 0.06 : month >= 5 && month <= 10 ? 0.035 : 0.004
    return month >= 5 && month <= 11 ? 0.012 : 0.004
  }
  if (biome === 'mediterranean') return month === 9 ? 0.04 : month === 10 || month === 11 || month === 8 ? 0.02 : 0.002
  return 0
}

/**
 * Whether today's sky has a waterspout. Fair-weather ones need a day sky
 * with cumulus building (scattered or broken), light wind (< 8 m/s) and a
 * warm sea; tornadic ones hang from a storm. `force`: null/false none,
 * true one of the usual kind, a kind that kind.
 */
export function waterspoutFor(
  day: {
    biome: BiomeName
    ocean: OceanName
    month: number
    timeOfDay: TimeOfDay
    weather: WeatherKind
    windSpeed: number
    headingDeg: number
    halfFovDeg: number
    fog: boolean
  },
  rng: Random,
  force?: WaterspoutKind | boolean | null
): WaterspoutParams | null {
  const daylight = day.timeOfDay === 'daylight' || day.timeOfDay === 'midday' || day.timeOfDay === 'golden-hour'
  const storm = day.weather === 'storm'
  const suits = daylight && !day.fog && (storm || ((day.weather === 'scattered' || day.weather === 'broken') && day.windSpeed < 8))
  const chance = waterspoutChance(day.biome, day.ocean, day.month) * (storm ? 0.3 : 1)
  // Same draws whatever is forced.
  const drawn = suits && rng.float() < chance
  const kindDraw: WaterspoutKind = storm ? 'tornadic' : 'fair-weather'
  const offset = rng.range(-0.6, 0.6)
  const distanceM = 2000 * Math.exp(rng.range(0, Math.log(4)))
  const width = rng.range(0, 1)
  const cloudBaseM = rng.range(650, 900)
  const seed = rng.range(0, 1000)
  if (force === null || force === false || (force === undefined && !drawn)) return null
  const kind = typeof force === 'string' ? force : kindDraw
  return {
    kind,
    bearingDeg: day.headingDeg + offset * day.halfFovDeg,
    distanceM,
    // Most fair-weather funnels are 10–50 m; tornadic ones wider.
    widthM: kind === 'tornadic' ? 30 + width * 50 : 10 + width * width * 40,
    cloudBaseM,
    seed
  }
}

type RGB = [number, number, number]

/** The funnel, from the sea (y = 0, at the origin) up into the cloud base:
 * slightly curved (bent by the wind shear and leaning downwind), widening
 * into the cloud, with spiral striations so it doesn't read as a pipe. */
export function funnelGeometry(spout: WaterspoutParams, lean: Vector3, rng: Random): MeshBuilder {
  const b = new MeshBuilder()
  const top = spout.cloudBaseM + 60
  const steps = 48
  const bow = rng.range(-0.08, 0.08) * top
  const side = new Vector3(-lean.z, 0, lean.x)
  const path: Vector3[] = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const y = t * top
    path.push(
      new Vector3()
        .addScaledVector(lean, 0.15 * top * t * t)
        .addScaledVector(side, bow * Math.sin(Math.PI * t))
        .setY(y)
    )
  }
  const r0 = spout.widthM / 2
  const tornadic = spout.kind === 'tornadic'
  const cloud: RGB = tornadic ? [0.24, 0.25, 0.27] : [0.38, 0.39, 0.41]
  const base: RGB = tornadic ? [0.26, 0.27, 0.29] : [0.46, 0.48, 0.51]
  const rings = b.tube(
    path,
    (t, angle) => {
      // Narrowest a little above the sea, widening gently into the cloud.
      const flare = 1 + 1.8 * t ** 3
      const neck = 0.85 + 0.15 * Math.abs(t - 0.15)
      const ribs = 1 + 0.06 * Math.sin(angle * 3 + t * 40 + spout.seed)
      return r0 * flare * neck * ribs
    },
    (t, angle) => {
      // Spiral bands of denser condensation; a little lighter toward the base.
      const band = 0.9 + 0.1 * Math.sin(angle * 2 - t * 60 + spout.seed) + 0.08 * noise3(t * 30, angle, 0, spout.seed)
      const k = band * (1.05 - 0.15 * t)
      // Merging into the shaded cloud base at the top.
      const merge = Math.min(1, Math.max(0, (t - 0.75) / 0.25)) * 0.6
      return [base[0] * k * (1 - merge) + cloud[0] * merge, base[1] * k * (1 - merge) + cloud[1] * merge, base[2] * k * (1 - merge) + cloud[2] * merge]
    },
    16
  )
  b.cap(rings[0], new Vector3(0, -1, 0), base)
  return b
}

/** The cascade: a ring of spray round the foot, wider than the funnel. */
function spray(spout: WaterspoutParams, rng: Random): SprayBuilder {
  const s = new SprayBuilder()
  const r = Math.max(12, spout.widthM * 1.8)
  for (let i = 0; i < 500; i++) {
    const angle = rng.range(0, Math.PI * 2)
    const d = r * (0.6 + 0.6 * rng.float())
    const h = rng.float() ** 1.6 * r * 1.6
    s.add(new Vector3(Math.cos(angle) * d, h, Math.sin(angle) * d), rng.range(4, 12) * (1 + h / r), rng.range(0.25, 0.6) * (1 - 0.5 * h / (r * 1.6)))
  }
  return s
}

/** The lowered, flat base of the parent cloud the funnel hangs from (the
 * volumetric deck may have a gap right there): soft grey puffs. */
function cloudBase(spout: WaterspoutParams, top: Vector3, rng: Random): SprayBuilder {
  const s = new SprayBuilder()
  const radius = Math.max(250, spout.widthM * 8)
  for (let i = 0; i < 900; i++) {
    const angle = rng.range(0, Math.PI * 2)
    const d = radius * Math.sqrt(rng.float())
    // Flat underneath, lumpy above, lowest round the funnel, thinning to
    // nothing at the rim; shaded grey like the deck's base.
    const lowering = 60 * (1 - d / radius)
    const y = top.y - lowering + rng.float() ** 2 * 220
    s.add(new Vector3(top.x + Math.cos(angle) * d, y, top.z + Math.sin(angle) * d), rng.range(50, 130), rng.range(0.35, 0.7) * (1 - d / radius) ** 0.8)
  }
  return s
}

export function createWaterspout(ctx: PropContext): Object3D[] {
  const spout = ctx.params.waterspout
  if (spout == null) return []
  const rng = ctx.rng('waterspout')
  const camera = ctx.camera.position
  // Over open water in the frame: from the drawn spot, nearer and farther,
  // and across the frame until one fits.
  let foot: Vector3 | null = null
  for (let i = 0; i < 40 && foot == null; i++) {
    const distance = i === 0 ? spout.distanceM : spout.distanceM * rng.range(0.4, 1.6)
    const bearing = i === 0 ? spout.bearingDeg : spout.bearingDeg + rng.normal(0, 8)
    const [dx, , dz] = dirFromAzEl(bearing, 0)
    const p = new Vector3(camera.x + dx * distance, 0, camera.z + dz * distance)
    if (ctx.ground(p.x, p.z) < -2 && ctx.inFrame(p.x, spout.cloudBaseM * 0.4, p.z, 0.85)) foot = p
  }
  if (foot == null) return []
  const lean = windDirection(ctx.params).setY(0).normalize()
  const funnel = new Mesh(
    funnelGeometry(spout, lean, rng).build(),
    new MeshStandardMaterial({ vertexColors: true, roughness: 1 })
  )
  funnel.position.copy(foot).setY(ctx.seaLevel(foot.x, foot.z) - 1)
  funnel.castShadow = false
  funnel.receiveShadow = false
  funnel.frustumCulled = false
  const objects: Object3D[] = [funnel]
  const top = foot.clone().addScaledVector(lean, 0.15 * spout.cloudBaseM).setY(spout.cloudBaseM)
  const base = cloudBase(spout, top, rng).build(spout.kind === 'tornadic' ? new Color(0.24, 0.25, 0.27) : new Color(0.38, 0.39, 0.41), false)
  if (base != null) objects.push(base)
  const points = spray(spout, rng).build(new Color(0.9, 0.9, 0.9), false)
  if (points != null) {
    points.position.copy(funnel.position)
    objects.push(points)
  }
  return objects
}
