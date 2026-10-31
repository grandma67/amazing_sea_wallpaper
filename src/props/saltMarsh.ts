import { Color, DoubleSide, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type BufferGeometry } from 'three'

import type { RGB } from '../biome'
import type { SceneParams } from '../params'
import type { Random } from '../random'
import { forced } from '../sceneSpec'
import { seasonMonth } from '../seasons'
import { worldToShore } from '../terrain'
import { fbm, smoothstep } from '../cellNoise'
import { flatCreeks, marshLook } from '../tidalFlat'
import { MeshBuilder } from './builder'
import type { PropContext } from './context'

// Salt-marsh tufts (PLAN_BIOMES 9; plans/TIDAL_FLAT.md): low clumps of
// grass (Puccinellia, Spartina) and glasswort (Salicornia) on the marsh
// near the camera, where the terrain's sward colour alone reads flat. The
// shader colours the whole marsh (terrain.ts marshW); these give it height
// and texture within ~45 m.

/** How far from the camera tufts go (m): a 0.25 m tuft is ~25 px at 1080p
 * and an 80 mm lens there. */
export const MARSH_TUFT_DISTANCE = 45
/** Tufts at most (each ~50–70 triangles). */
export const MARSH_TUFT_COUNT = 2500

export interface SaltMarshChoice {
  /** Tufts to place (before what's visible). */
  count: number
  /** Share of glasswort clumps on the low marsh. */
  glasswort: number
  /** The sward's and the accent's colour this month, the accent's share of
   * the low marsh (tidalFlat.ts marshLook). */
  color: RGB
  accent: RGB
  amount: number
}

/** Whether the day has marsh tufts and what they look like (stream
 * 'salt-marsh'): every day with a salt marsh unless forced off. */
export function saltMarshFor(params: SceneParams, rng: Random): SaltMarshChoice | null {
  const density = rng.range(0.7, 1)
  const glasswort = rng.range(0.2, 0.5)
  if (!forced(params.overrides?.saltMarsh, params.coast.marsh != null) || params.coast.marsh == null) return null
  const look = marshLook(seasonMonth(params))
  return { count: Math.round(MARSH_TUFT_COUNT * density), glasswort, color: look.color, accent: look.accent, amount: look.amount }
}

/** A grass tuft at real size, base on y = 0: 10–16 arching blades,
 * 0.15–0.35 m tall, dark at the base (vertex colours ×, instance colour
 * gives the hue). Deterministic for one rng. */
export function grassTuftGeometry(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const blades = rng.int(10, 16)
  for (let i = 0; i < blades; i++) {
    const az = rng.range(0, Math.PI * 2)
    const out = new Vector3(Math.cos(az), 0, Math.sin(az))
    const side = new Vector3(-out.z, 0, out.x)
    const base = out.clone().multiplyScalar(rng.range(0, 0.05))
    const height = rng.range(0.15, 0.35)
    const lean = rng.range(0.15, 0.6)
    const shade = rng.range(0.8, 1.15)
    let prevL = -1
    let prevR = -1
    for (let k = 0; k <= 3; k++) {
      const t = k / 3
      const p = base.clone().addScaledVector(out, lean * height * t * t).setY(height * t * (1 - 0.3 * lean * t))
      const w = 0.006 * (1 - t) + 0.001
      const c: RGB = [shade * (0.5 + 0.5 * t), shade * (0.5 + 0.5 * t), shade * (0.5 + 0.5 * t)]
      const l = b.vertex(p.clone().addScaledVector(side, -w), c)
      const r = b.vertex(p.clone().addScaledVector(side, w), c)
      if (prevL >= 0) b.quad(prevL, prevR, r, l)
      prevL = l
      prevR = r
    }
  }
  return b.build()
}

/** A glasswort clump at real size, base on y = 0: 6–10 upright succulent
 * stems 0.08–0.2 m tall with a side branch, each a thin four-sided prism. */
export function glasswortGeometry(rng: Random): BufferGeometry {
  const b = new MeshBuilder()
  const stems = rng.int(6, 10)
  const stem = (from: Vector3, to: Vector3, r: number, shade: number): void => {
    const ring = (p: Vector3, c: RGB): number[] =>
      [0, 1, 2, 3].map(k => b.vertex(p.clone().add(new Vector3(Math.cos((k * Math.PI) / 2) * r, 0, Math.sin((k * Math.PI) / 2) * r)), c))
    const lo = ring(from, [0.6 * shade, 0.6 * shade, 0.6 * shade])
    const hi = ring(to, [shade, shade, shade])
    for (let k = 0; k < 4; k++) b.quad(lo[k], lo[(k + 1) % 4], hi[(k + 1) % 4], hi[k])
  }
  for (let i = 0; i < stems; i++) {
    const az = rng.range(0, Math.PI * 2)
    const base = new Vector3(Math.cos(az), 0, Math.sin(az)).multiplyScalar(rng.range(0, 0.06))
    const height = rng.range(0.08, 0.2)
    const tip = base.clone().add(new Vector3(rng.range(-0.02, 0.02), height, rng.range(-0.02, 0.02)))
    const shade = rng.range(0.85, 1.15)
    stem(base, tip, 0.006, shade)
    const fork = base.clone().lerp(tip, 0.5)
    stem(fork, fork.clone().add(new Vector3(rng.range(-0.04, 0.04), height * 0.35, rng.range(-0.04, 0.04))), 0.004, shade)
  }
  return b.build()
}

