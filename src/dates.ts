// Calendar days as YYYY-MM-DD strings in the viewer's local time. ISO dates
// compare correctly as strings.

export function localDateString(d: Date): string {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return localDateString(d)
}

/** A YYYY-MM-DD day that exists on the calendar (not 2026-10-32, 2024-13-14
 * or 2027-02-29): formatting the parsed day gives the same string back. */
export function isRealDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && localDateString(new Date(`${s}T12:00:00`)) === s
}

/** The day to show for a ?date= value: today when it's missing, malformed or not a real day,
 * and (unless future days are allowed) when it hasn't happened yet —
 * tomorrow's sea isn't out yet. */
export function resolveDate(requested: string | null, today: string, allowFuture: boolean): string {
  const date = requested != null && isRealDate(requested) ? requested : today
  return date > today && !allowFuture ? today : date
}
