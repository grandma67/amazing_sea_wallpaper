import { describe, expect, it } from 'vitest'

import { isRealDate, localDateString, resolveDate, shiftDate } from '../src/dates'

describe('dates', () => {
  it('formats local dates with zero padding', () => {
    expect(localDateString(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })

  it('shifts across month, year and leap-day boundaries', () => {
    expect(shiftDate('2026-10-31', 1)).toBe('2026-11-01')
    expect(shiftDate('2027-01-01', -1)).toBe('2026-12-31')
    expect(shiftDate('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDate('2027-02-28', 1)).toBe('2027-03-01')
  })

  it('shifts across daylight-saving changes without skipping a day', () => {
    let d = '2026-01-01'
    for (let i = 0; i < 365; i++) {
      const next = shiftDate(d, 1)
      expect(shiftDate(next, -1)).toBe(d)
      expect(next > d).toBe(true)
      d = next
    }
    expect(d).toBe('2027-01-01')
  })

  it('shows today for missing, malformed and future dates', () => {
    const today = '2026-10-15'
    expect(resolveDate(null, today, false)).toBe(today)
    expect(resolveDate('15/10/2026', today, false)).toBe(today)
    expect(resolveDate('2026-10-16', today, false)).toBe(today)
    expect(resolveDate('2026-10-14', today, false)).toBe('2026-10-14')
    expect(resolveDate('2026-10-15', today, false)).toBe(today)
  })

  it('shows today for days that are not on the calendar', () => {
    const today = '2026-10-15'
    for (const bad of ['2026-10-32', '2024-13-14', '2026-00-10', '2026-10-00', '2026-02-30', '2027-02-29', '2100-02-29']) {
      expect(isRealDate(bad), bad).toBe(false)
      expect(resolveDate(bad, today, true), bad).toBe(today)
    }
    for (const good of ['2028-02-29', '2000-02-29', '2026-12-31', '2026-01-01']) expect(isRealDate(good), good).toBe(true)
    expect(resolveDate('2024-02-29', today, false)).toBe('2024-02-29')
  })

  it('allows future dates when asked to', () => {
    expect(resolveDate('2030-01-01', '2026-10-15', true)).toBe('2030-01-01')
  })
})
