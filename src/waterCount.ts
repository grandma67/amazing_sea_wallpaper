import { Color, FloatType, MeshBasicMaterial, WebGLRenderTarget, type BufferGeometry, type Camera, type Mesh, type Object3D, type Scene, type ShaderMaterial, type WebGLRenderer } from 'three'

// The shore's water films in numbers (`params.debug.water`,
// plans/WATER_VIEW.md step 2): after the last frame the terrain is drawn
// again at 1/8 size into a float target, each pixel writing its film kind,
// its distance from the camera and how much of the scene it mirrors
// (terrain.ts, `terrainView` WATER_ENCODE). Opaque props are drawn first as
// depth only, so a pool behind a boulder isn't counted; the sea isn't, so
// ground under today's still water is its own kind (`seabed`). The
// picture is already on the canvas: this changes nothing in it.

/** The terrain shader's encode mode (not a `terrainView` a spec can ask for). */
export const WATER_ENCODE = 99

/** Film kinds as the shader writes them (red channel). */
export const WATER_KINDS = ['dry', 'damp', 'wetRock', 'swash', 'pool', 'seabed'] as const
export type WaterKind = (typeof WATER_KINDS)[number]

/** The nearest pixel of a kind: distance (m) and where it is in the image
 * (fractions, x right, y down: a `probe` point). */
export interface Nearest {
  m: number
  at: [number, number]
}

export interface WaterCount {
  /** The target the counts come from (px). */
  size: [number, number]
  /** Each kind's share of the frame's pixels (0–1); the rest is sky, sea
   * hidden ground, and props. */
  share: Record<WaterKind, number>
  /** Nearest pixel of each film (null: none in frame). */
  nearest: Record<Exclude<WaterKind, 'dry' | 'seabed'>, Nearest | null>
  /** Share of the frame that is pool within 15 m of the camera. */
  poolWithin15m: number
  /** Mean mirror weight over pool pixels (gloss × mirror × (1 − own); null:
   * no pools). */
  poolMirror: number | null
}

/** Count the encoded pixels (RGBA floats, rows bottom-up as WebGL reads
 * them): r kind index + 1 (0: not terrain), g distance (m), b mirror
 * weight, a 1 on terrain. */
export function tallyWater(values: ArrayLike<number>, width: number, height: number): WaterCount {
  const counts = new Array<number>(WATER_KINDS.length).fill(0)
  const nearest: WaterCount['nearest'] = { damp: null, wetRock: null, swash: null, pool: null }
  let near15 = 0
  let mirror = 0
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const i = (row * width + col) * 4
      if (values[i + 3] < 0.5) continue
      const k = Math.round(values[i]) - 1
      if (k < 0 || k >= WATER_KINDS.length) continue
      const kind = WATER_KINDS[k]
      counts[k]++
      const m = values[i + 1]
      if (kind === 'pool') {
        mirror += values[i + 2]
        if (m <= 15) near15++
      }
      if (kind !== 'dry' && kind !== 'seabed') {
        const best = nearest[kind]
        if (best == null || m < best.m) nearest[kind] = { m, at: [(col + 0.5) / width, 1 - (row + 0.5) / height] }
      }
    }
  }
  const total = width * height
  const round = (v: number, d = 4): number => +v.toFixed(d)
  for (const key of Object.keys(nearest) as (keyof typeof nearest)[]) {
    const n = nearest[key]
    if (n != null) nearest[key] = { m: round(n.m, 1), at: [round(n.at[0], 3), round(n.at[1], 3)] }
  }
  const pools = counts[WATER_KINDS.indexOf('pool')]
  return {
    size: [width, height],
    share: Object.fromEntries(WATER_KINDS.map((kind, k) => [kind, round(counts[k] / total)])) as Record<WaterKind, number>,
    nearest,
    poolWithin15m: round(near15 / total),
    poolMirror: pools > 0 ? round(mirror / pools, 3) : null
  }
}

/** Draw the terrain's encode pass at 1/`scale` size and count it. */
export function countWater(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
  terrain: Mesh<BufferGeometry, ShaderMaterial>,
  props: Object3D,
  width: number,
  height: number,
  scale = 8
): WaterCount {
  const w = Math.max(1, Math.round(width / scale))
  const h = Math.max(1, Math.round(height / scale))
  const target = new WebGLRenderTarget(w, h, { type: FloatType })
  const depthOnly = new MeshBasicMaterial({ colorWrite: false })

  // Remember every visibility we touch, and the renderer state.
  const hidden: Object3D[] = []
  const hide = (o: Object3D): void => {
    if (o.visible) {
      o.visible = false
      hidden.push(o)
    }
  }
  const previousTarget = renderer.getRenderTarget()
  const previousAutoClear = renderer.autoClear
  const previousShadows = renderer.shadowMap.autoUpdate
  const clearColor = renderer.getClearColor(new Color())
  const clearAlpha = renderer.getClearAlpha()
  const view = terrain.material.uniforms.terrainView.value as number
  try {
    renderer.shadowMap.autoUpdate = false
    renderer.setRenderTarget(target)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()
    renderer.autoClear = false

    // 1. Opaque props, depth only.
    for (const child of scene.children) if (child !== props) hide(child)
    props.traverse(o => {
      const mesh = o as Mesh
      if (mesh.isMesh !== true) {
        if (o !== props && (o as { isGroup?: boolean }).isGroup !== true && o.type !== 'Object3D') hide(o)
        return
      }
      const materials = [mesh.material].flat() as { transparent?: boolean }[]
      if (materials.some(m => m.transparent === true)) hide(o)
    })
    scene.overrideMaterial = depthOnly
    renderer.render(scene, camera)
    scene.overrideMaterial = null
    for (const o of hidden.splice(0)) o.visible = true

    // 2. The terrain alone, encoding its films.
    for (const child of scene.children) if (child !== terrain) hide(child)
    terrain.material.uniforms.terrainView.value = WATER_ENCODE
    renderer.render(scene, camera)

    const values = new Float32Array(w * h * 4)
    renderer.readRenderTargetPixels(target, 0, 0, w, h, values)
    return tallyWater(values, w, h)
  } finally {
    scene.overrideMaterial = null
    for (const o of hidden) o.visible = true
    terrain.material.uniforms.terrainView.value = view
    renderer.autoClear = previousAutoClear
    renderer.shadowMap.autoUpdate = previousShadows
    renderer.setClearColor(clearColor, clearAlpha)
    renderer.setRenderTarget(previousTarget)
    target.dispose()
    depthOnly.dispose()
  }
}
