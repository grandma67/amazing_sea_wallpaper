// Render dates or scene specs in headless Chrome; saves NAME.jpg and NAME.json
// (params + debug). Needs a dev server at --url. Guide: knowledge/tools/RENDER.md.
//
//   node scripts/snapshot.mjs [OPTIONS] DATE... | --scene SPEC
//
// DATE: YYYY-MM-DD, FROM..TO or "today" (default). SPEC: JSON file or inline;
//   one spec, a list, or { base, scenes } (scenes merged deeply over base).
//   Saved as the spec's name, else its date, else scene-N.
// --where EXPR --sample N [--spread EXPR]   real days instead of DATEs: N of the days
//                     'p => …' keeps, spread across places, coasts and times of day
//                     (params.mjs --sample). Use it in a feature's first render round:
//                     forced specs hide what real days show.
// --seeds N           each render N times, each on its own seed (a shader or a choice
//                     that depends on the day's seed); saved as NAME-s1, NAME-s2…
// --out DIR (out)  --w 3840 --h 2160  --frames N (page default 64)  --quality 0.92
// --url http://localhost:5174/  --angle metal|swiftshader  --channel chrome|chromium
// --props KINDS|all   per prop: placed, in frame, nearest m, pixel box, CPU build
//                     time; then the three slowest kinds
// --crop KINDS|all    also save NAME.KIND.jpg cropped to that prop's box
// --budget S (900)    exit after S seconds in all; --timeout MS per page (30 min)
// --ref REF           render that commit (worktree on port 5177); implies --drop-unknown
// --drop-unknown      leave out (and name) spec fields the served commit rejects
// DEBUG=1             print each render's debug (exposure, luminance, …)
//                     params.debug.probe (tools/DEBUG.md) prints one line per point,
//                     params.debug.probeLine its band/grain stats and shape

import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

import { snapshotWarnings } from './checks.mjs'
import { expandDates, parseArgs, readSpecs, watchPage } from './lib.mjs'
import { serveRef } from './refServer.mjs'

/** A row of characters showing a line's shape (as skyMirror.ts sparkline). */
function sparkline(values, width = 60) {
  const bars = '▁▂▃▄▅▆▇█'
  const n = Math.min(width, values.length)
  const cells = Array.from({ length: n }, (_, i) => {
    const a = Math.floor((i * values.length) / n)
    const b = Math.max(a + 1, Math.floor(((i + 1) * values.length) / n))
    return values.slice(a, b).reduce((s, x) => s + x, 0) / (b - a)
  })
  const [lo, hi] = [Math.min(...cells), Math.max(...cells)]
  return cells.map(v => bars[hi > lo ? Math.min(7, Math.floor(((v - lo) / (hi - lo)) * 8)) : 0]).join('')
}


const { args, option, flag, rejectUnknown, rejectPositional } = parseArgs()
let baseUrl = option('url', 'http://localhost:5174/')
const ref = option('ref', null)
const dropUnknown = flag('drop-unknown') || ref != null
const outDir = option('out', 'out')
const width = Number(option('w', 3840))
const height = Number(option('h', 2160))
const quality = Number(option('quality', 0.92))
const frames = option('frames', null)
const channel = option('channel', process.env.CI ? undefined : 'chrome')
// 'metal' uses the Mac's GPU; 'swiftshader' is software WebGL (CI has no GPU).
const angle = option('angle', process.env.CI ? 'swiftshader' : 'metal')
const timeoutMs = Number(option('timeout', 30 * 60_000))
const sceneArg = option('scene', null)
const whereArg = option('where', null)
const sampleArg = option('sample', whereArg != null ? '8' : null)
const spreadArg = option('spread', null)
const seeds = Number(option('seeds', 0))
const list = value => (value == null ? [] : value.split(',').filter(Boolean))
const cropKinds = list(option('crop', null))
const propKinds = [...new Set([...list(option('props', null)), ...cropKinds])]
const budget = Number(option('budget', 900))
// A misspelt or unsupported option (e.g. --match) used to be ignored and the
// whole spec file rendered.
rejectUnknown()
if (sceneArg != null || whereArg != null) rejectPositional('dates are ignored with --scene or --where')
setTimeout(() => {
  console.log(`[snapshot] budget of ${budget}s used up; stopping`)
  process.exit(2)
}, budget * 1000).unref()

