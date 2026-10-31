import { CylinderGeometry, Group, InstancedMesh, Matrix4, MeshStandardMaterial, Quaternion, Vector3, type Mesh, type Object3D } from 'three'

import type { PropContext } from './context'
import { createBeachrock } from './beachrock'
import { createBirds } from './birds'
import { createRollCloud, createShelfCloud } from './cloudEvents'
import { createColony } from './colony'
import { createDebris } from './debris'
import { createIce } from './ice'
import { createIslands } from './islands'
import { createLandforms } from './landforms'
import { createLighthouse } from './lighthouse'
import { createMangroves } from './mangroves'
import { createMarineLife } from './marine'
import { createMigratoryBirds } from './migratory'
import { createPinnipeds } from './pinnipeds'
import { createRocks } from './rocks'
import { createShips } from './ships'
import { createShoreLife } from './shoreLife'
import { createStones } from './stones'
import { createStorm } from './storm'
import { createSurf, edgeRocks, waterRocks, waveOnRock } from './surf'
import { createVegetation } from './vegetation'
import { createWaterspout } from './waterspout'
import { createWildlife } from './wildlife'

/** Everything placed in the scene on top of sea, sky and terrain. */
export function createProps(ctx: PropContext): Group {
  const group = new Group()
  group.name = 'props'
  // Build time (ms) per kind, for snapshot.mjs --props.
  const times: Record<string, number> = {}
  group.userData.times = times
  // debug.props false: no props (markers still come).
  const off = ctx.params.debug?.props === false
  /** Runs a creator and adds its objects, tagged with its kind for
   * reportProps(), timing it. */
  const add = <T extends Object3D>(kind: string, create: () => T[]): T[] => {
    if (off && kind !== 'markers') return []
    const start = performance.now()
    const objects = create()
    times[kind] = (times[kind] ?? 0) + performance.now() - start
    for (const o of objects) {
      o.userData.prop = kind
      group.add(o)
    }
    return objects
  }
  add('landforms', () => createLandforms(ctx))
  const rocks = add('rocks', () => createRocks(ctx))
  add('surf', () => createSurf(ctx, rocks))
  // For the ocean's foam round them (ocean.ts setOceanRocks).
  group.userData.waterRocks = (off ? [] : [...waterRocks(ctx, rocks), ...edgeRocks(ctx)]).map(r => ({ ...r, breaks: waveOnRock(ctx.params.coast, r, ctx.waveHeight).breaks }))
  add('ice', () => createIce(ctx))
  // Where mesh stones replace the shader's (terrain.ts stoneMeshRadius).
  group.userData.stoneRadius = add('stones', () => createStones(ctx))[0]?.userData.stoneRadius ?? [0, 0, 0]
  add('beachrock', () => createBeachrock(ctx))
  add('debris', () => createDebris(ctx))
  add('shore-life', () => createShoreLife(ctx))
  add('wildlife', () => createWildlife(ctx))
  const colony = add('colony', () => createColony(ctx))
  const island = (colony.find(o => o.userData.island === true) as Mesh | undefined) ?? null
  add('islands', () => createIslands(ctx, island))
  add('pinnipeds', () => createPinnipeds(ctx, island))
  add('lighthouse', () => createLighthouse(ctx, island))
  add('vegetation', () => createVegetation(ctx))
  add('mangroves', () => createMangroves(ctx))
  // For their wakes and the hull cut out of the sea (ocean.ts setOceanShips).
  group.userData.ships = add('ships', () => createShips(ctx)).flatMap(o => o.userData.wake ?? [])
  add('marine-life', () => createMarineLife(ctx))
  add('birds', () => createBirds(ctx))
  add('migratory-birds', () => createMigratoryBirds(ctx))
  add('storm', () => createStorm(ctx))
  add('waterspout', () => createWaterspout(ctx))
  add('shelf-cloud', () => createShelfCloud(ctx))
  add('roll-cloud', () => createRollCloud(ctx))
  add('markers', () => createMarkers(ctx, group))
  return group
}

/** Marker colours by source, in order. */
const MARKER_COLORS = [0xff2020, 0x20d0ff, 0xffd020, 0x40ff40, 0xff40ff, 0xffffff]

/** Debug markers (debug.ts): a post at each point of each source, coloured
 * by source, ~6 px wide and at least 1 m tall whatever the distance. */
function createMarkers(ctx: PropContext, group: Group): InstancedMesh[] {
  const sources = ctx.params.debug?.markers ?? []
  const meshes: InstancedMesh[] = []
  const camera = ctx.camera.position
  sources.forEach((source, i) => {
    const points: Vector3[] = []
    if (source === 'camera-ground') points.push(new Vector3(camera.x, ctx.ground(camera.x, camera.z), camera.z))
    else if (source === 'edge-rocks') for (const r of edgeRocks(ctx)) points.push(new Vector3(r.x, r.top, r.z))
    else if (source === 'water-rocks') for (const r of group.userData.waterRocks as { x: number; z: number; top: number }[]) points.push(new Vector3(r.x, r.top, r.z))
    else if (source.startsWith('props:')) {
      const kind = source.slice(6)
      const m = new Matrix4()
      group.traverse(o => {
        if (o.userData.prop !== kind) return
        if (o instanceof InstancedMesh) {
          for (let k = 0; k < o.count; k++) points.push(new Vector3().setFromMatrixPosition((o.getMatrixAt(k, m), m)).applyMatrix4(o.matrixWorld))
        } else if ((o as Mesh).isMesh === true) points.push(o.getWorldPosition(new Vector3()))
      })
    }
    if (points.length === 0) return
    const mesh = new InstancedMesh(new CylinderGeometry(1, 1, 1, 8).translate(0, 0.5, 0), new MeshStandardMaterial({ color: MARKER_COLORS[i % MARKER_COLORS.length], roughness: 0.6 }), points.length)
    points.forEach((p, k) => {
      const d = Math.max(1, p.distanceTo(camera))
      const width = Math.max(0.05, 3 * d * ctx.pixelAngle)
      mesh.setMatrixAt(k, new Matrix4().compose(p, new Quaternion(), new Vector3(width, Math.max(1, 15 * width), width)))
    })
    mesh.frustumCulled = false
    mesh.userData.source = source
    meshes.push(mesh)
  })
  return meshes
}
