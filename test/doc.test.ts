import { describe, expect, it } from 'vitest'

import { blocks, grepBlocks, headings, sections } from '../scripts/doc.mjs'

// doc.mjs reads the knowledge docs by section and searches across wrapped
// lines: a missed hit or a cut section sends the reader back to offsets.

const DOC = [
  '# Coast',
  'Intro line.',
  '',
  '## Coordinates and heights',
  'The camera stands at s = −distanceToWater; a',
  'flat blue sea is far.',
  '',
  '- **First rule**: wraps onto',
  '  the next line.',
  '  - nested item',
  '',
  '```sh',
  '# not a heading',
  '```',
  '',
  '### Tide stages',
  '| a | b |',
  '## Tides (`tides.ts`)',
  'Ebb and flow.'
].join('\n')

describe('doc.mjs', () => {
  it('finds headings outside code fences, each ending at the next of its level or higher', () => {
    const h = headings(DOC)
    expect(h.map(x => x.title)).toEqual(['Coast', 'Coordinates and heights', 'Tide stages', 'Tides (`tides.ts`)'])
    expect(h.map(x => [x.line, x.end])).toEqual([[0, 19], [3, 17], [15, 17], [17, 19]])
  })

  it('returns a section by heading words, any case, ignoring backticks', () => {
    const [s] = sections(DOC, 'coordinates HEIGHTS')
    expect(s.text.split('\n')[0]).toBe('## Coordinates and heights')
    expect(s.text).toContain('### Tide stages')
    expect(s.text).not.toContain('Ebb and flow')
    expect(sections(DOC, 'tides.ts').map(x => x.heading.line)).toEqual([17])
    expect(sections(DOC, 'nothing here')).toEqual([])
    // "co" is in "Coast" and in "Coordinates": the inner section wins, not the whole file.
    expect(sections(DOC, 'co').map(x => x.heading.title)).toEqual(['Coordinates and heights'])
  })

  it('finds a phrase split across wrapped lines and returns its whole block with the heading path', () => {
    const [b] = grepBlocks(DOC, 'a  Flat blue')
    expect(b.line).toBe(4)
    expect(b.lines).toHaveLength(2)
    expect(b.path).toEqual(['Coast', 'Coordinates and heights'])
    const [item] = grepBlocks(DOC, 'wraps onto the next')
    expect(item.lines).toEqual(['- **First rule**: wraps onto', '  the next line.'])
  })

  it('keeps code fences whole and table rows apart', () => {
    const fence = blocks(DOC).find(b => b.lines[0].startsWith('```'))
    expect(fence?.lines).toHaveLength(3)
    expect(grepBlocks(DOC, '| a | b |')[0].path.at(-1)).toBe('Tide stages')
  })
})
