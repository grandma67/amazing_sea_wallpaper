import {
  FloatType,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector4,
  WebGLRenderTarget,
  type Texture,
  type WebGLCubeRenderTarget,
  type WebGLRenderer
} from 'three'

// How much light the sky sends to a level surface, measured from the sky cube.
// The sea and terrain take their skylight from the clear atmosphere; clouds
// scatter the sun's light down as well, far more of it and whiter. Comparing
// the cube before and after its clouds are drawn gives that for whatever clouds
// today has, in the light that the standard-material props already get from it.

type RGB = [number, number, number]

const SAMPLES = 256
// A blurred level of the 256² cube: bright cloud edges average out.
const LOD = 4

/** Cosine-weighted irradiance on a level surface, in the cube's units. */
export function measureSkylight(renderer: WebGLRenderer, cube: WebGLCubeRenderTarget): RGB {
  const material = new ShaderMaterial({
    uniforms: { sky: { value: cube.texture as Texture } },
    vertexShader: /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform samplerCube sky;
      void main() {
        vec3 sum = vec3(0.0);
        for (int i = 0; i < ${SAMPLES}; i++) {
          // Fibonacci spiral, uniform on the disc: projected up to the
          // hemisphere that is the cosine weighting.
          float r2 = (float(i) + 0.5) / ${SAMPLES}.0;
          float phi = float(i) * 2.399963;
          float r = sqrt(r2);
          sum += textureLod(sky, vec3(r * cos(phi), sqrt(1.0 - r2), r * sin(phi)), ${LOD}.0).rgb;
        }
        gl_FragColor = vec4(sum * 3.14159265 / ${SAMPLES}.0, 1.0);
      }`,
    depthTest: false,
    depthWrite: false
  })
  const quad = new Mesh(new PlaneGeometry(2, 2), material)
  quad.frustumCulled = false
  const scene = new Scene()
  scene.add(quad)
  const target = new WebGLRenderTarget(1, 1, { type: FloatType })
  renderer.setRenderTarget(target)
  renderer.render(scene, new OrthographicCamera())
  const pixel = new Float32Array(4)
  renderer.readRenderTargetPixels(target, 0, 0, 1, 1, pixel)
  renderer.setRenderTarget(null)
  target.dispose()
  quad.geometry.dispose()
  material.dispose()
  return [pixel[0], pixel[1], pixel[2]]
}

/** What the clouds do to the skylight, per channel. Without a usable clear
 * reading (no light to compare), nothing. */
export function cloudSkylightRatio(clear: RGB, cloudy: RGB): RGB {
  return clear.map((c, i) => {
    const ratio = cloudy[i] / c
    return c > 1e-9 && Number.isFinite(ratio) ? ratio : 1
  }) as RGB
}

/** GLSL: the share of the sky a point on the ground sees past the tree crowns
 * near the camera (props/skyOcclusion.ts skyOpenField), 1 outside the map. */
export const SKY_OPEN_GLSL = /* glsl */ `
uniform sampler2D skyOpenMap;
uniform vec4 skyOpenRect;
float skyOpen(vec3 world) {
  if (skyOpenRect.z <= 0.0) return 1.0;
  return texture2D(skyOpenMap, (world.xz - skyOpenRect.xy) * skyOpenRect.zw).r;
}
`

/** The uniforms of SKY_OPEN_GLSL; rect z = 0 means no map. */
export function skyOpenUniforms(): Record<string, { value: unknown }> {
  return { skyOpenMap: { value: null as Texture | null }, skyOpenRect: { value: new Vector4(0, 0, 0, 0) } }
}
