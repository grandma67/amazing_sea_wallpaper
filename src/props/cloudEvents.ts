import { DoubleSide, MathUtils, Mesh, MeshStandardMaterial, Vector3, type Object3D } from 'three'

import { cloudBase } from '../cloudTypes'
import { dirFromAzEl } from '../params'
import type { RollCloudParams, ShelfCloudParams } from '../skyEvents'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'
import { curvatureDrop } from './landforms'
import { fbm3 } from './noise'

// Cloud events drawn as opaque meshes (skyEvents.ts chooses them): a mesh
// can't be see-through here (it wouldn't composite with the volumetric
// clouds and haze), so they're solid, vertex-coloured, lit by the sun and
// faded with distance by aerial perspective.

type RGB = [number, number, number]

/** Share of the sky light a shelf cloud gets under its storm's deck. */
export const SHELF_SKY_OPEN = 0.35

/** Grey of value v in the storm's blue: lit by the sky under the deck, the
 * face reads in the deck's own hue (measured on 2016-06-21: deck B/R 1.5;
 * a neutral albedo gave 1.17, a brown band under a blue storm). */
const tint = (v: number): RGB => [v * 0.86, v * 0.96, v * 1.18]

/**
 * The shelf: a long wedge across the view along the storm's gust front.
 * Seen from ahead (photos in knowledge/CLOUDS.md "Shelf cloud"): a
 * rounded, scalloped lip a few hundred metres up, the smooth face above it
 * rising in tiers that come and go along the front, finely striated where the
 * air is drawn up over the cold pool, fading at the top into the storm's base;
 * under the lip a dark, ragged underside sloping up into the storm.
 *
 * A sheet of cross-sections (stations) along the front, bowed toward the
 * camera in the middle. Stations are packed where the front is nearest the
 * camera (~20 m apart there, ~350 m at the ends 40 km off), so lumps a few
 * hundred metres wide stay smooth in frame.
 */
