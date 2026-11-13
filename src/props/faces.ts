import { Quaternion, Vector3 } from 'three'

import type { RGB } from '../biome'
import type { MeshBuilder } from './builder'

// Faces for the procedural animals: eyes (lid, iris, a round or slit pupil),
// nostrils, a mouth line, beaks (upper and lower mandible, the gape line, a
// nostril slit, a gull's red gonys spot) and teeth. Sizes are real (m) and
// come from each builder; none of these take a skin (props/skins.ts).

const X = new Vector3(1, 0, 0)
const PUPIL: RGB = [0.008, 0.008, 0.008]
const HOLE: RGB = [0.015, 0.012, 0.01]

const along = (from: Vector3, to: Vector3): Quaternion => new Quaternion().setFromUnitVectors(from, to.clone().normalize())

export interface EyeLook {
  /** The iris, and the lid (or orbital ring) round it. */
  iris: RGB
  lid: RGB
  /** Round (mammals, birds, most fish) or a vertical slit (crocodiles). */
  pupil?: 'round' | 'slit'
  /** Share of the eye's face the iris covers (0..1); birds' and fish' are
   * mostly iris, seals' all dark. */
  irisSize?: number
}

/** An eye of radius `r` at `at` on a surface facing `out`: a domed eyeball
 * set a little into the head, the iris and pupil painted on it facing out,
 * and a ring of lid round it. `detail` 2 for small animals. */
export function eye(b: MeshBuilder, at: Vector3, out: Vector3, r: number, look: EyeLook, detail = 3): void {
  const n = out.clone().normalize()
  const q = along(X, n)
  const iris = Math.cos((look.irisSize ?? 0.7) * 1.15)
  const pupilAt = look.pupil === 'slit' ? Math.cos(0.75) : Math.cos(0.32)
  b.blob(
    at.clone().addScaledVector(n, -0.3 * r),
    new Vector3(0.75 * r, r, r),
    d => {
      if (look.pupil === 'slit' ? d.x > pupilAt && Math.abs(d.z) < 0.14 : d.x > pupilAt) return PUPIL
      if (d.x > iris) return look.iris
      return look.lid
    },
    () => 1,
    detail,
    q
  )
  // The lid: a thin ring round the eyeball, a little proud of it (big eyes
  // only: on small animals it's under a pixel and costs 96 triangles).
  if (detail < 3) return
  const u = new Vector3(0, 1, 0).applyQuaternion(q)
  const v = new Vector3(0, 0, 1).applyQuaternion(q)
  const ring: Vector3[] = []
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * Math.PI * 2
    ring.push(at.clone().addScaledVector(n, 0.05 * r).addScaledVector(u, Math.cos(a) * r * 0.98).addScaledVector(v, Math.sin(a) * r * 0.98))
  }
  b.tube(ring, () => r * 0.09, () => look.lid, 4)
}

/** A nostril: a dark slit or round hole `r` long, its long axis along
 * `long` (default: the head's up), sunk a little into a surface facing
 * `out`. `aspect` = width / length. */
export function nostril(b: MeshBuilder, at: Vector3, out: Vector3, r: number, aspect = 0.5, long?: Vector3): void {
  const n = out.clone().normalize()
  const q = along(X, n)
  if (long != null) {
    // Turn the slit about `out` so its long axis (local z) lies along `long`.
    const z = new Vector3(0, 0, 1).applyQuaternion(q)
    const want = long.clone().addScaledVector(n, -long.dot(n)).normalize()
    if (want.lengthSq() > 0.5) q.premultiply(new Quaternion().setFromUnitVectors(z, want))
  }
  b.blob(at.clone().addScaledVector(n, -0.1 * r), new Vector3(0.3 * r, aspect * r, r), () => HOLE, () => 1, 1, q)
}

/** A mouth line along `points` (the lips' meeting line), `r` thick. */
export function mouthLine(b: MeshBuilder, points: Vector3[], r: number, color: RGB = [0.02, 0.015, 0.012]): void {
  b.tube(points, () => r, () => color, 3)
}

