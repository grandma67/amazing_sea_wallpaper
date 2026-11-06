import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import type { Climate } from '../src/biome'
import { CLIMATES, PLACES } from '../src/places'
import { cakeGeometry, createIceFoot, CAMERA_GAP, footLine, footShape, iceFootFor, runEnds } from '../src/props/iceFoot'
import { snowLook } from '../src/props/snowCap'
import { litterFor } from '../src/props/leafLitter'
import { grassBuried } from '../src/props/vegetation'
import { SNOW_COVER, SNOW_PLACES, ICE_FOOT_PLACES, iceFootChance, pickSnow, snowChance } from '../src/snow'
import { shoreToWorld, terrainHeight } from '../src/terrain'
import { tideMarks } from '../src/tides'
import type { SceneSpec } from '../src/sceneSpec'
import { allParams, expectDryCameras, propsOf, scene, scenes, viewOf } from './days'

const day = (date: string, latitudeDeg = 70): { date: string; latitudeDeg: number } => ({ date, latitudeDeg })
const months = Array.from({ length: 12 }, (_, m) => `2025-${String(m + 1).padStart(2, '0')}-15`)

describe('when snow lies', () => {
  it('follows the climate: long polar winters, boreal winters, rare temperate days, none elsewhere', () => {
    expect(snowChance('x', 'polar', day('2025-01-15'))).toBeGreaterThan(0.9)
    expect(snowChance('x', 'polar', day('2025-07-15'))).toBe(0)
    expect(snowChance('x', 'boreal', day('2025-01-15'))).toBeGreaterThan(0.5)
    expect(snowChance('x', 'boreal', day('2025-06-15'))).toBe(0)
    expect(snowChance('x', 'temperate', day('2025-01-15', 50))).toBeLessThan(0.1)
    for (const climate of ['tropical', 'arid', 'mediterranean', 'subtropical'] as Climate[]) {
      for (const date of months) expect(snowChance('x', climate, day(date, 30))).toBe(0)
    }
  })

  it('flips with the hemisphere', () => {
    expect(snowChance('x', 'polar', day('2025-07-15', -65))).toBeCloseTo(snowChance('x', 'polar', day('2025-01-14', 65)), 5)
    expect(snowChance('x', 'polar', day('2025-01-15', -65))).toBe(0)
  })

  it('takes a place where its winters differ from its climate’s', () => {
    expect(snowChance('pei', 'temperate', day('2025-01-15', 46))).toBeGreaterThan(0.5)
    expect(snowChance('tasmania', 'temperate', day('2025-07-15', -42))).toBe(0)
    expect(snowChance('norway-north', 'boreal', day('2025-01-15'))).toBeGreaterThan(snowChance('iceland-faroe', 'boreal', day('2025-01-15')))
  })

  it('keys every table by real places and climates, chances in 0..1, in every month', () => {
    const ids = new Set(PLACES.map(p => p.id))
    for (const [id, row] of Object.entries(SNOW_PLACES)) {
      expect(ids.has(id), id).toBe(true)
      for (const [climate, chance] of Object.entries(row)) {
        expect(SNOW_COVER[climate as Climate], `${id} ${climate}`).toBeDefined()
        expect(PLACES.some(p => p.id === id && (p.climate as Record<string, number>)[climate] != null), `${id} has ${climate}`).toBe(true)
        expect(chance).toBeGreaterThanOrEqual(0)
        expect(chance).toBeLessThanOrEqual(1)
      }
    }
    for (const id of Object.keys(ICE_FOOT_PLACES)) expect(ids.has(id), id).toBe(true)
    for (const place of PLACES) {
      for (const climate of CLIMATES) {
        for (const date of months) {
          const c = snowChance(place.id, climate, day(date))
          expect(c).toBeGreaterThanOrEqual(0)
          expect(c).toBeLessThanOrEqual(1)
          expect(iceFootChance(place.id, climate, day(date))).toBeLessThanOrEqual(1)
        }
      }
    }
  })
})

