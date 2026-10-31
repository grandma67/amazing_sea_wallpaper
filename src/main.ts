import { generateSceneParams } from './composition'
import { localDateString, resolveDate, shiftDate } from './dates'
import type { SceneParams } from './params'
import { cachedRender, renderCacheEnabled, renderCachePath, startRenderCache, storeRender } from './renderCache'
import { parseSceneSpec, type SceneSpec } from './sceneSpec'
import type { RenderReply, RenderRequest } from './renderWorker'

// URL options:
//   /random/           a random day before today (public/random/index.html)
//   ?date=YYYY-MM-DD   render a specific day (default: today, local time);
//                      future days fall back to today
//   ?future=1          allow future days (scripts/snapshot.mjs previews)
//   ?w=1920&h=1080     output resolution (default: 3840×2160, less on small or
//                      limited devices; taller than wide = portrait)
//   ?portrait=1|0      force a portrait (phone) or landscape composition
//   ?frames=24         cloud accumulation frames (default 64; fewer = faster)
//   ?worker=0          render on the main thread instead of a worker
//   ?cache=0|1         skip or force the last-10-renders cache (renderCache.ts;
//                      default on, off in dev and under automation)
//   ?scene={...}       a scene spec (JSON, sceneSpec.ts) forcing parts of the
//                      scene; its "date" replaces ?date= (future days allowed)

function linkFor(date: string): string {
  const url = new URL(window.location.href)
  url.searchParams.set('date', date)
  return url.toString()
}

// GitHub Pages redirects /random to /random/ itself; dev servers fall back to
// this page instead.
if (window.location.pathname.endsWith('/random')) {
  window.location.replace(`${window.location.pathname}/${window.location.search}`)
}

// Page-wide: the first address's size, shape and options hold for every day
// shown in this page (← → Today Random swap the day in place, see showDay).
const pageQuery = new URLSearchParams(window.location.search)
const portraitQuery = pageQuery.get('portrait')
const portrait =
  portraitQuery != null ? portraitQuery === '1' : window.matchMedia('(orientation: portrait)').matches

/** 4K on desktops; on phones, the screen's own resolution and shape; on GPUs
 * with small limits, something they can do. */
function defaultResolution(): [number, number] | null {
  const gl = document.createElement('canvas').getContext('webgl2')
  if (gl == null) return null
  const maxSize = Math.min(
    gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
    gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
  )
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  const screenLong = Math.max(screen.width, screen.height) * devicePixelRatio
  const screenShort = Math.min(screen.width, screen.height) * devicePixelRatio
  const small = screenLong < 2000
  if (portrait) {
    // Tall phone screens (~9:19.5); never wider than 3:4.
    const shape = Math.min(0.75, Math.max(0.42, screenShort / screenLong))
    const long = Math.min(maxSize, small ? 1920 : Math.min(3840, Math.max(2560, Math.round(screenLong))))
    return [Math.round(long * shape), long]
  }
  const width = Math.min(maxSize, small ? 1920 : 3840)
  return [width, Math.round((width * 9) / 16)]
}

const resolution = defaultResolution()
const width = Number(pageQuery.get('w') ?? resolution?.[0] ?? 3840)
const height = Number(pageQuery.get('h') ?? resolution?.[1] ?? 2160)
const frames = Number(pageQuery.get('frames') ?? 64)
const cacheOn = renderCacheEnabled(pageQuery)
const cacheReady = cacheOn ? startRenderCache() : Promise.resolve(false)

interface Rendered {
  debug: Record<string, unknown>
  toBlob(mime: string, quality: number): Promise<Blob>
}

/** Can the canvas be handed to a worker and rendered there with WebGL 2? */
function offscreenWebGL2(): boolean {
  if (pageQuery.get('worker') === '0') return false
  if (typeof OffscreenCanvas === 'undefined' || !('transferControlToOffscreen' in HTMLCanvasElement.prototype))
    return false
  const gl = new OffscreenCanvas(1, 1).getContext('webgl2')
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  return gl != null
}
const useWorker = offscreenWebGL2()

/**
 * One day on screen: its own canvas and, where the browser can, its own
 * render worker, so the GPU work never blocks the page (and the splash
 * animation). `dispose()` frees all of it (knowledge/LEAKS.md): the worker is
 * terminated (its heap and WebGL context go with it), a main-thread render
 * loses its context, the canvas leaves the page.
 */
interface View {
  date: string
  params: SceneParams
  canvas: HTMLCanvasElement
  ready: Promise<Rendered & { params: SceneParams }>
  dispose(): void
}

/** A render worker, started before the day is planned so its code (most of
 * the app) loads meanwhile; `failed` rejects on a load error. */
