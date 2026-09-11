import { useEffect, useReducer, useState } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import {
  createInitialBoard,
  hasAvailableMove,
  hasReachedMilestone,
  isValidBestScore,
  isValidPersistedRun,
  moveBoard,
  spawnTile,
  type Board,
  type Direction,
  type PersistedRun,
} from "./logic";

/** Everything Undo needs to restore - taken right before a successful move. */
interface UndoSnapshot {
  board: Board;
  score: number;
  milestoneShown: boolean;
}

export interface GameState {
  board: Board;
  score: number;
  /** Has the "CORE STABLE" milestone prompt already been shown+dismissed this run - never re-shown once true, even though the board can't un-reach 2048. */
  milestoneShown: boolean;
  // A single slot, not a stack: v1 is explicitly single-step undo, so making
  // a new move after undoing simply replaces this with a fresh snapshot -
  // there is deliberately no way back to whatever was undone.
  previous: UndoSnapshot | null;
  // Transient, render-only cues for the current board - never persisted and
  // never part of the undo snapshot, since they describe *how* the last
  // change happened, not the state itself.
  lastMergedCells: [number, number][];
  lastSpawnedCell: [number, number] | null;
}

export type Action =
  | { type: "move"; direction: Direction; rng?: () => number }
  | { type: "undo" }
  | { type: "new-game"; rng?: () => number }
  | { type: "acknowledge-milestone" }
  | { type: "hydrate"; run: PersistedRun };

// Arrow keys plus WASD, matching the precedent already established in
// Snake's own keyboard handling - re-defined locally rather than imported,
// since sharing this specific map isn't worth a cross-game dependency for
// eight object entries.
const DIRECTION_KEYS: Record<string, Direction> = {
  arrowup: "up",
  w: "up",
  arrowdown: "down",
  s: "down",
  arrowleft: "left",
  a: "left",
  arrowright: "right",
  d: "right",
};

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

function findSpawnedCell(before: Board, after: Board): [number, number] | null {
  for (let r = 0; r < before.length; r++) {
    for (let c = 0; c < before[r].length; c++) {
      if (before[r][c] === 0 && after[r][c] !== 0) return [r, c];
    }
  }
  return null;
}

function newRunState(rng?: () => number): GameState {
  return {
    board: createInitialBoard(rng),
    score: 0,
    milestoneShown: false,
    previous: null,
    lastMergedCells: [],
    lastSpawnedCell: null,
  };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "hydrate":
      return {
        board: action.run.board,
        score: action.run.score,
        milestoneShown: action.run.milestoneShown,
        previous: null,
        lastMergedCells: [],
        lastSpawnedCell: null,
      };

    case "new-game":
      return newRunState(action.rng);

    case "acknowledge-milestone":
      return { ...state, milestoneShown: true };

    case "undo": {
      if (!state.previous) return state;
      return {
        board: state.previous.board,
        score: state.previous.score,
        milestoneShown: state.previous.milestoneShown,
        previous: null,
        lastMergedCells: [],
        lastSpawnedCell: null,
      };
    }

    case "move": {
      if (!hasAvailableMove(state.board)) return state;
      const result = moveBoard(state.board, action.direction);
      // A no-op move must not spawn a tile, change score, or overwrite the
      // existing undo point - per spec, it should leave the run untouched.
      if (!result.changed) return state;

      const boardWithSpawn = spawnTile(result.board, action.rng);
      return {
        board: boardWithSpawn,
        score: state.score + result.scoreGained,
        milestoneShown: state.milestoneShown,
        previous: { board: state.board, score: state.score, milestoneShown: state.milestoneShown },
        lastMergedCells: result.mergedCells,
        lastSpawnedCell: findSpawnedCell(result.board, boardWithSpawn),
      };
    }
  }
}

export function use2048() {
  const [persistedRun, setPersistedRun] = useGameStorage<unknown>("2048", "active-run", null);
  const [persistedBest, setPersistedBest] = useGameStorage<unknown>("2048", "best-score", 0);
  const bestScore = isValidBestScore(persistedBest) ? persistedBest : 0;

  const [state, dispatch] = useReducer(reducer, undefined, () => {
    // Malformed persisted data (wrong shape, hand-edited, corrupted by a
    // future format change) must never reach the board/reducer as-is - fall
    // back to a fresh run rather than crash or render garbage.
    if (isValidPersistedRun(persistedRun)) {
      return {
        board: persistedRun.board,
        score: persistedRun.score,
        milestoneShown: persistedRun.milestoneShown,
        previous: null,
        lastMergedCells: [],
        lastSpawnedCell: null,
      };
    }
    return newRunState();
  });

  const [pendingNewGame, setPendingNewGame] = useState(false);

  const gameOver = !hasAvailableMove(state.board);
  const milestoneReached = hasReachedMilestone(state.board);
  const showMilestonePrompt = milestoneReached && !state.milestoneShown && !gameOver;

  // Persist the active run on every change. Deliberately excludes
  // `previous`/undo state and the transient animation fields - a reload
  // should resume the current run, not a half-finished gesture.
  useEffect(() => {
    setPersistedRun({ board: state.board, score: state.score, milestoneShown: state.milestoneShown });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.board, state.score, state.milestoneShown]);

  // Best score only ever increases, and a fresh game (score 0) can never
  // trigger a decrease here - "new game replaces the active run but
  // preserves best score" falls out of that naturally.
  useEffect(() => {
    if (state.score > bestScore) setPersistedBest(state.score);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.score, bestScore]);

  // move()/undo() are the single choke point every input path (keyboard,
  // swipe) goes through, so the pendingNewGame gate lives in exactly one
  // place rather than needing to be repeated at each input handler - the
  // same class of bug already found and fixed twice (Color Sort,
  // Minesweeper) isn't possible here by construction.
  function move(direction: Direction) {
    if (pendingNewGame) return;
    dispatch({ type: "move", direction });
  }

  // Arrow keys / WASD, only while no destructive confirmation is pending -
  // move() itself already refuses to act then, but preventDefault still
  // needs to run so an arrow key doesn't scroll the page underneath a
  // confirmation dialog either.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const direction = DIRECTION_KEYS[event.key.toLowerCase()];
      if (!direction) return;
      event.preventDefault();
      move(direction);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingNewGame]);

  function undo() {
    if (pendingNewGame) return;
    dispatch({ type: "undo" });
  }

  function acknowledgeMilestone() {
    dispatch({ type: "acknowledge-milestone" });
  }

  // previous is only ever non-null after at least one successful move this
  // run - score > 0 would imply the same thing (a merge requires a prior
  // successful move), so it adds no additional case worth checking.
  const hasProgress = state.previous !== null;

  function requestNewGame() {
    if (gameOver || !hasProgress) {
      dispatch({ type: "new-game" });
      return;
    }
    setPendingNewGame(true);
  }

  function confirmNewGame() {
    dispatch({ type: "new-game" });
    setPendingNewGame(false);
  }

  function cancelNewGame() {
    setPendingNewGame(false);
  }

  return {
    board: state.board,
    score: state.score,
    bestScore,
    canUndo: state.previous !== null,
    lastMergedCells: state.lastMergedCells,
    lastSpawnedCell: state.lastSpawnedCell,
    gameOver,
    showMilestonePrompt,
    pendingNewGame,
    move,
    undo,
    acknowledgeMilestone,
    requestNewGame,
    confirmNewGame,
    cancelNewGame,
  };
}
