import { Box3, InstancedMesh, Matrix4, Vector3, type BufferGeometry, type Camera, type Object3D } from 'three'

// What the props placed and where it landed in the frame, for checking a
// feature from the snapshot JSON (debug.props) without looking at images:
// per kind, how many pieces, how many are in frame, the nearest one's
// distance and the pixel box round the ones in frame (snapshot.mjs --crop
// cuts it out).

export interface PropReport {
  /** Pieces placed (instances, or meshes). */
  placed: number
  /** Pieces whose box overlaps the frame. */
  inFrame: number
  /** Distance (m) to the nearest piece in frame, -1 if none. */
  nearest: number
  /** Pixel box [x0, y0, x1, y1] round the pieces in frame, clipped to it. */
  box: [number, number, number, number] | null
}

const corner = new Vector3()
const world = new Matrix4()
const boxes = new WeakMap<BufferGeometry, Box3>()

function geometryBox(geometry: BufferGeometry): Box3 {
  let box = boxes.get(geometry)
  if (box == null) {
    geometry.computeBoundingBox()
    box = geometry.boundingBox!.clone()
    boxes.set(geometry, box)
  }
  return box
}

/** Each piece's world-space box corners, projected; returns pixel boxes and
 * distances of the pieces in front of the camera and overlapping the frame. */
function pieces(object: Object3D, camera: Camera, width: number, height: number): { box: [number, number, number, number]; distance: number }[] | number {
  const geometry = (object as { geometry?: BufferGeometry }).geometry
  // A group (an animal of several meshes): its world box, as one piece.
  const local = geometry != null ? geometryBox(geometry) : new Box3().setFromObject(object)
  if (local.isEmpty()) return 0
  const matrices: Matrix4[] = []
  if (geometry == null) {
    matrices.push(new Matrix4())
  } else if (object instanceof InstancedMesh) {
    for (let i = 0; i < object.count; i++) {
      const m = new Matrix4()
      object.getMatrixAt(i, m)
      matrices.push(m.premultiply(object.matrixWorld))
    }
  } else {
    matrices.push(object.matrixWorld)
  }
  const out: { box: [number, number, number, number]; distance: number }[] = []
  const eye = camera.position
  for (const m of matrices) {
    world.copy(m)
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    let front = false
    const centre = local.getCenter(new Vector3()).applyMatrix4(world)
    for (let k = 0; k < 8; k++) {
      corner.set(k & 1 ? local.max.x : local.min.x, k & 2 ? local.max.y : local.min.y, k & 4 ? local.max.z : local.min.z).applyMatrix4(world).project(camera)
      if (corner.z > 1) continue
      front = true
      x0 = Math.min(x0, corner.x)
      x1 = Math.max(x1, corner.x)
      y0 = Math.min(y0, corner.y)
      y1 = Math.max(y1, corner.y)
    }
    if (!front || x1 < -1 || x0 > 1 || y1 < -1 || y0 > 1) continue
    const px = (v: number): number => Math.round(((Math.max(-1, Math.min(1, v)) + 1) / 2) * width)
    const py = (v: number): number => Math.round(((1 - Math.max(-1, Math.min(1, v))) / 2) * height)
    out.push({ box: [px(x0), py(y1), px(x1), py(y0)], distance: centre.distanceTo(eye) })
  }
  return out
}

/** Report on everything under `props`, by each object's userData.prop. */
export function reportProps(props: Object3D, camera: Camera, width: number, height: number): Record<string, PropReport> {
  props.updateMatrixWorld(true)
  camera.updateMatrixWorld()
  const report: Record<string, PropReport> = {}
  for (const object of props.children) {
    const kind = (object.userData.prop as string | undefined) ?? 'other'
    const entry = (report[kind] ??= { placed: 0, inFrame: 0, nearest: -1, box: null })
    entry.placed += object instanceof InstancedMesh ? object.count : 1
    const found = pieces(object, camera, width, height)
    if (typeof found === 'number') continue
    for (const { box, distance } of found) {
      entry.inFrame++
      entry.nearest = entry.nearest < 0 ? distance : Math.min(entry.nearest, distance)
      entry.box = entry.box == null ? box : [Math.min(entry.box[0], box[0]), Math.min(entry.box[1], box[1]), Math.max(entry.box[2], box[2]), Math.max(entry.box[3], box[3])]
    }
  }
  for (const entry of Object.values(report)) entry.nearest = Math.round(entry.nearest * 10) / 10
  return report
}
