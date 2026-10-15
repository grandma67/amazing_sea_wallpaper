import { describe, expect, it } from 'vitest'

import { generateSceneParams } from '../src/composition'
import { generateParams, type SceneParams } from '../src/params'
import { debrisFor } from '../src/props/debris'
import { shoreLifeFor } from '../src/props/shoreLife'
import { Random } from '../src/random'
import { deepPatch, parseSceneSpec, type SceneSpec } from '../src/sceneSpec'
import { allParams, DAYS, scene as sceneOn } from './days'

const DAY = '2024-07-12'
const scene = (spec: SceneSpec, date = DAY): SceneParams => sceneOn(spec, date)
const sample = DAYS.slice(0, 40)

describe('scene specs', () => {
  it('change nothing when empty or only naming the date', () => {
    expect(scene({})).toEqual(generateParams(DAY))
    expect(generateParams('2000-01-01', 0, 16 / 9, { date: DAY, name: 'x', note: 'y' })).toEqual(generateParams(DAY))
    expect(scene({}).overrides).toBeUndefined()
  })

  it('are deterministic', () => {
    const spec: SceneSpec = { timeOfDay: 'night', biome: 'desert', lighthouse: true }
    expect(scene(spec)).toEqual(scene(spec))
  })

  it('keep the rest of the day when the time of day is forced', () => {
    for (const p of allParams().slice(0, 120)) {
      if (p.eclipse != null || p.rainbow != null) continue
      for (const timeOfDay of ['night', 'midday'] as const) {
        const q = scene({ timeOfDay }, p.date)
        expect(q.timeOfDay).toBe(timeOfDay)
        expect(q.biome.name).toBe(p.biome.name)
        expect(q.sea.ocean).toBe(p.sea.ocean)
        expect(q.coast.type).toBe(p.coast.type)
        expect(q.coast.composition).toBe(p.coast.composition)
        expect(q.ocean.windHeadingDeg).toBe(p.ocean.windHeadingDeg)
        expect(q.camera.focalLengthMm).toBe(p.camera.focalLengthMm)
      }
    }
  })

  it('force the sky and the place', () => {
    for (const date of sample) {
      const p = scene({ timeOfDay: 'blue-hour', biome: 'volcanic', ocean: 'arctic', composition: 'overlook', sand: 'white', weather: 'overcast' }, date)
      expect(p.timeOfDay).toBe('blue-hour')
      expect(p.biome.name).toBe('volcanic')
      expect(p.sea.ocean).toBe('arctic')
      expect(p.coast.type).toBe('beach')
      expect(p.coast.composition).toBe('overlook')
      expect(p.coast.sand.name).toBe('white')
      expect(['overcast', 'storm']).toContain(p.weather.kind)
      expect(scene({ coast: 'open-sea' }, date).coast.type).toBe('open-sea')
    }
    // A forced composition survives the re-rolls.
    for (const date of sample.slice(0, 6)) {
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

  it('force a rainbow with the sun behind the camera', () => {
    const p = scene({ rainbow: true, timeOfDay: 'golden-hour', storm: null })
    expect(p.rainbow).not.toBeNull()
    expect(p.title).toContain('rainbow')
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
      expect(scene({ timeOfDay: 'night', nightSky: 'starlit' }, date).nightSky).toBe('starlit')
      const lit = scene({ timeOfDay: 'night', nightSky: 'moonlit', moonPhaseDeg: 180 }, date)
      expect(lit.nightSky).toBe('moonlit')
      expect(lit.moonlight).toBeCloseTo(1)
      expect(scene({ timeOfDay: 'night', moonPhaseDeg: 90 }, date).moonIllumination).toBeCloseTo(0.5)
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

  it('force the clouds', () => {
    const p = scene({ weather: 'scattered', clouds: ['cumulus-congestus', 'cirrus'], storm: null })
    expect(p.weather.formations).toEqual(['cumulus-congestus', 'cirrus'])
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

describe('parseSceneSpec', () => {
  it('accepts a spec, as JSON text too', () => {
    const spec = { date: DAY, timeOfDay: 'night', lighthouse: true, props: { ships: ['tanker'], debris: null }, params: { coast: { wobble: 1 } } }
    expect(parseSceneSpec(spec)).toEqual(spec)
    expect(parseSceneSpec(JSON.stringify(spec))).toEqual(spec)
  })

  it('names the bad field', () => {
    expect(() => parseSceneSpec({ timeofday: 'night' })).toThrow(/spec\.timeofday is not a known field/)
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
