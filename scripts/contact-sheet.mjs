// Build a contact sheet (grid of thumbnails with titles) from rendered images.
//
//   node scripts/contact-sheet.mjs [--dir out] [--cols 4] [--width 2400]
//
// Reads NAME.jpg + NAME.json pairs (dates, or scene spec names) from --dir and
// writes contact-sheet.jpg there.

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

const all = await readdir(dir)
const files = all.filter(f => f.endsWith('.jpg') && all.includes(f.replace(/\.jpg$/, '.json'))).sort()
const cells = await Promise.all(
  files.map(async f => {
    const name = f.replace(/\.jpg$/, '')
    let title = ''
    let date = ''
    try {
      const params = JSON.parse(await readFile(join(dir, `${name}.json`), 'utf8'))
      title = params.title
      date = params.date
    } catch {}
    const label = name === date ? date : `${name} (${date})`
    return `<figure><img src="${pathToFileURL(join(dir, f))}"><figcaption>${label} — ${title}</figcaption></figure>`
  })
)

const html = `<!doctype html><style>
  body { margin: 0; background: #111; color: #ddd; font: 13px system-ui; }
  main { display: grid; grid-template-columns: repeat(${cols}, 1fr); gap: 6px; padding: 6px; }
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
const out = join(dir, 'contact-sheet.jpg')
await page.screenshot({ path: out, fullPage: true, type: 'jpeg', quality: 85 })
await browser.close()
await rm(htmlFile)
console.log(out)
