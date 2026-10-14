import { setAssetBase } from './assets'
import type { SceneParams } from './params'
import { renderScene } from './scene'

// Renders the wallpaper into the page's canvas (transferred as an
// OffscreenCanvas) off the main thread, so the splash keeps animating
// smoothly (see startRender in main.ts).

export type RenderRequest =
  | {
      type: 'render'
      canvas: OffscreenCanvas
      params: SceneParams
      width: number
      height: number
      frames: number
      /** The page's URL, for resolving asset URLs. */
      pageUrl: string
    }
  | { type: 'blob'; id: number; mime: string; quality: number }

export type RenderReply =
  | { type: 'done'; debug: Record<string, unknown> }
  | { type: 'error'; message: string }
  | { type: 'blob'; id: number; blob: Blob }

let canvas: OffscreenCanvas | null = null
const reply = (message: RenderReply): void => (self as unknown as Worker).postMessage(message)

self.onmessage = async (event: MessageEvent<RenderRequest>) => {
  const request = event.data
  if (request.type === 'render') {
    canvas = request.canvas
    setAssetBase(request.pageUrl)
    try {
      const { debug } = await renderScene(request.params, request.width, request.height, canvas, request.frames)
      reply({ type: 'done', debug })
    } catch (error) {
      reply({ type: 'error', message: String(error) })
    }
  } else {
    const blob = await canvas!.convertToBlob({ type: request.mime, quality: request.quality })
    reply({ type: 'blob', id: request.id, blob })
  }
}
