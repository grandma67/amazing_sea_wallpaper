import { Group } from 'three'

import type { PropContext } from './context'
import { createBirds } from './birds'
import { createRocks } from './rocks'
import { createShips } from './ships'
import { createVegetation } from './vegetation'

/** Everything placed in the scene on top of sea, sky and terrain. */
export function createProps(ctx: PropContext): Group {
  const group = new Group()
  group.name = 'props'
  for (const mesh of createRocks(ctx)) group.add(mesh)
  for (const mesh of createVegetation(ctx)) group.add(mesh)
  for (const mesh of createShips(ctx)) group.add(mesh)
  for (const mesh of createBirds(ctx)) group.add(mesh)
  return group
}
