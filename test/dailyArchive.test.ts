import { describe, expect, it } from 'vitest'

import { mergeIndex, siteOf } from '../scripts/ci/dailyArchive.mjs'

// The site's daily/index.json (pages.yml): what a bad day's numbers can be read from later.

const entry = (date: string) => ({ date, title: date, sha: null, run: null })

describe('daily archive', () => {
  it('puts today on top, one per date, newest first, at most keep', () => {
    const old = [entry('2026-11-17'), entry('2026-11-18'), entry('2026-11-16')]
    expect(mergeIndex(old, entry('2026-11-19'), 3, '2026-11-19').map(e => e.date)).toEqual(['2026-11-19', '2026-11-18', '2026-11-17'])
  })

  it('replaces today on a second deploy that day (a push re-renders it)', () => {
    const old = [{ ...entry('2026-11-19'), title: 'first' }]
    expect(mergeIndex(old, { ...entry('2026-11-19'), title: 'second' }, 60, '2026-11-19')).toEqual([{ ...entry('2026-11-19'), title: 'second' }])
  })

  it('keeps the archive when today failed, and starts one from nothing', () => {
    expect(mergeIndex([entry('2026-11-18')], null, 60, '2026-11-19').map(e => e.date)).toEqual(['2026-11-18'])
    expect(mergeIndex(null, entry('2026-11-19'), 60, '2026-11-19').map(e => e.date)).toEqual(['2026-11-19'])
    // Junk and future dates are dropped.
    expect(mergeIndex([null, { title: 'x' }, entry('2027-01-01')], null, 60, '2026-11-19')).toEqual([])
  })

  it('finds the Pages URL from the repository', () => {
    expect(siteOf('Owner/amazing_sea_wallpaper')).toBe('https://owner.github.io/amazing_sea_wallpaper/')
    expect(siteOf(undefined)).toBeNull()
  })
})
