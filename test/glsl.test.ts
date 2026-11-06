/// <reference types="vite/client" />
import { ShaderChunk } from 'three'
import { describe, expect, it } from 'vitest'

// GLSL errors otherwise show only at render time (CLAUDE.md "After any shader
// edit"). A compiler needs a GPU; these are the mistakes that cost render rounds
// and can be read from the source: a reserved word used as a name (`flat`,
// `sample`, `filter`), brackets that don't close, an #include three doesn't have.

const SOURCES = import.meta.glob('../src/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

/** Everything tagged /* glsl *\/ in a TypeScript file, `${…}` taken out. */
function glslIn(source: string): string[] {
  const out: string[] = []
  const tag = /\/\*\s*glsl\s*\*\/\s*`/g
  while (tag.exec(source) != null) {
    let text = ''
    let i = tag.lastIndex
    while (source[i] !== '`') {
      if (source[i] === '$' && source[i + 1] === '{') {
        let depth = 1
        i += 2
        while (depth > 0) {
          if (source[i] === '{') depth++
          if (source[i] === '}') depth--
          i++
        }
        // Stands in for a name, a number or a whole block.
        text += '0'
        continue
      }
      text += source[i++]
    }
    out.push(text.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, ''))
  }
  return out
}

// GLSL ES 3.00 §3.8: keywords and words reserved for the future, as a variable
// or function name. (`flat`, `sample` and the like are the ones that look like names.)
const RESERVED = 'attribute varying coherent volatile restrict readonly writeonly resource atomic_uint noperspective patch sample subroutine common partition active asm class union enum typedef template this goto inline noinline public static extern external interface long short half fixed unsigned superp input output filter sizeof cast namespace using flat smooth centroid layout precision invariant'.split(' ')
const TYPE = '(?:float|double|int|uint|bool|void|[iub]?vec[234]|mat[234](?:x[234])?|sampler2D)'
const NAMED = new RegExp(`\\b${TYPE}\\s+(?:\\w+\\s*(?:=[^;,]*)?,\\s*)*(${RESERVED.join('|')})\\s*[=;,()\\[]`, 'g')

/** A reserved word used as a name. */
const reservedNames = (glsl: string): string[] => [...glsl.matchAll(NAMED)].map(m => m[1])

/** The first bracket that doesn't close, or null. */
function unbalanced(glsl: string): string | null {
  const close: Record<string, string> = { '(': ')', '[': ']', '{': '}' }
  const stack: string[] = []
  for (const c of glsl) {
    if (close[c] != null) stack.push(c)
    else if (Object.values(close).includes(c) && close[stack.pop() ?? ''] !== c) return c
  }
  return stack[0] ?? null
}

const includes = (glsl: string): string[] => [...glsl.matchAll(/#include\s+<(\w+)>/g)].map(m => m[1])
const SHADERS = Object.entries(SOURCES).flatMap(([file, source]) => glslIn(source).map((glsl, i) => ({ name: `${file.replace('../src/', '')} #${i + 1}`, glsl })))

describe('the checks themselves', () => {
  it('see a tagged shader, its interpolations and comments gone', () => {
    const source = 'const a = /* glsl */ `float x = ${b(1, { c: 2 })}; // flat\n/* sample */`'
    expect(glslIn(source)).toEqual(['float x = 0; \n '])
  })

  it.each([
    ['float flat = 1.0;', ['flat']],
    ['vec3 sample(vec2 uv) {', ['sample']],
    ['float a = 1.0, filter;', ['filter']],
    ['flat in float x;', []],
    ['float flatness = 1.0; float sampled;', []]
  ])('reserved names in: %s', (glsl, want) => expect(reservedNames(glsl)).toEqual(want))

  it.each([
    ['void main() { x[0] = (1.0); }', null],
    ['void main() { x = (1.0; }', '}'],
    ['void main() {', '{']
  ])('brackets in: %s', (glsl, want) => expect(unbalanced(glsl)).toBe(want))
})

describe('every shader in the source', () => {
  it('there are shaders to check', () => {
    expect(SHADERS.length).toBeGreaterThan(15)
  })

  it.each(SHADERS)('$name', ({ glsl }) => {
    expect(reservedNames(glsl), 'reserved words as names').toEqual([])
    expect(unbalanced(glsl), 'brackets that do not close').toBeNull()
    for (const name of includes(glsl)) expect(ShaderChunk, `#include <${name}>`).toHaveProperty(name)
  })
})
