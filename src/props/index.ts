import { Group } from 'three'

import type { PropContext } from './context'
import { createBirds } from './birds'
import { createIce } from './ice'
import { createMarineLife } from './marine'
import { createMigratoryBirds } from './migratory'
import { createRocks } from './rocks'
import { createShips } from './ships'
import { createStorm } from './storm'
import { createVegetation } from './vegetation'

/** Everything placed in the scene on top of sea, sky and terrain. */
export function createProps(ctx: PropContext): Group {
  const group = new Group()
  group.name = 'props'
  for (const mesh of createRocks(ctx)) group.add(mesh)
  for (const mesh of createIce(ctx)) group.add(mesh)
  for (const mesh of createVegetation(ctx)) group.add(mesh)
  for (const mesh of createShips(ctx)) group.add(mesh)
  for (const animal of createMarineLife(ctx)) group.add(animal)
  for (const mesh of createBirds(ctx)) group.add(mesh)
  for (const mesh of createMigratoryBirds(ctx)) group.add(mesh)
  for (const object of createStorm(ctx)) group.add(object)
  return group
}
