import { Vector3 } from 'three'

import { createCamera } from './camera'
import { generateParams, type SceneParams } from './params'
import type { SceneSpec } from './sceneSpec'
import { hasLand, terrainHeight } from './terrain'

// Composition check: before rendering, cast a coarse grid of rays from the
// camera against the terrain and measure how much of the frame is sky, sea
// and land. Frames that hide the sea or the sky are re-rolled.

export interface FrameCoverage {
  sky: number
  sea: number
  land: number
}

export function measureFrame(params: SceneParams): FrameCoverage {
  // ~576 rays over the frame, in its shape.
  const aspect = params.camera.aspect
  const columns = Math.round(Math.sqrt(576 * aspect))
  const rows = Math.round(576 / columns)
  const { camera } = createCamera(params, aspect, 1)
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

/** What the camera sees of the ground, for sizing near-camera props by
 * pixels on screen before rendering (scripts/params.mjs `p.view`). */
export interface FrameView {
  /** Eye height above the ground (or sea) below the camera (m). */
  eye: number
  focalLengthMm: number
  /** Vertical angle of one output pixel (mrad), at `height` px. */
  pixelMrad: number
  /** Distance (m) to the nearest ground or sea in frame (along the bottom
   * edge), and to the ground at the bottom centre. */
  nearest: number
  bottomCentre: number
}

/** Where the frame's bottom edge meets the ground, at `height` output
 * pixels (16:9 or the params' aspect). Nothing nearer than `nearest` is in
 * view, so a thing of size S shows at most S / (nearest × pixelMrad / 1000)
 * pixels wide. */
export function frameView(params: SceneParams, height = 1080): FrameView {
  const aspect = params.camera.aspect
  const { camera } = createCamera(params, aspect * height, height)
  const below = Math.max(terrainHeight(params.coast, camera.position.x, camera.position.z), 0)
  const dir = new Vector3()
  const p = new Vector3()
  const hit = (ndcX: number): number => {
    dir.set(ndcX, -1, 0.5).unproject(camera).sub(camera.position).normalize()
    // Fine steps near the camera, growing further out.
    for (let t = 0.3; t < 30_000; t *= 1.01) {
      p.copy(camera.position).addScaledVector(dir, t)
      if (p.y <= Math.max(terrainHeight(params.coast, p.x, p.z), 0)) return Math.hypot(p.x - camera.position.x, p.z - camera.position.z)
      if (p.y > 2000) break
    }
    return Infinity
  }
  const bottom = [-1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1].map(hit)
  const round = (v: number): number => Math.round(v * 10) / 10
  return {
    eye: round(camera.position.y - below),
    focalLengthMm: round(params.camera.focalLengthMm),
    pixelMrad: Math.round(((camera.fov * Math.PI) / 180 / height) * 1e5) / 100,
    nearest: round(Math.min(...bottom)),
    bottomCentre: round(bottom[4])
  }
}

function acceptable(c: FrameCoverage): boolean {
  return c.sea >= 0.12 && c.sky >= 0.2 && c.land <= 0.6
}

/** Scene parameters for a date and image shape (width / height), re-rolling
 * the composition if needed; `spec` forces parts of the scene (a forced
 * composition stays, only the coast around it is re-rolled). */
export function generateSceneParams(date: string, aspect = 16 / 9, spec: SceneSpec = {}): SceneParams {
  let best: { params: SceneParams; score: number } | null = null
  for (let attempt = 0; attempt < 8; attempt++) {
    const params = generateParams(date, attempt, aspect, spec)
    if (!hasLand(params.coast)) return params
    const coverage = measureFrame(params)
    if (acceptable(coverage)) return params
    const score = Math.min(coverage.sea, 0.12) + Math.min(coverage.sky, 0.2) - Math.max(coverage.land - 0.6, 0)
    if (best == null || score > best.score) best = { params, score }
  }
  return best!.params
}
