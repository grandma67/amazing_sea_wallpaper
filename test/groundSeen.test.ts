import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { groundKind, groundSeen, terrainHides } from '../src/groundSeen'
import { shoreToWorld, terrainHeight } from '../src/terrain'
import { scene, viewOf } from './days'

// groundSeen.ts: the ground a camera sees, by band and kind (no render).

describe('ground seen', () => {
  const p = scene({ eclipse: null, place: 'ireland', coast: 'beach', composition: 'overlook' }, '2025-10-10')

  it('splits what is in frame into bands and kinds, the same each time', () => {
    const ctx = viewOf(p)
    const seen = groundSeen(ctx)
    expect(groundSeen(ctx)).toEqual(seen)
    const total = Object.values(seen).reduce((s, b) => s + b.turf + b.sparse + b.bare + b.sea, 0)
    expect(total).toBeGreaterThan(1000)
    // This overlook stands ~600 m from the water: the sea is past 300 m.
    expect(seen.far.sea).toBe(0)
    const wide = groundSeen(ctx, 1000)
    expect(wide.far.sea).toBeGreaterThan(0)
  })

  it('the terrain hides what is behind it; open ground is seen', () => {
    const eye = new Vector3(0, terrainHeight(p.coast, 0, 0) + 1.6, 0)
    // A point 5 m under the ground just ahead is hidden; one floating 50 m up isn't.
    expect(terrainHides(p.coast, eye, new Vector3(0, terrainHeight(p.coast, 0, -40) - 5, -40))).toBe(true)
    expect(terrainHides(p.coast, eye, new Vector3(0, 50, -40))).toBe(false)
  })

  it('sea below 0.3 m', () => {
    const [x, z] = shoreToWorld(p.coast, 300, 0)
    expect(groundKind(p.coast, x, z)).toBe('sea')
  })
})
