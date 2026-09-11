// Pure Flow (Numberlink-style) rules and generation. No React/DOM.
//
// Two independent halves live here:
//  - generation (buildHamiltonianPath -> splitIntoSegments -> Puzzle), which
//    produces a *known-solved* board and derives the puzzle from it, per the
//    "construct a valid completed routing first" strategy - the generator
//    never scatters endpoints and hopes a solver can close the gap.
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

function boustrophedonPath(size: number): CellCoord[] {
  const path: CellCoord[] = [];
  for (let r = 0; r < size; r++) {
    if (r % 2 === 0) {
      for (let c = 0; c < size; c++) path.push([r, c]);
    } else {
      for (let c = size - 1; c >= 0; c--) path.push([r, c]);
    }
  }
  return path;
}

function shuffleIndices(arr: number[], rng: () => number): number[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * One randomized-backtracking attempt at a full-board Hamiltonian path,
 * using Warnsdorff's rule (always try the neighbor with the fewest onward
 * options first) to keep backtracking rare in practice at these board
 * sizes. Ties are broken randomly (via the pre-shuffle) so repeated
 * attempts - and repeated seeds - don't collapse onto the same shape.
 *
 * Bounded by `stepBudget` total recursive calls so a pathological run
 * degrades to "try again" rather than hanging.
 */
function attemptHamiltonianPath(size: number, rng: () => number, stepBudget: number): CellCoord[] | null {
  const total = size * size;
  const visited = new Uint8Array(total);
  const order: number[] = [];
  const start = Math.floor(rng() * total);
  order.push(start);
  visited[start] = 1;
  let steps = 0;

  function neighborsOf(idx: number): number[] {
    const r = Math.floor(idx / size);
    const c = idx % size;
    const result: number[] = [];
    if (r > 0) result.push(idx - size);
    if (r < size - 1) result.push(idx + size);
    if (c > 0) result.push(idx - 1);
    if (c < size - 1) result.push(idx + 1);
    return result;
  }

  function unvisitedDegree(idx: number): number {
    let count = 0;
    for (const n of neighborsOf(idx)) if (!visited[n]) count++;
    return count;
  }

  function backtrack(): boolean {
    if (order.length === total) return true;
    steps++;
    if (steps > stepBudget) return false;
    const current = order[order.length - 1];
    const candidates = shuffleIndices(
      neighborsOf(current).filter((n) => !visited[n]),
      rng,
    ).sort((a, b) => unvisitedDegree(a) - unvisitedDegree(b));

    for (const next of candidates) {
      visited[next] = 1;
      order.push(next);
      if (backtrack()) return true;
      order.pop();
      visited[next] = 0;
    }
    return false;
  }

  if (!backtrack()) return null;
  return order.map((idx) => [Math.floor(idx / size), idx % size] as CellCoord);
}

/**
 * Builds a randomized full-board Hamiltonian path, retrying a bounded
 * number of times before falling back to a guaranteed (but visually
 * boring) boustrophedon sweep - generation must always terminate with a
 * usable path, never hang or throw.
 */
function buildHamiltonianPath(size: number, rng: () => number, attempts = 6): CellCoord[] {
  const stepBudget = size * size * 25;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const result = attemptHamiltonianPath(size, rng, stepBudget);
    if (result) return result;
  }
  return boustrophedonPath(size);
}

/**
 * Splits `total` into `parts` positive lengths, each >= min, summing back
 * to `total`, via a random stars-and-bars composition - a uniform-ish way
 * to distribute how long each pair's route gets without biasing toward
 * equal lengths every time.
 */
function randomComposition(total: number, parts: number, min: number, rng: () => number): number[] {
  const extra = total - parts * min;
  const cuts: number[] = [];
  for (let i = 0; i < parts - 1; i++) cuts.push(Math.floor(rng() * (extra + 1)));
  cuts.sort((a, b) => a - b);
  const lengths: number[] = [];
  let prev = 0;
  for (const cut of cuts) {
    lengths.push(min + (cut - prev));
    prev = cut;
  }
  lengths.push(min + (extra - prev));
  return lengths;
}

