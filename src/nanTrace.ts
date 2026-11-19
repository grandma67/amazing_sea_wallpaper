import { Pass } from 'postprocessing'
import {
  FloatType,
  Mesh,
  Object3D,
  OrthographicCamera,
  PlaneGeometry,
  ShaderMaterial,
  Uniform,
  WebGLRenderTarget,
  type Camera,
  type Material,
  type Scene,
  type Texture,
  type WebGLRenderer
} from 'three'

// Where NaN and ±∞ pixels come from (params.debug.nanTrace). x86 SwiftShader
// (the CI runner) drew a few on 2026-11-15 that the Mac never draws, and
// bloom spread them over the frame as black (tools/RENDER.md "Blank frames").
// Two readings, both on the last frame only, changing nothing in the picture:
// - stages: after every composer pass up to the meter, the full-resolution
//   frame's NaN and ∞ pixels (count, box, the first ones' positions), so the
//   first stage that has them is the one that makes them;
// - meshes: when the scene draw has them, each drawn object alone, with its
//   own material, the same camera and jitter, over the bad pixels' box;
// - cube: the sky cube every lit material reads, after the clear sky and
//   after the clouds are drawn into it (scanCube);
// - cloudShadow: the clouds' shadow map, per cascade (scanLayers).

/** NaN and ±∞ from the bits: compilers may fold isnan()/isinf() away. */
const NON_FINITE_GLSL = /* glsl */ `
  bool isNaNBits(float x) { uint b = floatBitsToUint(x); return (b & 0x7f800000u) == 0x7f800000u && (b & 0x007fffffu) != 0u; }
  bool isInfBits(float x) { uint b = floatBitsToUint(x); return (b & 0x7fffffffu) == 0x7f800000u; }
`

const vertexShader = /* glsl */ `
  void main() { gl_Position = vec4(position.xy, 1.0, 1.0); }
`

/** The layer the mesh trace draws on alone. */
const TRACE_LAYER = 31

/** At most this many positions per reading. */
const MAX_AT = 24

/** One reading: pixels with a NaN or ∞ in any channel (x right, y down). */
export interface NonFiniteReading {
  nan: number
  inf: number
  /** [x0, y0, x1, y1] round them all, px from the top left. */
  box: [number, number, number, number] | null
  at: [number, number][]
}

/** Scans `texture` (w × h) pixel by pixel; `scratch` must be w × h. */
function scan(renderer: WebGLRenderer, material: ShaderMaterial, quad: Scene, camera: Camera, texture: Texture, scratch: WebGLRenderTarget): NonFiniteReading {
  const { width: w, height: h } = scratch
  material.uniforms.map.value = texture
  const before = renderer.getRenderTarget()
  renderer.setRenderTarget(scratch)
  renderer.render(quad, camera)
  const px = new Uint8Array(w * h * 4)
  renderer.readRenderTargetPixels(scratch, 0, 0, w, h, px)
  renderer.setRenderTarget(before)
  const reading: NonFiniteReading = { nan: 0, inf: 0, box: null, at: [] }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (px[i] === 0 && px[i + 1] === 0) continue
      if (px[i] > 0) reading.nan++
      else reading.inf++
      const top = h - 1 - y
      const b = reading.box
      reading.box = b == null ? [x, top, x, top] : [Math.min(b[0], x), Math.min(b[1], top), Math.max(b[2], x), Math.max(b[3], top)]
      if (reading.at.length < MAX_AT) reading.at.push([x, top])
    }
  }
  return reading
}

function maskMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      ${NON_FINITE_GLSL}
      void main() {
        vec4 c = texelFetch(map, ivec2(gl_FragCoord.xy), 0);
        bool nan = isNaNBits(c.r) || isNaNBits(c.g) || isNaNBits(c.b) || isNaNBits(c.a);
        bool inf = isInfBits(c.r) || isInfBits(c.g) || isInfBits(c.b) || isInfBits(c.a);
        gl_FragColor = vec4(nan ? 1.0 : 0.0, inf ? 1.0 : 0.0, 0.0, 1.0);
      }
    `,
    uniforms: { map: new Uniform<Texture | null>(null) },
    depthTest: false,
    depthWrite: false
  })
}

/** NaN/∞ texels of a cube texture (level 0), split by sky (+y) and below. */
export interface CubeReading {
  nan: number
  inf: number
  /** Bad texels looking up (y > 0) and down: a sky or a ground source. */
  up: number
  down: number
  texels: number
}

/**
 * Scans a cube texture's level 0: the six faces side by side in a 6s × s
 * mask, each texel's direction from its face (GL's cube layout). The light
 * every lit material reads (2026-11-17: the sky half went NaN on SwiftShader,
 * and with it all of them, while the frame's own sky stayed clean).
 */
export function scanCube(renderer: WebGLRenderer, cube: Texture, size: number): CubeReading {
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform samplerCube map;
      uniform float size;
      ${NON_FINITE_GLSL}
      void main() {
        int face = int(gl_FragCoord.x / size);
        vec2 st = (vec2(mod(gl_FragCoord.x, size), gl_FragCoord.y) / size) * 2.0 - 1.0;
        vec3 d = face == 0 ? vec3(1.0, -st.y, -st.x)
          : face == 1 ? vec3(-1.0, -st.y, st.x)
          : face == 2 ? vec3(st.x, 1.0, st.y)
          : face == 3 ? vec3(st.x, -1.0, -st.y)
          : face == 4 ? vec3(st.x, -st.y, 1.0)
          : vec3(-st.x, -st.y, -1.0);
        vec4 c = textureLod(map, d, 0.0);
        bool nan = isNaNBits(c.r) || isNaNBits(c.g) || isNaNBits(c.b) || isNaNBits(c.a);
        bool inf = isInfBits(c.r) || isInfBits(c.g) || isInfBits(c.b) || isInfBits(c.a);
        gl_FragColor = vec4(nan ? 1.0 : 0.0, inf ? 1.0 : 0.0, d.y > 0.0 ? 1.0 : 0.0, 1.0);
      }
    `,
    uniforms: { map: new Uniform<Texture | null>(cube), size: new Uniform(size) },
    depthTest: false,
    depthWrite: false
  })
  const w = size * 6
  const target = new WebGLRenderTarget(w, size, { depthBuffer: false })
  const quad = new Mesh(new PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  const before = renderer.getRenderTarget()
  const px = new Uint8Array(w * size * 4)
  try {
    renderer.setRenderTarget(target)
    renderer.render(quad, new OrthographicCamera())
    renderer.readRenderTargetPixels(target, 0, 0, w, size, px)
  } finally {
    renderer.setRenderTarget(before)
    target.dispose()
    quad.geometry.dispose()
    material.dispose()
  }
  const reading: CubeReading = { nan: 0, inf: 0, up: 0, down: 0, texels: w * size }
  for (let i = 0; i < px.length; i += 4) {
    if (px[i] === 0 && px[i + 1] === 0) continue
    if (px[i] > 0) reading.nan++
    else reading.inf++
    if (px[i + 2] > 0) reading.up++
    else reading.down++
  }
  return reading
}

