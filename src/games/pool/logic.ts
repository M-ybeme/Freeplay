/*
 * 8-ball rules over the physics in physics.ts. The state only ever holds
 * the table at rest (between shots); a shot is played out by the physics
 * and its log is judged here by resolveShot.
 *
 * Rules (standard 8-ball, as chosen for this game):
 * - Break from behind the head string. The 8 on the break re-racks; a
 *   scratch, or a break that pockets nothing and drives fewer than four
 *   balls to a cushion, is a foul.
 * - The table stays open after the break; the first ball you legally
 *   pocket after it sets your group.
 * - Fouls: scratch, hitting nothing, hitting the wrong ball first, or no
 *   ball reaching a cushion after contact with nothing pocketed. Any foul
 *   gives the other player ball in hand anywhere.
 * - Once your group is cleared you call a pocket for the 8. Sinking it
 *   early, in another pocket, or with a foul loses the rack.
 */
import {
  type Ball,
  type ShotLog,
  type Spin,
  type World,
  BALL_R,
  HEAD_SPOT,
  HEAD_X,
  TABLE_H,
  TABLE_W,
  makeBall,
  newLog,
  rackBalls,
  simulate,
  strike,
} from "./physics";

export type Player = 0 | 1;
export type Group = "solids" | "stripes";
export type Mode = "solo" | "duo";

export interface BallSpot {
  id: number;
  x: number;
  y: number;
  pocket: number | null;
}

export type Foul = "scratch" | "no-hit" | "wrong-ball" | "no-rail" | "weak-break";
export type LossReason = "eight-early" | "eight-scratch" | "eight-wrong-pocket" | "eight-foul";

/** What the last shot did, for the status line. */
export interface ShotOutcome {
  shooter: Player;
  pocketed: number[];
  foul: Foul | null;
  assigned: Group | null;
  keepTurn: boolean;
  rerack: boolean;
  loss: LossReason | null;
  win: boolean;
}

export interface RackState {
  balls: BallSpot[];
  turn: Player;
  breaker: Player;
  /** Each player's group; both null while the table is open. */
  groups: [Group | null, Group | null];
  phase: "break" | "shoot" | "over";
  /** The player to shoot may place the cue ball first. */
  ballInHand: boolean;
  winner: Player | null;
  last: ShotOutcome | null;
}

