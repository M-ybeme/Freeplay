export interface Cell {
  hasMine: boolean;
  adjacent: number;
  revealed: boolean;
  flagged: boolean;
}

export type GameStatus = "ready" | "playing" | "won" | "lost";

export interface Difficulty {
  id: "beginner" | "intermediate" | "expert";
  label: string;
  rows: number;
  cols: number;
  mines: number;
}

/**
 * Expert deliberately reshapes the classic 30x16/99-mine board into 24x20.
 * Same 480 cells, same 99 mines, same 20.6% density — identical difficulty
 * by any measure that matters (cell count and mine density), just a less
 * extreme aspect ratio so the widest dimension a phone has to accommodate
 * drops from 30 cells to 24.
 */
export const DIFFICULTIES: Difficulty[] = [
  { id: "beginner", label: "Beginner", rows: 9, cols: 9, mines: 10 },
  { id: "intermediate", label: "Intermediate", rows: 16, cols: 16, mines: 40 },
  { id: "expert", label: "Expert", rows: 20, cols: 24, mines: 99 },
];

export interface BoardState {
  difficulty: Difficulty;
  cells: Cell[];
  status: GameStatus;
  minesPlaced: boolean;
  triggeredIndex: number | null;
  revealedSafeCount: number;
}

function toIndex(cols: number, row: number, col: number): number {
  return row * cols + col;
}

function toRowCol(cols: number, i: number): [number, number] {
  return [Math.floor(i / cols), i % cols];
}

function neighborIndices(rows: number, cols: number, i: number): number[] {
  const [row, col] = toRowCol(cols, i);
  const result: number[] = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = row + dr;
      const c = col + dc;
      if (r >= 0 && r < rows && c >= 0 && c < cols) {
        result.push(toIndex(cols, r, c));
      }
    }
  }
  return result;
}

