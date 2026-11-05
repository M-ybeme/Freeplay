/*
 * Reversi rules and computer opponent: pure functions, no React/DOM.
 *
 * The rules never know who is a person and who is the computer - a move
 * is a move. The hook decides which side each controller plays, which is
 * what lets one game support both 1-player and 2-player.
 */

export const SIZE = 8;

export type Player = "cyan" | "pink";
export type Cell = Player | null;
export type Board = Cell[];

/** Cyan moves first. */
export const FIRST: Player = "cyan";

export function opponent(p: Player): Player {
  return p === "cyan" ? "pink" : "cyan";
}

export const idx = (row: number, col: number) => row * SIZE + col;
export const rowOf = (i: number) => Math.floor(i / SIZE);
export const colOf = (i: number) => i % SIZE;

/** Algebraic-style name, A1 top-left. */
export function cellName(i: number): string {
  return `${"ABCDEFGH"[colOf(i)]}${rowOf(i) + 1}`;
}

const DIRS: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

export function initialBoard(): Board {
  const board: Board = Array(SIZE * SIZE).fill(null);
  board[idx(3, 3)] = "pink";
  board[idx(4, 4)] = "pink";
  board[idx(3, 4)] = "cyan";
  board[idx(4, 3)] = "cyan";
  return board;
}

/** Discs that placing at i would flip (empty when the move is illegal). */
export function flipsFor(board: Board, i: number, player: Player): number[] {
  if (board[i] !== null) return [];
  const r0 = rowOf(i);
  const c0 = colOf(i);
  const other = opponent(player);
  const flips: number[] = [];
  for (const [dr, dc] of DIRS) {
    const line: number[] = [];
    let r = r0 + dr;
    let c = c0 + dc;
    while (r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[idx(r, c)] === other) {
      line.push(idx(r, c));
      r += dr;
      c += dc;
    }
    if (line.length > 0 && r >= 0 && r < SIZE && c >= 0 && c < SIZE && board[idx(r, c)] === player) {
      flips.push(...line);
    }
  }
  return flips;
}

/** Every legal move for player, mapped to the discs it flips. */
export function legalMoves(board: Board, player: Player): Map<number, number[]> {
  const moves = new Map<number, number[]>();
  for (let i = 0; i < board.length; i++) {
    const flips = flipsFor(board, i, player);
    if (flips.length) moves.set(i, flips);
  }
  return moves;
}

export function playOnBoard(board: Board, i: number, player: Player, flips: number[]): Board {
  const next = [...board];
  next[i] = player;
  for (const f of flips) next[f] = player;
  return next;
}

export function countDiscs(board: Board): Record<Player, number> {
  let cyan = 0;
  let pink = 0;
  for (const c of board) {
    if (c === "cyan") cyan++;
    else if (c === "pink") pink++;
  }
  return { cyan, pink };
}

// ---------- Game state ----------

export interface GameState {
  board: Board;
  current: Player;
  status: "playing" | "over";
  lastMove: number | null;
  lastFlips: number[];
  /** Set when the side that should have moved had no move and was skipped. */
  passed: Player | null;
  /** Earlier states, newest last, for undo. */
  history: GameState[];
}

export function createInitialState(): GameState {
  return { board: initialBoard(), current: FIRST, status: "playing", lastMove: null, lastFlips: [], passed: null, history: [] };
}

/**
 * Play current's move at i. The turn passes to the opponent if they can
 * move; if not, they pass and current goes again; if neither can, the
 * game is over. Illegal moves return the state unchanged.
 */
export function playMove(state: GameState, i: number): GameState {
  if (state.status !== "playing") return state;
  const flips = flipsFor(state.board, i, state.current);
  if (flips.length === 0) return state;

  const board = playOnBoard(state.board, i, state.current, flips);
  const other = opponent(state.current);
  // Snapshots drop their own history; undo restores it from this list.
  const base = { board, lastMove: i, lastFlips: flips, history: [...state.history, { ...state, history: [] }] };

  if (legalMoves(board, other).size > 0) return { ...base, current: other, status: "playing", passed: null };
  if (legalMoves(board, state.current).size > 0) return { ...base, current: state.current, status: "playing", passed: other };
  return { ...base, current: other, status: "over", passed: null };
}

/** Step back one move. */
export function undoMove(state: GameState): GameState {
  if (state.history.length === 0) return state;
  const prev = state.history[state.history.length - 1];
  return { ...prev, history: state.history.slice(0, -1) };
}

