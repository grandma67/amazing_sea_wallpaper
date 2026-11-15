// Which real shrub a `bush` crown is (knowledge/BUSHES.md). The one `bush`
// kind stands for a coast's own shrubs; each crown takes a species by a hash
// of its position (props/vegetation.ts crownBlossom), so a bush that flowers
// white in April is the same bush that hangs sloes in October, and a moving
// camera sees the same ones. Their flowers are phenology.ts BLOOM rows and
// their fruit fruits.ts FRUIT rows, linked by `species`.
//
// Shares are of a place's bushes, after the older blossom rows (gorse, rock
// rose, wattle), which keep the start of the hash range exactly as before.
// No draws.

import type { Climate } from './biome'

export const SHRUB_KINDS = [
  'sea-buckthorn',
  'rugosa-rose',
  'blackthorn',
  'hawthorn',
  'spanish-broom',
  'lentisk',
  'strawberry-tree',
  'myrtle',
  'sea-grape',
  'naupaka',
  'saw-palmetto',
  'coast-banksia',
  'coast-tea-tree',
  'manuka',
  'bush-lupine',
  'salal',
  'willow',
  'calafate',
  'natal-plum'
] as const
export type ShrubKind = (typeof SHRUB_KINDS)[number]

/** What a shrub row reads from a day. */
export interface ShrubDay {
  latitudeDeg: number
  place: { id: string; climate: Climate }
}

export interface ShrubSpecies {
  species: ShrubKind
  /** Share of the place's bushes (est.: the shrub's place in the coast's
   * scrub, from the regional accounts in BUSHES.md). */
  share: number
  places?: readonly string[]
  /** Or a rule (willow: northern boreal and polar coasts). */
  where?: (day: ShrubDay) => boolean
}

const ATLANTIC = ['cornwall-wales', 'brittany', 'ireland', 'scotland', 'bristol-channel', 'morecambe-bay']
const MED = ['western-med', 'adriatic', 'aegean', 'north-africa-levant', 'portugal-morocco', 'canaries']
const CARIBBEAN = ['antilles', 'lesser-antilles-volcanic', 'bahamas-bermuda', 'yucatan-belize', 'central-america', 'florida-carolinas', 'northeast-brazil']
const INDO_PACIFIC = [
  'hawaii',
  'pacific-islands',
  'maldives',
  'sri-lanka',
  'andaman-lakshadweep',
  'indonesia',
  'philippines',
  'sumatra-java-south',
  'comoros',
  'reunion-mauritius',
  'east-africa',
  'north-australia',
  'mainland-se-asia',
  'taiwan-south-china',
  'south-japan'
]

/** Coastal shrubs by place. Not here: arid coasts' saltbush and desert
 * shrubs (they flower after rain: bloom years), the Cape's fynbos, central
 * Chile's matorral, the Atlantic islands' laurel scrub (no row yet). */
export const SHRUBS: readonly ShrubSpecies[] = [
  // North Sea and Baltic dunes.
  { species: 'sea-buckthorn', share: 0.25, places: ['wadden-north-sea', 'baltic'] },
  { species: 'rugosa-rose', share: 0.2, places: ['wadden-north-sea', 'baltic', 'maine', 'nova-scotia', 'pei', 'japan'] },
  // Atlantic Europe's cliff-top scrub and hedges, beside the gorse.
  { species: 'blackthorn', share: 0.15, places: [...ATLANTIC, 'wadden-north-sea'] },
  { species: 'hawthorn', share: 0.15, places: [...ATLANTIC, 'wadden-north-sea'] },
  // Mediterranean maquis, beside the rock rose; the strawberry tree also on
  // the Atlantic's mildest coasts (Killarney, Brittany).
  { species: 'spanish-broom', share: 0.15, places: MED },
  { species: 'lentisk', share: 0.2, places: MED },
  { species: 'strawberry-tree', share: 0.08, places: [...MED, 'ireland', 'brittany'] },
  { species: 'myrtle', share: 0.1, places: MED },
  // Tropical and subtropical strand.
  { species: 'sea-grape', share: 0.3, places: CARIBBEAN },
  { species: 'naupaka', share: 0.35, places: INDO_PACIFIC },
  { species: 'saw-palmetto', share: 0.3, places: ['florida-carolinas'] },
  // Australia and New Zealand, beside wattle and gorse.
  // Tasmania's bushes are mostly gorse and wattle already (0.85).
  { species: 'coast-banksia', share: 0.1, places: ['east-australia', 'tasmania'] },
  { species: 'coast-tea-tree', share: 0.12, places: ['east-australia'] },
  { species: 'manuka', share: 0.3, places: ['new-zealand-north', 'new-zealand-south'] },
  // Pacific coasts of the Americas.
  { species: 'bush-lupine', share: 0.25, places: ['california'] },
  { species: 'salal', share: 0.35, places: ['pacific-northwest', 'british-columbia', 'se-alaska'] },
  { species: 'calafate', share: 0.35, places: ['tierra-del-fuego', 'patagonia-fjords'] },
  // Northern willow scrub: Iceland, Scandinavia, Alaska, Canada.
  { species: 'willow', share: 0.4, where: day => day.latitudeDeg > 0 && (day.place.climate === 'boreal' || day.place.climate === 'polar') },
  { species: 'natal-plum', share: 0.25, places: ['natal'] }
]

/** Does `s` grow on this day's coast? */
export function shrubGrows(s: ShrubSpecies, day: ShrubDay): boolean {
  return (s.places?.includes(day.place.id) ?? false) || s.where?.(day) === true
}

/** The species growing here, plus any a spec forces (a list of kinds). */
export function shrubsHere(day: ShrubDay, forced: readonly string[] = []): ShrubSpecies[] {
  return SHRUBS.filter(s => shrubGrows(s, day) || forced.includes(s.species))
}

/**
 * How much salt spray a shrub takes (NATURE.md §9), by the extension
 * services' tiers (UF/IFAS, Clemson, UGA): `high` withstands direct spray and
 * makes the coast's first woody line; `moderate` grows near the beach only in
 * the lee of the first line or the dunes (phenology.ts `SHRUB_LEE`). Rows
 * name the bloom rows' kinds too (gorse, rock rose, wattle: older bush rows)
 * and `plain`, a bush with no species (the coast's own strand scrub: arid
 * saltbush, fynbos, …). Evidence: dune and strand shrubs by BUSHES.md (sea
 * buckthorn, Japanese rose, sea grape, naupaka, Natal plum); coastal wattle
 * 5–10 m tall on Northland's west-coast dunes (Tāne's Tree Trust); gorse and
 * blackthorn on grazed, exposed cliff tops (NATURE.md §8); the rest est.
 */
export type SaltTolerance = 'high' | 'moderate'
export const SALT_TOLERANCE: Record<ShrubKind | 'gorse' | 'rock-rose' | 'wattle' | 'plain', SaltTolerance> = {
  'sea-buckthorn': 'high',
  'rugosa-rose': 'high',
  blackthorn: 'high',
  hawthorn: 'moderate',
  'spanish-broom': 'moderate',
  lentisk: 'high',
  'strawberry-tree': 'moderate',
  myrtle: 'moderate',
  'sea-grape': 'high',
  naupaka: 'high',
  'saw-palmetto': 'high',
  'coast-banksia': 'high',
  'coast-tea-tree': 'high',
  manuka: 'moderate',
  'bush-lupine': 'high',
  salal: 'moderate',
  willow: 'high',
  calafate: 'moderate',
  'natal-plum': 'high',
  gorse: 'high',
  'rock-rose': 'moderate',
  wattle: 'high',
  plain: 'high'
}
