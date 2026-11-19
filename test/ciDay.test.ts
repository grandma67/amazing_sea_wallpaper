import { describe, expect, it } from 'vitest'

import { publishedRun, runsForDay, summarise } from '../scripts/ciDay.mjs'

// scripts/ciDay.mjs: which Pages run made a day's picture (tools/RENDER.md "Broken frames").

const run = (id: number, at: string, conclusion: string | null) => ({ id, created_at: at, run_started_at: at, head_sha: `sha${id}`, conclusion })

describe('ciDay', () => {
  it('keeps the runs that started on the date (UTC), oldest first', () => {
    const runs = [run(3, '2026-11-17T21:00:00Z', 'success'), run(1, '2026-11-16T23:59:00Z', 'success'), run(2, '2026-11-17T07:42:51Z', 'success')]
    expect(runsForDay(runs, '2026-11-17').map(r => r.id)).toEqual([2, 3])
    expect(runsForDay(undefined, '2026-11-17')).toEqual([])
  })

  it('names the last successful run as what the site served at the day end', () => {
    expect(publishedRun([run(2, '2026-11-17T07:00:00Z', 'success'), run(3, '2026-11-17T21:00:00Z', 'failure')])?.id).toBe(2)
    expect(publishedRun([run(2, '2026-11-17T07:00:00Z', 'success'), run(3, '2026-11-17T21:00:00Z', 'success')])?.id).toBe(3)
    expect(publishedRun([run(3, '2026-11-17T21:00:00Z', 'cancelled')])).toBeNull()
  })

  it('summarises the numbers that tell a broken render', () => {
    const s = summarise({ title: 't', sunElevationDeg: -0.33, weather: { kind: 'overcast', formations: ['stratus'] }, debug: { frameMedian: 40, cubeSkylight: [null, null, null] } })
    expect(s).toMatchObject({ title: 't', weather: 'overcast stratus', frameMedian: 40, cubeSkylight: [null, null, null] })
    expect(summarise(null).title).toBeUndefined()
  })
})
