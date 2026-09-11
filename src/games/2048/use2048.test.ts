import { describe, expect, it } from "vitest";
import { reducer, type GameState } from "./use2048";
import { BOARD_SIZE, type Board } from "./logic";

function board(values: number[]): Board {
  const rows: Board = [];
  for (let r = 0; r < BOARD_SIZE; r++) rows.push(values.slice(r * BOARD_SIZE, (r + 1) * BOARD_SIZE));
  return rows;
}

function fixedState(values: number[], overrides: Partial<GameState> = {}): GameState {
  return {
    board: board(values),
    score: 0,
    milestoneShown: false,
    previous: null,
    lastMergedCells: [],
    lastSpawnedCell: null,
    ...overrides,
  };
}

/** rng that always spawns at the first empty cell found, as a 2 - keeps move outcomes predictable in tests. */
const spawnFirstCellAsTwo = () => 0;

describe("reducer - move", () => {
  it("moves, merges, scores, and spawns exactly one tile on a successful move", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const state = fixedState([2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const next = reducer(state, { type: "move", direction: "left", rng: spawnFirstCellAsTwo });
    // Merges to [4,0,0,0]; the first empty cell in row-major order is then (0,1).
    expect(next.board[0]).toEqual([4, 2, 0, 0]);
    expect(next.score).toBe(4);
  });

  it("does not spawn, score, or replace the undo point on a no-op move", () => {
    const state = fixedState([2, 4, 8, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], {
      previous: { board: board(Array(16).fill(0)), score: 0, milestoneShown: false },
    });
    const next = reducer(state, { type: "move", direction: "left", rng: spawnFirstCellAsTwo });
    expect(next).toBe(state); // truly untouched, not just equal
  });

  it("ignores a move entirely once the game is over (no legal move anywhere)", () => {
    const stuck = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    const state = fixedState(stuck);
    const next = reducer(state, { type: "move", direction: "left", rng: spawnFirstCellAsTwo });
    expect(next).toBe(state);
  });

  it("records the previous board/score/milestone before applying a successful move", () => {
    const state = fixedState([2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { score: 40, milestoneShown: false });
    const next = reducer(state, { type: "move", direction: "left", rng: spawnFirstCellAsTwo });
    expect(next.previous).toEqual({ board: state.board, score: 40, milestoneShown: false });
  });
});

describe("reducer - undo", () => {
  it("restores the exact board and score from before the last move", () => {
    const before = board([2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const state = fixedState([4, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], {
      score: 4,
      previous: { board: before, score: 0, milestoneShown: false },
    });
    const next = reducer(state, { type: "undo" });
    expect(next.board).toEqual(before);
    expect(next.score).toBe(0);
  });

  it("restores the milestone flag exactly as it was before the move", () => {
    const before = board(Array(16).fill(0));
    const state = fixedState(Array(16).fill(0), {
      milestoneShown: true,
      previous: { board: before, score: 0, milestoneShown: false },
    });
    const next = reducer(state, { type: "undo" });
    expect(next.milestoneShown).toBe(false);
  });

  it("clears the undo point after undoing - it is single-step, not a stack", () => {
    const before = board(Array(16).fill(0));
    const state = fixedState(Array(16).fill(0), { previous: { board: before, score: 0, milestoneShown: false } });
    const next = reducer(state, { type: "undo" });
    expect(next.previous).toBeNull();
  });

  it("is a no-op when there is nothing to undo", () => {
    const state = fixedState(Array(16).fill(0));
    const next = reducer(state, { type: "undo" });
    expect(next).toBe(state);
  });

  it("can undo a move that resulted in game over, returning to a playable board", () => {
    // One tile away from a fully-stuck board; the move that fills the last
    // cell without creating any merge opportunity ends the game.
    const before = board([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 0]);
    const stuckAfter = board([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2]);
    const state = fixedState([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2], {
      previous: { board: before, score: 0, milestoneShown: false },
    });
    expect(state.board).toEqual(stuckAfter);
    const next = reducer(state, { type: "undo" });
    expect(next.board).toEqual(before);
  });

  it("a no-op move never overwrites an existing valid undo point", () => {
    const previous = { board: board(Array(16).fill(0)), score: 0, milestoneShown: false };
    const state = fixedState([2, 4, 8, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { previous });
    const next = reducer(state, { type: "move", direction: "left" });
    expect(next.previous).toBe(previous);
  });
});

describe("reducer - 2048 milestone", () => {
  it("does not flag a prompt-worthy state on its own (that's derived in the hook, not the reducer) but tracks acknowledgment", () => {
    const state = fixedState([2048, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(state.milestoneShown).toBe(false);
    const acknowledged = reducer(state, { type: "acknowledge-milestone" });
    expect(acknowledged.milestoneShown).toBe(true);
  });

  it("does not reset milestoneShown back to false on a subsequent successful move", () => {
    const state = fixedState([2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { milestoneShown: true });
    const next = reducer(state, { type: "move", direction: "left", rng: spawnFirstCellAsTwo });
    expect(next.milestoneShown).toBe(true);
  });

  it("a fresh new game always starts with the milestone not yet shown", () => {
    const state = fixedState([2048, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], { milestoneShown: true });
    const next = reducer(state, { type: "new-game", rng: () => 0.5 });
    expect(next.milestoneShown).toBe(false);
  });
});

describe("reducer - new-game / hydrate", () => {
  it("new-game clears score, previous, and starts with exactly two tiles", () => {
    const state = fixedState([2, 4, 8, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], {
      score: 100,
      previous: { board: board(Array(16).fill(0)), score: 0, milestoneShown: false },
    });
    const next = reducer(state, { type: "new-game", rng: () => 0.5 });
    expect(next.score).toBe(0);
    expect(next.previous).toBeNull();
    const occupied = next.board.flat().filter((v) => v !== 0).length;
    expect(occupied).toBe(2);
  });

  it("hydrate loads a persisted run with a clean (empty) undo point", () => {
    const persistedBoard = board([2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const state = fixedState(Array(16).fill(0));
    const next = reducer(state, {
      type: "hydrate",
      run: { board: persistedBoard, score: 64, milestoneShown: true },
    });
    expect(next.board).toEqual(persistedBoard);
    expect(next.score).toBe(64);
    expect(next.milestoneShown).toBe(true);
    expect(next.previous).toBeNull();
  });
});
