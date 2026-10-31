// How often each animal is chosen over the test days, as the markdown table
// for ANIMALS.md: of all days, then per biome and per ocean. Counts choices
// (params.ts, props/choices.ts), not what lands in frame.
//
//   node scripts/animals.mjs

import { createServer } from 'vite'

import { TEST_DAYS } from './lib.mjs'


/** Every animal a day can have, as "group: kind" labels. */
function animals(p) {
  const out = []
  const { gulls, marine, migratory, wildlife: w, shoreLife: s } = p.props
  if (gulls != null) out.push(`Gulls: ${gulls}`)
  if (marine != null) out.push(`Marine: ${marine}`)
  if (migratory != null) out.push(`Migratory birds: ${migratory}`)
  if (p.colony != null) out.push(`Seabird colony: ${p.colony.kind} (${p.colony.site})`)
  if (p.pinnipeds != null) out.push(`Seals: ${p.pinnipeds.kind} (${p.pinnipeds.site})`)
  if (w?.turtle != null) out.push(`Sea turtle: ${w.turtle}`)
  if (w?.monkey != null) out.push(`Monkeys: ${w.monkey}`)
  if (w?.lizard != null) out.push(`Lizards: ${w.lizard}`)
  if (w?.crocodile != null) out.push(`Crocodile: ${w.crocodile}`)
  if ((w?.hippos ?? 0) > 0) out.push('Hippos: hippo')
  if (s?.crab != null && s.crabs > 0) out.push(`Crabs: ${s.crab}`)
  if ((s?.starfish ?? 0) > 0) out.push('Starfish: starfish')
  return out
}

const pct = (n, d) => (d === 0 || n === 0 ? '–' : `${((100 * n) / d).toFixed(n / d < 0.01 ? 1 : 0)}%`)

const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' })
try {
  const { generateParams } = await server.ssrLoadModule('/src/params.ts')
  const { propChoices } = await server.ssrLoadModule('/src/props/choices.ts')
  const days = TEST_DAYS.map(date => generateParams(date))
    .map(p => ({ ...p, props: propChoices(p) }))
  const biomes = ['nordic', 'mediterranean', 'volcanic', 'desert', 'tropical']
  const oceans = ['atlantic', 'pacific', 'indian', 'arctic', 'southern']
  const count = new Map()
  const bump = (label, key) => {
    const row = count.get(label) ?? new Map()
    row.set(key, (row.get(key) ?? 0) + 1)
    count.set(label, row)
  }
  const total = { all: days.length }
  for (const p of days) {
    for (const key of [p.biome.name, p.sea.ocean]) total[key] = (total[key] ?? 0) + 1
    for (const label of animals(p)) for (const key of ['all', p.biome.name, p.sea.ocean]) bump(label, key)
  }
  console.log(`${days.length} days (2024-01-01 … ${days.at(-1).date}).\n`)
  console.log(`| Animal | All days | ${biomes.join(' | ')} | ${oceans.join(' | ')} |`)
  console.log(`|---|---|${biomes.map(() => '---').join('|')}|${oceans.map(() => '---').join('|')}|`)
  for (const label of [...count.keys()].sort()) {
    const row = count.get(label)
    const cells = ['all', ...biomes, ...oceans].map(k => pct(row.get(k) ?? 0, total[k] ?? 0))
    console.log(`| ${label} | ${cells.join(' | ')} |`)
  }
  console.log(`\nDays per biome: ${biomes.map(b => `${b} ${total[b] ?? 0}`).join(', ')}; per ocean: ${oceans.map(o => `${o} ${total[o] ?? 0}`).join(', ')}.`)
} finally {
  await server.close()
}
