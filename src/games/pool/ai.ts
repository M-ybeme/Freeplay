/*
 * The computer player. For each ball it may hit and each pocket it finds
 * the ghost-ball aim and checks both paths are clear; stronger levels then
 * play their best few candidates out in the (deterministic) physics and
 * keep one that pots and, at the top, leaves a next shot. Execution noise
 * in aim and power then shrinks as the level rises.
 */
import {
  type BallSpot,
  type Level,
  type RackState,
  canPlaceCue,
  legalTargets,
  onTheEight,
  playOut,
} from "./logic";
import { type Spin, BALL_R, FOOT_SPOT, HEAD_X, POCKETS, TABLE_H, TABLE_W, nextRandom } from "./physics";

export interface ShotPlan {
  /** Where to put the cue ball first, with ball in hand. */
  place: { x: number; y: number } | null;
  angle: number;
  power: number;
  spin: Spin;
  /** The pocket called for the 8. */
  called: number | null;
}

/** How each level plays. Every number moves smoothly from 1 (Rookie) to 10 (Shark). */
export function profile(level: Level) {
  const weak = (10 - level) / 9; // 1 at level 1, 0 at level 10
  return {
    /** Standard deviation of the aim, in degrees. */
    aimNoise: 0.12 + 3.4 * weak ** 1.5,
    /** Standard deviation of the power, as a fraction. */
    powerNoise: 0.03 + 0.22 * weak,
    /** How many candidate shots it plays out in its head. */
    lookahead: [0, 1, 2, 3, 4, 5, 6, 7, 8, 10][level - 1],
    /** Thinks about where the cue ball ends up. */
    position: level >= 7,
    /** Uses top and back spin for position. */
    spin: level >= 7,
    /** Plays safe when nothing good is on. */
    safety: level >= 6,
  };
}

interface Rng {
  next(): number;
  gauss(): number;
}

function rng(seed: number): Rng {
  let s = seed;
  const next = () => {
    const [x, n] = nextRandom(s);
    s = n;
    return x;
  };
  return {
    next,
    gauss: () => {
      const u = Math.max(next(), 1e-9);
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next());
    },
  };
}

/** Where to aim an object ball for each pocket: the corner itself, or into a side pocket's throat. */
const POCKET_AIM = POCKETS.map((p, i) => (i === 1 || i === 4 ? { x: p.x, y: p.y + (p.y === 0 ? -1.5 : 1.5) } : p));

/** Is the straight path a→b clear of other balls (a ball's centre must stay 2R from the line)? */
function clearPath(balls: readonly BallSpot[], ax: number, ay: number, bx: number, by: number, skip: number[]): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-9;
  for (const b of balls) {
    if (b.pocket !== null || skip.includes(b.id)) continue;
    const t = Math.max(0, Math.min(1, ((b.x - ax) * dx + (b.y - ay) * dy) / len2));
    const px = ax + t * dx - b.x;
    const py = ay + t * dy - b.y;
    if (px * px + py * py < (2 * BALL_R - 0.02) ** 2) return false;
  }
  return true;
}

export interface Candidate {
  target: number;
  pocket: number;
  angle: number;
  power: number;
  /** Higher is easier. */
  ease: number;
}

/** Power (0-1) giving roughly this cue speed. */
function powerFor(speed: number): number {
  return Math.min(1, Math.max(0.04, ((speed - 6) / (320 - 6)) ** (1 / 1.6)));
}

