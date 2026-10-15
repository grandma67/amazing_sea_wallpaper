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
// <date>.jpg when it has no name.
// Expects a server (vite dev or preview) to be running at --url.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { chromium } from 'playwright'

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
  const specs = Array.isArray(parsed) ? parsed : [parsed]
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
  if (msg.type() === 'error' || msg.type() === 'warning') console.log(`[browser ${msg.type()}]`, msg.text())
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
}

await browser.close()
