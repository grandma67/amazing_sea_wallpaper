// Real reference data (NATURE_PLAN phase 1): fetch a CC0/CC-BY photo, texture
// or scan into assets-src/<id>/ (git-ignored) with its licence, then measure
// its real size and linear albedo per colour region. No server needed.
//
//   node scripts/asset.mjs fetch SOURCE [--id ID]
//   node scripts/asset.mjs measure SOURCE|ID [--id ID] [--k 3] [--region X0,Y0,X1,Y1]
//        [--name NAME] [--petal] [--min-share 0.02] [--anchor NAME=R,G,B] [--hue H0,H1[,S]]
//   node scripts/asset.mjs grid SOURCE|ID      the image with a labelled 10% grid
//                                              (assets-src/<id>/grid.jpg): read --region off it
//   node scripts/asset.mjs list
//   node scripts/asset.mjs replay [ID]         measure again everything recorded in
//                                              scripts/asset-measures.json (committed; every
//                                              measure records its options there), fetching
//                                              what's missing: assets-src/ isn't committed
//
// SOURCE:
//   polyhaven:<id>            a Poly Haven texture or model (CC0); size from its metadata
//   ambientcg:<id>            an ambientCG material (CC0), its 1K colour map
//   commons:File:<name>       a Wikimedia Commons photo; licence and author from the file page
//   https://…  --licence L --author A --page URL   anything else (recorded as given)
//
// measure: decodes the image (in Chromium, so ICC profiles become sRGB), drops
// clipped pixels (a channel ≥ 250, or all ≤ 5) and transparent ones (a model's
// alpha map), then splits the rest into --k colour clusters (k-means in sRGB,
// deterministic) inside --region (fractions of the image). Each cluster: its
// share, linear mean (sRGB → linear; × 0.8 with --petal), per-channel spread
// (standard deviation, linear) and an sRGB hex to recognise it. Results go to
// assets-src/<id>/measure.json under --name (default "all"), so one image can
// hold several regions (petal, leaf, stem).
//
// Photo colours depend on the camera's exposure and white balance: use them
// for hue and relative brightness, and prefer a calibrated texture (Poly Haven,
// ambientCG) where one exists. --anchor ties a photo's brightness to a known
// albedo in the same light: measure a region of one material first (grass,
// leaves: --name grass --region …), then --anchor grass=0.08,0.13,0.05 scales
// this region's colours by known ÷ measured luminance (Rec. 709 Y) of that
// region. Hue stays the photo's.
//
// --hue H0,H1[,S]: keep only pixels whose hue is in H0…H1 degrees (wrapping:
// 300,20 is magenta to orange) and HSV saturation ≥ S (default 0.3): the
// flowers alone, not the sunlit leaves and sky glints a k-means cluster mixes
// in (phase 3's wattle). Then --k 1 or 2 gives their colour.

import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

import { parseArgs } from './lib.mjs'

const ROOT = resolve('assets-src')
const UA = 'amazing-sea-asset-script/1.0 (reference colours)'

const { args, option, flag, rejectUnknown } = parseArgs()
const idArg = option('id', null)
const k = Number(option('k', 3))
const regionArg = option('region', null)
const name = option('name', 'all')
const petal = flag('petal')
const minShare = Number(option('min-share', 0.02))
const licenceArg = option('licence', null)
const authorArg = option('author', null)
const pageArg = option('page', null)
const anchorArg = option('anchor', null)
const hueArg = option('hue', null)
rejectUnknown()
const [command, source, ...rest] = args
if (rest.length > 0) throw new Error(`unexpected arguments ${rest.join(' ')}`)
const MANIFEST = resolve('scripts/asset-measures.json')

/** A measure's options, checked: from the command line or the manifest. */
function measureOptions(o) {
  const region = o.region ?? [0, 0, 1, 1]
  if (region.length !== 4 || region.some(v => !(v >= 0 && v <= 1)) || region[0] >= region[2] || region[1] >= region[3])
    throw new Error('--region X0,Y0,X1,Y1 in 0..1, X0 < X1, Y0 < Y1')
  if (!(o.k >= 1 && o.k <= 12 && Number.isInteger(o.k))) throw new Error('--k: an integer 1..12')
  if (o.hue != null && (o.hue.length < 2 || o.hue.length > 3 || o.hue.some(v => !Number.isFinite(v)))) throw new Error('--hue H0,H1[,S]: degrees, and a saturation 0..1')
  return { ...o, region }
}
const cli = measureOptions({
  id: idArg,
  k,
  region: regionArg == null ? null : regionArg.split(',').map(Number),
  name,
  petal,
  minShare,
  anchor: anchorArg,
  hue: hueArg == null ? null : hueArg.split(',').map(Number)
})

