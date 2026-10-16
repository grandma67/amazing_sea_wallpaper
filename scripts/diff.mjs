// Did a change show up, and where? Compares renders pixel by pixel instead of
// reading images: the share of pixels that changed, the box round them, and
// how much they changed; and saves NAME.diff.jpg (before | after, cropped to
// that box, over the difference ×8).
//
// A feature on vs off (renders both with snapshot.mjs):
//   node scripts/diff.mjs --scene specs.json --off '{"contrails":null}' --out $SP/contrails
//        [--w 1920 --h 1080 --frames 16]
// Every spec is rendered as written (into OUT/on) and with --off merged in
// (into OUT/off); --off is merged deeply, so '{"props":{"debris":null}}'
// keeps the spec's other props.
//
// Two folders of renders already made (same names), e.g. before/after a code
// change, or a speed change that should leave the image alone:
//   node scripts/diff.mjs --a $SP/before --b $SP/after [--match REGEX]
//
// A pixel counts as changed when its luminance moves by more than --threshold
// (0–255, default 4: above JPEG noise; two renders of the same code on the
// same GPU are identical). "invisible" means < 0.01% of the frame changed:
// the feature isn't placed, is out of frame, is hidden, or is too faint.

import { spawnSync } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return fallback
  const [, value] = args.splice(i, 2)
  return value
}
const sceneArg = option('scene', null)
const offArg = option('off', null)
const outDir = resolve(option('out', 'out/diff'))
let dirA = option('a', null)
let dirB = option('b', null)
const match = new RegExp(option('match', '.'))
const threshold = Number(option('threshold', 4))
const render = ['w', 'h', 'frames', 'url'].flatMap(k => {
  const v = option(k, null)
  return v == null ? [] : [`--${k}`, v]
})

