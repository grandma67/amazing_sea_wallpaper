import { Color, FloatType, MeshBasicMaterial, Vector3, WebGLRenderTarget, type BufferGeometry, type Camera, type Mesh, type Object3D, type Scene, type ShaderMaterial, type WebGLRenderer } from 'three'

// The terrain shader's own numbers, read back (knowledge/tools/DEBUG.md
// "Terrain terms"): after the last frame the terrain is drawn again into a
// float target in an encode mode, each pixel writing three named terms of
// its fragment shader (height, shore coords, film masks…). Opaque props are
// drawn first as depth only, so a pixel behind a rock reads nothing; the
// sea isn't drawn, so ground under water is read. The picture is already on
// the canvas: this changes nothing in it.
//
// Used by debug.water (waterCount.ts), debug.terrainProbe (points or a
// grid) and scripts/parity.mjs (the TS mirrors against the drawn terrain).
// A term is any GLSL expression valid at the end of terrain.ts main(); add
// one to TERRAIN_TERMS and it's available everywhere.

/** `terrainView` value of the encode mode (not one a spec can ask for). */
export const TERMS_MODE = 99

/** Name → GLSL expression at the end of terrain.ts main(). */
export const TERRAIN_TERMS = {
  /** World position of the fragment (m; y is the mesh's, with the earth's drop). */
  x: 'vWorld.x',
  y: 'vWorld.y',
  z: 'vWorld.z',
  /** Height above today's still water (terrainHeightAt; TS terrainHeight). */
  h: 'h',
  /** Shore coords: seaward distance from the land frame's origin, along shore (TS worldToShore). */
  s: 'sa.x',
  a: 'sa.y',
  /** Distance from the camera (m). */
  dist: 'length(vWorld - cameraPosition)',
  /** debug.water's film kind: 1 dry, 2 damp, 3 wet rock, 4 swash, 5 pool, 6 seabed. */
  kind: 'termKind',
  pools: 'pools',
  wet: 'wet',
  exposed: 'exposed',
  gloss: 'gloss',
  /** How much of the scene the film mirrors (gloss × mirror × (1 − own)). */
  mirror: 'clamp(mirrorW, 0.0, 1.0)',
  snow: 'snowW',
  hard: 'hard',
  rock: 'rockW',
  stone: 'stoneW',
  coral: 'coral',
  creek: 'creek',
  mud: 'mudW',
  marsh: 'marshW',
  footprint: 'footprint',
  /** The land's own slope (normal's y, before stones and ripples). */
  ny: 'Nland.y',
  /** Rock shores (rockShore.ts): gully 0–1, the platform's ragged width, the bare profile. */
  rockGully: 'termGully',
  rockWidth: 'termWidth',
  rockBare: 'bareRock(sa.x, termWidth, length(p))'
} as const
export type TerrainTerm = keyof typeof TERRAIN_TERMS
export const TERRAIN_TERM_NAMES = Object.keys(TERRAIN_TERMS) as TerrainTerm[]

/** The encode branch for terrain.ts main(), placed where every term's
 * variable is in scope. `termIndex` holds three indices into TERRAIN_TERMS. */
export function termsGlsl(): string {
  const chain = (slot: string): string =>
    TERRAIN_TERM_NAMES.map((name, i) => `${slot} == ${i} ? (${TERRAIN_TERMS[name]}) : `).join('') + '0.0'
  return /* glsl */ `
  if (terrainView == ${TERMS_MODE}) {
    float termKind = 1.0;
    if (exposed * (1.0 - hard) > 0.5) termKind = 2.0;
    if (wet * hard > 0.5) termKind = 3.0;
    if (wet * (1.0 - hard) > 0.5) termKind = 4.0;
    if (pools > 0.5) termKind = 5.0;
    // Under snow the masks still run (only the gloss goes): it's snow.
    if (snowW > 0.5) termKind = 1.0;
    if (h < 0.0) termKind = 6.0;
    float termGully = rockGully(sa, length(p));
    float termWidth = rockShape.x > 0.0
      ? max(0.0, rockShape.x * (1.0 + 0.25 * (vnoise(vec2(sa.y / 40.0, 41.3) + noiseOffset) * 2.0 - 1.0)) - 8.0 * termGully * (1.0 - smoothstep(50.0, 150.0, length(p))))
      : 0.0;
    int t0 = int(termIndex.x + 0.5);
    int t1 = int(termIndex.y + 0.5);
    int t2 = int(termIndex.z + 0.5);
    gl_FragColor = vec4(${chain('t0')}, ${chain('t1')}, ${chain('t2')}, 1.0);
    return;
  }
`
}

export interface TermScene {
  renderer: WebGLRenderer
  scene: Scene
  camera: Camera
  terrain: Mesh<BufferGeometry, ShaderMaterial>
  props: Object3D
}

/** Draw up to three terms into a w × h float target and hand it to `read`
 * (RGB: the terms, A: 1 on terrain, 0 on sky and props). */
