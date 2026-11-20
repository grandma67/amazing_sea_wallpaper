# Does module FROM reach module TO through value (non-type) imports? If so, FROM can't be
# imported by TO without an import cycle (TO would load half-initialised).
#   python3 -I scripts/dev/importReach.py src/terrain.ts src/params.ts
# Prints the chain, or "does not reach". Type-only imports don't count (erased at build).
import re, os, sys
root = os.getcwd()
frm, to = sys.argv[1], sys.argv[2]
def deps(f):
    src = open(f).read()
    out = []
    for m in re.finditer(r"^import\s+(type\s+)?(\{[^}]*\}|\w+(?:\s*,\s*\{[^}]*\})?|\*\s+as\s+\w+)\s+from\s+'(\.[^']+)'", src, re.M):
        if m.group(1): continue
        names = m.group(2)
        inner = re.sub(r"\btype\s+\w+\s*,?", "", names)
        if re.fullmatch(r"\{\s*\}", inner.strip()): continue
        p = os.path.normpath(os.path.join(os.path.dirname(f), m.group(3)))
        for ext in ('.ts', '/index.ts'):
            if os.path.exists(p + ext): out.append(p + ext); break
    return out
start = os.path.normpath(os.path.join(root, frm)); seen = {start: None}; q = [start]
while q:
    f = q.pop()
    for d in deps(f):
        if d not in seen: seen[d] = f; q.append(d)
target = os.path.normpath(os.path.join(root, to))
if target in seen:
    path = [target]
    while seen[path[-1]] is not None: path.append(seen[path[-1]])
    print(f'{to} is reached:', ' <- '.join(os.path.relpath(p, root) for p in path))
else:
    print(f'{frm} does not reach {to}')
