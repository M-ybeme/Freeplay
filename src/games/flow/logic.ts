// Pure Flow (Numberlink-style) rules and generation. No React/DOM.
//
// Two independent halves live here:
//  - generation (attemptRoutes -> Puzzle), which builds a *known-solved*
//    board of clean routes first and derives the dots from it, then uses
//    countSolutions to prefer boards with exactly one answer.
//  - player path editing (beginRoute/extendRoute and friends), which is
//    deliberately unaware of the hidden solution - it only ever sees the
//    puzzle's endpoints and the player's own drawn routes.

export type CellCoord = [number, number];

export type DifficultyId = "easy" | "medium" | "hard";

export interface Difficulty {
  id: DifficultyId;
  label: string;
  size: number;
  pairs: number;
}

export const DIFFICULTIES: Difficulty[] = [
  { id: "easy", label: "Easy", size: 5, pairs: 4 },
  { id: "medium", label: "Medium", size: 6, pairs: 5 },
  { id: "hard", label: "Hard", size: 7, pairs: 6 },
];

export interface Puzzle {
  difficultyId: DifficultyId;
  size: number;
  pairCount: number;
  /** endpoints[pairIndex] = the pair's two terminal cells, order arbitrary. */
  endpoints: [CellCoord, CellCoord][];
  /**
   * solution[pairIndex] = the full known-solved route for that pair, in
   * order from one endpoint to the other. Internal generator data - never
   * rendered or exposed to the player.
   */
  solution: CellCoord[][];
}

/** routes[pairIndex] = the player's currently drawn cells for that pair, anchor-first. Empty array = untouched. */
export type Routes = CellCoord[][];

// ---------- small shared helpers ----------

export function sameCell(a: CellCoord, b: CellCoord): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

export function isOrthogonallyAdjacent(a: CellCoord, b: CellCoord): boolean {
  const dr = Math.abs(a[0] - b[0]);
  const dc = Math.abs(a[1] - b[1]);
  return (dr === 1 && dc === 0) || (dr === 0 && dc === 1);
}

function inBounds(cell: CellCoord, size: number): boolean {
  return cell[0] >= 0 && cell[0] < size && cell[1] >= 0 && cell[1] < size;
}

export function createEmptyRoutes(pairCount: number): Routes {
  return Array.from({ length: pairCount }, () => []);
}

// ============================================================
// Generation
// ============================================================

/**
 * True when a route touches itself: two of its cells are side by side on
 * the board without being consecutive on the route (a U-turn hugging
 * itself, or two adjacent dots joined the long way round). Flow players
 * rule such routes out, so a puzzle whose only fills need one reads as
 * unwinnable even though it technically isn't. The old generator (one
 * snake through every cell, cut into pieces) produced exactly that in
 * ~98% of Easy puzzles; generated routes are now never allowed to.
 */
export function routeTouchesItself(path: CellCoord[]): boolean {
  for (let i = 0; i < path.length; i++) {
    for (let j = i + 2; j < path.length; j++) {
      if (isOrthogonallyAdjacent(path[i], path[j])) return true;
    }
  }
  return false;
}

/**
 * One attempt at a full-board set of routes: every cell starts as its own
 * one-cell route, and routes are joined end to end, at random, until
 * `pairs` remain. A join is only allowed when the joined route still
 * doesn't touch itself, so every route stays clean by construction.
 * Joins between short routes are favoured, so single cells don't get
 * stranded. Returns null when it gets stuck (no clean join left) before
 * reaching `pairs`, or leaves a one-cell route.
 */