/** Hue (degrees) and HSV saturation of an sRGB pixel (0..1). */
function hueSat(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  if (d === 0) return [0, 0]
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [(h * 60 + 360) % 360, d / max]
}
const inHue = ([h0, h1], h) => (h0 <= h1 ? h >= h0 && h <= h1 : h >= h0 || h <= h1)

async function get(url, as = 'json') {
  let res
  // Commons answers 429 to bursts: wait as told (or 2, 4, 8… s) and retry.
  for (let attempt = 0; ; attempt++) {
    res = await fetch(url, { headers: { 'User-Agent': UA } })
    if (res.status !== 429 || attempt === 5) break
    const wait = Number(res.headers.get('retry-after')) || 2 ** (attempt + 1)
    await new Promise(r => setTimeout(r, wait * 1000))
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${url}`)
  return as === 'json' ? res.json() : Buffer.from(await res.arrayBuffer())
}

const slug = s => s.replace(/^File:/, '').replace(/\.[a-z]+$/i, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60).toLowerCase()
const stripHtml = s => (s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

/** Where SOURCE comes from: the files to download and what source.json records. */
async function resolveSource(src) {
  const [kind, ...restId] = src.split(':')
  const ref = restId.join(':')
  if (kind === 'polyhaven') {
    const info = await get(`https://api.polyhaven.com/info/${ref}`)
    const files = await get(`https://api.polyhaven.com/files/${ref}`)
    const isModel = info.type === 2
    const pick = key => files[key]?.['1k']?.jpg?.url ?? files[key]?.['1k']?.png?.url
    const dl = { 'albedo.jpg': pick('Diffuse') ?? pick('diffuse') }
    if (isModel && pick('Alpha')) dl['alpha.jpg'] = pick('Alpha')
    if (isModel && files.gltf?.['1k']?.gltf?.url) dl['model.gltf'] = files.gltf['1k'].gltf.url
    if (dl['albedo.jpg'] == null) throw new Error(`polyhaven:${ref}: no 1k diffuse map`)
    // Poly Haven gives dimensions in mm: textures [w, h], models [x, y, z].
    const sizeM = info.dimensions?.map(d => +(d / 1000).toFixed(3))
    return {
      id: `ph_${ref}`,
      download: dl,
      record: {
        source: src, page: `https://polyhaven.com/a/${ref}`, licence: 'CC0', author: Object.keys(info.authors ?? {}).join(', '),
        kind: isModel ? 'model' : 'texture', name: info.name, sizeM, calibrated: true,
      },
    }
  }
  if (kind === 'ambientcg') {
    const d = await get(`https://ambientcg.com/api/v2/full_json?id=${encodeURIComponent(ref)}&include=downloadData,dimensionsData`)
    const a = d.foundAssets?.[0]
    if (a == null) throw new Error(`ambientcg:${ref}: not found`)
    const zip = a.downloadFolders.default.downloadFiletypeCategories.zip.downloads.find(z => z.attribute === '1K-JPG')
    const dims = [a.dimensionX, a.dimensionY].filter(v => v > 0)
    return {
      id: `acg_${ref.toLowerCase()}`,
      download: { 'material.zip': zip.downloadLink },
      record: {
        source: src, page: `https://ambientcg.com/view?id=${ref}`, licence: 'CC0', author: 'ambientCG (Lennart Demes)',
        kind: 'texture', name: a.displayName, sizeM: dims.length === 2 ? dims.map(v => v / 100) : null, calibrated: true,
      },
    }
  }
  if (kind === 'commons') {
    const title = ref.startsWith('File:') ? ref : `File:${ref}`
    const q = new URLSearchParams({ action: 'query', format: 'json', titles: title, prop: 'imageinfo', iiprop: 'url|extmetadata|mime', iiurlwidth: '1600' })
    const d = await get(`https://commons.wikimedia.org/w/api.php?${q}`)
    const page = Object.values(d.query.pages)[0]
    const ii = page.imageinfo?.[0]
    if (ii == null) throw new Error(`${title}: not on Commons`)
    const meta = ii.extmetadata ?? {}
    return {
      id: `wc_${slug(title)}`,
      download: { 'photo.jpg': ii.thumburl ?? ii.url },
      record: {
        source: src, page: ii.descriptionurl, licence: stripHtml(meta.LicenseShortName?.value), author: stripHtml(meta.Artist?.value),
        kind: 'photo', name: stripHtml(meta.ObjectName?.value) || title, sizeM: null, calibrated: false,
      },
    }
  }
  if (/^https?:$/.test(kind)) {
    if (licenceArg == null || pageArg == null) throw new Error('a plain URL needs --licence and --page (and --author)')
    return {
      id: idArg ?? slug(new URL(src).pathname.split('/').pop()),
      download: { 'photo.jpg': src },
      record: { source: src, page: pageArg, licence: licenceArg, author: authorArg ?? '', kind: 'photo', name: src, sizeM: null, calibrated: false },
    }
  }
  throw new Error(`unknown source ${src} (polyhaven:, ambientcg:, commons:File:, https://)`)
}