/** NaN/∞ texels per layer of an array texture (the clouds' shadow cascades). */
export function scanLayers(renderer: WebGLRenderer, texture: Texture, width: number, height: number, layers: number): { nan: number; inf: number }[] {
  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader: /* glsl */ `
      precision highp sampler2DArray;
      uniform sampler2DArray map;
      uniform int layer;
      ${NON_FINITE_GLSL}
      void main() {
        vec4 c = texelFetch(map, ivec3(ivec2(gl_FragCoord.xy), layer), 0);
        bool nan = isNaNBits(c.r) || isNaNBits(c.g) || isNaNBits(c.b) || isNaNBits(c.a);
        bool inf = isInfBits(c.r) || isInfBits(c.g) || isInfBits(c.b) || isInfBits(c.a);
        gl_FragColor = vec4(nan ? 1.0 : 0.0, inf ? 1.0 : 0.0, 0.0, 1.0);
      }
    `,
    uniforms: { map: new Uniform<Texture | null>(texture), layer: new Uniform(0) },
    depthTest: false,
    depthWrite: false
  })
  const target = new WebGLRenderTarget(width, height, { depthBuffer: false })
  const quad = new Mesh(new PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  const camera = new OrthographicCamera()
  const before = renderer.getRenderTarget()
  const px = new Uint8Array(width * height * 4)
  const result: { nan: number; inf: number }[] = []
  try {
    for (let l = 0; l < layers; l++) {
      material.uniforms.layer.value = l
      renderer.setRenderTarget(target)
      renderer.render(quad, camera)
      renderer.readRenderTargetPixels(target, 0, 0, width, height, px)
      const r = { nan: 0, inf: 0 }
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] > 0) r.nan++
        else if (px[i + 1] > 0) r.inf++
      }
      result.push(r)
    }
  } finally {
    renderer.setRenderTarget(before)
    target.dispose()
    quad.geometry.dispose()
    material.dispose()
  }
  return result
}

/** What a composer pass is, for the report: its name and its effects'. */
export function passLabel(pass: Pass): string {
  const effects = (pass as unknown as { effects?: { name: string }[] }).effects
  return effects != null && effects.length > 0 ? `${pass.name}(${effects.map(e => e.name).join(', ')})` : pass.name
}

/** Reads its input after the pass before it; draws nothing (no swap). */
export class NonFiniteStagePass extends Pass {
  reading: NonFiniteReading | null = null
  private readonly mask = maskMaterial()
  private scratch: WebGLRenderTarget | null = null

  constructor(readonly after: string) {
    super('NonFiniteStagePass')
    this.needsSwap = false
    this.fullscreenMaterial = this.mask
  }

  override render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget): void {
    const { width, height } = inputBuffer
    if (this.scratch == null || this.scratch.width !== width || this.scratch.height !== height) {
      this.scratch?.dispose()
      this.scratch = new WebGLRenderTarget(width, height, { depthBuffer: false })
    }
    this.reading = scan(renderer, this.mask, this.scene, this.camera, inputBuffer.texture, this.scratch)
  }

  override dispose(): void {
    super.dispose()
    this.scratch?.dispose()
    this.mask.dispose()
  }
}

/** One drawn object that makes NaN or ∞ alone. */
export interface NonFiniteMesh {
  /** Prop kind or names up the tree, then the object's own name or type. */
  path: string
  material: string
  /** Geometry type, vertices (× instances), and a ShaderMaterial's first uniforms. */
  what: string
  nan: number
  inf: number
}

/** What a drawn object is, for the report. */
function objectPath(object: Object3D): string {
  const names: string[] = []
  for (let o: Object3D | null = object; o != null; o = o.parent) {
    const prop = o.userData.prop as string | undefined
    const label = prop != null ? `prop:${prop}` : o.name !== '' ? o.name : o === object ? o.type : ''
    if (label !== '') names.unshift(label)
    if (prop != null) break
  }
  return names.join(' > ')
}

function describe(o: Mesh): string {
  const g = o.geometry
  const n = g?.attributes.position?.count ?? 0
  const instances = (o as { count?: number; isInstancedMesh?: boolean }).isInstancedMesh === true ? ` × ${(o as { count: number }).count}` : ''
  const m = (Array.isArray(o.material) ? o.material[0] : o.material) as Material & { uniforms?: Record<string, unknown> }
  const uniforms = m?.uniforms != null ? ` uniforms ${Object.keys(m.uniforms).slice(0, 4).join(',')}` : ''
  return `${g?.type ?? '?'} ${n} v${instances}${uniforms}`
}

