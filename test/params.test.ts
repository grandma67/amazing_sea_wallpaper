import { describe, expect, it } from 'vitest'

import { dirFromAzEl, generateParams, horizontalHalfFovDeg, type TimeOfDay } from '../src/params'
import { allParams, share } from './days'

const SUN_ELEVATION: Record<TimeOfDay, [number, number]> = {
  'golden-hour': [1.5, 9],
  'sun-on-horizon': [-0.6, 1.2],
  'blue-hour': [-7, -2.5],
  daylight: [10, 32],
  midday: [35, 70],
  night: [-30, -16]
}

describe('dirFromAzEl', () => {
  it('uses azimuth 0 = -Z, 90 = +X, and elevation up', () => {
    const north = dirFromAzEl(0, 0)
    expect(north[0]).toBeCloseTo(0)
    expect(north[2]).toBeCloseTo(-1)
    const east = dirFromAzEl(90, 0)
    expect(east[0]).toBeCloseTo(1)
    expect(dirFromAzEl(123, 90)[1]).toBeCloseTo(1)
  })

  it('returns unit vectors', () => {
    for (const [az, el] of [[10, 20], [200, -40], [359, 5]]) expect(Math.hypot(...dirFromAzEl(az, el))).toBeCloseTo(1)
  })
})

describe('horizontalHalfFovDeg', () => {
  it('puts the 36 mm side across a landscape frame', () => {
    expect(horizontalHalfFovDeg(18, 16 / 9)).toBeCloseTo(45)
  })

  it('is narrower in portrait for the same lens', () => {
    expect(horizontalHalfFovDeg(35, 9 / 16)).toBeLessThan(horizontalHalfFovDeg(35, 16 / 9))
  })
})

