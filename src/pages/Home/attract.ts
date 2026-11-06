/*
 * Attract mode: when the home floor sits idle, one cabinet at a time
 * "wakes up" (the hover look plus a short loop of its icon), like the demo
 * reel of a real arcade machine. This file is the pure sequencing; the
 * timers and listeners live in useAttract.
 */

/** Quiet time on the home page before the first cabinet wakes. */
export const ATTRACT_IDLE_MS = 8000;
/** How long each cabinet stays awake (its icon loop runs about 3s). */
export const ATTRACT_DWELL_MS = 3200;
/** Full passes over the floor before resting until the next interaction. */
export const ATTRACT_ROUNDS = 2;

export interface AttractRun {
  /** Cabinets still to visit this round, in order. */
  queue: number[];
  /** 0-based round number. */
  round: number;
  /** The awake cabinet, or null before the first step. */
  current: number | null;
}

/**
 * A shuffled visiting order for one round. `avoidFirst` keeps a cabinet
 * from waking twice in a row across the round boundary.
 */
export function shuffledOrder(count: number, rng: () => number = Math.random, avoidFirst?: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  if (order.length > 1 && order[0] === avoidFirst) [order[0], order[1]] = [order[1], order[0]];
  return order;
}

export function startRun(count: number, rng: () => number = Math.random): AttractRun {
  return { queue: shuffledOrder(count, rng), round: 0, current: null };
}

/**
 * The next awake cabinet. Cabinets that are off screen are skipped (they
 * use up their turn this round). Returns null once ATTRACT_ROUNDS rounds
 * are done, or when nothing is on screen, so the spotlight rests.
 */
export function advance(
  run: AttractRun,
  count: number,
  isVisible: (index: number) => boolean,
  rng: () => number = Math.random,
): AttractRun | null {
  if (count === 0) return null;
  let { queue, round } = run;
  // At most every remaining cabinet plus every later round's cabinets.
  for (let guard = 0; guard <= count * (ATTRACT_ROUNDS + 1); guard++) {
    if (queue.length === 0) {
      round += 1;
      if (round >= ATTRACT_ROUNDS) return null;
      queue = shuffledOrder(count, rng, run.current ?? undefined);
    }
    const [next, ...rest] = queue;
    queue = rest;
    if (isVisible(next)) return { queue, round, current: next };
  }
  return null;
}