/** The model's bounding box from its glTF accessors (POSITION min/max, node
 * transforms ignored), in metres. */
async function gltfBox(file) {
  const g = JSON.parse(await readFile(file, 'utf8'))
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]
  for (const mesh of g.meshes ?? [])
    for (const prim of mesh.primitives) {
      const acc = g.accessors[prim.attributes.POSITION]
      if (acc?.min == null) continue
      for (let i = 0; i < 3; i++) (lo[i] = Math.min(lo[i], acc.min[i])), (hi[i] = Math.max(hi[i], acc.max[i]))
    }
  return lo.every(Number.isFinite) ? hi.map((h, i) => +(h - lo[i]).toFixed(3)) : null
}

async function fetchSource(src) {
  const { id: autoId, download, record } = await resolveSource(src)
  const id = idArg ?? autoId
  const dir = join(ROOT, id)
  await mkdir(dir, { recursive: true })
  for (const [file, url] of Object.entries(download)) {
    const out = join(dir, file)
    if (!existsSync(out)) await writeFile(out, await get(url, 'bytes'))
  }
  if (download['material.zip'] != null) {
    // ambientCG zips hold <id>_1K-JPG_Color.jpg among the PBR maps.
    const list = execFileSync('unzip', ['-Z1', join(dir, 'material.zip')], { encoding: 'utf8' }).split('\n')
    const color = list.find(f => /_Color\.(jpg|png)$/.test(f))
    if (color == null) throw new Error(`${id}: no _Color map in the zip`)
    execFileSync('unzip', ['-o', '-j', join(dir, 'material.zip'), color, '-d', dir])
    execFileSync('mv', [join(dir, color.split('/').pop()), join(dir, 'albedo.jpg')])
  }
  if (existsSync(join(dir, 'model.gltf'))) record.gltfBoxM = await gltfBox(join(dir, 'model.gltf'))
  record.fetched = new Date().toISOString().slice(0, 10)
  record.files = Object.keys(download).filter(f => f !== 'material.zip').concat(download['material.zip'] ? ['albedo.jpg'] : [])
  await writeFile(join(dir, 'source.json'), JSON.stringify(record, null, 2) + '\n')
  return { id, dir, record }
}