function attemptRoutes(size: number, pairs: number, rng: () => number): CellCoord[][] | null {
  const total = size * size;
  const routes = new Map<number, number[]>();
  const owner = new Int32Array(total);
  for (let c = 0; c < total; c++) {
    routes.set(c, [c]);
    owner[c] = c;
  }
  const toCoord = (c: number): CellCoord => [Math.floor(c / size), c % size];
  const neighbors = (c: number): number[] => {
    const r = Math.floor(c / size);
    const col = c % size;
    const out: number[] = [];
    if (r > 0) out.push(c - size);
    if (r < size - 1) out.push(c + size);
    if (col > 0) out.push(c - 1);
    if (col < size - 1) out.push(c + 1);
    return out;
  };

  while (routes.size > pairs) {
    const candidates: { keep: number; drop: number; joined: number[]; weight: number }[] = [];
    for (const [id, route] of routes) {
      const ends = route.length === 1 ? [route[0]] : [route[0], route[route.length - 1]];
      for (const end of ends) {
        for (const m of neighbors(end)) {
          const other = owner[m];
          if (other <= id) continue; // each pair of routes considered once
          const otherRoute = routes.get(other)!;
          if (otherRoute[0] !== m && otherRoute[otherRoute.length - 1] !== m) continue;
          const left = route[route.length - 1] === end ? route : route.slice().reverse();
          const right = otherRoute[0] === m ? otherRoute : otherRoute.slice().reverse();
          const joined = left.concat(right);
          if (routeTouchesItself(joined.map(toCoord))) continue;
          candidates.push({ keep: id, drop: other, joined, weight: 1 / (route.length * otherRoute.length) });
        }
      }
    }
    if (candidates.length === 0) return null;

    let x = rng() * candidates.reduce((sum, c) => sum + c.weight, 0);
    let pick = candidates[candidates.length - 1];
    for (const c of candidates) {
      x -= c.weight;
      if (x <= 0) {
        pick = c;
        break;
      }
    }
    routes.delete(pick.drop);
    routes.set(pick.keep, pick.joined);
    for (const c of pick.joined) owner[c] = pick.keep;
  }

  const result = [...routes.values()];
  if (result.some((r) => r.length < 2)) return null;
  return result.map((r) => r.map(toCoord));
}

/**
 * Counts full solutions of a puzzle from its dots alone, the way a player
 * would have to: every pair joined, every cell filled, no crossings.
 * Stops at `cap`. Returns null if it gives up after `budget` search steps
 * (only plausible on Hard), so callers treat that as unknown.
 */
export function countSolutions(puzzle: Pick<Puzzle, "size" | "endpoints">, cap = 2, budget = 400_000): number | null {
  const n = puzzle.size;
  const grid = new Int8Array(n * n).fill(-1);
  const ends = puzzle.endpoints.map(([a, b]) => [a[0] * n + a[1], b[0] * n + b[1]]);
  ends.forEach(([a, b], i) => {
    grid[a] = i;
    grid[b] = i;
  });
  const neighbors = (c: number): number[] => {
    const r = Math.floor(c / n);
    const col = c % n;
    const out: number[] = [];
    if (r > 0) out.push(c - n);
    if (r < n - 1) out.push(c + n);
    if (col > 0) out.push(c - 1);
    if (col < n - 1) out.push(c + 1);
    return out;
  };
  let found = 0;
  let steps = 0;

  // Route pair k from its tip; on reaching its partner, start pair k + 1.
  function route(k: number, tip: number): void {
    if (found >= cap || steps > budget) return;
    steps++;
    if (k === ends.length) {
      if (grid.every((v) => v !== -1)) found++;
      return;
    }
    for (const m of neighbors(tip)) {
      if (m === ends[k][1]) {
        route(k + 1, k + 1 < ends.length ? ends[k + 1][0] : -1);
      } else if (grid[m] === -1) {
        grid[m] = k;
        route(k, m);
        grid[m] = -1;
      }
    }
  }
  route(0, ends[0][0]);
  return steps > budget ? null : found;
}

/**
 * Lightweight quality gate: no single route dominating the board, and at
 * most one pair whose dots sit side by side (joined directly - the clean
 * route rule already forbids adjacent dots joined the long way round).
 */
function isAcceptableLayout(routes: CellCoord[][], size: number): boolean {
  const longest = Math.max(...routes.map((r) => r.length));
  if (longest > size * size * 0.6) return false;
  return routes.filter((r) => r.length === 2).length <= 1;
}

const GENERATE_MAX_ATTEMPTS = 6000;

/**
 * Builds a complete Puzzle with a known clean solution (no route touching
 * itself) and, whenever one turns up within the attempt budget, exactly
 * one solution - so the puzzle can be reasoned out, like a real Flow
 * board. If the budget runs out it returns the first clean layout found
 * (still winnable with clean routes, just not unique), and only if there
 * was none at all, a fixed fallback board.
 */
export function generatePuzzle(difficulty: Difficulty, rng: () => number = Math.random, maxAttempts = GENERATE_MAX_ATTEMPTS): Puzzle {
  const { size, pairs } = difficulty;
  const toPuzzle = (routes: CellCoord[][]): Puzzle => ({
    difficultyId: difficulty.id,
    size,
    pairCount: pairs,
    endpoints: routes.map((r) => [r[0], r[r.length - 1]] as [CellCoord, CellCoord]),
    solution: routes,
  });

  let firstClean: Puzzle | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const routes = attemptRoutes(size, pairs, rng);
    if (!routes || !isAcceptableLayout(routes, size)) continue;
    const puzzle = toPuzzle(routes);
    if (!validatePuzzle(puzzle)) continue;
    firstClean ??= puzzle;
    if (countSolutions(puzzle) === 1) return puzzle;
  }
  return firstClean ?? toPuzzle(FALLBACK_ROUTES[difficulty.id]);
}

