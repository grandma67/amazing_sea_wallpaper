import { BufferAttribute, BufferGeometry, Quaternion, Vector3 } from 'three'

// Minimal mesh builder for procedural props: vertices with colours, triangles,
// and a few primitives (tubes along a path, blobs).

export class MeshBuilder {
  private readonly positions: number[] = []
  private readonly colors: number[] = []
  private readonly indices: number[] = []

  vertex(p: Vector3, color: [number, number, number]): number {
    this.positions.push(p.x, p.y, p.z)
    this.colors.push(...color)
    return this.positions.length / 3 - 1
  }

  triangle(a: number, b: number, c: number): void {
    this.indices.push(a, b, c)
  }

  quad(a: number, b: number, c: number, d: number): void {
    this.indices.push(a, b, c, a, c, d)
  }

  /** A tube following `path`, with radius and colour per point and angle
   * round it (so bark can have relief). Returns the vertex rings, so the
   * ends can be capped. */
  tube(
    path: Vector3[],
    radius: (t: number, angle: number) => number,
    color: (t: number, angle: number) => [number, number, number],
    sides = 10
  ): number[][] {
    const rings: number[][] = []
    const tangent = new Vector3()
    const normal = new Vector3()
    const binormal = new Vector3()
    const up = new Vector3(0, 0, 1)
    path.forEach((p, i) => {
      const next = path[Math.min(i + 1, path.length - 1)]
      const prev = path[Math.max(i - 1, 0)]
      tangent.subVectors(next, prev).normalize()
      normal.crossVectors(tangent, up)
      if (normal.lengthSq() < 1e-6) normal.set(1, 0, 0)
      normal.normalize()
      binormal.crossVectors(tangent, normal).normalize()
      const t = i / (path.length - 1)
      const ring: number[] = []
      for (let s = 0; s < sides; s++) {
        const angle = (s / sides) * Math.PI * 2
        const r = radius(t, angle)
        const offset = normal
          .clone()
          .multiplyScalar(Math.cos(angle) * r)
          .addScaledVector(binormal, Math.sin(angle) * r)
        ring.push(this.vertex(p.clone().add(offset), color(t, angle)))
      }
      rings.push(ring)
    })
    for (let i = 0; i < rings.length - 1; i++) {
      for (let s = 0; s < sides; s++) {
        const s2 = (s + 1) % sides
        this.quad(rings[i][s], rings[i][s2], rings[i + 1][s2], rings[i + 1][s])
      }
    }
    return rings
  }

  /** Close a tube's end ring with a fan of its own vertices (a crisp edge),
   * facing `outward`. */
  cap(ring: number[], outward: Vector3, color: [number, number, number]): void {
    const at = (i: number): Vector3 => new Vector3(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2])
    const points = ring.map(at)
    const center = points.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(points.length)
    const c = this.vertex(center, color)
    const rim = points.map(p => this.vertex(p, color))
    const turn = new Vector3().subVectors(points[0], center).cross(new Vector3().subVectors(points[1], center))
    const flip = turn.dot(outward) < 0
    for (let i = 0; i < rim.length; i++) {
      const a = rim[i]
      const b = rim[(i + 1) % rim.length]
      if (flip) this.triangle(c, b, a)
      else this.triangle(c, a, b)
    }
  }

  /** A flat ribbon along `path`: its width level (horizontal) for leaves and
   * blades lying on the ground, or along `across` for upright ones. */
  ribbon(
    path: Vector3[],
    width: (t: number) => number,
    color: [number, number, number] | ((t: number) => [number, number, number]),
    across?: Vector3
  ): void {
    let prev: [number, number] | null = null
    path.forEach((p, i) => {
      const next = path[Math.min(i + 1, path.length - 1)]
      const back = path[Math.max(i - 1, 0)]
      const side = across ?? new Vector3(-(next.z - back.z), 0, next.x - back.x).normalize()
      const t = i / (path.length - 1)
      const c = typeof color === 'function' ? color(t) : color
      const w = width(t) / 2
      const pair: [number, number] = [
        this.vertex(p.clone().addScaledVector(side, w), c),
        this.vertex(p.clone().addScaledVector(side, -w), c)
      ]
      if (prev != null) this.quad(prev[0], prev[1], pair[1], pair[0])
      prev = pair
    })
  }

  /** A lumpy ellipsoid: canopies, bushes, coconuts. */
  blob(
    center: Vector3,
    radii: Vector3,
    color: (n: Vector3) => [number, number, number],
    lump: (n: Vector3) => number,
    detail = 6,
    orient?: Quaternion
  ): void {
    const rows = detail * 2
    const cols = detail * 4
    const start = this.positions.length / 3
    const n = new Vector3()
    for (let r = 0; r <= rows; r++) {
      const phi = (r / rows) * Math.PI
      for (let c = 0; c <= cols; c++) {
        const theta = (c / cols) * Math.PI * 2
        n.set(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta))
        const k = lump(n)
        const p = new Vector3(n.x * radii.x * k, n.y * radii.y * k, n.z * radii.z * k)
        if (orient != null) p.applyQuaternion(orient)
        p.add(center)
        this.vertex(p, color(n))
      }
    }
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const a = start + r * (cols + 1) + c
        const b = a + cols + 1
        this.quad(a, b, b + 1, a + 1)
      }
    }
  }

  /** Append another builder's mesh, shifted by `offset`. */
  merge(other: MeshBuilder, offset: Vector3): void {
    const base = this.positions.length / 3
    for (let i = 0; i < other.positions.length; i += 3) {
      this.positions.push(other.positions[i] + offset.x, other.positions[i + 1] + offset.y, other.positions[i + 2] + offset.z)
    }
    this.colors.push(...other.colors)
    for (const index of other.indices) this.indices.push(index + base)
  }

  build(): BufferGeometry {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(this.positions), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(this.colors), 3))
    geometry.setIndex(this.indices)
    geometry.computeVertexNormals()
    // Blob poles only touch zero-area triangles, leaving zero normals that
    // become NaN in the shader (and white bloom specks). Point them up/down.
    const normals = geometry.attributes.normal as BufferAttribute
    for (let i = 0; i < normals.count; i++) {
      const x = normals.getX(i)
      const y = normals.getY(i)
      const z = normals.getZ(i)
      if (x * x + y * y + z * z < 1e-12) normals.setXYZ(i, 0, 1, 0)
    }
    return geometry
  }
}
