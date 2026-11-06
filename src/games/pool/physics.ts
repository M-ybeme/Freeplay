/*
 * Pool table physics. Units are inches on a 100 x 50 playing surface
 * (a 9-foot table), measured to the cushion noses; time is in seconds.
 * Pure arithmetic in fixed small steps, so a shot plays out the same way
 * every time (which is what lets the computer player test its shots).
 *
 * Each ball carries its velocity `v` and a "rolling velocity" `r`: the
 * speed its spin would carry it at if it were rolling. While they differ
 * the ball slides and cloth friction pulls them together; then it rolls.
 * That gives follow (top spin), draw (back spin) and stun for free. Side
 * spin `s` (surface speed about the vertical axis) only acts at cushions.
 *
 * Functions named step/strike/simulate mutate the world they're given:
 * it's a hot loop, and callers clone first (see cloneWorld).
 */

export const TABLE_W = 100;
export const TABLE_H = 50;
export const BALL_R = 1.125;
/** How far each corner pocket's opening runs along both rails from the corner. */
export const CORNER_GAP = 3.8;
/** Half the width of a side pocket's opening. */
export const SIDE_GAP = 2.7;
/** Cue ball speed at full power (in/s): a hard break. */
export const MAX_SPEED = 320;
/** The physics step: small enough that a ball at full speed moves under a third of its diameter. */
export const DT = 1 / 600;

const G = 386;
const SLIDE_DECEL = 0.2 * G;
const ROLL_DECEL = 10;
const SIDE_DECAY = 1.2;
const BALL_E = 0.94;
const RAIL_E = 0.75;
const RAIL_KEEP = 0.97;
/** How much side spin bends a cushion rebound. */
const RAIL_SPIN_GRIP = 0.3;
const STOP_SPEED = 0.35;

export interface Ball {
  /** 0 is the cue ball; 1-15 the object balls. */
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rx: number;
  ry: number;
  s: number;
  /** Index into POCKETS once it drops, else null. */
  pocket: number | null;
}

/** What happened during a shot, for the rules. */
export interface ShotLog {
  /** The first ball the cue ball touched. */
  firstHit: number | null;
  pocketed: { id: number; pocket: number }[];
  /** Any ball reached a cushion after the cue ball's first contact. */
  railAfterHit: boolean;
  /** Object balls that touched a cushion (for a legal break). */
  railBalls: number[];
}

