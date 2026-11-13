import { DataArrayTexture, LinearFilter, LinearMipmapLinearFilter, NoColorSpace, RedFormat, RepeatWrapping, UnsignedByteType, type Material, type MeshStandardMaterial, type Vector3 } from 'three'

import recipes from './skins.json'

// Animal skins from photos: one atlas (public/assets/skins.png, a layer of
// SIZE² per skin, baked by scripts/skinBake.py from the recipes in
// skins.json). Each layer is a patch of an animal's side from a photo with
// its light divided out (row and column means), made to tile, stored as
// brightness only with mean 1 (value / 2, linear): the markings (spots,
// scutes, blotches, fur and feather grain). It multiplies the mesh's own
// measured colours, so the mean colour, the back-to-belly shading and wet
// darkening stay the builder's, and from afar (mipmaps) the animal looks as
// it did without.
//
// A vertex carries `skin` = (weight, u, v, layer): u in tiles along the body,
// v in tiles of arc down from the dorsal midline (both sides fold onto the
// same v, so there's no seam at the back or belly), both in metres scaled
// with the animal's length against the photo's (bigger animals, bigger
// scutes). Weight 0: untouched (eyes, mouths, beaks).

export type SkinId = (typeof recipes.skins)[number]['id']

interface Recipe {
  id: string
  x: number[]
  top: number[]
  bottom: number[]
  lengthM: number
  lengthPx?: number
  mPerPx?: number
  tileV?: boolean
  mirror?: boolean
}

const SIZE = 256
const RECIPES = recipes.skins as Recipe[]
export const SKIN_IDS = RECIPES.map(r => r.id) as SkinId[]

/** A skin's tile (m along, m down the side) on an animal as long as the
 * photo's, and that length. A mirrored patch repeats every two heights. */
export function skinTile(id: SkinId): { tile: [number, number]; length: number } {
  const r = RECIPES.find(s => s.id === id)
  if (r == null) throw new Error(`no skin ${id}`)
  const m = r.mPerPx ?? r.lengthM / (r.lengthPx ?? NaN)
  const height = (r.bottom[0] - r.top[0] + r.bottom[1] - r.top[1]) / 2
  return { tile: [(r.x[1] - r.x[0]) * m, height * m * (r.mirror === true ? 2 : 1)], length: r.lengthM }
}

const layerOf = (id: SkinId): number => SKIN_IDS.indexOf(id)

type Coords = [number, number, number]

/** A tube's skin coordinates (MeshBuilder.tube `skin`) for an animal
 * `length` m long, whose tube has `top` as the angle of its dorsal midline. */
