// For scripts/mesh.mjs: one tree with a fruit row on it, on a date (or at
// the row's peak), to judge a fruit's look alone:
//   node scripts/mesh.mjs 'props/fruitPreview#fruitTree($rng, "spruce-cones", "2025-05-20")'

import type { BufferGeometry } from 'three'

import { FRUIT, fruitFor, withFruit, type FruitDay, type FruitKind } from '../fruits'
import { phenologyFor, plantSeason } from '../phenology'
import type { Random } from '../random'
import { acacia, birch, broadleaf, bush, conifer, eucalyptus, olive, pandanus, rhizophora, stonePine } from './trees'
import { palm } from './vegetation'

const FOLIAGE: [number, number, number] = [0.06, 0.12, 0.04]
const BUILD = { bush, palm, pandanus, 'stone-pine': stonePine, conifer, olive, broadleaf, birch, rhizophora, acacia, eucalyptus } as const

/** The kind `kind` hangs on, built with it: on `date` at `place` (its season
 * there), or forced to the row's peak without a date. */
export function fruitTree(rng: Random, kind: FruitKind, date?: string, place = 'norway-west', climate: FruitDay['place']['climate'] = 'temperate', latitudeDeg = 60): BufferGeometry {
  const row = FRUIT.find(r => r.kind === kind)!
  const day: FruitDay = { date: date ?? '2025-06-15', latitudeDeg, place: { id: place, climate }, overrides: { fruit: [kind] } }
  // A date: today's stages at that date (the force only picks the row).
  const fruit = date == null ? fruitFor(row.plant, day) : fruitFor(row.plant, { ...day, overrides: {} }).filter(f => f.row.kind === kind)
  const phen = phenologyFor(day)
  const plant = row.plant
  const season = withFruit(plant === 'rhizophora' ? undefined : plantSeason(plant, phen), fruit.map(f => ({ ...f, crowns: 1 })), phen)
  return BUILD[plant as keyof typeof BUILD](rng, FOLIAGE, season)
}
