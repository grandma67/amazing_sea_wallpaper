import { Vector2, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { ROLL_SHAPE, ROLL_TERMS, rollDensity, rollFrame, rollGlsl, rollShapeWith } from '../src/rollCloud'
import type { RollCloudParams } from '../src/skyEvents'
import { allParams, scene } from './days'

const camera = new Vector3(0, 0, 0)

const rolls = (): { roll: RollCloudParams; heading: number }[] => [
  { roll: scene({ rollCloud: true }).rollCloud!, heading: scene({ rollCloud: true }).camera.headingDeg },
  ...allParams()
    .filter(p => p.rollCloud != null)
    .map(p => ({ roll: p.rollCloud!, heading: p.camera.headingDeg })),
  { roll: { axisDeg: 30, distanceM: 4000, baseM: 150, depthM: 1000, widthM: 1500, rolls: 3, spacingM: 3500, seed: 7 }, heading: 300 }
]

/** A world point `along` m along the rolls' axis and `across` m away from the camera. */
function at(roll: RollCloudParams, heading: number, along: number, across: number): [number, number] {
  const f = rollFrame(roll, camera, heading)
  const p = new Vector2().copy(f.centre).addScaledVector(f.axis, along).addScaledVector(f.toBack, across)
  return [p.x, p.y]
}

describe('Morning Glory rolls', () => {
  it('draws the sizes the sources give: base 100–250 m, ~1 km deep, 1–2 km wide', () => {
    for (const { roll } of rolls().slice(0, -1)) {
      expect(roll.baseM).toBeGreaterThanOrEqual(100)
      expect(roll.baseM).toBeLessThanOrEqual(250)
      expect(roll.depthM).toBeGreaterThanOrEqual(800)
      expect(roll.depthM).toBeLessThanOrEqual(1200)
      expect(roll.widthM).toBeGreaterThanOrEqual(1000)
      expect(roll.widthM).toBeLessThanOrEqual(2000)
    }
  })

  it('is a tube: full in its middle, empty below its base, above its top and past its ends', () => {
    for (const { roll, heading } of rolls()) {
      const f = rollFrame(roll, camera, heading)
      const top = roll.baseM + roll.depthM * (1 + ROLL_SHAPE.lumpLarge + ROLL_SHAPE.lumpSmall) + 2 * ROLL_SHAPE.riseM
      for (const along of [-30_000, 0, 12_000]) {
        // The middle of the first roll, give or take its wander.
        let inside = 0
        for (let c = -ROLL_SHAPE.wanderM; c <= ROLL_SHAPE.wanderM; c += 20) inside = Math.max(inside, rollDensity(f, roll, ...at(roll, heading, along, c), roll.baseM + roll.depthM / 2))
        expect(inside).toBeGreaterThanOrEqual(0.9)
        for (let c = -3000; c <= roll.rolls * roll.spacingM + 3000; c += 250) {
          expect(rollDensity(f, roll, ...at(roll, heading, along, c), roll.baseM - ROLL_SHAPE.riseM - roll.depthM * 0.5 * ROLL_SHAPE.baseFlatten * (ROLL_SHAPE.lumpLarge + ROLL_SHAPE.lumpSmall + ROLL_SHAPE.leadEdge) - 30)).toBe(0)
          expect(rollDensity(f, roll, ...at(roll, heading, along, c), top + 150)).toBe(0)
        }
      }
      expect(rollDensity(f, roll, ...at(roll, heading, ROLL_SHAPE.halfLengthM + 100, 0), roll.baseM + roll.depthM / 2)).toBe(0)
    }
  })

  it('stacks later rolls behind the first, away from the camera', () => {
    for (const { roll, heading } of rolls().filter(r => r.roll.rolls > 1)) {
      const f = rollFrame(roll, camera, heading)
      const h = roll.baseM + roll.depthM / 2
      for (let k = 1; k < roll.rolls; k++) {
        let best = 0
        for (let c = k * roll.spacingM - ROLL_SHAPE.wanderM; c <= k * roll.spacingM + ROLL_SHAPE.wanderM; c += 20) best = Math.max(best, rollDensity(f, roll, ...at(roll, heading, 0, c), h * (1 - 0.1 * k)))
        expect(best).toBeGreaterThanOrEqual(0.9)
      }
      // The camera side is in front: toBack points away from it.
      expect(new Vector2(f.centre.x, f.centre.y).dot(f.toBack)).toBeGreaterThan(0)
    }
  })

  it('has a sharp leading edge (the camera side) and a soft trailing one', () => {
    const { roll, heading } = rolls().at(-1)!
    const f = rollFrame(roll, camera, heading)
    const h = roll.baseM + roll.depthM / 2
    const width = (side: 1 | -1) => {
      let from = NaN
      let to = NaN
      for (let c = 0; Math.abs(c) < 2 * roll.widthM; c += side * 5) {
        const d = rollDensity(f, roll, ...at(roll, heading, 0, c), h)
        if (Number.isNaN(from) && d < 0.9) from = c
        if (d < 0.1) {
          to = c
          break
        }
      }
      return Math.abs(to - from)
    }
    expect(width(1)).toBeGreaterThan(2 * width(-1))
  })

  it('has no density past the GLSL early exit (widest lump, softest edge, wander)', () => {
    const bound = (1 + ROLL_SHAPE.trailEdge) * (1 + ROLL_SHAPE.lumpLarge + ROLL_SHAPE.lumpSmall)
    for (const { roll, heading } of rolls()) {
      const f = rollFrame(roll, camera, heading)
      for (let along = -40_000; along <= 40_000; along += 3_700)
        for (let k = 0; k < roll.rolls; k++) {
          const halfW = (roll.widthM / 2) * (1 - ROLL_SHAPE.shrinkPerRoll * k)
          for (const side of [-1, 1]) {
            const c = k * roll.spacingM + side * (halfW * bound + ROLL_SHAPE.wanderM + 5)
            // Only this tube can be here if the spacing is wide; nearer tubes are checked on their own.
            const others = Array.from({ length: roll.rolls }, (_, j) => j).filter(j => j !== k)
            if (others.some(j => Math.abs(c - j * roll.spacingM) < roll.widthM * bound + ROLL_SHAPE.wanderM)) continue
            for (let h = 0; h < 1600; h += 40) expect(rollDensity(f, roll, ...at(roll, heading, along, c), h)).toBe(0)
          }
        }
    }
  })

  it('switches each detail term off on the CPU and in the GLSL alike (params.debug.roll)', () => {
    expect(rollShapeWith(undefined)).toEqual(ROLL_SHAPE)
    for (const [term, keys] of Object.entries(ROLL_TERMS)) {
      const shape = rollShapeWith({ [term]: false })
      for (const k of keys) {
        expect(shape[k]).toBe(0)
        expect(ROLL_SHAPE[k]).not.toBe(0)
      }
    }
    // Lumps off: a plain tube, its radius the same all round.
    const { roll, heading } = rolls().at(-1)!
    const f = rollFrame(roll, camera, heading)
    const plain = rollShapeWith({ lumps: false, wander: false, rise: false })
    const centreH = roll.baseM + roll.depthM / 2
    expect(rollDensity(f, roll, ...at(roll, heading, 0, 0), centreH, plain)).toBe(1)
    expect(rollDensity(f, roll, ...at(roll, heading, 5000, 0), centreH, plain)).toBe(1)
    expect(rollGlsl(rollShapeWith({ lumps: false }))).toContain('float lumps = 1.0\n      + 0.000 *')
  })
})
