import { beforeAll, describe, expect, it } from 'vitest'

import { loadScan, SCAN_IDS, scanVariant } from '../src/props/scans'
import { scanGeometry, type Scan } from '../src/props/scans/scan'
import bakesJson from '../scripts/asset-bakes.json'
import { expectMesh, triangles } from './mesh'

// NATURE_PLAN phase 11: baked scans (scripts/asset.mjs bake; src/props/scans).
// Each variant at each level of detail at its real size, base on y = 0, in
// budget (props ≤ ~5k triangles an instance); every scan's bake recorded so
// `asset.mjs replay` rebuilds it, with a licence the page may ship.

const bakes = bakesJson as { id: string; lods: { triangles: number }[] }[]
const scans = new Map<string, Scan>()
beforeAll(async () => {
  for (const id of SCAN_IDS) scans.set(id, await loadScan(id))
})

describe('baked scans', () => {
  it('each recorded in asset-bakes.json, under a licence we can ship', () => {
    for (const id of SCAN_IDS) {
      expect(bakes.some(b => b.id === id), id).toBe(true)
      expect(['CC0', 'CC-BY 4.0', 'CC BY 4.0'], id).toContain(scans.get(id)!.source.licence)
    }
  })

  for (const id of SCAN_IDS) {
    it(`${id}: every variant and level at its real size and in budget`, () => {
      const scan = scans.get(id)!
      const budget = bakes.find(b => b.id === id)!.lods.map(l => l.triangles)
      scan.variants.forEach((v, i) => {
        const [x, y, z] = scan.sizes[i]
        v.lods.forEach((_, lod) => {
          // The scan doesn't read a seed: the same mesh each time.
          expectMesh(() => scanGeometry(scan, i, lod).clone(), { base: [-0.002, 0.002], top: [y * 0.85, y + 0.002], width: x + 0.002, length: z + 0.002, maxTriangles: budget[lod], minTriangles: 100 })
        })
        // Coarser levels are coarser.
        for (let lod = 1; lod < v.lods.length; lod++) expect(triangles(scanGeometry(scan, i, lod))).toBeLessThan(triangles(scanGeometry(scan, i, lod - 1)))
      })
    })
  }

  it('decodes colours to linear, not black or clipped', async () => {
    const g = await scanVariant('ph_flower_ursinia', 0)
    const c = g.attributes.color.array as Float32Array
    let mean = 0
    for (let i = 0; i < c.length; i++) mean += c[i]
    mean /= c.length
    // Plant albedo: dark green leaves, orange flowers (Poly Haven's calibrated map).
    expect(mean).toBeGreaterThan(0.03)
    expect(mean).toBeLessThan(0.3)
    expect(Math.max(...c)).toBeLessThanOrEqual(1)
  })
})
