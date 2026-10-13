// Deterministic, seedable randomness. Same seed string → same sequence on every
// browser, so a date always produces the same scene.

/** cyrb128: hashes a string into four 32-bit seeds. */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703
  let h2 = 3144134277
  let h3 = 1013904242
  let h4 = 2773480762
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i)
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067)
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233)
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213)
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179)
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067)
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233)
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213)
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179)
  h1 ^= h2 ^ h3 ^ h4
  h2 ^= h1
  h3 ^= h1
  h4 ^= h1
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0]
}

/** sfc32 PRNG returning floats in [0, 1). */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return () => {
    a |= 0
    b |= 0
    c |= 0
    d |= 0
    const t = (((a + b) | 0) + d) | 0
    d = (d + 1) | 0
    a = b ^ (b >>> 9)
    b = (c + (c << 3)) | 0
    c = (c << 21) | (c >>> 11)
    c = (c + t) | 0
    return (t >>> 0) / 4294967296
  }
}

export class Random {
  private readonly next: () => number

  constructor(seed: string) {
    const [a, b, c, d] = cyrb128(seed)
    this.next = sfc32(a, b, c, d)
    // Warm up: the first few outputs of sfc32 are poorly mixed.
    for (let i = 0; i < 15; i++) this.next()
  }

  /** Independent stream derived from this seed, so adding draws in one
   * subsystem doesn't reshuffle every other subsystem. */
  static derive(seed: string, stream: string): Random {
    return new Random(`${seed}/${stream}`)
  }

  float(): number {
    return this.next()
  }

  range(min: number, max: number): number {
    return min + (max - min) * this.next()
  }

  int(min: number, maxInclusive: number): number {
    return Math.floor(this.range(min, maxInclusive + 1))
  }

  chance(p: number): boolean {
    return this.next() < p
  }

  /** Standard normal via Box–Muller. */
  normal(mean = 0, std = 1): number {
    const u = 1 - this.next()
    const v = this.next()
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]
  }

  weighted<T>(items: readonly (readonly [T, number])[]): T {
    const total = items.reduce((sum, [, w]) => sum + w, 0)
    let r = this.next() * total
    for (const [item, w] of items) {
      r -= w
      if (r < 0) return item
    }
    return items[items.length - 1][0]
  }
}
