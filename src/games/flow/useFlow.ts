import { useEffect, useReducer, useRef, useState } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import {
  DIFFICULTIES,
  beginRoute,
  connectedPairCount,
  createEmptyRoutes,
  extendRoute,
  extendRouteThroughPath,
  fillCount,
  generatePuzzle,
  isPairConnected,
  isSolved,
  isValidPersistedRun,
  resolveDragStart,
  type CellCoord,
  type Difficulty,
  type DifficultyId,
  type Puzzle,
  type Routes,
} from "./logic";

export interface GameState {
  puzzle: Puzzle;
  routes: Routes;
}

export type Action =
  | { type: "generate"; difficulty: Difficulty; rng?: () => number }
  | { type: "restart" }
  | { type: "hydrate"; puzzle: Puzzle; routes: Routes }
  | { type: "begin-route"; pairIndex: number; cell: CellCoord }
  | { type: "extend-route"; pairIndex: number; cell: CellCoord }
  | { type: "set-routes"; routes: Routes };

function newRunState(difficulty: Difficulty, rng?: () => number): GameState {
  const puzzle = generatePuzzle(difficulty, rng);
  return { puzzle, routes: createEmptyRoutes(puzzle.pairCount) };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "generate":
      return newRunState(action.difficulty, action.rng);

    case "restart":
      return { puzzle: state.puzzle, routes: createEmptyRoutes(state.puzzle.pairCount) };

    case "hydrate":
      return { puzzle: action.puzzle, routes: action.routes };

    case "begin-route":
      return { ...state, routes: beginRoute(state.puzzle, state.routes, action.pairIndex, action.cell) };

    case "extend-route":
      // Fast-drag interpolation happens *before* dispatch (see continueDrag
      // below) - by the time an action reaches the reducer it's always
      // exactly one already-resolved intermediate cell, so the reducer
      // itself only ever needs the single-step primitive.
      return { ...state, routes: extendRoute(state.puzzle, state.routes, action.pairIndex, action.cell) };

    case "set-routes":
      // Used only by continueDrag, which has already computed a fully
      // legal result via extendRouteThroughPath (a pure function that
      // itself calls extendRoute's own checks at every intermediate step) -
      // this just commits that precomputed result rather than re-deriving it.
      return { ...state, routes: action.routes };
  }
}

function isValidDifficultyId(value: unknown): value is DifficultyId {
  return typeof value === "string" && DIFFICULTIES.some((d) => d.id === value);
}

const CONNECT_PULSE_MS = 700;

