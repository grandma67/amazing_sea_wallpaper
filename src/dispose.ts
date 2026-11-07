import { EventDispatcher, Material, Texture, WebGLRenderTarget, type Object3D } from 'three'

// Frees what a render put on the GPU (knowledge/LEAKS.md). three only frees a
// geometry, material, texture or render target when told to; a still needs
// none of them once its frame is in the canvas.

type Disposable = { dispose(): void }

/** Collects GPU resources, each disposed once by `dispose()`. */
export class GpuResources {
  private readonly items = new Set<Disposable>()

  add(...items: (Disposable | null | undefined)[]): void {
    for (const item of items) if (item != null) this.items.add(item)
  }

  /** Every geometry, material and texture (material properties and shader
   * uniforms, one array deep) under `root`. */
  addTree(root: Object3D): void {
    root.traverse(object => {
      const mesh = object as Object3D & { geometry?: Disposable; material?: Material | Material[]; dispose?: () => void }
      this.add(mesh.geometry)
      // Instanced and skinned meshes hold their own buffers and textures.
      if (typeof mesh.dispose === 'function') this.add(mesh as Disposable)
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material != null ? [mesh.material] : []
      for (const material of materials) this.addMaterial(material)
      // The shadow pass's own (terrain, bent grass).
      const depth = (object as Object3D & { customDepthMaterial?: Material }).customDepthMaterial
      if (depth != null) this.addMaterial(depth)
    })
  }

  addMaterial(material: Material): void {
    this.add(material)
    const uniforms = (material as Material & { uniforms?: Record<string, { value: unknown }> }).uniforms ?? {}
    const values = [...Object.values(material), ...Object.values(uniforms).map(u => u?.value)]
    for (const value of values.flatMap(v => (Array.isArray(v) ? v : [v]))) this.addTexture(value)
  }

  /** A texture, or a render target's texture: the target is what holds the
   * framebuffer, so dispose that (disposing only its texture leaks it). */
  addTexture(value: unknown): void {
    if (!(value instanceof Texture)) return
    const target = (value as Texture & { renderTarget?: unknown }).renderTarget
    this.add(target instanceof WebGLRenderTarget ? target : value)
  }

  dispose(): void {
    for (const item of this.items) item.dispose()
    this.items.clear()
  }
}

/**
 * Records what the renderer uploads from now until `stop()`: three listens
 * for 'dispose' on every geometry, material, texture and render target it
 * puts on the GPU (and on instanced meshes) and stops once it's disposed.
 * `sweep()` disposes those still listened to (shared module singletons, the
 * libraries' own quads and targets) and names them.
 */
export function trackUploads(): { stop(): void; sweep(): string[] } {
  const proto = EventDispatcher.prototype as unknown as { addEventListener: (type: string, listener: unknown) => void }
  const original = proto.addEventListener
  const seen = new Set<EventDispatcher<{ dispose: object }>>()
  proto.addEventListener = function (this: EventDispatcher<{ dispose: object }>, type: string, listener: unknown) {
    if (type === 'dispose') seen.add(this)
    original.call(this, type, listener)
  }
  return {
    stop: () => (proto.addEventListener = original),
    sweep: () => {
      const left = [...seen].filter(
        o => (o as unknown as { _listeners?: Record<string, unknown[]> })._listeners?.dispose?.length
      ) as unknown as (Disposable & { type?: string; name?: string })[]
      seen.clear()
      for (const o of left) o.dispose()
      return left.map(o => `${o.type ?? o.constructor.name}${o.name ? ` "${o.name}"` : ''}`)
    }
  }
}
