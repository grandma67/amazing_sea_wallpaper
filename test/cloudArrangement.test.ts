import { Ellipsoid, Geodetic, radians } from '@takram/three-geospatial'
import { Matrix4, Vector2, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { arrangementMatrix, cloudDrift, cubeSphereUv } from '../src/cloudArrangement'
import { CLOUD_GENERA } from '../src/cloudTypes'
import { dirFromAzEl } from '../src/params'
import { allParams, scene, scenes, share } from './days'

describe('cube-sphere uv', () => {
  // takram's original u, which cancels to noise near mx = 0.
  const naiveU = (mx: number, my: number): number => {
    const q = -2 * mx * mx + 2 * my * my - 3
    return Math.sqrt(1.5 + mx * mx - my * my - 0.5 * Math.sqrt(-24 * mx * mx + q * q)) * Math.sign(mx)
  }

  it('matches the original mapping away from the face centre line', () => {
    for (const [lon, lat] of [[20, 10], [-30, 35], [40, -20], [10, 60]]) {
      const p = new Geodetic(radians(lon), radians(lat), 0).toECEF()
      const n = p.clone().normalize()
      const uv = cubeSphereUv(p)
      if (Math.abs(n.x) > Math.abs(n.y) && Math.abs(n.x) > Math.abs(n.z)) {
        expect(uv.x).toBeCloseTo(naiveU(n.y, n.z) * 0.5 + 0.5, 10)
      }
    }
  })

  it('is smooth along the scene meridian (longitude 0), metre by metre', () => {
    const anchor = new Geodetic(0, radians(32), 0).toECEF()
    const east = new Vector3(0, 1, 0)
    // Under float32 the original formula jumps by ~1e-4 here; the stable one
    // is linear in the east offset.
    const f32 = (x: number): number => Math.fround(x)
    const stableU = (mx: number, my: number): number => {
      const [mx2, my2] = [f32(mx * mx), f32(my * my)]
      const a = f32(1.5 + mx2 - my2)
      return f32(Math.sqrt(f32((6 * mx2) / f32(a + Math.sqrt(f32(a * a - 6 * mx2)))))) * Math.sign(mx)
    }
    const us = [1, 2, 3, 4].map(m => {
      const n = anchor.clone().addScaledVector(east, m).normalize()
      return { stable: stableU(f32(n.y), f32(n.z)), cpu: cubeSphereUv(anchor.clone().addScaledVector(east, m)).x - 0.5 }
    })
    const steps = us.slice(1).map((u, i) => u.stable - us[i].stable)
    for (const step of steps) expect(step).toBeCloseTo(steps[0], 8)
    for (const u of us) expect(u.stable * 0.5).toBeCloseTo(u.cpu, 7)
  })
})

describe('cloud arrangement', () => {
  const days = allParams()

  it('lines up streets along the wind on fair, breezy cumulus days', () => {
    const streets = days.filter(p => p.weather.arrangement?.kind === 'streets')
    expect(streets.length).toBeGreaterThan(30)
    for (const p of streets) {
      expect(['few', 'scattered']).toContain(p.weather.kind)
      expect(['cumulus', 'stratocumulus']).toContain(CLOUD_GENERA[p.weather.formations[0]].genus)
      expect(p.weather.arrangement!.headingDeg).toBe(p.ocean.windHeadingDeg)
    }
    // Most often in the trades: the same breezy cumulus days, tropical or not.
    const eligible = (tropical: boolean) =>
      scenes({ biome: tropical ? 'tropical' : 'nordic', weather: 'scattered', wind: 9, storm: null, fog: null, eclipse: null }, 400).filter(p =>
        ['cumulus-humilis', 'cumulus', 'stratocumulus'].includes(p.weather.formations[0])
      )
    const rate = (tropical: boolean) => share(eligible(tropical), p => p.weather.arrangement?.kind === 'streets')
    expect(rate(true)).toBeGreaterThan(rate(false))
  })

  it('bands only Ac, Cc and Sc skies, never storms', () => {
    const bands = days.filter(p => p.weather.arrangement?.kind === 'bands')
    expect(bands.length).toBeGreaterThan(20)
    for (const p of bands) expect(['altocumulus', 'cirrocumulus', 'stratocumulus']).toContain(CLOUD_GENERA[p.weather.formations[0]].genus)
    for (const p of days.filter(q => q.weather.kind === 'storm' || q.weather.kind === 'clear')) expect(p.weather.arrangement).toBeNull()
  })

  it('is forced by a spec', () => {
    expect(scene({ weather: 'scattered', clouds: ['cumulus'], cloudArrangement: 'bands', storm: null }).weather.arrangement?.kind).toBe('bands')
    expect(scene({ weather: 'scattered', clouds: ['cumulus'], cloudArrangement: true, storm: null }).weather.arrangement).not.toBeNull()
    expect(scene({ cloudArrangement: null }).weather.arrangement).toBeNull()
  })

  it('stretches the weather map along and across the wind as asked', () => {
    const anchor = new Geodetic(0, radians(40), 0).toECEF()
    const worldToECEF = Ellipsoid.WGS84.getNorthUpEastFrame(anchor, new Matrix4())
    const repeat = new Vector2(100, 100)
    for (const heading of [0, 37, 90, 200]) {
      const wind = new Vector3(...dirFromAzEl(heading, 0))
      const { matrix } = arrangementMatrix(worldToECEF, wind, repeat, { along: 0.25, across: 2 })
      const step = (dir: Vector3): Vector2 => {
        const o = new Vector3().applyMatrix4(worldToECEF)
        const p = o.clone().add(dir.clone().transformDirection(worldToECEF).multiplyScalar(1000))
        return cubeSphereUv(p).sub(cubeSphereUv(o)).multiply(repeat)
      }
      const apply = (v: Vector2): Vector2 => new Vector2(matrix.x * v.x + matrix.z * v.y, matrix.y * v.x + matrix.w * v.y)
      const d = step(wind)
      const c = step(new Vector3(0, 1, 0).cross(wind).normalize())
      expect(apply(d).distanceTo(d.clone().multiplyScalar(0.25))).toBeLessThan(1e-6 * d.length() + 1e-9)
      expect(apply(c).distanceTo(c.clone().multiplyScalar(2))).toBeLessThan(1e-6 * c.length() + 1e-9)
    }
  })
})

describe('cloudDrift', () => {
  it('shifts the weather map so a cloud seen at p moves downwind by the distance asked', () => {
    const anchor = new Geodetic(0, radians(40), 0).toECEF()
    const worldToECEF = Ellipsoid.WGS84.getNorthUpEastFrame(anchor, new Matrix4())
    const repeat = new Vector2(100, 100)
    for (const heading of [0, 90, 200]) {
      const wind = new Vector3(...dirFromAzEl(heading, 0))
      const { weather, shape } = cloudDrift(worldToECEF, wind, repeat, new Vector3(3e-4, 3e-4, 3e-4), 500)
      // The map coordinate at a point 500 m downwind, after the shift, is the one at the origin before.
      const o = new Vector3().applyMatrix4(worldToECEF)
      const p = o.clone().add(wind.clone().transformDirection(worldToECEF).multiplyScalar(500))
      const before = cubeSphereUv(o).multiply(repeat)
      const after = cubeSphereUv(p).multiply(repeat).add(weather)
      expect(after.distanceTo(before)).toBeLessThan(1e-3 * weather.length() + 1e-9)
      expect(shape.length()).toBeCloseTo(500 * 3e-4)
    }
  })
})

