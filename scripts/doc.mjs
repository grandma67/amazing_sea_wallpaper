// Read the knowledge docs by section and search them across wrapped lines, so
// nobody reads a 400-line doc for one section or guesses Read offsets.
//
//   node scripts/doc.mjs FILE "heading words"   print the section(s) whose heading has all the
//                                                words (any case), to the next heading of the
//                                                same or a higher level
//   node scripts/doc.mjs --toc FILE [FILE…]     the headings, with line and line count
//   node scripts/doc.mjs --grep "phrase" [FILE|DIR…] [--max N]
//                                                each paragraph, bullet or table row with the
//                                                phrase, whole, under its heading path; the
//                                                phrase may span wrapped lines (whitespace and
//                                                case are ignored). Default: knowledge/ and
//                                                CLAUDE.md; --max (default 40) caps the blocks
//
// FILE may skip `knowledge/` and `.md`: `doc.mjs arch/COAST tides`. Headings inside code
// fences don't count. Made after the docs grew to ~8k lines read with offset/limit.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

const FENCE = /^\s*(```|~~~)/
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/

/** Headings outside code fences: { level, title, line (0-based), end (exclusive) }. */
export function headings(text) {
  const lines = text.split('\n')
  const out = []
  let fenced = false
  lines.forEach((l, i) => {
    if (FENCE.test(l)) fenced = !fenced
    else if (!fenced) {
      const m = HEADING.exec(l)
      if (m) out.push({ level: m[1].length, title: m[2], line: i, end: lines.length })
    }
  })
  out.forEach((h, k) => {
    const next = out.slice(k + 1).find(n => n.level <= h.level)
    if (next) h.end = next.line
  })
  return out
}

const norm = s => s.toLowerCase().replace(/[`*_]/g, '')

/**
 * Sections whose heading has every word of `query`: { heading, text }. A match
 * that holds another match is dropped ("tides" in a file titled "…, tides, reefs"
 * gives the Tides section, not the whole file).
 */
export function sections(text, query) {
  const words = norm(query).split(/\s+/).filter(Boolean)
  const lines = text.split('\n')
  const hits = headings(text).filter(h => words.every(w => norm(h.title).includes(w)))
  return hits
    .filter(h => !hits.some(o => o !== h && o.line > h.line && o.line < h.end))
    .map(h => ({ heading: h, text: lines.slice(h.line, h.end).join('\n').trimEnd() }))
}

/**
 * Blocks a search returns whole: a paragraph, a list item with its indented
 * continuation, a table row, a code fence, a heading. { line (0-based), lines, path }.
 */
export function blocks(text) {
  const lines = text.split('\n')
  const out = []
  const path = []
  let cur = null
  const close = () => { if (cur) out.push(cur); cur = null }
  const open = i => { close(); cur = { line: i, lines: [lines[i]], path: path.map(p => p.title) } }
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]
    if (FENCE.test(l)) {
      open(i)
      while (++i < lines.length) { cur.lines.push(lines[i]); if (FENCE.test(lines[i])) break }
      close()
      continue
    }
    const h = HEADING.exec(l)
    if (h) {
      close()
      while (path.length && path[path.length - 1].level >= h[1].length) path.pop()
      path.push({ level: h[1].length, title: h[2] })
      out.push({ line: i, lines: [l], path: path.map(p => p.title) })
    } else if (!l.trim()) close()
    else if (/^\s*\|/.test(l)) { open(i); close() }
    else if (/^\s*([-*+]|\d+[.)])\s/.test(l)) {
      // A nested item starts its own block; a continuation line is indented past the marker.
      open(i)
    } else if (cur) cur.lines.push(l)
    else open(i)
  }
  close()
  return out
}

const squash = s => s.toLowerCase().replace(/\s+/g, ' ')

/** Blocks containing `phrase` (case and whitespace ignored, across wrapped lines). */
export function grepBlocks(text, phrase) {
  const p = squash(phrase).trim()
  return blocks(text).filter(b => squash(b.lines.join(' ')).includes(p))
}

function resolve(f) {
  for (const c of [f, `${f}.md`, join('knowledge', f), join('knowledge', `${f}.md`)]) {
    const abs = join(ROOT, c)
    if (existsSync(abs)) return abs
  }
  throw new Error(`doc.mjs: no such doc: ${f}`)
}

function mdFiles(abs) {
  if (!statSync(abs).isDirectory()) return [abs]
  return readdirSync(abs, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(e => (e.isDirectory() ? mdFiles(join(abs, e.name)) : e.name.endsWith('.md') ? [join(abs, e.name)] : []))
}

function main(argv) {
  const rel = abs => relative(ROOT, abs)
  if (!argv.length || argv[0] === '--help') {
    console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\nimport')[0].replace(/^\/\/ ?/gm, ''))
    return 0
  }
  if (argv[0] === '--toc') {
    for (const f of argv.slice(1).map(resolve)) {
      console.log(rel(f))
      for (const h of headings(readFileSync(f, 'utf8')))
        console.log(`${String(h.line + 1).padStart(5)}  ${'  '.repeat(h.level - 1)}${h.title}  (${h.end - h.line})`)
    }
    return 0
  }
  if (argv[0] === '--grep') {
    const rest = argv.slice(1)
    const mi = rest.indexOf('--max')
    const max = mi >= 0 ? Number(rest.splice(mi, 2)[1]) : 40
    const [phrase, ...targets] = rest
    if (!phrase) throw new Error('doc.mjs --grep: give a phrase')
    const files = (targets.length ? targets : ['knowledge', 'CLAUDE.md']).map(resolve).flatMap(mdFiles)
    let shown = 0
    let total = 0
    for (const f of files) {
      for (const b of grepBlocks(readFileSync(f, 'utf8'), phrase)) {
        total++
        if (shown >= max) continue
        shown++
        console.log(`${rel(f)}:${b.line + 1}  § ${b.path.join(' › ') || '(top)'}`)
        console.log(b.lines.join('\n') + '\n')
      }
    }
    if (!total) console.log(`no block has "${phrase}"`)
    else if (total > shown) console.log(`… ${total - shown} more blocks (--max ${total}, or name a file)`)
    return 0
  }
  const [file, ...q] = argv
  const abs = resolve(file)
  const text = readFileSync(abs, 'utf8')
  const found = sections(text, q.join(' '))
  if (!found.length) {
    console.log(`no heading in ${rel(abs)} has "${q.join(' ')}"; headings:`)
    for (const h of headings(text)) console.log(`  ${'#'.repeat(h.level)} ${h.title}`)
    return 1
  }
  for (const s of found) console.log(`${rel(abs)}:${s.heading.line + 1}\n${s.text}\n`)
  return 0
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    process.exitCode = main(process.argv.slice(2))
  } catch (e) {
    console.error(e.message)
    process.exitCode = 2
  }
}
