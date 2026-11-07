// In-place day changes free everything (knowledge/LEAKS.md). Needs a dev server at --url.
//
//   node scripts/restart.mjs [--url http://localhost:5174/] [--date 2024-06-01] [--steps 8]
//                            [--mode main|worker|both] [--w 640 --h 360 --frames 2] [--angle metal]
//
// Clicks → `steps` times (then ←, Today, Random, Back and Forward once each), waiting for each
// day's render. After each: the address bar, view and title name the day expected, one canvas,
// splash hidden, bar shown, nothing left on the GPU after the render (`debug.gpuAfterRender`:
// geometries, textures, programs all 0), at most one live WebGL context (main) or render
// worker (worker), heap after gc(). Then every old view and canvas must be collected (WeakRefs)
// and a day seen again (←, Back, Forward) must take no more than 2 MB of heap over its first visit.
// Any GL message (page, worker or GPU process; `watchPage` in lib.mjs) fails too.
// `main` (?worker=0) renders on the page, so its heap and contexts are visible here; `worker`
// checks the workers are terminated. Prints JSON: `ok` and `failures` first; exit 1 on failure.

import { chromium } from 'playwright'

import { parseArgs, requireServer, watchPage } from './lib.mjs'

const { option, rejectUnknown } = parseArgs()
const baseUrl = option('url', 'http://localhost:5174/')
const start = option('date', '2024-06-01')
const steps = Number(option('steps', 8))
const mode = option('mode', 'both')
const size = { w: option('w', '640'), h: option('h', '360'), frames: option('frames', '2') }
const angle = option('angle', process.env.CI ? 'swiftshader' : 'metal')
rejectUnknown()

// Counts live WebGL contexts and render workers, before the app's own code runs.
function instrument() {
  const contexts = []
  const getContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    const gl = getContext.call(this, kind, ...rest)
    // defaultResolution() probes with a throwaway context and loses it at once.
    if (gl != null && /webgl/.test(kind) && !contexts.some(r => r.deref() === gl)) contexts.push(new WeakRef(gl))
    return gl
  }
  const workers = new Set()
  const NativeWorker = window.Worker
  window.Worker = class extends NativeWorker {
    constructor(url, options) {
      super(url, options)
      if (/renderWorker/.test(String(url))) workers.add(this)
    }
    terminate() {
      workers.delete(this)
      super.terminate()
    }
  }
  window.__leaks = {
    liveContexts: () => contexts.map(r => r.deref()).filter(gl => gl != null && !gl.isContextLost()).length,
    liveWorkers: () => workers.size
  }
}

