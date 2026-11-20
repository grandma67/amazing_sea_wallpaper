// Mean sRGB of image rows or columns: for a reference photo (no probe there)
// or a render's final pixels. macOS (sips converts to BMP); no Python or
// ImageMagick needed. Guide: knowledge/tools/RENDER.md.
//
//   node scripts/measure/rows.mjs IMAGE --rows 100,200,300 [--from X0 --to X1]
//   node scripts/measure/rows.mjs IMAGE --cols 400,800 [--from Y0 --to Y1]
//   node scripts/measure/rows.mjs IMAGE --rows 0:1080:40     (every 40th row)
//
// Prints each line's mean R G B and luminance (Rec. 709 on the 8-bit values,
// a relative brightness, not cd/m²). For a render's real luminance use
// params.debug.probe / probeLine (scripts/measure/edges.mjs).

import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parseArgs } from '../shared/lib.mjs'

const { args, option, rejectUnknown } = parseArgs()
const rowsArg = option('rows', null)
const colsArg = option('cols', null)
const fromArg = option('from', null)
const toArg = option('to', null)
rejectUnknown()
if (args.length !== 1 || (rowsArg == null) === (colsArg == null)) throw new Error('give one IMAGE and --rows or --cols (see the header)')

const list = text =>
  text.includes(':')
    ? (() => {
        const [a, b, step = 1] = text.split(':').map(Number)
        return Array.from({ length: Math.floor((b - a) / step) }, (_, i) => a + i * step)
      })()
    : text.split(',').map(Number)

const dir = mkdtempSync(join(tmpdir(), 'rows-'))
try {
  const bmp = join(dir, 'image.bmp')
  execFileSync('sips', ['-s', 'format', 'bmp', args[0], '--out', bmp], { stdio: 'ignore' })
  const b = readFileSync(bmp)
  const offset = b.readUInt32LE(10)
  const width = b.readInt32LE(18)
  const rawHeight = b.readInt32LE(22)
  const bytes = b.readUInt16LE(28) / 8
  const height = Math.abs(rawHeight)
  const stride = Math.ceil((width * bytes) / 4) * 4
  const pixel = (x, y) => {
    const row = rawHeight > 0 ? height - 1 - y : y
    const i = offset + row * stride + x * bytes
    return [b[i + 2], b[i + 1], b[i]]
  }
  const byRows = rowsArg != null
  const lines = list(byRows ? rowsArg : colsArg)
  const from = fromArg == null ? 0 : Number(fromArg)
  const to = toArg == null ? (byRows ? width : height) : Number(toArg)
  console.log(`${args[0]}: ${width}×${height}; ${byRows ? 'rows' : 'columns'}, ${byRows ? 'x' : 'y'} ${from}–${to}`)
  for (const line of lines) {
    if (line < 0 || line >= (byRows ? height : width)) continue
    let [r, g, bl, n] = [0, 0, 0, 0]
    for (let k = from; k < to; k++) {
      const [pr, pg, pb] = byRows ? pixel(k, line) : pixel(line, k)
      r += pr
      g += pg
      bl += pb
      n++
    }
    const [mr, mg, mb] = [r / n, g / n, bl / n]
    console.log(`  ${String(line).padStart(5)}  ${[mr, mg, mb].map(v => Math.round(v).toString().padStart(3)).join(' ')}  lum ${(0.2126 * mr + 0.7152 * mg + 0.0722 * mb).toFixed(0)}`)
  }
} finally {
  rmSync(dir, { recursive: true, force: true })
}
