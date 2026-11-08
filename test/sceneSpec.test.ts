import { describe, expect, it } from 'vitest'

import { createCamera } from '../src/camera'
import { generateSceneParams } from '../src/composition'
import { generateParams, type SceneParams } from '../src/params'
import { debrisFor } from '../src/props/debris'
import { shoreLifeFor } from '../src/props/shoreLife'
import { Random } from '../src/random'
import { deepPatch, parseSceneSpec, type SceneSpec } from '../src/sceneSpec'
import { allParams, DAYS, expectSameDay, scene as sceneOn } from './days'

const DAY = '2024-07-12'
const scene = (spec: SceneSpec, date = DAY): SceneParams => sceneOn(spec, date)
const sample = DAYS.filter((_, i) => i % 73 === 0)

describe('scene specs', () => {
  it('change nothing when empty or only naming the date', () => {
    expect(scene({})).toEqual(generateParams(DAY))
    expect(generateParams('2000-01-01', 0, 16 / 9, { date: DAY, name: 'x', note: 'y' })).toEqual(generateParams(DAY))
    expect(scene({}).overrides).toBeUndefined()
  })

  it.each<SceneSpec>([{ timeOfDay: 'night', biome: 'desert', lighthouse: true }, { timeOfDay: 'night' }, { reef: true, coast: 'beach', beachMaterial: 'sand' }])('are deterministic: %j', spec => {
    expect(scene(spec, '2026-06-02')).toEqual(scene(spec, '2026-06-02'))
  })

  it('keep the rest of the day when the time of day is forced', () => {
    for (const p of allParams().filter((_, i) => i % 7 === 0)) {
      if (p.eclipse != null || p.rainbow != null) continue
      for (const timeOfDay of ['night', 'midday'] as const) {
        const q = scene({ timeOfDay }, p.date)
        expect(q.timeOfDay).toBe(timeOfDay)
        expect(q.place).toEqual(p.place)
        expect(q.latitudeDeg).toBe(p.latitudeDeg)
        expect(q.biome.name).toBe(p.biome.name)
        expect(q.sea.ocean).toBe(p.sea.ocean)
        expect(q.coast.type).toBe(p.coast.type)
        expect(q.coast.composition).toBe(p.coast.composition)
        expect(q.ocean.windHeadingDeg).toBe(p.ocean.windHeadingDeg)
        // A wide lens goes with an aurora, or a rainbow, even one that a later
        // draw of fog or a storm takes away (params.ts): the storm stays on 13
        // of 2096 days, on a lens chosen for what isn't there.
        if (q.aurora == null && p.aurora == null && q.fog == null && p.storm == null && q.storm == null) expect(q.camera.focalLengthMm, p.date).toBe(p.camera.focalLengthMm)
      }
    }
  })

  it('force the sky and the place', () => {
    for (const date of sample) {
      const p = scene({ timeOfDay: 'blue-hour', eclipse: null, biome: 'nordic', ocean: 'arctic', composition: 'overlook', sand: 'white', weather: 'overcast' }, date)
      expect(p.timeOfDay).toBe('blue-hour')
      expect(p.biome.name).toBe('nordic')
      expect(p.sea.ocean).toBe('arctic')
      expect(p.coast.type).toBe('beach')
      expect(p.coast.composition).toBe('overlook')
      expect(p.coast.sand.name).toBe('white')
      expect(['overcast', 'storm']).toContain(p.weather.kind)
      expect(scene({ coast: 'open-sea' }, date).coast.type).toBe('open-sea')
    }
    // A forced composition survives the re-rolls.
    for (const date of sample.slice(0, 2)) {
      expect(generateSceneParams(date, 16 / 9, { composition: 'framed' }).coast.composition).toBe('framed')
    }
  })

  it('force features on, of a kind, and off', () => {
    for (const date of sample) {
      const p = scene(
        { lighthouse: 'rock', fog: 'bank', landform: 'strato', colony: 'puffin', pinnipeds: 'fur-seal', storm: 'squall', ice: 'bergs' },
        date
      )
      expect(p.lighthouse?.site).toBe('rock')
      expect(p.fog?.kind).toBe('advection')
      expect(p.fog?.start).toBeGreaterThan(0)
      expect(p.landform?.kind).toBe('strato')
      expect(p.colony?.kind).toBe('puffin')
      expect(p.pinnipeds?.kind).toBe('fur-seal')
      expect(p.storm?.bolts).toEqual([])
      expect(p.weather.kind).toBe('storm')
      expect(p.sea.ice?.bergs).toBeGreaterThan(0)
      expect(p.sea.ice?.packIce).toBe(0)
      expect(p.title).toContain('lighthouse')

      const on = scene({ lighthouse: true, fog: true, landform: true, colony: true, pinnipeds: true, storm: 'thunderstorm', rainbow: true }, date)
      for (const key of ['lighthouse', 'fog', 'landform', 'colony', 'pinnipeds', 'storm'] as const) expect(on[key]).not.toBeNull()
      expect(on.storm!.bolts.length).toBeGreaterThan(0)

      const off = scene({ lighthouse: null, fog: false, landform: null, colony: null, pinnipeds: null, storm: null, rainbow: false, ice: null, eclipse: null }, date)
      for (const key of ['lighthouse', 'fog', 'landform', 'colony', 'pinnipeds', 'storm', 'rainbow', 'eclipse'] as const) expect(off[key]).toBeNull()
      expect(off.sea.ice).toBeNull()
    }
  })

  it('put eclipses on any day, with the moon phase to match', () => {
    for (const type of ['solar-total', 'solar-annular', 'solar-partial', 'lunar-total', 'lunar-partial'] as const) {
      const p = scene({ eclipse: type })
      expect(p.eclipse?.type).toBe(type)
      if (type.startsWith('solar')) {
        expect(p.moonPhaseDeg).toBe(0)
        expect(p.sunScale).toBe(3)
        expect(p.timeOfDay === 'daylight' || p.timeOfDay === 'golden-hour').toBe(true)
      } else {
        expect(p.moonPhaseDeg).toBe(180)
        expect(p.timeOfDay).toBe('night')
      }
    }
  })

  it('set the moon', () => {
    for (const date of sample) {
      expect(scene({ timeOfDay: 'night', nightSky: 'starlit', eclipse: null }, date).nightSky).toBe('starlit')
      const lit = scene({ timeOfDay: 'night', nightSky: 'moonlit', moonPhaseDeg: 180, eclipse: null }, date)
      expect(lit.nightSky).toBe('moonlit')
      expect(scene({ timeOfDay: 'night', moonPhaseDeg: 90, eclipse: null }, date).moonIllumination).toBeCloseTo(0.5)
    }
  })

  it('set the sun, wind and camera', () => {
    const p = scene({ sunElevationDeg: 20, sunAzimuthDeg: 0, wind: 12, camera: { heightM: 3, focalLengthMm: 85, horizonFraction: 0.5, rollDeg: 0 } })
    expect(p.sunElevationDeg).toBe(20)
    // Sun straight ahead.
    const sunAz = (Math.atan2(p.sunDirection[0], -p.sunDirection[2]) * 180) / Math.PI
    expect(((sunAz - p.camera.headingDeg + 540) % 360) - 180).toBeCloseTo(0)
    expect(p.ocean.windSpeed).toBe(12)
    expect(p.camera).toMatchObject({ heightM: 3, focalLengthMm: 85, horizonFraction: 0.5, rollDeg: 0 })
  })

  it('patch any param last', () => {
    const p = scene({ lighthouse: 'point', params: { lighthouse: { paint: 'red' }, coast: { distanceToWater: 6 } } })
    expect(p.lighthouse?.paint).toBe('red')
    expect(p.lighthouse?.site).toBe('point')
    expect(p.coast.distanceToWater).toBe(6)
  })

  it('pass prop overrides to the props', () => {
    const p = scene({
      coast: 'beach',
      biome: 'nordic',
      props: {
        debris: { driftwood: 1, wrack: 'sargassum' },
        shoreLife: { crab: 'ghost', flowers: ['thrift'] }
      }
    })
    const debris = debrisFor(p, new Random('x'))!
    expect(debris.driftwood).toBe(1)
    expect(debris.wrack).toBe('sargassum')
    expect(debris.wrackAmount).toBeGreaterThan(0)
    const life = shoreLifeFor(p, new Random('x'))!
    expect(life.crab).toBe('ghost')
    expect(life.crabs).toBeGreaterThan(0)
    expect(life.burrows).toBeGreaterThan(0)
    expect(life.flowers).toEqual(['thrift'])
    expect(life.flowerAmount).toBeGreaterThan(0)
    const none = scene({ coast: 'beach', props: { debris: null, shoreLife: null } })
    expect(debrisFor(none, new Random('x'))).toBeNull()
    expect(shoreLifeFor(none, new Random('x'))).toBeNull()
  })
})

