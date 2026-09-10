export const BOARD_SIZE = 18;
export const INITIAL_LENGTH = 3;
export const MAX_QUEUE_LENGTH = 2;

export const BASE_TICK_MS = 190;
export const MIN_TICK_MS = 75;
export const SPEED_STEP_MS = 4;

export type Direction = "up" | "down" | "left" | "right";
export type GameStatus = "ready" | "playing" | "paused" | "gameOver" | "won";

export interface Point {
  x: number;
  y: number;
}

export interface GameState {
  snake: Point[];
  direction: Direction;
  queue: Direction[];
  food: Point | null;
  score: number;
  status: GameStatus;
}

const VECTORS: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function isOpposite(a: Direction, b: Direction): boolean {
  return VECTORS[a].x === -VECTORS[b].x && VECTORS[a].y === -VECTORS[b].y;
}

export function tickDurationForScore(score: number): number {
  return Math.max(MIN_TICK_MS, BASE_TICK_MS - score * SPEED_STEP_MS);
}

/**
 * Appends `next` to the direction queue, rejecting a direct reversal of the
 * most recently queued (or current, if nothing is queued yet) direction and
 * dropping the input once the queue is already at capacity. This is what
 * lets a player queue "up, then left" as two separate rapid taps before the
 * next tick consumes either of them, rather than only the most recent input
 * surviving and being wrongly rejected as a reversal of the stale direction.
 */
export function queueDirection(
  queue: Direction[],
  current: Direction,
  next: Direction,
): Direction[] {
  const pending = queue.length > 0 ? queue[queue.length - 1] : current;
  if (next === pending) return queue;
  if (isOpposite(next, pending)) return queue;
  if (queue.length >= MAX_QUEUE_LENGTH) return queue;
  return [...queue, next];
}

function dequeueDirection(
  queue: Direction[],
  current: Direction,
): { direction: Direction; queue: Direction[] } {
  if (queue.length === 0) return { direction: current, queue };
  const [direction, ...rest] = queue;
  return { direction, queue: rest };
}

export function createInitialState(boardSize: number, rng: () => number = Math.random): GameState {
  const row = Math.floor(boardSize / 2);
  const headX = Math.floor(boardSize / 2);
  const snake: Point[] = [];
  for (let i = 0; i < INITIAL_LENGTH; i++) {
    snake.push({ x: headX - i, y: row });
  }
  return {
    snake,
    direction: "right",
    queue: [],
    food: generateFood(snake, boardSize, rng),
    score: 0,
    status: "ready",
  };
}

/**
 * Applies a direction request from any input source (keyboard, swipe, D-pad).
 * In the ready state, the first valid direction both sets the heading and
 * starts the run; an input opposite the snake's initial orientation is
 * ignored rather than allowed to start a run that collides on the very
 * first tick. While playing, the request is queued. Paused/game-over/won
 * ignore direction input entirely.
 */
export function applyDirectionInput(state: GameState, input: Direction): GameState {
  if (state.status === "ready") {
    if (isOpposite(input, state.direction)) return state;
    return { ...state, direction: input, status: "playing" };
  }
  if (state.status === "playing") {
    const queue = queueDirection(state.queue, state.direction, input);
    if (queue === state.queue) return state;
    return { ...state, queue };
  }
  return state;
}

export function pause(state: GameState): GameState {
  return state.status === "playing" ? { ...state, status: "paused" } : state;
}

export function resume(state: GameState): GameState {
  return state.status === "paused" ? { ...state, status: "playing" } : state;
}

export function togglePause(state: GameState): GameState {
  if (state.status === "playing") return pause(state);
  if (state.status === "paused") return resume(state);
  return state;
}

function isWallCollision(point: Point, boardSize: number): boolean {
  return point.x < 0 || point.y < 0 || point.x >= boardSize || point.y >= boardSize;
}

function isSelfCollision(point: Point, body: Point[]): boolean {
  return body.some((segment) => segment.x === point.x && segment.y === point.y);
}

/**
 * Picks a uniformly random free cell rather than rejection-sampling random
 * points, so it stays correct (and terminates immediately) even when the
 * board is nearly, or entirely, full.
 */
export function generateFood(
  snake: Point[],
  boardSize: number,
  rng: () => number = Math.random,
): Point | null {
  const occupied = new Set(snake.map((p) => `${p.x},${p.y}`));
  const free: Point[] = [];
  for (let y = 0; y < boardSize; y++) {
    for (let x = 0; x < boardSize; x++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return null;
  return free[Math.floor(rng() * free.length)];
}

export function tick(state: GameState, boardSize: number, rng: () => number = Math.random): GameState {
  if (state.status !== "playing") return state;

  const { direction, queue } = dequeueDirection(state.queue, state.direction);
  const head = state.snake[0];
  const vector = VECTORS[direction];
  const newHead: Point = { x: head.x + vector.x, y: head.y + vector.y };

  if (isWallCollision(newHead, boardSize)) {
    return { ...state, direction, queue, status: "gameOver" };
  }

  const ateFood = state.food !== null && newHead.x === state.food.x && newHead.y === state.food.y;
  // When not eating, the tail cell vacates this same tick, so moving into it is legal.
  const bodyToCheck = ateFood ? state.snake : state.snake.slice(0, -1);
  if (isSelfCollision(newHead, bodyToCheck)) {
    return { ...state, direction, queue, status: "gameOver" };
  }

  const newSnake = ateFood
    ? [newHead, ...state.snake]
    : [newHead, ...state.snake.slice(0, -1)];
  const newScore = ateFood ? state.score + 1 : state.score;

  if (!ateFood) {
    return { snake: newSnake, direction, queue, food: state.food, score: newScore, status: "playing" };
  }

  const newFood = generateFood(newSnake, boardSize, rng);
  return {
    snake: newSnake,
    direction,
    queue,
    food: newFood,
    score: newScore,
    status: newFood === null ? "won" : "playing",
  };
}