/** Runs in the page: the navigation steps and their checks. */
async function inPage({ steps, worker }) {
  const sleep = ms => new Promise(r => setTimeout(r, ms))
  const failures = []
  const fail = what => failures.push(what)
  const collect = async () => {
    for (let i = 0; i < 3; i++) {
      gc()
      await sleep(50)
    }
  }
  const refs = []
  const dateOf = () => new URLSearchParams(location.search).get('date')
  const shift = (date, days) => {
    const d = new Date(`${date}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }
  /** Do `action`, then wait for the next day's view to be on screen. Only
   * WeakRefs keep the old view, so it's free once this returns. */
  const next = async (label, action, expect) => {
    const old = window.__sea.view
    refs.push({ label, view: new WeakRef(old), canvas: new WeakRef(old.canvas) })
    action()
    for (let i = 0; i < 600 && window.__sea.view === old; i++) await sleep(50)
    const view = window.__sea.view
    if (view === old) return fail(`${label}: no new day`), null
    try {
      await view.ready
    } catch (error) {
      return fail(`${label}: render failed: ${error}`), null
    }
    for (let i = 0; i < 60 && !document.getElementById('splash').hidden; i++) await sleep(50)
    await collect()
    const debug = (await view.ready).debug
    const row = {
      label,
      date: view.date,
      heapMB: +(performance.memory.usedJSHeapSize / 1e6).toFixed(1),
      gpu: debug.gpuAfterRender ?? null,
      swept: (debug.gpuSwept ?? []).length,
      contexts: __leaks.liveContexts(),
      workers: __leaks.liveWorkers()
    }
    if (expect != null && view.date !== expect) fail(`${label}: day ${view.date}, expected ${expect}`)
    if (dateOf() !== view.date) fail(`${label}: address bar ${dateOf()}, view ${view.date}`)
    if (document.getElementById('title').textContent !== view.params.title) fail(`${label}: stale title`)
    const canvases = document.querySelectorAll('canvas').length
    if (canvases !== 1) fail(`${label}: ${canvases} canvases`)
    if (!document.getElementById('splash').hidden) fail(`${label}: splash still up`)
    if (document.getElementById('info').hidden) fail(`${label}: bar hidden`)
    if (row.gpu != null && (row.gpu.geometries || row.gpu.textures || row.gpu.programs))
      fail(`${label}: left on the GPU after the render: ${JSON.stringify(row.gpu)}`)
    if (worker ? row.workers > 1 : row.contexts > 1) fail(`${label}: ${worker ? row.workers + ' workers' : row.contexts + ' contexts'} alive`)
    return row
  }
  const click = id => () => document.getElementById(id).click()

  await window.__sea.ready
  const rows = []
  for (let i = 0; i < steps; i++) rows.push(await next(`next ${i + 1}`, click('next'), shift(window.__sea.view.date, 1)))
  const last = window.__sea.view.date
  rows.push(await next('prev', click('prev'), shift(last, -1)))
  rows.push(await next('back', () => history.back(), last))
  rows.push(await next('forward', () => history.forward(), shift(last, -1)))
  rows.push(await next('random', click('random'), null))
  rows.push(await next('today', click('today'), null))

  await sleep(500)
  await collect()
  const alive = refs.filter(r => r.view.deref() != null || r.canvas.deref() != null).map(r => r.label)
  if (alive.length) fail(`old days still alive: ${alive.join(', ')}`)
  // Heap depends on the day shown: compare each revisited day with its first visit (every day in
  // between was freed, so it should come back to the same size).
  for (const again of rows.slice(steps).filter(Boolean)) {
    const first = rows.find(r => r != null && r.date === again.date)
    if (first !== again && again.heapMB - first.heapMB > 2)
      fail(`heap: ${again.date} took ${first.heapMB} MB first, ${again.heapMB} MB at ${again.label}`)
  }
  return { ok: failures.length === 0, failures, rows: rows.filter(Boolean).map(r => `${r.label} ${r.date} ${r.heapMB}MB gpu ${JSON.stringify(r.gpu)} swept ${r.swept} ctx ${r.contexts} wk ${r.workers}`) }
}

await requireServer(baseUrl)
const browser = await chromium.launch({
  channel: process.env.CI ? undefined : 'chrome',
  args: ['--js-flags=--expose-gc', '--enable-precise-memory-info', '--ignore-gpu-blocklist', '--enable-gpu', `--use-angle=${angle}`, '--enable-unsafe-swiftshader']
})
let ok = true
for (const worker of mode === 'both' ? [false, true] : [mode === 'worker']) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
  page.setDefaultTimeout(10 * 60_000)
  const messages = await watchPage(page)
  await page.addInitScript(instrument)
  const url = new URL(baseUrl)
  for (const [k, v] of Object.entries({ date: start, ...size, worker: worker ? '1' : '0' })) url.searchParams.set(k, v)
  const started = Date.now()
  await page.goto(url.toString())
  await page.waitForFunction(() => window.__sea != null)
  const result = await page.evaluate(inPage, { steps, worker })
  // Any GL message (page, worker or GPU process) over all the day changes fails.
  await page.waitForTimeout(200)
  for (const m of messages.gl()) result.failures.push(`GL: ${m}`)
  result.ok = result.failures.length === 0
  console.log(JSON.stringify({ mode: worker ? 'worker' : 'main', seconds: Math.round((Date.now() - started) / 1000), ...result }, null, 2))
  ok &&= result.ok
  await page.close()
}
await browser.close()
process.exit(ok ? 0 : 1)
