import { describe, expect, it } from "vitest";
import {
  BOARD_SIZE,
  compressLine,
  createEmptyBoard,
  createInitialBoard,
  getEmptyCells,
  hasAvailableMove,
  hasReachedMilestone,
  isValidBestScore,
  isValidBoard,
  isValidPersistedRun,
  mergeLine,
  moveBoard,
  spawnTile,
  type Board,
} from "./logic";

/** Builds a 4x4 board from 16 values, row-major, for readable test fixtures. */
function board(values: number[]): Board {
  const rows: Board = [];
  for (let r = 0; r < BOARD_SIZE; r++) rows.push(values.slice(r * BOARD_SIZE, (r + 1) * BOARD_SIZE));
  return rows;
}

/** A rigged rng that returns a fixed sequence, then repeats the last value - lets tests control exactly which empty cell and which spawn value (2 vs 4) get picked. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[Math.min(i++, values.length - 1)];
}

describe("compressLine", () => {
  it("pushes non-zero values to the front and pads with zeros", () => {
    expect(compressLine([2, 0, 2, 0])).toEqual([2, 2, 0, 0]);
  });

  it("leaves an already-compressed line unchanged", () => {
    expect(compressLine([2, 4, 0, 0])).toEqual([2, 4, 0, 0]);
  });

  it("handles an all-zero line", () => {
    expect(compressLine([0, 0, 0, 0])).toEqual([0, 0, 0, 0]);
  });
});

describe("mergeLine", () => {
  it("merges a simple adjacent pair", () => {
    expect(mergeLine([2, 2, 0, 0]).line).toEqual([4, 0, 0, 0]);
  });

  it("merges a pair of larger equal values", () => {
    expect(mergeLine([4, 4, 0, 0]).line).toEqual([8, 0, 0, 0]);
  });

  it("merges only the leading pair of a triple, carrying the third tile forward unmerged", () => {
    const result = mergeLine([2, 2, 2, 0]);
    expect(result.line).toEqual([4, 2, 0, 0]);
  });

  it("merges two independent pairs in a quad of equal values", () => {
    const result = mergeLine([2, 2, 2, 2]);
    expect(result.line).toEqual([4, 4, 0, 0]);
  });

  it("merges two independent pairs of different values", () => {
    expect(mergeLine([4, 4, 8, 8]).line).toEqual([8, 16, 0, 0]);
  });

  it("does not chain a merge result into a further merge within the same move", () => {
    // The leading 2,2 merges to 4; that new 4 must NOT then combine with the
    // pre-existing 4 that follows it.
    const result = mergeLine([2, 2, 4, 0]);
    expect(result.line).toEqual([4, 4, 0, 0]);
    expect(result.line).not.toEqual([8, 0, 0, 0]);
  });

  it("does not chain merges across a full quad of the same value beyond one pass", () => {
    const result = mergeLine([4, 4, 4, 4]);
    expect(result.line).toEqual([8, 8, 0, 0]);
    expect(result.line).not.toEqual([16, 0, 0, 0]);
  });

  it("sums the resulting values of multiple merges in one line for scoreGained", () => {
    const result = mergeLine([2, 2, 4, 4]);
    expect(result.line).toEqual([4, 8, 0, 0]);
    expect(result.scoreGained).toBe(12);
  });

  it("reports scoreGained of 0 for a merge-free line", () => {
    expect(mergeLine([2, 4, 8, 0]).scoreGained).toBe(0);
  });

  it("reports the merged output index for a single merge", () => {
    expect(mergeLine([2, 2, 0, 0]).mergedIndices).toEqual([0]);
  });

  it("reports both merged output indices for a quad", () => {
    expect(mergeLine([2, 2, 2, 2]).mergedIndices).toEqual([0, 1]);
  });

  it("reports no merged indices when nothing merges", () => {
    expect(mergeLine([2, 4, 8, 16]).mergedIndices).toEqual([]);
  });
});

describe("moveBoard - directional equivalence", () => {
  it("left: compresses and merges toward the left edge", () => {
    const result = moveBoard(board([2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), "left");
    expect(result.board[0]).toEqual([4, 0, 0, 0]);
    expect(result.changed).toBe(true);
    expect(result.scoreGained).toBe(4);
  });

  it("right: compresses and merges toward the right edge", () => {
    const result = moveBoard(board([2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), "right");
    expect(result.board[0]).toEqual([0, 0, 0, 4]);
    expect(result.scoreGained).toBe(4);
  });

  it("up: compresses and merges toward the top edge", () => {
    // Column 0: 2,2,0,0 (top to bottom) should become 4,0,0,0.
    const result = moveBoard(board([2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), "up");
    expect([result.board[0][0], result.board[1][0], result.board[2][0], result.board[3][0]]).toEqual([4, 0, 0, 0]);
    expect(result.scoreGained).toBe(4);
  });

  it("down: compresses and merges toward the bottom edge", () => {
    const result = moveBoard(board([2, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), "down");
    expect([result.board[0][0], result.board[1][0], result.board[2][0], result.board[3][0]]).toEqual([0, 0, 0, 4]);
    expect(result.scoreGained).toBe(4);
  });

  it("applies the no-chain-merge rule identically for up and down", () => {
    // Column: 2,2,4,0 top-to-bottom.
    const up = moveBoard(board([2, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0]), "up");
    expect([up.board[0][0], up.board[1][0], up.board[2][0], up.board[3][0]]).toEqual([4, 4, 0, 0]);

    // Column: 0,2,2,4 top-to-bottom -> moving down should give 0,0,4,4.
    const down = moveBoard(board([0, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 4, 0, 0, 0]), "down");
    expect([down.board[0][0], down.board[1][0], down.board[2][0], down.board[3][0]]).toEqual([0, 0, 4, 4]);
  });
});

describe("moveBoard - no-op detection", () => {
  it("reports changed=false and scoreGained=0 when a move can't affect the board", () => {
    // Already fully compressed left, no merges available.
    const b = board([2, 4, 8, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const result = moveBoard(b, "left");
    expect(result.changed).toBe(false);
    expect(result.scoreGained).toBe(0);
    expect(result.board).toEqual(b);
  });

  it("reports changed=false on an entirely empty board for any direction", () => {
    const empty = createEmptyBoard();
    for (const dir of ["left", "right", "up", "down"] as const) {
      expect(moveBoard(empty, dir).changed).toBe(false);
    }
  });
});

describe("moveBoard - merge cell tracking", () => {
  it("reports the board position of a merged tile", () => {
    const result = moveBoard(board([2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), "left");
    expect(result.mergedCells).toEqual([[0, 0]]);
  });

  it("reports no merged cells for a move with no merges", () => {
    const result = moveBoard(board([2, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]), "left");
    expect(result.mergedCells).toEqual([]);
  });
});

describe("getEmptyCells / spawnTile", () => {
  it("lists every empty cell", () => {
    const b = board([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4]);
    expect(getEmptyCells(b)).toHaveLength(14);
  });

  it("places exactly one tile, only on a previously-empty cell", () => {
    const b = board([2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const next = spawnTile(b, sequence(0, 0));
    const before = getEmptyCells(b).length;
    const after = getEmptyCells(next).length;
    expect(after).toBe(before - 1);
  });

  it("picks the empty cell deterministically from injected rng", () => {
    // Only two empty cells: (0,2) and (0,3). rng()=0.99 for the index draw
    // should select the last one.
    const b = board([2, 4, 0, 0, 8, 16, 32, 64, 2, 4, 8, 16, 32, 64, 2, 4]);
    const next = spawnTile(b, sequence(0.99, 0));
    expect(next[0][3]).not.toBe(0);
    expect(next[0][2]).toBe(0);
  });

  it("spawns a 2 when the value draw is below the 90% threshold", () => {
    const b = board([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const next = spawnTile(b, sequence(0, 0.5));
    expect(next[0][1]).toBe(2);
  });

  it("spawns a 4 when the value draw is above the 90% threshold", () => {
    const b = board([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const next = spawnTile(b, sequence(0, 0.95));
    expect(next[0][1]).toBe(4);
  });

  it("never overwrites an occupied cell", () => {
    const b = board([2, 4, 8, 16, 32, 64, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    for (let seed = 0; seed < 20; seed++) {
      const next = spawnTile(b, sequence(seed / 20, 0.5));
      // Every originally-occupied cell must still hold its original value.
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          if (b[r][c] !== 0) expect(next[r][c]).toBe(b[r][c]);
        }
      }
    }
  });

  it("is a no-op on a completely full board", () => {
    const full = board(Array(16).fill(2));
    const next = spawnTile(full, sequence(0, 0));
    expect(next).toEqual(full);
    expect(next).toBe(full); // same reference - genuinely a no-op, not a same-valued copy
  });
});

describe("createInitialBoard", () => {
  it("starts with exactly two occupied cells", () => {
    const b = createInitialBoard(sequence(0.1, 0.2, 0.6, 0.3));
    const occupied = 16 - getEmptyCells(b).length;
    expect(occupied).toBe(2);
  });

  it("only ever places 2s or 4s initially", () => {
    for (let seed = 0; seed < 10; seed++) {
      const b = createInitialBoard(sequence(seed / 10, 0.5, (seed + 1) / 11, 0.95));
      for (const row of b) {
        for (const cell of row) {
          if (cell !== 0) expect([2, 4]).toContain(cell);
        }
      }
    }
  });
});

describe("hasAvailableMove", () => {
  it("is true whenever an empty cell exists, even on an otherwise stuck board", () => {
    const values = [2, 4, 8, 16, 4, 2, 16, 8, 8, 16, 2, 4, 16, 8, 4, 0];
    expect(hasAvailableMove(board(values))).toBe(true);
  });

  it("is false on a full board with no equal orthogonal neighbors", () => {
    // A classic no-move-remaining pattern: strictly non-matching neighbors.
    const values = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    expect(hasAvailableMove(board(values))).toBe(false);
  });

  it("is true on a full board with a horizontal merge available", () => {
    const values = [2, 2, 4, 8, 4, 8, 2, 4, 8, 4, 8, 2, 4, 2, 4, 8];
    expect(hasAvailableMove(board(values))).toBe(true);
  });

  it("is true on a full board with a vertical merge available", () => {
    const values = [2, 4, 2, 4, 2, 8, 4, 8, 4, 8, 2, 4, 8, 2, 8, 2];
    // Column 0 has 2,2 adjacent (rows 0-1) - vertical merge available.
    expect(hasAvailableMove(board(values))).toBe(true);
  });
});

describe("hasReachedMilestone", () => {
  it("is false below the threshold", () => {
    const values = [1024, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(hasReachedMilestone(board(values))).toBe(false);
  });

  it("is true once a tile reaches exactly the threshold", () => {
    const values = [2048, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(hasReachedMilestone(board(values))).toBe(true);
  });

  it("remains true for values beyond the threshold", () => {
    const values = [4096, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(hasReachedMilestone(board(values))).toBe(true);
  });

  it("supports a custom threshold", () => {
    const values = [512, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(hasReachedMilestone(board(values), 512)).toBe(true);
    expect(hasReachedMilestone(board(values), 1024)).toBe(false);
  });
});

describe("isValidBoard", () => {
  it("accepts a well-formed board", () => {
    expect(isValidBoard(createEmptyBoard())).toBe(true);
    expect(isValidBoard(board([2, 4, 8, 16, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(true);
  });

  it("accepts values well beyond 2048 - no artificial ceiling", () => {
    expect(isValidBoard(board([65536, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe(true);
  });

  it("rejects the wrong number of rows", () => {
    expect(isValidBoard([[0, 0, 0, 0]])).toBe(false);
    expect(isValidBoard([...createEmptyBoard(), [0, 0, 0, 0]])).toBe(false);
  });

  it("rejects a row with the wrong number of columns", () => {
    const bad = createEmptyBoard();
    bad[0] = [0, 0, 0];
    expect(isValidBoard(bad)).toBe(false);
  });

  it("rejects non-array shapes entirely", () => {
    expect(isValidBoard(null)).toBe(false);
    expect(isValidBoard(undefined)).toBe(false);
    expect(isValidBoard("board")).toBe(false);
    expect(isValidBoard({ rows: 4 })).toBe(false);
    expect(isValidBoard(42)).toBe(false);
  });

  it("rejects cells holding strings, null, or objects", () => {
    const bad1 = createEmptyBoard();
    (bad1[0] as unknown[])[0] = "2";
    expect(isValidBoard(bad1)).toBe(false);

    const bad2 = createEmptyBoard();
    (bad2[0] as unknown[])[0] = null;
    expect(isValidBoard(bad2)).toBe(false);

    const bad3 = createEmptyBoard();
    (bad3[0] as unknown[])[0] = { value: 2 };
    expect(isValidBoard(bad3)).toBe(false);
  });

  it("rejects a value that isn't a power of two", () => {
    const bad = createEmptyBoard();
    bad[0][0] = 3;
    expect(isValidBoard(bad)).toBe(false);
  });

  it("rejects a negative cell value", () => {
    const bad = createEmptyBoard();
    bad[0][0] = -2;
    expect(isValidBoard(bad)).toBe(false);
  });
});

describe("isValidBestScore", () => {
  it("accepts zero and positive finite numbers", () => {
    expect(isValidBestScore(0)).toBe(true);
    expect(isValidBestScore(48120)).toBe(true);
  });

  it("rejects negative numbers", () => {
    expect(isValidBestScore(-1)).toBe(false);
  });

  it("rejects NaN and non-finite values", () => {
    expect(isValidBestScore(NaN)).toBe(false);
    expect(isValidBestScore(Infinity)).toBe(false);
    expect(isValidBestScore(-Infinity)).toBe(false);
  });

  it("rejects non-number types", () => {
    expect(isValidBestScore("100")).toBe(false);
    expect(isValidBestScore(null)).toBe(false);
    expect(isValidBestScore(undefined)).toBe(false);
  });
});

describe("isValidPersistedRun", () => {
  const validBoard = board([2, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  it("accepts a well-formed persisted run", () => {
    expect(isValidPersistedRun({ board: validBoard, score: 128, milestoneShown: false })).toBe(true);
  });

  it("rejects a malformed board", () => {
    expect(isValidPersistedRun({ board: [[0, 0, 0, 0]], score: 0, milestoneShown: false })).toBe(false);
  });

  it("rejects a negative score", () => {
    expect(isValidPersistedRun({ board: validBoard, score: -5, milestoneShown: false })).toBe(false);
  });

  it("rejects a non-finite score", () => {
    expect(isValidPersistedRun({ board: validBoard, score: NaN, milestoneShown: false })).toBe(false);
    expect(isValidPersistedRun({ board: validBoard, score: Infinity, milestoneShown: false })).toBe(false);
  });

  it("rejects a non-boolean milestoneShown", () => {
    expect(isValidPersistedRun({ board: validBoard, score: 0, milestoneShown: "false" })).toBe(false);
    expect(isValidPersistedRun({ board: validBoard, score: 0, milestoneShown: 0 })).toBe(false);
  });

  it("rejects null, arrays, and primitives outright", () => {
    expect(isValidPersistedRun(null)).toBe(false);
    expect(isValidPersistedRun(undefined)).toBe(false);
    expect(isValidPersistedRun([])).toBe(false);
    expect(isValidPersistedRun("run")).toBe(false);
    expect(isValidPersistedRun(42)).toBe(false);
  });

  it("rejects an object missing required fields", () => {
    expect(isValidPersistedRun({ board: validBoard })).toBe(false);
    expect(isValidPersistedRun({ score: 0, milestoneShown: false })).toBe(false);
  });
});