// Every spec field draws first and forces after, so forcing one leaves the rest
// of the day as drawn (SCENE_SPECS.md "Adding a spec field"). A new field gets a row.
describe('forcing a field keeps the rest of the day', () => {
  type Row = {
    name: string
    base: SceneSpec
    /** The two sides: drawn or off, and forced. */
    off: SceneSpec
    on: SceneSpec
    same?: readonly string[]
    /** Instead of `same`: everything but these. */
    except?: readonly (keyof SceneParams)[]
    dates?: readonly string[]
  }
  const NIGHT = { timeOfDay: 'night', nightSky: 'starlit', weather: 'clear', fog: null, storm: null, eclipse: null } as const
  const SAND_BEACH = { coast: 'beach', beachMaterial: 'sand', eclipse: null } as const
  const MORNING = { place: 'california', timeOfDay: 'golden-hour', evening: false, eclipse: null } as const
  const rows: Row[] = [
    { name: 'a reef', base: { ...SAND_BEACH, tide: 'mid', place: 'norway-west' }, off: {}, on: { reef: true }, same: ['coast.noiseOffset', 'coast.sand', 'camera.headingDeg', 'place'] },
    { name: 'the beach state', base: { ...SAND_BEACH, place: 'scotland', reef: null }, off: { beachState: 'reflective' }, on: { beachState: 'dissipative' }, same: ['coast.noiseOffset', 'coast.grainMm', 'camera', 'place'] },
    { name: 'a salt marsh', base: { eclipse: null, place: 'wadden-north-sea', coast: 'beach' }, off: { saltMarsh: null }, on: { saltMarsh: true }, same: ['camera.headingDeg', 'coast.tide', 'coast.noiseOffset'] },
    { name: 'the tide stage', base: { ...SAND_BEACH, place: 'brittany' }, off: {}, on: { tide: 'high' }, same: ['coast.tide.mean', 'coast.terrace', 'title'] },
    { name: 'the swell', base: { place: 'namibia', coast: 'beach', beachMaterial: 'sand', sand: 'white' }, off: {}, on: { swellHeight: 2.5, swellPeriod: 12 }, same: ['camera', 'coast.noiseOffset', 'ocean.windSpeed'] },
    { name: 'sea ice', base: { eclipse: null }, off: { seaIce: null }, on: { seaIce: 'fast' }, same: ['place.id', 'camera.headingDeg', 'weather'], dates: ['2024-07-14', '2025-02-20'] },
    { name: 'the visibility', base: {}, off: {}, on: { visibilityKm: 12 }, except: ['visibilityKm'] },
    { name: 'the harmattan', base: { place: 'west-africa' }, off: { dust: null }, on: { dust: 'harmattan' }, same: ['camera', 'place'], dates: ['2025-01-10', '2025-07-10'] },
    { name: 'a marine layer', base: MORNING, off: { marineLayer: null }, on: { marineLayer: true }, same: ['camera', 'place', 'coast.composition'], dates: ['2025-06-14'] },
    { name: 'no meteors', base: NIGHT, off: {}, on: { meteors: null }, same: ['nightGlow', 'camera'], dates: ['2026-03-10'] },
    { name: 'the night glow switches', base: NIGHT, off: {}, on: { milkyWay: false, airglow: null, zodiacalLight: false, skyDarkness: 4 }, same: ['nightGlow.airglowS10', 'title'] },
    { name: 'snow', base: { eclipse: null, place: 'brittany', landform: null }, off: {}, on: { snow: 0.5 }, except: ['snow', 'title'], dates: ['2025-07-15'] }
  ]
  const DATES = ['2024-02-01', '2025-06-15', '2026-09-30']

  it.each(rows)('$name', ({ base, off, on, same, except, dates = DATES }) => {
    for (const date of dates) {
      const [a, b] = [scene({ ...base, ...off }, date), scene({ ...base, ...on }, date)]
      expectSameDay(a, b, same ?? (Object.keys(a) as (keyof SceneParams)[]).filter(k => !except!.includes(k)))
    }
  })

  // What was drawn, forced again, is the same day to the last digit.
  it.each<[string, (p: SceneParams) => SceneSpec]>([
    ['the beach material', p => ({ beachMaterial: p.coast.material })],
    ['the beach state', p => ({ beachState: p.coast.state })]
  ])('%s as drawn changes nothing', (_, spec) => {
    const days = allParams().filter(p => p.coast.type === 'beach' && p.coast.reef == null && p.coast.material === 'sand').slice(0, 15)
    const stony = allParams().filter(p => p.coast.type === 'beach' && p.coast.material !== 'sand').slice(0, 15)
    for (const p of [...days, ...stony]) expect(scene(spec(p), p.date)).toEqual(p)
  })

  // Spread from a file or a helper with `field: undefined`: not forced.
  it.each(['seaIce', 'snow', 'fog', 'storm', 'lighthouse', 'reef', 'aurora', 'coast'] as const)('%s: undefined is not forced', field => {
    expect(generateParams(DAY, 0, 16 / 9, { [field]: undefined })).toEqual(generateParams(DAY))
  })
})

