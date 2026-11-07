import { IcosahedronGeometry, type BufferGeometry } from 'three'
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js'

const spheres = new Map<number, BufferGeometry>()

/** A welded unit icosphere to shape, your own copy: welding takes three times
 * as long as shaping a rock, and is the same every time. The kept originals
 * never reach the GPU. */
export function unitSphere(detail: number): BufferGeometry {
  let sphere = spheres.get(detail)
  if (sphere == null) spheres.set(detail, (sphere = mergeVertices(new IcosahedronGeometry(1, detail))))
  return sphere.clone()
}
