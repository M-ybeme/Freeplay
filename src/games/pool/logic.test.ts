import { describe, expect, it } from "vitest";
import {
  type Group,
  type Player,
  type RackState,
  canPlaceCue,
  isSavedMatch,
  legalTargets,
  newMatch,
  newRack,
  nextRack,
  onTheEight,
  placeCue,
  resolveShot,
  scoreRack,
  toBalls,
} from "./logic";
import { type ShotLog, BALL_R, HEAD_X, newLog } from "./physics";

/** A rack mid-game: `gone` already pocketed, groups set, `turn` to shoot. */
function midRack(gone: number[], groups: [Group | null, Group | null], turn: Player = 0): RackState {
  const r = newRack(0, 1);
  return {
    ...r,
    phase: "shoot",
    ballInHand: false,
    turn,
    groups,
    balls: r.balls.map((b) => (gone.includes(b.id) ? { ...b, pocket: 0 } : b)),
  };
}

/** The table after a shot that pocketed `pots` (id, pocket). */
function shot(rack: RackState, log: Partial<ShotLog>, called: number | null = null) {
  const full: ShotLog = { ...newLog(), ...log };
  const after = toBalls(rack.balls).map((b) => {
    const p = full.pocketed.find((q) => q.id === b.id);
    return p ? { ...b, pocket: p.pocket } : b;
  });
  return resolveShot(rack, after, full, called, 99);
}
const pot = (...ids: number[]) => ids.map((id) => ({ id, pocket: 2 }));
const SOLIDS = [1, 2, 3, 4, 5, 6, 7];

describe("the break", () => {
  it("breaks from behind the head string with ball in hand", () => {
    const r = newRack(0, 5);
    expect([r.phase, r.ballInHand, r.turn]).toEqual(["break", true, 0]);
    expect(canPlaceCue(r, HEAD_X - 1, 20)).toBe(true);
    expect(canPlaceCue(r, HEAD_X + 1, 20)).toBe(false);
    expect(placeCue(r, 10, 10).balls[0]).toMatchObject({ x: 10, y: 10 });
  });

  it("pocketing on the break keeps the turn and leaves the table open", () => {
    const r = shot(newRack(0, 5), { firstHit: 1, pocketed: pot(3, 11), railBalls: [3, 11] });
    expect([r.phase, r.turn, r.groups, r.ballInHand]).toEqual(["shoot", 0, [null, null], false]);
  });

  it("a dry break that drives four balls to a cushion passes the turn", () => {
    const r = shot(newRack(0, 5), { firstHit: 1, railBalls: [1, 2, 3, 4] });
    expect([r.turn, r.ballInHand, r.last?.foul]).toEqual([1, false, null]);
  });

  it("a weak break is a foul", () => {
    const r = shot(newRack(0, 5), { firstHit: 1, railBalls: [1, 2] });
    expect([r.turn, r.ballInHand, r.last?.foul]).toEqual([1, true, "weak-break"]);
  });

  it("scratching on the break is a foul, the cue ball comes back", () => {
    const r = shot(newRack(0, 5), { firstHit: 1, pocketed: [{ id: 0, pocket: 1 }, ...pot(4)] });
    expect([r.turn, r.ballInHand, r.last?.foul]).toEqual([1, true, "scratch"]);
    expect(r.balls[0].pocket).toBeNull();
  });

  it("the 8 on the break re-racks for the same breaker", () => {
    const r = shot(newRack(1, 5), { firstHit: 1, pocketed: pot(8) });
    expect([r.phase, r.breaker, r.turn, r.last?.rerack]).toEqual(["break", 1, 1, true]);
    expect(r.balls.every((b) => b.pocket === null)).toBe(true);
  });
});

describe("groups and turns", () => {
  it("the first ball pocketed on an open table sets the groups", () => {
    const r = shot(midRack([], [null, null]), { firstHit: 12, pocketed: pot(12), railAfterHit: true });
    expect([r.groups, r.turn, r.last?.assigned]).toEqual([["stripes", "solids"], 0, "stripes"]);
  });

  it("hitting the 8 first on an open table is a foul", () => {
    const r = shot(midRack([], [null, null]), { firstHit: 8, railAfterHit: true });
    expect([r.last?.foul, r.turn, r.ballInHand]).toEqual(["wrong-ball", 1, true]);
  });

  it("pocketing your own ball keeps the turn; only theirs passes it", () => {
    const rack = midRack([], ["solids", "stripes"]);
    expect(shot(rack, { firstHit: 2, pocketed: pot(2), railAfterHit: true }).turn).toBe(0);
    const theirs = shot(rack, { firstHit: 2, pocketed: pot(10), railAfterHit: true });
    expect([theirs.turn, theirs.ballInHand]).toEqual([1, false]);
  });

  it("legal targets follow the group, then the 8", () => {
    expect(legalTargets(midRack([], [null, null]))).not.toContain(8);
    expect(legalTargets(midRack([], ["solids", "stripes"]))).toEqual(SOLIDS);
    const cleared = midRack(SOLIDS, ["solids", "stripes"]);
    expect(onTheEight(cleared)).toBe(true);
    expect(legalTargets(cleared)).toEqual([8]);
  });
});

