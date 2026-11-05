import { describe, expect, it } from "vitest";
import {
  BALL_R,
  BRICK_COLS,
  FIELD_H,
  FIELD_W,
  LEVELS,
  LEVEL_CLEAR_BONUS,
  MAX_BOUNCE_ANGLE,
  MAX_SPEED,
  MAX_STEP_MS,
  PADDLE_KEY_SPEED,
  PADDLE_W,
  PADDLE_Y,
  POINTS_ONE_HIT,
  POINTS_TWO_HIT,
  START_LIVES,
  brickWidth,
  buildBricks,
  clampPaddle,
  createInitialState,
  launch,
  movePaddleTo,
  paddleBounce,
  pause,
  speedForLevel,
  step,
  togglePause,
  type Brick,
  type GameState,
} from "./logic";

function playing(overrides: Partial<GameState> = {}): GameState {
  return { ...launch(createInitialState()), ...overrides };
}

function brickAt(x: number, y: number, hp = 1, id = 999): Brick {
  return { id, row: 0, col: 0, x, y, w: 10, h: 4, hp, maxHp: hp };
}

/** A far-away brick that keeps the level from counting as cleared. */
const ANCHOR = brickAt(0, 0, 1, 1);

/** Run the simulation in 16ms frames until a predicate holds (or give up). */
function runUntil(state: GameState, done: (s: GameState) => boolean, maxFrames = 2000): GameState {
  let s = state;
  for (let i = 0; i < maxFrames && !done(s); i++) s = step(s, 16);
  return s;
}

describe("construction", () => {
  it("every layout is exactly BRICK_COLS wide and uses only 1, 2 and .", () => {
    for (const layout of LEVELS) {
      for (const line of layout) {
        expect(line).toHaveLength(BRICK_COLS);
        expect(line).toMatch(/^[12.]+$/);
      }
    }
  });

  it("builds one brick per 1/2 cell, with matching hit points", () => {
    const bricks = buildBricks(2);
    const cells = LEVELS[1].join("").replace(/\./g, "");
    expect(bricks).toHaveLength(cells.length);
    expect(bricks.filter((b) => b.maxHp === 2)).toHaveLength([...cells].filter((c) => c === "2").length);
    expect(bricks.every((b) => b.hp === b.maxHp)).toBe(true);
  });

  it("keeps the wall inside the field with unique ids", () => {
    for (let level = 1; level <= LEVELS.length; level++) {
      const bricks = buildBricks(level);
      expect(new Set(bricks.map((b) => b.id)).size).toBe(bricks.length);
      for (const b of bricks) {
        expect(b.x).toBeGreaterThanOrEqual(0);
        expect(b.x + b.w).toBeLessThanOrEqual(FIELD_W + 1e-9);
        expect(b.y + b.h).toBeLessThan(PADDLE_Y);
      }
    }
    expect(brickWidth()).toBeGreaterThan(0);
  });

  it("cycles layouts after the last one", () => {
    expect(buildBricks(LEVELS.length + 1)).toEqual(buildBricks(1));
  });

  it("starts serving with full lives and the ball resting on the paddle", () => {
    const s = createInitialState();
    expect(s.status).toBe("serve");
    expect(s.lives).toBe(START_LIVES);
    expect(s.score).toBe(0);
    expect(s.ball.x).toBe(s.paddleX);
    expect(s.ball.y).toBe(PADDLE_Y - BALL_R);
  });

  it("speeds up per level but never past the cap", () => {
    expect(speedForLevel(2)).toBeGreaterThan(speedForLevel(1));
    expect(speedForLevel(500)).toBe(MAX_SPEED);
  });
});

describe("paddle input", () => {
  it("clamps the paddle inside the field", () => {
    expect(clampPaddle(-50)).toBe(PADDLE_W / 2);
    expect(clampPaddle(500)).toBe(FIELD_W - PADDLE_W / 2);
  });

  it("carries the resting ball while serving", () => {
    const s = movePaddleTo(createInitialState(), 30);
    expect(s.paddleX).toBe(30);
    expect(s.ball.x).toBe(30);
  });

  it("does not drag the ball once it is in play", () => {
    const s = playing();
    const moved = movePaddleTo(s, 20);
    expect(moved.paddleX).toBe(20);
    expect(moved.ball).toBe(s.ball);
  });

  it("ignores paddle input while paused or after game over", () => {
    const paused = pause(playing());
    expect(movePaddleTo(paused, 10)).toBe(paused);
    const over = { ...createInitialState(), status: "gameOver" as const };
    expect(movePaddleTo(over, 10)).toBe(over);
  });

  it("moves the paddle with held keys at PADDLE_KEY_SPEED", () => {
    const s = step(createInitialState(), 100 > MAX_STEP_MS ? MAX_STEP_MS : 100, 1);
    expect(s.paddleX).toBeCloseTo(FIELD_W / 2 + (PADDLE_KEY_SPEED * MAX_STEP_MS) / 1000);
    expect(s.ball.x).toBe(s.paddleX);
  });
});