export function termPass<T>(ctx: TermScene, terms: readonly TerrainTerm[], w: number, h: number, read: (target: WebGLRenderTarget) => T): T {
  if (terms.length < 1 || terms.length > 3) throw new Error('termPass: one to three terms per pass')
  const { renderer, scene, camera, terrain, props } = ctx
  const target = new WebGLRenderTarget(w, h, { type: FloatType })
  const depthOnly = new MeshBasicMaterial({ colorWrite: false })
  const hidden: Object3D[] = []
  const hide = (o: Object3D): void => {
    if (o.visible) {
      o.visible = false
      hidden.push(o)
    }
  }
  const uniforms = terrain.material.uniforms
  const previous = {
    target: renderer.getRenderTarget(),
    autoClear: renderer.autoClear,
    shadows: renderer.shadowMap.autoUpdate,
    clear: renderer.getClearColor(new Color()),
    alpha: renderer.getClearAlpha(),
    view: uniforms.terrainView.value as number,
    index: (uniforms.termIndex.value as Vector3).clone()
  }
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
      if (([mesh.material].flat() as { transparent?: boolean }[]).some(m => m.transparent === true)) hide(o)
    })
    scene.overrideMaterial = depthOnly
    renderer.render(scene, camera)
    scene.overrideMaterial = null
    for (const o of hidden.splice(0)) o.visible = true

    // 2. The terrain alone, writing its terms.
    for (const child of scene.children) if (child !== terrain) hide(child)
    uniforms.terrainView.value = TERMS_MODE
    const index = terms.map(t => TERRAIN_TERM_NAMES.indexOf(t))
    ;(uniforms.termIndex.value as Vector3).set(index[0], index[1] ?? 0, index[2] ?? 0)
    renderer.render(scene, camera)
    return read(target)
  } finally {
    scene.overrideMaterial = null
    for (const o of hidden) o.visible = true
    uniforms.terrainView.value = previous.view
    ;(uniforms.termIndex.value as Vector3).copy(previous.index)
    renderer.autoClear = previous.autoClear
    renderer.shadowMap.autoUpdate = previous.shadows
    renderer.setClearColor(previous.clear, previous.alpha)
    renderer.setRenderTarget(previous.target)
    target.dispose()
    depthOnly.dispose()
  }
}

/** Every pixel of a w × h term pass (RGBA floats, rows bottom-up). */
export function readAll(renderer: WebGLRenderer, w: number, h: number): (target: WebGLRenderTarget) => Float32Array {
  return target => {
    const values = new Float32Array(w * h * 4)
    renderer.readRenderTargetPixels(target, 0, 0, w, h, values)
    return values
  }
}

/** A point to read: an image point ([x, y] fractions, y down) or a world point. */
export type TermAt = [number, number] | { world: [number, number, number] }

export interface TerrainProbeSpec {
  terms: TerrainTerm[]
  /** Points to read at full size. */
  at?: TermAt[]
  /** Also a grid: one sample per `every` × `every` px block (its centre). */
  every?: number
}

export interface TerrainProbeResult {
  terms: TerrainTerm[]
  /** Per point: its pixel and the terms there; values null where no terrain
   * is drawn (sky, sea beyond the land, a prop in front), pixel null out of frame. */
  points?: { at: TermAt; pixel: [number, number] | null; values: Partial<Record<TerrainTerm, number>> | null }[]
  /** Grid samples on terrain: [x, y (image fractions, y down), ...terms]. */
  grid?: { every: number; size: [number, number]; samples: number[][] }
}

const round = (v: number): number => +v.toPrecision(7)

/** debug.terrainProbe: the terms at points and/or on a grid. */
export function probeTerrain(ctx: TermScene, spec: TerrainProbeSpec, width: number, height: number): TerrainProbeResult {
  const groups: TerrainTerm[][] = []
  for (let i = 0; i < spec.terms.length; i += 3) groups.push(spec.terms.slice(i, i + 3))
  const result: TerrainProbeResult = { terms: spec.terms }

  if (spec.at != null && spec.at.length > 0) {
    const pixels = spec.at.map((at): [number, number] | null => {
      if (Array.isArray(at)) return [Math.min(width - 1, Math.floor(at[0] * width)), Math.min(height - 1, Math.floor(at[1] * height))]
      const v = new Vector3(...at.world).project(ctx.camera)
      if (Math.abs(v.x) > 1 || Math.abs(v.y) > 1 || v.z > 1) return null
      return [Math.min(width - 1, Math.floor(((v.x + 1) / 2) * width)), Math.min(height - 1, Math.floor(((1 - v.y) / 2) * height))]
    })
    const values = pixels.map(() => ({}) as Partial<Record<TerrainTerm, number>>)
    const onTerrain = pixels.map(() => true)
    for (const group of groups) {
      termPass(ctx, group, width, height, target => {
        const px = new Float32Array(4)
        pixels.forEach((pixel, k) => {
          if (pixel == null) return
          // WebGL rows run bottom-up.
          ctx.renderer.readRenderTargetPixels(target, pixel[0], height - 1 - pixel[1], 1, 1, px)
          if (px[3] < 0.5) onTerrain[k] = false
          group.forEach((term, j) => (values[k][term] = round(px[j])))
        })
      })
    }
    result.points = spec.at.map((at, k) => ({ at, pixel: pixels[k], values: pixels[k] != null && onTerrain[k] ? values[k] : null }))
  }

  if (spec.every != null) {
    const w = Math.max(1, Math.round(width / spec.every))
    const h = Math.max(1, Math.round(height / spec.every))
    const all = groups.map(group => termPass(ctx, group, w, h, readAll(ctx.renderer, w, h)))
    const samples: number[][] = []
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const i = (row * w + col) * 4
        if (all[0][i + 3] < 0.5) continue
        const sample = [+((col + 0.5) / w).toFixed(4), +(1 - (row + 0.5) / h).toFixed(4)]
        groups.forEach((group, g) => group.forEach((_, j) => sample.push(round(all[g][i + j]))))
        samples.push(sample)
      }
    }
    result.grid = { every: spec.every, size: [w, h], samples }
  }
  return result
}
