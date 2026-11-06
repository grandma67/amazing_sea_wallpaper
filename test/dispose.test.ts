import { BoxGeometry, DataTexture, EventDispatcher, InstancedMesh, Mesh, MeshStandardMaterial, Group, ShaderMaterial, WebGLRenderTarget } from 'three'
import { describe, expect, it } from 'vitest'

import { GpuResources, trackUploads } from '../src/dispose'

// What frees the GPU (LEAKS.md), without one: three frees a thing when it hears
// 'dispose', so hearing it is what `debug.gpuAfterRender` reading 0 comes down to.

/** How many 'dispose' events each thing heard. */
const counting = <T extends { addEventListener: EventDispatcher<{ dispose: object }>['addEventListener'] }>(...items: T[]) => {
  const heard = new Map<T, number>(items.map(i => [i, 0]))
  for (const item of items) item.addEventListener('dispose', () => heard.set(item, heard.get(item)! + 1))
  return heard
}

describe('GpuResources', () => {
  it('frees a tree once each, however often it is shared', () => {
    const geometry = new BoxGeometry()
    const material = new MeshStandardMaterial()
    const group = new Group()
    group.add(new Mesh(geometry, material), new Mesh(geometry, material))
    const heard = counting<EventDispatcher<{ dispose: object }>>(geometry, material)
    const gpu = new GpuResources()
    gpu.addTree(group)
    gpu.dispose()
    expect([...heard.values()]).toEqual([1, 1])
    // Nothing is held for a second day.
    gpu.dispose()
    expect([...heard.values()]).toEqual([1, 1])
  })

  it('frees instanced meshes’ own buffers, and each material of a list', () => {
    const instanced = new InstancedMesh(new BoxGeometry(), new MeshStandardMaterial(), 2)
    const materials = [new MeshStandardMaterial(), new MeshStandardMaterial()]
    const heard = counting<EventDispatcher<{ dispose: object }>>(instanced, ...materials)
    const gpu = new GpuResources()
    gpu.addTree(instanced)
    gpu.addTree(new Mesh(new BoxGeometry(), materials))
    gpu.dispose()
    expect([...heard.values()]).toEqual([1, 1, 1])
  })

  it('finds textures in material properties and uniforms, one array deep', () => {
    const [map, uniform, inList] = [new DataTexture(), new DataTexture(), new DataTexture()]
    const shader = new ShaderMaterial({ uniforms: { a: { value: uniform }, b: { value: [inList] }, c: { value: 1 } } })
    const standard = new MeshStandardMaterial({ map })
    const heard = counting(map, uniform, inList)
    const gpu = new GpuResources()
    gpu.addMaterial(shader)
    gpu.addMaterial(standard)
    gpu.dispose()
    expect([...heard.values()]).toEqual([1, 1, 1])
  })

  it('frees a render target by its target: its texture alone leaks the framebuffer', () => {
    const target = new WebGLRenderTarget(4, 4)
    const heard = counting(target)
    const gpu = new GpuResources()
    gpu.addTexture(target.texture)
    gpu.dispose()
    expect(heard.get(target)).toBe(1)
  })

  it('takes nulls and things that are no texture', () => {
    const gpu = new GpuResources()
    gpu.add(null, undefined)
    gpu.addTexture(3)
    expect(() => gpu.dispose()).not.toThrow()
  })
})

describe('trackUploads', () => {
  const upload = (o: EventDispatcher<{ dispose: object }>): void => o.addEventListener('dispose', () => undefined)

  it('sweeps what is still listened to and names it, not what was freed', () => {
    const tracker = trackUploads()
    const [left, freed] = [new BoxGeometry(), new BoxGeometry()]
    left.name = 'quad'
    // As three does on upload: listens, and stops when it hears.
    upload(left)
    const stop = (): void => freed.removeEventListener('dispose', stop)
    freed.addEventListener('dispose', stop)
    freed.dispose()
    tracker.stop()
    const heard = counting(left)
    expect(tracker.sweep()).toEqual([`${left.type} "quad"`])
    expect(heard.get(left)).toBe(1)
    // A second sweep has nothing left to do.
    expect(tracker.sweep()).toEqual([])
  })

  it('stops watching when stopped', () => {
    const original = EventDispatcher.prototype.addEventListener
    const tracker = trackUploads()
    expect(EventDispatcher.prototype.addEventListener).not.toBe(original)
    tracker.stop()
    expect(EventDispatcher.prototype.addEventListener).toBe(original)
    upload(new BoxGeometry())
    expect(tracker.sweep()).toEqual([])
  })
})