function shuffleIndices(source: number[], rng: () => number): number[] {
  const result = [...source];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function createEmptyBoard(difficulty: Difficulty): BoardState {
  const total = difficulty.rows * difficulty.cols;
  const cells: Cell[] = Array.from({ length: total }, () => ({
    hasMine: false,
    adjacent: 0,
    revealed: false,
    flagged: false,
  }));
  return {
    difficulty,
    cells,
    status: "ready",
    minesPlaced: false,
    triggeredIndex: null,
    revealedSafeCount: 0,
  };
}

/**
 * Places mines avoiding `safeIndex` and, where the board has room, its
 * neighbors too — giving the first click an actual opening rather than a
 * single revealed number. Degrades gracefully (safe cell only, then no
 * exclusion at all) if the board is too small/dense for the full
 * neighborhood to fit outside the mine count.
 */
export function placeMines(
  rows: number,
  cols: number,
  mineCount: number,
  safeIndex: number,
  rng: () => number = Math.random,
): Cell[] {
  const total = rows * cols;
  const neighborhood = new Set([safeIndex, ...neighborIndices(rows, cols, safeIndex)]);

  let excluded = neighborhood;
  if (total - excluded.size < mineCount) {
    excluded = new Set([safeIndex]);
  }
  if (total - excluded.size < mineCount) {
    excluded = new Set();
  }

  const candidates: number[] = [];
  for (let i = 0; i < total; i++) {
    if (!excluded.has(i)) candidates.push(i);
  }

  const mineSet = new Set(shuffleIndices(candidates, rng).slice(0, mineCount));

  const cells: Cell[] = Array.from({ length: total }, (_, i) => ({
    hasMine: mineSet.has(i),
    adjacent: 0,
    revealed: false,
    flagged: false,
  }));

  for (let i = 0; i < total; i++) {
    if (cells[i].hasMine) continue;
    let count = 0;
    for (const n of neighborIndices(rows, cols, i)) {
      if (cells[n].hasMine) count++;
    }
    cells[i].adjacent = count;
  }

  return cells;
}

function countRevealedSafe(cells: Cell[]): number {
  let count = 0;
  for (const cell of cells) {
    if (cell.revealed && !cell.hasMine) count++;
  }
  return count;
}

/**
 * Reveals one cell. On the very first reveal of a fresh board, mines are
 * placed at this point (not before), guaranteeing first-click safety.
 * Zero-adjacency cells flood-fill outward using an explicit queue (index
 * cursor, not .shift()) rather than recursion, so there is no call-stack
 * depth risk on large open regions.
 */
export function revealCell(board: BoardState, targetIndex: number): BoardState {
  if (board.status !== "ready" && board.status !== "playing") return board;
  const target = board.cells[targetIndex];
  if (target.revealed || target.flagged) return board;

  const { rows, cols, mines } = board.difficulty;
  let cells = board.cells;
  if (!board.minesPlaced) {
    // Preserve any flags placed before the first reveal — placeMines builds
    // a fresh cells array (it has to, to compute mine/adjacency layout) but
    // has no reason to know about flag state, so merge it back in here.
    const withMines = placeMines(rows, cols, mines, targetIndex, Math.random);
    cells = withMines.map((c, i) => ({ ...c, flagged: board.cells[i].flagged }));
  }

  if (cells[targetIndex].hasMine) {
    const revealed = cells.map((c) => (c.hasMine ? { ...c, revealed: true } : c));
    return {
      ...board,
      cells: revealed,
      status: "lost",
      minesPlaced: true,
      triggeredIndex: targetIndex,
      revealedSafeCount: countRevealedSafe(revealed),
    };
  }

  const next = cells.slice();
  const queue: number[] = [targetIndex];
  const queued = new Set(queue);
  let head = 0;
  while (head < queue.length) {
    const i = queue[head++];
    const cell = next[i];
    if (cell.revealed || cell.flagged || cell.hasMine) continue;
    next[i] = { ...cell, revealed: true };
    if (next[i].adjacent === 0) {
      for (const n of neighborIndices(rows, cols, i)) {
        if (!queued.has(n) && !next[n].revealed && !next[n].flagged && !next[n].hasMine) {
          queue.push(n);
          queued.add(n);
        }
      }
    }
  }

  const revealedSafeCount = countRevealedSafe(next);
  const won = revealedSafeCount === rows * cols - mines;
  // On a win, flag any remaining mines for clarity - purely cosmetic, does
  // not affect the win condition (which only counts revealed safe cells).
  const finalCells = won ? next.map((c) => (c.hasMine ? { ...c, flagged: true } : c)) : next;

  return {
    ...board,
    cells: finalCells,
    minesPlaced: true,
    status: won ? "won" : "playing",
    triggeredIndex: null,
    revealedSafeCount,
  };
}

export function toggleFlag(board: BoardState, targetIndex: number): BoardState {
  if (board.status !== "ready" && board.status !== "playing") return board;
  const cell = board.cells[targetIndex];
  if (cell.revealed) return board;
  const next = board.cells.slice();
  next[targetIndex] = { ...cell, flagged: !cell.flagged };
  return { ...board, cells: next };
}

export function countFlags(cells: Cell[]): number {
  let count = 0;
  for (const cell of cells) if (cell.flagged) count++;
  return count;
}

export function minesRemaining(board: BoardState): number {
  return board.difficulty.mines - countFlags(board.cells);
}

/**
 * Accessible label for one cell. Note there's no separate "game ended" flag
 * needed: `hasMine && revealed` can only ever be true after a loss, since
 * revealCell only ever sets a mine's `revealed` to true in the loss branch
 * (a win flags remaining mines, it never reveals them) — so mine identity
 * structurally cannot leak into a label before the game actually ends.
 */
export function cellLabel(cell: Cell, row: number, col: number, isTriggered: boolean): string {
  const position = `row ${row + 1} column ${col + 1}`;
  if (cell.flagged) return `Flagged cell, ${position}`;
  if (!cell.revealed) return `Unrevealed cell, ${position}`;
  if (cell.hasMine) return isTriggered ? `Detonated mine, ${position}` : `Mine, ${position}`;
  if (cell.adjacent === 0) return `Revealed empty cell, ${position}`;
  return `Revealed cell, ${cell.adjacent} adjacent mines, ${position}`;
}
