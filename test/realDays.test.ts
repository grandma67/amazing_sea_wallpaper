import { describe, it } from 'vitest'

import type { SceneParams } from '../src/params'
import { MAX_CONTRAILS } from '../src/contrails'
import { OCEANS } from '../src/oceans'
import { HEATH_PLACES, heathFor, phenologyFor } from '../src/phenology'
import { allParams, expectEvery } from './days'

// What goes with what, over every real day: when the first holds, so must the
// second. A rule whose first never holds fails too (it would prove nothing).
// A new "only when" rule goes here; how often a thing happens goes with its feature.

type Rule = [name: string, when: (p: SceneParams) => boolean, then: (p: SceneParams) => boolean]

const polar = (p: SceneParams): boolean => p.sea.ocean === 'arctic' || p.sea.ocean === 'southern'
const iff = (a: (p: SceneParams) => boolean, b: (p: SceneParams) => boolean): ((p: SceneParams) => boolean) => p => a(p) === b(p)
const always = (): boolean => true
const dark = (p: SceneParams): boolean => p.timeOfDay === 'night' || p.timeOfDay === 'blue-hour'
const fogHeight = (p: SceneParams, lo: number, hi: number): boolean => p.fog!.height >= lo && p.fog!.height <= hi

const RULES: Rule[] = [
  // Things in the sky need the sky to be dark and open.
  ['an aurora: at night', p => p.aurora != null, p => p.timeOfDay === 'night'],
  ['an aurora: no overcast, fog or storm', p => p.aurora != null, p => p.weather.kind !== 'overcast' && p.fog == null && p.storm == null],
  ['an aurora: in the title', p => p.aurora != null, p => /(Northern|Southern) lights/.test(p.title)],
  ['a meteor: at night', p => p.meteors.length > 0, p => p.timeOfDay === 'night'],
  ['a meteor: no overcast or fog', p => p.meteors.length > 0, p => p.weather.kind !== 'overcast' && p.fog == null],
  ['the night glow: exactly when the sun is down', always, iff(p => p.nightGlow != null, p => p.sunElevationDeg < 0)],
  ['planets: exactly when the sun is down', always, iff(p => p.planets.length > 0, p => p.sunElevationDeg < 0)],
  ['noctilucent clouds: never at midday or at night', p => p.timeOfDay === 'midday' || p.timeOfDay === 'night', p => p.noctilucent == null],

  // The swell: the day's draw, by what the ocean's fetch makes of it.
  ['the swell: 60–200 m long before its ocean, 320 m at most', always, p => {
    const length = p.ocean.swellWavelength
    const scale = OCEANS[p.sea.ocean].swellWavelength
    return length <= 320 && length >= 60 * scale - 1e-9 && length <= 200 * scale + 1e-9
  }],
  ['the swell: up to 2 m before its ocean and monsoon', always, p => p.ocean.swellHeight >= 0 && p.ocean.swellHeight <= 2 * OCEANS[p.sea.ocean].swellHeight * 1.5],

  // Bush blossom (phenology.ts BLOOM): a place row in its own months.
  ['bush blossom: only in a row’s places and months', p => phenologyFor(p).bloom.length > 0, p =>
    phenologyFor(p).bloom.every(b => b.row.places.includes(p.place.id) && b.row.today(p).strength > 0)],
  // Heath (phenology.ts heathFor): the heath places only.
  ['heath: only on the heath coasts', p => heathFor(p) != null, p => HEATH_PLACES.includes(p.place.id)],

  // Weather.
  ['a storm: by day', p => p.storm != null, p => p.timeOfDay !== 'night'],
  ['a bolt: 3–9 km off, near enough for its dark base to show', p => (p.storm?.bolts.length ?? 0) > 0, p => p.storm!.bolts.every(b => b.distance >= 3000 && b.distance <= 9000)],
  ['contrails: none at night, under overcast or in storms', p => p.timeOfDay === 'night' || p.weather.kind === 'overcast' || p.weather.kind === 'storm', p => p.contrails.length === 0],
  ['contrails: a few, 9–12 km up, wider than 30 m', p => p.contrails.length > 0, p => p.contrails.length <= MAX_CONTRAILS && p.contrails.every(c => c.altitudeM >= 9000 && c.altitudeM <= 12000 && c.widthM > 30)],
  ['an old spread contrail: only on humid days', p => p.contrails.some(c => c.ageMin > 30), p => ['clear', 'cirrus', 'few', 'scattered', 'broken'].includes(p.weather.kind)],
  ['a Morning Glory: tropical Indo-Pacific dawns, September to November', p => p.rollCloud != null, p => p.biome.name === 'tropical' && ['indian', 'pacific'].includes(p.sea.ocean) && [9, 10, 11].includes(Number(p.date.slice(5, 7))) && !p.evening && p.title.includes('Morning Glory')],
  // The day's own lenses start at 18 mm; wider is for what's in the sky.
  ['a lens under 18 mm: only for a rainbow, an aurora or an eclipse', p => p.camera.focalLengthMm < 18, p => p.rainbow != null || p.aurora != null || p.eclipse != null],
  ['a rainbow: never in a storm, a sun low enough for the bow',p => p.rainbow != null, p => p.storm == null && p.sunElevationDeg < 42],
  ['a shelf cloud: no scud hiding it', p => p.storm?.shelf != null, p => !p.weather.formations.includes('stratus-fractus')],
  // Pack ice calms the sea's wind (oceanState), not the wind over the peaks.
  ['a lenticular: strong wind and no thick cloud', p => p.landform?.lenticular != null && !(p.sea.ice?.packIce ?? 0), p => p.ocean.windSpeed >= 8 && !['storm', 'overcast'].includes(p.weather.kind)],
  ['advection fog: a layer 30–120 m deep', p => p.fog?.kind === 'advection' && p.fog.start === 0, p => fogHeight(p, 30, 120)],
  ['a fog bank: 18–50 m deep', p => p.fog?.kind === 'advection' && p.fog.start > 0, p => fogHeight(p, 18, 50)],
  ['sea smoke: 6–25 m deep', p => p.fog?.kind === 'sea-smoke', p => fogHeight(p, 6, 25)],

  // The sea and what's in it.
  ['icebergs and pack ice: only on polar seas', p => p.sea.ice != null, polar],
  ['penguins: only in the Southern Ocean', p => p.colony?.kind === 'penguin', p => p.sea.ocean === 'southern'],
  ['a colony in the Southern Ocean: only penguins', p => p.sea.ocean === 'southern' && p.colony != null, p => p.colony!.kind === 'penguin'],
  ['a shelter mask: exactly behind a reef', always, iff(p => p.coast.shelter != null, p => p.coast.reef != null)],
  ['a frozen sea: no sea smoke, waterspout or open-water title', p => p.seaIce != null, p => p.fog?.kind !== 'sea-smoke' && p.waterspout == null && !/pack ice|glassy|calm sea/.test(p.title)],
  ['a reef: only a beach', p => p.coast.reef != null, p => p.coast.type === 'beach'],
  ['a Polar night title: only at night or blue hour', p => p.title.startsWith('Polar night'), dark]
]

describe('on real days', () => {
  it.each(RULES)('%s', (_, when, then) => {
    expectEvery(allParams().filter(when), then, { what: p => `${p.date} ${p.place.id} ${p.title}` })
  })
})