function startWorker(): { worker: Worker; failed: Promise<never> } | null {
  if (!useWorker) return null
  const worker = new Worker(new URL('./renderWorker.ts', import.meta.url), { type: 'module' })
  // Its load errors can arrive before the render starts listening.
  const failed = new Promise<never>((_, reject) =>
    worker.addEventListener('error', event => reject(new Error(event.message || 'render worker failed to start')), {
      once: true
    })
  )
  failed.catch(() => {})
  return { worker, failed }
}

/** Renders the wallpaper into the canvas, on `job`'s worker or the main
 * thread. `onDispose` gets what frees the main thread's WebGL context. */
async function startRender(
  params: SceneParams,
  canvas: HTMLCanvasElement,
  job: ReturnType<typeof startWorker>,
  onDispose: (dispose: () => void) => void
): Promise<Rendered> {
  if (job == null) {
    const { renderScene } = await import('./scene')
    const { debug, dispose } = await renderScene(params, width, height, canvas, frames)
    onDispose(dispose)
    return {
      debug,
      toBlob: (mime, quality) =>
        new Promise((resolve, reject) =>
          canvas.toBlob(blob => (blob != null ? resolve(blob) : reject(new Error('empty canvas'))), mime, quality)
        )
    }
  }
  const { worker, failed } = job
  const send = (request: RenderRequest, transfer: Transferable[] = []): void => worker.postMessage(request, transfer)
  const blobs = new Map<number, (blob: Blob) => void>()
  const offscreen = canvas.transferControlToOffscreen()
  const rendered = new Promise<Record<string, unknown>>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<RenderReply>) => {
      const message = event.data
      if (message.type === 'done') resolve(message.debug)
      else if (message.type === 'error') reject(new Error(message.message))
      else {
        blobs.get(message.id)?.(message.blob)
        blobs.delete(message.id)
      }
    }
    send(
      { type: 'render', canvas: offscreen, params, width, height, frames, pageUrl: window.location.href },
      [offscreen]
    )
  })
  const debug = await Promise.race([rendered, failed])
  let nextId = 0
  return {
    debug,
    toBlob: (mime, quality) =>
      new Promise(resolve => {
        const id = nextId++
        blobs.set(id, resolve)
        send({ type: 'blob', id, mime, quality })
      })
  }
}

const splash = document.getElementById('splash') as HTMLElement
const status = document.getElementById('status') as HTMLElement
const info = document.getElementById('info') as HTMLElement
const splashText = status.textContent
let view: View | null = null

/** Shows the day the address bar names, freeing the one shown before. */
function showDay(): View {
  const query = new URLSearchParams(window.location.search)
  const today = localDateString(new Date())
  // A malformed spec renders nothing: say why instead.
  let spec: SceneSpec = {}
  let specError: Error | null = null
  try {
    const scene = query.get('scene')
    if (scene != null) spec = parseSceneSpec(scene)
  } catch (error) {
    specError = error instanceof Error ? error : new Error(String(error))
  }
  const requested = spec.date ?? query.get('date')
  const allowFuture = query.get('future') === '1' || spec.date != null
  const date = resolveDate(requested, today, allowFuture)
  // Tomorrow's sea isn't out yet: fix the address bar to match today.
  if (requested != null && date !== requested) history.replaceState(null, '', linkFor(today))

  // The old day goes first, so two renders' memory is never held at once.
  view?.dispose()
  view = null
  const job = startWorker()
  const cachePath = renderCachePath({ date, width, height, frames, portrait, spec: query.get('scene') })
  const params = generateSceneParams(date, width / height, spec)
  const canvas = document.createElement('canvas')
  canvas.id = 'wallpaper'
  document.getElementById('wallpaper')?.remove()
  document.body.prepend(canvas)
  showSplash()
  const splashShownAt = performance.now()

  let disposed = false
  let disposeContext: (() => void) | null = null
  const ready = (async () => {
    // Let the "Rendering…" text paint before the GPU work blocks the thread.
    await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))
    if (specError != null) throw specError
    if (resolution == null) throw new Error('this browser does not support WebGL 2')
    const cached = cacheOn ? await cachedRender(cachePath) : null
    if (disposed) throw new Error('superseded')
    if (cached != null) job?.worker.terminate()
    const rendered =
      cached != null
        ? await showCached(cached, canvas)
        : await startRender(params, canvas, job, dispose => (disposed ? dispose() : (disposeContext = dispose)))
    if (disposed) throw new Error('superseded')
    void hideSplash(splashShownAt)
    if (cached == null)
      void cacheReady.then(async ok => ok && !disposed && storeRender(cachePath, await rendered.toBlob('image/jpeg', 0.95)))
    showInfo(date, today, allowFuture, params.title)
    return { params, ...rendered }
  })()
  ready.catch((error: unknown) => {
    if (!disposed) status.textContent = `Rendering failed: ${String(error)}`
  })

  return {
    date,
    params,
    canvas,
    ready,
    dispose() {
      disposed = true
      job?.worker.terminate()
      disposeContext?.()
      disposeContext = null
      canvas.remove()
    }
  }
}

