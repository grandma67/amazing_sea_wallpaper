import { Vector3 } from 'three'

import { createCamera } from './camera'
import { generateParams, type SceneParams } from './params'
import { terrainHeight } from './terrain'

// Composition check: before rendering, cast a coarse grid of rays from the
// camera against the terrain and measure how much of the frame is sky, sea
// and land. Frames that hide the sea or the sky are re-rolled.

export interface FrameCoverage {
  sky: number
  sea: number
  land: number
}

export function measureFrame(params: SceneParams, columns = 32, rows = 18): FrameCoverage {
  const { camera } = createCamera(params, 16, 9)
  const counts = { sky: 0, sea: 0, land: 0 }
  const dir = new Vector3()
  const p = new Vector3()
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < columns; i++) {
      dir
        .set(((i + 0.5) / columns) * 2 - 1, ((j + 0.5) / rows) * 2 - 1, 0.5)
        .unproject(camera)
        .sub(camera.position)
        .normalize()
      let hit: keyof FrameCoverage = dir.y > 0 ? 'sky' : 'sea'
      // March outward with growing steps; the ground is the terrain or sea.
      for (let t = 1; t < 30_000; t *= 1.06) {
        p.copy(camera.position).addScaledVector(dir, t)
        const ground = terrainHeight(params.coast, p.x, p.z)
        if (p.y <= Math.max(ground, 0)) {
          hit = ground > 0.3 ? 'land' : 'sea'
          break
        }
        if (p.y > 2000) break
      }
      counts[hit]++
    }
  }
  const total = columns * rows
  return { sky: counts.sky / total, sea: counts.sea / total, land: counts.land / total }
}

function acceptable(c: FrameCoverage): boolean {
  return c.sea >= 0.12 && c.sky >= 0.2 && c.land <= 0.6
}

/** Scene parameters for a date, re-rolling the composition if needed. */
export function generateSceneParams(date: string): SceneParams {
  let best: { params: SceneParams; score: number } | null = null
  for (let attempt = 0; attempt < 8; attempt++) {
    const params = generateParams(date, attempt)
    if (params.coast.type !== 'beach') return params
    const coverage = measureFrame(params)
    if (acceptable(coverage)) return params
    const score = Math.min(coverage.sea, 0.12) + Math.min(coverage.sky, 0.2) - Math.max(coverage.land - 0.6, 0)
    if (best == null || score > best.score) best = { params, score }
  }
  return best!.params
}
