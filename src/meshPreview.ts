import {
  type BufferAttribute,
  ACESFilmicToneMapping,
  Box3,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  type Material,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Scene,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer
} from 'three'

import { Random } from './random'

// A mesh on its own, for judging shape and colour without rendering a whole
// beach (scripts/mesh.mjs, dev server only): /tools/mesh.html?call=…
//
//   call = MODULE#FUNCTION(ARGS)   e.g. props/wildlife#hippoGeometry($rng, 0)
//
// MODULE is under src/, ARGS is JSON (double quotes) where $rng becomes a
// new Random(seed) (&seed=, default "preview"). The result may be a
// BufferGeometry (drawn with vertex colours, or &material=MODULE#FUNCTION(ARGS)) or
// any Object3D. &scale=X,Y,Z for a unit mesh, &sun=DEG for the sun's height.
//
// Four views in a 2×2 grid: side, front, three-quarter from above, and from
// eye height `&eye=` metres away (default 20, as it would sit on a beach).
// Neutral daylight; the floor is sand-coloured (albedo ~0.45) for reference
// and a 1 m ruler (alternating 10 cm bars) lies beside the object.

declare global {
  interface Window {
    __preview?: { ready: Promise<{ size: number[]; triangles: number }> }
  }
}

const query = new URLSearchParams(window.location.search)
const width = Number(query.get('w') ?? 1600)
const height = Number(query.get('h') ?? 1000)
const eye = Number(query.get('eye') ?? 20)

/** Runs MODULE#FUNCTION(ARGS) under src/. */
async function run(call: string): Promise<unknown> {
  const match = /^([\w/.-]+)#(\w+)\((.*)\)$/s.exec(call)
  if (match == null) throw new Error(`call must be MODULE#FUNCTION(ARGS): ${call}`)
  const [, module, name, rawArgs] = match
  const mod = await import(/* @vite-ignore */ `/src/${module}.ts`)
  const fn = mod[name]
  if (typeof fn !== 'function') throw new Error(`${module} has no function ${name}`)
  const rng = new Random(query.get('seed') ?? 'preview')
  const args = (JSON.parse(`[${rawArgs.replace(/\$rng/g, '"$rng"')}]`) as unknown[]).map(a => (a === '$rng' ? rng : a))
  return fn(...args)
}

async function build(): Promise<Object3D> {
  const call = query.get('call') ?? 'props/birds#restingGull(false)'
  const result = await run(call)
  const own = query.get('material')
  const scale = query.get('scale')?.split(',').map(Number)
  let object: Object3D
  if (result instanceof BufferGeometry) {
    const material = own != null ? ((await run(own)) as Material) : new MeshStandardMaterial({ vertexColors: result.hasAttribute('color'), roughness: 0.7, side: DoubleSide })
    object = new Mesh(result, material)
  } else if (result instanceof Object3D) object = result
  else throw new Error(`${call} returned neither a BufferGeometry nor an Object3D`)
  if (scale != null) object.scale.set(scale[0], scale[1] ?? scale[0], scale[2] ?? scale[0])
  return object
}

function ruler(): Object3D {
  const group = new Object3D()
  for (let i = 0; i < 10; i++) {
    const bar = new Mesh(new PlaneGeometry(0.1, 0.04), new MeshStandardMaterial({ color: i % 2 === 0 ? 0x111111 : 0xeeeeee }))
    bar.rotation.x = -Math.PI / 2
    bar.position.set(i * 0.1 + 0.05, 0.002, 0)
    group.add(bar)
  }
  return group
}

