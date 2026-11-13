// For scripts/mesh.mjs: one tree with a fruit row on it, on a date (or at
// the row's peak), to judge a fruit's look alone:
//   node scripts/mesh.mjs 'props/fruitPreview#fruitTree($rng, "spruce-cones", "2025-05-20")'
// Any plant with a flower row, a fruit row or both on every crown (bushes'
// species too), at their peak or on a date, at a place where they grow:
//   node scripts/mesh.mjs 'props/fruitPreview#plantLook($rng, "blackthorn", null)'
//   node scripts/mesh.mjs --focus top 'props/fruitPreview#plantLook($rng, null, "spruce-cones", "2025-05-22")'

import type { BufferGeometry } from 'three'

import { FRUIT, fruitFor, withFruit, type FruitDay, type FruitKind } from '../fruits'
import { BLOOM, phenologyFor, plantSeason, withBlossom, type PlantSeason } from '../phenology'
import { PLACES } from '../places'
import { SHRUBS } from '../shrubs'
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

/** A place each row grows at (its own list, a shrub's, or one for a climate rule). */
const PLACE_OF: Record<string, string> = {
  coconut: 'antilles',
  pandanus: 'antilles',
  'almond-fruit': 'antilles',
  flamboyant: 'antilles',
  propagules: 'indonesia',
  'palm-dates': 'canaries',
  sabal: 'florida-carolinas',
  'stone-pine-cones': 'western-med',
  'spruce-cones': 'norway-west',
  'olive-fruit': 'aegean',
  olive: 'aegean',
  'holm-oak': 'western-med',
  'oak-catkins': 'brittany',
  'birch-catkins': 'scotland',
  'umbrella-thorn': 'red-sea',
  'gum-blossom': 'east-australia',
  willow: 'iceland'
}

function placeFor(kind: string): string {
  return PLACE_OF[kind] ?? SHRUBS.find(s => s.species === kind)?.places?.[0] ?? BLOOM.find(r => r.kind === kind)?.places[0] ?? 'antilles'
}

/** `plant` with flower row `bloom` and fruit row `fruit` (either may be null)
 * on every crown: at their peak (no date: forced), or as on `date` there. */
export function plantLook(rng: Random, bloom: string | null, fruit: string | null, date?: string, placeId?: string): BufferGeometry {
  const fruitRow = fruit == null ? undefined : FRUIT.find(r => r.kind === fruit)
  const bloomRow = bloom == null ? undefined : BLOOM.find(r => r.kind === bloom)
  const plant = fruitRow?.plant ?? bloomRow!.plant
  const id = placeId ?? placeFor(bloom ?? fruit!)
  const place = PLACES.find(p => p.id === id)!
  const day: FruitDay = {
    date: date ?? '2025-06-15',
    latitudeDeg: (place.latitude[0] + place.latitude[1]) / 2,
    place: { id, climate: Object.keys(place.climate)[0] as FruitDay['place']['climate'] },
    ...(date == null ? { overrides: { bloom: bloom == null ? false : [bloom as never], fruit: fruit == null ? false : [fruit as FruitKind] } } : {})
  }
  const phen = phenologyFor(day)
  const fruits = fruitFor(plant, day)
    .filter(f => f.row.kind === fruit)
    .map(f => ({ ...f, crowns: 1 }))
  const base: PlantSeason = (plant === 'rhizophora' ? undefined : plantSeason(plant, phen)) ?? { on: 1, turned: 0, fresh: 0, dry: phen.dry, deciduous: 0, autumn: [] }
  const withF = withFruit(base, fruits, phen) ?? base
  const b = phen.bloom.find(x => x.row.kind === bloom)
  return BUILD[plant as keyof typeof BUILD](rng, FOLIAGE, b != null ? withBlossom(withF, b, 0) : withF)
}
