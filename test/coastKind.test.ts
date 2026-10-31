import { describe, expect, it } from 'vitest'

import { COAST_KINDS, hasBeach, hasLand, hasSurfZone, type CoastKind } from '../src/coastKind'
import { terrainHeight, terrainUniforms } from '../src/terrain'
import { scene } from './days'

describe('coast kinds', () => {
  it('answer the helper questions per kind', () => {
    const table: Record<CoastKind, [land: boolean, beach: boolean, surf: boolean]> = {
      'open-sea': [false, false, false],
      beach: [true, true, true],
      'rock-shore': [true, false, true],
      'tidal-flat': [true, false, false]
    }
    for (const type of COAST_KINDS) {
      expect([hasLand({ type }), hasBeach({ type }), hasSurfZone({ type })]).toEqual(table[type])
    }
  })

  it('give the shader the index the GLSL constants expect', () => {
    expect(COAST_KINDS).toEqual(['open-sea', 'beach', 'rock-shore', 'tidal-flat'])
    expect(terrainUniforms(scene({ coast: 'open-sea' }).coast).coastKind.value).toBe(0)
    expect(terrainUniforms(scene({ coast: 'beach' }).coast).coastKind.value).toBe(1)
  })

  it('give tidal flats their own profile and index', () => {
    const flat = scene({ eclipse: null, coast: 'tidal-flat' }).coast
    expect(terrainUniforms(flat).coastKind.value).toBe(3)
    expect(terrainHeight(flat, 0, 0)).not.toBe(terrainHeight({ ...flat, type: 'beach' }, 0, 0))
  })
})
