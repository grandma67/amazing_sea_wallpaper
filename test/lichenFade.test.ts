import { ShaderLib, type WebGLProgramParametersWithUniforms, type WebGLRenderer } from 'three'
import { describe, expect, it } from 'vitest'

import { rockMaterial } from '../src/props/rocks'

// tasks.md D41: lichen spots (~0.2 m) aliased into white flecks on far sea
// stacks; they fade to their mean cover once a pixel spans a noise cell.
function compiled(fade?: boolean): WebGLProgramParametersWithUniforms {
  const growth = { moss: 0.5, mossColor: [0.2, 0.3, 0.1], lichen: 0.6, lichenColor: [0.5, 0.5, 0.42], algae: 0.5, algaeColor: [0.05, 0.08, 0.03] } as const
  const material = fade === undefined ? rockMaterial([1, 1, 1], 1, growth as never) : rockMaterial([1, 1, 1], 1, growth as never, 0, null, undefined, fade)
  const shader = {
    uniforms: {},
    vertexShader: ShaderLib.physical.vertexShader,
    fragmentShader: ShaderLib.physical.fragmentShader
  } as unknown as WebGLProgramParametersWithUniforms
  material.onBeforeCompile(shader, {} as WebGLRenderer)
  return shader
}

describe('lichen fade (passes.lichenFade)', () => {
  it('is on by default and off on request', () => {
    expect(compiled().uniforms.lichenFade.value).toBe(1)
    expect(compiled(true).uniforms.lichenFade.value).toBe(1)
    expect(compiled(false).uniforms.lichenFade.value).toBe(0)
  })

  it('fades by the pixel footprint to the measured mean cover', () => {
    const { fragmentShader } = compiled()
    expect(fragmentShader).toContain('fwidth(q * 5.5)')
    expect(fragmentShader).toContain('0.097')
    // Off: the old hard spots, unchanged.
    expect(fragmentShader).toContain('float spots = smoothstep(0.72, 0.78, lichenN);')
  })
})
