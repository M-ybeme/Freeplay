import { describe, expect, it } from "vitest";
import {
  MAX_QUEUE_LENGTH,
  applyDirectionInput,
  createInitialState,
  generateFood,
  isOpposite,
  pause,
  queueDirection,
  resume,
  tick,
  togglePause,
  type GameState,
} from "./logic";

const BOARD = 18;

function playing(overrides: Partial<GameState> = {}): GameState {
  return {
    snake: [
      { x: 5, y: 5 },
      { x: 4, y: 5 },
      { x: 3, y: 5 },
    ],
    direction: "right",
    queue: [],
    food: { x: 10, y: 10 },
    score: 0,
    status: "playing",
    ...overrides,
  };
}

describe("createInitialState", () => {
  it("starts ready, with the expected length, score, and a valid food cell", () => {
    const state = createInitialState(BOARD, () => 0);
    expect(state.status).toBe("ready");
    expect(state.snake).toHaveLength(3);
    expect(state.score).toBe(0);
    expect(state.food).not.toBeNull();
    const onSnake = state.snake.some(
      (seg) => seg.x === state.food?.x && seg.y === state.food?.y,
    );
    expect(onSnake).toBe(false);
  });
});

describe("movement", () => {
  it("advances the head one cell in the current direction, and the body follows", () => {
    const state = playing();
    const next = tick(state, BOARD);
    expect(next.snake[0]).toEqual({ x: 6, y: 5 });
    expect(next.snake[1]).toEqual({ x: 5, y: 5 });
    expect(next.snake[2]).toEqual({ x: 4, y: 5 });
    expect(next.snake).toHaveLength(3);
  });

  it("moves up, down, and left correctly", () => {
    expect(tick(playing({ direction: "up" }), BOARD).snake[0]).toEqual({ x: 5, y: 4 });
    expect(tick(playing({ direction: "down" }), BOARD).snake[0]).toEqual({ x: 5, y: 6 });
    expect(
      tick(playing({ snake: [{ x: 5, y: 5 }, { x: 6, y: 5 }, { x: 7, y: 5 }], direction: "left" }), BOARD)
        .snake[0],
    ).toEqual({ x: 4, y: 5 });
  });

  it("does not advance while ready, paused, gameOver, or won", () => {
    for (const status of ["ready", "paused", "gameOver", "won"] as const) {
      const state = playing({ status });
      expect(tick(state, BOARD)).toBe(state);
    }
  });
});

describe("direction rules", () => {
  it("rejects a direct 180 degree reversal", () => {
    expect(isOpposite("left", "right")).toBe(true);
    expect(isOpposite("up", "down")).toBe(true);
    expect(isOpposite("up", "left")).toBe(false);
    const queue = queueDirection([], "right", "left");
    expect(queue).toEqual([]);
  });

  it("accepts a valid turn", () => {
    const queue = queueDirection([], "right", "up");
    expect(queue).toEqual(["up"]);
  });

  it("buffers rapid sequential turns and rejects a reversal relative to the pending direction", () => {
    // Moving right; player quickly taps up then left before the next tick.
    let queue = queueDirection([], "right", "up");
    queue = queueDirection(queue, "right", "left");
    expect(queue).toEqual(["up", "left"]);
  });

  it("rejects a queued input that would reverse the last queued direction", () => {
    // Moving right, queued up; a queued "down" would reverse the pending "up".
    const queue = queueDirection(["up"], "right", "down");
    expect(queue).toEqual(["up"]);
  });

  it("ignores a redundant repeat of the pending direction", () => {
    const queue = queueDirection(["up"], "right", "up");
    expect(queue).toEqual(["up"]);
  });

  it("bounds the queue length so mashing cannot build an unbounded backlog", () => {
    let queue: ReturnType<typeof queueDirection> = [];
    queue = queueDirection(queue, "right", "up"); // ["up"]
    queue = queueDirection(queue, "right", "left"); // ["up", "left"]
    expect(queue).toHaveLength(MAX_QUEUE_LENGTH);
    queue = queueDirection(queue, "right", "down"); // queue full, dropped
    expect(queue).toEqual(["up", "left"]);
  });

  it("consumes buffered directions one per tick, in order", () => {
    let state = playing({ queue: ["up", "left"] });
    state = tick(state, BOARD);
    expect(state.direction).toBe("up");
    expect(state.queue).toEqual(["left"]);
    state = tick(state, BOARD);
    expect(state.direction).toBe("left");
    expect(state.queue).toEqual([]);
  });
});

describe("applyDirectionInput", () => {
  it("starts the run on the first valid direction while ready", () => {
    const ready = createInitialState(BOARD, () => 0);
    const started = applyDirectionInput(ready, "up");
    expect(started.status).toBe("playing");
    expect(started.direction).toBe("up");
  });

  it("ignores a ready-state input opposite the snake's initial orientation", () => {
    const ready = createInitialState(BOARD, () => 0); // default direction is "right"
    const result = applyDirectionInput(ready, "left");
    expect(result.status).toBe("ready");
    expect(result).toBe(ready);
  });

  it("queues input while playing", () => {
    const state = playing();
    const result = applyDirectionInput(state, "up");
    expect(result.queue).toEqual(["up"]);
  });

  it("ignores direction input while paused", () => {
    const state = playing({ status: "paused" });
    const result = applyDirectionInput(state, "up");
    expect(result).toBe(state);
  });
});