export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;
export const LEVELS: readonly Level[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const DEFAULT_LEVEL: Level = 5;

export interface MatchState {
  version: 1;
  mode: Mode;
  rack: RackState;
  rackNumber: number;
  /** Racks won by each player this session. */
  score: [number, number];
}

export function groupOf(id: number): Group | null {
  if (id >= 1 && id <= 7) return "solids";
  if (id >= 9 && id <= 15) return "stripes";
  return null;
}

export const otherGroup = (g: Group): Group => (g === "solids" ? "stripes" : "solids");
export const otherPlayer = (p: Player): Player => (p === 0 ? 1 : 0);

export function toSpots(balls: readonly Ball[]): BallSpot[] {
  return balls.map((b) => ({ id: b.id, x: b.x, y: b.y, pocket: b.pocket }));
}

export function toBalls(spots: readonly BallSpot[]): Ball[] {
  return spots.map((s) => ({ ...makeBall(s.id, s.x, s.y), pocket: s.pocket }));
}

export function newRack(breaker: Player, seed: number): RackState {
  return {
    balls: toSpots(rackBalls(seed)),
    turn: breaker,
    breaker,
    groups: [null, null],
    phase: "break",
    ballInHand: true,
    winner: null,
    last: null,
  };
}

export function newMatch(mode: Mode, seed: number): MatchState {
  return { version: 1, mode, rack: newRack(0, seed), rackNumber: 1, score: [0, 0] };
}

/** Balls of `group` still on the table. */
export function remaining(balls: readonly BallSpot[], group: Group): number {
  return balls.filter((b) => b.pocket === null && groupOf(b.id) === group).length;
}

/** The shooter has cleared their group and is playing the 8. */
export function onTheEight(rack: RackState, player: Player = rack.turn): boolean {
  const g = rack.groups[player];
  return g !== null && remaining(rack.balls, g) === 0;
}

/** Balls the shooter may hit first. */
export function legalTargets(rack: RackState): number[] {
  const on = rack.balls.filter((b) => b.pocket === null && b.id !== 0).map((b) => b.id);
  if (rack.phase === "break") return on;
  const g = rack.groups[rack.turn];
  if (g === null) return on.filter((id) => id !== 8);
  if (onTheEight(rack)) return [8];
  return on.filter((id) => groupOf(id) === g);
}

/**
 * Can the cue ball go here? On the table, clear of every other ball, and
 * behind the head string for the break.
 */
export function canPlaceCue(rack: RackState, x: number, y: number): boolean {
  if (x < BALL_R || x > TABLE_W - BALL_R || y < BALL_R || y > TABLE_H - BALL_R) return false;
  if (rack.phase === "break" && x > HEAD_X) return false;
  return rack.balls.every((b) => b.id === 0 || b.pocket !== null || Math.hypot(b.x - x, b.y - y) >= 2 * BALL_R + 0.01);
}

export function placeCue(rack: RackState, x: number, y: number): RackState {
  if (!rack.ballInHand || rack.phase === "over" || !canPlaceCue(rack, x, y)) return rack;
  return { ...rack, balls: rack.balls.map((b) => (b.id === 0 ? { ...b, x, y, pocket: null } : b)) };
}

/** Somewhere free for a scratched cue ball: the head spot, or the nearest clear spot behind it. */
function freeCueSpot(rack: RackState): { x: number; y: number } {
  const probe = { ...rack, phase: "shoot" as const };
  for (let r = 0; r < 40; r += 0.5) {
    for (let a = 0; a < 16; a++) {
      const x = HEAD_SPOT.x - r * Math.cos((a * Math.PI) / 8);
      const y = HEAD_SPOT.y + r * Math.sin((a * Math.PI) / 8);
      if (canPlaceCue(probe, x, y)) return { x, y };
    }
  }
  return HEAD_SPOT;
}

/** Judge a finished shot: `after` is the table at rest, `called` the pocket called for the 8. */
export function resolveShot(rack: RackState, after: readonly Ball[], log: ShotLog, called: number | null, seed: number): RackState {
  const shooter = rack.turn;
  const opponent = otherPlayer(shooter);
  const pots = log.pocketed.map((p) => p.id);
  const objectPots = pots.filter((id) => id !== 0);
  const scratch = pots.includes(0);
  const eight = log.pocketed.find((p) => p.id === 8);
  const outcome: ShotOutcome = { shooter, pocketed: objectPots, foul: null, assigned: null, keepTurn: false, rerack: false, loss: null, win: false };

  let balls = toSpots(after);
  const withCueBack = (r: RackState): RackState => {
    if (!scratch) return r;
    const spot = freeCueSpot(r);
    return { ...r, balls: r.balls.map((b) => (b.id === 0 ? { ...b, x: spot.x, y: spot.y, pocket: null } : b)) };
  };

  if (rack.phase === "break") {
    if (eight) {
      return { ...newRack(rack.breaker, seed), last: { ...outcome, rerack: true } };
    }
    const distinctRails = new Set(log.railBalls).size;
    const foul: Foul | null = scratch ? "scratch" : objectPots.length === 0 && distinctRails < 4 ? "weak-break" : null;
    const keep = foul === null && objectPots.length > 0;
    return withCueBack({
      ...rack,
      balls,
      phase: "shoot",
      turn: keep ? shooter : opponent,
      ballInHand: foul !== null,
      last: { ...outcome, foul, keepTurn: keep },
    });
  }

  const myGroup = rack.groups[shooter];
  const wasOnEight = onTheEight(rack);
  let foul: Foul | null = null;
  if (scratch) foul = "scratch";
  else if (log.firstHit === null) foul = "no-hit";
  else if (myGroup === null ? log.firstHit === 8 : wasOnEight ? log.firstHit !== 8 : groupOf(log.firstHit) !== myGroup) foul = "wrong-ball";
  else if (objectPots.length === 0 && !log.railAfterHit) foul = "no-rail";

  if (eight) {
    const win = foul === null && wasOnEight && called === eight.pocket;
    const loss: LossReason | null = win
      ? null
      : !wasOnEight
        ? "eight-early"
        : scratch
          ? "eight-scratch"
          : foul
            ? "eight-foul"
            : "eight-wrong-pocket";
    const winner = win ? shooter : opponent;
    return { ...rack, balls, phase: "over", winner, ballInHand: false, last: { ...outcome, foul, win, loss } };
  }

  const groups: [Group | null, Group | null] = [...rack.groups];
  if (myGroup === null && foul === null && objectPots.length > 0) {
    const g = groupOf(objectPots[0])!;
    groups[shooter] = g;
    groups[opponent] = otherGroup(g);
    outcome.assigned = g;
  }
  const keep = foul === null && objectPots.some((id) => groupOf(id) === groups[shooter]);
  balls = withCueBack({ ...rack, balls }).balls;
  return {
    ...rack,
    balls,
    groups,
    turn: keep ? shooter : opponent,
    ballInHand: foul !== null,
    last: { ...outcome, foul, keepTurn: keep },
  };
}

/** Count the finished rack and rack the next one, the break alternating. */
export function nextRack(match: MatchState, seed: number): MatchState {
  if (match.rack.phase !== "over" || match.rack.winner === null) return match;
  return {
    ...match,
    rack: newRack(otherPlayer(match.rack.breaker), seed),
    rackNumber: match.rackNumber + 1,
  };
}

/** Add a finished rack to the score, once. */
export function scoreRack(match: MatchState): MatchState {
  const w = match.rack.winner;
  if (w === null) return match;
  const score: [number, number] = [...match.score];
  score[w]++;
  return { ...match, score };
}

/** A saved match is resumed only if it holds all 16 balls, sensibly placed. */
export function isSavedMatch(value: unknown): value is MatchState {
  const m = value as MatchState | null;
  if (!m || m.version !== 1 || (m.mode !== "solo" && m.mode !== "duo") || !m.rack || !Array.isArray(m.rack.balls)) return false;
  const ids = m.rack.balls.map((b) => b.id).sort((a, b) => a - b);
  if (ids.length !== 16 || ids.some((id, i) => id !== i)) return false;
  return m.rack.balls.every((b) => Number.isFinite(b.x) && Number.isFinite(b.y));
}

/** The table at rest, as a world ready to strike. */
export function worldOf(rack: RackState): World {
  return { balls: toBalls(rack.balls), log: newLog(), time: 0 };
}

/** Strike from this rack (not yet played out). */
export function shotWorld(rack: RackState, angle: number, power: number, spin: Spin): World {
  return strike(worldOf(rack), angle, power, spin);
}

/** Play a shot out instantly and judge it (for the computer player and tests). */
export function playOut(rack: RackState, angle: number, power: number, spin: Spin, called: number | null, seed: number): { rack: RackState; world: World } {
  const world = simulate(shotWorld(rack, angle, power, spin));
  return { rack: resolveShot(rack, world.balls, world.log, called, seed), world };
}