export function shelfGeometry(shelf: ShelfCloudParams, toStorm: Vector3, origin: Vector3, base: number): MeshBuilder {
  const b = new MeshBuilder()
  const across = new Vector3(-toStorm.z, 0, toStorm.x)
  const seed = shelf.seed
  const D = shelf.depthM
  const half = 40_000
  const stations = 480
  // Rows across: underside (far back → lip), the lip's rounded nose, the face
  // (lip → top), the top running back into the storm.
  const UNDER = 24
  const NOSE = 4
  const FACE = 30
  const BACK = 4
  const rows: number[][] = []
  for (let k = 0; k <= stations; k++) {
    const u = (2 * k) / stations - 1
    const s = half * (0.15 * u + 0.85 * u * u * u)
    // Along the front: the lip rises and falls, bows toward the camera in
    // the middle and wanders in scallops of a few hundred metres to kilometres.
    const h = shelf.lipHeightM * (1 + 0.24 * (fbm3(s / 5000, 1.5, 0.5, seed) - 0.5) + 0.12 * (fbm3(s / 1200, 4.5, 0.5, seed) - 0.5))
    const top = Math.max(h + 150, base + 60) + 40 * (fbm3(s / 2500, 2.5, 0.5, seed) - 0.5)
    const rise = top - h
    const bow = -1500 * (1 - (s / half) ** 2)
    const wobble = 350 * (fbm3(s / 6000, 0.5, 0.5, seed) - 0.5) + 160 * (fbm3(s / 900, 3.5, 0.5, seed) - 0.5)
    // The face runs back as it rises (a wedge), more where it has more tiers.
    const run = shelf.tiers * 400 + 500
    // Each tier: where it sits up the face (t) and how strong it is here; tiers
    // fade out and merge along the front.
    const tiers = Array.from({ length: shelf.tiers }, (_, i) => ({
      // Tiers climb and sink along the front, and fade in and out, so no
      // band runs straight across the frame (a front 6 km off spans ~8 km).
      t: (i + 0.6) / (shelf.tiers + 0.6) + 0.22 * (fbm3(s / 1600, 5 + i, 0.5, seed) - 0.5),
      strength: MathUtils.smoothstep(fbm3(s / 1800, 9 + i, 0.5, seed), 0.38, 0.62)
    }))
    const row: number[] = []
    const add = (back: number, up: number, colour: RGB, rough: number) => {
      // Lumps over the whole sheet, larger where the cloud is turbulent.
      const lump = rough * (fbm3(s / 450, up / 160, back / 450, seed + 7) - 0.5) + 2 * rough * (fbm3(s / 1400, up / 400, 0.5, seed + 8) - 0.5)
      const p = origin
        .clone()
        .addScaledVector(across, s)
        .addScaledVector(toStorm, back + bow + wobble + lump)
      p.y = up - curvatureDrop(p.x - origin.x, p.z - origin.z)
      const shade = 0.93 + 0.14 * fbm3(s / 1200, up / 300, back / 1500, seed + 3)
      row.push(b.vertex(p, [colour[0] * shade, colour[1] * shade, colour[2] * shade]))
    }
    // Underside: from deep in the storm, sloping down to the lip; dark, with
    // ragged scud hanging from it (deeper toward the lip).
    for (let j = 0; j < UNDER; j++) {
      const f = 1 - j / UNDER
      const back = 60 + (D - 60) * f ** 1.4
      const rag = 90 * Math.max(0, fbm3(s / 350, back / 350, 0.5, seed + 11) - 0.45) * (1 - f) ** 0.5
      const up = h + 15 + rise * 0.75 * f ** 1.3 - rag
      const v = 0.12 + 0.2 * (1 - f) ** 2
      add(back, up, tint(v), 120)
    }
    // The lip's nose: rounded, a little forward of the face, the brightest part.
    for (let j = 0; j < NOSE; j++) {
      const a = (Math.PI * (j + 0.5)) / NOSE
      add(-25 * Math.sin(a), h + 25 - 25 * Math.cos(a), tint(0.6), 30)
    }
    // Face: terraces at each tier (a step back, with a rounded bulge above a
    // darker groove), fine striations, fading to the storm's grey at the top.
    for (let j = 1; j <= FACE; j++) {
      const t = j / FACE
      let back = run * (0.25 * t + 0.75 * t ** 1.6)
      let tone = 1
      for (const tier of tiers) {
        const d = (t - tier.t) / 0.05
        // Seen from below, a tier is a rounded bulge over a shaded groove;
        // a gentle step (a sharp one hid the ledge from below and drew a
        // hard line across the frame, like stacked boards).
        back += tier.strength * 70 * MathUtils.smoothstep(d, -1.5, 1)
        back -= tier.strength * 35 * Math.exp(-((d - 1.2) ** 2))
        tone *= 1 - tier.strength * 0.3 * Math.exp(-((d - 0.2) ** 2)) + tier.strength * 0.1 * Math.exp(-((d - 1.4) ** 2))
      }
      const up = h + rise * t
      // Bands ~30 m apart that drift up and down along the front.
      const stria = 1 + 0.06 * Math.sin(((up - h) / 30) * 2 * Math.PI + 14 * fbm3(s / 2500, 13, 0.5, seed)) * (1 - t)
      const fade = MathUtils.smoothstep(t, 0.55, 1)
      const v = (0.56 * (1 - fade) + 0.26 * fade) * tone * stria
      add(back, up, tint(v), 90)
    }
    // Top: back into the storm at the deck's own colour, so the edge where
    // the face meets the deck doesn't read. (Running the face on up into
    // the deck instead showed through it: the deck's underside is thin.)
    for (let j = 1; j <= BACK; j++) {
      const f = j / BACK
      add(run + (D - run) * f, top + 30 * f, tint(0.26), 80)
    }
    rows.push(row)
  }
  for (let k = 0; k < stations; k++)
    for (let j = 0; j < rows[k].length - 1; j++) b.quad(rows[k][j], rows[k + 1][j], rows[k + 1][j + 1], rows[k][j + 1])
  return b
}