describe("pause/resume", () => {
  it("pauses only while playing", () => {
    expect(pause(playing()).status).toBe("paused");
    expect(pause(playing({ status: "ready" })).status).toBe("ready");
  });

  it("resumes only while paused", () => {
    expect(resume(playing({ status: "paused" })).status).toBe("playing");
    expect(resume(playing()).status).toBe("playing");
  });

  it("toggles between playing and paused", () => {
    const paused = togglePause(playing());
    expect(paused.status).toBe("paused");
    expect(togglePause(paused).status).toBe("playing");
  });
});

describe("growth", () => {
  it("grows by one segment and increases score when eating food", () => {
    const state = playing({
      snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }],
      food: { x: 6, y: 5 },
      direction: "right",
      score: 0,
    });
    const next = tick(state, BOARD);
    expect(next.snake).toHaveLength(4);
    expect(next.score).toBe(1);
    expect(next.snake[0]).toEqual({ x: 6, y: 5 });
  });
});

describe("food generation", () => {
  it("never spawns on the snake", () => {
    const snake = [
      { x: 1, y: 1 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
    ];
    for (let i = 0; i < 50; i++) {
      const food = generateFood(snake, 3, () => i / 50);
      expect(food).not.toBeNull();
      const onSnake = snake.some((seg) => seg.x === food!.x && seg.y === food!.y);
      expect(onSnake).toBe(false);
    }
  });

  it("still finds the one remaining free cell on a nearly full board", () => {
    // 3x3 board, every cell occupied except (2,2).
    const snake: { x: number; y: number }[] = [];
    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        if (x === 2 && y === 2) continue;
        snake.push({ x, y });
      }
    }
    const food = generateFood(snake, 3, () => 0);
    expect(food).toEqual({ x: 2, y: 2 });
  });

  it("returns null when the board is completely full", () => {
    const snake: { x: number; y: number }[] = [];
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        snake.push({ x, y });
      }
    }
    expect(generateFood(snake, 2, () => 0)).toBeNull();
  });
});

describe("collision", () => {
  it("ends the run on wall collision in each direction", () => {
    expect(tick(playing({ snake: [{ x: 0, y: 5 }], direction: "left" }), BOARD).status).toBe(
      "gameOver",
    );
    expect(
      tick(playing({ snake: [{ x: BOARD - 1, y: 5 }], direction: "right" }), BOARD).status,
    ).toBe("gameOver");
    expect(tick(playing({ snake: [{ x: 5, y: 0 }], direction: "up" }), BOARD).status).toBe(
      "gameOver",
    );
    expect(
      tick(playing({ snake: [{ x: 5, y: BOARD - 1 }], direction: "down" }), BOARD).status,
    ).toBe("gameOver");
  });

  it("ends the run when the head moves into its own body", () => {
    // A snake curled so moving up drives the head into its own neck.
    const state = playing({
      snake: [
        { x: 5, y: 5 },
        { x: 5, y: 4 },
        { x: 4, y: 4 },
        { x: 4, y: 5 },
      ],
      direction: "up",
      food: { x: 10, y: 10 },
    });
    expect(tick(state, BOARD).status).toBe("gameOver");
  });

  it("does not treat moving into the vacating tail cell as a collision", () => {
    // A 4-cell loop (1,0) -> (1,1) -> (0,1) -> (0,0) -> back to (1,0). Moving
    // "left" from the head sends it exactly onto the current tail cell,
    // which is legal because the tail vacates that cell on the same tick.
    const state = playing({
      snake: [
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 0, y: 1 },
        { x: 0, y: 0 },
      ],
      direction: "left",
      food: { x: 10, y: 10 },
    });
    const next = tick(state, BOARD);
    expect(next.status).toBe("playing");
    expect(next.snake[0]).toEqual({ x: 0, y: 0 });
    expect(next.snake).toHaveLength(4);
  });
});

describe("score", () => {
  it("does not change score on a non-eating tick", () => {
    const state = playing({ score: 2 });
    expect(tick(state, BOARD).score).toBe(2);
  });

  it("increases by exactly one per food eaten", () => {
    const state = playing({
      snake: [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }],
      food: { x: 6, y: 5 },
      score: 4,
    });
    expect(tick(state, BOARD).score).toBe(5);
  });
});

describe("full board", () => {
  it("wins instead of looping or crashing when the last free cell is eaten", () => {
    // 2x2 board: snake occupies 3 cells, food on the 4th (last free) cell.
    const state: GameState = {
      snake: [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 1, y: 1 },
      ],
      direction: "right",
      queue: [],
      food: { x: 1, y: 0 },
      score: 3,
      status: "playing",
    };
    const next = tick(state, 2);
    expect(next.status).toBe("won");
    expect(next.food).toBeNull();
    expect(next.snake).toHaveLength(4);
  });
});
