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

  /** A tube following `path`, with per-point radius and colour. */
  tube(
    path: Vector3[],
    radius: (t: number) => number,
    color: (t: number, angle: number) => [number, number, number],
    sides = 10
  ): void {
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
      const r = radius(t)
      const ring: number[] = []
      for (let s = 0; s < sides; s++) {
        const angle = (s / sides) * Math.PI * 2
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
