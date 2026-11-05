import { describe, expect, it } from "vitest";
import {
  SIZE,
  cellName,
  chooseMove,
  countDiscs,
  createInitialState,
  flipsFor,
  idx,
  initialBoard,
  legalMoves,
  playMove,
  undoMove,
  undoToTurn,
  winner,
  type Board,
  type GameState,
  type Level,
  type Player,
} from "./logic";

/** Board from 8 strings: c = cyan, p = pink, . = empty. */
function parse(rows: string[]): Board {
  return rows.flatMap((row) => [...row].map((ch) => (ch === "c" ? "cyan" : ch === "p" ? "pink" : null)));
}

function stateOf(board: Board, current: Player = "cyan"): GameState {
  return { board, current, status: "playing", lastMove: null, lastFlips: [], passed: null, history: [] };
}

function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Play a whole game between two levels; returns the final state. */
function playOut(cyanLevel: Level, pinkLevel: Level, seed: number): GameState {
  const rng = seeded(seed);
  let s = createInitialState();
  for (let n = 0; n < 200 && s.status === "playing"; n++) {
    const move = chooseMove(s.board, s.current, s.current === "cyan" ? cyanLevel : pinkLevel, rng);
    expect(move).not.toBeNull();
    s = playMove(s, move!);
  }
  return s;
}

describe("setup", () => {
  it("starts with the four centre discs and cyan to move", () => {
    const s = createInitialState();
    expect(countDiscs(s.board)).toEqual({ cyan: 2, pink: 2 });
    expect(s.current).toBe("cyan");
    expect(s.board[idx(3, 4)]).toBe("cyan");
    expect(s.board[idx(3, 3)]).toBe("pink");
  });

  it("gives the first player the four standard opening moves", () => {
    const moves = [...legalMoves(initialBoard(), "cyan").keys()].map(cellName).sort();
    expect(moves).toEqual(["C4", "D3", "E6", "F5"]);
  });

  it("names cells A1 top-left to H8 bottom-right", () => {
    expect(cellName(0)).toBe("A1");
    expect(cellName(SIZE * SIZE - 1)).toBe("H8");
  });
});

describe("flipping", () => {
  it("flips a line in one direction", () => {
    expect(flipsFor(initialBoard(), idx(2, 3), "cyan")).toEqual([idx(3, 3)]);
  });

  it("flips in several directions at once", () => {
    const board = parse([
      "c.c.c...",
      ".ppp....",
      "cp.pc...",
      ".ppp....",
      "c.c.c...",
      "........",
      "........",
      "........",
    ]);
    expect(flipsFor(board, idx(2, 2), "cyan").sort((a, b) => a - b)).toEqual(
      [idx(1, 1), idx(1, 2), idx(1, 3), idx(2, 1), idx(2, 3), idx(3, 1), idx(3, 2), idx(3, 3)].sort((a, b) => a - b),
    );
  });

  it("does not flip a line that isn't closed by the mover", () => {
    const board = parse(["cpp.....", "........", "........", "........", "........", "........", "........", "........"]);
    expect(flipsFor(board, idx(0, 3), "cyan").sort((a, b) => a - b)).toEqual([idx(0, 1), idx(0, 2)]);
    expect(flipsFor(board, idx(0, 3), "pink")).toEqual([]);
  });

  it("does not wrap around the board edge", () => {
    const board = parse(["......cp", "p.......", "........", "........", "........", "........", "........", "........"]);
    // Index 8 is row 1 col 0; the cells "before" it in memory are on row 0.
    expect(flipsFor(board, idx(1, 1), "cyan")).toEqual([]);
  });

  it("refuses an occupied square", () => {
    expect(flipsFor(initialBoard(), idx(3, 3), "cyan")).toEqual([]);
  });
});

describe("turns", () => {
  it("plays a move, flips, and hands the turn over", () => {
    const s = playMove(createInitialState(), idx(2, 3));
    expect(s.board[idx(2, 3)]).toBe("cyan");
    expect(s.board[idx(3, 3)]).toBe("cyan");
    expect(s.current).toBe("pink");
    expect(s.lastMove).toBe(idx(2, 3));
    expect(s.lastFlips).toEqual([idx(3, 3)]);
    expect(countDiscs(s.board)).toEqual({ cyan: 4, pink: 1 });
  });

  it("ignores an illegal move", () => {
    const s = createInitialState();
    expect(playMove(s, 0)).toBe(s);
  });

  it("passes when the opponent has no move, and the mover goes again", () => {
    // After cyan takes A1, pink's only disc (B8) has no line to close,
    // while cyan can still capture it from C8.
    const board = parse([
      ".pc.....",
      "........",
      "........",
      "........",
      "........",
      "........",
      "........",
      "cp......",
    ]);
    const s = playMove(stateOf(board, "cyan"), idx(0, 0));
    expect(s.board[idx(0, 1)]).toBe("cyan");
    expect(legalMoves(s.board, "pink").size).toBe(0);
    expect(s.passed).toBe("pink");
    expect(s.current).toBe("cyan");
    expect(s.status).toBe("playing");
  });

  it("ends when neither side can move, and names the winner", () => {
    const board = parse([".pc.....", "........", "........", "........", "........", "........", "........", "........"]);
    const s = playMove(stateOf(board, "cyan"), idx(0, 0));
    expect(s.status).toBe("over");
    expect(winner(s)).toBe("cyan");
    expect(playMove(s, idx(5, 5))).toBe(s);
  });

  it("calls a draw on equal discs", () => {
    const s: GameState = { ...stateOf(parse(["cp......", "........", "........", "........", "........", "........", "........", "........"])), status: "over" };
    expect(winner(s)).toBe("draw");
    expect(winner(createInitialState())).toBeNull();
  });
});

