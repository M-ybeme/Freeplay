/*
 * Brick Breaker rules: pure functions over a plain state object. No React,
 * no DOM, no timers - the hook owns the animation loop and input.
 *
 * Everything is in field units (FIELD_W x FIELD_H); the component maps
 * them to percentages. Time is passed in as milliseconds.
 */

// ---------- Tunables ----------

export const FIELD_W = 100;
export const FIELD_H = 130;

export const PADDLE_W = 20;
export const PADDLE_H = 2.6;
/** Top edge of the paddle. */
export const PADDLE_Y = 120;
/** Keyboard paddle speed, field units per second. */
export const PADDLE_KEY_SPEED = 120;

export const BALL_R = 1.7;

export const BRICK_COLS = 8;
export const BRICK_TOP = 14;
export const BRICK_H = 4.4;
export const BRICK_GAP = 1;
export const BRICK_SIDE = 2;

export const START_LIVES = 3;

/** Ball speed in field units per second. */
export const BASE_SPEED = 72;
export const SPEED_PER_LEVEL = 7;
export const SPEED_PER_PADDLE_HIT = 0.6;
export const MAX_SPEED = 135;

/** Steepest return off the paddle edge, measured from straight up. */
export const MAX_BOUNCE_ANGLE = (60 * Math.PI) / 180;
/** Serve angle from straight up, aimed away from the nearer wall. */
export const LAUNCH_ANGLE = (22 * Math.PI) / 180;

/** Longest frame the simulation will accept (a stalled tab must not teleport the ball). */
export const MAX_STEP_MS = 50;

export const POINTS_ONE_HIT = 10;
export const POINTS_TWO_HIT = 30;
export const LEVEL_CLEAR_BONUS = 50;

/*
 * Original wall layouts, one row per string: "1" = one-hit brick,
 * "2" = armoured two-hit brick, "." = gap. Cycles after the last one, with
 * the ball getting faster each level.
 */
export const LEVELS: string[][] = [
  ["11111111", "11111111", "11111111", "11111111"],
  ["21111112", "12111121", "11211211", "11122111"],
  ["22222222", "1......1", "1.2222.1", "1......1", "11111111"],
  ["1.1.1.1.", ".2.2.2.2", "1.1.1.1.", ".2.2.2.2", "22222222"],
  ["...22...", "..2112..", ".211112.", "21111112", ".111111."],
];

// ---------- Types ----------

export type Status = "serve" | "playing" | "paused" | "gameOver";

export interface Brick {
  id: number;
  row: number;
  col: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
}

export interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface GameState {
  status: Status;
  level: number;
  lives: number;
  score: number;
  /** Paddle centre. */
  paddleX: number;
  ball: Ball;
  bricks: Brick[];
  /** Current ball speed (units/s); creeps up with paddle hits. */
  speed: number;
}

// ---------- Construction ----------