/** Objects merge, everything else replaces (as a spec's `params` patch). */
const merge = (a, b) => {
  if (b === null || typeof b !== 'object' || Array.isArray(b) || a == null || typeof a !== 'object' || Array.isArray(a)) return b
  const out = { ...a }
  for (const [k, v] of Object.entries(b)) out[k] = merge(a[k], v)
  return out
}
const readJson = async arg => JSON.parse(/^\s*[[{]/.test(arg) ? arg : await readFile(arg, 'utf8'))

if (sceneArg != null) {
  if (offArg == null) throw new Error('--scene needs --off: the patch that turns the feature off')
  const parsed = await readJson(sceneArg)
  const specs =
    !Array.isArray(parsed) && Array.isArray(parsed.scenes)
      ? parsed.scenes.map(scene => merge(parsed.base ?? {}, scene))
      : Array.isArray(parsed)
        ? parsed
        : [parsed]
  const off = await readJson(offArg)
  dirA = join(outDir, 'off')
  dirB = join(outDir, 'on')
  await mkdir(outDir, { recursive: true })
  const named = specs.map((s, i) => ({ ...s, name: s.name ?? s.date ?? `scene-${i + 1}` }))
  await writeFile(join(outDir, 'on.json'), JSON.stringify(named))
  await writeFile(join(outDir, 'off.json'), JSON.stringify(named.map(s => merge(s, off))))
  for (const [dir, file] of [[dirA, 'off.json'], [dirB, 'on.json']]) {
    const run = spawnSync('node', ['scripts/snapshot.mjs', '--out', dir, ...render, '--scene', join(outDir, file)], { encoding: 'utf8' })
    process.stdout.write(run.stdout.split('\n').filter(l => /\.jpg|⚠|rror/.test(l)).map(l => `${l}\n`).join(''))
    if (run.status !== 0) throw new Error(`snapshot.mjs failed:\n${run.stderr}`)
  }
}
if (dirA == null || dirB == null) throw new Error('give --scene SPECS --off PATCH, or --a DIR --b DIR')

const inA = new Set(await readdir(dirA))
const names = (await readdir(dirB))
  .filter(f => f.endsWith('.jpg') && !f.includes('.diff') && !f.startsWith('contact-sheet') && match.test(f.replace(/\.jpg$/, '')))
  .filter(f => inA.has(f))
  .sort()
await mkdir(outDir, { recursive: true })

const browser = await chromium.launch({ channel: process.env.CI ? undefined : 'chrome' })
const page = await browser.newPage()
for (const file of names) {
  const [a, b] = await Promise.all([readFile(join(dirA, file)), readFile(join(dirB, file))].map(p => p.then(buf => buf.toString('base64'))))
  const result = await page.evaluate(
    async ({ a, b, threshold }) => {
      const load = async data => createImageBitmap(await (await fetch(`data:image/jpeg;base64,${data}`)).blob())
      const [ia, ib] = await Promise.all([load(a), load(b)])
      const W = ia.width
      const H = ia.height
      if (ib.width !== W || ib.height !== H) return { error: `sizes differ: ${W}×${H} vs ${ib.width}×${ib.height}` }
      const pixels = img => {
        const c = new OffscreenCanvas(W, H).getContext('2d')
        c.drawImage(img, 0, 0)
        return c.getImageData(0, 0, W, H).data
      }
      const pa = pixels(ia)
      const pb = pixels(ib)
      const lum = (p, i) => 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2]
      const rows = new Uint32Array(H)
      const cols = new Uint32Array(W)
      let changed = 0
      let sum = 0
      let max = 0
      let brighter = 0
      const delta = new Float32Array(W * H)
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4
          const d = lum(pb, i) - lum(pa, i)
          delta[y * W + x] = d
          if (Math.abs(d) > threshold) {
            changed++
            rows[y]++
            cols[x]++
            sum += Math.abs(d)
            max = Math.max(max, Math.abs(d))
            if (d > 0) brighter++
          }
        }
      if (changed === 0) return { W, H, changed, share: 0 }
      // The box holding 98% of the changed pixels (stray noise left out).
      const span = counts => {
        const total = counts.reduce((s, n) => s + n, 0)
        let lo = 0
        let hi = counts.length - 1
        for (let acc = 0; acc + counts[lo] < total * 0.01; lo++) acc += counts[lo]
        for (let acc = 0; acc + counts[hi] < total * 0.01; hi--) acc += counts[hi]
        return [lo, hi]
      }
      const [x0, x1] = span(cols)
      const [y0, y1] = span(rows)
      // Crops: before | after on top, the difference ×8 (grey = none) below.
      const pad = Math.max(24, 0.15 * Math.max(x1 - x0, y1 - y0))
      const cx0 = Math.max(0, Math.floor(x0 - pad))
      const cy0 = Math.max(0, Math.floor(y0 - pad))
      const cw = Math.min(W, Math.ceil(x1 + pad)) - cx0
      const ch = Math.min(H, Math.ceil(y1 + pad)) - cy0
      const scale = Math.min(1, 900 / cw, 500 / ch)
      const w = Math.round(cw * scale)
      const h = Math.round(ch * scale)
      const sheet = new OffscreenCanvas(w * 2, h * 2)
      const ctx = sheet.getContext('2d')
      ctx.drawImage(ia, cx0, cy0, cw, ch, 0, 0, w, h)
      ctx.drawImage(ib, cx0, cy0, cw, ch, w, 0, w, h)
      const diff = new ImageData(cw, ch)
      for (let y = 0; y < ch; y++)
        for (let x = 0; x < cw; x++) {
          const d = delta[(y + cy0) * W + x + cx0] * 8
          const o = (y * cw + x) * 4
          diff.data[o] = 128 + d
          diff.data[o + 1] = 128 + d
          diff.data[o + 2] = 128 + d
          diff.data[o + 3] = 255
        }
      const dc = new OffscreenCanvas(cw, ch)
      dc.getContext('2d').putImageData(diff, 0, 0)
      ctx.drawImage(dc, 0, 0, cw, ch, w / 2, h, w, h)
      const blob = await sheet.convertToBlob({ type: 'image/jpeg', quality: 0.9 })
      const jpeg = new Uint8Array(await blob.arrayBuffer()).reduce((s, x) => s + String.fromCharCode(x), '')
      return { W, H, changed, share: changed / (W * H), box: [x0, y0, x1, y1], mean: sum / changed, max, brighter: brighter / changed, jpeg }
    },
    { a, b, threshold }
  )
  const name = file.replace(/\.jpg$/, '')
  if (result.error != null) {
    console.log(`${name}: ${result.error}`)
    continue
  }
  if (result.changed === 0) {
    console.log(`${name}: identical (no pixel moved more than ${threshold}/255)`)
    continue
  }
  const pct = (100 * result.share).toFixed(result.share < 0.001 ? 4 : 2)
  const verdict = result.share < 1e-4 ? '  ⚠ invisible' : ''
  const tone = result.brighter > 0.66 ? 'brighter' : result.brighter < 0.34 ? 'darker' : 'mixed'
  const diffFile = join(outDir, `${name}.diff.jpg`)
  await writeFile(diffFile, Buffer.from(result.jpeg, 'latin1'))
  console.log(
    `${name}: ${pct}% changed, box ${JSON.stringify(result.box)} of ${result.W}×${result.H}, ` +
      `mean Δ ${result.mean.toFixed(1)}, max ${result.max.toFixed(0)} (${tone})${verdict}\n  ${diffFile}`
  )
}
await browser.close()