/**
 * Verifies a puzzle's own known solution is actually legal under the same
 * rules the player is bound by: full coverage, no overlap, every route a
 * single continuous orthogonal chain with exactly two distinct endpoints
 * that match its declared endpoint metadata - and clean (never touching
 * itself), which also means a saved puzzle from the old generator is
 * replaced with a fresh one on load.
 */
export function validatePuzzle(puzzle: Puzzle): boolean {
  const { size, pairCount, endpoints, solution } = puzzle;
  if (endpoints.length !== pairCount || solution.length !== pairCount) return false;

  const occupied = new Set<string>();
  for (let p = 0; p < pairCount; p++) {
    const path = solution[p];
    if (path.length < 2) return false;

    const seenInPath = new Set<string>();
    for (let i = 0; i < path.length; i++) {
      const cell = path[i];
      if (!inBounds(cell, size)) return false;
      const key = `${cell[0]},${cell[1]}`;
      if (seenInPath.has(key) || occupied.has(key)) return false;
      seenInPath.add(key);
      occupied.add(key);
      if (i > 0 && !isOrthogonallyAdjacent(path[i - 1], cell)) return false;
    }

    if (routeTouchesItself(path)) return false;

    const [a, b] = endpoints[p];
    if (sameCell(a, b)) return false;
    const first = path[0];
    const last = path[path.length - 1];
    const matches = (sameCell(a, first) && sameCell(b, last)) || (sameCell(a, last) && sameCell(b, first));
    if (!matches) return false;
  }

  if (occupied.size !== size * size) return false;

  const allEndpoints = new Set<string>();
  for (const [a, b] of endpoints) {
    for (const pt of [a, b]) {
      const key = `${pt[0]},${pt[1]}`;
      if (allEndpoints.has(key)) return false;
      allEndpoints.add(key);
    }
  }

  return true;
}

// ============================================================
// Player path editing
// ============================================================

/** Which pair (if any) owns `cell` as one of its two puzzle endpoints. */
export function resolveEndpointOwner(puzzle: Puzzle, cell: CellCoord): number | null {
  for (let p = 0; p < puzzle.pairCount; p++) {
    const [a, b] = puzzle.endpoints[p];
    if (sameCell(a, cell) || sameCell(b, cell)) return p;
  }
  return null;
}

/** Which pair's route currently occupies `cell`, if any. */
export function cellPairOwner(routes: Routes, cell: CellCoord): number | null {
  for (let p = 0; p < routes.length; p++) {
    if (routes[p].some((c) => sameCell(c, cell))) return p;
  }
  return null;
}

/**
 * Resolves which pair a drag/keyboard-edit starting at `cell` should
 * operate on - an endpoint (either one, whether or not it's already
 * connected) or a cell already on some pair's drawn route. Anything else
 * (an empty cell, another pair's endpoint) is not a valid drag start.
 */
export function resolveDragStart(puzzle: Puzzle, routes: Routes, cell: CellCoord): number | null {
  const endpointOwner = resolveEndpointOwner(puzzle, cell);
  if (endpointOwner !== null) return endpointOwner;
  return cellPairOwner(routes, cell);
}

/**
 * Starts or resumes editing `pairIndex` at `cell`. Two cases:
 *  - `cell` is already somewhere on this pair's own route (including its
 *    anchor) -> truncate to that point ("keep this part, redraw from
 *    here"), exactly matching the same-drag backtrack model.
 *  - `cell` is the pair's *other* endpoint, not yet part of the route ->
 *    start a fresh route anchored there, discarding whatever was drawn
 *    from the old anchor.
 */
export function beginRoute(_puzzle: Puzzle, routes: Routes, pairIndex: number, cell: CellCoord): Routes {
  const current = routes[pairIndex];
  const idx = current.findIndex((c) => sameCell(c, cell));
  const next = routes.slice();
  next[pairIndex] = idx !== -1 ? current.slice(0, idx + 1) : [cell];
  return next;
}

/**
 * Extends (or backtracks) `pairIndex`'s route by one cell. `cell` must be
 * orthogonally adjacent to the current tip unless it's already on the
 * route (a backtrack, which can jump back any distance in one call).
 *
 * Conflict rule: entering a cell owned by *another* pair's route claims it
 * for the active pair and truncates the other route from that cell
 * onward - the "fluid" model described in the spec, chosen after
 * implementing both and finding the reject-only alternative bureaucratic
 * for is exactly the kind of quick correction Flow players expect to be
 * able to make without a separate erase step. Another pair's *endpoint* is
 * never enterable regardless - endpoints are permanently reserved for
 * their own pair.
 *
 * Returns the same `routes` reference (not a copy) when the requested
 * extension is illegal, so callers can detect rejection with `===`.
 */
