import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Points, PointsMaterial, ShaderLib, ShaderMaterial, type IUniform, type Object3D, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three'
import { describe, expect, it } from 'vitest'

import { shadeMaterial, shadeProps } from '../src/propShade'

const uniforms: Record<string, IUniform> = { cloudShadeForce: { value: -1 } }
const renderer = {} as WebGLRenderer

function compiled(material: MeshStandardMaterial): WebGLProgramParametersWithUniforms {
  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.physical.vertexShader,
    fragmentShader: ShaderLib.physical.fragmentShader
  } as unknown as WebGLProgramParametersWithUniforms
  material.onBeforeCompile(shader, renderer)
  return shader
}

function prop(kind: string, ...objects: Object3D[]): Group {
  const group = new Group()
  group.userData.prop = kind
  group.add(...objects)
  return group
}

describe('shadeMaterial', () => {
  it("multiplies the directional light by the shade, in three's own light loop", () => {
    const material = new MeshStandardMaterial()
    shadeMaterial(material, uniforms, false)
    const { fragmentShader, vertexShader } = compiled(material)
    expect(fragmentShader).not.toContain('#include <lights_fragment_begin>')
    const sun = fragmentShader.indexOf('getDirectionalLightInfo( directionalLight, directLight );')
    expect(sun).toBeGreaterThan(-1)
    expect(fragmentShader.slice(sun)).toMatch(/^[^\n]*\n\s*directLight\.color \*= shadeHere;/)
    expect(fragmentShader).toContain('float propShade(vec3 world)')
    expect(vertexShader).toContain('vShadeWorld =')
  })

  it("takes the fine slice over from the sun's near map, on the sun alone", () => {
    const material = new MeshStandardMaterial()
    shadeMaterial(material, uniforms, false)
    const { fragmentShader } = compiled(material)
    // The replacement must find three's call, or the slice silently does nothing.
    expect(fragmentShader).toContain('mix( getShadow( directionalShadowMap[ i ]')
    expect(fragmentShader).toContain('UNROLLED_LOOP_INDEX == 0 ? fineSunWeight : 0.0')
    expect(fragmentShader.indexOf('float fineSunShadow')).toBeLessThan(fragmentShader.indexOf('#pragma unroll_loop_start'))
  })

  it('leaves other lights and sky light alone', () => {
    const material = new MeshStandardMaterial()
    shadeMaterial(material, uniforms, false)
    expect(compiled(material).fragmentShader.match(/\*= shadeHere/g)).toHaveLength(1)
  })

  it('keeps a material\'s own patch, and its own program', () => {
    const own = new MeshStandardMaterial()
    own.onBeforeCompile = shader => {
      shader.fragmentShader += '// own patch'
    }
    const plain = new MeshStandardMaterial()
    shadeMaterial(own, uniforms, false)
    shadeMaterial(plain, uniforms, false)
    expect(compiled(own).fragmentShader).toContain('// own patch')
    expect(own.customProgramCacheKey()).not.toBe(plain.customProgramCacheKey())
  })

  it('hands every material the same uniforms, so binding them once reaches all', () => {
    const material = new MeshStandardMaterial()
    shadeMaterial(material, uniforms, false)
    expect(compiled(material).uniforms.cloudShadeForce).toBe(uniforms.cloudShadeForce)
  })
})

describe('shadeProps', () => {
  it('covers every lit object, once per shared material', () => {
    const shared = new MeshStandardMaterial()
    const key = shared.customProgramCacheKey()
    const a = new Mesh(undefined, shared)
    a.castShadow = true
    a.receiveShadow = true
    const coverage = shadeProps(prop('rocks', a, new Mesh(undefined, shared)), uniforms)
    expect(coverage.rocks).toMatchObject({ lit: 2, shaded: 2, casts: 1, receives: 1 })
    expect(shared.customProgramCacheKey()).toBe(`${key}|shade`)
  })

  it('counts unlit objects apart: the sun never reached them', () => {
    const coverage = shadeProps(prop('lamps', new Mesh(undefined, new MeshBasicMaterial()), new Points(undefined, new PointsMaterial())), uniforms)
    expect(coverage.lamps).toMatchObject({ lit: 0, unlit: 2 })
  })

  it('leaves clouds out: they stand in the deck that casts the shade', () => {
    const material = new MeshStandardMaterial()
    const key = material.customProgramCacheKey()
    const coverage = shadeProps(prop('shelf-cloud', new Mesh(undefined, material)), uniforms)
    expect(coverage['shelf-cloud']).toMatchObject({ lit: 0, clouds: 1 })
    expect(material.customProgramCacheKey()).toBe(key)
  })

  it('reaches spray through its own shader', () => {
    const material = new ShaderMaterial({ vertexShader: 'void main() { vec4 world = vec4(0.0); vShade = 1.0; }', uniforms: {} })
    const spray = new Points(undefined, material)
    spray.userData.spray = true
    const coverage = shadeProps(prop('surf', spray), uniforms)
    expect(coverage.surf).toMatchObject({ spray: 1, lit: 0 })
    expect(material.vertexShader).toContain('vShade = propShade(world.xyz);')
    expect(material.uniforms.cloudShadeForce).toBe(uniforms.cloudShadeForce)
  })
})
