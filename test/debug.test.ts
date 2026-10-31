import { describe, expect, it } from 'vitest'

import { generateParams } from '../src/params'
import { parseSceneSpec } from '../src/sceneSpec'
import { DAYS } from './days'

const all = {
  terrainGrid: 2,
  props: false,
  markers: ['camera-ground', 'edge-rocks', 'props:rocks'],
  passes: { clouds: false, aerial: false, skyFill: false, bloom: false, reflection: false, shadows: false },
  exposure: 1.5,
  terrainView: 'slope',
  oceanView: 'breaking'
} as const

describe('debug switches', () => {
  it('change nothing the generator makes: only params.debug differs', () => {
    for (const date of DAYS.filter((_, i) => i % 37 === 0)) {
      for (const spec of [{}, { rockShore: 'platform' as const }]) {
        const plain = generateParams(date, 0, 16 / 9, spec)
        const debug = generateParams(date, 0, 16 / 9, parseSceneSpec({ ...spec, params: { debug: all } }))
        expect(debug.debug).toEqual(all)
        expect({ ...debug, debug: undefined }).toEqual({ ...plain, debug: undefined })
      }
    }
  })

  it('are checked: a typo throws instead of doing nothing', () => {
    expect(() => parseSceneSpec({ params: { debug: { terainView: 'slope' } } })).toThrow(/terainView/)
    expect(() => parseSceneSpec({ params: { debug: { terrainView: 'slopes' } } })).toThrow(/terrainView/)
    expect(() => parseSceneSpec({ params: { debug: { passes: { blom: false } } } })).toThrow(/blom/)
    expect(() => parseSceneSpec({ params: { debug: { markers: ['rocks'] } } })).toThrow(/props:KIND/)
    expect(() => parseSceneSpec({ params: { debug: { terrainGrid: 8 } } })).toThrow(/terrainGrid/)
    expect(() => parseSceneSpec({ params: { debug: all } })).not.toThrow()
  })
})