describe('parseSceneSpec', () => {
  it('accepts a spec, as JSON text too', () => {
    const spec = { date: DAY, timeOfDay: 'night', lighthouse: true, props: { ships: ['tanker'], debris: null }, params: { coast: { wobble: 1 } } }
    expect(parseSceneSpec(spec)).toEqual(spec)
    expect(parseSceneSpec(JSON.stringify(spec))).toEqual(spec)
  })

  it('names the bad field', () => {
    expect(() => parseSceneSpec({ timeofday: 'night' })).toThrow(/spec\.timeofday is not a known field/)
    // The commonest slip in a diff.mjs --off patch.
    expect(() => parseSceneSpec({ debug: { passes: { aerial: false } } } as never)).toThrow(/debug switches go under params/)
    expect(() => parseSceneSpec({ biome: 'arctic' })).toThrow(/spec\.biome must be one of/)
    expect(() => parseSceneSpec({ props: { marine: 'shark' } })).toThrow(/spec\.props\.marine/)
    expect(() => parseSceneSpec({ props: { ships: ['submarine'] } })).toThrow(/spec\.props\.ships\[0\]/)
    expect(() => parseSceneSpec({ date: '12/07/2024' })).toThrow(/YYYY-MM-DD/)
    expect(() => parseSceneSpec({ wind: '5' })).toThrow(/must be a number/)
    expect(() => parseSceneSpec([])).toThrow(/must be an object/)
  })
})

