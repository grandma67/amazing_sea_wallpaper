import { describe, expect, it } from 'vitest'

import {
  ARC_REACH,
  AURORA_COLOURS,
  auroraCdToward,
  auroraCloudLight,
  auroraLux,
  auroraRay,
  dipFor,
  elevationOf,
  geomagnetic,
  kpFor,
  ovalEdge,
  ovalWidth,
  stormSeason,
  type AuroraParams
} from '../src/aurora'
import { shiftDate } from '../src/dates'
import type { SceneParams } from '../src/params'
import type { SceneSpec } from '../src/sceneSpec'
import { MILKY_WAY_LOG2, nightSkyCd } from '../src/nightGlow'
import { mirrorLine } from '../src/skyMirror'
import { dirFromAzEl, project, type Vec3 } from '../src/skyFrame'
import { milkyWayMap } from './milkyWayMap.mjs'
import { allParams, scene } from './days'

// NIGHT_SKY phase 6: the aurora (STARS.md §8).

const DARK = { timeOfDay: 'night', nightSky: 'starlit', weather: 'clear', fog: null, storm: null, eclipse: null } as const
/** Clear dark nights in the two winters round the solar maximum. */
const WINTER = [
  ...Array.from({ length: 92 }, (_, i) => shiftDate('2024-11-15', i)),
  ...Array.from({ length: 92 }, (_, i) => shiftDate('2025-11-15', i))
]
const winter = (spec: SceneSpec, step = 1): SceneParams[] => WINTER.filter((_, i) => i % step === 0).map(d => scene(spec, d))
const lum = (c: number[]): number => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
const milkyWay = milkyWayMap(MILKY_WAY_LOG2)
/** The display's colour looking straight up through an arc. */
const column = (a: AuroraParams): number[] =>
  [0, 1, 2].map(k => (1 - a.red - a.fringe) * AURORA_COLOURS.green[k] + a.red * AURORA_COLOURS.red[k] + a.fringe * AURORA_COLOURS.fringe[k])
/** Azimuth of the camera's heading from the geomagnetic pole (deg). */
const headingFromPole = (p: SceneParams): number => ((p.camera.headingDeg - p.aurora!.poleAzimuthDeg) % 360 + 540) % 360 - 180