/** One render: a date, or a scene spec. */
async function jobs() {
  if (whereArg != null) {
    const asked = ['--where', whereArg, '--sample', sampleArg, ...(spreadArg != null ? ['--spread', spreadArg] : [])]
    const dates = execFileSync(process.execPath, [new URL('./params.mjs', import.meta.url).pathname, ...asked], { encoding: 'utf8' }).split('\n').filter(l => /^\d{4}-\d{2}-\d{2}$/.test(l))
    console.log(`[snapshot] real days: ${dates.join(' ') || 'none'}`)
    return dates.map(date => ({ date, name: date }))
  }
  if (sceneArg == null) return expandDates(args.length > 0 ? args : ['today']).map(date => ({ date, name: date }))
  const { specs } = await readSpecs(sceneArg)
  const used = new Set()
  return specs.map((spec, i) => {
    let name = spec.name ?? spec.date ?? `scene-${i + 1}`
    if (used.has(name)) name = `${name}-${i + 1}`
    used.add(name)
    return { date: spec.date ?? null, spec, name }
  })
}
/** Each job on `seeds` seeds of its own. */
const seeded = list =>
  seeds < 1 ? list : list.flatMap(job => Array.from({ length: seeds }, (_, i) => ({ ...job, name: `${job.name}-s${i + 1}`, spec: { ...job.spec, seed: `${job.name}/${i + 1}` } })))
const todo = seeded(await jobs())
await mkdir(outDir, { recursive: true })
if (ref != null) {
  const old = await serveRef(ref, 5177)
  // Synchronous, so it also runs when the budget timer exits the process.
  process.on('exit', old.close)
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(130))
  baseUrl = old.url
  console.log(`[snapshot] rendering ${ref} (${old.sha})`)
}

