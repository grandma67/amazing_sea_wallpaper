// Warnings printed after each snapshot, for the mistakes that cost the most
// render rounds: checking a pale feature against the glare of a low sun, a
// prop that was placed but landed out of frame, and GL messages (always a bug
// here, often invisible in the picture).

const DEG = Math.PI / 180

/** The grade's clamp (scene.ts): an exposed median there is a frame of clipped white. */
const CLIPPED_MEDIAN = 39
/** Share of a frame's pixels (at 160×90) at luma ≥ 250 above which it is washed out.
 * Measured (tools/RENDER.md "Broken frames"): broken renders 0.50–1.00, real frames ≤ 0.022. */
export const WHITE_SHARE = 0.3
/** Meter cells (160×90 = 14 400) with NaN/∞ above which the frame is not trusted: 2026-11-15's
 * few (1–4 a frame) are zeroed harmlessly; 2026-11-17 had 191 and published white. */
export const NON_FINITE_CELLS = 144
/** The light numbers every lit material is built from (scene.ts debug). */
const LIGHT_FIELDS = ['cubeSkylight', 'skyIrradiance', 'sunIrradiance', 'cloudSkylight']

/**
 * Why a render must not be published, or [] if it may. `params` is a snapshot's params with
 * `debug` (NaN in the page, null once written to JSON: both count as broken), `luma` the frame
 * shrunk to 160×90 ({min, max, mean, white}: white the share at luma ≥ 250). snapshot.mjs
 * --fail-blank treats these like a blank frame (not saved, exit 1), so the site keeps yesterday's.
 */
export function brokenFrame(params, luma = null) {
  const debug = params?.debug ?? {}
  const reasons = []
  for (const field of LIGHT_FIELDS) {
    const v = debug[field]
    if (Array.isArray(v) && v.some(x => typeof x !== 'number' || !Number.isFinite(x))) reasons.push(`${field} is not finite (${v.map(String).join(', ')})`)
  }
  if (typeof debug.frameMedian === 'number' && debug.frameMedian >= CLIPPED_MEDIAN) reasons.push(`frame median ${debug.frameMedian.toFixed(1)} is the grade's clamp: clipped white`)
  if ((debug.frameNonFinite ?? 0) > NON_FINITE_CELLS) reasons.push(`${debug.frameNonFinite} meter cells read NaN/inf (> ${NON_FINITE_CELLS})`)
  if (luma?.white != null && luma.white > WHITE_SHARE) reasons.push(`${(luma.white * 100).toFixed(0)}% of the frame is white (> ${WHITE_SHARE * 100}%)`)
  return reasons
}

/** Warnings for one render, from its params (with debug.props) and its GL
 * messages (`watchPage(…).gl()` in lib.mjs). */
export function snapshotWarnings(params, props = [], gl = []) {
  const warnings = gl.map(m => `GL: ${m} (knowledge/LESSONS.md "Page")`)
  const [x, y, z] = params.sunDirection
  const elevation = Math.asin(Math.max(-1, Math.min(1, y))) / DEG
  const azimuth = Math.atan2(x, -z) / DEG
  const off = Math.abs(((azimuth - params.camera.headingDeg + 540) % 360) - 180)
  if (params.timeOfDay !== 'night' && elevation > -2 && elevation < 30 && off < 60) {
    warnings.push(
      `backlit: sun ${off.toFixed(0)}° off the view, ${elevation.toFixed(0)}° up. Foam, spray, mist and pale things ` +
        `don't show against the glare; check them front-lit too ("sunAzimuthDeg": 160).`
    )
  }
  const report = params.debug?.props ?? {}
  for (const kind of props.includes('all') ? Object.keys(report) : props) {
    const r = report[kind]
    if (r == null) warnings.push(`${kind}: nothing placed (chance, or no spot found).`)
    else if (r.inFrame === 0) warnings.push(`${kind}: ${r.placed} placed but none in frame.`)
  }
  for (const [kind, c] of Object.entries(params.debug?.shadowCoverage ?? {})) {
    if (c.shaded < c.lit) warnings.push(`${kind}: ${c.lit - c.shaded} of ${c.lit} lit objects don't read the land and cloud shade (src/propShade.ts).`)
  }
  return warnings
}
