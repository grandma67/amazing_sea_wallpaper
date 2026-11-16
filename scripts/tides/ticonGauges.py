import math, sys
sys.path.insert(0, '.')
from places import P
rows = {}
for line in open(sys.argv[1]):
    f = [x.strip() for x in line.split('\t')]
    if len(f) < 5: continue
    lat, lon, name, amp, g = float(f[0]), float(f[1]), f[2], float(f[3]), float(f[4])
    if lon > 180: lon -= 360
    rows.setdefault((lat, lon), {})[name] = (amp / 100, g % 360)
gauges = [(k, v) for k, v in rows.items() if all(n in v for n in ('M2', 'S2', 'K1', 'O1'))]
def km(a, b):
    p1, p2 = math.radians(a[0]), math.radians(b[0]); dl = math.radians(b[1] - a[1])
    return 6371 * math.acos(min(1, math.sin(p1)*math.sin(p2) + math.cos(p1)*math.cos(p2)*math.cos(dl)))
out = []
for pid, pt in P.items():
    (lat, lon), c = min(gauges, key=lambda g: km(pt, g[0]))
    d = km(pt, (lat, lon))
    F = (c['K1'][0] + c['O1'][0]) / (c['M2'][0] + c['S2'][0])
    out.append((pid, lat, lon, d, c, F))
    print(f"{pid:28s} {d:6.0f} km  F={F:5.2f}  M2={c['M2'][0]:.2f}", file=sys.stderr)
print("// Generated from TICON (Piccioni et al. 2019, GESLA-2 gauges): the nearest gauge to each place's")
print("// coastal point. [amplitude m, Greenwich phase lag deg]; lon east of the gauge. km: how far.")
print("export const TIDE_GAUGES: Record<string, TideGauge> = {")
for pid, lat, lon, d, c, F in out:
    con = ', '.join(f"{n}: [{c[n][0]:.3f}, {c[n][1]:.1f}]" for n in ('M2', 'S2', 'K1', 'O1'))
    print(f"  '{pid}': {{ lat: {lat:.2f}, lon: {lon:.2f}, km: {d:.0f}, {con} }},")
print("}")