describe('generateParams', () => {
  const days = allParams()

  it('is deterministic for a date', () => {
    expect(generateParams('2026-10-15')).toEqual(generateParams('2026-10-15'))
  })

  it('keeps the same scene in portrait, only recomposed', () => {
    for (const p of days.slice(0, 60)) {
      const tall = generateParams(p.date, 0, 9 / 19.5)
      expect(tall.biome.name).toBe(p.biome.name)
      expect(tall.sea).toEqual(p.sea)
      expect(tall.timeOfDay).toBe(p.timeOfDay)
      expect(tall.weather.kind).toBe(p.weather.kind)
      expect(tall.fog).toEqual(p.fog)
      expect(tall.colony).toBe(p.colony)
      expect(tall.pinnipeds).toBe(p.pinnipeds)
      expect(tall.camera.aspect).toBeCloseTo(9 / 19.5)
    }
  })

  it('places the sun within its time of day and the moon by its real phase', () => {
    // Eclipse days place both by the eclipse; on starlit nights the moon is
    // just put out of sight.
    for (const p of days.filter(p => p.eclipse == null && p.nightSky !== 'starlit')) {
      const [lo, hi] = SUN_ELEVATION[p.timeOfDay]
      expect(p.sunElevationDeg).toBeGreaterThanOrEqual(lo)
      expect(p.sunElevationDeg).toBeLessThanOrEqual(hi)
      expect(Math.hypot(...p.sunDirection)).toBeCloseTo(1)
      expect(Math.hypot(...p.moonDirection)).toBeCloseTo(1)
      // Angle between sun and moon = elongation from the phase.
      const dot = p.sunDirection.reduce((s, v, i) => s + v * p.moonDirection[i], 0)
      const elongation = p.moonPhaseDeg <= 180 ? p.moonPhaseDeg : 360 - p.moonPhaseDeg
      expect(Math.acos(Math.min(1, Math.max(-1, dot))) * (180 / Math.PI)).toBeCloseTo(elongation, 3)
    }
  })

  it('knows a full moon when it sees one', () => {
    // Full moon on 2026-10-26 (UTC 04:12).
    expect(generateParams('2026-10-26').moonIllumination).toBeGreaterThan(0.98)
    expect(generateParams('2026-10-10').moonIllumination).toBeLessThan(0.15)
  })

  it('lights nights by the moon when it is up, and by the stars when it is not', () => {
    const nights = days.filter(p => p.timeOfDay === 'night')
    for (const p of nights) {
      expect(p.nightSky).not.toBeNull()
      if (p.nightSky === 'starlit') {
        expect(p.moonlight).toBe(0)
        expect(p.moonElevationDeg <= 2 || p.moonIllumination <= 0.03).toBe(true)
      } else {
        expect(p.moonElevationDeg).toBeGreaterThan(2)
        expect(p.moonlight).toBeGreaterThan(0)
        expect(p.moonlight).toBeLessThanOrEqual(1)
      }
    }
    for (const p of days.filter(p => p.timeOfDay !== 'night')) expect(p.nightSky).toBeNull()
    // All kinds of nights: full, half, crescent moons, and none.
    expect(nights.filter(p => p.nightSky === 'starlit').length).toBeGreaterThan(10)
    expect(nights.some(p => p.moonIllumination > 0.95)).toBe(true)
    expect(nights.some(p => p.nightSky === 'moonlit' && p.moonIllumination < 0.6 && p.moonIllumination > 0.4)).toBe(true)
    expect(nights.some(p => p.nightSky === 'moonlit' && p.moonIllumination < 0.3)).toBe(true)
  })

  it('shows the moon by day on some days', () => {
    const inFrame = days.filter(p => {
      if (p.timeOfDay === 'night' || p.timeOfDay === 'blue-hour' || p.eclipse != null) return false
      const [x, y, z] = p.moonDirection
      const rel = ((((Math.atan2(x, -z) * 180) / Math.PI - p.camera.headingDeg) % 360) + 540) % 360 - 180
      const halfFov = (Math.atan(18 / p.camera.focalLengthMm) * 180) / Math.PI
      return Math.abs(rel) < halfFov && y > 0.03
    })
    expect(inFrame.length).toBeGreaterThan(40)
  })

  it('keeps every camera and sea value in a sane range', () => {
    for (const p of days) {
      expect(p.camera.horizonFraction).toBeGreaterThan(0.3)
      expect(p.camera.horizonFraction).toBeLessThan(0.7)
      expect(p.camera.focalLengthMm).toBeGreaterThanOrEqual(14)
      expect(p.camera.heightM).toBeGreaterThan(1)
      expect(p.ocean.windSpeed).toBeGreaterThan(0)
      expect(p.ocean.windSpeed).toBeLessThanOrEqual(24)
      expect(p.ocean.swellHeight).toBeGreaterThanOrEqual(0)
      expect(p.ocean.swellWavelength).toBeLessThanOrEqual(320)
      expect(p.weather.coverage).toBeGreaterThanOrEqual(0)
      expect(p.weather.coverage).toBeLessThanOrEqual(1)
      expect(p.weather.sunVisibility).toBeGreaterThanOrEqual(0)
      expect(p.weather.sunVisibility).toBeLessThanOrEqual(1)
      expect(p.title.length).toBeGreaterThan(0)
    }
  })

  it('has storms only by day, with a gale and cumulonimbus', () => {
    for (const p of days.filter(p => p.storm != null)) {
      expect(p.timeOfDay).not.toBe('night')
      expect(p.weather.kind).toBe('storm')
      expect(p.weather.formations).toContain('cumulonimbus')
      expect(p.title).toMatch(/thunderstorm|squall/)
    }
    expect(share(days, p => p.storm != null)).toBeLessThan(0.12)
  })

  it('has rainbows only with a low sun, showers and the sun behind the camera', () => {
    for (const p of days.filter(p => p.rainbow != null)) {
      expect(['golden-hour', 'daylight']).toContain(p.timeOfDay)
      expect(p.sunElevationDeg).toBeLessThan(42)
      expect(p.fog).toBeNull()
      const view = dirFromAzEl(p.camera.headingDeg, 0)
      expect(p.sunDirection[0] * view[0] + p.sunDirection[2] * view[2]).toBeLessThan(0)
      expect(p.title).toContain('rainbow')
    }
  })

  it('puts ice only on polar seas, and penguins only in the Southern Ocean', () => {
    for (const p of days) {
      if (p.sea.ice != null) expect(['arctic', 'southern']).toContain(p.sea.ocean)
      if (p.colony === 'penguin') expect(p.sea.ocean).toBe('southern')
      if (p.sea.ocean === 'southern' && p.colony != null) expect(p.colony).toBe('penguin')
    }
  })
})