export interface BeakLook {
  upper: RGB
  lower: RGB
  /** Tip colour (a flamingo's black tip, a goose's nail), from `tipFrom` of the length. */
  tip?: RGB
  tipFrom?: number
  /** A red spot near the lower mandible's tip (large gulls). */
  gonys?: RGB
  /** How far the upper mandible's tip hooks down (share of depth). */
  hook?: number
  /** Bend of the whole bill down (radians over its length): flamingos. */
  bend?: number
  /** Radius at the tip as a share of the base's: a gull's and goose's bill
   * ends blunt (0.35), a heron's in a point (0.1). */
  blunt?: number
}

/** A bill from `base` along `dir` (with `up` the bird's up): an upper
 * mandible over a slightly shorter lower one, both tapering to the tip,
 * the dark gape line between, and a nostril slit on each side of the
 * upper. `length`, `depth` (at the base, both mandibles) and `width` in m. */
export function beak(b: MeshBuilder, base: Vector3, dir: Vector3, up: Vector3, length: number, depth: number, width: number, look: BeakLook): void {
  const f = dir.clone().normalize()
  const u = up.clone().addScaledVector(f, -up.dot(f)).normalize()
  const s = new Vector3().crossVectors(f, u).normalize()
  const bend = look.bend ?? 0
  const point = (t: number, lift: number): Vector3 => {
    // Along the bill, bent down by `bend`, `lift` above its middle line.
    const a = bend * t
    const fwd = f.clone().multiplyScalar(Math.cos(a)).addScaledVector(u, -Math.sin(a))
    return base.clone().addScaledVector(fwd, t * length).addScaledVector(u, lift - bend * 0.15 * length * t * t)
  }
  const colorAt = (t: number, lower: boolean): RGB => (look.tip != null && t > (look.tipFrom ?? 0.7) ? look.tip : lower ? look.lower : look.upper)
  const steps = 5
  const hook = look.hook ?? 0
  // Upper mandible: its middle line a quarter-depth up, the tip hooking down.
  const upper = Array.from({ length: steps + 1 }, (_, k) => {
    const t = k / steps
    return point(t, depth * 0.25 * (1 - t) - hook * depth * Math.max(0, t - 0.8) * 2.5)
  })
  const blunt = look.blunt ?? 0.1
  b.tube(upper, t => Math.max(blunt, 1 - t) ** 0.8 * width * 0.5, t => colorAt(t, false), 5)
  const lower = Array.from({ length: steps + 1 }, (_, k) => {
    const t = (k / steps) * 0.92
    return point(t, -depth * 0.22 * (1 - t))
  })
  b.tube(lower, t => Math.max(blunt, 1 - t) ** 0.9 * width * 0.42, t => colorAt(t * 0.92, true), 5)
  // The gape line, and nostril slits near the base.
  mouthLine(b, Array.from({ length: 3 }, (_, k) => point((k / 2) * 0.85, 0).addScaledVector(u, -depth * 0.02)), width * 0.07)
  for (const side of [-1, 1]) {
    nostril(b, point(0.22, depth * 0.22).addScaledVector(s, side * width * 0.36), s.clone().multiplyScalar(side).addScaledVector(u, 0.6), width * 0.32, 0.3, f)
  }
  if (look.gonys != null) {
    const g = look.gonys
    b.blob(point(0.8, -depth * 0.12), new Vector3(width * 0.25, depth * 0.12, width * 0.36), () => g, () => 1, 1, along(X, f))
  }
}

/** Teeth: little cones from each point down `down`, `length` long. */
export function teeth(b: MeshBuilder, roots: Vector3[], down: Vector3, length: number, color: RGB = [0.72, 0.68, 0.55]): void {
  const d = down.clone().normalize()
  roots.forEach((p, i) => {
    const l = length * (i % 3 === 0 ? 1.3 : 0.8)
    b.tube([p.clone().addScaledVector(d, -l * 0.2), p.clone().addScaledVector(d, l)], t => length * 0.22 * (1 - t), () => color, 3)
  })
}

/** A point on a `MeshBuilder.tube` round `path` (the same frame the tube
 * uses), `t` along it (0..1), `angle` round it, and the surface's outward
 * direction there. */
