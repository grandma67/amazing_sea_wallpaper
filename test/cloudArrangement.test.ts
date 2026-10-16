import { Ellipsoid, Geodetic, radians } from '@takram/three-geospatial'
import { Matrix4, Vector2, Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { arrangementMatrix, cubeSphereUv } from '../src/cloudArrangement'
import { CLOUD_GENERA } from '../src/cloudTypes'
import { dirFromAzEl } from '../src/params'
import { allParams, scene, share } from './days'

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
    // Most often in the trades.
    const eligible = (tropical: boolean) =>
      days.filter(
        p =>
          (p.biome.name === 'tropical') === tropical &&
          ['few', 'scattered'].includes(p.weather.kind) &&
          ['cumulus-humilis', 'cumulus', 'stratocumulus'].includes(p.weather.formations[0]) &&
          p.ocean.windSpeed >= 7
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
