// Did a change show up, and where? Pixel diff of two renders per name: share
// changed, the box holding 98% of it, mean/max Δ, brighter/darker; saves
// OUT/NAME.diff.jpg (off | on, cropped, over the difference ×8). "⚠ invisible"
// = under 0.01% changed. Guide: knowledge/tools/RENDER.md.
//
//   node scripts/diff.mjs --scene SPEC --off PATCH [--out out/diff]   feature on vs off
//   node scripts/diff.mjs --scene SPEC --ref HEAD [--off PATCH]       REF (off) vs this tree (on)
//   node scripts/diff.mjs --a DIR --b DIR [--match REGEX]             two folders, same names
//   node scripts/diff.mjs --scene SPEC --ref HEAD --off PATCH --off-here
//                     REF as it was (off) vs this tree with PATCH (on): does a new
//                     off switch give back the old image? Expect "identical".
//
// --off is merged deeply into each spec (with --ref it patches only the ref side,
// or with --off-here only this tree's).
// --w --h --frames --url   passed to snapshot.mjs (renders go to OUT/off, OUT/on)
// --keep-camera     "on" first, then each "off" stands at its ground height
//                   (camera.groundM): for terrain changes, which move the camera
// --keep-exposure   "on" first, then each "off" uses its exposure (debug.exposure):
//                   for sky, weather, haze and sun changes, which re-meter the frame
// --threshold N     luminance change that counts, 0–255 (default 4, above JPEG noise)
// --crop X,Y,W,H    also save OUT/NAME.crop.jpg: off | on side by side at full size,
//                   not shrunk (`box`: the changed box). With --a/--b, no new render.
// --zoom N          enlarge that crop N times, pixels kept sharp (default 1)
//
// Renders at 1920×1080 and 16 frames unless --w --h --frames say otherwise.

import { spawnSync } from 'node:child_process'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'
import { createServer } from 'vite'

import { merge, parseArgs, readJson, readSpecs } from './lib.mjs'

const { option, flag, rejectUnknown, rejectPositional } = parseArgs()
const sceneArg = option('scene', null)
const offArg = option('off', null)
const refArg = option('ref', null)
const outDir = resolve(option('out', 'out/diff'))
let dirA = option('a', null)
let dirB = option('b', null)
const match = new RegExp(option('match', '.'))
const threshold = Number(option('threshold', 4))
const keepCamera = flag('keep-camera')
const keepExposure = flag('keep-exposure')
const onFirst = keepCamera || keepExposure
const cropArg = option('crop', null)
const crop = cropArg == null || cropArg === 'box' ? cropArg : cropArg.split(',').map(Number)
if (Array.isArray(crop) && (crop.length !== 4 || crop.some(v => !Number.isFinite(v)))) throw new Error('--crop is X,Y,W,H in pixels, or box')
const zoom = Number(option('zoom', 1))
const defaults = { w: '1920', h: '1080', frames: '16' }
const render = ['w', 'h', 'frames', 'url'].flatMap(k => {
  const v = option(k, defaults[k] ?? null)
  return v == null ? [] : [`--${k}`, v]
})
const offHere = flag('off-here')
rejectUnknown()
rejectPositional('diff.mjs takes only options')
if (offHere && (refArg == null || offArg == null)) throw new Error('--off-here needs --ref REF and --off PATCH')

