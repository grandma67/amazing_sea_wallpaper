import { expect } from 'vitest'

import { createCamera } from '../src/camera'
import { shiftDate } from '../src/dates'
import { generateParams, type CoastParams, type Composition, type SceneParams } from '../src/params'
import { propChoices, type PropChoices } from '../src/props/choices'
import { PropContext } from '../src/props/context'
import { parseSceneSpec, type SceneSpec } from '../src/sceneSpec'
import { shoreToWorld, terrainHeight } from '../src/terrain'

/** Every day of three years: enough for the rare events to show up. */
export const DAYS: string[] = Array.from({ length: 3 * 365 }, (_, i) => shiftDate('2024-01-01', i))

let cache: SceneParams[] | null = null
/** The real days, for how often things happen and where. */
export function allParams(): SceneParams[] {
  cache ??= DAYS.map(d => generateParams(d))
  return cache
}

const choices = new WeakMap<SceneParams, PropChoices>()
/** What the props choose on a day (`propChoices`, src/props/choices.ts), on
 * the render's own streams (`'props/<kind>'`): the tests' `p.props` of
 * params.mjs. Cached per params. */
export function propsOf(p: SceneParams): PropChoices {
  let c = choices.get(p)
  if (c == null) choices.set(p, (c = propChoices(p)))
  return c
}

export function share(list: SceneParams[], test: (p: SceneParams) => boolean): number {
  return list.filter(test).length / list.length
}

/** Expect the share of `list` passing `test` to be `target` within sampling
 * noise: 3 binomial standard deviations for this many samples (200 samples
 * at 40% allow ±10%). Use it instead of toBeCloseTo on random shares, which
 * fails on unlucky draws. */
export function expectShare<T>(list: T[], test: (p: T) => boolean, target: number, sigmas = 3): void {
  const n = list.length
  const value = list.filter(test).length / n
  const tolerance = sigmas * Math.sqrt((target * (1 - target)) / n) + 0.5 / n
  expect(Math.abs(value - target), `share ${value.toFixed(3)} vs ${target} ± ${tolerance.toFixed(3)} (${n} samples)`).toBeLessThanOrEqual(tolerance)
}

/** A scene described by a spec (sceneSpec.ts), on `date` or the spec's own.
 * Its JSON is validated as the page's is, so a wrong field fails instead of
 * forcing nothing (`field: undefined`, not forced, isn't in the JSON). */
export function scene(spec: SceneSpec, date = DAYS[0]): SceneParams {
  parseSceneSpec(JSON.stringify(spec))
  return generateParams(date, 0, 16 / 9, spec)
}

/** The same spec on `count` days spread over the three years, for checking
 * a case on many scenes without searching for days that have it. */
export function scenes(spec: SceneSpec, count = 30): SceneParams[] {
  return Array.from({ length: count }, (_, i) => scene(spec, DAYS[Math.floor((i * DAYS.length) / count)]))
}

/** A PropContext for a spec at `height` px, without WebGL (the first
 * composition attempt, like scene(); the page may re-roll a bad framing): for testing what a prop places, how far away and how many
 * pixels it gets (ctx.pixelAngle) before rendering. */
export function view(spec: SceneSpec, height = 1080, date?: string): PropContext {
  return viewOf(scene(spec, date), height)
}

/** The same for given params (a real day from allParams()). */
export function viewOf(params: SceneParams, height = 1080): PropContext {
  const { camera } = createCamera(params, params.camera.aspect * height, height)
  return new PropContext(params, camera, null, (camera.fov * Math.PI) / 180 / height)
}

/** Every forced tide stage × composition of a coast spec: the camera stands
 * above today's water (by `above(p)` m; default the still water) on finite
 * ground, at its composition. A new coast kind or shore profile must pass it
 * at the extremes, not only on the stage it was built for (a marsh built
 * below the spring high water drowned the camera at high tide). Returns the
 * scenes, for more checks. */
export function expectDryCameras(
  spec: SceneSpec,
  { count = 6, compositions = ['shoreline', 'along-beach', 'framed', 'overlook'], above = () => 0 }: { count?: number; compositions?: readonly Composition[]; above?: (p: SceneParams) => number } = {}
): SceneParams[] {
  const out: SceneParams[] = []
  for (const tide of ['low', 'mid', 'high'] as const) {
    for (const composition of compositions) {
      for (const p of scenes({ eclipse: null, ...spec, tide, composition }, count)) {
        const ground = terrainHeight(p.coast, 0, 0)
        const where = `${p.date} ${tide} ${composition} (${p.coast.type}, ${p.place.id})`
        expect(Number.isFinite(ground), where).toBe(true)
        expect(ground, `camera ground ${where}`).toBeGreaterThan(above(p))
        out.push(p)
      }
    }
  }
  return out
}

/** The 15th of each month, for tables that must hold all year. */
export const MONTHS: string[] = Array.from({ length: 12 }, (_, i) => `2025-${String(i + 1).padStart(2, '0')}-15`)

/** A clear, moonless night with nothing in the sky: for night-sky features. */
export const DARK = { timeOfDay: 'night', nightSky: 'starlit', weather: 'clear', fog: null, storm: null, eclipse: null } as const

/** The calendar month of a date or a day, 1–12. */
export const monthOf = (day: string | { date: string }): number => Number((typeof day === 'string' ? day : day.date).slice(5, 7))

/** Ground height at shore coordinates (s = 0 the land's foot, `a` along it). */
export const heightAt = (coast: CoastParams, s: number, a = 0): number => terrainHeight(coast, ...shoreToWorld(coast, s, a))

/** Expect `test` of every item, with one `expect` for the whole list: `expect`
 * per vertex or instance took seconds (trees: 7.7 s of 7.9). An empty list
 * fails: a rule checked on nothing proves nothing. Filter first, and pass
 * `allowEmpty` for a rule that may have no days to apply to. */
export function expectEvery<T>(items: Iterable<T>, test: (item: T) => boolean, { what = item => item, allowEmpty = false }: { what?: (item: T) => unknown; allowEmpty?: boolean } = {}): void {
  let count = 0
  let failed = 0
  let first: T | undefined
  for (const item of items) {
    count++
    if (test(item)) continue
    if (failed++ === 0) first = item
  }
  if (!allowEmpty) expect(count, 'checked nothing').toBeGreaterThan(0)
  expect(failed, failed > 0 ? `${failed} of ${count} fail, first: ${JSON.stringify(what(first as T))}` : undefined).toBe(0)
}

/** A value by its path, `'coast.tide.mean'`. */
const pathOf = (p: unknown, path: string): unknown => path.split('.').reduce<unknown>((v, key) => (v as Record<string, unknown> | null | undefined)?.[key], p)

/** Expect two scenes to agree on these fields: forcing a feature must leave the
 * rest of the day as drawn (SCENE_SPECS.md "Adding a spec field"). */
export function expectSameDay(a: SceneParams, b: SceneParams, paths: readonly string[]): void {
  for (const path of paths) expect(pathOf(a, path), `${a.date} ${path}`).toEqual(pathOf(b, path))
}