/** RGBA bytes of an image (and of its alpha map), at most 1024 px wide. */
async function decode(browser, file, alphaFile) {
  const page = await browser.newPage()
  const toUrl = async f => `data:image/${f.endsWith('.png') ? 'png' : 'jpeg'};base64,${(await readFile(f)).toString('base64')}`
  const out = await page.evaluate(
    async ({ src, alpha }) => {
      const load = async url => createImageBitmap(await (await fetch(url)).blob())
      const img = await load(src)
      const scale = Math.min(1, 1024 / img.width)
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
      const c = new OffscreenCanvas(w, h)
      const g = c.getContext('2d')
      g.drawImage(img, 0, 0, w, h)
      const rgba = g.getImageData(0, 0, w, h).data
      let a = null
      if (alpha != null) {
        g.clearRect(0, 0, w, h)
        g.drawImage(await load(alpha), 0, 0, w, h)
        a = g.getImageData(0, 0, w, h).data
      }
      const b64 = arr => { let s = ''; for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode(...arr.subarray(i, i + 0x8000)); return btoa(s) }
      return { w, h, rgba: b64(rgba), alpha: a && b64(a) }
    },
    { src: await toUrl(file), alpha: alphaFile && (await toUrl(alphaFile)) }
  )
  await page.close()
  return { w: out.w, h: out.h, rgba: Buffer.from(out.rgba, 'base64'), alpha: out.alpha && Buffer.from(out.alpha, 'base64') }
}

const toLinear = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

/** k-means in sRGB (0..1) over the kept pixels; seeds spread along luminance,
 * so the result is deterministic. */
function clusters(px, k) {
  const n = px.length / 3
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => px[a * 3] + px[a * 3 + 1] + px[a * 3 + 2] - (px[b * 3] + px[b * 3 + 1] + px[b * 3 + 2]))
  let centres = Array.from({ length: k }, (_, j) => { const i = order[Math.floor(((j + 0.5) / k) * n)]; return [px[i * 3], px[i * 3 + 1], px[i * 3 + 2]] })
  const label = new Uint8Array(n)
  for (let iter = 0; iter < 40; iter++) {
    const sum = centres.map(() => [0, 0, 0, 0])
    for (let i = 0; i < n; i++) {
      let best = 0, bd = Infinity
      for (let j = 0; j < k; j++) {
        const dr = px[i * 3] - centres[j][0], dg = px[i * 3 + 1] - centres[j][1], db = px[i * 3 + 2] - centres[j][2]
        const d = dr * dr + dg * dg + db * db
        if (d < bd) (bd = d), (best = j)
      }
      label[i] = best
      const s = sum[best]; s[0] += px[i * 3]; s[1] += px[i * 3 + 1]; s[2] += px[i * 3 + 2]; s[3]++
    }
    const next = sum.map((s, j) => (s[3] > 0 ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : centres[j]))
    const moved = next.reduce((m, c, j) => Math.max(m, Math.abs(c[0] - centres[j][0]) + Math.abs(c[1] - centres[j][1]) + Math.abs(c[2] - centres[j][2])), 0)
    centres = next
    if (moved < 1e-4) break
  }
  return label
}

