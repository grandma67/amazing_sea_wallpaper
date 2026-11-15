// Each plant kind's nearest in-frame instance, banded, for params.mjs --stats
// (arch/PROPS.md "Where each plant kind stands"):
//   node scripts/params.mjs --rendered --where 'p => p.coast.type !== "open-sea"' --stats "$(cat scripts/plant-near.js)"
// (p.plants: vegetation.ts plantInstances; inFrame tests the plant's middle.)
p => {
  const out = {}
  for (const t of p.plants) {
    if (t.kind === 'grass' || !t.inFrame) continue
    out[t.kind] = Math.min(out[t.kind] ?? 1e9, t.distance)
  }
  const band = d => d < 15 ? 'a <15 m' : d < 30 ? 'b 15-30' : d < 100 ? 'c 30-100' : d < 300 ? 'd 100-300' : 'e 300+'
  return Object.entries(out).map(([k, d]) => k + ' ' + band(d))
}
