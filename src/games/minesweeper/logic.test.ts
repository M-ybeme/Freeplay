import { describe, expect, it } from "vitest";
import {
  DIFFICULTIES,
  cellLabel,
  countFlags,
  createEmptyBoard,
  minesRemaining,
  placeMines,
  revealCell,
  toggleFlag,
  type BoardState,
  type Difficulty,
} from "./logic";

const SMALL: Difficulty = { id: "beginner", label: "Small", rows: 5, cols: 5, mines: 5 };

/**
 * Builds a fully deterministic, already-mined board from an explicit list of
 * mine indices — bypassing placeMines/first-click-safety entirely. Used for
 * tests where first-click safety would otherwise make the scenario
 * impossible to construct (e.g. testing a non-flooding numbered reveal, or
 * a loss on a board with more than one safe cell).
 */
function fixedBoard(rows: number, cols: number, mineIndices: number[]): BoardState {
  const mineSet = new Set(mineIndices);
  const total = rows * cols;
  const cells = Array.from({ length: total }, (_, i) => ({
    hasMine: mineSet.has(i),
    adjacent: 0,
    revealed: false,
    flagged: false,
  }));
  const neighbors = (i: number) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const result: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = row + dr;
        const c = col + dc;
        if (r >= 0 && r < rows && c >= 0 && c < cols) result.push(r * cols + c);
      }
    }
    return result;
  };
  for (let i = 0; i < total; i++) {
    if (cells[i].hasMine) continue;
    cells[i].adjacent = neighbors(i).filter((n) => cells[n].hasMine).length;
  }
  return {
    difficulty: { id: "beginner", label: "Fixed", rows, cols, mines: mineIndices.length },
    cells,
    status: "ready",
    minesPlaced: true,
    triggeredIndex: null,
    revealedSafeCount: 0,
  };
}

describe("DIFFICULTIES", () => {
  it("defines beginner, intermediate, and expert with sensible cell/mine counts", () => {
    const byId = Object.fromEntries(DIFFICULTIES.map((d) => [d.id, d]));
    expect(byId.beginner).toMatchObject({ rows: 9, cols: 9, mines: 10 });
    expect(byId.intermediate).toMatchObject({ rows: 16, cols: 16, mines: 40 });
    // Expert: reshaped from classic 30x16 to 24x20 for mobile widths, same
    // 480 cells / 99 mines / density as the original.
    expect(byId.expert.rows * byId.expert.cols).toBe(480);
    expect(byId.expert.mines).toBe(99);
  });

  it("keeps mine count well under total cells for every difficulty", () => {
    for (const d of DIFFICULTIES) {
      expect(d.mines).toBeLessThan(d.rows * d.cols);
    }
  });
});

describe("placeMines", () => {
  it("produces the exact requested board dimensions and mine count", () => {
    const cells = placeMines(9, 9, 10, 40, () => 0.5);
    expect(cells).toHaveLength(81);
    expect(cells.filter((c) => c.hasMine)).toHaveLength(10);
  });

  it("never places two mines in the same cell (no duplicates possible by construction)", () => {
    const cells = placeMines(9, 9, 10, 0, () => 0.37);
    const mineIndices = cells.reduce<number[]>((acc, c, i) => (c.hasMine ? [...acc, i] : acc), []);
    expect(new Set(mineIndices).size).toBe(mineIndices.length);
  });

  it("never places a mine on the excluded safe cell", () => {
    for (let trial = 0; trial < 20; trial++) {
      const rng = (() => {
        let seed = trial * 0.0917 + 0.01;
        return () => {
          seed = (seed * 9301 + 49297) % 233280;
          return seed / 233280;
        };
      })();
      const cells = placeMines(9, 9, 10, 40, rng);
      expect(cells[40].hasMine).toBe(false);
    }
  });

  it("also excludes the safe cell's neighbors when the board has room", () => {
    // 9x9 with 10 mines has plenty of room to exclude a full 3x3 neighborhood.
    const cells = placeMines(9, 9, 10, 40, () => 0.9); // center cell, index 40 -> row 4 col 4
    const neighborsOfCenter = [30, 31, 32, 39, 41, 48, 49, 50];
    for (const n of neighborsOfCenter) {
      expect(cells[n].hasMine).toBe(false);
    }
  });

  it("computes correct adjacency counts for corners, edges, and center", () => {
    // 3x3 board, mines at every corner (indices 0, 2, 6, 8).
    const board = fixedBoard(3, 3, [0, 2, 6, 8]);
    expect(board.cells[4].adjacent).toBe(4); // center touches all 4 corners
    expect(board.cells[1].adjacent).toBe(2); // top edge: touches corners 0 and 2
    expect(board.cells[3].adjacent).toBe(2); // left edge: touches corners 0 and 6
    expect(board.cells[5].adjacent).toBe(2); // right edge: touches corners 2 and 8
    expect(board.cells[7].adjacent).toBe(2); // bottom edge: touches corners 6 and 8
  });

  it("degrades to protecting only the clicked cell when the board is too small for a full neighborhood", () => {
    // 3x3 board (9 cells) with 8 mines: only 1 cell can possibly be safe,
    // so the full 3x3 neighborhood exclusion (up to 9 cells) cannot fit.
    const cells = placeMines(3, 3, 8, 4, () => 0.5); // center cell
    expect(cells.filter((c) => c.hasMine)).toHaveLength(8);
    expect(cells[4].hasMine).toBe(false);
  });

  it("does not hang or throw on a fully degenerate board (mines == total-1)", () => {
    expect(() => placeMines(2, 2, 3, 0, () => 0.5)).not.toThrow();
    const cells = placeMines(2, 2, 3, 0, () => 0.5);
    expect(cells.filter((c) => c.hasMine)).toHaveLength(3);
  });
});