describe('the day’s snow', () => {
  const all = allParams()
  const snowy = all.filter(p => p.snow != null)

  it('is only where and when its table says, and about as often', () => {
    for (const p of snowy) expect(snowChance(p.place.id, p.place.climate, p), `${p.date} ${p.place.id}`).toBeGreaterThan(0)
    const expected = all.reduce((sum, p) => sum + snowChance(p.place.id, p.place.climate, p), 0)
    expect(snowy.length).toBeGreaterThan(expected * 0.85)
    expect(snowy.length).toBeLessThan(expected * 1.15)
  })

  it('has a cover in 0..1, closed in deep polar winter and thinner on the shoulders', () => {
    for (const p of snowy) {
      expect(p.snow!.cover).toBeGreaterThan(0)
      expect(p.snow!.cover).toBeLessThanOrEqual(1)
    }
    const deep = pickSnow('a', 'greenland', 'polar', day('2025-01-15'), true)!
    const shoulder = pickSnow('a', 'greenland', 'polar', day('2025-05-30'))
    expect(deep.cover).toBeGreaterThan(0.75)
    if (shoulder != null) expect(shoulder.cover).toBeLessThanOrEqual(deep.cover)
  })

  it('has an ice foot only where shores freeze', () => {
    for (const p of all) {
      if (p.snow?.iceFoot === true) expect(iceFootChance(p.place.id, p.place.climate, p), `${p.date} ${p.place.id}`).toBeGreaterThan(0)
    }
    expect(iceFootChance('norway-north', 'boreal', day('2025-02-15'))).toBe(0)
    expect(iceFootChance('greenland', 'polar', day('2025-07-15'))).toBe(0)
  })

  it('is forced and removed by the spec without moving anything else', () => {
    const base: SceneSpec = { eclipse: null, place: 'brittany', landform: null }
    const plain = scene(base, '2025-07-15')
    expect(plain.snow).toBeNull()
    const on = scene({ ...base, snow: 0.5 }, '2025-07-15')
    expect(on.snow?.cover).toBe(0.5)
    expect(scene({ ...base, snow: true }, '2025-07-15').snow).not.toBeNull()
    expect({ ...on, snow: null, title: '' }).toEqual({ ...plain, title: '' })
    const winter: SceneSpec = { eclipse: null, place: 'greenland', snow: null }
    expect(scene(winter, '2025-01-15').snow).toBeNull()
    expect(() => scene({ ...base, snow: 2 }, '2025-01-15')).toThrow()
  })

  it('goes with the summer look, unless forced', () => {
    const spec: SceneSpec = { eclipse: null, place: 'greenland', props: { phenology: false } }
    for (const p of scenes(spec, 30)) expect(p.snow).toBeNull()
    expect(scene({ ...spec, snow: true }, '2025-01-15').snow).not.toBeNull()
  })

  it('names itself in the title', () => {
    expect(scene({ eclipse: null, place: 'greenland', coast: 'beach', snow: true, props: { iceFoot: false } }, '2025-01-15').title).toMatch(/snow/)
    expect(scene({ eclipse: null, place: 'greenland', coast: 'beach', snow: true, props: { iceFoot: true } }, '2025-01-15').title).toMatch(/shore ice/)
  })
})

describe('with snow', () => {
  it('brings the mountains’ line down to the shore', () => {
    const land = { eclipse: null, place: 'kamchatka-kurils-aleutians', landform: true } as SceneSpec
    const off = scene({ ...land, snow: null }, '2025-02-15').landform!
    const on = scene({ ...land, snow: 0.95 }, '2025-02-15').landform!
    expect(on.height).toBe(off.height)
    expect(on.snowLine).toBeLessThan(off.snowLine)
    expect(on.snowLine).toBeLessThan(on.height * 0.05)
  })

  it('starts above today’s reach', () => {
    const p = scene({ eclipse: null, place: 'greenland', coast: 'beach', snow: 1, tide: 'high' }, '2025-01-15')
    const look = snowLook(p)!
    expect(look.line).toBeGreaterThan(tideMarks(p.coast).high + p.coast.runup)
    expect(snowLook(scene({ eclipse: null, place: 'brittany', snow: null }, '2025-07-15'))).toBeNull()
  })

  it('takes the flowers and, under a closed cover, the leaves', () => {
    const spec: SceneSpec = { eclipse: null, place: 'brittany', coast: 'beach' }
    for (const p of scenes({ ...spec, snow: 1 }, 30)) expect(propsOf(p).shoreLife?.flowers ?? []).toEqual([])
    expect(litterFor(scene({ ...spec, snow: 0.9 }, '2025-01-15'))).toBeNull()
    expect(litterFor(scene({ ...spec, snow: 0.4 }, '2025-01-15'))).not.toBeNull()
  })

  it('buries more grass as the cover closes, always leaving some', () => {
    const count = (cover: number): number => {
      let n = 0
      for (let i = 0; i < 2000; i++) if (grassBuried(i * 1.37, i * 0.73, cover)) n++
      return n / 2000
    }
    expect(count(0.3)).toBeLessThan(count(0.9))
    expect(count(1)).toBeLessThan(1)
    expect(count(1)).toBeGreaterThan(0.85)
  })
})

