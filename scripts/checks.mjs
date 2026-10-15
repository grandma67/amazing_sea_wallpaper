// Warnings printed after each snapshot, for the mistakes that cost the most
// render rounds: checking a pale feature against the glare of a low sun, and
// a prop that was placed but landed out of frame.

const DEG = Math.PI / 180

/** Warnings for one render, from its params (with debug.props). */
export function snapshotWarnings(params, props = []) {
  const warnings = []
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
  return warnings
}