async function measure(src, o) {
  const { k, region, name, petal, minShare, hue } = o
  const anchorArg = o.anchor
  const known = o.id ?? (existsSync(join(ROOT, src)) ? src : null)
  const { id, dir, record } = known != null && existsSync(join(ROOT, known, 'source.json'))
    ? { id: known, dir: join(ROOT, known), record: JSON.parse(await readFile(join(ROOT, known, 'source.json'), 'utf8')) }
    : await fetchSource(src)
  const image = ['albedo.jpg', 'photo.jpg'].map(f => join(dir, f)).find(existsSync)
  const alphaFile = existsSync(join(dir, 'alpha.jpg')) ? join(dir, 'alpha.jpg') : null
  const browser = await chromium.launch()
  const { w, h, rgba, alpha } = await decode(browser, image, alphaFile)
  await browser.close()

  const [x0, y0, x1, y1] = [region[0] * w, region[1] * h, region[2] * w, region[3] * h].map(Math.round)
  const kept = []
  let clipped = 0, transparent = 0, offHue = 0, total = 0
  for (let y = y0; y < y1; y++)
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4
      total++
      if (alpha != null && alpha[i] < 128) { transparent++; continue }
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2]
      if (r >= 250 || g >= 250 || b >= 250 || (r <= 5 && g <= 5 && b <= 5)) { clipped++; continue }
      if (hue != null) {
        const [hh, ss] = hueSat(r / 255, g / 255, b / 255)
        if (!inHue(hue, hh) || ss < (hue[2] ?? 0.3)) { offHue++; continue }
      }
      kept.push(r / 255, g / 255, b / 255)
    }
  const px = Float32Array.from(kept)
  const n = px.length / 3
  if (n < 100) throw new Error(`${id}: only ${n} usable pixels in the region`)
  const label = clusters(px, k)
  const file = join(dir, 'measure.json')
  const saved = existsSync(file) ? JSON.parse(await readFile(file, 'utf8')) : { regions: {} }
  const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  let anchor = null
  if (anchorArg != null) {
    const [ref, rgb] = anchorArg.split('=')
    const known = rgb?.split(',').map(Number)
    if (saved.regions[ref] == null || known?.length !== 3 || known.some(v => !(v > 0 && v < 1))) throw new Error('--anchor NAME=R,G,B: a region measured before in this image, and its known linear albedo')
    if (saved.regions[ref].anchor != null || saved.regions[ref].petal) throw new Error(`--anchor ${ref}: measure the reference without --anchor or --petal`)
    anchor = { region: ref, albedo: known, factor: +(lum(known) / lum(saved.regions[ref].mean)).toFixed(4) }
  }
  const factor = (petal ? 0.8 : 1) * (anchor?.factor ?? 1)
  const stats = Array.from({ length: k }, () => ({ n: 0, s: [0, 0, 0], q: [0, 0, 0], srgb: [0, 0, 0] }))
  for (let i = 0; i < n; i++) {
    const st = stats[label[i]]
    st.n++
    for (let c = 0; c < 3; c++) {
      const v = toLinear(px[i * 3 + c]) * factor
      st.s[c] += v; st.q[c] += v * v; st.srgb[c] += px[i * 3 + c]
    }
  }
  const r4 = v => +v.toFixed(4)
  const hex = rgb => '#' + rgb.map(v => Math.round(v * 255).toString(16).padStart(2, '0')).join('')
  const result = stats
    .filter(st => st.n / n >= minShare)
    .map(st => {
      const mean = st.s.map(v => v / st.n)
      return {
        share: +(st.n / n).toFixed(3),
        mean: mean.map(r4),
        spread: st.q.map((q, c) => r4(Math.sqrt(Math.max(0, q / st.n - mean[c] ** 2)))),
        srgb: hex(st.srgb.map(v => v / st.n)),
      }
    })
    .sort((a, b) => b.share - a.share)
  const all = { share: 1, mean: [0, 1, 2].map(c => r4(stats.reduce((s, st) => s + st.s[c], 0) / n)) }

  saved.sizeM = record.gltfBoxM ?? record.sizeM ?? null
  saved.regions[name] = { region, k, petal, hue, pixels: n, anchor, offHueShare: +(offHue / total).toFixed(3), clippedShare: +(clipped / total).toFixed(3), transparentShare: +(transparent / total).toFixed(3), mean: all.mean, clusters: result }
  await writeFile(file, JSON.stringify(saved, null, 2) + '\n')

  console.log(`${id}  ${record.kind}, ${record.licence}${record.author ? `, ${record.author}` : ''}${record.calibrated ? '' : ' (photo: exposure and white balance uncalibrated)'}`)
  console.log(`  ${record.page}`)
  if (saved.sizeM != null) console.log(`  size ${saved.sizeM.join(' × ')} m${record.gltfBoxM ? ' (glTF box)' : ''}`)
  console.log(`  ${name}: ${n} px in [${region.join(', ')}], clipped ${(clipped / total * 100).toFixed(1)}%${alpha ? `, transparent ${(transparent / total * 100).toFixed(1)}%` : ''}${hue ? `, hue ${hue[0]}–${hue[1]}° (${(offHue / total * 100).toFixed(1)}% left out)` : ''}${petal ? ', ×0.8 petal' : ''}${anchor ? `, ×${anchor.factor} by ${anchor.region}` : ''}`)
  console.log(`  mean linear [${all.mean.join(', ')}]`)
  for (const c of result) console.log(`  ${(c.share * 100).toFixed(1).padStart(5)}%  ${c.srgb}  linear [${c.mean.join(', ')}]  ± [${c.spread.join(', ')}]`)
  console.log(`  → ${file}`)

  // Recorded, so it can be measured again (assets-src/ isn't committed).
  const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : []
  const entry = { source: record.source, id, name, k, region, ...(petal ? { petal } : {}), ...(minShare !== 0.02 ? { minShare } : {}), ...(anchorArg != null ? { anchor: anchorArg } : {}), ...(hue != null ? { hue } : {}) }
  const at = manifest.findIndex(e => e.id === id && e.name === name)
  if (at >= 0) manifest[at] = entry
  else manifest.push(entry)
  await writeFile(MANIFEST, '[\n' + manifest.map(e => '  ' + JSON.stringify(e)).join(',\n') + '\n]\n')
}