/** Every makeable-looking pot from cue position (cx, cy). */
export function candidates(rack: RackState, cx: number, cy: number): Candidate[] {
  const out: Candidate[] = [];
  for (const id of legalTargets(rack)) {
    const ob = rack.balls[id];
    if (ob.pocket !== null) continue;
    POCKET_AIM.forEach((p, pocket) => {
      const tx = p.x - ob.x;
      const ty = p.y - ob.y;
      const d2 = Math.hypot(tx, ty);
      const ux = tx / d2;
      const uy = ty / d2;
      // Side pockets only take balls coming in fairly square.
      if ((pocket === 1 || pocket === 4) && Math.abs(uy) < 0.55) return;
      const gx = ob.x - 2 * BALL_R * ux;
      const gy = ob.y - 2 * BALL_R * uy;
      const ax = gx - cx;
      const ay = gy - cy;
      const d1 = Math.hypot(ax, ay);
      if (d1 < 0.01) return;
      const cos = (ax * ux + ay * uy) / d1;
      if (cos < 0.2) return;
      if (!clearPath(rack.balls, cx, cy, gx, gy, [0, id])) return;
      if (!clearPath(rack.balls, ob.x, ob.y, p.x, p.y, [id])) return;
      // Enough speed for the object ball to reach the pocket with some to spare.
      const obSpeed = Math.sqrt(2 * 10 * (d2 + 8)) / 0.75;
      const atContact = obSpeed / Math.max(cos, 0.3);
      const speed = Math.sqrt(atContact ** 2 + 2 * 65 * d1);
      out.push({ target: id, pocket, angle: Math.atan2(ay, ax), power: powerFor(speed), ease: cos ** 2 / (1 + (d1 + 1.6 * d2) / 45) });
    });
  }
  return out.sort((a, b) => b.ease - a.ease);
}

/** How good the table is for whoever shoots next from here (best candidate's ease). */
function bestEase(rack: RackState): number {
  const cue = rack.balls[0];
  if (rack.ballInHand) return 1;
  return candidates(rack, cue.x, cue.y)[0]?.ease ?? 0;
}

/** Did the shot keep the turn without losing? */
function goodResult(before: RackState, after: RackState): boolean {
  if (after.phase === "over") return after.winner === before.turn;
  return after.turn === before.turn && !after.ballInHand && after.phase !== "break";
}

/** Plan a break: from behind the head string, straight into the apex. */
function planBreak(rack: RackState, level: Level, r: Rng): ShotPlan {
  const y = TABLE_H / 2 + (r.next() - 0.5) * 6;
  const place = { x: HEAD_X - 2, y };
  const angle = Math.atan2(FOOT_SPOT.y - y, FOOT_SPOT.x - place.x) + (r.gauss() * profile(level).aimNoise * Math.PI) / 360;
  return { place: canPlaceCue(rack, place.x, place.y) ? place : null, angle, power: 0.85 + 0.15 * (level / 10), spin: { x: 0, y: 0 }, called: null };
}

/** With ball in hand: a spot straight behind the easiest pot. */
function chooseSpot(rack: RackState): { x: number; y: number } {
  let best = { x: TABLE_W / 4, y: TABLE_H / 2 };
  let bestEase = -1;
  for (const id of legalTargets(rack)) {
    const ob = rack.balls[id];
    POCKET_AIM.forEach((p, pocket) => {
      const tx = p.x - ob.x;
      const ty = p.y - ob.y;
      const d = Math.hypot(tx, ty);
      if ((pocket === 1 || pocket === 4) && Math.abs(ty / d) < 0.55) return;
      for (const back of [9, 14, 6]) {
        const x = ob.x - (tx / d) * (2 * BALL_R + back);
        const y = ob.y - (ty / d) * (2 * BALL_R + back);
        if (!canPlaceCue(rack, x, y)) continue;
        const c = candidates({ ...rack, balls: rack.balls.map((b) => (b.id === 0 ? { ...b, x, y, pocket: null } : b)) }, x, y).find(
          (k) => k.target === id && k.pocket === pocket,
        );
        if (c && c.ease > bestEase) {
          bestEase = c.ease;
          best = { x, y };
        }
      }
    });
  }
  return best;
}

/**
 * A safe shot: touch a legal ball and reach a cushion, leaving the
 * opponent the worst table. Tries soft shots at each legal ball.
 */
function planSafety(rack: RackState, seed: number): ShotPlan | null {
  const cue = rack.balls[0];
  let best: ShotPlan | null = null;
  let bestScore = Infinity;
  for (const id of legalTargets(rack)) {
    const ob = rack.balls[id];
    const base = Math.atan2(ob.y - cue.y, ob.x - cue.x);
    for (const off of [-0.03, 0, 0.03]) {
      for (const power of [0.18, 0.28]) {
        const angle = base + off;
        const { rack: after } = playOut(rack, angle, power, { x: 0, y: 0 }, null, seed);
        if (after.ballInHand || after.phase === "over") continue;
        const score = bestEase({ ...after, turn: after.turn });
        if (score < bestScore) {
          bestScore = score;
          best = { place: null, angle, power, spin: { x: 0, y: 0 }, called: null };
        }
      }
    }
  }
  return best;
}

