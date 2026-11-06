import { describe, expect, it } from "vitest";
import { candidates, planShot, profile } from "./ai";
import { type Level, type RackState, newRack, placeCue, playOut } from "./logic";
import { BALL_R, makeBall } from "./physics";

/** Play a whole rack between two levels. Returns the winner and the number of shots. */
export function playRack(levels: [Level, Level], seed: number, breaker: 0 | 1 = 0): { winner: 0 | 1; shots: number; fouls: number } {
  let rack = newRack(breaker, seed);
  let fouls = 0;
  for (let shots = 1; shots <= 300; shots++) {
    const plan = planShot(rack, levels[rack.turn], seed * 1000 + shots);
    if (plan.place && rack.ballInHand) rack = placeCue(rack, plan.place.x, plan.place.y);
    rack = playOut(rack, plan.angle, plan.power, plan.spin, plan.called, seed * 7 + shots).rack;
    if (rack.last?.foul) fouls++;
    if (rack.phase === "over") return { winner: rack.winner!, shots, fouls };
  }
  throw new Error(`rack ${seed} never ended`);
}

/** A rack with only some balls left on the table, at given spots. */
function table(spots: Record<number, [number, number]>, groups: RackState["groups"] = ["solids", "stripes"]): RackState {
  const r = newRack(0, 1);
  return {
    ...r,
    phase: "shoot",
    ballInHand: false,
    groups,
    balls: r.balls.map((b) => (spots[b.id] ? { ...makeBall(b.id, ...spots[b.id]), pocket: null } : { ...b, pocket: 0 })),
  };
}

describe("aiming", () => {
  it("finds the straight pot and makes it at top level", () => {
    const rack = table({ 0: [30, 25], 3: [60, 25], 8: [50, 10], 12: [80, 40] });
    const list = candidates(rack, 30, 25);
    expect(list[0]).toMatchObject({ target: 3 });
    const plan = planShot(rack, 10, 5);
    const after = playOut(rack, plan.angle, plan.power, plan.spin, plan.called, 1).rack;
    expect(after.last?.pocketed).toContain(3);
    expect(after.turn).toBe(0);
  });

  it("doesn't aim through a blocking ball", () => {
    // The 12 sits right on the line from cue to 3, and 3 to the corner.
    const rack = table({ 0: [20, 20], 3: [40, 30], 12: [30, 25], 8: [80, 10] });
    expect(candidates(rack, 20, 20).every((c) => c.pocket !== 3 || c.target !== 3)).toBe(true);
  });

  it("calls the pocket it aims the 8 at", () => {
    const rack = table({ 0: [70, 35], 8: [85, 42], 12: [20, 10] });
    const plan = planShot(rack, 10, 3);
    expect(plan.called).toBe(5);
    const after = playOut(rack, plan.angle, plan.power, plan.spin, plan.called, 1).rack;
    expect([after.phase, after.winner]).toEqual(["over", 0]);
  });

  it("with ball in hand places the cue ball somewhere legal", () => {
    const rack = { ...table({ 0: [20, 20], 3: [60, 25], 8: [50, 10] }), ballInHand: true };
    const plan = planShot(rack, 8, 2);
    expect(plan.place).not.toBeNull();
    expect(placeCue(rack, plan.place!.x, plan.place!.y)).not.toBe(rack);
  });

  it("aims more accurately as the level rises", () => {
    expect(profile(1).aimNoise).toBeGreaterThan(profile(5).aimNoise);
    expect(profile(5).aimNoise).toBeGreaterThan(profile(10).aimNoise);
    expect(profile(10).aimNoise).toBeLessThan(0.2);
    void BALL_R;
  });
});

describe("whole racks", () => {
  it("every rack ends with a winner", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const { shots } = playRack([5, 5], seed);
      expect(shots).toBeLessThan(300);
    }
  });
});
