import { BlendFunction, Effect, EffectAttribute, Pass, RenderPass } from 'postprocessing'
import {
  AlwaysDepth,
  Color,
  DepthTexture,
  FloatType,
  GLSL3,
  HalfFloatType,
  NearestFilter,
  ShaderMaterial,
  Uniform,
  WebGLRenderTarget,
  type Camera,
  type Object3D,
  type Scene,
  type Texture,
  type WebGLRenderer
} from 'three'

// Renders the scene for frame accumulation (accumulate.ts) without redrawing
// what doesn't change. The scene is a still: only the volumetric clouds (a
// later pass) and the screen-door spray sprites (re-seeded every frame) vary
// between frames. So the first frame renders the scene without the spray and
// keeps its colour and depth; every frame restores both, then draws just the
// spray on top. The result matches rendering the whole scene every frame.
//
// Silhouettes against the sky: multisampling resolves an edge pixel to a mix
// of the geometry and the bare sky behind it, but the pixel keeps the
// geometry's depth, so the clouds and their light-shaft shadows (composited
// later, by depth) never cover that part of the sky. Against a low sun the
// bare clear sky is far brighter than the clouded one, and every tree and
// distant ridge got a bright, dotted outline. So the first frame also renders
// the scene without the sky over a transparent background: its resolved alpha
// is how much of each pixel the geometry covers. Edge pixels go through the
// clouds and aerial perspective as pure geometry, and SkyFillEffect blends
// the finished sky back in by that coverage.

const SPRAY_LAYER = 31

export class StillScenePass extends Pass {
  private readonly renderPass: RenderPass
  private readonly cache: WebGLRenderTarget
  /** The scene without the sky: premultiplied colour, alpha = coverage. */
  private readonly geometry: WebGLRenderTarget
  private cached = false
  private readonly restore = new ShaderMaterial({
    glslVersion: GLSL3,
    vertexShader: /* glsl */ `
      out vec2 vUv;
      void main() {
        vUv = position.xy * 0.5 + 0.5;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      uniform sampler2D geometryMap;
      uniform sampler2D depthMap;
      in vec2 vUv;
      out vec4 outColor;
      void main() {
        ivec2 p = ivec2(gl_FragCoord.xy);
        float depth = texelFetch(depthMap, p, 0).r;
        vec4 geometry = texelFetch(geometryMap, p, 0);
        // Where the depth is the geometry's, keep only the geometry.
        outColor = depth < 1.0 && geometry.a > 0.0
          ? vec4(geometry.rgb / geometry.a, 1.0)
          : vec4(texelFetch(map, p, 0).rgb, 1.0);
        gl_FragDepth = depth;
      }
    `,
    uniforms: {
      map: new Uniform<Texture | null>(null),
      geometryMap: new Uniform<Texture | null>(null),
      depthMap: new Uniform<Texture | null>(null)
    },
    // Overwrite every pixel's depth.
    depthFunc: AlwaysDepth,
    depthTest: true,
    depthWrite: true
  })