describe('fog', () => {
  const days = allParams()
  const foggy = days.filter(p => p.fog != null)

  it('comes on about one day in twenty', () => {
    expect(foggy.length / days.length).toBeGreaterThan(0.02)
    expect(foggy.length / days.length).toBeLessThan(0.1)
  })

  it('needs light winds and no storm, and calms the sea', () => {
    for (const p of foggy) {
      expect(p.storm).toBeNull()
      expect(p.ocean.windSpeed).toBeLessThanOrEqual(6)
      if (p.fog!.kind === 'sea-smoke') expect(p.ocean.windSpeed).toBeLessThanOrEqual(3)
    }
  })

  it('makes sea smoke only in cold winters', () => {
    for (const p of foggy.filter(p => p.fog!.kind === 'sea-smoke')) {
      expect(p.sea.ocean === 'arctic' || p.sea.ocean === 'southern' || p.biome.name === 'nordic').toBe(true)
      expect(p.fog!.start).toBe(0)
    }
  })

  it('lies offshore as a bank, or envelops us', () => {
    for (const p of foggy) {
      const { start, visibility, height } = p.fog!
      expect(start === 0 || (start >= 400 && start <= 2500)).toBe(true)
      expect(visibility).toBeGreaterThan(0)
      expect(height).toBeGreaterThan(0)
      expect(p.title).toMatch(start > 0 ? /fog bank/ : /\bfog\b|sea smoke/)
    }
  })

  it('dims the sun by the fog layer between it and us', () => {
    for (const p of foggy.filter(p => p.fog!.start === 0)) {
      const { visibility, height } = p.fog!
      const sinEl = Math.max(0.05, Math.sin((p.sunElevationDeg * Math.PI) / 180))
      expect(p.weather.sunVisibility).toBeLessThanOrEqual(Math.exp(-((3.912 / visibility) * height) / sinEl) + 1e-12)
    }
  })
})

describe('lighthouse', () => {
  const days = allParams()
  const lit = days.filter(p => p.lighthouse != null)

  it('stands on about one day in eleven, rarely in polar seas', () => {
    expect(lit.length / days.length).toBeGreaterThan(0.05)
    expect(lit.length / days.length).toBeLessThan(0.15)
    const polar = (p: (typeof days)[number]): boolean => p.sea.ocean === 'arctic' || p.sea.ocean === 'southern'
    const polarDays = days.filter(polar)
    if (polarDays.length > 50) expect(share(polarDays, p => p.lighthouse != null)).toBeLessThan(0.08)
  })

  it('is lit from sunset to sunrise and in fog only', () => {
    for (const p of lit) {
      const dark = p.timeOfDay === 'night' || p.timeOfDay === 'blue-hour' || p.timeOfDay === 'sun-on-horizon'
      expect(p.lighthouse!.lit).toBe(dark || p.fog != null)
    }
  })

  it('stands on a point only on a beach coast; granite only on rocks', () => {
    for (const p of lit) {
      const l = p.lighthouse!
      if (l.site === 'point') expect(p.coast.type).toBe('beach')
      if (l.paint === 'granite') expect(l.site).toBe('rock')
      expect(l.height).toBeGreaterThan(10)
      expect(p.title).toContain('lighthouse')
    }
  })

  it('writes the chart character from the flash grouping', () => {
    for (const p of lit) {
      const { character, flashes } = p.lighthouse!
      expect(character).toMatch(flashes > 1 ? new RegExp(`^Fl\\(${flashes}\\) W \\d+(\\.\\d)?s$`) : /^Fl W \d+(\.\d)?s$/)
    }
  })
})

describe('pinnipeds', () => {
  const days = allParams()
  const hauled = days.filter(p => p.pinnipeds != null)

  it('only appear on coasts where that kind lives', () => {
    const where: Record<string, string[]> = {
      seal: ['nordic/atlantic', 'nordic/pacific', 'nordic/arctic', 'mediterranean/pacific', 'volcanic/pacific', 'volcanic/atlantic'],
      'sea-lion': ['nordic/pacific', 'mediterranean/pacific', 'mediterranean/indian', 'desert/pacific', 'volcanic/pacific', 'tropical/pacific'],
      'fur-seal': ['nordic/southern', 'desert/atlantic', 'desert/pacific', 'volcanic/southern'],
      'elephant-seal': ['nordic/southern', 'mediterranean/pacific', 'volcanic/southern']
    }
    expect(hauled.length).toBeGreaterThan(0)
    for (const p of hauled) expect(where[p.pinnipeds!]).toContain(`${p.biome.name}/${p.sea.ocean}`)
  })

  it('are named in the title', () => {
    const names = { seal: 'seals', 'sea-lion': 'sea lions', 'fur-seal': 'fur seals', 'elephant-seal': 'elephant seals' }
    for (const p of hauled) expect(p.title).toContain(names[p.pinnipeds!])
  })
})
