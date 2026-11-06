import { InstancedMesh, Matrix4, Mesh, ShaderMaterial, Texture, type BufferGeometry, type Group, type Material, type Object3D } from 'three'
import { describe, expect, it } from 'vitest'

import { GpuResources } from '../src/dispose'
import type { SceneParams } from '../src/params'
import { createProps } from '../src/props/index'
import type { PropContext } from '../src/props/context'
import { reportProps } from '../src/props/report'
import { shadeProps } from '../src/propShade'
import { allParams, expectEvery, scene, viewOf } from './days'
import { triangles } from './mesh'

// The whole prop tree, built as the render builds it but with no WebGL: what a
// render would otherwise be needed to show (LEAKS.md "Day changes", the
// snapshot's warnings, CLAUDE.md "Materials"). Where things land is for
// `params.mjs --project`; how they look is for a render.

/** A real day of each kind, and the rare builders real days seldom reach. */
const SCENES: { name: string; p: SceneParams }[] = [
  ...['beach', 'rock-shore', 'open-sea'].map(type => {
    const p = allParams().filter(q => q.coast.type === type)[20]
    return { name: `a real ${type} day`, p }
  }),
  { name: 'a real snowy beach', p: allParams().filter(q => q.snow != null && q.coast.type === 'beach' && q.biome.vegetation.length > 2)[0] },
  { name: 'a tidal flat', p: scene({ eclipse: null, coast: 'tidal-flat', place: 'wadden-north-sea', tide: 'low' }, '2025-07-10') },
  { name: 'a frozen sea and an ice foot', p: scene({ eclipse: null, place: 'greenland', coast: 'beach', seaIce: 'fast', snow: true, props: { iceFoot: true } }, '2025-02-15') },
  { name: 'a storm with a waterspout', p: scene({ eclipse: null, biome: 'tropical', timeOfDay: 'daylight', storm: 'thunderstorm', waterspout: 'tornadic', shelfCloud: true, props: { ships: true } }, '2025-07-10') },
  { name: 'a lit lighthouse, colony and whales', p: scene({ eclipse: null, timeOfDay: 'blue-hour', fog: null, lighthouse: 'rock', colony: 'gannet', colonySite: 'island', islands: 'rocky', landform: 'strato', props: { marine: 'humpback', migratory: 'goose', ships: true } }, '2025-07-10') }
]

const built = new Map<SceneParams, { ctx: PropContext; group: Group }>()
function build(p: SceneParams): { ctx: PropContext; group: Group } {
  let b = built.get(p)
  if (b == null) {
    const ctx = viewOf(p)
    built.set(p, (b = { ctx, group: createProps(ctx) }))
  }
  return b
}

const meshes = (group: Group): (Mesh | InstancedMesh)[] => {
  const out: (Mesh | InstancedMesh)[] = []
  group.traverse(o => {
    if ((o as Mesh).isMesh === true) out.push(o as Mesh)
  })
  return out
}
const finiteMatrix = (m: Matrix4): boolean => m.elements.every(Number.isFinite)
/** Instance matrices of a mesh, one by one. */
function* instanceMatrices(mesh: InstancedMesh): Iterable<Matrix4> {
  const m = new Matrix4()
  for (let i = 0; i < mesh.count; i++) yield (mesh.getMatrixAt(i, m), m)
}

