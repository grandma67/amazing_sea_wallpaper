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
  `contrast: "auto"` picks the contrast that brings the log pattern's spread
  to `target` (default 0.3); every layer prints that value as a hint, and a
  warning when more than 3% of it clips.
  5. Mean 1, clipped to 0.15..1.95, stored as value / 2 in an 8-bit grey
     layer of SIZE x SIZE; layers stacked top to bottom in recipe order.

`mode: "whole"` instead bakes a whole object seen from above (a carapace) to be
mapped once onto it: see bake_whole.

Run through npm run skins [-- --only ID --preview DIR] (scripts/skins.mjs
sets up its Python with numpy, scipy and Pillow on first use).

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


def normalise(g):
    """Mean 1 within 0.15..1.95 (clipping moves the mean, so repeat)."""
    for _ in range(6):
        g = np.clip(g / g.mean(), 0.15, 1.95)
    return g


def bake_whole(r, lin):
    """A whole object seen from above (a carapace): `box` x0, y0, x1, y1 round it,
    `rotate` degrees clockwise so the head points right. Mapped once onto the
    object (no tiling); light divided out by a blur normalised inside the
    ellipse the box encloses, so the background doesn't darken the rim."""
    from scipy.ndimage import gaussian_filter
    x0, y0, x1, y1 = r['box']
    img = Image.fromarray(np.clip(lin[y0:y1, x0:x1] @ LUMA, 0, 1).astype(np.float32), 'F')
    img = img.rotate(-r.get('rotate', 0), expand=True)
    g = np.asarray(img.resize((SIZE * 2, SIZE * 2), Image.BILINEAR), np.float64)
    yy, xx = np.mgrid[0:SIZE * 2, 0:SIZE * 2]
    c = SIZE - 0.5
    # The object: inside the ellipse and not the (pale, studio) background.
    inside = (((xx - c) / SIZE) ** 2 + ((yy - c) / SIZE) ** 2 <= 0.97) & (g < r.get('background', 0.6))
    sigma = SIZE * 2 * 0.2
    light = gaussian_filter(g * inside, sigma) / np.maximum(gaussian_filter(inside.astype(float), sigma), 1e-3)
    g = g / np.maximum(light, 1e-4)
    g = np.minimum(g, np.percentile(g[inside], 100 * r.get('highlights', 0.98)))
    g = np.log(np.maximum(g, 1e-3))
    g = np.where(inside, g - g[inside].mean(), 0) * auto_contrast(r, g[inside])
    g = np.exp(g).reshape(SIZE, 2, SIZE, 2).mean((1, 3))
    return normalise(g)


TARGET = 0.3


def auto_contrast(r, g):
    """The recipe's contrast, or with `contrast: "auto"` the one that brings
    the log pattern's spread to `target` (default 0.3: the seal and fur-seal
    look; scales and scutes up to ~0.45). Prints the auto value for any recipe
    as a hint."""
    sigma = float(np.std(g))
    suggested = min(1.0, r.get('target', TARGET) / max(sigma, 1e-6))
    c = r.get('contrast', 1)
    if c == 'auto':
        c = suggested
    r['_suggested'] = round(suggested, 2)
    return c


def bake(r):
    photo = os.path.join(ROOT, 'assets-src', r['asset'], 'photo.jpg')
    if not os.path.exists(photo):
        sys.exit(f"{photo} missing: node scripts/asset.mjs fetch '{r['source']}' --id {r['asset']}")
    im = np.asarray(Image.open(photo).convert('RGB')).astype(np.float64) / 255
    lin = np.where(im <= 0.04045, im / 12.92, ((im + 0.055) / 1.055) ** 2.4)
    if r.get('mode') == 'whole':
        return bake_whole(r, lin)
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
    # `local` (a share of the patch height): divide by a blur that size too,
    # keeping only detail smaller than it (feather edges, not a bird's bars).
    if r.get('local'):
        from scipy.ndimage import gaussian_filter
        g = g / np.maximum(gaussian_filter(g, h * r['local'], mode='wrap'), 1e-4)
    # Specular glints on wet skin are light, not skin: cap them.
    g = np.minimum(g, np.percentile(g, 100 * r.get('highlights', 0.98)))
    g = np.log(np.maximum(g, 1e-3))
    g = tile(g, 1)
    if r.get('tileV'):
        g = tile(g, 0)
    elif r.get('mirror'):
        g = np.concatenate([g, g[::-1]], 0)
    contrast = auto_contrast(r, g)
    g = np.exp((g - g.mean()) * contrast)
    g = np.asarray(Image.fromarray(g.astype(np.float32), 'F').resize((SIZE, SIZE), Image.BILINEAR), np.float64)
    return normalise(g)


layers = []
for r in recipes:
    if a.only is not None and r['id'] != a.only:
        continue
    g = bake(r)
    layers.append(g)
    clipped = float(np.mean((g <= 0.1501) | (g >= 1.9499)))
    print(json.dumps({'id': r['id'], 'mean': round(float(g.mean()), 3), 'std': round(float(g.std()), 3),
                      'p5': round(float(np.percentile(g, 5)), 3), 'p95': round(float(np.percentile(g, 95)), 3),
                      'clipped': round(clipped, 3), 'contrast for target': r.get('_suggested')}))
    if clipped > 0.03:
        print(f"  ⚠ {r['id']}: {clipped:.0%} clipped to black or white: lower its contrast (or contrast: \"auto\"), or cap glints (highlights)")
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
