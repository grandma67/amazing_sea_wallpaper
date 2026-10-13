import { Group } from 'three'

import type { PropContext } from './context'
import { createRocks } from './rocks'

/** Everything placed in the scene on top of sea, sky and terrain. */
export function createProps(ctx: PropContext): Group {
  const group = new Group()
  group.name = 'props'
  for (const mesh of createRocks(ctx)) group.add(mesh)
  return group
}