describe('deepPatch', () => {
  it('merges objects and replaces the rest', () => {
    expect(deepPatch({ a: { b: 1, c: [1, 2] }, d: 1 }, { a: { c: [3] }, d: null })).toEqual({ a: { b: 1, c: [3] }, d: null })
    expect(deepPatch({ a: null }, { a: { b: 1 } })).toEqual({ a: { b: 1 } })
  })
})

describe('swell and camera ground', () => {
  it('forces the offshore swell, and the surf and beach state follow', () => {
    const spec: SceneSpec = { place: 'namibia', coast: 'beach', beachMaterial: 'sand', sand: 'white' }
    for (const date of sample.slice(0, 10)) {
      const drawn = scene(spec, date)
      const big = scene({ ...spec, swellHeight: 2.5, swellPeriod: 12 }, date)
      expect(big.ocean.swellHeight).toBe(2.5)
      expect(big.ocean.swellWavelength).toBeCloseTo((9.81 * 144) / (2 * Math.PI), 6)
      expect(big.coast.surfAmplitude).toBeGreaterThanOrEqual(drawn.coast.surfAmplitude)
      // Fine quartz under big swell: barred or flat.
      expect(['rhythmic-bar', 'longshore-bar', 'dissipative']).toContain(big.coast.state)
    }
    // Long periods are capped at the spectrum's longest swell.
    expect(scene({ swellPeriod: 20 }).ocean.swellWavelength).toBe(320)
    expect(() => parseSceneSpec({ swellHeight: 'big' })).toThrow(/swellHeight/)
  })

  it('stands the camera on a pinned ground height', () => {
    const p = scene({ coast: 'beach', composition: 'shoreline' })
    const free = createCamera(p, 1920, 1080).camera
    const pinned = createCamera({ ...p, camera: { ...p.camera, groundM: 3 } }, 1920, 1080).camera
    expect(free.position.y).toBeGreaterThan(p.camera.heightM - 1e-9)
    expect(pinned.position.y).toBeCloseTo(3 + p.camera.heightM, 9)
  })
})
