import { generateSceneParams } from './composition'
import { localDateString, resolveDate, shiftDate } from './dates'
import type { SceneParams } from './params'
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

// Phones held upright get a portrait wallpaper: the same day's scene,
// composed for a tall frame.
const portraitQuery = query.get('portrait')
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
const width = Number(query.get('w') ?? resolution?.[0] ?? 3840)
const height = Number(query.get('h') ?? resolution?.[1] ?? 2160)
const frames = Number(query.get('frames') ?? 64)

interface Rendered {
  debug: Record<string, unknown>
  toBlob(mime: string, quality: number): Promise<Blob>
}

/** Can the canvas be handed to a worker and rendered there with WebGL 2? */
function offscreenWebGL2(): boolean {
  if (query.get('worker') === '0') return false
  if (typeof OffscreenCanvas === 'undefined' || !('transferControlToOffscreen' in HTMLCanvasElement.prototype))
    return false
  const gl = new OffscreenCanvas(1, 1).getContext('webgl2')
  gl?.getExtension('WEBGL_lose_context')?.loseContext()
  return gl != null
}

/** Renders the wallpaper into the canvas: on a worker where the browser can,
 * so the GPU work never blocks the page (and the splash animation); otherwise
 * on the main thread. */
async function startRender(params: SceneParams, canvas: HTMLCanvasElement): Promise<Rendered> {
  if (!offscreenWebGL2()) {
    const { renderScene } = await import('./scene')
    const { debug } = await renderScene(params, width, height, canvas, frames)
    return {
      debug,
      toBlob: (mime, quality) =>
        new Promise((resolve, reject) =>
          canvas.toBlob(blob => (blob != null ? resolve(blob) : reject(new Error('empty canvas'))), mime, quality)
        )
    }
  }
  const worker = new Worker(new URL('./renderWorker.ts', import.meta.url), { type: 'module' })
  const send = (request: RenderRequest, transfer: Transferable[] = []): void => worker.postMessage(request, transfer)
  const blobs = new Map<number, (blob: Blob) => void>()
  const offscreen = canvas.transferControlToOffscreen()
  const debug = await new Promise<Record<string, unknown>>((resolve, reject) => {
    worker.onerror = event => reject(new Error(event.message || 'render worker failed to start'))
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

const params = generateSceneParams(date, width / height, spec)
const canvas = document.getElementById('wallpaper') as HTMLCanvasElement
const splash = document.getElementById('splash') as HTMLElement
const status = document.getElementById('status') as HTMLElement
const splashShownAt = performance.now()

const ready = (async () => {
  // Let the "Rendering…" text paint before the GPU work blocks the thread.
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))
  if (specError != null) throw specError
  if (resolution == null) throw new Error('this browser does not support WebGL 2')
  const rendered = await startRender(params, canvas)
  void hideSplash()

  document.getElementById('title')!.textContent = params.title
  document.getElementById('date')!.textContent = new Date(`${date}T12:00:00`).toLocaleDateString(
    undefined,
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  )
  ;(document.getElementById('prev') as HTMLAnchorElement).href = linkFor(shiftDate(date, -1))
  const next = document.getElementById('next') as HTMLAnchorElement
  if (date < today || allowFuture) next.href = linkFor(shiftDate(date, 1))
  else next.setAttribute('aria-disabled', 'true')
  ;(document.getElementById('today') as HTMLAnchorElement).href = linkFor(today)
  document.getElementById('download')!.addEventListener('click', () => {
    void rendered.toBlob('image/jpeg', 0.95).then(blob => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `amazing-sea-${date}${width < height ? '-portrait' : ''}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    })
  })
  document.getElementById('info')!.hidden = false
  return { params, ...rendered }
})().catch((error: unknown) => {
  status.textContent = `Rendering failed: ${String(error)}`
  throw error
})

/** Fade the splash out, keeping it up long enough to not just flash by. */
async function hideSplash(): Promise<void> {
  const minimumMs = 1200
  const remaining = minimumMs - (performance.now() - splashShownAt)
  if (remaining > 0) await new Promise(resolve => setTimeout(resolve, remaining))
  splash.classList.add('done')
  splash.addEventListener('transitionend', () => (splash.hidden = true), { once: true })
}

// Hook for scripts/snapshot.mjs.
declare global {
  interface Window {
    __sea: { ready: Promise<Rendered & { params: SceneParams }>; params: SceneParams }
  }
}
window.__sea = { ready, params }
