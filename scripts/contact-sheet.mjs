// One image of many renders: a grid of thumbnails titled from NAME.json.
//
//   node scripts/contact-sheet.mjs [--dir out] [--cols 4] [--width 2400] [--match REGEX]
//        [--compare DIR_B] [--region top|bottom|centre|X0,Y0,X1,Y1] [--out FILE]
//
// Writes DIR/contact-sheet.jpg. --compare: before | after pairs by name.
// --region: only that part of each image (fractions). One matching image fills
// the sheet, so --match '^NAME$' --region … zooms into one render.

import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

import { parseArgs } from './lib.mjs'

const { option, rejectUnknown, rejectPositional } = parseArgs()
const dir = resolve(option('dir', 'out'))
const colsArg = option('cols', null)
const width = Number(option('width', 2400))
const match = new RegExp(option('match', '.'))
const compare = option('compare', null)
const out = option('out', null)
const REGIONS = { top: [0, 0, 1, 0.5], bottom: [0, 0.5, 1, 1], centre: [0.25, 0.25, 0.75, 0.75] }
const regionArg = option('region', null)
rejectUnknown()
// A bare folder used to be ignored, and the sheet of out/ overwrote out/contact-sheet.jpg.
rejectPositional('give the folder as --dir DIR')
const region = regionArg == null ? null : (REGIONS[regionArg] ?? regionArg.split(',').map(Number))
if (region != null && (region.length !== 4 || region.some(v => !(v >= 0 && v <= 1)))) throw new Error(`--region: top, bottom, centre or X0,Y0,X1,Y1 in 0..1`)

const all = await readdir(dir)
const files = all
  .filter(f => f.endsWith('.jpg') && !f.startsWith('contact-sheet') && match.test(f.replace(/\.jpg$/, '')))
  .sort()
// One image fills the sheet: with --region, a zoom at up to
// native resolution.
const cols = Number(colsArg ?? (files.length === 1 ? 1 : 4))

async function cell(folder, f, tag) {
  const name = f.replace(/\.jpg$/, '')
  let label = name
  try {
    // Crops (NAME.KIND.jpg) share their render's JSON.
    const params = JSON.parse(await readFile(join(folder, `${name.split('.')[0]}.json`), 'utf8'))
    label = `${name === params.date ? name : `${name} (${params.date})`} — ${params.title}`
  } catch {}
  const img = `<img src="${pathToFileURL(join(folder, f))}">`
  return `<figure>${region != null ? `<div class="crop">${img}</div>` : img}<figcaption>${tag}${label}</figcaption></figure>`
}
const columns = compare != null ? 2 : cols
const cells =
  compare == null
    ? await Promise.all(files.map(f => cell(dir, f, '')))
    : (
        await Promise.all(
          files.map(async f => [await cell(dir, f, 'A: '), (await readdir(compare)).includes(f) ? await cell(resolve(compare), f, 'B: ') : '<figure></figure>'])
        )
      ).flat()

const html = `<!doctype html><style>
  body { margin: 0; background: #111; color: #ddd; font: 13px system-ui; }
  main { display: grid; grid-template-columns: repeat(${columns}, 1fr); gap: 6px; padding: 6px; }
  figure { margin: 0; }
  img { width: 100%; display: block; }
  figcaption { padding: 3px 2px 6px; }
  ${
    region == null
      ? ''
      : `.crop { position: relative; overflow: hidden; }
  .crop img { position: absolute; width: ${100 / (region[2] - region[0])}%;
    left: ${(-100 * region[0]) / (region[2] - region[0])}%; top: ${(-100 * region[1]) / (region[3] - region[1])}%; }`
  }
</style><main>${cells.join('')}</main>`

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' })
const page = await browser.newPage({ viewport: { width, height: 800 } })
// Load from a file so file:// image URLs are allowed.
const htmlFile = join(dir, '.contact-sheet.html')
await writeFile(htmlFile, html)
await page.goto(pathToFileURL(htmlFile).toString(), { waitUntil: 'load' })
if (region != null) {
  // Each crop box gets the region's shape in that image's own pixels.
  await page.evaluate(([x0, y0, x1, y1]) => {
    for (const img of document.querySelectorAll('.crop img'))
      img.parentElement.style.aspectRatio = String(((x1 - x0) * img.naturalWidth) / ((y1 - y0) * img.naturalHeight))
  }, region)
}
const sheet = out ?? join(dir, 'contact-sheet.jpg')
await page.screenshot({ path: sheet, fullPage: true, type: 'jpeg', quality: 85 })
await browser.close()
await rm(htmlFile)
console.log(sheet)
