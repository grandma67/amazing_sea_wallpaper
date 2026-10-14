import type { SceneParams } from './params'
import { synthesizeOcean } from './spectrum'

// Synthesizes the ocean surface off the main thread (see synthesizeOceanAsync).

self.onmessage = (event: MessageEvent<SceneParams['ocean']>) => {
  const surface = synthesizeOcean(event.data)
  const buffers = surface.cascades.flatMap(c => [c.a.buffer, c.b.buffer, c.c.buffer])
  ;(self as unknown as Worker).postMessage(surface, buffers)
}
