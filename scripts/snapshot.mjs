// Render wallpapers for one or more dates in headless Chrome and save them.
//
//   node scripts/snapshot.mjs [--url http://localhost:5174/] [--out out]
//        [--w 3840 --h 2160] [--quality 0.92] [--frames 64]
//        [--angle metal|swiftshader] [--channel chrome|chromium] DATE [DATE...]
//   node scripts/snapshot.mjs [options] --scene specs.json
//
// DATE can be YYYY-MM-DD, "today", or a range "2026-10-01..2026-10-07".
// --scene takes a JSON file (or inline JSON) holding a scene spec or a list
// of them (src/sceneSpec.ts): each is rendered and saved as <name>.jpg, or
// <date>.jpg when it has no name. A file can also share fields among its
// scenes: { "base": { "date": …, "camera": {…} }, "scenes": [{ "name": "a", … }] }
// (each scene merged deeply over the base).
// Expects a server (vite dev or preview) to be running at --url.
//
// Checking a feature without reading whole images:
//   --props islands,rocks   print where those props landed (count, in frame,
//                           nearest distance, pixel box; "all" for every kind)
//   --crop islands,rocks    also save <name>.<kind>.jpg: the frame cropped to
//                           that prop's box, padded
//   --budget 600            give up after this many seconds in all (default
//                           900), so a hung render can't stall a session

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

import { snapshotWarnings } from './checks.mjs'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return fallback
  const [, value] = args.splice(i, 2)
  return value
}
const baseUrl = option('url', 'http://localhost:5174/')
const outDir = option('out', 'out')
const width = Number(option('w', 3840))
const height = Number(option('h', 2160))
const quality = Number(option('quality', 0.92))
const frames = option('frames', null)
const channel = option('channel', process.env.CI ? undefined : 'chrome')
// 'metal' uses the Mac's GPU; 'swiftshader' is software WebGL (CI runners
// have no GPU).
const angle = option('angle', process.env.CI ? 'swiftshader' : 'metal')
const timeoutMs = Number(option('timeout', 30 * 60_000))
const sceneArg = option('scene', null)
const list = value => (value == null ? [] : value.split(',').filter(Boolean))
const cropKinds = list(option('crop', null))
const propKinds = [...new Set([...list(option('props', null)), ...cropKinds])]
const budget = Number(option('budget', 900))
setTimeout(() => {
  console.log(`[snapshot] budget of ${budget}s used up; stopping`)
  process.exit(2)
}, budget * 1000).unref()

function expandDates(specs) {
  const dates = []
  for (const spec of specs) {
    if (spec === 'today') {
      dates.push(new Date().toISOString().slice(0, 10))
    } else if (spec.includes('..')) {
      const [from, to] = spec.split('..')
      for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
        dates.push(d.toISOString().slice(0, 10))
      }
    } else {
      dates.push(spec)
    }
  }
  return dates
}

/** One render: a date, or a scene spec. */
async function jobs() {
  if (sceneArg == null) return expandDates(args.length > 0 ? args : ['today']).map(date => ({ date, name: date }))
  const text = /^\s*[[{]/.test(sceneArg) ? sceneArg : await readFile(sceneArg, 'utf8')
  const parsed = JSON.parse(text)
  // { "base": {…}, "scenes": [{…}, …] }: each scene is the base with its own
  // fields merged in (objects merge, the rest replaces).
  const merge = (a, b) => {
    if (b === null || typeof b !== 'object' || Array.isArray(b) || a == null || typeof a !== 'object' || Array.isArray(a)) return b
    const out = { ...a }
    for (const [k, v] of Object.entries(b)) out[k] = merge(a[k], v)
    return out
  }
  const specs =
    !Array.isArray(parsed) && Array.isArray(parsed.scenes)
      ? parsed.scenes.map(scene => merge(parsed.base ?? {}, scene))
      : Array.isArray(parsed)
        ? parsed
        : [parsed]
  const used = new Set()
  return specs.map((spec, i) => {
    let name = spec.name ?? spec.date ?? `scene-${i + 1}`
    if (used.has(name)) name = `${name}-${i + 1}`
    used.add(name)
    return { date: spec.date ?? null, spec, name }
  })
}
const todo = await jobs()
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({
  channel,
  args: ['--ignore-gpu-blocklist', '--enable-gpu', `--use-angle=${angle}`, '--enable-unsafe-swiftshader']
})
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
page.setDefaultTimeout(timeoutMs)
page.on('console', msg => {
  if (msg.type() !== 'error' && msg.type() !== 'warning') return
  const text = msg.text()
  // three.js logs a failed shader with its whole source: keep the errors and
  // the numbered lines it quotes round them.
  if (/Shader Error|VALIDATE_STATUS false/.test(text) && text.length > 2000) {
    const lines = text.split('\n')
    const keep = lines.filter(l => /ERROR:|^\s*>?\s*\d+:/.test(l)).slice(0, 40)
    console.log(`[browser ${msg.type()}] ${lines[0]}\n${keep.join('\n')}`)
    return
  }
  console.log(`[browser ${msg.type()}]`, text)
})
page.on('pageerror', error => console.log('[page error]', error.message))

for (const { date, spec, name } of todo) {
  const started = Date.now()
  const url = new URL(baseUrl)
  if (date != null) url.searchParams.set('date', date)
  if (spec != null) url.searchParams.set('scene', JSON.stringify(spec))
  url.searchParams.set('future', '1')
  url.searchParams.set('w', String(width))
  url.searchParams.set('h', String(height))
  if (frames != null) url.searchParams.set('frames', frames)
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
  for (const warning of snapshotWarnings(params, propKinds.filter(k => k !== 'all'))) console.log(`  ⚠ ${warning}`)
  const props = params.debug?.props ?? {}
  for (const kind of propKinds.includes('all') ? Object.keys(props) : propKinds) {
    const r = props[kind]
    if (r == null) {
      console.log(`  ${kind}: none placed`)
      continue
    }
    console.log(`  ${kind}: ${r.inFrame}/${r.placed} in frame, nearest ${r.nearest} m, box ${JSON.stringify(r.box)}`)
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
