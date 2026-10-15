// Build a contact sheet (grid of thumbnails with titles) from rendered images.
//
//   node scripts/contact-sheet.mjs [--dir out] [--cols 4] [--width 2400]
//        [--match REGEX] [--compare DIR_B] [--out FILE]
//
// Reads the .jpg images in --dir (titled from NAME.json when there is one:
// dates, or scene spec names) and writes contact-sheet.jpg there.
// --match keeps only names matching a regex (e.g. '\.islands$' for the crops
// snapshot.mjs --crop saves). --compare puts each image beside the one of the
// same name in DIR_B (before | after), one pair per row.

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
  return `<figure><img src="${pathToFileURL(join(folder, f))}"><figcaption>${tag}${label}</figcaption></figure>`
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
</style><main>${cells.join('')}</main>`

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' })
const page = await browser.newPage({ viewport: { width, height: 800 } })
// Load from a file so file:// image URLs are allowed.
const htmlFile = join(dir, '.contact-sheet.html')
await writeFile(htmlFile, html)
await page.goto(pathToFileURL(htmlFile).toString(), { waitUntil: 'load' })
const sheet = out ?? join(dir, 'contact-sheet.jpg')
await page.screenshot({ path: sheet, fullPage: true, type: 'jpeg', quality: 85 })
await browser.close()
await rm(htmlFile)
console.log(sheet)