describe.each(SCENES)('$name', ({ p }) => {
  it('builds, every object tagged with its kind', () => {
    const { group } = build(p)
    expect(group.children.length).toBeGreaterThan(0)
    expectEvery(group.children, o => typeof o.userData.prop === 'string', { what: o => o.name })
  })

  it('places finite objects, instanced ones always drawn', () => {
    const { group } = build(p)
    group.updateMatrixWorld(true)
    for (const mesh of meshes(group)) {
      expect(finiteMatrix(mesh.matrixWorld), `${mesh.userData.prop} ${mesh.name}`).toBe(true)
      if (!(mesh instanceof InstancedMesh)) continue
      // Three's frustum test goes by the first instance's sphere (CLAUDE.md).
      expect(mesh.frustumCulled, `${mesh.userData.prop} is culled as one`).toBe(false)
      expect(mesh.count).toBeLessThanOrEqual(mesh.instanceMatrix.count)
      if (mesh.count > 0) expectEvery(instanceMatrices(mesh), finiteMatrix, { what: () => mesh.userData.prop })
    }
  })

  it('keeps each mesh under the triangle budget', () => {
    expectEvery(meshes(build(p).group), m => triangles(m.geometry as BufferGeometry) <= 130_000, { what: m => [m.userData.prop, m.name, triangles(m.geometry as BufferGeometry)] })
  })

  // snapshot.mjs warns of this after a render: a lit object that doesn't read
  // the shade stays bright under a cloud.
  it('reads the land and cloud shade on every lit object', () => {
    const coverage = shadeProps(build(p).group, { cloudShadeForce: { value: -1 } })
    expect(Object.keys(coverage).length).toBeGreaterThan(0)
    expectEvery(Object.entries(coverage), ([, c]) => c.shaded === c.lit, { what: e => e })
  })

  // What `npm run check:restart` needs a browser for: gpuAfterRender stays 0
  // only if the tree's own walk reaches every buffer and texture.
  it('frees all it made through GpuResources', () => {
    const { group } = build(p)
    const made = new Set<{ addEventListener: Texture['addEventListener'] }>()
    group.traverse(o => {
      const mesh = o as Mesh
      if (mesh.geometry != null) made.add(mesh.geometry as never)
      if (o instanceof InstancedMesh) made.add(o as never)
      for (const material of [mesh.material ?? []].flat() as Material[]) {
        made.add(material as never)
        const uniforms = material instanceof ShaderMaterial ? Object.values(material.uniforms).map(u => u.value as unknown) : []
        for (const value of [...Object.values(material), ...uniforms]) if (value instanceof Texture) made.add(value as never)
      }
    })
    const freed = new Set<unknown>()
    for (const item of made) item.addEventListener('dispose' as never, (() => freed.add(item)) as never)
    const gpu = new GpuResources()
    gpu.addTree(group)
    gpu.dispose()
    expect(made.size).toBeGreaterThan(0)
    expectEvery(made, item => freed.has(item), { what: item => (item as { type?: string; name?: string }).type })
  })
})

describe('reportProps', () => {
  it('counts what is placed and what is in frame, inside the frame', () => {
    const { group, ctx } = build(SCENES[0].p)
    const report = reportProps(group, ctx.camera, 1920, 1080)
    expect(Object.keys(report).length).toBeGreaterThan(0)
    for (const [kind, r] of Object.entries(report)) {
      expect(r.placed, kind).toBeGreaterThanOrEqual(0)
      expect(r.inFrame, kind).toBeLessThanOrEqual(r.placed)
      if (r.inFrame === 0) {
        expect(r.box, kind).toBeNull()
        continue
      }
      const [x0, y0, x1, y1] = r.box!
      expect(r.nearest, kind).toBeGreaterThanOrEqual(0)
      expect([x0 >= 0, y0 >= 0, x1 <= 1920, y1 <= 1080, x0 <= x1, y0 <= y1], kind).toEqual([true, true, true, true, true, true])
    }
  })
})

describe('createProps', () => {
  it('is the same on every build of a day', () => {
    const p = SCENES[0].p
    const instances = (g: Group) => meshes(g).flatMap(m => (m instanceof InstancedMesh ? [m.userData.prop, m.count, ...m.instanceMatrix.array.slice(0, 32)] : [m.userData.prop, ...m.position.toArray()]))
    expect(instances(createProps(viewOf(p)))).toEqual(instances(createProps(viewOf(p))))
  })

  it('places nothing with debug.props false, and leaves nothing for the sea to read', () => {
    const group = createProps(viewOf({ ...SCENES[0].p, debug: { props: false } }))
    expect(group.children).toEqual([])
    expect(group.userData.waterRocks).toEqual([])
    expect(group.userData.waterIslands).toEqual([])
    expect(group.userData.litter).toBeNull()
  })

  it('puts a marker post at each point asked for, whatever else is off', () => {
    const markers = (debug: NonNullable<SceneParams['debug']>): Object3D[] => createProps(viewOf({ ...SCENES[0].p, debug })).children.filter(o => o.userData.prop === 'markers')
    expect(markers({ props: false, markers: ['camera-ground'] })).toHaveLength(1)
    expect((markers({ markers: ['camera-ground', 'props:vegetation'] })[1] as InstancedMesh).count).toBeGreaterThan(0)
    expect(markers({ props: false, markers: ['props:vegetation'] })).toEqual([])
  })
})
