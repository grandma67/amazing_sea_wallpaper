// Show the user a before/after: labelled side-by-side crops (left before,
// right after) and, with --full, the two full frames, collected in one folder
// and opened in Preview. Made after a session where three fixes were committed
// before the user saw one (lessons/PROCESS.md): showing must be one command.
//
//   node scripts/show.mjs --from DIR --name NAME --label TEXT
//        [--crop X,Y,W,H | --zoom-at X,Y [--zoom N]] [--full] [--to out/show] [--no-open]
//
// --from     a diff.mjs output folder (DIR/off = before, DIR/on = after), or
//            --before DIR --after DIR for any two folders of renders
// --name     the render's name (NAME.jpg in both)
// --label    what to look at, in a few words: it becomes the file name
//            (NN-<label>-left-before-right-after.jpg), so it shows in Preview
// --crop / --zoom-at / --zoom   passed to diff.mjs (full-frame pixels); without
//            them the changed box diff.mjs finds
// --full     also NN-<label>-full-before.jpg and -full-after.jpg (arrow keys flip)
// --to       the folder to collect into (default out/show); NN counts up
// --no-open  don't open Preview (CI, or several calls before one open)
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { parseArgs } from './lib.mjs'

const { option, flag, rejectUnknown } = parseArgs()
const from = option('from')
const before = option('before') ?? (from != null ? join(from, 'off') : null)
const after = option('after') ?? (from != null ? join(from, 'on') : null)
const name = option('name')
const label = option('label')
const crop = option('crop')
const zoomAt = option('zoom-at')
const zoom = option('zoom')
const full = flag('full')
const to = option('to') ?? 'out/show'
const noOpen = flag('no-open')
rejectUnknown()
if (before == null || after == null || name == null || label == null) {
  throw new Error('give --from DIR (or --before DIR --after DIR), --name NAME and --label TEXT')
}
for (const dir of [before, after]) {
  if (!existsSync(join(dir, `${name}.jpg`))) throw new Error(`no ${name}.jpg in ${dir}`)
}

mkdirSync(to, { recursive: true })
const n = readdirSync(to).filter(f => /^\d\d-/.test(f)).map(f => Number(f.slice(0, 2)))
const nn = String((n.length > 0 ? Math.max(...n) : 0) + 1).padStart(2, '0')
const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const tmp = join(to, '.diff')
const diffArgs = ['scripts/diff.mjs', '--a', before, '--b', after, '--match', `^${name}$`, '--out', tmp]
if (crop != null) diffArgs.push('--crop', crop)
if (zoomAt != null) diffArgs.push('--zoom-at', zoomAt)
if (zoom != null) diffArgs.push('--zoom', zoom)
const out = execFileSync('node', diffArgs, { encoding: 'utf8' })
const line = out.split('\n').find(l => l.startsWith(`${name}:`))

const made = []
const side = join(to, `${nn}-${slug}-left-before-right-after.jpg`)
copyFileSync(join(tmp, `${name}.crop.jpg`), side)
made.push(side)
if (full) {
  for (const [dir, tag] of [[before, 'before'], [after, 'after']]) {
    const file = join(to, `${nn}-${slug}-full-${tag}.jpg`)
    copyFileSync(join(dir, `${name}.jpg`), file)
    made.push(file)
  }
}
console.log(line ?? `${name}: (no diff line)`)
for (const file of made) console.log(`  ${file}`)
if (!noOpen && process.platform === 'darwin') execFileSync('open', ['-a', 'Preview', ...made])
