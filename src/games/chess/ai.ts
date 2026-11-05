/*
 * The computer opponent. Pure: it reads a Position and returns a Move.
 *
 * - Easy: random, but grabs a capture when it sees one. Hangs pieces.
 * - Normal: two-ply search plus capture resolution, with a little noise
 *   so it doesn't always play the same game.
 * - Hard: iterative-deepening alpha-beta (up to HARD_MAX_DEPTH plies)
 *   inside a time budget, with capture quiescence, MVV-LVA ordering and
 *   piece-square tables.
 */
import { PIECE_VALUE, applyMove, colOf, inCheck, legalMoves, pseudoMoves, rowOf, type Board, type Color, type Move, type Position } from "./logic";

export type Level = "easy" | "normal" | "hard";

export const NORMAL_DEPTH = 2;
/** Random spread, in centipawns, added to Normal's root scores. */
export const NORMAL_NOISE = 40;
export const HARD_MAX_DEPTH = 5;
/** Hard stops deepening once this much thinking time is used. */
export const HARD_TIME_MS = 700;
const QUIESCE_LIMIT = 8;
const MATE = 100000;

// Piece-square tables from white's point of view, row 0 = rank 8.
// prettier-ignore
const PST: Record<string, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
  kEnd: [
    -50,-40,-30,-20,-20,-30,-40,-50,
    -30,-20,-10,  0,  0,-10,-20,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-30,  0,  0,  0,  0,-30,-30,
    -50,-30,-30,-30,-30,-30,-30,-50,
  ],
};

/** Static score in centipawns from `pos.turn`'s point of view. */
export function evaluate(board: Board, turn: Color): number {
  let heavy = 0;
  for (const p of board) if (p && p.type !== "p" && p.type !== "k") heavy += PIECE_VALUE[p.type];
  const endgame = heavy <= 1300;
  let score = 0;
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p) continue;
    // Black reads the table upside down.
    const s = p.color === "white" ? i : (7 - rowOf(i)) * 8 + colOf(i);
    const table = p.type === "k" && endgame ? PST.kEnd : PST[p.type];
    const v = PIECE_VALUE[p.type] + table[s];
    score += p.color === turn ? v : -v;
  }
  return score;
}

/** Captures first, biggest victim by smallest attacker; promotions too. */
function orderKey(m: Move): number {
  let k = 0;
  if (m.captured) k += 10 * PIECE_VALUE[m.captured] - PIECE_VALUE[m.piece];
  if (m.promotion) k += PIECE_VALUE[m.promotion];
  return k;
}

function ordered(moves: Move[], first?: Move): Move[] {
  return moves
    .map((m) => ({ m, k: first && m.from === first.from && m.to === first.to && m.promotion === first.promotion ? 1e9 : orderKey(m) }))
    .sort((a, b) => b.k - a.k)
    .map((x) => x.m);
}

class OutOfTime extends Error {}

interface Search {
  deadline: number;
  nodes: number;
  now: () => number;
}

function tick(s: Search) {
  if (++s.nodes % 512 === 0 && s.now() > s.deadline) throw new OutOfTime();
}

function quiesce(pos: Position, alpha: number, beta: number, depth: number, s: Search): number {
  tick(s);
  const stand = evaluate(pos.board, pos.turn);
  if (stand >= beta || depth === 0) return stand;
  if (stand > alpha) alpha = stand;
  for (const m of ordered(pseudoMoves(pos).filter((x) => x.captured || x.promotion))) {
    const next = applyMove(pos, m);
    if (inCheck(next, pos.turn)) continue;
    const score = -quiesce(next, -beta, -alpha, depth - 1, s);
    if (score >= beta) return score;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(pos: Position, depth: number, alpha: number, beta: number, ply: number, s: Search): number {
  if (depth === 0) return quiesce(pos, alpha, beta, QUIESCE_LIMIT, s);
  tick(s);
  if (pos.halfmove >= 100) return 0;
  let legal = 0;
  let best = -Infinity;
  for (const m of ordered(pseudoMoves(pos))) {
    const next = applyMove(pos, m);
    if (inCheck(next, pos.turn)) continue;
    legal++;
    const score = -negamax(next, depth - 1, -beta, -alpha, ply + 1, s);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  // No legal move: mated (prefer the quickest mate) or stalemated.
  if (legal === 0) return inCheck(pos) ? -MATE + ply : 0;
  return best;
}

/**
 * Score every root move at a fixed depth. `exact` searches each with a
 * full window (true scores, needed when Normal picks among near-best
 * moves); otherwise later moves only prove they are worse, which is all
 * Hard needs and much faster.
 */
function scoreRoot(pos: Position, moves: Move[], depth: number, s: Search, exact = false): { move: Move; score: number }[] {
  const out: { move: Move; score: number }[] = [];
  let alpha = -Infinity;
  for (const move of moves) {
    const score = -negamax(applyMove(pos, move), depth - 1, -Infinity, exact ? Infinity : -alpha + 1, 1, s);
    out.push({ move, score });
    if (score > alpha) alpha = score;
  }
  return out;
}

function shuffle<T>(xs: T[], rng: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function chooseMove(
  pos: Position,
  level: Level,
  rng: () => number = Math.random,
  now: () => number = () => performance.now(),
): Move | null {
  const moves = legalMoves(pos);
  if (moves.length === 0) return null;
  if (moves.length === 1) return moves[0];

  if (level === "easy") {
    let best = moves[0];
    let bestScore = -Infinity;
    for (const m of moves) {
      const score = (m.captured ? PIECE_VALUE[m.captured] : 0) + (m.promotion ? 300 : 0) + rng() * 400;
      if (score > bestScore) [best, bestScore] = [m, score];
    }
    return best;
  }

  // Shuffle first so equal moves don't always resolve the same way.
  const base = shuffle(moves, rng);

  if (level === "normal") {
    const s: Search = { deadline: Infinity, nodes: 0, now };
    const scored = scoreRoot(pos, ordered(base), NORMAL_DEPTH, s, true);
    let best = scored[0];
    let bestScore = -Infinity;
    for (const x of scored) {
      const noisy = x.score + rng() * NORMAL_NOISE;
      if (noisy > bestScore) [best, bestScore] = [x, noisy];
    }
    return best.move;
  }

  // Hard: deepen until the time budget runs out; keep the last full result.
  const s: Search = { deadline: now() + HARD_TIME_MS, nodes: 0, now };
  let best = ordered(base)[0];
  for (let depth = 1; depth <= HARD_MAX_DEPTH; depth++) {
    try {
      const scored = scoreRoot(pos, ordered(base, best), depth, s);
      let top = scored[0];
      for (const x of scored) if (x.score > top.score) top = x;
      best = top.move;
      if (top.score >= MATE - 100) break; // found a forced mate
    } catch (e) {
      if (e instanceof OutOfTime) break;
      throw e;
    }
  }
  return best;
}