export function onTube(path: Vector3[], radius: (t: number, angle: number) => number, t: number, angle: number): { at: Vector3; out: Vector3 } {
  const i = Math.min(path.length - 1, Math.max(0, Math.round(t * (path.length - 1))))
  const next = path[Math.min(i + 1, path.length - 1)]
  const prev = path[Math.max(i - 1, 0)]
  const tangent = new Vector3().subVectors(next, prev).normalize()
  const normal = new Vector3().crossVectors(tangent, new Vector3(0, 0, 1))
  if (normal.lengthSq() < 1e-6) normal.set(1, 0, 0)
  normal.normalize()
  const binormal = new Vector3().crossVectors(tangent, normal).normalize()
  const out = normal.multiplyScalar(Math.cos(angle)).addScaledVector(binormal, Math.sin(angle))
  const tt = i / (path.length - 1)
  return { at: path[i].clone().addScaledVector(out, radius(tt, angle)), out }
}

export interface WhiskerLook {
  /** Per side. */
  count: number
  /** Longest whisker (m); the rest shorter toward the pad's edges. */
  length: number
  /** Base radius (m); they taper to a point. */
  r: number
  color: RGB
  /** Harbour and elephant seals' beaded, wavy whiskers. */
  wavy?: boolean
  /** How far they droop as they go (0 straight out .. 1 down). */
  droop?: number
}

/** Whiskers fanning from the muzzle pads either side of `centre` (the
 * muzzle's middle, `halfWidth` to each pad), `forward` the snout's
 * direction, `up` the head's up. Deterministic (by index). */
export function whiskers(b: MeshBuilder, centre: Vector3, forward: Vector3, up: Vector3, halfWidth: number, look: WhiskerLook): void {
  const f = forward.clone().normalize()
  const u = up.clone().addScaledVector(f, -up.dot(f)).normalize()
  const across = new Vector3().crossVectors(f, u).normalize()
  const columns = Math.max(1, Math.ceil(look.count / 3))
  for (const side of [-1, 1]) {
    const s = across.clone().multiplyScalar(side)
    const pad = centre.clone().addScaledVector(s, halfWidth)
    for (let k = 0; k < look.count; k++) {
      const row = (k % 3) - 1
      const col = columns === 1 ? 0.5 : Math.floor(k / 3) / (columns - 1)
      // Roots in rows down the pad, from its front to its back.
      const root = pad.clone().addScaledVector(u, row * look.length * 0.05).addScaledVector(f, (0.5 - col) * look.length * 0.16)
      const len = look.length * (0.55 + 0.45 * Math.sin(Math.PI * (0.25 + 0.7 * col))) * (1 - 0.15 * Math.abs(row))
      // Out to the side, the front ones angled forward, the back ones
      // back, fanning up and down by row.
      const dir = s.clone().addScaledVector(f, 0.25 - 0.55 * col).addScaledVector(u, row * 0.22 - 0.05).normalize()
      const droop = look.droop ?? 0.3
      const pts: Vector3[] = []
      for (let i = 0; i <= 4; i++) {
        const t = i / 4
        const p = root.clone().addScaledVector(dir, t * len).addScaledVector(u, -droop * len * t * t * 0.5)
        if (look.wavy === true) p.addScaledVector(u, Math.sin(t * 14 + k) * look.r * 1.2)
        pts.push(p)
      }
      b.tube(pts, t => look.r * (1 - 0.85 * t), () => look.color, 3)
    }
  }
}

/** A point on an ellipsoid (`MeshBuilder.blob` with `radii` at `centre`,
 * scaled by `bulge` there) in the direction `dir` from its centre, and the
 * surface's outward direction. */
export function onBlob(centre: Vector3, radii: Vector3, dir: Vector3, bulge = 1): { at: Vector3; out: Vector3 } {
  const d = dir.clone().normalize()
  const k = 1 / Math.hypot(d.x / radii.x, d.y / radii.y, d.z / radii.z)
  const p = d.multiplyScalar(k * bulge)
  return { at: centre.clone().add(p), out: new Vector3(p.x / radii.x ** 2, p.y / radii.y ** 2, p.z / radii.z ** 2).normalize() }
}
