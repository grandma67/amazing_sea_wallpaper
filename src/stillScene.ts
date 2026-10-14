import { Pass, RenderPass } from 'postprocessing'
import {
  AlwaysDepth,
  DepthTexture,
  FloatType,
  GLSL3,
  HalfFloatType,
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

const SPRAY_LAYER = 31

export class StillScenePass extends Pass {
  private readonly renderPass: RenderPass
  private readonly cache: WebGLRenderTarget
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
      uniform sampler2D depthMap;
      in vec2 vUv;
      out vec4 outColor;
      void main() {
        ivec2 p = ivec2(gl_FragCoord.xy);
        outColor = texelFetch(map, p, 0);
        gl_FragDepth = texelFetch(depthMap, p, 0).r;
      }
    `,
    uniforms: {
      map: new Uniform<Texture | null>(null),
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
    private readonly stochastic: Object3D[]
  ) {
    super('StillScenePass')
    this.renderPass = new RenderPass(stillScene, stillCamera)
    this.cache = new WebGLRenderTarget(1, 1, {
      type: HalfFloatType,
      depthBuffer: true,
      depthTexture: new DepthTexture(1, 1, FloatType)
    })
    this.restore.uniforms.map.value = this.cache.texture
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
      this.renderPass.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest)
      this.copy(renderer, inputBuffer)
      this.cached = true
    } else {
      renderer.setRenderTarget(inputBuffer)
      renderer.render(this.scene, this.camera)
    }
    if (this.stochastic.length > 0) {
      const cameraLayers = this.stillCamera.layers.mask
      this.stillCamera.layers.set(SPRAY_LAYER)
      renderer.setRenderTarget(inputBuffer)
      renderer.render(this.stillScene, this.stillCamera)
      this.stillCamera.layers.mask = cameraLayers
    }
    this.stochastic.forEach((o, i) => (o.layers.mask = layers[i]))
  }

  /** Copy the (resolved) colour and depth of the first frame. */
  private copy(renderer: WebGLRenderer, source: WebGLRenderTarget): void {
    // renderer.render() has already resolved the multisampled source.
    renderer.setRenderTarget(this.cache)
    const gl = renderer.getContext() as WebGL2RenderingContext
    const props = renderer.properties
    const src = (props.get(source) as { __webglFramebuffer: WebGLFramebuffer }).__webglFramebuffer
    const dst = (props.get(this.cache) as { __webglFramebuffer: WebGLFramebuffer }).__webglFramebuffer
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst)
    const { width, height } = this.cache
    gl.blitFramebuffer(0, 0, width, height, 0, 0, width, height, gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, gl.NEAREST)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    renderer.setRenderTarget(null)
  }

  override setSize(width: number, height: number): void {
    this.renderPass.setSize(width, height)
    this.cache.setSize(width, height)
    this.cached = false
  }

  override dispose(): void {
    super.dispose()
    this.renderPass.dispose()
    this.cache.dispose()
  }
}