async function main(): Promise<{ size: number[]; triangles: number }> {
  const renderer = new WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
  renderer.setSize(width, height)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.shadowMap.enabled = true
  renderer.setScissorTest(true)
  document.body.appendChild(renderer.domElement)

  const scene = new Scene()
  scene.background = new Color(0.55, 0.65, 0.78)
  const object = await build()
  object.traverse(o => {
    o.castShadow = true
    o.receiveShadow = true
  })
  scene.add(object)
  object.updateMatrixWorld(true)
  const box = new Box3().setFromObject(object)
  const size = box.getSize(new Vector3())
  const centre = box.getCenter(new Vector3())
  const radius = Math.max(0.05, size.length() / 2)

  const floor = new Mesh(new PlaneGeometry(1, 1), new MeshStandardMaterial({ color: new Color(0.45, 0.4, 0.33), roughness: 0.95 }))
  floor.rotation.x = -Math.PI / 2
  floor.scale.setScalar(Math.max(4, radius * 8, eye * 3))
  floor.position.set(centre.x, Math.min(0, box.min.y) - 0.001, centre.z)
  floor.receiveShadow = true
  scene.add(floor)
  const r = ruler()
  r.position.set(box.min.x, floor.position.y, box.max.z + Math.max(0.1, radius * 0.15))
  scene.add(r)

  scene.add(new HemisphereLight(new Color(0.6, 0.7, 0.9), new Color(0.35, 0.3, 0.25), 1.2))
  const sun = new DirectionalLight(0xfff4e6, 3)
  // &sun= the sun's height in degrees: low sun shows what a high one flatters.
  const sunDeg = query.get('sun')
  const sunDirection = sunDeg == null ? new Vector3(0.6, 1, 0.8) : new Vector3(0.6, Math.tan((Number(sunDeg) * Math.PI) / 180), 0.8)
  sun.position.copy(centre).add(sunDirection.normalize().multiplyScalar(radius * 6))
  sun.target.position.copy(centre)
  sun.castShadow = true
  sun.shadow.bias = -0.0005
  sun.shadow.normalBias = radius * 0.01
  sun.shadow.mapSize.set(2048, 2048)
  const s = radius * 2
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 0.01, far: radius * 14 })
  scene.add(sun, sun.target)

  // Side (from +z), front (from +x, the way animals face), 3/4 from above,
  // and at eye height `eye` m off.
  // `&focus=head`: frame the three views on the front 15% of the mesh (every
  // animal faces +x), to judge eyes, nostrils, mouths and bills.
  if (query.get('focus') === 'head') {
    const front = box.max.x - size.x * 0.15
    const head = new Box3()
    const p = new Vector3()
    object.traverse(o => {
      const position = (o as Mesh).geometry?.attributes.position
      if (position == null) return
      o.updateWorldMatrix(true, false)
      for (let i = 0; i < position.count; i++) {
        p.fromBufferAttribute(position as BufferAttribute, i).applyMatrix4(o.matrixWorld)
        if (p.x >= front) head.expandByPoint(p)
      }
    })
    if (!head.isEmpty()) {
      box.copy(head)
      head.getCenter(centre)
    }
  }
  const views: [Vector3, number][] = [
    [new Vector3(0, 0.15, 1), 30],
    [new Vector3(1, 0.15, 0), 30],
    [new Vector3(0.8, 0.8, 0.9), 30]
  ]
  const half = [width / 2, height / 2]
  const corners = [0, 1, 2, 3, 4, 5, 6, 7].map(
    k => new Vector3(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z)
  )
  views.forEach(([dir, fov], i) => {
    const camera = new PerspectiveCamera(fov, half[0] / half[1], radius * 0.05, radius * 50)
    // Fit the box: its extent across the view against the lens, plus half
    // its depth so the near corners stay in.
    camera.position.copy(centre).addScaledVector(dir.normalize(), radius * 4)
    camera.lookAt(centre)
    const right = new Vector3().setFromMatrixColumn(camera.matrixWorld, 0)
    const up = new Vector3().setFromMatrixColumn(camera.matrixWorld, 1)
    const extent = (axis: Vector3): number => Math.max(...corners.map(c => Math.abs(c.clone().sub(centre).dot(axis))))
    const tanV = Math.tan(((fov / 2) * Math.PI) / 180)
    const distance = Math.max(extent(right) / (tanV * camera.aspect), extent(up) / tanV) * 1.15 + extent(dir) * 0.6
    camera.position.copy(centre).addScaledVector(dir, distance)
    camera.lookAt(centre)
    const x = (i % 2) * half[0]
    const y = (1 - Math.floor(i / 2)) * half[1]
    renderer.setViewport(x, y, half[0], half[1])
    renderer.setScissor(x, y, half[0], half[1])
    renderer.render(scene, camera)
  })
  // A 50 mm-ish lens at eye height, as on the beach.
  const beach = new PerspectiveCamera(30, half[0] / half[1], 0.1, eye * 10)
  beach.position.set(centre.x + eye * 0.5, 1.6, centre.z + eye * 0.87)
  beach.lookAt(centre.x, Math.min(centre.y, 1.6), centre.z)
  renderer.setViewport(half[0], 0, half[0], half[1])
  renderer.setScissor(half[0], 0, half[0], half[1])
  renderer.render(scene, beach)

  let triangles = 0
  object.traverse(o => {
    const g = (o as Mesh).geometry
    if (g != null) triangles += (g.index?.count ?? g.attributes.position.count) / 3
  })
  return { size: size.toArray().map(v => Math.round(v * 100) / 100), triangles }
}

window.__preview = { ready: main() }