if (sceneArg != null) {
  if (offArg == null && refArg == null) throw new Error('--scene needs --off (the patch that turns the feature off) or --ref (a commit to compare with)')
  const { specs } = await readSpecs(sceneArg)
  const off = offArg != null ? await readJson(offArg) : {}
  // A bad spec fails here, naming the field, before any render. (With --ref the
  // off side runs on the ref's fields, which snapshot.mjs handles.)
  const checker = await createServer({ cacheDir: resolve('node_modules/.vite-params'), server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom', logLevel: 'error' })
  try {
    const { parseSceneSpec } = await checker.ssrLoadModule('/src/sceneSpec.ts')
    for (const s of specs) {
      parseSceneSpec(s)
      if (refArg == null || offHere) parseSceneSpec(merge(s, off))
    }
  } finally {
    await checker.close()
  }
  dirA = join(outDir, 'off')
  dirB = join(outDir, 'on')
  await mkdir(outDir, { recursive: true })
  const named = specs.map((s, i) => ({ ...s, name: s.name ?? s.date ?? `scene-${i + 1}` }))
  // --off-here: this tree carries the patch, the ref renders the specs as they are.
  await writeFile(join(outDir, 'on.json'), JSON.stringify(offHere ? named.map(s => merge(s, off)) : named))
  const snapshot = (dir, file) => {
    const atRef = refArg != null && file === 'off.json' ? ['--ref', refArg] : []
    const run = spawnSync('node', ['scripts/snapshot.mjs', '--out', dir, ...render, ...atRef, '--scene', join(outDir, file)], { encoding: 'utf8' })
    process.stdout.write(run.stdout.split('\n').filter(l => /\.jpg|⚠|rror/.test(l)).map(l => `${l}\n`).join(''))
    if (run.status !== 0) throw new Error(`snapshot.mjs failed:\n${run.stderr}`)
  }
  if (onFirst) snapshot(dirB, 'on.json')
  const offSpecs = await Promise.all(
    named.map(async s => {
      const spec = offHere ? s : merge(s, off)
      if (!onFirst) return spec
      const { debug } = JSON.parse(await readFile(join(dirB, `${s.name}.json`), 'utf8'))
      const pinned = {
        ...(keepCamera ? { camera: { groundM: debug.cameraGroundM } } : {}),
        ...(keepExposure ? { debug: { exposure: debug.exposure } } : {})
      }
      return merge(spec, { params: pinned })
    })
  )
  await writeFile(join(outDir, 'off.json'), JSON.stringify(offSpecs))
  snapshot(dirA, 'off.json')
  if (!onFirst) snapshot(dirB, 'on.json')
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
    async ({ a, b, threshold, crop, zoom }) => {
      const encode = async canvas => {
        const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.92 })
        return new Uint8Array(await blob.arrayBuffer()).reduce((s, x) => s + String.fromCharCode(x), '')
      }
      /** off | on at full size (× zoom), a thin white line between them. */
      const fullSize = async (x, y, w, h) => {
        const gap = 4
        const sheet = new OffscreenCanvas(w * zoom * 2 + gap, h * zoom)
        const ctx = sheet.getContext('2d')
        ctx.imageSmoothingEnabled = false
        ctx.fillStyle = '#fff'
        ctx.fillRect(0, 0, sheet.width, sheet.height)
        ctx.drawImage(ia, x, y, w, h, 0, 0, w * zoom, h * zoom)
        ctx.drawImage(ib, x, y, w, h, w * zoom + gap, 0, w * zoom, h * zoom)
        return encode(sheet)
      }
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
      const asked = Array.isArray(crop) ? await fullSize(...crop) : null
      if (changed === 0) return { W, H, changed, share: 0, crop: asked }
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
      const jpeg = await encode(sheet)
      const boxed = crop === 'box' ? await fullSize(x0, y0, x1 - x0 + 1, y1 - y0 + 1) : asked
      return { W, H, changed, share: changed / (W * H), box: [x0, y0, x1, y1], mean: sum / changed, max, brighter: brighter / changed, jpeg, crop: boxed }
    },
    { a, b, threshold, crop, zoom }
  )
  const name = file.replace(/\.jpg$/, '')
  if (result.error != null) {
    console.log(`${name}: ${result.error}`)
    continue
  }
  if (result.crop != null) {
    const cropFile = join(outDir, `${name}.crop.jpg`)
    await writeFile(cropFile, Buffer.from(result.crop, 'latin1'))
    console.log(`  ${cropFile}`)
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
