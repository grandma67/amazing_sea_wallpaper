import { describe, expect, it } from 'vitest'
import type { Object3D } from 'three'

import { createBeachrock } from '../src/props/beachrock'
import { createBirds } from '../src/props/birds'
import type { PropContext } from '../src/props/context'
import { createDebris } from '../src/props/debris'
import { createFungi } from '../src/props/fungi'
import { createFireflies } from '../src/props/fireflies'
import { createIceFoot } from '../src/props/iceFoot'
import { createLeafLitter } from '../src/props/leafLitter'
import { createMangroves } from '../src/props/mangroves'
import { createMarineLife } from '../src/props/marine'
import { createMigratoryBirds } from '../src/props/migratory'
import { createRocks } from '../src/props/rocks'
import { createSaltMarsh } from '../src/props/saltMarsh'
import { createSeaIce } from '../src/props/seaIce'
import { createShips } from '../src/props/ships'
import { createShoreLife } from '../src/props/shoreLife'
import { createStones } from '../src/props/stones'
import { createVegetation } from '../src/props/vegetation'
import { createWildlife } from '../src/props/wildlife'
import type { SceneSpec } from '../src/sceneSpec'
import { expectEvery, scenes, view, viewOf } from './days'
import { instancePositions } from './mesh'

// Single creators, with no WebGL: a separate file from props.test.ts because
// the workers take whole files, and the longest file sets the run's wall time.

describe('plants', () => {
  it('keep bushes off the camera’s feet, on cliffs and beaches', () => {
    for (const shore of [{ rockShore: 'cliff' }, { coast: 'beach', composition: 'framed' }] as const) {
      const contexts = scenes({ eclipse: null, place: 'scotland', ...shore, props: { vegetation: ['bush', 'grass'] } }, 4).map(p => viewOf(p))
      const bushes = contexts.flatMap(ctx => instancePositions(createVegetation(ctx).filter(m => m.userData.plantKind === 'bush')).map(v => ctx.distance(v.x, v.z)))
      expectEvery(bushes, d => d >= 6)
    }
  })
})

// CLAUDE.md "Every new prop gets an off switch", so diff.mjs can show what it
// adds. A new prop gets a row: a scene with some of it, and the switch.
describe('off switches', () => {
  const BEACH: SceneSpec = { eclipse: null, coast: 'beach', storm: null, fog: null, timeOfDay: 'daylight', weather: 'few' }
  const plants = (ctx: PropContext): Object3D[] => createLeafLitter(ctx, createVegetation(ctx))
  const rows: [kind: string, on: SceneSpec, off: SceneSpec['props'], create: (ctx: PropContext) => Object3D[], date?: string][] = [
    ['rocks', { ...BEACH, place: 'scotland', beachMaterial: 'cobble', composition: 'along-beach' }, { rocks: false, seaStacks: false }, createRocks],
    ['stones', { ...BEACH, place: 'nova-scotia', beachMaterial: 'cobble', composition: 'shoreline' }, { stones: false }, createStones],
    ['beachrock', { ...BEACH, place: 'antilles', beachMaterial: 'sand', composition: 'along-beach', beachrock: true }, { beachrock: false }, createBeachrock, '2025-07-10'],
    ['debris', { ...BEACH, place: 'nova-scotia', props: { debris: { driftwood: 1, wrack: null, coconuts: 0 } } }, { debris: null }, createDebris],
    ['shore life', { ...BEACH, place: 'florida-carolinas', beachMaterial: 'sand', composition: 'shoreline', props: { shoreLife: { crab: 'ghost' } } }, { shoreLife: null }, createShoreLife],
    ['wildlife', { ...BEACH, biome: 'tropical', composition: 'along-beach', props: { wildlife: { monkey: 'capuchin' } } }, { wildlife: null }, createWildlife, '2024-09-30'],
    ['mangroves', { ...BEACH, biome: 'tropical', props: { mangroves: 'rhizophora' } }, { mangroves: null }, createMangroves],
    ['salt marsh', { ...BEACH, place: 'wadden-north-sea', saltMarsh: true, tide: 'high', composition: 'framed' }, { saltMarsh: false }, createSaltMarsh, '2025-07-10'],
    ['leaf litter', { ...BEACH, place: 'brittany', composition: 'framed', timeOfDay: 'midday', props: { vegetation: ['broadleaf'] } }, { vegetation: ['broadleaf'], leafLitter: false }, plants, '2025-01-15'],
    ['sea ice', { eclipse: null, place: 'baltic', seaIce: 'fast' }, { seaIce: false }, createSeaIce, '2025-02-20'],
    ['ice foot', { eclipse: null, place: 'greenland', coast: 'beach', snow: true, props: { iceFoot: true } }, { iceFoot: false }, createIceFoot, '2025-02-15'],
    ['ships', { ...BEACH, coast: 'open-sea', props: { ships: ['container-ship'] } }, { ships: false }, createShips, '2024-09-30'],
    ['gulls', { ...BEACH, props: { birds: true } }, { birds: false }, createBirds],
    ['marine life', { ...BEACH, coast: 'open-sea', props: { marine: 'dolphin' } }, { marine: null }, createMarineLife, '2024-09-30'],
    ['migratory birds', { ...BEACH, props: { migratory: 'goose' } }, { migratory: null }, createMigratoryBirds],
    ['fungi', { ...BEACH, place: 'scotland', composition: 'framed', props: { vegetation: ['birch', 'conifer'], fungi: true } }, { vegetation: ['birch', 'conifer'], fungi: false }, ctx => createFungi(ctx, createVegetation(ctx)), '2025-10-28'],
    ['fireflies', { ...BEACH, place: 'maine', composition: 'framed', timeOfDay: 'night', props: { fireflies: 'flash' } }, { fireflies: false }, ctx => createFireflies(ctx, createVegetation(ctx), []), '2025-07-10'],
    ['eucalyptus', { ...BEACH, place: 'east-australia', composition: 'framed', props: { vegetation: ['eucalyptus'] } }, { vegetation: ['eucalyptus'], eucalyptus: false }, createVegetation]
  ]

  it.each(rows)('%s', (_, on, off, create, date) => {
    expect(create(view(on, 1080, date)).length, 'none to switch off').toBeGreaterThan(0)
    expect(create(view({ ...on, props: { ...on.props, ...off } }, 1080, date))).toEqual([])
  })

  it('eucalyptus off leaves the other plants as they were', () => {
    const on = { ...BEACH, place: 'east-australia', composition: 'overlook' } as const
    const kinds = (spec: SceneSpec) => createVegetation(view(spec, 1080)).map(m => [m.userData.plantKind, m.count, m.instanceMatrix.array[12]])
    const all = kinds(on)
    expect(all.some(([k]) => k === 'eucalyptus')).toBe(true)
    expect(kinds({ ...on, props: { eucalyptus: false } })).toEqual(all.filter(([k]) => k !== 'eucalyptus'))
  })
})