export function createSaltMarsh(ctx: PropContext): InstancedMesh[] {
  const { params } = ctx
  const choice = saltMarshFor(params, ctx.rng('salt-marsh'))
  const marsh = params.coast.marsh
  if (choice == null || marsh == null) return []
  const coast = params.coast
  const rng = ctx.rng('salt-marsh-place')
  const dry = coast.runup + 0.05
  const grass: Matrix4[] = []
  const wort: Matrix4[] = []
  const grassColors: Color[] = []
  const wortColors: Color[] = []
  const q = new Quaternion()
  const up = new Vector3(0, 1, 0)
  // Sample the ground in the view cone (a little wider), evenly over its
  // area out to MARSH_TUFT_DISTANCE: tufts are only worth it in frame.
  const camera = ctx.camera
  const forward = camera.getWorldDirection(new Vector3()).setY(0).normalize()
  const halfFov = 1.1 * Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect)
  for (let tries = 0; tries < choice.count * 8 && grass.length + wort.length < choice.count; tries++) {
    const yaw = (rng.float() * 2 - 1) * halfFov
    const d = 1.5 + (MARSH_TUFT_DISTANCE - 1.5) * Math.sqrt(rng.float())
    const dir = forward.clone().applyAxisAngle(up, yaw)
    const x = camera.position.x + dir.x * d
    const z = camera.position.z + dir.z * d
    const [s, a] = worldToShore(coast, x, z)
    const into = -s - marsh.start
    if (into < 0 || into > marsh.width) continue
    // Sparse pioneer clumps over the first ~8 m.
    if (rng.float() > 0.25 + 0.75 * Math.min(1, into / 8)) continue
    if (coast.flat != null && flatCreeks(coast, s, a) > 0.05) continue
    const y = ctx.ground(x, z)
    if (y < dry) continue
    if (!ctx.visible(x, y + 0.15, z, 0.4)) continue
    const low = into < 0.5 * marsh.width
    const isWort = low && rng.chance(choice.glasswort)
    const size = rng.range(0.7, 1.3)
    q.setFromAxisAngle(up, rng.range(0, Math.PI * 2))
    const m = new Matrix4().compose(new Vector3(x, y - 0.01, z), q, new Vector3(size, size, size))
    // Accent: glasswort red in autumn, sea lavender purple in summer, in
    // the patches the terrain paints on the low marsh (terrain.ts marshW).
    const [ox, oz] = coast.noiseOffset
    const patch = smoothstep(0.5, 0.65, fbm((x + ox) / 7 + 3, (z + oz) / 7 + 3)) * (1 - smoothstep(0.1 * marsh.width, 0.6 * marsh.width, into))
    const accent = rng.chance(Math.min(1, 1.5 * choice.amount * patch * (isWort ? 1.3 : 0.6)))
    const base = accent ? choice.accent : choice.color
    const tint = rng.range(0.8, 1.2) * (accent ? 1.1 : 1.5)
    const color = new Color(base[0] * tint, base[1] * tint, base[2] * tint)
    if (isWort) {
      wort.push(m)
      wortColors.push(color)
    } else {
      grass.push(m)
      grassColors.push(color)
    }
  }
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, side: DoubleSide })
  // Plants get no direct specular (vegetation.ts).
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directSpecular = vec3(0.0);')
  }
  const meshes: InstancedMesh[] = []
  const variants = 4
  const geometryRng = ctx.rng('salt-marsh-mesh')
  for (const [list, colors, build] of [
    [grass, grassColors, grassTuftGeometry],
    [wort, wortColors, glasswortGeometry]
  ] as const) {
    for (let v = 0; v < variants; v++) {
      const indices = list.map((_, i) => i).filter(i => i % variants === v)
      const geometry = build(geometryRng)
      if (indices.length === 0) continue
      const mesh = new InstancedMesh(geometry, material, indices.length)
      indices.forEach((i, j) => {
        mesh.setMatrixAt(j, list[i])
        mesh.setColorAt(j, colors[i])
      })
      mesh.castShadow = false
      mesh.receiveShadow = true
      mesh.frustumCulled = false
      meshes.push(mesh)
    }
  }
  return meshes
}
