import { describe, expect, it } from 'vitest'

import { TERRAIN_VIEWS } from '../src/debug'
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
  water: true,
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
    for (const view of TERRAIN_VIEWS) expect(() => parseSceneSpec({ params: { debug: { terrainView: view } } })).not.toThrow()
  })
})

describe('terrain probe spec', () => {
  it('takes known terms at points or on a grid', () => {
    expect(() => parseSceneSpec({ params: { debug: { terrainProbe: { terms: ['h', 's', 'pools'], at: [[0.5, 0.9], { world: [1, 0, -20] }], every: 16 } } } } as never)).not.toThrow()
    expect(() => parseSceneSpec({ params: { debug: { terrainProbe: { terms: ['height'], every: 8 } } } } as never)).toThrow(/"height"/)
    expect(() => parseSceneSpec({ params: { debug: { terrainProbe: { terms: ['h'] } } } } as never)).toThrow(/at .* or every/)
    expect(() => parseSceneSpec({ params: { debug: { terrainProbe: { terms: ['h'], every: 0 } } } } as never)).toThrow(/every/)
    expect(() => parseSceneSpec({ params: { debug: { terrainProbe: { terms: ['h'], at: [[2, 0]] } } } } as never)).toThrow(/at\[0\]/)
  })
})

describe('probe spec', () => {
  it('takes image points, sky directions, world points and their mirror images', () => {
    const probe = [[0.5, 0.5], { az: 0, el: 1 }, { world: [10, 2, -300] }, { mirror: [10, 2, -300] }]
    expect(() => parseSceneSpec({ params: { debug: { probe } } } as never)).not.toThrow()
    expect(() => parseSceneSpec({ params: { debug: { probe: [{ world: [1, 2] }] } } } as never)).toThrow(/world: \[x, y, z\]/)
    expect(() => parseSceneSpec({ params: { debug: { probe: [{ mirror: [1, 2, 3], az: 0 }] } } } as never)).toThrow(/mirror/)
  })
})

describe('cube probe spec', () => {
  it('takes sky directions and a mip level', () => {
    expect(() => parseSceneSpec({ params: { debug: { cubeProbe: [{ az: 0, el: -1 }, { az: 0, el: 1, lod: 5 }], cubeProbeLod: 5 } } } as never)).not.toThrow()
    expect(() => parseSceneSpec({ params: { debug: { cubeProbe: [{ az: 0, el: 1, lod: 11 }] } } } as never)).toThrow(/lod 0–10/)
    expect(() => parseSceneSpec({ params: { debug: { cubeProbe: [[0.5, 0.5]] } } } as never)).toThrow(/az, el/)
    expect(() => parseSceneSpec({ params: { debug: { cubeProbeLod: 12 } } } as never)).toThrow(/0–10/)
  })
})

describe('probe line spec', () => {
  it('takes a line or a list, one range each', () => {
    expect(() => parseSceneSpec({ params: { debug: { probeLine: { az: 0, el: [2, 40] } } } })).not.toThrow()
    expect(() => parseSceneSpec({ params: { debug: { probeLine: [{ az: [-40, 40], el: 12, step: 0.1 }, { az: 5, el: [2, 9] }] } } })).not.toThrow()
    expect(() => parseSceneSpec({ params: { debug: { probeLine: { az: 0, el: 3 } } } })).toThrow(/exactly one/)
    expect(() => parseSceneSpec({ params: { debug: { probeLine: { az: [0, 1], el: 3, step: 0 } } } })).toThrow(/step/)
    expect(() => parseSceneSpec({ params: { debug: { probeLine: { az: [0, 1], el: 3, at: 1 } } } })).toThrow(/line field/)
  })
})
