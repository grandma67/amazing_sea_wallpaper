// Each plant kind's nearest in-frame instance, banded, for params.mjs --stats
// (arch/PROPS.md "Where each plant kind stands"):
//   node scripts/params.mjs --rendered --where 'p => p.coast.type !== "open-sea"' --stats "$(cat scripts/plant-near.js)"
p => {
  const out = {}
  const m = new (p.ctx.camera.matrixWorld.constructor)()
  for (const mesh of props.vegetation.createVegetation(p.ctx)) {
    const kind = mesh.userData.plantKind
    if (kind === 'grass') continue
    for (let i = 0; i < mesh.count; i++) {
      mesh.getMatrixAt(i, m)
      const [x, y, z] = [m.elements[12], m.elements[13], m.elements[14]]
      if (m.elements[0] === 0) continue
      if (!p.ctx.inFrame(x, y + 2, z, 1)) continue
      const d = p.ctx.distance(x, z)
      out[kind] = Math.min(out[kind] ?? 1e9, d)
    }
  }
  const band = d => d < 15 ? 'a <15 m' : d < 30 ? 'b 15-30' : d < 100 ? 'c 30-100' : d < 300 ? 'd 100-300' : 'e 300+'
  return Object.entries(out).map(([k, d]) => k + ' ' + band(d))
}