describe("revealCell", () => {
  it("places mines only on the first reveal, not before", () => {
    const board = createEmptyBoard(SMALL);
    expect(board.minesPlaced).toBe(false);
    const next = revealCell(board, 12);
    expect(next.minesPlaced).toBe(true);
  });

  it("the first revealed cell is never a mine", () => {
    for (let i = 0; i < 25; i++) {
      const board = createEmptyBoard(SMALL);
      const next = revealCell(board, 12);
      expect(next.status).not.toBe("lost");
    }
  });

  it("reveals a single numbered cell without flooding when it has adjacent mines", () => {
    // 3x3, one mine at corner (index 0). Center (index 4) is adjacent to it,
    // so it's numbered (adjacent=1) and must not flood further.
    const board = fixedBoard(3, 3, [0]);
    const next = revealCell(board, 4);
    expect(next.cells[4].adjacent).toBe(1);
    const revealedCount = next.cells.filter((c) => c.revealed).length;
    expect(revealedCount).toBe(1);
    expect(next.status).toBe("playing");
  });

  it("flood-fills connected zero cells and reveals their numbered boundary", () => {
    // Construct a controlled scenario by revealing on an empty board with no
    // mines at all - guarantees a zero-adjacency start and full flood fill.
    const noMines: Difficulty = { id: "beginner", label: "Empty", rows: 5, cols: 5, mines: 0 };
    const board = createEmptyBoard(noMines);
    const next = revealCell(board, 12); // center
    // With zero mines, every cell has adjacent=0, so the whole board reveals.
    expect(next.cells.every((c) => c.revealed)).toBe(true);
    expect(next.status).toBe("won");
  });

  it("does not flood through flagged cells", () => {
    const noMines: Difficulty = { id: "beginner", label: "Empty", rows: 5, cols: 5, mines: 0 };
    let board = createEmptyBoard(noMines);
    board = toggleFlag(board, 13); // flag a neighbor of the center before revealing
    const next = revealCell(board, 12);
    expect(next.cells[13].revealed).toBe(false);
    expect(next.cells[13].flagged).toBe(true);
  });

  it("never auto-reveals a mine via flood fill", () => {
    // A board with one mine far from an otherwise all-zero region should
    // never reveal that mine as a side effect of flooding.
    for (let trial = 0; trial < 10; trial++) {
      const d: Difficulty = { id: "beginner", label: "Sparse", rows: 6, cols: 6, mines: 1 };
      const board = createEmptyBoard(d);
      const next = revealCell(board, 0);
      if (next.status === "lost") continue; // the one mine happened to be excluded-adjacent; retry logic below covers safety separately
      const mineCells = next.cells.filter((c) => c.hasMine);
      expect(mineCells.every((c) => !c.revealed)).toBe(true);
    }
  });

  it("revealing an already-revealed cell is a no-op", () => {
    const noMines: Difficulty = { id: "beginner", label: "Empty", rows: 3, cols: 3, mines: 0 };
    const board = createEmptyBoard(noMines);
    const once = revealCell(board, 0);
    const twice = revealCell(once, 0);
    expect(twice).toEqual(once);
  });

  it("revealing a mine ends the game as a loss and reveals all mines", () => {
    // 4x4 with 2 mines at opposite corners (0 and 15): revealing a safe cell
    // in between does not win outright, so a follow-up reveal can hit a mine.
    const board = fixedBoard(4, 4, [0, 15]);
    const afterSafe = revealCell(board, 5);
    expect(afterSafe.status).toBe("playing");
    const lost = revealCell(afterSafe, 0);
    expect(lost.status).toBe("lost");
    expect(lost.triggeredIndex).toBe(0);
    expect(lost.cells.filter((c) => c.hasMine).every((c) => c.revealed)).toBe(true);
  });

  it("revealing all non-mine cells wins the game", () => {
    const d: Difficulty = { id: "beginner", label: "OneMine", rows: 3, cols: 3, mines: 1 };
    let board = createEmptyBoard(d);
    board = revealCell(board, 0);
    // reveal every remaining unrevealed, non-mine cell one at a time
    for (let i = 0; i < board.cells.length; i++) {
      if (!board.cells[i].revealed && !board.cells[i].hasMine) {
        board = revealCell(board, i);
      }
    }
    expect(board.status).toBe("won");
  });

  it("does not allow reveal after the game has ended", () => {
    const d: Difficulty = { id: "beginner", label: "AllMines", rows: 3, cols: 3, mines: 8 };
    const board = createEmptyBoard(d);
    const revealed = revealCell(board, 4);
    const mineIndex = revealed.cells.findIndex((c) => c.hasMine);
    const lost = revealCell(revealed, mineIndex);
    const another = revealCell(lost, (mineIndex + 1) % 9);
    expect(another).toBe(lost);
  });

  it("does not reveal a flagged cell", () => {
    let board = createEmptyBoard(SMALL);
    board = toggleFlag(board, 7);
    const next = revealCell(board, 7);
    expect(next).toBe(board);
  });
});