describe("launch and pause", () => {
  it("launches upward, aimed away from the nearer wall", () => {
    const left = launch(movePaddleTo(createInitialState(), 20));
    expect(left.status).toBe("playing");
    expect(left.ball.vy).toBeLessThan(0);
    expect(left.ball.vx).toBeGreaterThan(0);
    const right = launch(movePaddleTo(createInitialState(), 80));
    expect(right.ball.vx).toBeLessThan(0);
  });

  it("launches at the current speed", () => {
    const s = launch(createInitialState());
    expect(Math.hypot(s.ball.vx, s.ball.vy)).toBeCloseTo(s.speed);
  });

  it("only launches from serve", () => {
    const s = playing();
    expect(launch(s)).toBe(s);
  });

  it("toggles pause only between playing and paused", () => {
    const s = playing();
    expect(togglePause(s).status).toBe("paused");
    expect(togglePause(togglePause(s)).status).toBe("playing");
    const serve = createInitialState();
    expect(togglePause(serve)).toBe(serve);
  });

  it("freezes the simulation while paused", () => {
    const paused = pause(playing());
    expect(step(paused, 16)).toBe(paused);
  });
});

describe("ball physics", () => {
  it("bounces off the side walls and ceiling", () => {
    const leftWall = step(playing({ bricks: [], ball: { x: BALL_R + 0.1, y: 60, vx: -80, vy: -10 } }), 16);
    expect(leftWall.ball.vx).toBeGreaterThan(0);
    const rightWall = step(playing({ bricks: [], ball: { x: FIELD_W - BALL_R - 0.1, y: 60, vx: 80, vy: -10 } }), 16);
    expect(rightWall.ball.vx).toBeLessThan(0);
    const ceiling = step(playing({ bricks: [], ball: { x: 50, y: BALL_R + 0.1, vx: 5, vy: -80 } }), 16);
    expect(ceiling.ball.vy).toBeGreaterThan(0);
  });

  it("returns off the paddle centre straight up and off the edge at the max angle", () => {
    const centre = paddleBounce(50, 50, 100);
    expect(centre.vx).toBeCloseTo(0);
    expect(centre.vy).toBeCloseTo(-100);
    const edge = paddleBounce(50 + PADDLE_W, 50, 100);
    expect(Math.atan2(edge.vx, -edge.vy)).toBeCloseTo(MAX_BOUNCE_ANGLE);
  });

  it("never returns flatter than the max angle, so it can't skim sideways forever", () => {
    for (let x = 0; x <= FIELD_W; x += 2.5) {
      const { vx, vy } = paddleBounce(x, 50, 100);
      expect(Math.abs(Math.atan2(vx, -vy))).toBeLessThanOrEqual(MAX_BOUNCE_ANGLE + 1e-9);
      expect(vy).toBeLessThan(0);
    }
  });

  it("bounces off the paddle and speeds up slightly", () => {
    const s = playing({ bricks: [ANCHOR], paddleX: 50, ball: { x: 50, y: PADDLE_Y - 5, vx: 0, vy: 80 } });
    const after = runUntil(s, (x) => x.ball.vy < 0, 50);
    expect(after.ball.vy).toBeLessThan(0);
    expect(after.speed).toBeGreaterThan(s.speed);
    expect(after.status).toBe("playing");
  });

  it("caps the speed", () => {
    const s = playing({ bricks: [ANCHOR], speed: MAX_SPEED, paddleX: 50, ball: { x: 50, y: PADDLE_Y - 3, vx: 0, vy: 80 } });
    const after = runUntil(s, (x) => x.ball.vy < 0, 50);
    expect(after.speed).toBe(MAX_SPEED);
  });

  it("does not tunnel through a brick on a long frame at max speed", () => {
    const s = playing({
      bricks: [brickAt(45, 50), ANCHOR],
      speed: MAX_SPEED,
      ball: { x: 50, y: 60, vx: 0, vy: -MAX_SPEED },
    });
    const after = step(s, MAX_STEP_MS * 10);
    expect(after.bricks.find((b) => b.id === 999)).toBeUndefined();
    expect(after.ball.vy).toBeGreaterThan(0);
  });

  it("clamps huge frames to MAX_STEP_MS", () => {
    const s = playing({ bricks: [ANCHOR], ball: { x: 50, y: 80, vx: 0, vy: -50 } });
    const after = step(s, 10_000);
    expect(after.ball.y).toBeCloseTo(80 - (50 * MAX_STEP_MS) / 1000);
  });
});