export function useFlow() {
  const [persistedRun, setPersistedRun] = useGameStorage<unknown>("flow", "active-run", null);
  const [persistedDifficultyId, setPersistedDifficultyId] = useGameStorage<unknown>("flow", "difficulty", "easy");
  const initialDifficulty = isValidDifficultyId(persistedDifficultyId)
    ? DIFFICULTIES.find((d) => d.id === persistedDifficultyId)!
    : DIFFICULTIES[0];

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    // Malformed/hand-edited/out-of-date persisted data must never reach the
    // board as-is - fall back to a fresh puzzle rather than crash or render
    // an inconsistent board.
    if (isValidPersistedRun(persistedRun)) {
      return { puzzle: persistedRun.puzzle, routes: persistedRun.routes };
    }
    return newRunState(initialDifficulty);
  });

  const difficulty = DIFFICULTIES.find((d) => d.id === state.puzzle.difficultyId) ?? DIFFICULTIES[0];

  // Which pair (if any) is actively being drawn/edited right now - transient
  // interaction state, not part of the persisted run.
  const [activePair, setActivePair] = useState<number | null>(null);
  // A same-difficulty "New Puzzle" request and a difficulty switch share one
  // confirmation flow: both discard the current routes, so both route
  // through this single pending-target slot.
  const [pendingDifficulty, setPendingDifficulty] = useState<Difficulty | null>(null);
  // One-shot cue for "a pair just connected" - cleared automatically after
  // the pulse plays, never persisted.
  const [justConnectedPair, setJustConnectedPair] = useState<number | null>(null);

  const locked = pendingDifficulty !== null;
  const solved = isSolved(state.puzzle, state.routes);
  const connectedCount = connectedPairCount(state.puzzle, state.routes);
  const filled = fillCount(state.routes);
  const totalCells = state.puzzle.size * state.puzzle.size;
  const hasProgress = state.routes.some((path) => path.length > 0);

  // Persist the active run (puzzle + player routes) on every change - Flow
  // puzzles can take a while, so losing progress to a refresh would be
  // irritating. Deliberately excludes activePair/pendingDifficulty/
  // justConnectedPair, which describe an in-progress gesture or dialog, not
  // the run itself.
  useEffect(() => {
    setPersistedRun({ puzzle: state.puzzle, routes: state.routes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.puzzle, state.routes]);

  useEffect(() => {
    setPersistedDifficultyId(difficulty.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [difficulty.id]);

  // Detects a pair transitioning from not-connected to connected, purely by
  // diffing against the previous render's (puzzle, routes) - connected
  // status is derived, not stored, so there's nothing to flag in the
  // reducer itself. A puzzle-identity change (new puzzle/restart/hydrate)
  // means the diff is meaningless, so it's skipped rather than compared.
  const prevRef = useRef<{ puzzle: Puzzle; routes: Routes }>({ puzzle: state.puzzle, routes: state.routes });
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = { puzzle: state.puzzle, routes: state.routes };
    if (prev.puzzle !== state.puzzle) {
      setJustConnectedPair(null);
      return;
    }
    for (let p = 0; p < state.puzzle.pairCount; p++) {
      const was = isPairConnected(prev.puzzle, prev.routes, p);
      const now = isPairConnected(state.puzzle, state.routes, p);
      if (!was && now) {
        setJustConnectedPair(p);
        return;
      }
    }
  }, [state.puzzle, state.routes]);

  useEffect(() => {
    if (justConnectedPair === null) return;
    const id = window.setTimeout(() => setJustConnectedPair(null), CONNECT_PULSE_MS);
    return () => window.clearTimeout(id);
  }, [justConnectedPair]);

  function beginDrag(cell: CellCoord) {
    if (locked) return;
    const pairIndex = resolveDragStart(state.puzzle, state.routes, cell);
    if (pairIndex === null) return;
    dispatch({ type: "begin-route", pairIndex, cell });
    setActivePair(pairIndex);
  }

  // Used by both pointer drag (after resolving fast-movement interpolation
  // to a single next cell) and keyboard editing (where a single arrow press
  // is inherently one step) - both paths only ever need the primitive
  // reducer action, so there's no separate "keyboard extend."
  function extendActiveRoute(cell: CellCoord) {
    if (locked || activePair === null) return;
    dispatch({ type: "extend-route", pairIndex: activePair, cell });
  }

  // Pointer-drag specific: resolves fast movement (a sampled pointer
  // position more than one cell from the current tip) into a sequence of
  // legal single-step extensions before touching the reducer at all, so a
  // sparse pointermove stream can never make a route skip cells.
  function continueDrag(cell: CellCoord) {
    if (locked || activePair === null) return;
    const next = extendRouteThroughPath(state.puzzle, state.routes, activePair, cell);
    if (next === state.routes) return;
    dispatch({ type: "set-routes", routes: next });
  }

  function endDrag() {
    setActivePair(null);
  }

  function restart() {
    if (locked) return;
    dispatch({ type: "restart" });
    setActivePair(null);
  }

  function requestNewPuzzle() {
    if (locked) return;
    if (!hasProgress || solved) {
      dispatch({ type: "generate", difficulty });
      setActivePair(null);
      return;
    }
    setPendingDifficulty(difficulty);
  }

  function requestDifficulty(target: Difficulty) {
    if (locked || target.id === difficulty.id) return;
    if (!hasProgress || solved) {
      dispatch({ type: "generate", difficulty: target });
      setActivePair(null);
      return;
    }
    setPendingDifficulty(target);
  }

  function confirmPending() {
    if (!pendingDifficulty) return;
    dispatch({ type: "generate", difficulty: pendingDifficulty });
    setPendingDifficulty(null);
    setActivePair(null);
  }

  function cancelPending() {
    setPendingDifficulty(null);
  }

  return {
    puzzle: state.puzzle,
    routes: state.routes,
    difficulty,
    difficulties: DIFFICULTIES,
    activePair,
    justConnectedPair,
    pendingDifficulty,
    locked,
    solved,
    connectedCount,
    filled,
    totalCells,
    beginDrag,
    continueDrag,
    extendActiveRoute,
    endDrag,
    restart,
    requestNewPuzzle,
    requestDifficulty,
    confirmPending,
    cancelPending,
  };
}