function materialLabel(material: Material | Material[]): string {
  const list = Array.isArray(material) ? material : [material]
  return list.map(m => (m.name !== '' ? `${m.type}:${m.name}` : m.type)).join(', ')
}

/**
 * Draws each visible object of `scene` alone into a float target over `box`
 * (px from the top left, with a margin), and returns those with NaN or ∞
 * there, worst first. Shadow maps are not redrawn (they stay as the frame had
 * them); the camera keeps the frame's jitter. Alone by layer, not `visible`
 * (a hidden mesh would hide the meshes under it): the camera sees only
 * TRACE_LAYER, which the lights and the object under test are on.
 */
export function traceMeshes(renderer: WebGLRenderer, scene: Scene, camera: Camera, box: [number, number, number, number], width: number, height: number): { tested: number; found: NonFiniteMesh[] } {
  const margin = 4
  const x0 = Math.max(0, box[0] - margin)
  const x1 = Math.min(width - 1, box[2] + margin)
  // Render targets count rows from the bottom.
  const y0 = Math.max(0, height - 1 - (box[3] + margin))
  const y1 = Math.min(height - 1, height - 1 - (box[1] - margin))
  const w = x1 - x0 + 1
  const h = y1 - y0 + 1
  const target = new WebGLRenderTarget(width, height, { type: FloatType })
  target.scissor.set(x0, y0, w, h)
  target.scissorTest = true
  target.viewport.set(0, 0, width, height)

  const drawn: Object3D[] = []
  scene.traverseVisible(o => {
    const r = o as Object3D & { isMesh?: boolean; isPoints?: boolean; isLine?: boolean; isSprite?: boolean }
    if (r.isMesh === true || r.isPoints === true || r.isLine === true || r.isSprite === true) drawn.push(o)
  })
  const masks = new Map<Object3D, number>()
  scene.traverse(o => masks.set(o, o.layers.mask))
  scene.traverse(o => {
    if ((o as { isLight?: boolean }).isLight === true) o.layers.enable(TRACE_LAYER)
  })
  const cameraMask = camera.layers.mask
  camera.layers.set(TRACE_LAYER)
  const autoUpdate = renderer.shadowMap.autoUpdate
  const background = scene.background
  const before = renderer.getRenderTarget()
  renderer.shadowMap.autoUpdate = false
  renderer.shadowMap.needsUpdate = false
  scene.background = null
  const px = new Float32Array(w * h * 4)
  const found: NonFiniteMesh[] = []
  try {
    for (const o of drawn) {
      o.layers.enable(TRACE_LAYER)
      renderer.setRenderTarget(target)
      renderer.setClearColor(0x000000, 0)
      renderer.clear()
      renderer.render(scene, camera)
      o.layers.disable(TRACE_LAYER)
      renderer.readRenderTargetPixels(target, x0, y0, w, h, px)
      let nan = 0
      let inf = 0
      for (let i = 0; i < px.length; i += 4) {
        const bad = [px[i], px[i + 1], px[i + 2], px[i + 3]]
        if (bad.some(Number.isNaN)) nan++
        else if (bad.some(v => !Number.isFinite(v))) inf++
      }
      if (nan + inf > 0) found.push({ path: objectPath(o), material: materialLabel((o as Mesh).material), what: describe(o as Mesh), nan, inf })
    }
  } finally {
    for (const [o, mask] of masks) o.layers.mask = mask
    camera.layers.mask = cameraMask
    scene.background = background
    renderer.shadowMap.autoUpdate = autoUpdate
    renderer.setRenderTarget(before)
    target.dispose()
  }
  found.sort((a, b) => b.nan + b.inf - (a.nan + a.inf))
  return { tested: drawn.length, found: found.slice(0, 20) }
}
