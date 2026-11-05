export const BOARD_SIZE = 4;
export const SPAWN_FOUR_CHANCE = 0.1;
export const MILESTONE_VALUE = 2048;

export type Cell = number; // 0 = empty, otherwise a power of two
export type Board = Cell[][];
export type Direction = "left" | "right" | "up" | "down";

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () => Array<Cell>(BOARD_SIZE).fill(0));
}

export function boardsEqual(a: Board, b: Board): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

export function getEmptyCells(board: Board): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

/**
 * Places one new tile (90% -> 2, 10% -> 4) in a random empty cell. A no-op
 * (returns the same board reference) when the board is already full, so
 * callers never need a separate "is there room" check first.
 */
export function spawnTile(board: Board, rng: () => number = Math.random): Board {
  const empty = getEmptyCells(board);
  if (empty.length === 0) return board;
  const [r, c] = empty[Math.floor(rng() * empty.length)];
  const value: Cell = rng() < 1 - SPAWN_FOUR_CHANCE ? 2 : 4;
  const next = board.map((row) => row.slice());
  next[r][c] = value;
  return next;
}

export function createInitialBoard(rng: () => number = Math.random): Board {
  let board = createEmptyBoard();
  board = spawnTile(board, rng);
  board = spawnTile(board, rng);
  return board;
}

/** Removes zeros and pushes remaining values to the front, padding the rest with zeros. */
export function compressLine(line: readonly Cell[]): Cell[] {
  const nonZero = line.filter((v) => v !== 0);
  while (nonZero.length < line.length) nonZero.push(0);
  return nonZero;
}

export interface MergeLineResult {
  line: Cell[];
  scoreGained: number;
  /** Indices (into the returned, padded `line`) where a merge produced the value there. */
  mergedIndices: number[];
}

/**
 * Compresses a line, merges each adjacent equal pair once, then compresses
 * again. Each source tile participates in at most one merge: the loop visits
 * every element of the *compressed* input exactly once and only ever
 * compares it against its immediate neighbor, so a value produced by a merge
 * is never re-examined as a merge candidate within the same call - e.g.
 * [2,2,4,0] merges the leading pair into a 4 and then simply carries the
 * original trailing 4 forward as its own tile ([4,4,0,0]), never combining
 * the newly-created 4 with it into an 8.
 */
export function mergeLine(line: readonly Cell[]): MergeLineResult {
  const compressed = compressLine(line);
  const merged: Cell[] = [];
  const mergedIndices: number[] = [];
  let scoreGained = 0;
  let i = 0;
  while (i < compressed.length) {
    const current = compressed[i];
    if (current !== 0 && current === compressed[i + 1]) {
      const value = current * 2;
      mergedIndices.push(merged.length);
      merged.push(value);
      scoreGained += value;
      i += 2;
    } else {
      merged.push(current);
      i += 1;
    }
  }
  // Pad back to the *original* line length, not merged's own (shorter, once
  // any merge happened) length - compressLine(merged) would incorrectly pad
  // to merged.length instead, since that function pads relative to its own
  // input, which is exactly wrong here.
  while (merged.length < line.length) merged.push(0);
  return { line: merged, scoreGained, mergedIndices };
}

function transpose(board: readonly Cell[][]): Board {
  const result = createEmptyBoard();
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) result[c][r] = board[r][c];
  }
  return result;
}

/** Board rows/columns reoriented so index 0 is always "the edge this move compresses toward". */
function getBoardLines(board: Board, direction: Direction): Cell[][] {
  switch (direction) {
    case "left":
      return board.map((row) => row.slice());
    case "right":
      return board.map((row) => row.slice().reverse());
    case "up":
      return transpose(board);
    case "down":
      return transpose(board).map((row) => row.slice().reverse());
  }
}

/** Inverse of getBoardLines - rebuilds a real board from the (already merged) reoriented lines. */
function setBoardLines(direction: Direction, lines: Cell[][]): Board {
  switch (direction) {
    case "left":
      return lines.map((line) => line.slice());
    case "right":
      return lines.map((line) => line.slice().reverse());
    case "up":
      return transpose(lines);
    case "down":
      return transpose(lines.map((line) => line.slice().reverse()));
  }
}

/** Maps a (line index, position-within-line) pair back to real board coordinates for a given direction. */
function lineIndexToBoardPos(direction: Direction, lineIndex: number, pos: number): [number, number] {
  switch (direction) {
    case "left":
      return [lineIndex, pos];
    case "right":
      return [lineIndex, BOARD_SIZE - 1 - pos];
    case "up":
      return [pos, lineIndex];
    case "down":
      return [BOARD_SIZE - 1 - pos, lineIndex];
  }
}

