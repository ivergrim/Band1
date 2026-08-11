/**
 * Seeded RNG. The scheduler shuffles event order between attempts (doc 8.3), and
 * that shuffle has to be reproducible from a seed so a run can be replayed and,
 * more importantly, so a bad shuffle can be reported and reproduced.
 */
export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0 || 0x9e3779b9;
  }

  /** mulberry32. */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }

  range(lo: number, hi: number): number {
    return lo + this.next() * (hi - lo);
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(items.length)];
  }

  shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      const tmp = items[i];
      items[i] = items[j];
      items[j] = tmp;
    }
    return items;
  }
}

/** Deterministic hash so per-object wobble is stable across frames. */
export function hash01(a: number, b = 0): number {
  let h = (Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2545f491) >>> 0;
  return (h >>> 8) / 16777216;
}
