/**
 * Deterministic randomness.
 *
 * A seed string is hashed with xmur3 and fed to mulberry32, so the same seed
 * always yields the same sequence. Nothing here touches `Math.random()`, which
 * is what makes a generated course shareable as a URL instead of a JSON blob.
 */

/** xmur3 string hash — returns a 32-bit seed generator. */
export function hashString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** mulberry32 — small, fast, good enough for level layout. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build a named RNG from any string. */
export function createRng(seedString) {
  const nextSeed = hashString(String(seedString));
  const random = mulberry32(nextSeed());
  return new Rng(random);
}

export class Rng {
  constructor(random) {
    this.random = random;
  }

  /** Float in [0, 1). */
  next() {
    return this.random();
  }

  /** Float in [min, max). */
  range(min, max) {
    return min + this.random() * (max - min);
  }

  /** Integer in [min, max] inclusive. */
  int(min, max) {
    return Math.floor(min + this.random() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p) {
    return this.random() < p;
  }

  /** Uniform pick from a non-empty array. */
  pick(list) {
    return list[Math.floor(this.random() * list.length)];
  }

  /** Pick from `[{ value, weight }]`. */
  weighted(list) {
    const total = list.reduce((sum, item) => sum + item.weight, 0);
    let roll = this.random() * total;
    for (const item of list) {
      roll -= item.weight;
      if (roll <= 0) return item.value;
    }
    return list[list.length - 1].value;
  }

  /** Fisher-Yates on a copy. */
  shuffle(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}

/** Stable 8-hex id from any string, used as the random course key. */
export function hashId(str) {
  return hashString(String(str))().toString(16).padStart(8, '0').slice(0, 8);
}
