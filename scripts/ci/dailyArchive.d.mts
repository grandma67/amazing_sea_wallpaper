/** One archived day (see dailyArchive.mjs). */
export interface DailyEntry {
  date: string
  title: string | null
  sha: string | null
  run: string | null
}
export const SIZES: string[]
export function mergeIndex(old: unknown, todayEntry: DailyEntry | null, keep: number, today: string): DailyEntry[]
export function siteOf(repository: string | undefined): string | null
