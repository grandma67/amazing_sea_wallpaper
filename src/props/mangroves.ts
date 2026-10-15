import { Color, DoubleSide, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3 } from 'three'

import type { OceanName } from '../oceans'
import type { SceneParams } from '../params'
import type { Random } from '../random'
import { forced, forcedKind, type MangroveKind } from '../sceneSpec'
import { shoreToWorld } from '../terrain'
import type { PropContext } from './context'
import { avicennia, rhizophora } from './trees'

// Mangroves: salt-tolerant trees of the tropical intertidal, rooted in mud
// that the tide floods. They grow only where the water is sheltered — in
// lagoons, estuaries, wadi mouths and behind reefs — never on a beach the
// surf pounds, so a stand appears on calm days along part of the shore.
//   Rhizophora (red mangrove): 5–12 m on arching prop roots, all tropical
//   coasts. Avicennia (grey mangrove): the hardiest, landward on tropical
//   shores and the only one on the hot, salty Red Sea and Gulf coasts and in
//   Baja California, where it stays a 2–4 m shrub over a bed of
//   pencil-like breathing roots.

export interface MangroveStand {
  kind: MangroveKind
  /** Length of shore the stand covers (m). */
  length: number
  /** Trees per metre of shore. */
  density: number
}

/** Calmer than this (surf amplitude, m) counts as sheltered water. */
export const SHELTERED_SURF = 0.35

/** How often a sheltered beach of each kind has mangroves. Desert coasts:
 * the Red Sea and the Gulf (Indian), Baja California (Pacific; not the
 * Atacama); the Namib and Sahara Atlantic coasts have none. */
const CHANCE: Partial<Record<SceneParams['biome']['name'], Partial<Record<OceanName, number>>>> = {
  tropical: { pacific: 0.55, indian: 0.55, atlantic: 0.5 },
  desert: { indian: 0.5, pacific: 0.15 }
}

/** Whether a mangrove stand grows on this day's shore, and what kind. */
export function mangroveFor(params: SceneParams, rng: Random): MangroveStand | null {
  const { coast, biome } = params
  const force = params.overrides?.mangroves
  const chance = CHANCE[biome.name]?.[params.sea.ocean] ?? 0
  // Always make every draw, so forcing one thing keeps the rest.
  const grows = rng.chance(chance)
  const red = rng.chance(0.75)
  const length = rng.range(80, 300)
  const density = rng.range(0.5, 0.9)
  const sheltered = coast.surfAmplitude < SHELTERED_SURF
  if (coast.type !== 'beach' || !forced(force, grows && sheltered)) return null
  const kind = forcedKind(force, biome.name === 'tropical' && red ? 'rhizophora' : 'avicennia')
  return { kind, length, density: kind === 'avicennia' ? density * 1.4 : density }
}

const VARIANTS = 3

export function createMangroves(ctx: PropContext): InstancedMesh[] {
  const { params } = ctx
  const rng = ctx.rng('mangroves')
  const stand = mangroveFor(params, rng)
  if (stand == null) return []
  const { coast } = params
  const red = stand.kind === 'rhizophora'

  // The stand's near end: a stretch of waterline 30–700 m off, and it runs
  // on along the shore away from the camera. Best in frame; looking out to
  // sea from the waterline the shore only shows at the sides, so there a
  // stand reaching in from the edge will do.
  const spot = (inView: (x: number, z: number) => boolean): number | null => {
    for (let tries = 0; tries < 120; tries++) {
      const a = rng.range(-900, 900)
      const [x, z] = shoreToWorld(coast, 0, a)
      const distance = ctx.distance(x, z)
      if (distance >= 30 && distance <= 700 && inView(x, z)) return a
    }
    return null
  }
  const start = spot((x, z) => ctx.inFrame(x, 3, z, 0.9)) ?? spot((x, z) => ctx.visible(x, 4, z, 4))
  if (start == null) return []
  const direction = start >= 0 ? 1 : -1

  // Trees from just above the high-tide mud out into knee-deep water,
  // thinning toward the open water.
  const material = new MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0, side: DoubleSide })
  // No sun glints on edge-on leaves (see vegetation.ts).
  material.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      '#include <lights_fragment_end>\nreflectedLight.directSpecular = vec3(0.0);'
    )
  }
  const placed: Matrix4[][] = Array.from({ length: VARIANTS }, () => [])
  const target = Math.round(stand.length * stand.density * 2.5)
  const [sMin, sMax] = red ? [-6, 30] : [-10, 14]
  const m = new Matrix4()
  const q = new Quaternion()
  const up = new Vector3(0, 1, 0)
  let count = 0
  for (let tries = 0; tries < target * 4 && count < target; tries++) {
    const along = start + direction * rng.range(0, stand.length)
    const s = rng.range(sMin, sMax)
    const [x, z] = shoreToWorld(coast, s, along)
    const y = ctx.ground(x, z)
    // Out of the intertidal (too high and dry, or too deep), or thinning out
    // seaward.
    if (y > 0.9 || y < -0.9) continue
    if (s > 0 && rng.float() < s / sMax) continue
    if (ctx.distance(x, z) < 12) continue
    const size = rng.range(0.7, 1.25)
    q.setFromAxisAngle(up, rng.range(0, Math.PI * 2))
    m.compose(new Vector3(x, y, z), q, new Vector3(size, size * rng.range(0.85, 1.15), size))
    placed[rng.int(0, VARIANTS - 1)].push(m.clone())
    count++
  }

  const meshes: InstancedMesh[] = []
  const build = red ? rhizophora : avicennia
  for (let v = 0; v < VARIANTS; v++) {
    if (placed[v].length === 0) continue
    const mesh = new InstancedMesh(build(rng, params.biome.foliage), material, placed[v].length)
    placed[v].forEach((matrix, i) => {
      mesh.setMatrixAt(i, matrix)
      // A little variety in leaf colour from tree to tree.
      const k = rng.range(0.85, 1.1)
      mesh.setColorAt(i, new Color(k, k, k))
    })
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.frustumCulled = false
    meshes.push(mesh)
  }
  return meshes
}
