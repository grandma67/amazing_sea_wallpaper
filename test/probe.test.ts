import { describe, expect, it } from 'vitest'

import { probeResult, stat } from '../src/probe'
import { darkZenithLuminance } from '../src/starLight'

// The pixel probe's arithmetic (the GPU reads are checked by rendering).

describe('pixel probe', () => {
  it('takes the mean and the brightest pixel', () => {
    const s = stat([0.1, 0.1, 0.1, 1, 0.3, 0.3, 0.3, 1, 0.2, 0.2, 0.2, 1, 0, 0, 0, 1])
    expect(s.mean[0]).toBeCloseTo(0.15, 9)
    expect(s.peak).toEqual([0.3, 0.3, 0.3])
  })

  it('undoes exposure and white balance, and reports cd/m² and mag/arcsec²', () => {
    const grade = { exposure: 2, whiteBalance: [0.5, 1, 2] as [number, number, number], cdPerUnit: 1000, darkZenithCd: darkZenithLuminance() }
    const exposed = { mean: [1, 2, 4] as [number, number, number], peak: [1, 2, 4] as [number, number, number] }
    const r = probeResult([0.5, 0.5], [10, 10], exposed, { mean: [1, 2, 3], peak: [1, 2, 3] }, grade)
    expect(r.raw!.mean).toEqual([1, 1, 1])
    expect(r.cdm2).toBeCloseTo(1000, 6)
    // A sky at the dark-zenith luminance reads 21.6 mag/arcsec².
    const dark = probeResult([0, 0], [0, 0], { mean: [1, 1, 1], peak: [1, 1, 1] }, { mean: [0, 0, 0], peak: [0, 0, 0] }, { ...grade, whiteBalance: [1, 1, 1], exposure: 1, cdPerUnit: darkZenithLuminance() })
    expect(dark.magArcsec2).toBeCloseTo(21.6, 2)
    expect(r.clipped).toBe(false)
    expect(probeResult({ az: 0, el: 90 }, null, null, null, grade)).toEqual({ at: { az: 0, el: 90 }, pixel: null })
  })
})
