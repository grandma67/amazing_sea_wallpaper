import { Vector3 } from 'three'
import { describe, expect, it } from 'vitest'

import { GREEN, lightsOn, RED, shipLightsFor, shows, skyLuminance, WHITE, type ShipLight } from '../src/props/shipLights'
import type { HullSize } from '../src/props/ships'

const small: HullSize = { length: 14, beam: 4.5, freeboard: 1.2, spacing: 0 }
const ship: HullSize = { length: 280, beam: 40, freeboard: 12, spacing: 0 }
const seen = (lights: ShipLight[], bearing: number): ShipLight[] => lights.filter(l => shows(l, bearing))
const colours = (lights: ShipLight[]): string[] => lights.map(l => (l.color === RED ? 'red' : l.color === GREEN ? 'green' : l.color === WHITE ? 'white' : 'warm')).sort()

describe('navigation lights', () => {
  it('power vessel underway: masthead and both sidelights ahead, one side abeam, stern light astern', () => {
    const lights = shipLightsFor('motor-yacht', small, new Vector3(0, 6, 0), 5, false)
    expect(colours(seen(lights, 0))).toEqual(['green', 'red', 'white'])
    expect(colours(seen(lights, 90))).toEqual(['green', 'white'])
    expect(colours(seen(lights, -90))).toEqual(['red', 'white'])
    expect(colours(seen(lights, 180))).toEqual(['white'])
  })

  it('ships from 50 m: two masthead lights, the aft one higher, brighter than small craft', () => {
    const lights = shipLightsFor('container-ship', ship, new Vector3(-100, 50, 0), 8, false)
    const mastheads = lights.filter(l => l.sector?.[0] === -112.5 && l.sector[1] === 112.5)
    expect(mastheads.length).toBe(2)
    const [fwd, aft] = [...mastheads].sort((a, b) => b.position[0] - a.position[0])
    expect(aft.position[1]).toBeGreaterThan(fwd.position[1])
    expect(fwd.intensity).toBe(94)
  })

  it('small sailing boats: a tricolour at the masthead, no white masthead light', () => {
    const lights = shipLightsFor('sloop', { ...small, length: 10 }, new Vector3(0.5, 14, 0), 3, true)
    expect(lights.every(l => l.position[1] > 14)).toBe(true)
    expect(colours(seen(lights, 0))).toEqual(['green', 'red'])
    expect(colours(seen(lights, 180))).toEqual(['white'])
  })

  it('at anchor: all-round white, no sidelights', () => {
    const lights = shipLightsFor('motor-yacht', small, new Vector3(0, 6, 0), 0, false)
    expect(lights.some(l => l.color === RED || l.color === GREEN)).toBe(false)
    expect(lights.every(l => l.sector == null)).toBe(true)
  })

  it('trawling: green over white all round', () => {
    const lights = shipLightsFor('trawler', { ...small, length: 22 }, new Vector3(2, 10, 0), 1.5, false)
    const green = lights.find(l => l.color === GREEN && l.sector == null)!
    const white = lights.find(l => l.color === WHITE && l.sector == null)!
    expect(green.position[1]).toBeGreaterThan(white.position[1])
  })

  it('are lit from sunset to sunrise, against a sky that darkens toward night', () => {
    expect(lightsOn({ timeOfDay: 'night' })).toBe(true)
    expect(lightsOn({ timeOfDay: 'blue-hour' })).toBe(true)
    expect(lightsOn({ timeOfDay: 'golden-hour' })).toBe(false)
    const base = { sunElevationDeg: -5, moonIllumination: 1, moonElevationDeg: 40 }
    const night = skyLuminance({ ...base, timeOfDay: 'night' })
    const moonless = skyLuminance({ ...base, timeOfDay: 'night', moonIllumination: 0 })
    const blue = skyLuminance({ ...base, timeOfDay: 'blue-hour' })
    expect(moonless).toBeLessThan(night)
    expect(night).toBeLessThan(blue)
    expect(blue).toBeLessThan(skyLuminance({ ...base, timeOfDay: 'sun-on-horizon' }))
  })
})
