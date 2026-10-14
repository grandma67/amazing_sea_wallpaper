import { Group } from 'three'

import type { PropContext } from './context'
import { createBirds } from './birds'
import { createColony } from './colony'
import { createIce } from './ice'
import { createLandforms } from './landforms'
import { createMarineLife } from './marine'
import { createMigratoryBirds } from './migratory'
import { createRocks } from './rocks'
import { createShips } from './ships'
import { createStorm } from './storm'
import { createSurf } from './surf'
import { createVegetation } from './vegetation'

/** Everything placed in the scene on top of sea, sky and terrain. */
export function createProps(ctx: PropContext): Group {
  const group = new Group()
  group.name = 'props'
  for (const object of createLandforms(ctx)) group.add(object)
  const rocks = createRocks(ctx)
  for (const mesh of rocks) group.add(mesh)
  for (const points of createSurf(ctx, rocks)) group.add(points)
  for (const mesh of createIce(ctx)) group.add(mesh)
  for (const object of createColony(ctx)) group.add(object)
  for (const mesh of createVegetation(ctx)) group.add(mesh)
  for (const mesh of createShips(ctx)) group.add(mesh)
  for (const animal of createMarineLife(ctx)) group.add(animal)
  for (const mesh of createBirds(ctx)) group.add(mesh)
  for (const mesh of createMigratoryBirds(ctx)) group.add(mesh)
  for (const object of createStorm(ctx)) group.add(object)
  return group
}
