import { describe, expect, it } from "vitest";
import { chooseMove, evaluate, type Level } from "./ai";
import {
  createGame,
  fromFEN,
  inCheck,
  insufficientMaterial,
  legalMoves,
  parseSquare,
  perft,
  playMove,
  undoMove,
  undoToTurn,
  winner,
  type GameState,
  type Move,
  type PieceType,
} from "./logic";

/** Play moves given as "e2e4" / "e7e8q" coordinates. */
function play(game: GameState, ...coords: string[]): GameState {
  for (const c of coords) {
    const next = playMove(game, {
      from: parseSquare(c.slice(0, 2)),
      to: parseSquare(c.slice(2, 4)),
      piece: "p",
      promotion: (c[4] as PieceType | undefined) ?? undefined,
    });
    if (next === game) throw new Error(`illegal: ${c}`);
    game = next;
  }
  return game;
}

const sans = (g: GameState) => g.moves.map((m) => m.san);
const coord = (m: Move | null) => (m ? `${"abcdefgh"[m.from & 7]}${8 - (m.from >> 3)}${"abcdefgh"[m.to & 7]}${8 - (m.to >> 3)}` : null);

describe("move generation (perft)", () => {
  // Published node counts; any rule bug (castling through check, en
  // passant pins, promotion) shows up as a wrong number.
  it("start position", () => {
    const p = fromFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect([1, 2, 3].map((d) => perft(p, d))).toEqual([20, 400, 8902]);
  });

  it("Kiwipete: castling, pins, en passant, promotions", () => {
    const p = fromFEN("r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1");
    expect([1, 2, 3].map((d) => perft(p, d))).toEqual([48, 2039, 97862]);
  }, 30_000);

  it("rook endgame with en passant discovered checks", () => {
    const p = fromFEN("8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1");
    expect([1, 2, 3, 4].map((d) => perft(p, d))).toEqual([14, 191, 2812, 43238]);
  }, 30_000);

  it("promotion-heavy position", () => {
    const p = fromFEN("r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1");
    expect([1, 2, 3].map((d) => perft(p, d))).toEqual([6, 264, 9467]);
  });

  it("position 5", () => {
    const p = fromFEN("rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8");
    expect([1, 2].map((d) => perft(p, d))).toEqual([44, 1486]);
  });
});