export function skinCoords(id: SkinId, length: number, top = 0): (t: number, angle: number, r: number, along: number) => Coords {
  const { tile, length: photo } = skinTile(id)
  const k = length / photo
  const layer = layerOf(id)
  return (_t, angle, r, along) => {
    const a = (((angle - top) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    const fold = a <= Math.PI ? a : Math.PI * 2 - a
    return [along / (tile[0] * k), (fold * r) / (tile[1] * k), layer]
  }
}

/** A blob's skin coordinates (MeshBuilder.blob `skin`), from the vertex's
 * offset `p` (m, before the blob's rotation): `wrap` round the x axis like a
 * tube (a body), or `top` projected from above (a shell, a carapace).
 * `offset` (m) moves the pattern so two blobs of one animal don't match. */
export function skinBlob(id: SkinId, length: number, mode: 'wrap' | 'top', offset = 0): (n: Vector3, p: Vector3) => Coords {
  const { tile, length: photo } = skinTile(id)
  const k = length / photo
  const layer = layerOf(id)
  return (_n, p) => {
    if (mode === 'top') return [(p.x + offset) / (tile[0] * k), Math.abs(p.z) / (tile[1] * k), layer]
    const r = Math.hypot(p.y, p.z)
    const fold = Math.acos(Math.max(-1, Math.min(1, r > 0 ? p.y / r : 1)))
    return [(p.x + offset) / (tile[0] * k), (fold * r) / (tile[1] * k), layer]
  }
}

/** A whole object's skin (a recipe with `mode: "whole"`: a carapace seen
 * from above, head to +u) mapped once onto a blob with half-sizes `rx`
 * (along x, head at +x) and `rz` (across), projected from above. */
export function skinWhole(id: SkinId, rx: number, rz: number): (n: Vector3, p: Vector3) => Coords {
  const layer = layerOf(id)
  return (_n, p) => [p.x / (2 * rx) + 0.5, p.z / (2 * rz) + 0.5, layer]
}

let atlas: DataArrayTexture | null = null
let loading: Promise<void> | null = null

/** Load the atlas (once): before building the props that use it. Browser
 * only (the page and its render worker); in Node nothing loads and the
 * builders keep their own colours. */
export function loadSkins(): Promise<void> {
  loading ??= (async () => {
    const [{ assetUrl }] = await Promise.all([import('../assets')])
    const blob = await (await fetch(assetUrl('skins.png'))).blob()
    const bitmap = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' })
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (context == null) throw new Error('skins: no 2d context')
    context.drawImage(bitmap, 0, 0)
    const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data
    const layers = bitmap.height / SIZE
    if (bitmap.width !== SIZE || layers !== SKIN_IDS.length) throw new Error(`skins.png is ${bitmap.width}×${bitmap.height}, expected ${SIZE}×${SIZE * SKIN_IDS.length}: bake it again (scripts/skinBake.py)`)
    // Layer k is rows k·SIZE…: the image's own row order, so v runs down it.
    const grey = new Uint8Array(SIZE * SIZE * layers)
    for (let i = 0; i < grey.length; i++) grey[i] = rgba[i * 4]
    const texture = new DataArrayTexture(grey, SIZE, SIZE, layers)
    texture.format = RedFormat
    texture.type = UnsignedByteType
    texture.wrapS = RepeatWrapping
    texture.wrapT = RepeatWrapping
    texture.colorSpace = NoColorSpace
    texture.magFilter = LinearFilter
    texture.minFilter = LinearMipmapLinearFilter
    texture.generateMipmaps = true
    texture.anisotropy = 4
    texture.needsUpdate = true
    atlas = texture
  })()
  return loading
}

/** Whether skins are drawn today: the atlas loaded and `props.skins` not
 * switched off. */
export function skinsOn(overrides: { skins?: boolean } | undefined): boolean {
  return atlas != null && overrides?.skins !== false
}

/** Patch `material` (once) to multiply the vertices that have a `skin`
 * attribute by their skin layer (others: unchanged). */
export function skinMaterial<M extends Material>(material: M): M {
  const texture = atlas
  if (texture == null || material.userData.skin === true) return material
  material.userData.skin = true
  const standard = material as unknown as MeshStandardMaterial
  const previous = standard.onBeforeCompile
  const key = standard.customProgramCacheKey()
  standard.customProgramCacheKey = () => `${key}|skin`
  standard.onBeforeCompile = (shader, renderer) => {
    previous.call(standard, shader, renderer)
    shader.uniforms.skinAtlas = { value: texture }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', /* glsl */ `#include <common>
attribute vec4 skin;
varying vec4 vSkin;`)
      .replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
vSkin = skin;`)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', /* glsl */ `#include <common>
uniform highp sampler2DArray skinAtlas;
varying vec4 vSkin;`)
      .replace('#include <color_fragment>', /* glsl */ `#include <color_fragment>
diffuseColor.rgb *= mix(1.0, texture(skinAtlas, vec3(vSkin.yz, floor(vSkin.w + 0.5))).r * 2.0, vSkin.x);`)
  }
  return material
}

/** A standard material with skins, loading them first: for scripts/mesh.mjs
 * (`--material 'props/skins#skinPreviewMaterial()'`). */
export async function skinPreviewMaterial(roughness = 0.8): Promise<MeshStandardMaterial> {
  const { MeshStandardMaterial, DoubleSide } = await import('three')
  await loadSkins()
  return skinMaterial(new MeshStandardMaterial({ vertexColors: true, roughness, side: DoubleSide }))
}