/**
 * Step back to the last time `player` was about to move (vs the computer,
 * undo returns to the person's previous turn, skipping the computer's
 * reply). Unchanged if player never had a turn to go back to.
 */
export function undoToTurn(state: GameState, player: Player): GameState {
  for (let n = state.history.length - 1; n >= 0; n--) {
    if (state.history[n].current === player) return { ...state.history[n], history: state.history.slice(0, n) };
  }
  return state;
}

export function winner(state: GameState): Player | "draw" | null {
  if (state.status !== "over") return null;
  const { cyan, pink } = countDiscs(state.board);
  return cyan === pink ? "draw" : cyan > pink ? "cyan" : "pink";
}

// ---------- Computer opponent ----------

export type Level = "easy" | "normal" | "hard";
export type Rng = () => number;

/*
 * Square values: corners are permanent and worth the most; the squares
 * touching a corner hand it to the opponent, so they're penalised; edges
 * are good. A standard shape for Reversi evaluation tables.
 */
export const WEIGHTS: number[] = [
  100, -25, 10, 5, 5, 10, -25, 100,
  -25, -45, -2, -2, -2, -2, -45, -25,
  10, -2, 3, 1, 1, 3, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 3, 1, 1, 3, -2, 10,
  -25, -45, -2, -2, -2, -2, -45, -25,
  100, -25, 10, 5, 5, 10, -25, 100,
];

/** Midgame search depth for Hard, and the empties at which it solves to the end. */
export const HARD_DEPTH = 5;
export const HARD_ENDGAME_EMPTIES = 10;

function positional(board: Board, player: Player): number {
  let score = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === player) score += WEIGHTS[i];
    else if (board[i] !== null) score -= WEIGHTS[i];
  }
  return score;
}

/** Hard's evaluation: square values plus mobility (having options). */
export function evaluate(board: Board, player: Player): number {
  const mine = legalMoves(board, player).size;
  const theirs = legalMoves(board, opponent(player)).size;
  const mobility = mine + theirs === 0 ? 0 : (100 * (mine - theirs)) / (mine + theirs);
  return positional(board, player) + mobility;
}

function discDiff(board: Board, player: Player): number {
  const c = countDiscs(board);
  return player === "cyan" ? c.cyan - c.pink : c.pink - c.cyan;
}

/** Negamax with alpha-beta, scored from `player`'s point of view. */
function search(board: Board, player: Player, depth: number, alpha: number, beta: number, exact: boolean): number {
  const moves = legalMoves(board, player);
  if (moves.size === 0) {
    const other = opponent(player);
    if (legalMoves(board, other).size === 0) return discDiff(board, player) * 1000; // game over
    return -search(board, other, depth, -beta, -alpha, exact); // pass
  }
  if (depth === 0) return exact ? discDiff(board, player) * 1000 : evaluate(board, player);

  // Try good squares first so pruning cuts more.
  const ordered = [...moves.entries()].sort((a, b) => WEIGHTS[b[0]] - WEIGHTS[a[0]]);
  let best = -Infinity;
  for (const [i, flips] of ordered) {
    const score = -search(playOnBoard(board, i, player, flips), opponent(player), depth - 1, -beta, -alpha, exact);
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

function pickBest(scored: [number, number][], rng: Rng): number {
  const top = Math.max(...scored.map(([, s]) => s));
  const ties = scored.filter(([, s]) => s === top);
  return ties[Math.floor(rng() * ties.length)][0];
}

/** The computer's move for `player`, or null if it has none. */
export function chooseMove(board: Board, player: Player, level: Level, rng: Rng): number | null {
  const moves = legalMoves(board, player);
  if (moves.size === 0) return null;
  const entries = [...moves.entries()];

  if (level === "easy") {
    // Greedy for discs, but a third of the time just plays anything.
    if (rng() < 0.35) return entries[Math.floor(rng() * entries.length)][0];
    return pickBest(
      entries.map(([i, f]) => [i, f.length]),
      rng,
    );
  }

  if (level === "normal") {
    // One move ahead on square values: takes corners, avoids gifting them.
    return pickBest(
      entries.map(([i, f]) => [i, positional(playOnBoard(board, i, player, f), player)]),
      rng,
    );
  }

  const empties = board.filter((c) => c === null).length;
  const exact = empties <= HARD_ENDGAME_EMPTIES;
  const depth = exact ? empties : HARD_DEPTH;
  return pickBest(
    entries.map(([i, f]) => [i, -search(playOnBoard(board, i, player, f), opponent(player), depth - 1, -Infinity, Infinity, exact)]),
    rng,
  );
}