export interface World {
  balls: Ball[];
  log: ShotLog;
  time: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Pockets, numbered top-left, top-middle, top-right, bottom-left, bottom-middle, bottom-right. */
export const POCKETS: readonly Point[] = [
  { x: 0, y: 0 },
  { x: TABLE_W / 2, y: 0 },
  { x: TABLE_W, y: 0 },
  { x: 0, y: TABLE_H },
  { x: TABLE_W / 2, y: TABLE_H },
  { x: TABLE_W, y: TABLE_H },
];

interface Rail {
  /** Axis-aligned: a horizontal rail has fixed y, a vertical one fixed x. */
  horizontal: boolean;
  at: number;
  from: number;
  to: number;
  /** +1 if the table is on the increasing side of the rail. */
  side: 1 | -1;
}

const W = TABLE_W;
const H = TABLE_H;
export const RAILS: readonly Rail[] = [
  { horizontal: true, at: 0, from: CORNER_GAP, to: W / 2 - SIDE_GAP, side: 1 },
  { horizontal: true, at: 0, from: W / 2 + SIDE_GAP, to: W - CORNER_GAP, side: 1 },
  { horizontal: true, at: H, from: CORNER_GAP, to: W / 2 - SIDE_GAP, side: -1 },
  { horizontal: true, at: H, from: W / 2 + SIDE_GAP, to: W - CORNER_GAP, side: -1 },
  { horizontal: false, at: 0, from: CORNER_GAP, to: H - CORNER_GAP, side: 1 },
  { horizontal: false, at: W, from: CORNER_GAP, to: H - CORNER_GAP, side: -1 },
];

/** The cushion ends at each pocket mouth, where a ball can rattle. */
export const JAWS: readonly Point[] = RAILS.flatMap((r) =>
  r.horizontal
    ? [
        { x: r.from, y: r.at },
        { x: r.to, y: r.at },
      ]
    : [
        { x: r.at, y: r.from },
        { x: r.at, y: r.to },
      ],
);

export const HEAD_X = W / 4;
export const FOOT_SPOT: Point = { x: (3 * W) / 4, y: H / 2 };
export const HEAD_SPOT: Point = { x: HEAD_X, y: H / 2 };

export function newLog(): ShotLog {
  return { firstHit: null, pocketed: [], railAfterHit: false, railBalls: [] };
}

export function makeBall(id: number, x: number, y: number): Ball {
  return { id, x, y, vx: 0, vy: 0, rx: 0, ry: 0, s: 0, pocket: null };
}

export function cloneWorld(world: World): World {
  return {
    balls: world.balls.map((b) => ({ ...b })),
    log: { ...world.log, pocketed: [...world.log.pocketed], railBalls: [...world.log.railBalls] },
    time: world.time,
  };
}

/** Cue speed for a power setting 0-1: fine control at the soft end. */
export function speedFor(power: number): number {
  const p = Math.min(1, Math.max(0, power));
  return 6 + (MAX_SPEED - 6) * p ** 1.6;
}

export interface Spin {
  /** -1 (left) to 1 (right). */
  x: number;
  /** -1 (back/draw) to 1 (top/follow). */
  y: number;
}

/**
 * Strike the cue ball. Hitting off centre puts spin on it: a tip 0.5R
 * above centre gives 1.25x the ball's speed as rolling velocity (natural
 * roll is 0.4R), below gives backspin; to the side gives english.
 */
export function strike(world: World, angle: number, power: number, spin: Spin = { x: 0, y: 0 }): World {
  const cue = world.balls.find((b) => b.id === 0);
  if (!cue || cue.pocket !== null) return world;
  let { x: sx, y: sy } = spin;
  const m = Math.hypot(sx, sy);
  if (m > 1) {
    sx /= m;
    sy /= m;
  }
  const v = speedFor(power);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  cue.vx = v * dx;
  cue.vy = v * dy;
  cue.rx = 1.25 * sy * v * dx;
  cue.ry = 1.25 * sy * v * dy;
  cue.s = -0.625 * sx * v;
  world.log = newLog();
  world.time = 0;
  return world;
}

function nearestPocket(x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  POCKETS.forEach((p, i) => {
    const d = (p.x - x) ** 2 + (p.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function cushionHit(world: World, b: Ball) {
  const log = world.log;
  if (b.id !== 0 && !log.railBalls.includes(b.id)) log.railBalls.push(b.id);
  if (log.firstHit !== null) log.railAfterHit = true;
}

/** Bounce off a surface whose normal (into the table) is n. */
function bounce(b: Ball, nx: number, ny: number) {
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return false;
  const tx = -ny;
  const ty = nx;
  const vt = b.vx * tx + b.vy * ty;
  const rn = b.rx * nx + b.ry * ny;
  const rt = b.rx * tx + b.ry * ty;
  // Side spin rubs against the cushion and bends the rebound.
  const nvt = vt * RAIL_KEEP + RAIL_SPIN_GRIP * b.s;
  const nvn = -vn * RAIL_E;
  b.vx = nvn * nx + nvt * tx;
  b.vy = nvn * ny + nvt * ty;
  b.rx = -rn * RAIL_E * nx + rt * tx;
  b.ry = -rn * RAIL_E * ny + rt * ty;
  b.s *= 0.6;
  return true;
}

function collideBalls(world: World, a: Ball, b: Ball, dt: number) {
  let px = b.x - a.x;
  let py = b.y - a.y;
  const d2 = px * px + py * py;
  const min = 2 * BALL_R;
  if (d2 >= min * min) return;
  // Rewind both balls to the moment they touched, so the contact normal
  // (and so the cut angle) is exact rather than off by a step's overlap.
  const wx = b.vx - a.vx;
  const wy = b.vy - a.vy;
  const ww = wx * wx + wy * wy;
  let back = 0;
  if (ww > 1e-9) {
    const pw = px * wx + py * wy;
    const disc = pw * pw - ww * (d2 - min * min);
    back = Math.min(dt, Math.max(0, (pw + Math.sqrt(Math.max(0, disc))) / ww));
  }
  a.x -= a.vx * back;
  a.y -= a.vy * back;
  b.x -= b.vx * back;
  b.y -= b.vy * back;
  px = b.x - a.x;
  py = b.y - a.y;
  const d = Math.hypot(px, py) || 1e-6;
  const nx = px / d;
  const ny = py / d;
  if (d < min) {
    // Still overlapping (balls at rest pressed together): separate them.
    const push = (min - d) / 2;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
  }
  const vn = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (vn > 0) {
    const j = ((1 + BALL_E) / 2) * vn;
    a.vx -= j * nx;
    a.vy -= j * ny;
    b.vx += j * nx;
    b.vy += j * ny;
    const log = world.log;
    if (log.firstHit === null) {
      if (a.id === 0) log.firstHit = b.id;
      else if (b.id === 0) log.firstHit = a.id;
    }
  }
  // Play the rewound time forward with the new velocities.
  a.x += a.vx * back;
  a.y += a.vy * back;
  b.x += b.vx * back;
  b.y += b.vy * back;
}

function applyFriction(b: Ball, dt: number) {
  const sx = b.vx - b.rx;
  const sy = b.vy - b.ry;
  const slip = Math.hypot(sx, sy);
  if (slip > 1e-3) {
    const d = SLIDE_DECEL * dt;
    if (slip <= 3.5 * d) {
      const vx = (5 * b.vx + 2 * b.rx) / 7;
      const vy = (5 * b.vy + 2 * b.ry) / 7;
      b.vx = b.rx = vx;
      b.vy = b.ry = vy;
    } else {
      const ux = sx / slip;
      const uy = sy / slip;
      b.vx -= d * ux;
      b.vy -= d * uy;
      b.rx += 2.5 * d * ux;
      b.ry += 2.5 * d * uy;
    }
  } else {
    const speed = Math.hypot(b.vx, b.vy);
    if (speed > 0) {
      const k = Math.max(0, speed - ROLL_DECEL * dt) / speed;
      b.vx *= k;
      b.vy *= k;
    }
    b.rx = b.vx;
    b.ry = b.vy;
  }
  b.s *= 1 - SIDE_DECAY * dt;
  if (Math.abs(b.s) < 0.05) b.s = 0;
  if (Math.hypot(b.vx, b.vy) < STOP_SPEED && Math.hypot(b.rx, b.ry) < STOP_SPEED) {
    b.vx = b.vy = b.rx = b.ry = 0;
  }
}

export function isMoving(b: Ball): boolean {
  return b.pocket === null && (b.vx !== 0 || b.vy !== 0 || b.rx !== 0 || b.ry !== 0);
}

/** Advance one physics step. Returns whether anything is still moving. */
export function step(world: World, dt = DT): boolean {
  const balls = world.balls;
  let moving = false;
  for (const b of balls) {
    if (b.pocket !== null) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  for (let i = 0; i < balls.length; i++) {
    const a = balls[i];
    if (a.pocket !== null) continue;
    const aMoving = isMoving(a);
    for (let j = i + 1; j < balls.length; j++) {
      const b = balls[j];
      // Two balls at rest can't collide.
      if (b.pocket === null && (aMoving || isMoving(b))) collideBalls(world, a, b, dt);
    }
  }
  for (const b of balls) {
    if (b.pocket !== null || !isMoving(b)) continue;
    // Cushions.
    for (const r of RAILS) {
      const along = r.horizontal ? b.x : b.y;
      if (along < r.from || along > r.to) continue;
      const across = (r.horizontal ? b.y : b.x) - r.at;
      const depth = across * r.side;
      if (depth < BALL_R && depth > -BALL_R) {
        const nx = r.horizontal ? 0 : r.side;
        const ny = r.horizontal ? r.side : 0;
        if (bounce(b, nx, ny)) cushionHit(world, b);
        if (r.horizontal) b.y = r.at + r.side * BALL_R;
        else b.x = r.at + r.side * BALL_R;
      }
    }
    // Pocket jaws.
    for (const p of JAWS) {
      const dx = b.x - p.x;
      const dy = b.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < BALL_R && d > 0) {
        const nx = dx / d;
        const ny = dy / d;
        if (bounce(b, nx, ny)) cushionHit(world, b);
        b.x = p.x + nx * BALL_R;
        b.y = p.y + ny * BALL_R;
      }
    }
    // Past the cushion line (only possible through a mouth): it drops.
    if (b.x < 0 || b.x > W || b.y < 0 || b.y > H) {
      const pocket = nearestPocket(b.x, b.y);
      b.pocket = pocket;
      b.vx = b.vy = b.rx = b.ry = b.s = 0;
      world.log.pocketed.push({ id: b.id, pocket });
      continue;
    }
    applyFriction(b, dt);
    if (isMoving(b)) moving = true;
  }
  world.time += dt;
  return moving;
}

/** Longest a shot can run before everything is stopped where it lies. */
export const MAX_SHOT_TIME = 30;

/**
 * The step to take next: DT while anything is fast, longer (up to 1/120s)
 * once everything is slow, always keeping each move under a third of a
 * ball's radius.
 */
export function nextDt(world: World): number {
  let max = 0;
  for (const b of world.balls) {
    if (b.pocket !== null) continue;
    const v = Math.max(Math.abs(b.vx) + Math.abs(b.vy), Math.abs(b.rx) + Math.abs(b.ry));
    if (v > max) max = v;
  }
  return Math.min(1 / 120, Math.max(DT, (0.35 * BALL_R) / (max || 1)));
}

/** Run a struck world until everything stops. */
export function simulate(world: World): World {
  while (step(world, nextDt(world))) {
    if (world.time > MAX_SHOT_TIME) {
      for (const b of world.balls) b.vx = b.vy = b.rx = b.ry = b.s = 0;
      break;
    }
  }
  return world;
}

// ---------- Racking ----------

/** mulberry32 step: returns [value in 0..1, next state]. */
export function nextRandom(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

/**
 * A racked table: the 8 in the middle of the triangle, a solid and a
 * stripe in the back corners, the 1 at the apex on the foot spot, and
 * the cue ball on the head spot.
 */
export function rackBalls(seed: number): Ball[] {
  let rng = seed;
  const rand = () => {
    const [x, n] = nextRandom(rng);
    rng = n;
    return x;
  };
  const shuffle = (ids: number[]) => {
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  };
  const solids = shuffle([2, 3, 4, 5, 6, 7]);
  const stripes = shuffle([9, 10, 11, 12, 13, 14, 15]);
  const corners = rand() < 0.5 ? [solids.pop()!, stripes.pop()!] : [stripes.pop()!, solids.pop()!];
  const rest = shuffle([...solids, ...stripes]);

  const gap = 2 * BALL_R + 0.004;
  const rowStep = gap * Math.cos(Math.PI / 6);
  const balls: Ball[] = [makeBall(0, HEAD_SPOT.x, HEAD_SPOT.y)];
  for (let row = 0; row < 5; row++) {
    for (let j = 0; j <= row; j++) {
      let id: number;
      if (row === 0) id = 1;
      else if (row === 2 && j === 1) id = 8;
      else if (row === 4 && j === 0) id = corners[0];
      else if (row === 4 && j === 4) id = corners[1];
      else id = rest.pop()!;
      balls.push(makeBall(id, FOOT_SPOT.x + row * rowStep, FOOT_SPOT.y + (j - row / 2) * gap));
    }
  }
  return balls.sort((a, b) => a.id - b.id);
}
