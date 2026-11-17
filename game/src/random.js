// Seeded random numbers for Solmar Bay.
// One job: every random choice in the world (buildings, traffic colours,
// pedestrian outfits, spawn points) comes from a seeded stream, so the same
// seed always builds the same city and the same screenshot scenes.

/** mulberry32: a small fast seeded PRNG with a clean 32-bit period. */
export function createRng(seed) {
  let state = (seed >>> 0) || 0x9e3779b9;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

/** A tiny helper bundle around one stream, so call sites read plainly. */
export function makeRandom(seed) {
  const next = createRng(seed);
  return {
    /** Float in [0, 1). */
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** One element of `items`, uniformly. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
    /** True with probability `p`. */
    chance(p) {
      return next() < p;
    },
    /** A fresh stream derived from this one, for a subsystem of its own. */
    fork(salt) {
      return makeRandom(((seed ^ Math.imul(salt, 0x85ebca6b)) >>> 0) || 1);
    },
  };
}

/** Read the ?seed= URL parameter, falling back to the default fixed seed. */
export function seedFromUrl(defaultSeed) {
  try {
    const raw = new URLSearchParams(window.location.search).get('seed');
    const parsed = raw === null ? NaN : parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : defaultSeed;
  } catch {
    return defaultSeed;
  }
}