describe('aurora', () => {
  it('draws Kp from the storm-day table, storms following the solar cycle', () => {
    const shares = (activity: number): number[] => {
      const n = 20000
      const c = Array<number>(10).fill(0)
      for (let i = 0; i < n; i++) c[kpFor((i + 0.5) / n, activity)]++
      return c.map(v => v / n)
    }
    const max = shares(1)
    const min = shares(0)
    expect(max.reduce((a, b) => a + b)).toBeCloseTo(1, 6)
    expect(max[0]).toBe(0)
    // Kp ≥ 5 on ~5% of sessions at maximum (1,454 storm days of 4,018 / 3
    // × 1.5 ≈ 18%; of a session ~0.18), three times the minimum's.
    const storm = (s: number[]): number => s.slice(5).reduce((a, b) => a + b)
    expect(storm(max)).toBeGreaterThan(0.1)
    expect(storm(max)).toBeLessThan(0.25)
    expect(storm(max) / storm(min)).toBeCloseTo(3, 1)
    // Quiet sessions are mostly Kp 1–2.
    expect(min[1] + min[2]).toBeGreaterThan(0.6)
  })

  it('has more storms near the equinoxes, the yearly mean kept', () => {
    // Disturbed days ~2× as common near the equinoxes as the solstices,
    // bigger storms more so (Ap 1932–2014).
    expect(stormSeason('2025-03-20', 5) / stormSeason('2025-06-20', 5)).toBeCloseTo(2, 1)
    expect(stormSeason('2025-09-21', 9) / stormSeason('2025-12-21', 9)).toBeGreaterThan(2.8)
    for (const kp of [5, 7, 9]) {
      let sum = 0
      for (let d = 0; d < 365; d++) sum += stormSeason(shiftDate('2025-01-01', d), kp)
      expect(sum / 365).toBeCloseTo(1, 2)
    }
    const storms = (date: string): number => {
      let n = 0
      for (let i = 0; i < 4000; i++) if (kpFor((i + 0.5) / 4000, 1, date) >= 5) n++
      return n / 4000
    }
    expect(storms('2025-03-20') / storms('2025-12-21')).toBeGreaterThan(1.8)
    // Quiet nights' Kp is untouched.
    expect(kpFor(0.9, 1, '2025-03-20')).toBe(kpFor(0.9, 1, '2025-12-21'))
  })

  it('puts places at their geomagnetic latitudes and the oval where NOAA has it', () => {
    expect(geomagnetic(69.5, 18).lat).toBeGreaterThan(65.5) // Tromsø ~67
    expect(geomagnetic(69.5, 18).lat).toBeLessThan(68.5)
    // North Scotland ~57.5 corrected (dipole ~60, −2.5 over Europe).
    expect(geomagnetic(57.5, -5).lat - 2.5).toBeCloseTo(57.5, 0)
    expect(geomagnetic(44, -69).lat).toBeGreaterThan(52.5) // Maine ~54
    expect(geomagnetic(44, -69).lat).toBeLessThan(55)
    // The southern hemisphere measures toward its own pole.
    expect(geomagnetic(-42, 147).lat).toBeGreaterThan(45)
    // Low arcs reach ~53° at Kp 5, ~49° at 7, ~45° at 9.
    expect(ovalEdge(5) - ARC_REACH).toBe(53)
    expect(ovalEdge(7) - ARC_REACH).toBe(49)
    expect(ovalEdge(9) - ARC_REACH).toBe(45)
    // The poleward edge moves little: ~74° quiet, ~70° in a big storm.
    expect(ovalEdge(1) + ovalWidth(1)).toBeCloseTo(73.5, 1)
    expect(ovalEdge(9) + ovalWidth(9)).toBeCloseTo(69.5, 1)
  })

  it('shows on clear dark winter nights as often as the place sees it', () => {
    const shareAt = (place: string): number => {
      const list = winter({ ...DARK, place }, 2)
      return list.filter(p => p.aurora != null).length / list.length
    }
    const tromso = shareAt('norway-north')
    expect(tromso).toBeGreaterThan(0.45)
    expect(tromso).toBeLessThan(0.78)
    const iceland = shareAt('iceland')
    expect(iceland).toBeGreaterThan(0.45)
    expect(iceland).toBeLessThan(0.8)
    const scotland = shareAt('scotland')
    expect(scotland).toBeGreaterThan(0.08)
    expect(scotland).toBeLessThan(0.32)
    expect(shareAt('maine')).toBeLessThanOrEqual(0.07)
    expect(shareAt('wadden-north-sea')).toBeLessThanOrEqual(0.07)
    expect(shareAt('tasmania')).toBeLessThanOrEqual(0.07)
  })

  it('never by day, in twilight, under overcast, storm or fog unless forced', () => {
    const days = allParams()
    const with_ = days.filter(p => p.aurora != null)
    expect(with_.length).toBeGreaterThan(0)
    for (const p of with_) {
      expect(p.timeOfDay).toBe('night')
      expect(p.weather.kind).not.toBe('overcast')
      expect(p.fog).toBeNull()
      expect(p.storm).toBeNull()
      expect(p.title).toMatch(/(Northern|Southern) lights/)
    }
    // ~9% of nights carry one (most places can't see it at all).
    const nights = days.filter(p => p.timeOfDay === 'night')
    expect(with_.length / nights.length).toBeGreaterThan(0.03)
    expect(with_.length / nights.length).toBeLessThan(0.15)
    // Southern lights in the south.
    expect(scene({ ...DARK, place: 'tasmania', aurora: 'strong' }, '2025-06-20').title).toContain('Southern lights')
  })

  it('obeys the spec field', () => {
    for (const date of WINTER.filter((_, i) => i % 23 === 0)) {
      const on = scene({ ...DARK, place: 'scotland', aurora: true }, date)
      expect(on.aurora).not.toBeNull()
      const strong = scene({ ...DARK, place: 'scotland', aurora: 'strong' }, date)
      expect(strong.aurora!.kp).toBeGreaterThanOrEqual(6)
      expect(scene({ ...DARK, place: 'norway-north', aurora: null }, date).aurora).toBeNull()
      expect(scene({ ...DARK, place: 'norway-north', aurora: false }, date).aurora).toBeNull()
      // Places the oval can't reach have none even when forced.
      expect(scene({ ...DARK, place: 'florida-carolinas', aurora: 'strong' }, date).aurora).toBeNull()
    }
    // Same day, same display.
    const a = scene({ ...DARK, place: 'norway-north', aurora: true }, '2025-01-10')
    const b = scene({ ...DARK, place: 'norway-north', aurora: true }, '2025-01-10')
    expect(a.aurora).toEqual(b.aurora)
    expect(a.title).toBe(b.title)
  })

  it('frames the brightest arc: wide, with sky, its base in the frame', () => {
    let framed = 0
    let inFrame = 0
    for (const place of ['norway-north', 'iceland', 'scotland', 'maine']) {
      for (const p of winter({ ...DARK, place, aurora: 'strong' }, 13).concat(winter({ ...DARK, place, aurora: true }, 13))) {
        const a = p.aurora!
        expect(p.camera.focalLengthMm).toBeLessThanOrEqual(24)
        expect(p.camera.horizonFraction).toBeGreaterThanOrEqual(0.6)
        if (a.frameTurnDeg === 0) continue
        framed++
        const [x] = a.arcs[0]
        const az = a.poleAzimuthDeg + (x < 0 ? 180 : 0)
        const ndc = project(p, dirFromAzEl(az, elevationOf(Math.abs(x), 110)))
        if (ndc != null && Math.abs(ndc[0]) < 1 && Math.abs(ndc[1]) < 1) inFrame++
      }
    }
    expect(framed).toBeGreaterThan(20)
    expect(inFrame / framed).toBeGreaterThan(0.9)
  })

  it('is green with red tops; storms add red with Kp and a magenta lower border', () => {
    const byKp = new Map<number, number[]>()
    for (const place of ['norway-north', 'iceland', 'scotland', 'maine']) {
      for (const force of [true, 'strong'] as const) {
        for (const p of winter({ ...DARK, place, aurora: force }, 30)) {
          const a = p.aurora!
          const c = column(a)
          if (a.kind === 'overhead') byKp.set(a.kp, [...(byKp.get(a.kp) ?? []), a.red])
          // Quiet displays: green with a few % red; no glow, no border.
          if (a.kp <= 4) {
            expect(c[1], `${place} Kp ${a.kp}`).toBeGreaterThan(2 * c[0])
            expect(a.red).toBeLessThan(0.1)
            expect(a.fringe).toBe(0)
            expect(a.redGlowKR).toBe(0)
          }
          // The type-B border: Kp ≥ 5, always in a forced storm, thin.
          if (force === 'strong') expect(a.fringe).toBeGreaterThan(0)
          expect(a.fringe).toBeLessThanOrEqual(0.08)
        }
      }
    }
    // The red share climbs with Kp under the oval.
    const mean = (kp: number): number => {
      const v = byKp.get(kp) ?? []
      return v.reduce((x, y) => x + y, 0) / v.length
    }
    expect(byKp.has(2) && byKp.has(9)).toBe(true)
    expect(mean(9)).toBeGreaterThan(0.15)
    expect(mean(9)).toBeGreaterThan(3 * mean(2))
    // Not every storm has a border (only forced ones always do).
    const storms = allParams().filter(p => p.aurora != null && p.aurora.kp >= 5)
    expect(storms.length).toBeGreaterThan(0)
    expect(storms.some(p => p.aurora!.fringe === 0)).toBe(true)
    // Brittany sees a storm's equatorward arc: red-dominated (type A, SAR).
    const low = winter({ ...DARK, place: 'brittany', aurora: 'strong' }, 30).map(p => p.aurora!)
    expect(low.length).toBeGreaterThan(0)
    for (const a of low) {
      expect(a.kind).toBe('arc')
      const c = column(a)
      expect(c[0]).toBeGreaterThan(c[1])
    }
    // Along the frame's middle: the body green (G/R > 1.3 before the sky
    // adds), and from Kp 9 the sky above the arc red up to the frame's top.
    const look = (spec: SceneSpec, date: string): { body: number[]; above: number[][] } => {
      const p = scene({ ...DARK, ...spec }, date)
      const az = headingFromPole(p)
      let [body, bodyEl] = [[0, 0, 0], 0]
      for (let el = 2; el < 40; el += 0.5) {
        const c = auroraRay(p.aurora!, az, el)
        if (lum(c) > lum(body)) [body, bodyEl] = [c, el]
      }
      return { body, above: [bodyEl + 10, 25, 32].map(el => auroraRay(p.aurora!, az, el)) }
    }
    const tromso = look({ place: 'norway-north', aurora: 'strong', swellHeight: 0.3, wind: 1 }, '2026-01-20')
    expect(tromso.body[1] / tromso.body[0]).toBeGreaterThan(1.3)
    // Kp 6: red tops just above the arc.
    expect(tromso.above[0][0]).toBeGreaterThan(tromso.above[0][1])
    const maine = look({ place: 'maine', aurora: 'strong' }, '2026-03-20')
    expect(maine.body[1] / maine.body[0]).toBeGreaterThan(1.3)
    for (const c of maine.above) expect(c[0]).toBeGreaterThan(2 * c[1])
    const quiet = look({ place: 'norway-north', aurora: true }, '2026-01-20')
    expect(quiet.body[1] / quiet.body[0]).toBeGreaterThan(2)
    // Quiet: only a hint of red well above (the tops lean toward the camera
    // along the field), no red wash.
    expect(lum(quiet.above[2])).toBeLessThan(0.08 * lum(quiet.body))
  })

  it('stands as arcs over a dark sky, not as a wash', () => {
    // Example 1 of night_fixes: a quiet night at Tromsø, against the night
    // sky's own mirror (nightGlow.ts, Milky Way included; both checked
    // against the render's line probe).
    const p = scene({ ...DARK, place: 'norway-north', aurora: true }, '2026-01-20')
    const a = p.aurora!
    expect(a.kp).toBeLessThanOrEqual(3)
    expect(a.arcs.length).toBeLessThanOrEqual(2)
    const ratio = (dir: Vec3): number => auroraCdToward(a, dir) / nightSkyCd(p, dir, milkyWay)
    // The brightest point of the arc across the frame's width (folds and
    // patches change it along the arc).
    let peak = 0
    let peakEl = 0
    for (let az = -20; az <= 20; az += 2) {
      for (const pt of mirrorLine(p, { az, el: [2, 40], step: 0.25 }, ratio, 1).points) if (pt.value > peak) [peak, peakEl] = [pt.value, pt.el]
    }
    // The arc stands out of the sky (the render's probe: ~2× the sky beside
    // it, ~3× the sky above)...
    expect(peak).toBeGreaterThan(1.8)
    expect(peakEl).toBeGreaterThan(5)
    // ...and the sky above it is barely touched: no diffuse wash.
    for (const el of [peakEl + 12, 30, 45, 60]) expect(ratio(dirFromAzEl(p.camera.headingDeg, el))).toBeLessThan(0.5)
    // Overhead the diffuse glow alone is under half the sky.
    const diffuseOnly: AuroraParams = { ...a, arcs: [] }
    for (const el of [10, 20, 45, 90]) {
      const dir = dirFromAzEl(p.camera.headingDeg, el)
      expect(auroraCdToward(diffuseOnly, dir) / nightSkyCd(p, dir, milkyWay)).toBeLessThan(0.5)
    }
  })

  it('samples rays without stripes', () => {
    // Example 4: a storm seen from Scotland. Up columns of 1080p pixels
    // across the frame, averaged over the layers' offset (what the per-pixel
    // jitter gives): no bands parallel to the arcs, and little grain between
    // offsets. The fringe and the rays aliased here (1–3% bands, 13% grain)
    // before they were sampled by layer and faded.
    const p = scene({ ...DARK, place: 'scotland', aurora: 'strong' }, '2026-02-18')
    const a = p.aurora!
    for (const az of [-40, -20, 0, 20]) {
      const m = mirrorLine(p, { az, el: [6, 30], step: 0.04 }, (dir, j) => auroraCdToward(a, dir, j))
      expect(m.stats.periodDeg == null || m.stats.ripple < 0.003, `az ${az}: ${m.stats.summary}`).toBe(true)
      expect(m.grain, `az ${az}`).toBeLessThan(0.12)
    }
  })

  it('leans rays along the magnetic field', () => {
    // Dipole dip: ~77° at 65°, ~73° at 55° geomagnetic.
    expect(dipFor(65)).toBeCloseTo(76.9, 0)
    expect(dipFor(55)).toBeCloseTo(70.7, 0)
    // A ray (its foot on the brightest arc, 400 km along it) seen in a
    // poleward frame: going up the field line it leans toward the camera,
    // so it stands taller and fans out toward the frame's edge (the rays
    // converge on the point opposite the magnetic zenith, below the horizon).
    const p = scene({ ...DARK, place: 'maine', aurora: 'strong' }, '2026-03-20')
    const a = p.aurora!
    const lean = 1 / Math.tan((a.dipDeg * Math.PI) / 180)
    const at = (y: number, h: number, k: number): [number, number] => {
      const x = a.arcs[0][0] - (h - 110) * lean * k
      const az = (Math.atan2(-y, x) * 180) / Math.PI
      return project(p, dirFromAzEl(a.poleAzimuthDeg + az, elevationOf(Math.hypot(x, y), h)))!
    }
    for (const y of [-400, 400]) {
      const [foot, top, vertical] = [at(y, 110, 1), at(y, 250, 1), at(y, 250, 0)]
      expect(top[1]).toBeGreaterThan(vertical[1])
      expect(Math.abs(top[0] - foot[0])).toBeGreaterThan(Math.abs(vertical[0] - foot[0]))
      expect(Math.sign(top[0] - foot[0])).toBe(Math.sign(foot[0] - at(0, 110, 1)[0]))
    }
  })

  it('lights the clouds from the arc: green when quiet, redder in storms', () => {
    const quiet = scene({ ...DARK, place: 'norway-north', weather: 'scattered', aurora: true }, '2026-01-20')
    const storm = scene({ ...DARK, place: 'maine', weather: 'scattered', aurora: 'strong' }, '2026-03-20')
    for (const p of [quiet, storm]) {
      const a = p.aurora!
      const light = auroraCloudLight(a)
      // Toward the brightest arc, low in the sky.
      const fromPole = a.arcs[0][0] < 0 ? 180 : 0
      expect(Math.abs(((light.azDeg - a.poleAzimuthDeg - fromPole) % 360 + 540) % 360 - 180)).toBeLessThan(1)
      expect(light.elDeg).toBeGreaterThan(5)
      expect(light.elDeg).toBeLessThan(40)
      // A surface facing the display gets more than level ground.
      expect(lum(light.lux)).toBeGreaterThan(lum(auroraLux(a)))
    }
    const [q, s] = [auroraCloudLight(quiet.aurora!).lux, auroraCloudLight(storm.aurora!).lux]
    expect(q[1]).toBeGreaterThan(q[0])
    expect(s[0] / s[1]).toBeGreaterThan(q[0] / q[1])
    expect(lum(s)).toBeGreaterThan(lum(q))
  })

  it('lights the ground faintly, more in bigger storms', () => {
    const lux = (spec: SceneSpec, date: string): number => lum(auroraLux(scene({ ...DARK, ...spec }, date).aurora!))
    const quiet = lux({ place: 'norway-north', aurora: true }, '2026-01-20')
    const storm = lux({ place: 'norway-north', aurora: 'strong' }, '2026-01-20')
    const big = lux({ place: 'maine', aurora: 'strong' }, '2026-03-20')
    expect(quiet).toBeGreaterThan(1e-5)
    expect(storm).toBeGreaterThan(quiet)
    // A Kp 9 display lights the ground less than a quarter moon (~0.01 lux)
    // and about as much as a starlit night (0.002).
    expect(big).toBeGreaterThan(storm * 0.5)
    expect(big).toBeLessThan(0.01)
    // Once per render: a few ms.
    const a = scene({ ...DARK, place: 'maine', aurora: 'strong' }, '2026-03-20').aurora!
    const t0 = performance.now()
    auroraLux(a)
    expect(performance.now() - t0).toBeLessThan(50)
  })
})
