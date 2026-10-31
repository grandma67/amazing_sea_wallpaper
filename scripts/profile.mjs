// The shape of the coast without rendering: the beach and seabed numbers, a
// cross-shore profile, and a top-down map of heights and depths, all from the
// TypeScript mirror of the terrain shader (terrain.ts terrainHeight). Bars,
// rip channels, cusps, storm ridges and where the waves break show here in a
// second; check geometry with it before a render round.
//
//   node scripts/profile.mjs [--scene SPEC] [--out DIR] [--res M] [DATE]
//
// SPEC is a JSON file or inline JSON (as for snapshot.mjs); a { base, scenes }
// file gives one profile and map per scene. DATE overrides the spec's date
// (default: the spec's, else today's test start 2024-01-01). The params are the
// ones the page renders (generateSceneParams).
//
// Prints: state, grain, slopes, width, bars, rips, cusps, ridges, run-up,
// beach lines and the break depth; a reef's numbers (drawn and reached
// lagoon depth, crest, passes, shelter) and the surf zone's reach; where
// waves break along the camera's cut (bands of s, so a 2 m strip on a steep
// reef face shows before any render); then heights along s (m seaward of the
// waterline; negative is land) at the camera's along-shore position, at the
// nearest rip channel and at the nearest reef pass.
// Writes OUT/NAME.profile.png (default out/profile): sea at the top, land
// below, the along-shore coordinate a across. Land brown to green by height,
// water light to dark blue by depth, contours every 0.5 m, the waterline
// black, white where waves of the day's set height break (depth = break
// depth), the camera red, a faint grid every 50 m. --res is metres per pixel
// (default 1).
//
// Examples:
//   node scripts/profile.mjs --scene '{"place":"east-australia","beachState":"transverse-bar-rip","coast":"beach"}' 2024-01-15
//   node scripts/profile.mjs --scene scenes/beach-states.json --out $SP/profile

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { crc32, deflateSync } from 'node:zlib'
import { createServer } from 'vite'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return fallback
  const [, value] = args.splice(i, 2)
  return value
}
const sceneArg = option('scene', null)
const outDir = resolve(option('out', 'out/profile'))
const resArg = Number(option('res', 1))
const unknown = args.find(a => a.startsWith('--'))
if (unknown != null) throw new Error(`unknown option ${unknown}`)
const dateArg = args[0]