describe("fouls", () => {
  const rack = midRack([], ["solids", "stripes"]);

  it("scratch", () => {
    const r = shot(rack, { firstHit: 3, pocketed: [{ id: 0, pocket: 4 }], railAfterHit: true });
    expect([r.last?.foul, r.turn, r.ballInHand]).toEqual(["scratch", 1, true]);
  });

  it("hitting nothing", () => {
    expect(shot(rack, { railAfterHit: false }).last?.foul).toBe("no-hit");
  });

  it("hitting the other group first", () => {
    expect(shot(rack, { firstHit: 9, railAfterHit: true }).last?.foul).toBe("wrong-ball");
  });

  it("no cushion after contact", () => {
    expect(shot(rack, { firstHit: 3 }).last?.foul).toBe("no-rail");
    expect(shot(rack, { firstHit: 3, pocketed: pot(3) }).last?.foul).toBeNull();
  });

  it("a ball pocketed on a foul stays down, but the turn passes", () => {
    const r = shot(rack, { firstHit: 9, pocketed: pot(3), railAfterHit: true });
    expect([r.turn, r.balls[3].pocket]).toEqual([1, 2]);
  });

  it("ball in hand goes anywhere clear", () => {
    const r = shot(rack, { firstHit: 9, railAfterHit: true });
    expect(canPlaceCue(r, 80, 10)).toBe(true);
    const onBall = r.balls[5];
    expect(canPlaceCue(r, onBall.x + BALL_R, onBall.y)).toBe(false);
  });
});

describe("the 8", () => {
  const cleared = midRack(SOLIDS, ["solids", "stripes"]);

  it("wins in the called pocket", () => {
    const r = shot(cleared, { firstHit: 8, pocketed: [{ id: 8, pocket: 3 }] }, 3);
    expect([r.phase, r.winner, r.last?.win]).toEqual(["over", 0, true]);
  });

  it("loses in another pocket", () => {
    const r = shot(cleared, { firstHit: 8, pocketed: [{ id: 8, pocket: 5 }] }, 3);
    expect([r.winner, r.last?.loss]).toEqual([1, "eight-wrong-pocket"]);
  });

  it("loses if you scratch with it", () => {
    const r = shot(cleared, { firstHit: 8, pocketed: [{ id: 8, pocket: 3 }, { id: 0, pocket: 1 }] }, 3);
    expect([r.winner, r.last?.loss]).toEqual([1, "eight-scratch"]);
  });

  it("loses if it drops early, even with your last ball", () => {
    const r = shot(midRack([1, 2, 3, 4, 5, 6], ["solids", "stripes"]), { firstHit: 7, pocketed: pot(7, 8) }, null);
    expect([r.winner, r.last?.loss]).toEqual([1, "eight-early"]);
  });

  it("missing the 8 is just a turn over (or a foul)", () => {
    const miss = shot(cleared, { firstHit: 8, railAfterHit: true }, 3);
    expect([miss.phase, miss.turn, miss.ballInHand]).toEqual(["shoot", 1, false]);
    const foul = shot(cleared, { firstHit: 12, railAfterHit: true }, 3);
    expect([foul.turn, foul.ballInHand, foul.last?.foul]).toEqual([1, true, "wrong-ball"]);
  });
});

describe("match", () => {
  it("scores the rack and alternates the break", () => {
    let m = newMatch("duo", 3);
    m = { ...m, rack: shot(midRack(SOLIDS, ["solids", "stripes"]), { firstHit: 8, pocketed: [{ id: 8, pocket: 0 }] }, 0) };
    m = scoreRack(m);
    expect(m.score).toEqual([1, 0]);
    const next = nextRack(m, 4);
    expect([next.rackNumber, next.rack.breaker, next.rack.phase]).toEqual([2, 1, "break"]);
  });

  it("checks saved matches", () => {
    const m = newMatch("solo", 1);
    expect(isSavedMatch(JSON.parse(JSON.stringify(m)))).toBe(true);
    expect(isSavedMatch({ ...m, version: 2 })).toBe(false);
    expect(isSavedMatch({ ...m, rack: { ...m.rack, balls: m.rack.balls.slice(1) } })).toBe(false);
  });
});
