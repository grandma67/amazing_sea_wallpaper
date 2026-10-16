// Build a contact sheet (grid of thumbnails with titles) from rendered images.
//
//   node scripts/contact-sheet.mjs [--dir out] [--cols 4] [--width 2400]
//        [--match REGEX] [--compare DIR_B] [--region top|bottom|centre|X0,Y0,X1,Y1]
//        [--out FILE]
//
// Reads the .jpg images in --dir (titled from NAME.json when there is one:
// dates, or scene spec names) and writes contact-sheet.jpg there.
// --match keeps only names matching a regex (e.g. '\.islands$' for the crops
// snapshot.mjs --crop saves). --compare puts each image beside the one of the
// same name in DIR_B (before | after), one pair per row. --region shows only
// part of every image, as fractions of its width and height (top = the upper
// half, where sky features are): bigger thumbnails of what you're checking.

import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  return i === -1 ? fallback : args[i + 1]
}
const dir = resolve(option('dir', 'out'))
const cols = Number(option('cols', 4))
const width = Number(option('width', 2400))
const match = new RegExp(option('match', '.'))
const compare = option('compare', null)
const out = option('out', null)
const REGIONS = { top: [0, 0, 1, 0.5], bottom: [0, 0.5, 1, 1], centre: [0.25, 0.25, 0.75, 0.75] }
const regionArg = option('region', null)
const region = regionArg == null ? null : (REGIONS[regionArg] ?? regionArg.split(',').map(Number))
if (region != null && (region.length !== 4 || region.some(v => !(v >= 0 && v <= 1)))) throw new Error(`--region: top, bottom, centre or X0,Y0,X1,Y1 in 0..1`)

const all = await readdir(dir)
const files = all
  .filter(f => f.endsWith('.jpg') && !f.startsWith('contact-sheet') && match.test(f.replace(/\.jpg$/, '')))
  .sort()

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
