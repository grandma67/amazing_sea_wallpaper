import { InstancedMesh, Matrix4, Vector3, type BufferGeometry, type Object3D } from 'three'
import { expect } from 'vitest'

import { expectEvery } from './days'

// What every mesh owes the scene (CLAUDE.md "Tests"): deterministic, finite,
// standing where it should, within its budget. No `expect` per vertex: those
// took nearly all of the meshes' test time.

export const triangles = (g: BufferGeometry): number => (g.index?.count ?? g.attributes.position.count) / 3

export interface MeshRules {
  maxTriangles?: number
  minTriangles?: number
  maxVertices?: number
  /** Range of the lowest y (real size, base near y = 0). */
  base?: readonly [number, number]
  /** Range of the highest y. */
  top?: readonly [number, number]
  /** At most this wide along x, or long along z. */
  width?: number
  length?: number
  /** The triangles face outward (a closed mesh, not inside out). */
  solid?: boolean
}

/** Signed volume: positive when the triangles face outward. */
function signedVolume(g: BufferGeometry): number {
  const p = g.attributes.position.array
  const index = g.index?.array ?? Array.from({ length: p.length / 3 }, (_, i) => i)
  let v = 0
  for (let i = 0; i < index.length; i += 3) {
    const [a, b, c] = [index[i] * 3, index[i + 1] * 3, index[i + 2] * 3]
    v += p[a] * (p[b + 1] * p[c + 2] - p[b + 2] * p[c + 1]) - p[a + 1] * (p[b] * p[c + 2] - p[b + 2] * p[c]) + p[a + 2] * (p[b] * p[c + 1] - p[b + 1] * p[c])
  }
  return v / 6
}

const within = (name: string, value: number, [lo, hi]: readonly [number, number]): void => {
  expect(value, name).toBeGreaterThanOrEqual(lo)
  expect(value, name).toBeLessThanOrEqual(hi)
}

/** Build it on each seed: finite, in range and in budget; the first seed twice
 * must give the same vertices. `build` must make its own Random from `seed`. */
export function expectMesh(build: (seed: string) => BufferGeometry, rules: MeshRules, seeds: readonly string[] = ['a', 'b', 'c']): void {
  const same = build(seeds[0]).attributes.position.array
  for (const [i, seed] of seeds.entries()) {
    const g = build(seed)
    const position = g.attributes.position
    if (i === 0) expect(Array.prototype.some.call(same, (v: number, k: number) => v !== position.array[k]) || same.length !== position.array.length, 'differs between two builds').toBe(false)
    expectEvery(position.array as Float32Array, Number.isFinite)
    if (g.attributes.normal != null) expectEvery(g.attributes.normal.array as Float32Array, Number.isFinite)
    if (g.index != null) expectEvery(g.index.array as Uint32Array, v => v < position.count)
    if (rules.maxTriangles != null) expect(triangles(g), `triangles (${seed})`).toBeLessThanOrEqual(rules.maxTriangles)
    if (rules.minTriangles != null) expect(triangles(g), `triangles (${seed})`).toBeGreaterThanOrEqual(rules.minTriangles)
    if (rules.maxVertices != null) expect(position.count, `vertices (${seed})`).toBeLessThanOrEqual(rules.maxVertices)
    g.computeBoundingBox()
    const { min, max } = g.boundingBox!
    if (rules.base != null) within(`lowest y (${seed})`, min.y, rules.base)
    if (rules.top != null) within(`highest y (${seed})`, max.y, rules.top)
    if (rules.width != null) expect(max.x - min.x, `width (${seed})`).toBeLessThanOrEqual(rules.width)
    if (rules.length != null) expect(max.z - min.z, `length (${seed})`).toBeLessThanOrEqual(rules.length)
    if (rules.solid === true) expect(signedVolume(g), `signed volume (${seed})`).toBeGreaterThan(0)
  }
}

/** World position of every instance of the instanced meshes among `objects`. */
export function instancePositions(objects: readonly Object3D[]): Vector3[] {
  const m = new Matrix4()
  return objects.flatMap(o => (o instanceof InstancedMesh ? Array.from({ length: o.count }, (_, i) => new Vector3().setFromMatrixPosition((o.getMatrixAt(i, m), m))) : []))
}