export function brickWidth(): number {
  return (FIELD_W - BRICK_SIDE * 2 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;
}

export function buildBricks(level: number): Brick[] {
  const layout = LEVELS[(level - 1) % LEVELS.length];
  const w = brickWidth();
  const bricks: Brick[] = [];
  layout.forEach((line, row) => {
    for (let col = 0; col < BRICK_COLS; col++) {
      const ch = line[col];
      if (ch !== "1" && ch !== "2") continue;
      const hp = Number(ch);
      bricks.push({
        id: row * BRICK_COLS + col,
        row,
        col,
        x: BRICK_SIDE + col * (w + BRICK_GAP),
        y: BRICK_TOP + row * (BRICK_H + BRICK_GAP),
        w,
        h: BRICK_H,
        hp,
        maxHp: hp,
      });
    }
  });
  return bricks;
}

export function speedForLevel(level: number): number {
  return Math.min(BASE_SPEED + (level - 1) * SPEED_PER_LEVEL, MAX_SPEED);
}

function restingBall(paddleX: number): Ball {
  return { x: paddleX, y: PADDLE_Y - BALL_R, vx: 0, vy: 0 };
}

export function createInitialState(): GameState {
  const paddleX = FIELD_W / 2;
  return {
    status: "serve",
    level: 1,
    lives: START_LIVES,
    score: 0,
    paddleX,
    ball: restingBall(paddleX),
    bricks: buildBricks(1),
    speed: speedForLevel(1),
  };
}

// ---------- Input ----------

export function clampPaddle(x: number): number {
  return Math.min(Math.max(x, PADDLE_W / 2), FIELD_W - PADDLE_W / 2);
}

/** Pointer/drag control: put the paddle centre at x. The ball rides along while serving. */
export function movePaddleTo(state: GameState, x: number): GameState {
  if (state.status !== "serve" && state.status !== "playing") return state;
  const paddleX = clampPaddle(x);
  if (paddleX === state.paddleX) return state;
  return {
    ...state,
    paddleX,
    ball: state.status === "serve" ? restingBall(paddleX) : state.ball,
  };
}

export function launch(state: GameState): GameState {
  if (state.status !== "serve") return state;
  // Aim away from the nearer wall so a serve from the edge isn't wasted.
  const side = state.paddleX <= FIELD_W / 2 ? 1 : -1;
  return {
    ...state,
    status: "playing",
    ball: {
      ...restingBall(state.paddleX),
      vx: side * state.speed * Math.sin(LAUNCH_ANGLE),
      vy: -state.speed * Math.cos(LAUNCH_ANGLE),
    },
  };
}

export function togglePause(state: GameState): GameState {
  if (state.status === "playing") return { ...state, status: "paused" };
  if (state.status === "paused") return { ...state, status: "playing" };
  return state;
}

export function pause(state: GameState): GameState {
  return state.status === "playing" ? { ...state, status: "paused" } : state;
}

// ---------- Simulation ----------

/** Paddle bounce: the further from centre, the steeper the return. */
export function paddleBounce(ballX: number, paddleX: number, speed: number): { vx: number; vy: number } {
  const offset = Math.min(Math.max((ballX - paddleX) / (PADDLE_W / 2), -1), 1);
  const angle = offset * MAX_BOUNCE_ANGLE;
  return { vx: speed * Math.sin(angle), vy: -speed * Math.cos(angle) };
}

function circleHitsRect(ball: Ball, b: Brick): boolean {
  const cx = Math.min(Math.max(ball.x, b.x), b.x + b.w);
  const cy = Math.min(Math.max(ball.y, b.y), b.y + b.h);
  const dx = ball.x - cx;
  const dy = ball.y - cy;
  return dx * dx + dy * dy < BALL_R * BALL_R;
}

/**
 * Advance the game by dtMs. keyDir is the held keyboard direction
 * (-1 left, 0 none, 1 right). The ball moves in sub-steps no longer than
 * half its radius, so it can never tunnel through a brick or the paddle.
 */
export function step(state: GameState, dtMs: number, keyDir: -1 | 0 | 1 = 0): GameState {
  if (state.status !== "serve" && state.status !== "playing") return state;
  const dt = Math.min(Math.max(dtMs, 0), MAX_STEP_MS) / 1000;

  let s = state;
  if (keyDir !== 0) s = movePaddleTo(s, s.paddleX + keyDir * PADDLE_KEY_SPEED * dt);
  if (s.status === "serve") return s;

  let { x, y, vx, vy } = s.ball;
  let speed = s.speed;
  let score = s.score;
  let bricks = s.bricks;

  const distance = speed * dt;
  const subSteps = Math.max(1, Math.ceil(distance / (BALL_R * 0.5)));
  const frac = dt / subSteps;

  for (let i = 0; i < subSteps; i++) {
    x += vx * frac;
    y += vy * frac;

    // Walls and ceiling.
    if (x < BALL_R) {
      x = BALL_R;
      vx = Math.abs(vx);
    } else if (x > FIELD_W - BALL_R) {
      x = FIELD_W - BALL_R;
      vx = -Math.abs(vx);
    }
    if (y < BALL_R) {
      y = BALL_R;
      vy = Math.abs(vy);
    }

    // Paddle (only on the way down, so it can't double-hit).
    if (
      vy > 0 &&
      y + BALL_R >= PADDLE_Y &&
      y - BALL_R <= PADDLE_Y + PADDLE_H &&
      Math.abs(x - s.paddleX) <= PADDLE_W / 2 + BALL_R
    ) {
      speed = Math.min(speed + SPEED_PER_PADDLE_HIT, MAX_SPEED);
      ({ vx, vy } = paddleBounce(x, s.paddleX, speed));
      y = PADDLE_Y - BALL_R;
    }

    // Bricks: at most one per sub-step, reflecting on the shallower axis.
    const ball = { x, y, vx, vy };
    const hit = bricks.find((b) => circleHitsRect(ball, b));
    if (hit) {
      const penX = Math.min(x + BALL_R - hit.x, hit.x + hit.w - (x - BALL_R));
      const penY = Math.min(y + BALL_R - hit.y, hit.y + hit.h - (y - BALL_R));
      if (penX < penY) {
        vx = x < hit.x + hit.w / 2 ? -Math.abs(vx) : Math.abs(vx);
      } else {
        vy = y < hit.y + hit.h / 2 ? -Math.abs(vy) : Math.abs(vy);
      }
      if (hit.hp <= 1) {
        bricks = bricks.filter((b) => b.id !== hit.id);
        score += hit.maxHp >= 2 ? POINTS_TWO_HIT : POINTS_ONE_HIT;
      } else {
        bricks = bricks.map((b) => (b.id === hit.id ? { ...b, hp: b.hp - 1 } : b));
      }

      if (bricks.length === 0) {
        const level = s.level + 1;
        const nextSpeed = speedForLevel(level);
        return {
          ...s,
          status: "serve",
          level,
          score: score + LEVEL_CLEAR_BONUS,
          bricks: buildBricks(level),
          ball: restingBall(s.paddleX),
          speed: nextSpeed,
        };
      }
    }

    // Fell past the paddle.
    if (y - BALL_R > FIELD_H) {
      const lives = s.lives - 1;
      return {
        ...s,
        status: lives <= 0 ? "gameOver" : "serve",
        lives,
        score,
        bricks,
        ball: restingBall(s.paddleX),
        speed: speedForLevel(s.level),
      };
    }
  }

  return { ...s, ball: { x, y, vx, vy }, speed, score, bricks };
}