describe('the ice foot', () => {
  const spec: SceneSpec = { eclipse: null, place: 'greenland', coast: 'beach', snow: true, props: { iceFoot: true } }

  it('stands on the spring high-water contour, fixed through the tide', () => {
    const lines = (['low', 'mid', 'high'] as const).map(tide => {
      const p = scene({ ...spec, tide }, '2025-02-15')
      const s = footLine(p.coast, 40)!
      expect(terrainHeight(p.coast, ...shoreToWorld(p.coast, s, 40))).toBeCloseTo(tideMarks(p.coast).spring, 0)
      return s
    })
    for (const s of lines) expect(s).toBeCloseTo(lines[0], 0)
  })

  it('is a function of its place along the shore, and comes and goes', () => {
    expect(footShape(7, 123.4)).toEqual(footShape(7, 123.4))
    const heights = Array.from({ length: 800 }, (_, i) => footShape(7, i * 3).height)
    // About 2 m at most, as in the photos (SEASONS.md §4.1).
    expect(Math.max(...heights)).toBeLessThan(2.4)
    expect(Math.max(...heights)).toBeGreaterThan(1)
    expect(heights.filter(h => h < 0.04).length).toBeGreaterThan(20)
  })

  it('tapers from the end of each run', () => {
    const ends = runEnds([{ a: 0, standing: false }, { a: 2, standing: true }, { a: 4, standing: true }, { a: 6, standing: true }, { a: 9, standing: false }])
    expect(ends).toEqual([Infinity, 2, 4, 3, Infinity])
    expect(runEnds([{ a: 0, standing: true }, { a: 1, standing: true }])).toEqual([Infinity, Infinity])
  })

  it('is absent without snow, a shore or its switch', () => {
    expect(iceFootFor(scene({ ...spec, snow: null }, '2025-02-15'))).toBe(false)
    expect(iceFootFor(scene({ ...spec, coast: 'open-sea' }, '2025-02-15'))).toBe(false)
    expect(iceFootFor(scene({ ...spec, props: { iceFoot: false } }, '2025-02-15'))).toBe(false)
    expect(iceFootFor(scene(spec, '2025-02-15'))).toBe(true)
  })

  it('never stands in the camera, at any tide or composition, on every shore', () => {
    const coasts: SceneSpec[] = [spec, { ...spec, beachMaterial: 'cobble' }, { ...spec, coast: undefined, rockShore: 'platform' }, { ...spec, coast: undefined, rockShore: 'boulder' }, { ...spec, place: 'fundy', climate: undefined, coast: 'tidal-flat' }]
    for (const coast of coasts) {
      const spec2 = Object.fromEntries(Object.entries(coast).filter(([, v]) => v !== undefined)) as SceneSpec
      for (const p of expectDryCameras(spec2, { count: 2, above: () => -1, compositions: coast.coast === 'beach' ? ['shoreline', 'along-beach', 'framed'] : ['framed', 'shoreline'] })) {
        const objects = createIceFoot(viewOf(p, 1080))
        for (const o of objects) {
          const mesh = o as unknown as { geometry: { attributes: { position?: { count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number } } }; isInstancedMesh?: boolean; count: number }
          if (mesh.isInstancedMesh === true) continue
          const position = mesh.geometry.attributes.position!
          for (let i = 0; i < position.count; i += 7) {
            const x = position.getX(i)
            const z = position.getZ(i)
            expect(Number.isFinite(position.getY(i))).toBe(true)
            // Nothing stands over the eye within the gap.
            expect(Math.hypot(x, z), `${p.date} ${p.coast.composition}`).toBeGreaterThan(CAMERA_GAP - 1)
          }
        }
      }
    }
  })

  it('stays within the triangle budget, faces up and has finite positions', () => {
    for (const composition of ['along-beach', 'framed', 'shoreline'] as const) {
      const p = scene({ ...spec, composition }, '2025-02-15')
      const [strip] = createIceFoot(viewOf(p, 1080)) as unknown as { geometry: { index: { count: number }; attributes: { normal: { count: number; getY(i: number): number } }; computeVertexNormals(): void } }[]
      if (strip == null) continue
      expect(strip.geometry.index.count / 3).toBeLessThan(100_000)
      strip.geometry.computeVertexNormals()
      const normal = strip.geometry.attributes.normal
      let up = 0
      for (let i = 0; i < normal.count; i++) if (normal.getY(i) > 0) up++
      expect(up / normal.count, composition).toBeGreaterThan(0.8)
    }
  })

  it('has cakes that are deterministic, finite and near y = 0', () => {
    const a = cakeGeometry(1).attributes.position
    const b = cakeGeometry(1).attributes.position
    expect(a.array).toEqual(b.array)
    const v = new Vector3()
    let low = Infinity
    for (let i = 0; i < a.count; i++) {
      v.fromBufferAttribute(a, i)
      expect(Number.isFinite(v.x + v.y + v.z)).toBe(true)
      low = Math.min(low, v.y)
    }
    expect(low).toBeGreaterThan(-0.2)
    expect(a.count / 3).toBeLessThan(1000)
  })
})