describe("bricks and scoring", () => {
  it("destroys a one-hit brick and scores it", () => {
    const s = playing({ bricks: [brickAt(45, 50), ANCHOR], ball: { x: 50, y: 56, vx: 0, vy: -80 } });
    const after = runUntil(s, (x) => x.bricks.length < 2, 20);
    expect(after.bricks).toHaveLength(1);
    expect(after.score).toBe(POINTS_ONE_HIT);
    expect(after.ball.vy).toBeGreaterThan(0);
  });

  it("cracks an armoured brick first, then destroys it for more points", () => {
    let s = playing({ bricks: [brickAt(45, 50, 2), ANCHOR], ball: { x: 50, y: 56, vx: 0, vy: -80 } });
    s = runUntil(s, (x) => x.ball.vy > 0, 20);
    const cracked = s.bricks.find((b) => b.id === 999)!;
    expect(cracked.hp).toBe(1);
    expect(s.score).toBe(0);

    s = { ...s, ball: { x: 50, y: 56, vx: 0, vy: -80 } };
    s = runUntil(s, (x) => x.ball.vy > 0, 20);
    expect(s.bricks.find((b) => b.id === 999)).toBeUndefined();
    expect(s.score).toBe(POINTS_TWO_HIT);
  });

  it("reflects sideways when it strikes a brick's side", () => {
    const s = playing({ bricks: [brickAt(50, 40), ANCHOR], ball: { x: 47, y: 42, vx: 80, vy: -5 } });
    const after = runUntil(s, (x) => x.ball.vx < 0, 20);
    expect(after.ball.vx).toBeLessThan(0);
    expect(after.ball.vy).toBeLessThan(0);
  });

  it("clears the level: bonus, next wall, faster ball, back to serve", () => {
    const s = playing({ score: 40, bricks: [brickAt(45, 50)], ball: { x: 50, y: 56, vx: 0, vy: -80 } });
    const after = runUntil(s, (x) => x.level === 2, 20);
    expect(after.status).toBe("serve");
    expect(after.score).toBe(40 + POINTS_ONE_HIT + LEVEL_CLEAR_BONUS);
    expect(after.bricks).toEqual(buildBricks(2));
    expect(after.speed).toBe(speedForLevel(2));
    expect(after.ball.x).toBe(after.paddleX);
  });
});

describe("lives", () => {
  it("loses a life when the ball falls past the paddle, and serves again", () => {
    const s = playing({ paddleX: 15, ball: { x: 80, y: FIELD_H - 4, vx: 0, vy: 80 }, speed: 100 });
    const after = runUntil(s, (x) => x.status !== "playing", 30);
    expect(after.status).toBe("serve");
    expect(after.lives).toBe(START_LIVES - 1);
    expect(after.speed).toBe(speedForLevel(1));
    expect(after.ball.x).toBe(after.paddleX);
  });

  it("ends the game on the last life, keeping the score", () => {
    const s = playing({ lives: 1, score: 120, paddleX: 15, ball: { x: 80, y: FIELD_H - 4, vx: 0, vy: 80 } });
    const after = runUntil(s, (x) => x.status !== "playing", 30);
    expect(after.status).toBe("gameOver");
    expect(after.lives).toBe(0);
    expect(after.score).toBe(120);
    expect(step(after, 16)).toBe(after);
  });
});

describe("whole-game sanity", () => {
  it("an auto-tracking paddle clears level 1 without losing a life", () => {
    let s = launch(createInitialState());
    for (let i = 0; i < 60 * 600 && s.level === 1; i++) {
      // Track the ball, offset slightly so returns aren't all vertical.
      s = movePaddleTo(s, s.ball.x + 3 * Math.sin(i / 37));
      s = step(s, 16);
    }
    expect(s.level).toBe(2);
    expect(s.lives).toBe(START_LIVES);
  });
});