export function extendRoute(puzzle: Puzzle, routes: Routes, pairIndex: number, cell: CellCoord): Routes {
  const current = routes[pairIndex];
  if (current.length === 0) return routes;
  const tip = current[current.length - 1];
  if (sameCell(tip, cell)) return routes;

  const backtrackIdx = current.findIndex((c) => sameCell(c, cell));
  if (backtrackIdx !== -1) {
    const next = routes.slice();
    next[pairIndex] = current.slice(0, backtrackIdx + 1);
    return next;
  }

  if (!isOrthogonallyAdjacent(tip, cell)) return routes;

  // A route that has reached its partner endpoint is finished: it can be
  // backtracked (handled above) but never extended past the end.
  if (isPairConnected(puzzle, routes, pairIndex)) return routes;

  const endpointOwner = resolveEndpointOwner(puzzle, cell);
  if (endpointOwner !== null && endpointOwner !== pairIndex) return routes;

  for (let p = 0; p < routes.length; p++) {
    if (p === pairIndex) continue;
    const otherIdx = routes[p].findIndex((c) => sameCell(c, cell));
    if (otherIdx !== -1) {
      const next = routes.slice();
      next[p] = routes[p].slice(0, otherIdx);
      next[pairIndex] = [...current, cell];
      return next;
    }
  }

  const next = routes.slice();
  next[pairIndex] = [...current, cell];
  return next;
}

function stepToward(from: CellCoord, to: CellCoord): CellCoord {
  const dr = to[0] - from[0];
  const dc = to[1] - from[1];
  if (dr !== 0 && Math.abs(dr) >= Math.abs(dc)) return [from[0] + Math.sign(dr), from[1]];
  if (dc !== 0) return [from[0], from[1] + Math.sign(dc)];
  return from;
}

/**
 * Extends `pairIndex`'s route toward `targetCell` one orthogonal step at a
 * time, so a fast drag that only sampled a distant pointer position can't
 * silently jump over intermediate cells (and can't jump over an
 * intermediate *rejection* either - if a step partway there is illegal,
 * this stops at the last legal cell rather than teleporting past it).
 * Bounded so a pathological input can't loop forever.
 */
export function extendRouteThroughPath(puzzle: Puzzle, routes: Routes, pairIndex: number, targetCell: CellCoord): Routes {
  let current = routes;
  let safety = puzzle.size * puzzle.size * 2;
  while (safety-- > 0) {
    const path = current[pairIndex];
    if (path.length === 0) return current;
    const tip = path[path.length - 1];
    if (sameCell(tip, targetCell)) return current;

    if (path.some((c) => sameCell(c, targetCell))) {
      return extendRoute(puzzle, current, pairIndex, targetCell);
    }

    const next = stepToward(tip, targetCell);
    const result = extendRoute(puzzle, current, pairIndex, next);
    if (result === current) return current;
    current = result;
  }
  return current;
}

export function isPairConnected(puzzle: Puzzle, routes: Routes, pairIndex: number): boolean {
  const path = routes[pairIndex];
  if (path.length < 2) return false;
  const [a, b] = puzzle.endpoints[pairIndex];
  const first = path[0];
  const last = path[path.length - 1];
  return (sameCell(first, a) && sameCell(last, b)) || (sameCell(first, b) && sameCell(last, a));
}

export function connectedPairCount(puzzle: Puzzle, routes: Routes): number {
  let count = 0;
  for (let p = 0; p < puzzle.pairCount; p++) if (isPairConnected(puzzle, routes, p)) count++;
  return count;
}

export function fillCount(routes: Routes): number {
  return routes.reduce((sum, path) => sum + path.length, 0);
}

/** Solved only when every pair is connected *and* every board cell is covered - matching endpoints alone is not enough. */
export function isSolved(puzzle: Puzzle, routes: Routes): boolean {
  return connectedPairCount(puzzle, routes) === puzzle.pairCount && fillCount(routes) === puzzle.size * puzzle.size;
}

// ============================================================
// Persisted-state validation
// ============================================================

function isCellCoord(value: unknown): value is CellCoord {
  return Array.isArray(value) && value.length === 2 && Number.isInteger(value[0]) && Number.isInteger(value[1]);
}

function isDifficultyId(value: unknown): value is DifficultyId {
  return value === "easy" || value === "medium" || value === "hard";
}