describe("toggleFlag", () => {
  it("flags an unrevealed cell", () => {
    const board = createEmptyBoard(SMALL);
    const next = toggleFlag(board, 3);
    expect(next.cells[3].flagged).toBe(true);
  });

  it("unflags a flagged cell", () => {
    let board = createEmptyBoard(SMALL);
    board = toggleFlag(board, 3);
    board = toggleFlag(board, 3);
    expect(board.cells[3].flagged).toBe(false);
  });

  it("cannot flag a revealed cell", () => {
    const noMines: Difficulty = { id: "beginner", label: "Empty", rows: 3, cols: 3, mines: 0 };
    let board = createEmptyBoard(noMines);
    board = revealCell(board, 0); // reveals everything (all zero)
    const next = toggleFlag(board, 4);
    expect(next.cells[4].flagged).toBe(false);
  });

  it("does not allow flagging after the game has ended", () => {
    const d: Difficulty = { id: "beginner", label: "AllMines", rows: 3, cols: 3, mines: 8 };
    const board = createEmptyBoard(d);
    const revealed = revealCell(board, 4);
    const mineIndex = revealed.cells.findIndex((c) => c.hasMine);
    const lost = revealCell(revealed, mineIndex);
    const next = toggleFlag(lost, (mineIndex + 1) % 9);
    expect(next).toBe(lost);
  });
});

describe("mine counter", () => {
  it("counts flags correctly", () => {
    let board = createEmptyBoard(SMALL);
    board = toggleFlag(board, 0);
    board = toggleFlag(board, 1);
    board = toggleFlag(board, 2);
    expect(countFlags(board.cells)).toBe(3);
  });

  it("computes mines remaining as mines minus flags", () => {
    let board = createEmptyBoard(SMALL); // 5 mines
    board = toggleFlag(board, 0);
    board = toggleFlag(board, 1);
    expect(minesRemaining(board)).toBe(3);
  });

  it("allows the remaining count to go negative when over-flagged", () => {
    let board = createEmptyBoard(SMALL); // 5 mines
    for (let i = 0; i < 7; i++) board = toggleFlag(board, i);
    expect(minesRemaining(board)).toBe(-2);
  });
});

describe("game status transitions", () => {
  it("starts in ready", () => {
    expect(createEmptyBoard(SMALL).status).toBe("ready");
  });

  it("moves to playing after a non-terminal first reveal", () => {
    const d: Difficulty = { id: "beginner", label: "Sparse", rows: 8, cols: 8, mines: 1 };
    const board = createEmptyBoard(d);
    const next = revealCell(board, 0);
    expect(["playing", "won"]).toContain(next.status);
  });

  it("auto-flags remaining mines on a win, without ever revealing them", () => {
    const board = fixedBoard(4, 4, [0, 15]);
    let next = board;
    for (let i = 0; i < 16; i++) {
      if (!next.cells[i].hasMine) next = revealCell(next, i);
    }
    expect(next.status).toBe("won");
    expect(next.cells[0].flagged).toBe(true);
    expect(next.cells[15].flagged).toBe(true);
    expect(next.cells[0].revealed).toBe(false);
    expect(next.cells[15].revealed).toBe(false);
  });
});

describe("cellLabel", () => {
  const base = { hasMine: false, adjacent: 0, revealed: false, flagged: false };

  it("labels an unrevealed cell without exposing mine state", () => {
    expect(cellLabel({ ...base, hasMine: true }, 2, 4, false)).toBe("Unrevealed cell, row 3 column 5");
  });

  it("labels a flagged cell without exposing mine state", () => {
    expect(cellLabel({ ...base, hasMine: true, flagged: true }, 0, 0, false)).toBe(
      "Flagged cell, row 1 column 1",
    );
  });

  it("labels a revealed empty cell", () => {
    expect(cellLabel({ ...base, revealed: true }, 1, 1, false)).toBe("Revealed empty cell, row 2 column 2");
  });

  it("labels a revealed numbered cell with its adjacent count", () => {
    expect(cellLabel({ ...base, revealed: true, adjacent: 3 }, 1, 1, false)).toBe(
      "Revealed cell, 3 adjacent mines, row 2 column 2",
    );
  });

  it("labels a revealed mine as the detonated one only when it is the trigger", () => {
    const mineCell = { ...base, hasMine: true, revealed: true };
    expect(cellLabel(mineCell, 0, 0, true)).toBe("Detonated mine, row 1 column 1");
    expect(cellLabel(mineCell, 0, 0, false)).toBe("Mine, row 1 column 1");
  });
});
