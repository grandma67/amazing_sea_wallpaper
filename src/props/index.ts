import { Group, type Mesh, type Object3D } from 'three'

import type { PropContext } from './context'
import { createBirds } from './birds'
import { createColony } from './colony'
import { createDebris } from './debris'
import { createIce } from './ice'
import { createIslands } from './islands'
import { createLandforms } from './landforms'
import { createLighthouse } from './lighthouse'
import { createMarineLife } from './marine'
import { createMigratoryBirds } from './migratory'
import { createPinnipeds } from './pinnipeds'
import { createRocks } from './rocks'
import { createShips } from './ships'
import { createShoreLife } from './shoreLife'
import { createStorm } from './storm'
import { createSurf, waterRocks, waveOnRock } from './surf'
import { createVegetation } from './vegetation'

/** Everything placed in the scene on top of sea, sky and terrain. */
export function createProps(ctx: PropContext): Group {
  const group = new Group()
  group.name = 'props'
  /** Adds a creator's objects, tagged with its kind for reportProps(). */
  const add = <T extends Object3D>(kind: string, objects: T[]): T[] => {
    for (const o of objects) {
      o.userData.prop = kind
      group.add(o)
    }
    return objects
  }
  add('landforms', createLandforms(ctx))
  const rocks = add('rocks', createRocks(ctx))
  add('surf', createSurf(ctx, rocks))
  // For the ocean's foam round them (ocean.ts setOceanRocks).
  group.userData.waterRocks = waterRocks(ctx, rocks).map(r => ({ ...r, breaks: waveOnRock(ctx.params.coast, r, ctx.waveHeight).breaks }))
  add('ice', createIce(ctx))
  add('debris', createDebris(ctx))
  add('shore-life', createShoreLife(ctx))
  const colony = add('colony', createColony(ctx))
  const island = (colony.find(o => o.userData.island === true) as Mesh | undefined) ?? null
  add('islands', createIslands(ctx, island))
  add('pinnipeds', createPinnipeds(ctx, island))
  add('lighthouse', createLighthouse(ctx, island))
  add('vegetation', createVegetation(ctx))
  add('ships', createShips(ctx))
  add('marine-life', createMarineLife(ctx))
  add('birds', createBirds(ctx))
  add('migratory-birds', createMigratoryBirds(ctx))
  add('storm', createStorm(ctx))
  return group
}