function splitIntoSegments(hamPath: CellCoord[], pairCount: number, rng: () => number): CellCoord[][] {
  const lengths = randomComposition(hamPath.length, pairCount, 2, rng);
  const segments: CellCoord[][] = [];
  let offset = 0;
  for (const len of lengths) {
    segments.push(hamPath.slice(offset, offset + len));
    offset += len;
  }
  return segments;
}

function countBends(path: CellCoord[]): number {
  let bends = 0;
  for (let i = 1; i < path.length - 1; i++) {
    const dr1 = path[i][0] - path[i - 1][0];
    const dc1 = path[i][1] - path[i - 1][1];
    const dr2 = path[i + 1][0] - path[i][0];
    const dc2 = path[i + 1][1] - path[i][1];
    if (dr1 !== dr2 || dc1 !== dc2) bends++;
  }
  return bends;
}

/**
 * Lightweight quality gate against the concrete failure modes the spec
 * calls out (one dominant path, too many trivially-adjacent pairs, an
 * overall shape that's mostly straight lines) - not an attempt at a full
 * puzzle-quality scoring system. Thresholds were picked by inspecting a
 * seed sweep during implementation (see logic.test.ts's variety tests and
 * the final report's generation section), not derived analytically.
 */
function isAcceptableSegmentation(segments: CellCoord[][], size: number): boolean {
  const total = size * size;
  const longest = Math.max(...segments.map((s) => s.length));
  if (longest > total * 0.6) return false;

  const trivialCount = segments.filter((s) => s.length === 2).length;
  if (trivialCount > Math.ceil(segments.length / 3)) return false;

  const totalBends = segments.reduce((sum, s) => sum + countBends(s), 0);
  const totalInternalSteps = segments.reduce((sum, s) => sum + Math.max(0, s.length - 2), 0);
  if (totalInternalSteps > 0 && totalBends / totalInternalSteps < 0.15) return false;

  return true;
}

const GENERATE_MAX_ATTEMPTS = 40;

/**
 * Builds a complete Puzzle: a full-board Hamiltonian path is generated
 * once, then cut into `pairs` contiguous segments (retrying the cut, and
 * periodically the whole path, when the result fails the quality gate).
 * Every segment is by construction a simple orthogonal chain with no
 * overlaps that together cover the entire board, so the *only* way this
 * could return something invalid is a bug - validatePuzzle runs as a
 * defense-in-depth check before the fallback return, not because it's
 * expected to ever fail.
 */
export function generatePuzzle(difficulty: Difficulty, rng: () => number = Math.random, maxAttempts = GENERATE_MAX_ATTEMPTS): Puzzle {
  const { size, pairs } = difficulty;
  let hamPath = buildHamiltonianPath(size, rng);

  const toPuzzle = (segments: CellCoord[][]): Puzzle => ({
    difficultyId: difficulty.id,
    size,
    pairCount: pairs,
    endpoints: segments.map((s) => [s[0], s[s.length - 1]] as [CellCoord, CellCoord]),
    solution: segments,
  });

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0 && attempt % 5 === 0) hamPath = buildHamiltonianPath(size, rng);
    const segments = splitIntoSegments(hamPath, pairs, rng);
    if (!isAcceptableSegmentation(segments, size)) continue;
    const puzzle = toPuzzle(segments);
    if (validatePuzzle(puzzle)) return puzzle;
  }

  return toPuzzle(splitIntoSegments(hamPath, pairs, rng));
}

/**
 * Verifies a puzzle's own known solution is actually legal under the same
 * rules the player is bound by: full coverage, no overlap, every route a
 * single continuous orthogonal chain with exactly two distinct endpoints
 * that match its declared endpoint metadata.
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
