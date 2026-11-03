import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { createCamera } from '../src/camera'
import { azEl, dirFromAzEl, inSky, pixelOf, project, unproject } from '../src/skyFrame'
import { allParams } from './days'

// skyFrame.ts projects sky directions exactly as the render camera does.

describe('sky frame', () => {
  const days = allParams().filter((_, i) => i % 9 === 0)

  it('matches the render camera, roll and dip included', () => {
    for (const p of days) {
      const { camera, dip } = createCamera(p, 1920, 1080)
      for (const [az, el] of [[0, 2], [-20, 10], [25, 20], [10, -1]]) {
        const d = dirFromAzEl(p.camera.headingDeg + az, el)
        const ndc = project(p, d, dip)
        const three = camera.position.clone().add(new Vector3(...d).multiplyScalar(1e5)).project(camera)
        if (ndc == null) continue
        expect(ndc[0]).toBeCloseTo(three.x, 4)
        expect(ndc[1]).toBeCloseTo(three.y, 4)
      }
    }
  })

  it('puts the horizon where the composition asks', () => {
    for (const p of days) {
      const h = dirFromAzEl(p.camera.headingDeg, 0)
      const ndc = project({ camera: { ...p.camera, rollDeg: 0 } }, h)!
      expect(ndc[1]).toBeCloseTo(1 - 2 * p.camera.horizonFraction, 6)
    }
  })

  it('round-trips and agrees on what is in frame', () => {
    for (const p of days.slice(0, 40)) {
      for (const [nx, ny] of [[0, 0], [0.7, 0.5], [-0.9, -0.3]]) {
        const ndc = project(p, unproject(p, nx, ny))!
        expect(ndc[0]).toBeCloseTo(nx, 9)
        expect(ndc[1]).toBeCloseTo(ny, 9)
      }
      const up = unproject(p, 0, 0.95)
      if (up[1] > 0.1) expect(inSky(p, up, 0.99, 1)).toBe(true)
      expect(pixelOf(p, unproject(p, 0, 0), 1920, 1080)!.map(Math.round)).toEqual([960, 540])
    }
    const { azDeg, elDeg } = azEl(dirFromAzEl(123, 17))
    expect(azDeg).toBeCloseTo(123, 9)
    expect(elDeg).toBeCloseTo(17, 9)
  })
})
