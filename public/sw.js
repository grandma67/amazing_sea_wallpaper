// Keeps the last few rendered wallpapers so revisiting a day shows it at once
// instead of rendering it again (src/renderCache.ts). Only requests under
// rendered/ are handled: GET answers from the cache (404 if absent) and marks
// the image as just viewed; PUT stores the page's render and drops the least
// recently viewed beyond MAX_IMAGES. Everything else goes to the network.

const CACHE = 'rendered-wallpapers-v1'
const MAX_IMAGES = 10

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (!url.href.startsWith(new URL('rendered/', self.registration.scope).href)) return
  if (event.request.method === 'GET') event.respondWith(lookup(url.href))
  else if (event.request.method === 'PUT') event.respondWith(store(url.href, event.request))
})

async function lookup(key) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(key)
  if (hit == null) return new Response(null, { status: 404 })
  // Cache keys keep insertion order: re-insert to mark it the newest.
  const blob = await hit.blob()
  await cache.delete(key)
  await cache.put(key, imageResponse(blob))
  return imageResponse(blob)
}

async function store(key, request) {
  const cache = await caches.open(CACHE)
  await cache.delete(key)
  await cache.put(key, imageResponse(await request.blob()))
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_IMAGES)).map(old => cache.delete(old)))
  return new Response(null, { status: 201 })
}

const imageResponse = blob => new Response(blob, { headers: { 'Content-Type': 'image/jpeg' } })