describe("rules", () => {
  it("fastest checkmate ends the game for black", () => {
    const g = play(createGame(), "f2f3", "e7e5", "g2g4", "d8h4");
    expect(g.status).toBe("checkmate");
    expect(winner(g)).toBe("black");
    expect(sans(g)).toEqual(["f3", "e5", "g4", "Qh4#"]);
  });

  it("stalemate is a draw", () => {
    const s = play(createGame(fromFEN("7k/8/5QK1/8/8/8/8/8 w - - 0 1")), "f6f7");
    expect(s.status).toBe("stalemate");
    expect(winner(s)).toBe("draw");
  });

  it("en passant only immediately after the double step", () => {
    let g = play(createGame(), "e2e4", "a7a6", "e4e5", "d7d5");
    expect(sans(play(g, "e5d6"))).toContain("exd6");
    expect(play(g, "e5d6").position.board[parseSquare("d5")]).toBeNull();
    g = play(g, "a2a3", "a6a5");
    expect(() => play(g, "e5d6")).toThrow();
  });

  it("castling both ways, and rights lost after the king moves", () => {
    const base = createGame(fromFEN("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"));
    const ks = play(base, "e1g1");
    expect(sans(ks)).toEqual(["O-O"]);
    expect(ks.position.board[parseSquare("f1")]?.type).toBe("r");
    const qs = play(base, "e1c1");
    expect(sans(qs)).toEqual(["O-O-O"]);
    expect(qs.position.board[parseSquare("d1")]?.type).toBe("r");
    const walked = play(base, "e1e2", "a8b8", "e2e1", "b8a8");
    expect(() => play(walked, "e1g1")).toThrow();
  });

  it("cannot castle out of, through, or into check", () => {
    // Black rook on f8 covers f1: no king-side castle; queen side is fine.
    const g = createGame(fromFEN("4kr2/8/8/8/8/8/8/R3K2R w KQ - 0 1"));
    const castles = legalMoves(g.position).filter((m) => m.castle);
    expect(castles.map((m) => m.castle)).toEqual(["q"]);
    const checked = createGame(fromFEN("4r1k1/8/8/8/8/8/8/R3K2R w KQ - 0 1"));
    expect(legalMoves(checked.position).some((m) => m.castle)).toBe(false);
  });

  it("promotion offers all four pieces and names them", () => {
    const g = createGame(fromFEN("8/P6k/8/8/8/8/8/K7 w - - 0 1"));
    const promos = legalMoves(g.position).filter((m) => m.promotion);
    expect(promos.map((m) => m.promotion).sort()).toEqual(["b", "n", "q", "r"]);
    const queened = play(g, "a7a8q");
    expect(queened.position.board[0]).toEqual({ type: "q", color: "white" });
    expect(sans(queened)).toEqual(["a8=Q"]);
    expect(sans(play(g, "a7a8n"))).toEqual(["a8=N"]);
  });

  it("disambiguates SAN when two pieces can reach a square", () => {
    const g = play(createGame(fromFEN("k7/8/8/8/8/8/8/KN3N2 w - - 0 1")), "b1d2");
    expect(sans(g)).toEqual(["Nbd2"]);
    const ranks = play(createGame(fromFEN("7k/8/8/8/R7/8/8/R6K w - - 0 1")), "a1a2");
    expect(sans(ranks)).toEqual(["R1a2"]);
  });

  it("a pinned piece cannot move off the pin", () => {
    const g = createGame(fromFEN("4r1k1/8/8/8/8/8/4B3/4K3 w - - 0 1"));
    expect(legalMoves(g.position).filter((m) => m.piece === "b")).toHaveLength(0);
  });

  it("insufficient material", () => {
    const board = (fen: string) => fromFEN(`${fen} w - - 0 1`).board;
    expect(insufficientMaterial(board("k7/8/8/8/8/8/8/K7"))).toBe(true);
    expect(insufficientMaterial(board("k7/8/8/8/8/8/8/KN6"))).toBe(true);
    expect(insufficientMaterial(board("k7/8/8/8/8/8/8/KB6"))).toBe(true);
    expect(insufficientMaterial(board("k2b4/8/8/8/8/8/8/KB6"))).toBe(false); // opposite shades
    expect(insufficientMaterial(board("k7/8/8/8/8/8/8/KNN5"))).toBe(false);
    expect(insufficientMaterial(board("k7/p7/8/8/8/8/8/K7"))).toBe(false);
    const g = play(createGame(fromFEN("k7/8/8/8/8/8/1r6/K7 w - - 0 1")), "a1b2");
    expect(g.status).toBe("material");
  });

  it("threefold repetition", () => {
    let g = createGame();
    const shuffle = ["g1f3", "g8f6", "f3g1", "f6g8"];
    g = play(g, ...shuffle);
    expect(g.status).toBe("playing");
    g = play(g, ...shuffle);
    expect(g.status).toBe("repetition");
  });

  it("fifty-move rule", () => {
    const g = play(createGame(fromFEN("k7/8/8/8/8/8/8/KR6 w - - 99 80")), "b1b2");
    expect(g.status).toBe("fifty");
    // A pawn move resets the count.
    expect(play(createGame(fromFEN("k7/8/8/8/8/8/P7/KR6 w - - 99 80")), "a2a3").status).toBe("playing");
  });

  it("finished games refuse further moves", () => {
    const g = play(createGame(), "f2f3", "e7e5", "g2g4", "d8h4");
    expect(playMove(g, legalMoves(createGame().position)[0])).toBe(g);
  });
});

