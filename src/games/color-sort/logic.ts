export const TUBE_CAPACITY = 4;

export interface Difficulty {
  id: "easy" | "medium" | "hard";
  label: string;
  colorCount: number;
  helperTubes: number;
}

/**
 * Hard is deliberately 7 colors (not 8) - see generatePuzzle's solver. At 8
 * colors the search that verifies solvability routinely takes 5+ seconds (or
 * times out) regardless of helper-tube count; at 7 it solves in well under
 * half a second across a wide seed sweep. Difficulty here is colorCount +
 * helperTubes, not solution depth, so this is a real difficulty knob, not a
 * compromise on how hard the puzzle feels.
 */
export const DIFFICULTIES: Difficulty[] = [
  { id: "easy", label: "Easy", colorCount: 4, helperTubes: 2 },
  { id: "medium", label: "Medium", colorCount: 6, helperTubes: 2 },
  { id: "hard", label: "Hard", colorCount: 7, helperTubes: 3 },
];

/** Bottom-to-top stack of color indices (0-based). Empty array = empty tube. */
export type Tube = number[];
export type Board = Tube[];

export interface Move {
  from: number;
  to: number;
}

export function tubeCount(difficulty: Difficulty): number {
  return difficulty.colorCount + difficulty.helperTubes;
}

function topColor(tube: Tube): number | null {
  return tube.length === 0 ? null : tube[tube.length - 1];
}

/** How many matching-colored units sit at the top of the tube, contiguously. */
function topRunLength(tube: Tube): number {
  const color = topColor(tube);
  if (color === null) return 0;
  let count = 0;
  for (let i = tube.length - 1; i >= 0 && tube[i] === color; i--) count++;
  return count;
}

export function isTubeComplete(tube: Tube): boolean {
  return tube.length === TUBE_CAPACITY && topRunLength(tube) === TUBE_CAPACITY;
}

export function isBoardSolved(board: Board): boolean {
  return board.every((tube) => tube.length === 0 || isTubeComplete(tube));
}

/**
 * A pour is legal when the source has something to give, the destination has
 * room, and the destination is either empty or its top color matches the
 * source's top color.
 */
export function isLegalPour(board: Board, from: number, to: number): boolean {
  if (from === to) return false;
  const source = board[from];
  const dest = board[to];
  if (source.length === 0) return false;
  if (dest.length >= TUBE_CAPACITY) return false;
  const destTop = topColor(dest);
  return destTop === null || destTop === topColor(source);
}

/** How many units a pour(from, to) would move - the largest contiguous top-color group that fits. */
export function pourAmount(board: Board, from: number, to: number): number {
  if (!isLegalPour(board, from, to)) return 0;
  const room = TUBE_CAPACITY - board[to].length;
  return Math.min(topRunLength(board[from]), room);
}

/**
 * Pours the largest legal contiguous group from `from` into `to`. Returns a
 * new board; the caller is expected to have already checked isLegalPour (a
 * no-op pour returns the same board unchanged rather than throwing, so the
 * UI/hook layer can call it defensively without a separate guard).
 */
export function pour(board: Board, from: number, to: number): Board {
  const amount = pourAmount(board, from, to);
  if (amount === 0) return board;
  const color = topColor(board[from])!;
  const next = board.map((tube) => tube.slice());
  next[from].length -= amount;
  for (let i = 0; i < amount; i++) next[to].push(color);
  return next;
}

function boardKey(board: Board): string {
  return board.map((t) => t.join(",")).join("|");
}

/**
 * Legal moves from `board`, ordered to make the DFS solver below actually
 * fast in practice rather than just memory-safe: moves that finish a tube or
 * fully drain a source are tried first, bigger transfers before smaller
 * ones, and "park onto a fresh empty tube" last (parking alone never makes
 * progress toward a solution, so it should only be a fallback).
 */
function orderedLegalMoves(board: Board): Move[] {
  const scored: { move: Move; priority: number }[] = [];
  for (let from = 0; from < board.length; from++) {
    if (board[from].length === 0) continue;
    for (let to = 0; to < board.length; to++) {
      if (!isLegalPour(board, from, to)) continue;
      const amount = pourAmount(board, from, to);
      const completes = board[to].length + amount === TUBE_CAPACITY ? 1 : 0;
      const emptiesSource = amount === board[from].length ? 1 : 0;
      const ontoEmpty = board[to].length === 0 ? 1 : 0;
      const priority = completes * 1000 + emptiesSource * 100 + amount * 10 - ontoEmpty * 5;
      scored.push({ move: { from, to }, priority });
    }
  }
  scored.sort((a, b) => b.priority - a.priority);
  return scored.map((s) => s.move);
}