/** A render from the cache, drawn into the canvas. Its download is the cached
 * JPEG itself (what a fresh render would give at quality 0.95). */
async function showCached(blob: Blob, canvas: HTMLCanvasElement): Promise<Rendered> {
  const image = await createImageBitmap(blob)
  canvas.width = image.width
  canvas.height = image.height
  canvas.getContext('2d')!.drawImage(image, 0, 0)
  image.close()
  return { debug: { cached: true }, toBlob: async () => blob }
}

function showInfo(date: string, today: string, allowFuture: boolean, title: string): void {
  document.getElementById('title')!.textContent = title
  document.getElementById('date')!.textContent = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  setLink('prev', linkFor(shiftDate(date, -1)))
  setLink('next', date < today || allowFuture ? linkFor(shiftDate(date, 1)) : null)
  setLink('today', date !== today ? linkFor(today) : null)
  info.hidden = false
}

function setLink(id: string, href: string | null): void {
  const link = document.getElementById(id) as HTMLAnchorElement
  if (href != null) {
    link.href = href
    link.removeAttribute('aria-disabled')
  } else {
    link.removeAttribute('href')
    link.setAttribute('aria-disabled', 'true')
  }
}

/** A random day before today (local time), from 2000 on; as random/index.html. */
function randomLink(): string {
  const dayMs = 86_400_000
  const now = new Date()
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  const first = Date.UTC(2000, 0, 1)
  const day = new Date(first + Math.floor(Math.random() * Math.round((today - first) / dayMs)) * dayMs)
  return linkFor(day.toISOString().slice(0, 10))
}

/** ← → Today Random swap the day in place instead of loading the page again;
 * Back and Forward go through the days seen. Clicks that open a new tab or
 * window keep the browser's own handling. */
function navigateInPlace(): void {
  info.addEventListener('click', event => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const link = (event.target as Element).closest('a')
    if (link == null) return
    const href = link.id === 'random' ? randomLink() : link.getAttribute('href') != null ? link.href : null
    event.preventDefault()
    if (href == null) return
    history.pushState(null, '', href)
    publish(showDay())
  })
  window.addEventListener('popstate', () => publish(showDay()))
}

function showSplash(): void {
  status.textContent = splashText
  splash.hidden = false
  splash.classList.remove('done')
  info.hidden = true
}

/** Fade the splash out, keeping it up long enough to not just flash by. */
async function hideSplash(shownAt: number): Promise<void> {
  const minimumMs = 1200
  const remaining = minimumMs - (performance.now() - shownAt)
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
  splash.classList.add('done')
  splash.addEventListener('transitionend', () => splash.classList.contains('done') && (splash.hidden = true), {
    once: true
  })
}

/**
 * A click (PC) or tap (phone) anywhere outside the bar shows or hides the title
 * and buttons. Phones start with them shown (no hover to reveal them), PCs
 * hidden; while hidden on a PC, hovering the bar still reveals it.
 */
function toggleInfoOnTap(): void {
  const root = document.documentElement
  root.dataset.ui = matchMedia('(hover: none)').matches ? 'shown' : 'hidden'
  document.addEventListener('click', event => {
    if ((event.target as Element).closest('#info') != null) return
    const show = root.dataset.ui !== 'shown'
    root.dataset.ui = show ? 'shown' : 'hidden'
    // A focused button would keep the bar up through :focus-within.
    if (!show && document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
}

document.getElementById('download')!.addEventListener('click', () => {
  const shown = view
  if (shown == null) return
  void shown.ready.then(rendered =>
    rendered.toBlob('image/jpeg', 0.95).then(blob => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `amazing-sea-${shown.date}${width < height ? '-portrait' : ''}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    })
  ).catch(() => {}) // a failed render says so on the splash
})

// Hook for scripts/snapshot.mjs and scripts/restart.mjs: the day on screen.
declare global {
  interface Window {
    __sea: { ready: Promise<Rendered & { params: SceneParams }>; params: SceneParams; view: View }
  }
}
function publish(shown: View): void {
  view = shown
  window.__sea = { ready: shown.ready, params: shown.params, view: shown }
}

toggleInfoOnTap()
navigateInPlace()
publish(showDay())
