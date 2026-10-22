// The last 10 rendered wallpapers, kept by public/sw.js, so revisiting a day
// (prev/next, reload) shows it at once. One image per build, date, size,
// frame count and scene spec: renders are deterministic, so a hit is the very
// image a new render would give. Off in dev (the code changes under it) and
// under automation (scripts/snapshot.mjs must really render); ?cache=1 forces
// it on, ?cache=0 off.

declare const __BUILD_ID__: string

export interface RenderKey {
  date: string
  width: number
  height: number
  frames: number
  portrait: boolean
  spec: string | null
}

/** Cache path for a render, relative to the service worker's scope. */
export function renderCachePath(key: RenderKey, build: string = __BUILD_ID__): string {
  const id = [build, key.date, key.width, key.height, key.frames, key.portrait ? 'p' : 'l', key.spec ?? ''].join('|')
  return `rendered/${key.date}-${key.width}x${key.height}-${fnv1a(id)}.jpg`
}

function fnv1a(text: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

export function renderCacheEnabled(query: URLSearchParams): boolean {
  const forced = query.get('cache')
  if (forced != null) return forced === '1'
  return !import.meta.env.DEV && !navigator.webdriver
}

/** Registers the service worker; resolves true once it controls this page
 * (a first visit is claimed by sw.js on activation), false if it can't. */
export async function startRenderCache(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
    if (navigator.serviceWorker.controller == null)
      await new Promise(resolve =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })
      )
    return true
  } catch {
    return false
  }
}

const cacheUrl = (path: string): URL => new URL(path, new URL(import.meta.env.BASE_URL, window.location.href))

/** The cached image, if the worker already controls the page and has it. */
export async function cachedRender(path: string): Promise<Blob | null> {
  if (navigator.serviceWorker?.controller == null) return null
  try {
    const response = await fetch(cacheUrl(path))
    return response.ok ? await response.blob() : null
  } catch {
    return null
  }
}

export async function storeRender(path: string, blob: Blob): Promise<void> {
  try {
    await fetch(cacheUrl(path), { method: 'PUT', body: blob })
  } catch {
    // Storage full or the worker went away: just don't cache.
  }
}