export interface MoveResult {
  board: Board;
  changed: boolean;
  scoreGained: number;
  /** Board positions of tiles created by a merge this move - transient, for a merge-pulse cue only. */
  mergedCells: [number, number][];
}

/**
 * The pure directional transform: compress, merge, compress. Does not spawn
 * a tile - that is a separate, explicitly random step the caller decides
 * whether to take (only ever when `changed` is true).
 */
export function moveBoard(board: Board, direction: Direction): MoveResult {
  const lines = getBoardLines(board, direction);
  let scoreGained = 0;
  const mergedCells: [number, number][] = [];
  const mergedLines = lines.map((line, lineIndex) => {
    const result = mergeLine(line);
    scoreGained += result.scoreGained;
    for (const pos of result.mergedIndices) mergedCells.push(lineIndexToBoardPos(direction, lineIndex, pos));
    return result.line;
  });
  const nextBoard = setBoardLines(direction, mergedLines);
  return { board: nextBoard, changed: !boardsEqual(board, nextBoard), scoreGained, mergedCells };
}

/** True if any legal move remains: an empty cell, or two equal orthogonal neighbors anywhere. */
export function hasAvailableMove(board: Board): boolean {
  if (getEmptyCells(board).length > 0) return true;
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      const value = board[r][c];
      if (c + 1 < BOARD_SIZE && board[r][c + 1] === value) return true;
      if (r + 1 < BOARD_SIZE && board[r + 1][c] === value) return true;
    }
  }
  return false;
}

/** True once any tile has reached the milestone value (2048 by default) - a floor, not an exact match, since a higher value can never regress below it once created. */
export function hasReachedMilestone(board: Board, threshold: number = MILESTONE_VALUE): boolean {
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] >= threshold) return true;
    }
  }
  return false;
}

// ---------- Persisted-state validation ----------
//
// useGameStorage/readJSON only protects against a missing key or a JSON
// parse failure - if localStorage holds syntactically-valid JSON of the
// wrong *shape* (hand-edited, corrupted by a future format change, whatever),
// it comes back typed as whatever the caller asked for with zero runtime
// checking. Malformed board data fed straight into rendering/game logic
// could crash the game or desync score from the board it supposedly belongs
// to, so this validates the actual persisted shape before anything else in
// this game trusts it. Deliberately local to 2048, not a shared/generic
// persistence-validation layer.

export interface PersistedRun {
  board: Board;
  score: number;
  milestoneShown: boolean;
}

function isValidCellValue(value: unknown): value is Cell {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (value === 0) return true;
  // A positive power of two - no upper bound, since a long-running board can
  // legitimately exceed 2048 many times over.
  return value > 0 && Math.log2(value) % 1 === 0;
}

export function isValidBoard(value: unknown): value is Board {
  if (!Array.isArray(value) || value.length !== BOARD_SIZE) return false;
  return value.every((row) => Array.isArray(row) && row.length === BOARD_SIZE && row.every(isValidCellValue));
}

export function isValidBestScore(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isValidPersistedRun(value: unknown): value is PersistedRun {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    isValidBoard(candidate.board) &&
    typeof candidate.score === "number" &&
    Number.isFinite(candidate.score) &&
    candidate.score >= 0 &&
    typeof candidate.milestoneShown === "boolean"
  );
}

export interface TileSlide {
  from: [number, number];
  to: [number, number];
  /** True when this tile ends up merged into another at `to`. */
  merging: boolean;
}

/**
 * Where every tile on `board` travels when moved in `direction` - purely
 * for animating the slide. Follows exactly the same compress-then-merge-
 * once rule as mergeLine, walking each reoriented line in order: each
 * non-empty tile either merges with the next one (both slide to the same
 * output slot) or takes the next output slot on its own.
 */
export function traceMove(board: Board, direction: Direction): TileSlide[] {
  const slides: TileSlide[] = [];
  const lines = getBoardLines(board, direction);
  lines.forEach((line, lineIndex) => {
    const tiles = line.map((value, pos) => ({ value, pos })).filter((t) => t.value !== 0);
    let out = 0;
    let i = 0;
    while (i < tiles.length) {
      const to = lineIndexToBoardPos(direction, lineIndex, out);
      if (i + 1 < tiles.length && tiles[i].value === tiles[i + 1].value) {
        slides.push({ from: lineIndexToBoardPos(direction, lineIndex, tiles[i].pos), to, merging: true });
        slides.push({ from: lineIndexToBoardPos(direction, lineIndex, tiles[i + 1].pos), to, merging: true });
        i += 2;
      } else {
        slides.push({ from: lineIndexToBoardPos(direction, lineIndex, tiles[i].pos), to, merging: false });
        i += 1;
      }
      out += 1;
    }
  });
  return slides;
}
