import type { SceneParams } from '../params'
import { Random } from '../random'
import { gullsFor } from './birds'
import { debrisFor } from './debris'
import { mangroveFor } from './mangroves'
import { marineFor } from './marine'
import { migratoryFor } from './migratory'
import { shoreLifeFor } from './shoreLife'
import { wildlifeFor } from './wildlife'

// What the props decide for themselves on a day, without placing anything:
// the pure `xxxFor(params, rng)` choices on the same random streams the
// creators use (PropContext.rng), so they match the render. For
// scripts/params.mjs (`p.props.wildlife.hippos`) and the tests. Whether a
// choice lands in the frame is still up to placement.

export function propChoices(params: SceneParams) {
  const rng = (stream: string): Random => Random.derive(params.seed, `props/${stream}`)
  return {
    gulls: gullsFor(params, rng('birds')),
    marine: marineFor(params, rng('marine')),
    migratory: migratoryFor(params, rng('migratory')),
    wildlife: wildlifeFor(params, rng('wildlife')),
    shoreLife: shoreLifeFor(params, rng('shore-life')),
    debris: debrisFor(params, rng('debris')),
    mangroves: mangroveFor(params, rng('mangroves'))
  }
}

export type PropChoices = ReturnType<typeof propChoices>
