"""Bake the animal skin atlas (public/assets/skins.png) from photos.

Every recipe in src/props/skins.json names a photo (fetched by
`node scripts/asset.mjs fetch SOURCE --id ID` into assets-src/ID/photo.jpg,
git-ignored) and a patch of the animal's side: x0..x1 and a top and a bottom
line (near the dorsal midline and low on the flank). For each:

  1. Sample the patch between the two lines (u along the body, v down the
     side), sRGB -> linear.
  2. Delight: divide by the light's slow change, the row mean down the side
     (the body turning from the sun) and a wide blur of the column mean along
     it (exposure drift). Spots, scutes and blotches are smaller and stay.
  3. Brightness only (a shadow lit by blue sky has the sky's hue, not the
     skin's), in log space; `contrast` < 1 softens crevice shadow.
  4. Tile: along u always, by cross-fading with a copy rolled half a tile
     (weights 0 on each copy's seam; the blended deviation divided by
     sqrt(wA^2 + wB^2) keeps the contrast). Down v: `tileV` the same way, or
     `mirror` (the patch, then itself flipped: a patch from the back to the
     flank only, continued symmetrically).
  Before 3, `highlights` (a quantile, default 0.98) caps glints on wet skin.
  5. Mean 1, clipped to 0.15..1.95, stored as value / 2 in an 8-bit grey
     layer of SIZE x SIZE; layers stacked top to bottom in recipe order.

Needs Python 3 with numpy, scipy and Pillow:
  python3 -m venv .venv-skins && .venv-skins/bin/pip install numpy scipy pillow
  .venv-skins/bin/python scripts/skinBake.py [--only ID] [--preview DIR]

--preview DIR writes each layer repeated 3 x 2 (DIR/ID.png) to check joins.
"""
import argparse, json, os, sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter1d, map_coordinates

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SIZE = 256
LUMA = np.array([0.2126, 0.7152, 0.0722])

ap = argparse.ArgumentParser()
ap.add_argument('--only', default=None)
ap.add_argument('--preview', default=None)
a = ap.parse_args()

recipes = json.load(open(os.path.join(ROOT, 'src/props/skins.json')))['skins']


def tile(img, axis):
    n = img.shape[axis]
    rolled = np.roll(img, n // 2, axis)
    w = np.sin(np.pi * (np.arange(n) + 0.5) / n) ** 2
    shape = [1] * img.ndim
    shape[axis] = n
    wa = w.reshape(shape)
    wb = 1 - wa
    m = img.mean()
    return m + (wa * (img - m) + wb * (rolled - m)) / np.sqrt(wa ** 2 + wb ** 2)


def bake(r):
    photo = os.path.join(ROOT, 'assets-src', r['asset'], 'photo.jpg')
    if not os.path.exists(photo):
        sys.exit(f"{photo} missing: node scripts/asset.mjs fetch '{r['source']}' --id {r['asset']}")
    im = np.asarray(Image.open(photo).convert('RGB')).astype(np.float64) / 255
    lin = np.where(im <= 0.04045, im / 12.92, ((im + 0.055) / 1.055) ** 2.4)
    x0, x1 = r['x']
    t0, t1 = r['top']
    b0, b1 = r['bottom']
    w = int(round(x1 - x0)) * 2
    h = int(round(((b0 - t0) + (b1 - t1)) / 2)) * 2
    uu, vv = np.meshgrid((np.arange(w) + 0.5) / w, (np.arange(h) + 0.5) / h)
    x = x0 + (x1 - x0) * uu
    top = t0 + (t1 - t0) * uu
    y = top + (b0 + (b1 - b0) * uu - top) * vv
    s = np.stack([map_coordinates(lin[..., c], [y, x], order=1) for c in range(3)], -1)
    s = s / gaussian_filter1d(s.mean(1, keepdims=True), h * 0.08, axis=0, mode='nearest')
    s = s / gaussian_filter1d(s.mean(0, keepdims=True), w * 0.5, axis=1, mode='wrap')
    g = s @ LUMA
    # Specular glints on wet skin are light, not skin: cap them.
    g = np.minimum(g, np.percentile(g, 100 * r.get('highlights', 0.98)))
    g = np.log(np.maximum(g, 1e-3))
    g = tile(g, 1)
    if r.get('tileV'):
        g = tile(g, 0)
    elif r.get('mirror'):
        g = np.concatenate([g, g[::-1]], 0)
    g = np.exp((g - g.mean()) * r.get('contrast', 1))
    g = np.asarray(Image.fromarray(g.astype(np.float32), 'F').resize((SIZE, SIZE), Image.BILINEAR), np.float64)
    g = np.clip(g / g.mean(), 0.15, 1.95)
    return g


layers = []
for r in recipes:
    if a.only is not None and r['id'] != a.only:
        continue
    g = bake(r)
    layers.append(g)
    print(json.dumps({'id': r['id'], 'mean': round(float(g.mean()), 3), 'std': round(float(g.std()), 3),
                      'p5': round(float(np.percentile(g, 5)), 3), 'p95': round(float(np.percentile(g, 95)), 3)}))
    if a.preview is not None:
        os.makedirs(a.preview, exist_ok=True)
        img = Image.fromarray(np.round(g / 2 * 255).astype(np.uint8), 'L')
        sheet = Image.new('L', (SIZE * 3, SIZE * 2))
        for i in range(3):
            for j in range(2):
                sheet.paste(img, (i * SIZE, j * SIZE))
        sheet.save(os.path.join(a.preview, f"{r['id']}.png"))

if a.only is None:
    atlas = np.round(np.concatenate(layers, 0) / 2 * 255).astype(np.uint8)
    out = os.path.join(ROOT, 'public/assets/skins.png')
    Image.fromarray(atlas, 'L').save(out, optimize=True)
    print(f'{out}: {len(layers)} layers, {os.path.getsize(out) // 1024} kB')
