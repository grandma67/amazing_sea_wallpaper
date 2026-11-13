import type { BufferAttribute } from 'three'
import { describe, expect, it } from 'vitest'

import { marineGeometry } from '../src/props/marine'
import { pinniped, swimmingHead } from '../src/props/pinnipeds'
import { SKIN_IDS, skinCoords, skinTile } from '../src/props/skins'
import { crocodileGeometry, hippoGeometry, lizardGeometry, monkeyGeometry, turtleGeometry } from '../src/props/wildlife'
import { Random } from '../src/random'
import atlasUrl from '../public/assets/skins.png?inline'

describe('photo skins', () => {
  it('have one 256 px atlas layer per recipe (bake again after editing skins.json)', () => {
    const png = Uint8Array.from(atob(atlasUrl.split(',')[1]), c => c.charCodeAt(0))
    const header = new DataView(png.buffer)
    expect([header.getUint32(16), header.getUint32(20)]).toEqual([256, 256 * SKIN_IDS.length])
    expect(new Set(SKIN_IDS).size).toBe(SKIN_IDS.length)
  })

  it('fold both sides onto one v, with no seam at the back or belly', () => {
    const at = skinCoords('crocodile', skinTile('crocodile').length)
    for (const a of [0.3, 1.2, 2.5]) expect(at(0.5, a, 0.2, 1)[1]).toBeCloseTo(at(0.5, Math.PI * 2 - a, 0.2, 1)[1], 9)
    expect(at(0.5, 0, 0.2, 1)[1]).toBe(0)
    expect(at(0.5, Math.PI * 2, 0.2, 1)[1]).toBeCloseTo(0, 9)
  })

  it('tile at the photo scale on the photo animal, larger on a larger one', () => {
    const { tile, length } = skinTile('harbour-seal')
    expect(skinCoords('harbour-seal', length)(0, 0, 0.3, tile[0])[0]).toBeCloseTo(1, 9)
    expect(skinCoords('harbour-seal', length * 2)(0, 0, 0.3, tile[0])[0]).toBeCloseTo(0.5, 9)
  })

  it('give every seal, head, lizard, turtle, hippo, monkey and marine animal a skin only when asked', () => {
    expect(pinniped(new Random('s'), 'seal', 'lying', 0, false).getAttribute('skin')).toBeUndefined()
    for (const kind of ['seal', 'sea-lion', 'fur-seal', 'elephant-seal'] as const) {
      expect(pinniped(new Random('s'), kind, 'lying', 0, true).getAttribute('skin')).toBeDefined()
      expect(swimmingHead(new Random('s'), kind, 0.2, true).getAttribute('skin')).toBeDefined()
    }
    for (const kind of ['marine-iguana', 'green-iguana', 'monitor', 'spiny-tailed'] as const) {
      expect(lizardGeometry(new Random('l'), kind, false).getAttribute('skin')).toBeUndefined()
      expect(lizardGeometry(new Random('l'), kind, true).getAttribute('skin')).toBeDefined()
    }
    for (const species of ['green', 'loggerhead', 'hawksbill', 'olive-ridley', 'leatherback'] as const) {
      expect(turtleGeometry(new Random('t'), species, [0.6, 0.55, 0.45], 'adult', false).getAttribute('skin')).toBeUndefined()
      expect(turtleGeometry(new Random('t'), species, [0.6, 0.55, 0.45], 'adult', true).getAttribute('skin')).toBeDefined()
    }
    expect(hippoGeometry(new Random('h'), 0, true).getAttribute('skin')).toBeDefined()
    for (const kind of ['macaque', 'capuchin', 'vervet'] as const) expect(monkeyGeometry(new Random('m'), kind, 'sit', true).getAttribute('skin')).toBeDefined()
    for (const species of ['dolphin', 'orca', 'humpback', 'swordfish'] as const) {
      expect(marineGeometry(new Random('w'), species, false).getAttribute('skin')).toBeUndefined()
      expect(marineGeometry(new Random('w'), species, true).getAttribute('skin')).toBeDefined()
    }
    const skinned = pinniped(new Random('s'), 'seal', 'lying', 0, true)
    const plain = pinniped(new Random('s'), 'seal', 'lying', 0, false)
    const skin = skinned.getAttribute('skin') as BufferAttribute
    expect(skin.count).toBe(skinned.getAttribute('position').count)
    expect(Array.from(skin.array).every(Number.isFinite)).toBe(true)
    // Same shape: only the colours (no noise spots) and the attribute change.
    expect(Array.from(skinned.getAttribute('position').array)).toEqual(Array.from(plain.getAttribute('position').array))
  })

  it('leave the inside of an open mouth unskinned', () => {
    const croc = crocodileGeometry(new Random('c'), 'nile', 0.4, true)
    const skin = croc.getAttribute('skin') as BufferAttribute
    const color = croc.getAttribute('color') as BufferAttribute
    let mouth = 0
    for (let i = 0; i < skin.count; i++) {
      // The mouth colour [0.5, 0.42, 0.28] is only on the jaws' insides.
      if (Math.abs(color.getX(i) - 0.5) < 1e-6 && Math.abs(color.getY(i) - 0.42) < 1e-6) {
        mouth++
        expect(skin.getX(i)).toBe(0)
      }
    }
    expect(mouth).toBeGreaterThan(0)
  })
})
