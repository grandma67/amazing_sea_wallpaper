import { describe, expect, it } from 'vitest'

import { renderCachePath, type RenderKey } from '../src/renderCache'

const key: RenderKey = { date: '2024-02-12', width: 1920, height: 1080, frames: 64, portrait: false, spec: null }

describe('render cache keys', () => {
  it('names the image by date and size, under rendered/', () => {
    expect(renderCachePath(key, 'abc')).toMatch(/^rendered\/2024-02-12-1920x1080-[0-9a-f]{8}\.jpg$/)
    expect(renderCachePath(key, 'abc')).toBe(renderCachePath({ ...key }, 'abc'))
  })

  it('differs for anything that changes the image', () => {
    const base = renderCachePath(key, 'abc')
    const variants = [
      renderCachePath(key, 'def'),
      renderCachePath({ ...key, date: '2024-02-13' }, 'abc'),
      renderCachePath({ ...key, width: 1280 }, 'abc'),
      renderCachePath({ ...key, frames: 16 }, 'abc'),
      renderCachePath({ ...key, portrait: true }, 'abc'),
      renderCachePath({ ...key, spec: '{"timeOfDay":"night"}' }, 'abc')
    ]
    expect(new Set([base, ...variants]).size).toBe(variants.length + 1)
  })
})
