import { Pass } from 'postprocessing'
import {
  FloatType,
  ShaderMaterial,
  Uniform,
  WebGLRenderTarget,
  type Texture,
  type WebGLRenderer
} from 'three'

// Averages the image over many frames. Stochastic effects (the volumetric
// clouds' blue-noise ray marching) produce different noise every frame, so a
// running mean converges to a clean still image.

const vertexShader = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`

export class AccumulatePass extends Pass {
  private count = 0
  private read: WebGLRenderTarget
  private write: WebGLRenderTarget
  private readonly blend = new ShaderMaterial({
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D current;
      uniform sampler2D previous;
      uniform float weight;
      varying vec2 vUv;
      void main() {
        gl_FragColor = mix(texture2D(previous, vUv), texture2D(current, vUv), weight);
      }
    `,
    uniforms: {
      current: new Uniform<Texture | null>(null),
      previous: new Uniform<Texture | null>(null),
      weight: new Uniform(1)
    },
    depthTest: false,
    depthWrite: false
  })
  private readonly copy = new ShaderMaterial({
    vertexShader,
    fragmentShader: /* glsl */ `
      uniform sampler2D map;
      varying vec2 vUv;
      void main() {
        gl_FragColor = texture2D(map, vUv);
      }
    `,
    uniforms: { map: new Uniform<Texture | null>(null) },
    depthTest: false,
    depthWrite: false
  })

  constructor() {
    super('AccumulatePass')
    this.read = new WebGLRenderTarget(1, 1, { type: FloatType, depthBuffer: false })
    this.write = this.read.clone()
    // Writes the running mean into the output buffer for the next pass.
    this.needsSwap = true
  }

  override render(
    renderer: WebGLRenderer,
    inputBuffer: WebGLRenderTarget,
    outputBuffer: WebGLRenderTarget | null
  ): void {
    this.blend.uniforms.current.value = inputBuffer.texture
    this.blend.uniforms.previous.value = this.read.texture
    this.blend.uniforms.weight.value = 1 / (this.count + 1)
    this.fullscreenMaterial = this.blend
    renderer.setRenderTarget(this.write)
    renderer.render(this.scene, this.camera)
    ;[this.read, this.write] = [this.write, this.read]
    this.count++

    this.copy.uniforms.map.value = this.read.texture
    this.fullscreenMaterial = this.copy
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer)
    renderer.render(this.scene, this.camera)
  }

  override setSize(width: number, height: number): void {
    this.read.setSize(width, height)
    this.write.setSize(width, height)
  }

  override dispose(): void {
    super.dispose()
    this.read.dispose()
    this.write.dispose()
    this.blend.dispose()
    this.copy.dispose()
  }
}
