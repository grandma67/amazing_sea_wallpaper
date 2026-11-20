/** A GitHub Actions workflow run, the fields ciDay.mjs reads. */
export interface Run {
  id: number
  event?: string
  created_at: string
  run_started_at?: string
  head_sha: string
  conclusion: string | null
  status?: string
}
export function runsForDay<R extends Run>(runs: R[] | undefined, date: string): R[]
export function publishedRun<R extends Run>(runs: R[]): R | null
export function summarise(json: unknown): Record<string, unknown>
