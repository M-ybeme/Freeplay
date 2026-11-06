import { describe, expect, it } from "vitest";
import {
  type Ball,
  type World,
  BALL_R,
  POCKETS,
  TABLE_H,
  TABLE_W,
  cloneWorld,
  makeBall,
  newLog,
  rackBalls,
  simulate,
  step,
  strike,
} from "./physics";

const world = (balls: Ball[]): World => ({ balls, log: newLog(), time: 0 });
const energy = (w: World) => w.balls.reduce((n, b) => n + b.vx ** 2 + b.vy ** 2 + 0.4 * (b.rx ** 2 + b.ry ** 2), 0);
const angleTo = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.atan2(b.y - a.y, b.x - a.x);

function noOverlaps(w: World) {
  const on = w.balls.filter((b) => b.pocket === null);
  for (let i = 0; i < on.length; i++)
    for (let j = i + 1; j < on.length; j++) {
      expect(Math.hypot(on[i].x - on[j].x, on[i].y - on[j].y)).toBeGreaterThan(2 * BALL_R - 0.05);
    }
}

describe("rack", () => {
  it("racks 15 balls in a triangle with the 8 in the middle and a solid and stripe in the back corners", () => {
    for (let seed = 1; seed < 30; seed++) {
      const balls = rackBalls(seed);
      expect(balls.map((b) => b.id)).toEqual(Array.from({ length: 16 }, (_, i) => i));
      const xs = [...new Set(balls.filter((b) => b.id).map((b) => b.x.toFixed(2)))].sort();
      expect(xs).toHaveLength(5);
      const eight = balls[8];
      expect(eight.x.toFixed(2)).toBe(xs[2]);
      expect(eight.y).toBeCloseTo(TABLE_H / 2);
      const back = balls.filter((b) => b.x.toFixed(2) === xs[4]).sort((a, b) => a.y - b.y);
      const kinds = [back[0].id < 8, back[4].id < 8];
      expect(kinds[0]).not.toBe(kinds[1]);
      noOverlaps(world(balls));
    }
  });
});

describe("motion", () => {
  it("slows to a stop on its own", () => {
    const w = strike(world([makeBall(0, 20, 25)]), 0, 0.3);
    simulate(w);
    expect(w.balls[0].vx).toBe(0);
    expect(w.time).toBeLessThan(15);
    expect(w.balls[0].x).toBeGreaterThan(30);
  });

  it("never gains energy, and never lets balls overlap, even on a full-power break", () => {
    const w = strike(world(rackBalls(7)), 0, 1);
    let last = energy(w);
    while (step(w)) {
      const e = energy(w);
      expect(e).toBeLessThanOrEqual(last + 1e-6);
      last = e;
    }
    noOverlaps(w);
    for (const b of w.balls.filter((b) => b.pocket === null)) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(TABLE_W);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThanOrEqual(TABLE_H);
    }
  });

  it("can't pass through a ball at full speed", () => {
    const w = strike(world([makeBall(0, 10, 25), makeBall(1, 40, 25)]), 0, 1);
    simulate(w);
    expect(w.log.firstHit).toBe(1);
    expect(w.balls[0].x).toBeLessThan(w.balls[1].x);
  });

  it("bounces off a cushion", () => {
    const w = strike(world([makeBall(0, 30, 25)]), Math.PI / 2, 0.4);
    let back = false;
    while (step(w)) if (w.balls[0].vy < 0) back = true;
    expect(back).toBe(true);
    expect(w.log.pocketed).toEqual([]);
  });
});

describe("pockets", () => {
  it("drops a ball sent straight at a corner or side pocket", () => {
    for (const [i, from] of [
      [0, { x: 20, y: 20 }],
      [1, { x: 50, y: 20 }],
      [5, { x: 70, y: 30 }],
    ] as const) {
      const w = strike(world([makeBall(0, from.x, from.y)]), angleTo(from, POCKETS[i]), 0.3);
      simulate(w);
      expect(w.log.pocketed).toEqual([{ id: 0, pocket: i }]);
    }
  });

  it("a ball running along the rail passes the side pocket", () => {
    const w = strike(world([makeBall(0, 30, BALL_R + 0.01)]), 0, 0.3);
    simulate(w);
    expect(w.log.pocketed.map((p) => p.pocket)).not.toContain(1);
  });

  it("cuts an object ball into a pocket", () => {
    // Object ball 10 inches from the corner on the diagonal; cue ball straight behind it.
    const ob = { x: 7.07, y: 7.07 };
    const cue = { x: 21.2, y: 21.2 };
    const w = strike(world([makeBall(0, cue.x, cue.y), makeBall(3, ob.x, ob.y)]), angleTo(cue, ob), 0.3);
    simulate(w);
    expect(w.log.firstHit).toBe(3);
    expect(w.log.pocketed.map((p) => p.id)).toContain(3);
  });
});

describe("spin", () => {
  // A full hit on a ball 20 inches ahead, at the same speed with different tip heights.
  function cueAfterHit(spinY: number) {
    const w = strike(world([makeBall(0, 30, 25), makeBall(1, 42, 25)]), 0, 0.35, { x: 0, y: spinY });
    simulate(w);
    return w.balls[0].x - (42 - 2 * BALL_R);
  }

  it("top spin follows through, back spin draws back, centre stops near the contact", () => {
    const follow = cueAfterHit(1);
    const stun = cueAfterHit(-0.32);
    const draw = cueAfterHit(-1);
    expect(follow).toBeGreaterThan(3);
    expect(draw).toBeLessThan(-3);
    expect(Math.abs(stun)).toBeLessThan(Math.abs(follow));
    expect(Math.abs(stun)).toBeLessThan(Math.abs(draw));
  });

  it("right english sends the cue ball right off a cushion", () => {
    const run = (x: number) => {
      const w = strike(world([makeBall(0, 30, 25)]), -Math.PI / 2, 0.25, { x, y: 0 });
      simulate(w);
      return w.balls[0].x - 30;
    };
    // Shooting "up" the screen, the shooter's right is +x.
    expect(run(1)).toBeGreaterThan(1);
    expect(run(-1)).toBeLessThan(-1);
    expect(Math.abs(run(0))).toBeLessThan(0.01);
  });
});

describe("determinism", () => {
  it("plays the same shot the same way twice", () => {
    const a = strike(world(rackBalls(3)), 0.01, 0.9);
    const b = cloneWorld(a);
    simulate(a);
    simulate(b);
    expect(a.balls).toEqual(b.balls);
    expect(a.log).toEqual(b.log);
  });
});