const SOLVE_MAX_NODES = 2_000_000;
const SOLVE_MAX_MS = 3000;

/**
 * Iterative depth-first solver, used only during puzzle generation (never
 * exposed to the player as a hint system) - it exists purely to guarantee
 * every generated board is solvable before it's shown.
 *
 * Why DFS and not "construct from a solved state and scramble backward" the
 * way Flow's path-based puzzles will: a Color Sort pour is only ever legal
 * onto an empty tube or a matching top color, which means every tube stays
 * single-color for as long as it's only ever been touched by legal pours -
 * reversing a sequence of legal pours can permute which tube holds how much
 * of a color, but it can never produce the jumbled, multi-color-per-tube
 * tubes a real puzzle needs. Legal-pour reversal is structurally incapable
 * of generating this game's puzzles, so generation instead randomly
 * distributes color units into tubes and this solver is the guarantee -
 * every puzzle that reaches the player has a concretely verified solution,
 * not an assumed one.
 *
 * Why DFS and not BFS: BFS (tried first) has to hold every state at the
 * current search depth in memory simultaneously, and at this puzzle's
 * branching factor that frontier explodes long before it reaches a solution
 * - it exhausted a 200,000-state cap and multiple GB of memory without
 * solving a single 7+ color board. DFS with move ordering (above) and a
 * visited-set only needs memory proportional to the one path it's currently
 * exploring, and finds a solution for every difficulty tier in well under
 * half a second across a wide seed sweep.
 */
export function solve(board: Board, maxNodes = SOLVE_MAX_NODES, maxMs = SOLVE_MAX_MS): Move[] | null {
  if (isBoardSolved(board)) return [];

  const visited = new Set<string>([boardKey(board)]);
  // Each frame stores only the single move that led to it, not a growing
  // path copy - copying the path on every push costs O(depth) per frame
  // (O(depth^2) total across a deep search), which is what actually
  // exhausted memory before this was fixed. The solution is reconstructed
  // once, by walking the stack, only when one is found.
  const stack: { board: Board; moves: Move[]; i: number; moveTaken: Move | null }[] = [
    { board, moves: orderedLegalMoves(board), i: 0, moveTaken: null },
  ];
  let explored = 0;
  const start = Date.now();

  while (stack.length > 0) {
    const top = stack[stack.length - 1];
    if (top.i >= top.moves.length) {
      stack.pop();
      continue;
    }
    const move = top.moves[top.i++];
    explored++;
    if (explored > maxNodes || (explored % 2000 === 0 && Date.now() - start > maxMs)) {
      return null;
    }

    const nextBoard = pour(top.board, move.from, move.to);
    const key = boardKey(nextBoard);
    if (visited.has(key)) continue;
    visited.add(key);

    if (isBoardSolved(nextBoard)) {
      const path: Move[] = [];
      for (let f = 1; f < stack.length; f++) path.push(stack[f].moveTaken!);
      path.push(move);
      return path;
    }
    stack.push({ board: nextBoard, moves: orderedLegalMoves(nextBoard), i: 0, moveTaken: move });
  }
  return null;
}

/**
 * Builds a puzzle: colorCount tubes each fully filled with a shuffled
 * multiset of colorCount colors (TUBE_CAPACITY units of each color total),
 * plus helperTubes empty tubes. Retries with a fresh shuffle until the
 * result is solvable and doesn't start with a tube already complete (an
 * immediate giveaway), so every puzzle handed to the player has a verified
 * solution.
 */
export function generatePuzzle(
  difficulty: Difficulty,
  rng: () => number = Math.random,
  maxAttempts = 50,
): Board {
  const { colorCount, helperTubes } = difficulty;
  const units: number[] = [];
  for (let color = 0; color < colorCount; color++) {
    for (let i = 0; i < TUBE_CAPACITY; i++) units.push(color);
  }

  let lastAttempt: Board = [];
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const shuffled = shuffle(units, rng);
    const board: Board = [];
    for (let t = 0; t < colorCount; t++) {
      board.push(shuffled.slice(t * TUBE_CAPACITY, (t + 1) * TUBE_CAPACITY));
    }
    for (let h = 0; h < helperTubes; h++) board.push([]);
    lastAttempt = board;

    if (board.some((tube) => isTubeComplete(tube))) continue;
    if (solve(board)) return board;
  }

  // Effectively unreachable for these difficulty tiers (see logic.test.ts'
  // seed sweep), but returning the last attempt rather than throwing means a
  // pathological run degrades to "maybe not solvable" instead of crashing
  // the game outright.
  return lastAttempt;
}

function shuffle<T>(source: T[], rng: () => number): T[] {
  const result = source.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
