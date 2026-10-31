import { Group, type Mesh, type Object3D } from 'three'

import type { PropContext } from './context'
import { createBeachrock } from './beachrock'
import { createBirds } from './birds'
import { createRollCloud, createShelfCloud } from './cloudEvents'
import { createColony } from './colony'
import { createDebris } from './debris'
import { createIce } from './ice'
import { createIslands } from './islands'
import { createLandforms } from './landforms'
import { createLighthouse } from './lighthouse'
import { createMangroves } from './mangroves'
import { createMarineLife } from './marine'
import { createMigratoryBirds } from './migratory'
import { createPinnipeds } from './pinnipeds'
import { createRocks } from './rocks'
import { createShips } from './ships'
import { createShoreLife } from './shoreLife'
import { createStones } from './stones'
import { createStorm } from './storm'
import { createSurf, edgeRocks, waterRocks, waveOnRock } from './surf'
import { createVegetation } from './vegetation'
import { createWaterspout } from './waterspout'
import { createWildlife } from './wildlife'

/** Everything placed in the scene on top of sea, sky and terrain. */
export function createProps(ctx: PropContext): Group {
  const group = new Group()
  group.name = 'props'
  // Build time (ms) per kind, for snapshot.mjs --props.
  const times: Record<string, number> = {}
  group.userData.times = times
  /** Runs a creator and adds its objects, tagged with its kind for
   * reportProps(), timing it. */
  const add = <T extends Object3D>(kind: string, create: () => T[]): T[] => {
    const start = performance.now()
    const objects = create()
    times[kind] = (times[kind] ?? 0) + performance.now() - start
    for (const o of objects) {
      o.userData.prop = kind
      group.add(o)
    }
    return objects
  }
  add('landforms', () => createLandforms(ctx))
  const rocks = add('rocks', () => createRocks(ctx))
  add('surf', () => createSurf(ctx, rocks))
  // For the ocean's foam round them (ocean.ts setOceanRocks).
  group.userData.waterRocks = [...waterRocks(ctx, rocks), ...edgeRocks(ctx)].map(r => ({ ...r, breaks: waveOnRock(ctx.params.coast, r, ctx.waveHeight).breaks }))
  add('ice', () => createIce(ctx))
  // Where mesh stones replace the shader's (terrain.ts stoneMeshRadius).
  group.userData.stoneRadius = add('stones', () => createStones(ctx))[0]?.userData.stoneRadius ?? [0, 0, 0]
  add('beachrock', () => createBeachrock(ctx))
  add('debris', () => createDebris(ctx))
  add('shore-life', () => createShoreLife(ctx))
  add('wildlife', () => createWildlife(ctx))
  const colony = add('colony', () => createColony(ctx))
  const island = (colony.find(o => o.userData.island === true) as Mesh | undefined) ?? null
  add('islands', () => createIslands(ctx, island))
  add('pinnipeds', () => createPinnipeds(ctx, island))
  add('lighthouse', () => createLighthouse(ctx, island))
  add('vegetation', () => createVegetation(ctx))
  add('mangroves', () => createMangroves(ctx))
  // For their wakes and the hull cut out of the sea (ocean.ts setOceanShips).
  group.userData.ships = add('ships', () => createShips(ctx)).flatMap(o => o.userData.wake ?? [])
  add('marine-life', () => createMarineLife(ctx))
  add('birds', () => createBirds(ctx))
  add('migratory-birds', () => createMigratoryBirds(ctx))
  add('storm', () => createStorm(ctx))
  add('waterspout', () => createWaterspout(ctx))
  add('shelf-cloud', () => createShelfCloud(ctx))
  add('roll-cloud', () => createRollCloud(ctx))
  return group
}