/** The image with a labelled grid every 10%, to read a --region off. */
async function grid(src) {
  const known = idArg ?? (existsSync(join(ROOT, src)) ? src : null)
  const { dir } = known != null && existsSync(join(ROOT, known, 'source.json')) ? { dir: join(ROOT, known) } : await fetchSource(src)
  const image = ['albedo.jpg', 'photo.jpg'].map(f => join(dir, f)).find(existsSync)
  const browser = await chromium.launch()
  const page = await browser.newPage()
  const data = await page.evaluate(async url => {
    const img = await createImageBitmap(await (await fetch(url)).blob())
    const scale = Math.min(1, 1400 / img.width)
    const w = Math.round(img.width * scale), h = Math.round(img.height * scale)
    const c = new OffscreenCanvas(w, h)
    const g = c.getContext('2d')
    g.drawImage(img, 0, 0, w, h)
    g.font = `${Math.max(12, Math.round(w / 70))}px sans-serif`
    for (let i = 1; i < 10; i++) {
      for (const [x0, y0, x1, y1] of [[(i / 10) * w, 0, (i / 10) * w, h], [0, (i / 10) * h, w, (i / 10) * h]]) {
        g.strokeStyle = i === 5 ? 'rgba(255,255,0,0.9)' : 'rgba(255,255,255,0.7)'
        g.lineWidth = i === 5 ? 2 : 1
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke()
      }
      g.fillStyle = 'black'
      g.fillRect((i / 10) * w + 2, 2, g.font.length * 1.4, 18); g.fillRect(2, (i / 10) * h + 2, g.font.length * 1.4, 18)
      g.fillStyle = 'white'
      g.fillText((i / 10).toFixed(1), (i / 10) * w + 4, 16); g.fillText((i / 10).toFixed(1), 4, (i / 10) * h + 16)
    }
    const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.85 })
    const bytes = new Uint8Array(await blob.arrayBuffer())
    let s = ''
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return btoa(s)
  }, `data:image/jpeg;base64,${(await readFile(image)).toString('base64')}`)
  await browser.close()
  const out = join(dir, 'grid.jpg')
  await writeFile(out, Buffer.from(data, 'base64'))
  console.log(out)
}

if (command === 'fetch') {
  if (source == null) throw new Error('fetch SOURCE')
  const { id, dir, record } = await fetchSource(source)
  console.log(`${id}: ${record.kind}, ${record.licence}, ${record.author}\n  ${record.page}\n  → ${dir}`)
} else if (command === 'measure') {
  if (source == null && idArg == null) throw new Error('measure SOURCE|ID')
  await measure(source ?? idArg, cli)
} else if (command === 'grid') {
  if (source == null && idArg == null) throw new Error('grid SOURCE|ID')
  await grid(source ?? idArg)
} else if (command === 'replay') {
  const manifest = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : []
  for (const e of manifest.filter(e => source == null || e.id === source)) {
    // The source first (fetches it if missing), then by id.
    if (!existsSync(join(ROOT, e.id, 'source.json'))) await fetchSource(e.source)
    await measure(e.id, measureOptions({ minShare: 0.02, petal: false, anchor: null, hue: null, ...e }))
  }
} else if (command === 'list') {
  if (!existsSync(ROOT)) process.exit(0)
  for (const id of (await readdir(ROOT)).sort()) {
    const f = join(ROOT, id, 'source.json')
    if (!existsSync(f)) continue
    const r = JSON.parse(await readFile(f, 'utf8'))
    const m = existsSync(join(ROOT, id, 'measure.json')) ? Object.keys(JSON.parse(await readFile(join(ROOT, id, 'measure.json'), 'utf8')).regions) : []
    console.log(`${id.padEnd(40)} ${r.kind.padEnd(8)} ${r.licence.padEnd(14)} ${m.join(', ')}`)
  }
} else {
  throw new Error('command: fetch, measure, grid, list or replay (see the header)')
}
