import { BufferAttribute, BufferGeometry } from 'three'

/**
 * A flat polar grid around the origin (where the camera sits), with rings
 * spaced geometrically so triangles stay roughly constant in screen size from
 * the camera's feet to the horizon.
 */
export function createPolarGrid({
  rings = 520,
  segments = 900,
  innerRadius = 0.25,
  outerRadius = 120_000
} = {}): BufferGeometry {
  const growth = (outerRadius / innerRadius) ** (1 / (rings - 1))

  const positions = new Float32Array((rings * segments + 1) * 3)
  // Centre vertex at index 0.
  let p = 3
  for (let i = 0; i < rings; i++) {
    const r = innerRadius * growth ** i
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2
      positions[p++] = r * Math.cos(a)
      positions[p++] = 0
      positions[p++] = r * Math.sin(a)
    }
  }

  const indices: number[] = []
  for (let j = 0; j < segments; j++) {
    indices.push(0, 1 + ((j + 1) % segments), 1 + j)
  }
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < segments; j++) {
      const a = 1 + i * segments + j
      const b = 1 + i * segments + ((j + 1) % segments)
      const c = 1 + (i + 1) * segments + j
      const d = 1 + (i + 1) * segments + ((j + 1) % segments)
      indices.push(a, b, c, b, d, c)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  return geometry
}
