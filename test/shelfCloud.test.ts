import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { lipHeight, lipLine, SHELF_SHAPE, SHELF_TERMS, shelfDensity, shelfFrame, shelfGlsl, shelfShapeWith, shelfSunScale, shelfTop } from '../src/shelfCloud'
import { dirFromAzEl } from '../src/params'
import type { ShelfCloudParams } from '../src/skyEvents'
import { allParams, scene } from './days'

const BASE = 600
/** The deepest the tattered underside's fringes hang below its smooth line (m). */
const TATTER = SHELF_SHAPE.tatterM + SHELF_SHAPE.tatter2M + SHELF_SHAPE.tatter3M
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
        expect(at(along, 300, lipHeight(shelf, along) - 60 - TATTER)).toBe(0)
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
        expect(Math.abs(lowest - lipHeight(shelf, along))).toBeLessThan(0.1 * lipHeight(shelf, along) + TATTER)
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
        // Just behind the lip, nothing below it but the tattered fringe.
        expect(shelfDensity(frame, shelf, BASE, ...pointOn(shelf, along, 40), lip - 40 - TATTER)).toBe(0)
      }
    }
  })

  // D13: the lip is tattered at scales under ~500 m (not the 1.2 km waves
  // that read as hills), within TATTER of its smooth line.
  it('has a ragged lip: fringes tens of metres deep, hundreds of metres apart', () => {
    const shelf = shelves()[0]
    const frame = shelfFrame(shelf, camera)
    const lowest = (along: number): number => {
      for (let h = 0; h < 1200; h += 2) if (shelfDensity(frame, shelf, BASE, ...pointOn(shelf, along, 80), h) > 0.5) return h
      return NaN
    }
    const smooth = shelfShapeWith({ tatter: false })
    const smoothLowest = (along: number): number => {
      for (let h = 0; h < 1200; h += 2) if (shelfDensity(frame, shelf, BASE, ...pointOn(shelf, along, 80), h, smooth) > 0.5) return h
      return NaN
    }
    const offsets: number[] = []
    for (let along = 0; along < 3000; along += 25) offsets.push(lowest(along) - smoothLowest(along))
    // Fringes hang down only (pointed, never bites up: those read as hills).
    for (const o of offsets) {
      expect(o).toBeLessThanOrEqual(2)
      expect(o).toBeGreaterThanOrEqual(-TATTER - 2)
    }
    // Ragged: it moves ≥ 10 m between points 100 m apart somewhere, and spans ≥ 25 m.
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeGreaterThanOrEqual(25)
    expect(Math.max(...offsets.slice(4).map((o, i) => Math.abs(o - offsets[i])))).toBeGreaterThanOrEqual(10)
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

describe('shelf cloud sun', () => {
  // A shelf due north (azimuth 0) of the camera: the storm lies beyond it.
  const frame = shelfFrame({ azimuthDeg: 0, distanceM: 5000 } as ShelfCloudParams, new Vector3())
  it('is in the storm\'s shadow with the sun behind the storm, lit with the sun behind the camera', () => {
    expect(shelfSunScale(frame, dirFromAzEl(0, 20))).toBe(0)
    expect(shelfSunScale(frame, dirFromAzEl(40, 23))).toBe(0)
    expect(shelfSunScale(frame, dirFromAzEl(180, 20))).toBe(1)
    expect(shelfSunScale(frame, dirFromAzEl(140, 10))).toBe(1)
    expect(shelfSunScale(frame, dirFromAzEl(90, 10))).toBeCloseTo(0.5)
    // Overhead: no side to take.
    expect(shelfSunScale(frame, [0, 1, 0])).toBe(1)
  })
})