/** No direct shot at all: look for any angle that makes legal contact (a kick). */
function planKick(rack: RackState, seed: number): ShotPlan {
  let fallback: ShotPlan = { place: null, angle: 0, power: 0.5, spin: { x: 0, y: 0 }, called: null };
  for (let i = 0; i < 90; i++) {
    const angle = (i / 90) * 2 * Math.PI;
    const { rack: after } = playOut(rack, angle, 0.5, { x: 0, y: 0 }, null, seed);
    if (!after.ballInHand && !(after.phase === "over" && after.winner !== rack.turn)) return { ...fallback, angle };
    if (i === 0) fallback = { ...fallback, angle };
  }
  return fallback;
}

/** The computer's whole shot: placement (if any), aim, power, spin and call. */
export function planShot(rack: RackState, level: Level, seed: number): ShotPlan {
  const r = rng(seed);
  const prof = profile(level);
  if (rack.phase === "break") return planBreak(rack, level, r);

  let working = rack;
  let place: { x: number; y: number } | null = null;
  if (rack.ballInHand) {
    place = chooseSpot(rack);
    working = { ...rack, balls: rack.balls.map((b) => (b.id === 0 ? { ...b, x: place!.x, y: place!.y, pocket: null } : b)) };
  }
  const cue = working.balls[0];
  const list = candidates(working, cue.x, cue.y);
  const onEight = onTheEight(working);

  let chosen: { c: Candidate; power: number; spin: Spin } | null = null;
  if (list.length > 0) {
    chosen = { c: list[0], power: list[0].power, spin: { x: 0, y: 0 } };
    if (prof.lookahead > 0) {
      let bestScore = -Infinity;
      const spins: Spin[] = prof.spin ? [{ x: 0, y: 0 }, { x: 0, y: 0.5 }, { x: 0, y: -0.5 }] : [{ x: 0, y: 0 }];
      for (const c of list.slice(0, prof.lookahead)) {
        for (const k of [1, 1.3, 0.8]) {
          for (const spin of spins) {
            const power = Math.min(1, c.power * k);
            const { rack: after } = playOut(working, c.angle, power, spin, onEight ? c.pocket : null, seed);
            if (!goodResult(working, after)) continue;
            const score = 10 + c.ease + (prof.position && after.phase !== "over" ? 2 * bestEase(after) : 0);
            if (score > bestScore) {
              bestScore = score;
              chosen = { c, power, spin };
            }
          }
        }
      }
      // Nothing it tried went in: play safe instead of a hopeful shot.
      if (bestScore === -Infinity && prof.safety && list[0].ease < 0.35) {
        const safe = planSafety(working, seed);
        if (safe) return withNoise({ ...safe, place, called: onEight ? 0 : null }, prof, r);
      }
    }
  }

  if (!chosen) {
    const safe = prof.safety ? planSafety(working, seed) : null;
    const plan = safe ?? planKick(working, seed);
    return withNoise({ ...plan, place, called: onEight ? nearestPocketTo(working) : null }, prof, r);
  }
  return withNoise(
    { place, angle: chosen.c.angle, power: chosen.power, spin: chosen.spin, called: onEight ? chosen.c.pocket : null },
    prof,
    r,
  );
}

function nearestPocketTo(rack: RackState): number {
  const eight = rack.balls[8];
  let best = 0;
  POCKETS.forEach((p, i) => {
    if (Math.hypot(p.x - eight.x, p.y - eight.y) < Math.hypot(POCKETS[best].x - eight.x, POCKETS[best].y - eight.y)) best = i;
  });
  return best;
}

function withNoise(plan: ShotPlan, prof: ReturnType<typeof profile>, r: Rng): ShotPlan {
  return {
    ...plan,
    angle: plan.angle + (r.gauss() * prof.aimNoise * Math.PI) / 180,
    power: Math.min(1, Math.max(0.03, plan.power * (1 + r.gauss() * prof.powerNoise))),
  };
}