function isPuzzleShape(value: unknown): value is Puzzle {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!isDifficultyId(v.difficultyId)) return false;
  if (typeof v.size !== "number" || !Number.isInteger(v.size) || v.size < 2) return false;
  if (typeof v.pairCount !== "number" || !Number.isInteger(v.pairCount) || v.pairCount < 1) return false;
  if (!Array.isArray(v.endpoints) || v.endpoints.length !== v.pairCount) return false;
  for (const pair of v.endpoints) {
    if (!Array.isArray(pair) || pair.length !== 2) return false;
    if (!isCellCoord(pair[0]) || !isCellCoord(pair[1])) return false;
  }
  if (!Array.isArray(v.solution) || v.solution.length !== v.pairCount) return false;
  for (const path of v.solution) {
    if (!Array.isArray(path) || !path.every(isCellCoord)) return false;
  }
  return true;
}

/** Full structural + rules validation of a persisted puzzle definition - not just a type-shape check. */
export function isValidPuzzle(value: unknown): value is Puzzle {
  if (!isPuzzleShape(value)) return false;
  const expected = DIFFICULTIES.find((d) => d.id === value.difficultyId);
  if (!expected || expected.size !== value.size || expected.pairs !== value.pairCount) return false;
  return validatePuzzle(value);
}

export function isValidRoutes(value: unknown, puzzle: Puzzle): value is Routes {
  if (!Array.isArray(value) || value.length !== puzzle.pairCount) return false;

  const occupied = new Set<string>();
  for (let p = 0; p < value.length; p++) {
    const path: unknown = value[p];
    if (!Array.isArray(path) || !path.every(isCellCoord)) return false;

    const seen = new Set<string>();
    for (let i = 0; i < path.length; i++) {
      const cell = path[i] as CellCoord;
      if (!inBounds(cell, puzzle.size)) return false;
      const key = `${cell[0]},${cell[1]}`;
      if (seen.has(key) || occupied.has(key)) return false;
      seen.add(key);
      occupied.add(key);
      if (i > 0 && !isOrthogonallyAdjacent(path[i - 1] as CellCoord, cell)) return false;
    }

    if (path.length > 0) {
      const [a, b] = puzzle.endpoints[p];
      const anchor = path[0] as CellCoord;
      if (!sameCell(anchor, a) && !sameCell(anchor, b)) return false;
    }
  }
  return true;
}

export interface PersistedRun {
  puzzle: Puzzle;
  routes: Routes;
}

export function isValidPersistedRun(value: unknown): value is PersistedRun {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (!isValidPuzzle(v.puzzle)) return false;
  return isValidRoutes(v.routes, v.puzzle);
}

// ============================================================
// Fallback boards
// ============================================================

/**
 * Last-resort boards for generatePuzzle, used only if every attempt fails
 * (never seen in testing). Each is clean and has exactly one solution;
 * logic.test.ts checks both.
 */
export const FALLBACK_ROUTES: Record<DifficultyId, CellCoord[][]> = {
  easy: [
    [[4, 0], [3, 0], [2, 0], [1, 0], [0, 0], [0, 1], [0, 2]],
    [[0, 4], [0, 3], [1, 3], [2, 3], [2, 2], [3, 2], [4, 2], [4, 3], [4, 4]],
    [[1, 2], [1, 1], [2, 1], [3, 1], [4, 1]],
    [[1, 4], [2, 4], [3, 4], [3, 3]],
  ],
  medium: [
    [[0, 0], [0, 1], [0, 2], [0, 3], [1, 3], [1, 4]],
    [[0, 4], [0, 5], [1, 5], [2, 5], [2, 4], [2, 3], [2, 2], [2, 1], [3, 1], [4, 1], [4, 2], [5, 2]],
    [[1, 2], [1, 1], [1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [5, 1]],
    [[3, 2], [3, 3], [3, 4], [4, 4]],
    [[3, 5], [4, 5], [5, 5], [5, 4], [5, 3], [4, 3]],
  ],
  hard: [
    [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2], [2, 3], [3, 3], [3, 4]],
    [[0, 1], [1, 1], [1, 2], [1, 3], [1, 4], [1, 5]],
    [[0, 2], [0, 3], [0, 4], [0, 5], [0, 6], [1, 6], [2, 6], [2, 5], [2, 4]],
    [[3, 0], [3, 1], [4, 1], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [5, 6], [4, 6], [3, 6]],
    [[3, 2], [4, 2], [4, 3], [4, 4], [4, 5], [3, 5]],
    [[4, 0], [5, 0], [6, 0], [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [6, 6]],
  ],
};
