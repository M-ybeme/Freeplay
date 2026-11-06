import { describe, expect, it } from "vitest";
import { ATTRACT_ROUNDS, advance, shuffledOrder, startRun, type AttractRun } from "./attract";

/** Deterministic rng (mulberry32). */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Every cabinet the spotlight lights, in order, until it rests. */
function playOut(count: number, isVisible: (i: number) => boolean, seed = 1): number[] {
  const rng = seeded(seed);
  const lit: number[] = [];
  let run: AttractRun | null = startRun(count, rng);
  while ((run = advance(run, count, isVisible, rng))) lit.push(run.current!);
  return lit;
}

describe("shuffledOrder", () => {
  it("is a permutation of every cabinet", () => {
    for (let seed = 1; seed < 20; seed++) {
      expect([...shuffledOrder(12, seeded(seed))].sort((a, b) => a - b)).toEqual([...Array(12).keys()]);
    }
  });

  it("never starts with the cabinet to avoid", () => {
    for (let seed = 1; seed < 200; seed++) {
      expect(shuffledOrder(12, seeded(seed), 5)[0]).not.toBe(5);
    }
  });

  it("handles one and zero cabinets", () => {
    expect(shuffledOrder(1, seeded(1), 0)).toEqual([0]);
    expect(shuffledOrder(0)).toEqual([]);
  });
});

describe("advance", () => {
  it("lights each cabinet once per round, then rests", () => {
    const lit = playOut(12, () => true);
    expect(lit).toHaveLength(12 * ATTRACT_ROUNDS);
    for (let r = 0; r < ATTRACT_ROUNDS; r++) {
      expect([...lit.slice(r * 12, r * 12 + 12)].sort((a, b) => a - b)).toEqual([...Array(12).keys()]);
    }
  });

  it("never lights the same cabinet twice in a row", () => {
    for (let seed = 1; seed < 100; seed++) {
      const lit = playOut(12, () => true, seed);
      for (let i = 1; i < lit.length; i++) expect(lit[i]).not.toBe(lit[i - 1]);
    }
  });

  it("skips cabinets that are off screen", () => {
    const onScreen = new Set([0, 1, 2, 3]);
    const lit = playOut(12, (i) => onScreen.has(i));
    expect(lit.every((i) => onScreen.has(i))).toBe(true);
    expect(lit).toHaveLength(4 * ATTRACT_ROUNDS);
  });

  it("rests straight away when nothing is on screen", () => {
    expect(advance(startRun(12, seeded(1)), 12, () => false)).toBeNull();
  });

  it("rests with no cabinets", () => {
    expect(advance(startRun(0), 0, () => true)).toBeNull();
  });
});