  constructor(
    private readonly stillScene: Scene,
    private readonly stillCamera: Camera,
    /** Objects that change every frame; drawn after the cached scene. */
    private readonly stochastic: Object3D[],
    /** The sky dome, stars and moon. */
    private readonly sky: Object3D[]
  ) {
    super('StillScenePass')
    this.renderPass = new RenderPass(stillScene, stillCamera)
    this.cache = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      depthBuffer: true,
      depthTexture: new DepthTexture(1, 1, FloatType)
    })
    this.geometry = new WebGLRenderTarget(1, 1, { type: HalfFloatType, depthBuffer: false })
    this.geometry.texture.minFilter = NearestFilter
    this.geometry.texture.magFilter = NearestFilter
    this.restore.uniforms.map.value = this.cache.texture
    this.restore.uniforms.geometryMap.value = this.geometry.texture
    this.restore.uniforms.depthMap.value = this.cache.depthTexture
    this.fullscreenMaterial = this.restore
    this.needsSwap = false
  }

  override render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null,
    deltaTime?: number,
    stencilTest?: boolean
  ): void {
    const layers = this.stochastic.map(o => o.layers.mask)
    this.stochastic.forEach(o => o.layers.set(SPRAY_LAYER))
    // The composer copies the depth for later passes when this is set:
    // always on the first frame, later only where spray changes it.
    this.needsDepthBlit = !this.cached || this.stochastic.length > 0
    if (!this.cached) {
      const clearColor = renderer.getClearColor(new Color())
      const clearAlpha = renderer.getClearAlpha()
      const visible = this.sky.map(o => o.visible)
      this.sky.forEach(o => (o.visible = false))
      renderer.setClearColor(0x000000, 0)
      this.renderPass.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest)
      this.copy(renderer, inputBuffer, this.geometry, false)
      this.sky.forEach((o, i) => (o.visible = visible[i]))
      renderer.setClearColor(clearColor, clearAlpha)
      this.renderPass.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest)
      this.copy(renderer, inputBuffer, this.cache, true)
      this.cached = true
    }
    renderer.setRenderTarget(inputBuffer)
    renderer.render(this.scene, this.camera)
    if (this.stochastic.length > 0) {
      const cameraLayers = this.stillCamera.layers.mask
      this.stillCamera.layers.set(SPRAY_LAYER)
      renderer.setRenderTarget(inputBuffer)
      renderer.render(this.stillScene, this.stillCamera)
      this.stillCamera.layers.mask = cameraLayers
    }
    this.stochastic.forEach((o, i) => (o.layers.mask = layers[i]))
  }

  /** The first frame's geometry coverage (alpha), for SkyFillEffect. */
  get geometryTexture(): Texture {
    return this.geometry.texture
  }

  /** Copy the (resolved) colour, and optionally depth, of the first frame. */
  private copy(renderer: WebGLRenderer, source: WebGLRenderTarget, target: WebGLRenderTarget, depth: boolean): void {
    // renderer.render() has already resolved the multisampled source.
    renderer.setRenderTarget(target)
    const gl = renderer.getContext() as WebGL2RenderingContext
    const props = renderer.properties
    const src = (props.get(source) as { __webglFramebuffer: WebGLFramebuffer }).__webglFramebuffer
    const dst = (props.get(target) as { __webglFramebuffer: WebGLFramebuffer }).__webglFramebuffer
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst)
    const { width, height } = target
    const mask = depth ? gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT : gl.COLOR_BUFFER_BIT
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, mask, gl.NEAREST)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    renderer.setRenderTarget(null)
  }

  override setSize(width: number, height: number): void {
    this.renderPass.setSize(width, height)
    this.cache.setSize(width, height)
    this.geometry.setSize(width, height)
    this.cached = false
  }

  override dispose(): void {
    super.dispose()
    this.renderPass.dispose()
    this.cache.dispose()
    this.geometry.dispose()
  }
}

/** Blends the sky back into silhouette pixels (see above), after the clouds
 * and aerial perspective: the finished sky of the nearby sky pixels,
 * weighted by how much of the pixel the geometry leaves uncovered. */
export class SkyFillEffect extends Effect {
  constructor(still: StillScenePass) {
    super(
      'SkyFillEffect',
      /* glsl */ `
      uniform sampler2D geometryMap;

      void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
        outputColor = inputColor;
        float coverage = texture2D(geometryMap, uv).a;
        if (depth >= 1.0 || coverage <= 0.0 || coverage >= 1.0) return;
        // The sky pixels around, weighted by how much sky each one shows.
        vec3 sum = vec3(0.0);
        float weightSum = 0.0;
        for (int y = -3; y <= 3; ++y) {
          for (int x = -3; x <= 3; ++x) {
            vec2 p = uv + vec2(x, y) * texelSize;
            if (readDepth(p) < 1.0) continue;
            float w = (1.0 - texture2D(geometryMap, p).a) * exp(-0.2 * float(x * x + y * y));
            sum += texture2D(inputBuffer, p).rgb * w;
            weightSum += w;
          }
        }
        // None (a gap deep inside a crown): leave the pixel to the geometry.
        if (weightSum < 1e-3) return;
        outputColor = vec4(mix(sum / weightSum, inputColor.rgb, coverage), inputColor.a);
      }`,
      {
        attributes: EffectAttribute.DEPTH | EffectAttribute.CONVOLUTION,
        blendFunction: BlendFunction.SET,
        uniforms: new Map<string, Uniform>([['geometryMap', new Uniform(still.geometryTexture)]])
      }
    )
  }
}