export function createShelfCloud(ctx: PropContext): Object3D[] {
  const shelf = ctx.params.storm?.shelf
  if (shelf == null) return []
  const [dx, , dz] = dirFromAzEl(shelf.azimuthDeg, 0)
  const toStorm = new Vector3(dx, 0, dz)
  const origin = ctx.camera.position.clone().setY(0).addScaledVector(toStorm, shelf.distanceM)
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 1, side: DoubleSide })
  // The shelf sits under the storm: sunlight from beyond the storm would have
  // to cross it, so only a sun on the viewer's side lights the shelf (the
  // classic bright face). With the sun behind the storm its flat upper tiers
  // caught grazing light and glowed pink over a dark storm.
  const sun = new Vector3(...ctx.params.sunDirection).setY(0).normalize()
  const sunReach = 1 - MathUtils.smoothstep(sun.dot(toStorm), -0.3, 0.2)
  // Sky light: the storm's deck hides the sky above, so the shelf sees only
  // the open sky ahead of the storm (about a third of the dome). With the
  // whole dome it was twice as bright as the deck over it; in photos the
  // face is about as bright as the deck's base, the lip a little brighter.
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      `#include <lights_fragment_end>\nreflectedLight.directDiffuse *= ${sunReach.toFixed(3)};\nreflectedLight.directSpecular *= ${sunReach.toFixed(3)};\nreflectedLight.indirectDiffuse *= ${SHELF_SKY_OPEN.toFixed(3)};`
    )
  }
  const mesh = new Mesh(shelfGeometry(shelf, toStorm, origin, cloudBase(ctx.params.weather.formations, 'cumulonimbus')).build(), material)
  mesh.frustumCulled = false
  // Cloud-like: the sky cube mirrors clouds, so the planar mirror leaves it out.
  mesh.userData.skyLike = true
  return [mesh]
}

/**
 * Morning Glory: one to three long tubes of cloud lying across the view,
 * kilometres long, ~1 km thick, base a few hundred metres up. A smooth,
 * lumpy roll, lit on top and shaded underneath, with a ragged flatter base.
 */
export function rollGeometry(roll: RollCloudParams, axis: Vector3, centre: Vector3): MeshBuilder {
  const b = new MeshBuilder()
  const toBack = new Vector3(axis.z, 0, -axis.x)
  for (let k = 0; k < roll.rolls; k++) {
    const r = (roll.diameterM / 2) * (1 - k * 0.15)
    const mid = centre.clone().addScaledVector(toBack, k * roll.spacingM)
    const half = 45_000
    const steps = 240
    const path: Vector3[] = []
    for (let i = 0; i <= steps; i++) {
      const s = -half + (2 * half * i) / steps
      const p = mid.clone().addScaledVector(axis, s).addScaledVector(toBack, 600 * (fbm3(s / 9000, k, 0.5, roll.seed) - 0.5))
      p.y = roll.baseM + r + 120 * (fbm3(s / 4000, k + 3, 0.5, roll.seed) - 0.5) - curvatureDrop(p.x - centre.x, p.z - centre.z)
      path.push(p)
    }
    const rings = b.tube(
      path,
      (t, angle) => {
        // Lumpy along and round; the base (sin < 0) flattened.
        const lumps =
          1 +
          0.3 * (fbm3(t * 40, Math.cos(angle) * 1.5, Math.sin(angle) * 1.5, roll.seed + k) - 0.5) +
          0.15 * (fbm3(t * 300, Math.cos(angle) * 4, Math.sin(angle) * 4, roll.seed + k) - 0.5)
        const flat = Math.sin(angle) < -0.4 ? 0.85 : 1
        return r * lumps * flat
      },
      (t, angle) => {
        // Brighter on top, grey underneath.
        const up = Math.sin(angle)
        // Bands along the roll, as the air turns over.
        const bands = 0.08 * Math.sin(angle * 3 + 6 * fbm3(t * 80, 0.5, 0.5, roll.seed))
        const v = 0.66 + 0.2 * up + bands + 0.12 * (fbm3(t * 120, angle, 0.5, roll.seed) - 0.5)
        return [v, v, v * 1.02]
      },
      28
    )
    b.cap(rings[0], axis.clone().negate(), [0.6, 0.6, 0.62])
    b.cap(rings[rings.length - 1], axis, [0.6, 0.6, 0.62])
  }
  return b
}

export function createRollCloud(ctx: PropContext): Object3D[] {
  const roll = ctx.params.rollCloud
  if (roll == null) return []
  const [ax, , az] = dirFromAzEl(roll.axisDeg, 0)
  const axis = new Vector3(ax, 0, az)
  const [hx, , hz] = dirFromAzEl(ctx.params.camera.headingDeg, 0)
  const centre = ctx.camera.position.clone().setY(0).addScaledVector(new Vector3(hx, 0, hz), roll.distanceM)
  // Tubes stack away from the camera.
  if (new Vector3(axis.z, 0, -axis.x).dot(new Vector3(hx, 0, hz)) < 0) axis.negate()
  const mesh = new Mesh(rollGeometry(roll, axis, centre).build(), new MeshStandardMaterial({ vertexColors: true, roughness: 1 }))
  mesh.frustumCulled = false
  // Cloud-like: the sky cube mirrors clouds, so the planar mirror leaves it out.
  mesh.userData.skyLike = true
  return [mesh]
}