describe("undo", () => {
  it("steps back one move at a time", () => {
    const s0 = createInitialState();
    const s1 = playMove(s0, idx(2, 3));
    const s2 = playMove(s1, legalMoves(s1.board, "pink").keys().next().value!);
    const back = undoMove(s2);
    expect(back.board).toEqual(s1.board);
    expect(back.current).toBe("pink");
    expect(undoMove(back).board).toEqual(s0.board);
    expect(undoMove(s0)).toBe(s0);
  });

  it("returns to the person's previous turn, skipping the computer's reply", () => {
    const s0 = createInitialState();
    const s1 = playMove(s0, idx(2, 3)); // cyan (person)
    const s2 = playMove(s1, legalMoves(s1.board, "pink").keys().next().value!); // pink (computer)
    const back = undoToTurn(s2, "cyan");
    expect(back.board).toEqual(s0.board);
    expect(back.current).toBe("cyan");
    expect(back.history).toHaveLength(0);
    expect(undoToTurn(s0, "cyan")).toBe(s0);
  });

  it("keeps history from nesting (each snapshot drops its own)", () => {
    let s = createInitialState();
    for (let n = 0; n < 6; n++) s = playMove(s, legalMoves(s.board, s.current).keys().next().value!);
    expect(s.history).toHaveLength(6);
    for (const h of s.history) expect(h.history).toHaveLength(0);
  });
});

describe("computer opponent", () => {
  it("only ever picks a legal move, at every level", () => {
    for (const level of ["easy", "normal", "hard"] as const) {
      const s = playMove(createInitialState(), idx(2, 3));
      const move = chooseMove(s.board, "pink", level, seeded(1));
      expect(legalMoves(s.board, "pink").has(move!)).toBe(true);
    }
  });

  it("returns null with no legal move", () => {
    const board = parse(["cc......", "........", "........", "........", "........", "........", "........", "........"]);
    expect(chooseMove(board, "pink", "hard", seeded(1))).toBeNull();
  });

  it("normal takes a free corner", () => {
    const board = parse([
      ".pc.....",
      "........",
      "...pc...",
      "...cp...",
      "........",
      "........",
      "........",
      "........",
    ]);
    expect(chooseMove(board, "cyan", "normal", seeded(2))).toBe(idx(0, 0));
  });

  it("hard plays endgames perfectly (checked against brute force)", () => {
    /** Final disc lead for `me` with best play from both sides. */
    const value = (s: GameState, me: Player): number => {
      if (s.status === "over") {
        const c = countDiscs(s.board);
        return me === "cyan" ? c.cyan - c.pink : c.pink - c.cyan;
      }
      const results = [...legalMoves(s.board, s.current).keys()].map((m) => value(playMove(s, m), me));
      return s.current === me ? Math.max(...results) : Math.min(...results);
    };
    for (let seed = 1; seed <= 4; seed++) {
      const game = playOut("easy", "easy", seed);
      const late = game.history.find((h) => h.board.filter((c) => c === null).length === 7 && legalMoves(h.board, h.current).size > 1);
      if (!late) continue;
      const me = late.current;
      const best = Math.max(...[...legalMoves(late.board, me).keys()].map((m) => value(playMove(late, m), me)));
      const chosen = chooseMove(late.board, me, "hard", seeded(seed))!;
      expect(value(playMove(late, chosen), me)).toBe(best);
    }
  });

  it("plays complete games across levels without stalling", () => {
    const pairings: [Level, Level][] = [
      ["easy", "normal"],
      ["normal", "hard"],
      ["hard", "easy"],
    ];
    for (const [a, b] of pairings) {
      {
        const end = playOut(a, b, 7);
        expect(end.status).toBe("over");
        const { cyan, pink } = countDiscs(end.board);
        expect(cyan + pink).toBeLessThanOrEqual(64);
      }
    }
  }, 60_000);

  it("is ranked: hard beats easy, and normal beats easy, most of the time", () => {
    let hardWins = 0;
    let normalWins = 0;
    const games = 6;
    for (let seed = 1; seed <= games; seed++) {
      // Alternate colours so moving first isn't the deciding factor.
      const hardAsCyan = seed % 2 === 0;
      const h = playOut(hardAsCyan ? "hard" : "easy", hardAsCyan ? "easy" : "hard", seed);
      if (winner(h) === (hardAsCyan ? "cyan" : "pink")) hardWins++;
      const n = playOut(hardAsCyan ? "normal" : "easy", hardAsCyan ? "easy" : "normal", seed + 100);
      if (winner(n) === (hardAsCyan ? "cyan" : "pink")) normalWins++;
    }
    expect(hardWins).toBeGreaterThanOrEqual(5);
    expect(normalWins).toBeGreaterThanOrEqual(4);
  }, 60_000);

  it("hard answers quickly enough to feel responsive", () => {
    let s = createInitialState();
    const rng = seeded(3);
    let slowest = 0;
    while (s.status === "playing") {
      const t = performance.now();
      const move = chooseMove(s.board, s.current, "hard", rng)!;
      slowest = Math.max(slowest, performance.now() - t);
      s = playMove(s, move);
    }
    expect(slowest).toBeLessThan(1500);
  }, 60_000);
});
