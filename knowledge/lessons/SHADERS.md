# Lessons: Shaders

GLSL pitfalls. Other topics: [LESSONS.md](../LESSONS.md).

## Shaders (GLSL)

- **A target's texel type bounds what a shader may write (0.204):** a `HalfFloatType` target holds
  ≤ 65 504; metres (a depth, a ray length) pass that past 65 km. Apple GPUs saturate the write,
  SwiftShader writes ∞, and linear filtering turns ∞ next to finite into NaN. Takram's cloud shadow
  map did this under every low sun (2026-11-17 published white). When a value can be large, check
  the target's type (`grep HalfFloatType`) and clamp the write.
- **Dump intermediates only into what is read raw:** a value written into a buffer that a temporal
  resolve reads back (reprojects by its depth, clips by its neighbours) comes out scrambled: every
  dump into takram's shadow map read NaN, even a sum of finite uniforms, until its resolve was
  switched off for the dump. That cost three renders and a wrong theory (bad uniforms).
- **After fixing the first NaN, re-render the day:** others hide behind it (2024-02-19 had three
  more once the overflow was gone: a 0/0, a resolve blend, a light-shaft march). Guard the reader
  too (a bad texel reads as "no shadow"), not only the writer.

- Reserved words that read like names: `flat`, `smooth`, `half`, `input`, `output`, `filter`,
  `active`, `common`, `partition`, `fixed`, `long`, `short`. `smoothstep(e0, e1, x)` with e0 ≥ e1 is
  undefined (works on one GPU, not another): write `1.0 - smoothstep(e1, e0, x)`. Both show only at
  render time.
- **Take screen derivatives before adding a large offset (sea ice, 0.114):** `dFdx(world + origin)`
  at ±50 km drew radial streaks near the camera. Forced specs drew small origins; the real day showed
  it: render a real day when a seed feeds a shader.
- Never leave a `sampler2DShadow` uniform `null`: three r186's fallback is never uploaded, so it binds
  a plain RGBA texture and the GPU silently drops the draw ("Mismatch between texture format and
  sampler type"). Start it on an allocated depth texture (`shadow.ts` `noShadowMap`). Headless
  snapshots don't echo GL errors from the worker: `?worker=0` and `gl.getError()` after draws.
- A render target cleared to (0,0,0,0) holds premultiplied colour in its mips: `mix(x, rgb, a)`
  weights content by a² and leaves a bright fringe. Use `x · (1 − a) + rgb`.
- **A layered ray march (aurora: 28 layers) aliases into stripes** along whatever it point-samples
  between layers: fine noise along the ray (fade it to its mean past half its period), a sheet
  thinner than the step (widen it to the step and its own motion between samples), a profile thinner
  than the layers (average it over the layer: erf for a Gaussian). Then one layer offset per pixel
  turns what's left into grain. Check each in the TS mirror first. A `fract(sin(dot(gl_FragCoord…)))`
  hash loses precision at 1e5 in float32: use interleaved gradient noise.
- A shader with a CPU mirror hashes noise with integers (`skyMirror.ts` `hashGlsl`/`hashCell`, PCG):
  uint math is exact in WebGL2 and JS (`Math.imul`). Any float hash ends in the fract of a large
  product float32 rounds differently (airglow fbm 0.63 on the CPU, 0.22 on the GPU). Each patch
  prefixes its copy (`ng`, `au`): patches share one shader.
- **Fine shader detail needs small coordinates and the surface's own footprint (rock grain, 0.198):** `q =
  p + noiseOffset` reaches ±5000 m, so millimetre cells there are float noise; use world position plus the
  offset mod a few tens of metres. The terrain's `footprint` assumes flat ground: on a steep face seen head-on
  it is many times too big and fades the detail out; divide by |N·V| instead. Noise read in x, z smears down
  steep heightfield faces: blend three planes by the normal.
- **A hard threshold on noise turns to flecks once a pixel spans a cell (lichen, 0.230):** the rocks'
  `smoothstep(0.72, 0.78, noise)` spots read as white single pixels on stacks at 650 m, first taken
  for spray. Widen the edge to `fwidth(noise)` and fade to the mask's mean cover (measure it: Monte
  Carlo of the shader's own hash) by `fwidth(coords)`; near detail stays.
- Screen-space derivatives explode on silhouettes: clamp footprints, or NaN normals become white
  bloom dashes (Metal fast-math also defeats `isnan`). Overflowing `exp()` gave NaN terrain.
  `min(NaN, x)` is undefined: Apple GPUs give x, x86 SwiftShader keeps the NaN and bloom spreads it
  over the frame as black (CI 0.195). The frame meter zeroes NaN/±∞ by their bits (`frameNonFinite`).
- **Unprojecting a depth near 1 divides by w ≈ 0** (0.195): the Mac got huge finite distances, x86
  SwiftShader ∞, then NaN. Cap every distance read from a depth buffer with a comparison NaN also
  fails (`len < 1e5 ? … : 1e5`), not `min()`.
- A refactor of shader maths into a function can move single pixels at sharp edges (float order):
  diff against HEAD and zoom before calling it a logic change.
- To read one shader term on the GPU, don't test a constant expression (`ngHash(vec2(3.0, 1.0))`):
  the compiler folds it at higher precision (tools/DEBUG.md "Lines of pixels").
