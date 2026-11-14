import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { lipHeight, lipLine, SHELF_SHAPE, SHELF_TERMS, shelfDensity, shelfFrame, shelfGlsl, shelfShapeWith, shelfTop } from '../src/shelfCloud'
import type { ShelfCloudParams } from '../src/skyEvents'
import { allParams, scene } from './days'

const BASE = 600
const camera = new Vector3(0, 0, 0)

/** A world point `back` m behind the lip line and `along` m along the front:
 * the frame's own coordinates. */
function pointOn(shelf: ShelfCloudParams, along: number, back: number): [number, number] {
  const frame = shelfFrame(shelf, camera)
  const p = frame.origin.clone().addScaledVector(frame.across, along).addScaledVector(frame.toStorm, back + lipLine(shelf, along))
  return [p.x, p.y]
}

const shelves = (): ShelfCloudParams[] => [
  scene({ storm: 'squall', shelfCloud: true, eclipse: null, timeOfDay: 'daylight' }).storm!.shelf!,
  ...allParams()
    .filter(p => p.storm?.shelf != null)
    .slice(0, 20)
    .map(p => p.storm!.shelf!)
]

describe('shelf cloud density', () => {
  it('is a wedge: empty in front of the lip, below it and above the top; full just behind the lip', () => {
    for (const shelf of shelves()) {
      const frame = shelfFrame(shelf, camera)
      const at = (along: number, back: number, h: number) => shelfDensity(frame, shelf, BASE, ...pointOn(shelf, along, back), h)
      for (const along of [-30_000, -5_000, 0, 7_000, 25_000]) {
        expect(at(along, -200, lipHeight(shelf, along) + 50)).toBe(0)
        expect(at(along, 300, lipHeight(shelf, along) - 60)).toBe(0)
        expect(at(along, 1500, shelfTop(BASE) + 100)).toBe(0)
        expect(at(along, 250, lipHeight(shelf, along) + 60)).toBeGreaterThanOrEqual(0.9)
      }
      // Off the ends and past the back: the storm's deck, not the shelf.
      expect(at(SHELF_SHAPE.halfLengthM + 100, 500, shelf.lipHeightM + 100)).toBe(0)
      expect(at(0, shelf.depthM + 10, shelfTop(BASE) - 100)).toBe(0)
    }
  })

  it('has its lip at its local height all along the front, and the face sloping back as it rises', () => {
    for (const shelf of shelves()) {
      const frame = shelfFrame(shelf, camera)
      for (const along of [-35_000, -12_000, 0, 9_000, 33_000]) {
        // The lowest height with cloud just behind the lip.
        let lowest = 0
        for (let h = 0; h < 1200; h += 5) {
          if (shelfDensity(frame, shelf, BASE, ...pointOn(shelf, along, 80), h) > 0.5) {
            lowest = h
            break
          }
        }
        expect(Math.abs(lowest - lipHeight(shelf, along)) / lipHeight(shelf, along)).toBeLessThan(0.1)
        // The lip varies along the front, within ±13.5% of the drawn height.
        expect(Math.abs(lipHeight(shelf, along) / shelf.lipHeightM - 1)).toBeLessThanOrEqual(0.135)
        // Where the face stands, going up: farther back each time, but for a
        // tier (a groove under a bulge) and a striation, which lean out a little; the
        // top well behind the lip.
        const lean = SHELF_SHAPE.tierGrooveM + SHELF_SHAPE.tierBulgeM + SHELF_SHAPE.striaM
        let first = NaN
        let last = -Infinity
        for (const h of [shelf.lipHeightM + 30, (shelf.lipHeightM + shelfTop(BASE)) / 2, shelfTop(BASE) - 120]) {
          let front = 0
          for (let back = -300; back < 3000; back += 5) {
            if (shelfDensity(frame, shelf, BASE, ...pointOn(shelf, along, back), h) > 0.5) {
              front = back
              break
            }
          }
          expect(front).toBeGreaterThan(last - lean)
          if (Number.isNaN(first)) first = front
          last = front
        }
        expect(last - first).toBeGreaterThan(200)
      }
    }
  })

  it('keeps tiers and striations inside the wedge: nothing in front of the lip or under it', () => {
    for (const shelf of shelves()) {
      const frame = shelfFrame(shelf, camera)
      for (let along = -36_000; along <= 36_000; along += 1_700) {
        const lip = lipHeight(shelf, along)
        for (let h = 5; h < shelfTop(BASE) + 150; h += 25) expect(shelfDensity(frame, shelf, BASE, ...pointOn(shelf, along, -120), h)).toBe(0)
        // Just behind the lip, nothing below it.
        expect(shelfDensity(frame, shelf, BASE, ...pointOn(shelf, along, 40), lip - 40)).toBe(0)
      }
    }
  })

  it('prints its cross-section (height × distance behind the lip)', () => {
    const shelf = shelves()[0]
    const frame = shelfFrame(shelf, camera)
    const backs = [-100, 0, 100, 300, 600, 1000, 1500, 2000, 3000, 4000]
    const rows = [shelfTop(BASE) + 50, 850, 750, 650, 550, 450, 400, 350, 300, 250, 200].map(h =>
      `${String(h).padStart(5)} m ` + backs.map(b => ' .:-=+*#%@'[Math.round(shelfDensity(frame, shelf, BASE, ...pointOn(shelf, 0, b), h) * 9)]).join('  ')
    )
    console.log(`shelf lip ${Math.round(shelf.lipHeightM)} m, depth ${Math.round(shelf.depthM)} m, tiers ${shelf.tiers}; back (m): ${backs.join(' ')}\n${rows.join('\n')}`)
  })

  it('switches each detail term off on the CPU and in the GLSL alike (params.debug.shelf)', () => {
    expect(shelfShapeWith(undefined)).toEqual(SHELF_SHAPE)
    for (const [term, keys] of Object.entries(SHELF_TERMS)) {
      const shape = shelfShapeWith({ [term]: false })
      for (const k of keys) {
        expect(shape[k]).toBe(0)
        expect(SHELF_SHAPE[k]).not.toBe(0)
      }
      // Nothing else changes.
      for (const k of Object.keys(SHELF_SHAPE) as (keyof typeof SHELF_SHAPE)[]) if (!(keys as readonly string[]).includes(k)) expect(shape[k]).toBe(SHELF_SHAPE[k])
    }
    // The GLSL is written from the shape: the striations' amplitude goes to 0.0.
    expect(shelfGlsl(shelfShapeWith({ stria: false }))).toContain('faceBack += 0.0 * sin(')
    expect(shelfGlsl()).toContain(`faceBack += ${SHELF_SHAPE.striaM.toFixed(1)} * sin(`)
  })
})
