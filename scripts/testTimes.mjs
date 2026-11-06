// Where the tests' time goes: `npm run test:times [-- --top 20]`. Prints the run's
// wall time, then the slowest files and tests. Before making a test faster read
// knowledge/TOOLS.md "Tests" (usually an expect per item, or a build done twice).

import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'

import { parseArgs } from './lib.mjs'

const { option, rejectUnknown } = parseArgs()
const top = Number(option('top', 15))
rejectUnknown()

const dir = mkdtempSync(join(tmpdir(), 'test-times-'))
const report = join(dir, 'report.json')
const start = performance.now()
spawnSync('npx', ['vitest', 'run', '--reporter=json', `--outputFile=${report}`], { stdio: 'ignore' })
const wall = performance.now() - start
const { testResults, numTotalTests, numFailedTests } = JSON.parse(readFileSync(report, 'utf8'))
rmSync(dir, { recursive: true })

const ms = v => `${Math.round(v)}`.padStart(7)
const files = testResults.map(f => ({ name: basename(f.name), time: f.assertionResults.reduce((s, t) => s + (t.duration ?? 0), 0), tests: f.assertionResults.length }))
const tests = testResults.flatMap(f => f.assertionResults.map(t => ({ name: `${basename(f.name)} > ${t.title}`, time: t.duration ?? 0 })))
const total = files.reduce((s, f) => s + f.time, 0)

console.log(`${numTotalTests} tests in ${files.length} files, ${numFailedTests} failed`)
console.log(`wall ${(wall / 1000).toFixed(1)} s; tests add up to ${(total / 1000).toFixed(1)} s over the workers\n`)
console.log('    ms   tests  file')
for (const f of files.sort((a, b) => b.time - a.time).slice(0, top)) console.log(`${ms(f.time)} ${String(f.tests).padStart(6)}  ${f.name}`)
console.log('\n    ms  test')
for (const t of tests.sort((a, b) => b.time - a.time).slice(0, top)) console.log(`${ms(t.time)}  ${t.name.slice(0, 110)}`)