const browser = await chromium.launch({
  channel,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', `--use-angle=${angle}`, '--enable-unsafe-swiftshader']
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.setDefaultTimeout(timeoutMs)
// GL messages (worker and GPU process too) become ⚠ warnings per render.
const messages = await watchPage(page, {
  format: msg => {
    const text = msg.text()
    // three.js logs a failed shader with its whole source: keep the errors and
    // the numbered lines it quotes round them.
    if (!/Shader Error|VALIDATE_STATUS false/.test(text) || text.length <= 2000) return `[browser ${msg.type()}] ${text}`
    const lines = text.split('\n')
    const keep = lines.filter(l => /ERROR:|^\s*>?\s*\d+:/.test(l)).slice(0, 40)
    return `[browser ${msg.type()}] ${lines[0]}\n${keep.join('\n')}`
  }
})

/** The spec without the fields the served commit's parser rejects as
 * unknown (its own src/sceneSpec.ts, loaded from the dev server). */
async function knownFields(spec) {
  await page.goto(new URL('src/sceneSpec.ts', baseUrl).toString())
  const { kept, dropped } = await page.evaluate(async spec => {
    const { parseSceneSpec } = await import('/src/sceneSpec.ts')
    const dropped = []
    for (;;) {
      try {
        parseSceneSpec(spec)
        return { kept: spec, dropped }
      } catch (error) {
        const m = /scene spec: spec\.([\w.]+) is not a known field/.exec(error.message)
        if (m == null) throw error
        const path = m[1].split('.')
        const owner = path.slice(0, -1).reduce((o, k) => o[k], spec)
        delete owner[path.at(-1)]
        dropped.push(m[1])
      }
    }
  }, structuredClone(spec))
  if (dropped.length > 0) console.log(`[snapshot] not known at this commit, left out: ${dropped.join(', ')}`)
  return kept
}

for (const { date, spec: asked, name } of todo) {
  const spec = asked != null && dropUnknown ? await knownFields(asked) : asked
  const started = Date.now()
  const url = new URL(baseUrl)
  if (date != null) url.searchParams.set('date', date)
  if (spec != null) url.searchParams.set('scene', JSON.stringify(spec))
  url.searchParams.set('future', '1')
  url.searchParams.set('w', String(width))
  url.searchParams.set('h', String(height))
  if (frames != null) url.searchParams.set('frames', frames)
  messages.gl() // not this render's
  await page.goto(url.toString())
  await page.waitForFunction(() => window.__sea != null)
  const { dataUrl, params } = await page.evaluate(async quality => {
    const result = await window.__sea.ready
    // The canvas may belong to the render worker: ask it for the image.
    const blob = await result.toBlob('image/jpeg', quality)
    const dataUrl = await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
    return {
      dataUrl,
      params: { ...window.__sea.params, debug: result.debug }
    }
  }, quality)
  const file = join(outDir, `${name}.jpg`)
  await writeFile(file, Buffer.from(dataUrl.split(',')[1], 'base64'))
  await writeFile(join(outDir, `${name}.json`), JSON.stringify({ ...params, spec }, null, 2))
  console.log(`${file}  ${((Date.now() - started) / 1000).toFixed(1)}s  ${params.title}`)
  if (process.env.DEBUG) console.log(JSON.stringify(params.debug))
  // The pixel probe (params.debug.probe): one line per point.
  for (const r of params.debug?.probe ?? []) {
    const at = Array.isArray(r.at) ? `[${r.at.join(', ')}]` : `az ${r.at.az} el ${r.at.el}`
    if (r.pixel == null) {
      console.log(`  probe ${at}: out of frame`)
      continue
    }
    const e = v => v.map(x => x.toExponential(2)).join(' ')
    const mag = r.magArcsec2 != null ? `, ${r.magArcsec2} mag/″²` : ''
    console.log(
      `  probe ${at} px ${r.pixel.join(',')}: raw ${e(r.raw.mean)} (peak ${e(r.raw.peak)}), ${r.cdm2.toExponential(2)} cd/m²${mag}; ` +
        `exposed ${r.exposed.mean.map(x => x.toFixed(3)).join(' ')}; final ${r.final.mean.join(',')} (peak ${r.final.peak.join(',')})${r.clipped ? ' ⚠ clipped' : ''}`
    )
  }
  // The line probe (params.debug.probeLine): its stats and shape.
  for (const pl of params.debug?.probeLine ?? []) {
    const what = `az ${JSON.stringify(pl.line.az)} el ${JSON.stringify(pl.line.el)}`
    if (pl.stats == null) console.log(`  probe line ${what}: out of frame`)
    else {
      console.log(`  probe line ${what}, ${pl.samples.length} px: ${pl.stats.summary}`)
      console.log(`    ${sparkline(pl.samples.map(s => s.cdm2))}`)
    }
  }
  // GPU-process messages arrive a few ms after the frame.
  await page.waitForTimeout(100)
  const warnings = snapshotWarnings(params, propKinds.filter(k => k !== 'all'), messages.gl())
  for (const warning of warnings) console.log(`  ⚠ ${warning}`)
  const props = params.debug?.props ?? {}
  const times = params.debug?.propTimes ?? {}
  const built = kind => (times[kind] != null ? `, built in ${times[kind]} ms` : '')
  for (const kind of propKinds.includes('all') ? Object.keys(props) : propKinds) {
    const r = props[kind]
    if (r == null) {
      console.log(`  ${kind}: none placed${built(kind)}`)
      continue
    }
    console.log(`  ${kind}: ${r.inFrame}/${r.placed} in frame, nearest ${r.nearest} m, box ${JSON.stringify(r.box)}${built(kind)}`)
  }
  if (propKinds.length > 0) {
    const total = Object.values(times).reduce((a, b) => a + b, 0)
    const slowest = Object.entries(times).sort((a, b) => b[1] - a[1]).slice(0, 3)
    console.log(`  props built in ${total} ms; slowest ${slowest.map(([k, ms]) => `${k} ${ms}`).join(', ')}`)
  }
  for (const kind of cropKinds.includes('all') ? Object.keys(props) : cropKinds) {
    const box = props[kind]?.box
    if (box == null) continue
    const crop = await page.evaluate(
      async ({ dataUrl, box, quality }) => {
        const image = await createImageBitmap(await (await fetch(dataUrl)).blob())
        // Pad by a quarter each side and at least 256 px across.
        const [x0, y0, x1, y1] = box
        const w = Math.max(256, (x1 - x0) * 1.5)
        const h = Math.max(256 * (image.height / image.width), (y1 - y0) * 1.5, w * 0.4)
        const cx = (x0 + x1) / 2
        const cy = (y0 + y1) / 2
        const left = Math.max(0, Math.min(image.width - w, cx - w / 2))
        const top = Math.max(0, Math.min(image.height - h, cy - h / 2))
        const canvas = new OffscreenCanvas(Math.min(w, image.width), Math.min(h, image.height))
        canvas.getContext('2d').drawImage(image, left, top, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height)
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
        return new Uint8Array(await blob.arrayBuffer()).reduce((s, b) => s + String.fromCharCode(b), '')
      },
      { dataUrl, box, quality }
    )
    const cropFile = join(outDir, `${name}.${kind}.jpg`)
    await writeFile(cropFile, Buffer.from(crop, 'latin1'))
    console.log(`  ${cropFile}`)
  }
}

await browser.close()