const merge = (a, b) => {
  if (b === null || typeof b !== 'object' || Array.isArray(b) || a == null || typeof a !== 'object' || Array.isArray(a)) return b
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = merge(a[k], v)
  return out
}
async function specs() {
  if (sceneArg == null) return [{ name: dateArg ?? '2024-01-01', spec: {} }]
  const parsed = JSON.parse(/^\s*[[{]/.test(sceneArg) ? sceneArg : await readFile(sceneArg, 'utf8'))
  if (!Array.isArray(parsed.scenes)) return [{ name: parsed.name ?? dateArg ?? parsed.date ?? 'profile', spec: parsed }]
  return parsed.scenes.map((scene, i) => {
    const spec = merge(parsed.base ?? {}, scene)
    return { name: spec.name ?? `scene-${i + 1}`, spec }
  })
}

/** A PNG from RGB rows, with node's zlib only. */
function png(width, height, rgb) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(body))
    return Buffer.concat([len, body, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header.set([8, 2, 0, 0, 0], 8)
  const raw = Buffer.alloc((width * 3 + 1) * height)
  for (let y = 0; y < height; y++) rgb.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}

const lerp = (a, b, t) => a.map((x, i) => x + (b[i] - x) * t)
const clamp01 = x => Math.min(1, Math.max(0, x))
const f = (x, d = 2) => (Math.abs(x) < 1e4 ? Number(x).toFixed(d) : String(x))

const server = await createServer({ cacheDir: resolve('node_modules/.vite-params'), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
try {
  const [{ generateSceneParams }, { parseSceneSpec }, terrain, { beachLines }, { shelterAt }, { lagoonSlope }] = await Promise.all(
    ['/src/composition.ts', '/src/sceneSpec.ts', '/src/terrain.ts', '/src/beach.ts', '/src/shelter.ts', '/src/reef.ts'].map(p => server.ssrLoadModule(p))
  )
  const { terrainHeight, shoreToWorld, worldToShore, surfBreakDepth, surfWave, surfReach, ripGap, reefGap, reefCrest, hasLand } = terrain
  await mkdir(outDir, { recursive: true })
  for (const { name, spec: raw } of await specs()) {
    const { date: specDate, ...spec } = raw
    parseSceneSpec(raw)
    const date = dateArg ?? specDate ?? '2024-01-01'
    const p = generateSceneParams(date, 16 / 9, spec)
    const c = p.coast
    console.log(`== ${name} (${date})  ${p.title}`)
    if (!hasLand(c)) {
      console.log('open sea: no terrain')
      continue
    }
    const at = (s, a) => terrainHeight(c, ...shoreToWorld(c, s, a))
    const [camS, camA] = worldToShore(c, 0, 0)
    const lines = beachLines(c)
    const breakDepth = surfBreakDepth(c)
    console.log(
      `${c.type} ${c.material} · state ${c.state} · grain ${f(c.grainMm)} mm${c.stoneSize > 0 ? ` · stones ${f(c.stoneSize * 100, 0)} cm` : ''} · ` +
        `swell ${f(p.ocean.swellHeight)} m / ${f(Math.sqrt((2 * Math.PI * p.ocean.swellWavelength) / 9.81), 1)} s · surf amplitude ${f(c.surfAmplitude)} m`
    )
    console.log(
      `face ${f(c.beachSlope, 3)} · nearshore ${f(c.nearshoreSlope, 3)} · width ${f(c.beachWidth, 0)} m · dune ${f(c.duneHeight, 1)} m · ` +
        `run-up ${f(c.runup)} m · high tide ${f(lines.highTide, 1)} m in · storm line ${f(lines.stormLine, 1)} m in · break depth ${f(breakDepth)} m`
    )
    const list = (xs, g) => (xs.length === 0 ? 'none' : xs.map(g).join(', '))
    console.log(`bars: ${list(c.bars, b => `${f(b.distance, 0)} m out, ${f(b.height)} m high, ±${f(b.width, 0)} m`)}`)
    console.log(`rips: ${c.rips == null ? 'none' : `every ${f(c.rips.spacing, 0)} m, bar swing ${f(c.rips.amplitude)}`} · cusps: ${c.cusps == null ? 'none' : `${f(c.cusps.spacing, 0)} m apart, ${f(c.cusps.relief)} m relief`}`)
    console.log(`ridges: ${list(c.ridges, r => `${f(r.distance, 1)} m in, ${f(r.height)} m, ±${f(r.width, 1)} m`)}`)
    const { range, level } = c.tide
    console.log(
      `tide: range ${f(range, 1)} m (mean ${f(c.tide.mean, 1)}, built for ${f(c.tide.springRange, 1)}) · level ${f(level)} m · ` +
        `water ${f(c.waterline, 1)} m out` +
        (c.terrace.width > 0 ? ` · terrace ±${f(c.terrace.height, 1)} m over ${f(c.terrace.width, 0)} m` : '')
    )
    console.log(`camera: ${f(-camS, 1)} m inland, a = ${f(camA, 0)} m, ${c.composition}, eye ${f(p.camera.heightM, 1)} m`)
    const reach = surfReach(c)
    if (c.reef != null) {
      const r = c.reef
      const crestS = c.terrace.width + reefCrest(c, camA)
      // Heights above mean sea (+ level), so they compare with the drawn depths.
      let floor = 0
      for (let s = c.waterline; s < crestS - r.flatWidth - 15; s += 1) floor = Math.min(floor, at(s, camA) + level)
      console.log(
        `reef: crest ${f(crestS, 0)} m out (${f(at(crestS - 2, camA) + level)} m at mean sea, drawn −${f(r.crestDepth)}) · flat ${f(r.flatWidth, 0)} m · ` +
          `lagoon floor ${f(floor)} m reached (drawn −${f(r.lagoonDepth)}, slope ${f(lagoonSlope(c), 3)}) · passes every ${f(r.passSpacing, 0)} m, ${f(r.passWidth, 0)} m wide · ` +
          `shelter ${f(r.strength)} from ${f(c.shelter.line - c.shelter.blur, 0)} m in · beachrock ${r.beachrock ? 'yes' : 'no'}`
      )
    } else if (c.rock != null) {
      // Drawn vs reached, heights above mean sea, each the median over 200 m
      // of shore round the camera (ledges and gullies scatter single cuts).
      const r = c.rock
      const med = s => {
        const hs = []
        for (let a = camA - 100; a <= camA + 100; a += 4) hs.push(at(s, a) + level)
        return hs.sort((x, y) => x - y)[hs.length >> 1]
      }
      const foot = r.width + r.scarp / r.scarpSlope
      console.log(
        `rock: ${r.kind} · back face ${f(r.backHeight, 1)} m over ${f(r.backWidth, 1)} m (top ${f(med(-r.backWidth - 3))} reached, drawn ${f(r.top + r.backHeight)}) · ` +
          `platform ${f(r.width, 0)} m: back ${f(med(2))} (drawn ${f(r.top)}), edge ${f(r.width > 0 ? med(r.width * 0.9) : r.edge)} at 0.9 W (drawn ${f(r.edge)}) · ` +
          `scarp ${f(r.scarp, 1)} m at ${f(r.scarpSlope)}, foot ${f(med(foot + 2))} (drawn ${f(r.edge - r.scarp)}) · ` +
          `relief ${f(r.relief)}, beds ${f(r.bedding)} m dipping ${f((Math.atan(r.dip) * 180) / Math.PI, 0)}°, joints ${f(r.jointSpacing, 0)} m, gullies ${f(r.gully)} m` +
          (r.boulder > 0 ? `, boulders ${f(r.boulder)} m` : '')
      )
      console.log(`camera ground ${f(at(camS, camA))} m above today's sea`)
    } else if (c.flat != null) {
      // Drawn vs reached, above mean sea, medians over 400 m of shore (creeks
      // scatter single cuts); the creeks' deepest cut along that shore.
      const fl = c.flat
      const m = c.marsh
      const med = s => {
        const hs = []
        for (let a = camA - 200; a <= camA + 200; a += 4) hs.push(at(s, a) + level)
        return hs.sort((x, y) => x - y)[hs.length >> 1]
      }
      const deepest = s => {
        let lo = Infinity
        for (let a = camA - fl.channelSpacing; a <= camA + fl.channelSpacing; a += 1) lo = Math.min(lo, at(s, a) + level)
        return med(s) - lo
      }
      console.log(
        `flat: ${f(fl.width, 0)} m at 1:${f(fl.width / (fl.top - fl.low), 0)} · top ${f(med(3))} (drawn ${f(fl.top)}) · low ${f(med(fl.width * 0.95))} at 0.95 W (drawn ${f(fl.low + 0.05 * (fl.top - fl.low))}) · ` +
          `marsh ${f(m.width, 0)} m at ${f(med(-10))} (drawn ${f(m.height)}) · channels every ${f(fl.channelSpacing, 0)} m, ${f(fl.channelWidth, 0)} m × ${f(fl.channelDepth)} m at W ` +
          `(cut ${f(deepest(fl.width * 0.9))} reached at 0.9 W, ${f(deepest(fl.width * 0.3))} at 0.3 W) · creeks every ${f(fl.creekSpacing, 0)} m · mud ${fl.mud.map(v => f(v)).join('/')}`
      )
      console.log(`camera ground ${f(at(camS, camA))} m above today's sea`)
    } else if (c.marsh != null) {
      console.log(`salt marsh: from ${f(c.marsh.start, 0)} m in, ${f(c.marsh.width, 0)} m wide`)
    } else if (c.shelter != null) {
      console.log(`shelter: ${f(c.shelter.strength)} · line ${c.shelter.line == null ? 'none' : `${f(c.shelter.line, 0)} m`} · ${c.shelter.basins.length} basins · blur ${f(c.shelter.blur, 0)} m`)
    }
    // Where a full set wave breaks along the camera's cut (shelter included).
    const breaking = []
    let wasOn = false
    for (let i = 0; i < 2 * (reach + 200); i++) {
      const s = c.waterline + i / 2
      const depth = -at(s, camA)
      const on = depth > 0.15 && surfWave(c, depth, 1, shelterAt(c, s, camA)).steepness >= 0.9
      if (on && wasOn) breaking.at(-1)[1] = s
      else if (on) breaking.push([s, s])
      wasOn = on
    }
    console.log(
      `surf zone to ${f(c.waterline + reach, 0)} m out (fades by +200) · breaking at ` +
        (breaking.length === 0 ? 'none' : breaking.map(([a, b]) => `${f(a, 0)}–${f(b, 0)} m (${f(b - a + 0.5, 1)} m wide)`).join(', '))
    )

    // Cross-shore profiles: at the camera, and through the nearest channel.
    const cuts = [['camera', camA]]
    if (c.rips != null) {
      let best = null
      for (let a = camA - c.rips.spacing; a <= camA + c.rips.spacing; a += 1) if (ripGap(c, a) > 0.99 && (best == null || Math.abs(a - camA) < Math.abs(best - camA))) best = a
      if (best != null) cuts.push(['rip', best])
    }
    if (c.reef != null) {
      let best = null
      for (let a = camA - c.reef.passSpacing; a <= camA + c.reef.passSpacing; a += 2) if (reefGap(c, a) > 0.99 && (best == null || Math.abs(a - camA) < Math.abs(best - camA))) best = a
      if (best != null) cuts.push(['pass', best])
    }
    // Around today's water (the tide moves it across a terrace).
    const w = Math.round(Math.max(0, c.waterline) / 10) * 10
    const ss = [-40, -30, -20, -15, -10, -5, -2, 0, 2, 5, 10, 15, 20, 30, 40, 50, 60, 80, 100, 125, 150, 200, 250, 300, 400].map(s => s + w)
    if (c.flat != null) {
      ss.length = 0
      for (const t of [-1.1, -0.5, -0.05, 0, 0.002, 0.1, 0.25, 0.5, 0.75, 0.95, 1]) ss.push(Math.round(t < 0 ? t * c.marsh.width : t * c.flat.width))
    }
    if (c.rock != null) {
      const r = c.rock
      for (const s of [-r.backWidth - 5, -r.backWidth / 2, 0, r.width / 2, r.width, r.width + r.scarp / r.scarpSlope]) ss.push(Math.round(s))
      ss.sort((x, y) => x - y)
    }
    // Out past a reef's crest.
    if (c.reef != null) {
      const crestS = Math.round(c.terrace.width + reefCrest(c, camA))
      for (const d of [-c.reef.flatWidth - 15, -10, 0, 10, 30]) ss.push(Math.round(crestS + d))
      ss.sort((x, y) => x - y)
    }
    console.log(`s (m)      ${ss.map(s => String(s).padStart(6)).join('')}`)
    for (const [label, a] of cuts) console.log(`${`${label} a=${f(a, 0)}`.padEnd(11)}${ss.map(s => f(at(s, a)).padStart(6)).join('')}`)

    // Top-down map: rows from the sea (top) to the land, columns along the shore.
    // Down to just behind the camera (overlooks stand up to ~600 m inland).
    // A tidal flat: the marsh to today's water, ±1 km, at least 4 m/px.
    const flatMap = c.flat != null
    const res = flatMap ? Math.max(resArg, 4) : resArg
    const s0 = flatMap ? -c.marsh.width - 60 : Math.max(-650, Math.min(-80, camS - 40))
    const s1 = flatMap
      ? Math.max(c.waterline, 0) + 150
      : Math.max(260, ...c.bars.map(b => b.distance * 1.6), breakDepth / c.nearshoreSlope + 60, reach + 100) + Math.max(0, c.waterline)
    const a0 = camA - (flatMap ? 1000 : 400)
    const a1 = camA + (flatMap ? 1000 : 400)
    const W = Math.round((a1 - a0) / res)
    const H = Math.round((s1 - s0) / res)
    const heights = new Float32Array(W * H)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) heights[y * W + x] = at(s1 - y * res, a0 + x * res)
    const rgb = Buffer.alloc(W * H * 3)
    const band = h => Math.floor(h / 0.5)
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        const i = y * W + x
        const h = heights[i]
        let col =
          h >= 0
            ? lerp([0.78, 0.68, 0.5], [0.35, 0.45, 0.25], clamp01(h / 8))
            : lerp([0.55, 0.8, 0.85], [0.05, 0.15, 0.35], clamp01(-h / 10))
        const right = x + 1 < W ? heights[i + 1] : h
        const down = y + 1 < H ? heights[i + W] : h
        if (band(h) !== band(right) || band(h) !== band(down)) col = col.map(v => v * 0.75)
        const cross = (v, t) => (v - t) * (h - t) <= 0 && v !== h
        if (cross(right, -breakDepth) || cross(down, -breakDepth)) col = [1, 1, 1]
        if (cross(right, 0) || cross(down, 0)) col = [0, 0, 0]
        const sv = s1 - y * res
        const av = a0 + x * res
        if (Math.abs(sv % 50) < res / 2 || Math.abs(av % 50) < res / 2) col = col.map(v => v * 0.9 + 0.05)
        if (Math.hypot(sv - camS, av - camA) < 3 * res + 2) col = [0.9, 0.1, 0.1]
        rgb.set(col.map(v => Math.round(clamp01(v) * 255)), i * 3)
      }
    const file = join(outDir, `${name}.profile.png`)
    await writeFile(file, png(W, H, rgb))
    console.log(`map ${W}×${H} px (${res} m/px), s ${f(s1, 0)} → ${f(s0, 0)} m top to bottom, a ${f(a0, 0)} → ${f(a1, 0)} m: ${file}`)
  }
} finally {
  await server.close()
}
