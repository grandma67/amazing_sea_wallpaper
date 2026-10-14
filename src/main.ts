import { generateSceneParams } from './composition'
import { renderScene } from './scene'

// URL options:
//   ?date=YYYY-MM-DD   render a specific day (default: today, local time)
//   ?w=1920&h=1080     output resolution (default: 3840×2160, less on small or
//                      limited devices)
//   ?frames=24         cloud accumulation frames (default 64; fewer = faster)

function localDateString(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return localDateString(d)
}

function linkFor(date: string): string {
  const url = new URL(window.location.href)
  url.searchParams.set('date', date)
  return url.toString()
}

const query = new URLSearchParams(window.location.search)
const today = localDateString(new Date())
const requested = query.get('date')
const date = requested != null && /^\d{4}-\d{2}-\d{2}$/.test(requested) ? requested : today

/** 4K on desktops; on phones and GPUs with small limits, something they can do. */
function defaultResolution(): [number, number] | null {
  const gl = document.createElement('canvas').getContext('webgl2')
  if (gl == null) return null
  const maxSize = Math.min(
    gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number,
    gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
  )
  gl.getExtension('WEBGL_lose_context')?.loseContext()
  const small = Math.max(screen.width, screen.height) * devicePixelRatio < 2000
  const width = Math.min(maxSize, small ? 1920 : 3840)
  return [width, Math.round((width * 9) / 16)]
}

const resolution = defaultResolution()
const width = Number(query.get('w') ?? resolution?.[0] ?? 3840)
const height = Number(query.get('h') ?? resolution?.[1] ?? 2160)
const frames = Number(query.get('frames') ?? 64)

const params = generateSceneParams(date)
const canvas = document.getElementById('wallpaper') as HTMLCanvasElement
const splash = document.getElementById('splash') as HTMLElement
const status = document.getElementById('status') as HTMLElement
const splashShownAt = performance.now()

const ready = (async () => {
  // Let the "Rendering…" text paint before the GPU work blocks the thread.
  await new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)))
  if (resolution == null) throw new Error('this browser does not support WebGL 2')
  const result = await renderScene(params, width, height, canvas, frames)
  void hideSplash()

  document.getElementById('title')!.textContent = params.title
  document.getElementById('date')!.textContent = new Date(`${date}T12:00:00`).toLocaleDateString(
    undefined,
    { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  )
  ;(document.getElementById('prev') as HTMLAnchorElement).href = linkFor(shiftDate(date, -1))
  ;(document.getElementById('next') as HTMLAnchorElement).href = linkFor(shiftDate(date, 1))
  ;(document.getElementById('today') as HTMLAnchorElement).href = linkFor(today)
  document.getElementById('download')!.addEventListener('click', () => {
    canvas.toBlob(
      blob => {
        if (blob == null) return
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `amazing-sea-${date}.jpg`
        a.click()
        URL.revokeObjectURL(a.href)
      },
      'image/jpeg',
      0.95
    )
  })
  document.getElementById('info')!.hidden = false
  return result
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
    __sea: { ready: Promise<unknown>; params: typeof params }
  }
}
window.__sea = { ready, params }
