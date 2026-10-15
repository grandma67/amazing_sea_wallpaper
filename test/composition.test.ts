import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { createCamera } from '../src/camera'
import { generateSceneParams, measureFrame } from '../src/composition'
import { EARTH_RADIUS, generateParams } from '../src/params'
import { allParams } from './days'

describe('createCamera', () => {
  it('puts the dipped horizon at the chosen height in the frame', () => {
    for (const p of allParams().slice(0, 50)) {
      for (const aspect of [16 / 9, 9 / 19.5]) {
        const params = { ...p, camera: { ...p.camera, rollDeg: 0, aspect } }
        const { camera, dip } = createCamera(params, aspect, 1)
        expect(dip).toBeCloseTo(Math.acos(EARTH_RADIUS / (EARTH_RADIUS + camera.position.y)), 9)
        // A point far ahead, at the dip angle below level.
        const heading = (params.camera.headingDeg * Math.PI) / 180
        const dir = new Vector3(Math.sin(heading) * Math.cos(dip), -Math.sin(dip), -Math.cos(heading) * Math.cos(dip))
        const ndc = camera.position.clone().addScaledVector(dir, 10_000).project(camera)
        expect((1 - ndc.y) / 2).toBeCloseTo(params.camera.horizonFraction, 4)
        expect(ndc.x).toBeCloseTo(0, 4)
      }
    }
  })

  it('uses a wider vertical view in portrait for the same lens', () => {
    const p = allParams()[0]
    expect(createCamera(p, 9, 16).camera.fov).toBeGreaterThan(createCamera(p, 16, 9).camera.fov)
  })
})

describe('measureFrame', () => {
  it('splits the frame into sky, sea and land', () => {
    for (const p of allParams().slice(0, 30)) {
      const c = measureFrame(p)
      expect(c.sky + c.sea + c.land).toBeCloseTo(1)
      expect(c.sky).toBeGreaterThan(0)
      if (p.coast.type === 'open-sea') expect(c.land).toBe(0)
    }
  })
})

describe('generateSceneParams', () => {
  it('re-rolls beach framings that hide the sea or the sky', { timeout: 20_000 }, () => {
    const days = allParams().filter(p => p.coast.type === 'beach').slice(0, 20)
    let accepted = 0
    for (const p of days) {
      const chosen = generateSceneParams(p.date)
      expect(chosen.date).toBe(p.date)
      // Retries keep the day: only the coast and composition change.
      expect(chosen.biome.name).toBe(p.biome.name)
      expect(chosen.timeOfDay).toBe(p.timeOfDay)
      expect(chosen.coast.type).toBe('beach')
      const c = measureFrame(chosen)
      if (c.sea >= 0.12 && c.sky >= 0.2 && c.land <= 0.6) accepted++
    }
    expect(accepted / days.length).toBeGreaterThan(0.9)
  })

  it('takes the open sea as it comes', () => {
    const p = allParams().find(p => p.coast.type === 'open-sea')!
    expect(generateSceneParams(p.date)).toEqual(generateParams(p.date))
  })
})
