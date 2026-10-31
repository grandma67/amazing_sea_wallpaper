import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { createCamera } from '../src/camera'
import { createPolarGrid, ringStep, squareGrid, viewWedge } from '../src/grid'
import { generateParams } from '../src/params'
import { DAYS } from './days'

const MARGIN = (3 * Math.PI) / 180

/** Angle of a from the wedge's start, in [0, 2π). */
function fromStart(a: number, start: number): number {
  const d = (a - start) % (Math.PI * 2)
  return d < 0 ? d + Math.PI * 2 : d
}

describe('terrain grid', () => {
  it('a full circle keeps its old shape: rings × segments vertices, wrapped', () => {
    const g = createPolarGrid({ rings: 10, segments: 16 })
    expect(g.getAttribute('position').count).toBe(10 * 16 + 1)
    expect(g.getIndex()!.count).toBe(16 * 3 + 9 * 16 * 6)
  })

  it('a wedge stays inside its angles and indexes only its own vertices', () => {
    const start = 1.2
    const span = 0.6
    const g = createPolarGrid({ rings: 20, segments: 12, start, span })
    const pos = g.getAttribute('position')
    expect(pos.count).toBe(20 * 13 + 1)
    for (let i = 1; i < pos.count; i++) {
      // Signed angle from the wedge's middle (Float32 positions round).
      const rel = Math.atan2(pos.getZ(i), pos.getX(i)) - (start + span / 2)
      expect(Math.abs(Math.atan2(Math.sin(rel), Math.cos(rel)))).toBeLessThanOrEqual(span / 2 + 1e-5)
    }
    const index = g.getIndex()!
    for (let i = 0; i < index.count; i++) expect(index.getX(i)).toBeLessThan(pos.count)
  })

  it('squareGrid spends the budget on near-square cells', () => {
    for (const span of [0.3, 0.6, 1.8, Math.PI * 2]) {
      const { rings, segments } = squareGrid(600 * 1024, span, 0.25, 120_000)
      expect(rings * segments / (600 * 1024)).toBeCloseTo(1, 2)
      expect(ringStep(rings, 0.25, 120_000) / (span / segments)).toBeGreaterThan(0.95)
      expect(ringStep(rings, 0.25, 120_000) / (span / segments)).toBeLessThan(1.05)
    }
  })

  it('the wedge covers every ray of the frame on real days, landscape and portrait', () => {
    let widest = 0
    for (const date of DAYS.filter((_, i) => i % 5 === 0)) {
      for (const [w, h] of [[1920, 1080], [1080, 2340]]) {
        const p = generateParams(date, 0, w / h)
        const { camera } = createCamera(p, w, h)
        const { start, span } = viewWedge(camera, MARGIN)
        widest = Math.max(widest, span)
        const eye = camera.position
        const ray = new Vector3()
        for (let i = 0; i < 40; i++) {
          // Interior and border points, corners included.
          const x = i < 4 ? (i & 1 ? 1 : -1) : Math.sin(i * 12.9898) * 1
          const y = i < 4 ? (i & 2 ? 1 : -1) : Math.sin(i * 78.233) * 1
          ray.set(x, y, 0.5).unproject(camera).sub(eye)
          const a = Math.atan2(ray.z, ray.x)
          // Inside the wedge with at least most of the margin to spare.
          const d = fromStart(a, start)
          expect(d).toBeGreaterThan(0.9 * MARGIN)
          expect(d).toBeLessThan(span - 0.9 * MARGIN)
        }
      }
    }
    // The widest lens still gets a wedge, not the full circle.
    expect(widest).toBeLessThan(Math.PI)
  })
})