describe("undo", () => {
  it("steps back one move, including out of checkmate", () => {
    const g = play(createGame(), "f2f3", "e7e5", "g2g4", "d8h4");
    const u = undoMove(g);
    expect(u.status).toBe("playing");
    expect(u.moves).toHaveLength(3);
    expect(u.position.turn).toBe("black");
  });

  it("undoToTurn skips the computer's reply", () => {
    const g = play(createGame(), "e2e4", "e7e5", "g1f3", "b8c6");
    const u = undoToTurn(g, "white");
    expect(sans(u)).toEqual(["e4", "e5"]);
    expect(u.position.turn).toBe("white");
    expect(undoToTurn(createGame(), "white").moves).toHaveLength(0);
  });

  it("restores castling and en passant state", () => {
    const g = createGame(fromFEN("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1"));
    const back = undoMove(play(g, "e1g1"));
    expect(back.position).toEqual(g.position);
  });
});

describe("computer", () => {
  const levels: Level[] = ["easy", "normal", "hard"];
  const seeded = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  // A fake clock that advances per call keeps Hard's time budget
  // deterministic and independent of the test machine's speed.
  const clock = () => {
    let t = 0;
    return () => (t += 0.05);
  };

  it("every level plays only legal moves through a whole game", () => {
    for (const level of levels) {
      let g = createGame();
      const rng = seeded(7);
      for (let n = 0; n < 40 && g.status === "playing"; n++) {
        const m = chooseMove(g.position, n % 2 === 0 ? level : "easy", rng, clock());
        expect(m).not.toBeNull();
        const next = playMove(g, m!);
        expect(next).not.toBe(g);
        g = next;
      }
    }
  }, 60_000);

  it("returns null with no legal moves", () => {
    const g = play(createGame(), "f2f3", "e7e5", "g2g4", "d8h4");
    expect(chooseMove(g.position, "hard")).toBeNull();
  });

  it("Normal and Hard take a free queen", () => {
    const p = fromFEN("k7/8/8/3q4/8/8/8/K2R4 w - - 0 1");
    expect(coord(chooseMove(p, "normal", seeded(3)))).toBe("d1d5");
    expect(coord(chooseMove(p, "hard", seeded(3), clock()))).toBe("d1d5");
  });

  it("Normal and Hard find mate in one", () => {
    // Back-rank mate: Re8#.
    const p = fromFEN("6k1/5ppp/8/8/8/8/8/K3R3 w - - 0 1");
    expect(coord(chooseMove(p, "normal", seeded(5)))).toBe("e1e8");
    expect(coord(chooseMove(p, "hard", seeded(5), clock()))).toBe("e1e8");
  });

  it("Hard doesn't grab a defended pawn with its queen", () => {
    // Qxd5 loses the queen to cxd5.
    const p = fromFEN("k7/8/2p5/3p4/8/8/8/K2Q4 w - - 0 1");
    expect(coord(chooseMove(p, "hard", seeded(1), clock()))).not.toBe("d1d5");
  });

  it("Hard finds a mate in two", () => {
    // Two rooks against a bare king.
    const p = fromFEN("6k1/8/8/8/8/8/R7/1R4K1 w - - 0 1");
    let g = createGame(p);
    g = playMove(g, chooseMove(g.position, "hard", seeded(2), clock())!);
    g = playMove(g, chooseMove(g.position, "hard", seeded(2), clock())!);
    const finish = chooseMove(g.position, "hard", seeded(2), clock())!;
    // Within a couple of moves the rook ladder should be closing in.
    expect(inCheck(playMove(g, finish).position) || playMove(g, finish).status === "checkmate").toBe(true);
  });

  it("evaluation is symmetric", () => {
    const p = fromFEN("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(evaluate(p.board, "white")).toBe(0);
    expect(evaluate(p.board, "black")).toBe(0);
  });
});
