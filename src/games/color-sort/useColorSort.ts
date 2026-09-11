import { useEffect, useReducer, useRef, useState } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import {
  DIFFICULTIES,
  generatePuzzle,
  isBoardSolved,
  isLegalPour,
  pour,
  type Board,
  type Difficulty,
} from "./logic";

type Status = "playing" | "won";

// Far beyond realistic recovery needs - this exists only to give history a
// deterministic memory bound, not because players are expected to undo this
// deep. Oldest entries are dropped first so undo always steps back from
// wherever play currently is.
const MAX_HISTORY = 200;

/**
 * A snapshot of everything Undo needs to restore - taken right before a pour
 * is applied. No `status` field: a history entry can only ever be created
 * from the "select" action's pour branch, which is only reachable when
 * state.status === "playing" (the reducer returns early otherwise), so the
 * status being restored is always "playing" - storing it would just be
 * recording a constant.
 */
interface HistoryEntry {
  board: Board;
  moveCount: number;
}

export interface GameState {
  difficulty: Difficulty;
  initialBoard: Board;
  board: Board;
  selectedTube: number | null;
  moveCount: number;
  status: Status;
  // A plain stack, not a tree: undo only ever pops, never pushes a "redo"
  // entry, so making a new move after undoing naturally discards whatever
  // was ahead - there's nothing left to discard it from.
  history: HistoryEntry[];
}

export type Action =
  | { type: "select"; index: number }
  | { type: "new-puzzle"; difficulty: Difficulty; rng?: () => number }
  | { type: "restart" }
  | { type: "undo" };

function newPuzzleState(difficulty: Difficulty, rng?: () => number): GameState {
  const board = generatePuzzle(difficulty, rng);
  return {
    difficulty,
    initialBoard: board,
    board,
    selectedTube: null,
    moveCount: 0,
    status: "playing",
    history: [],
  };
}

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "new-puzzle":
      return newPuzzleState(action.difficulty, action.rng);

    case "restart":
      return {
        ...state,
        board: state.initialBoard.map((tube) => tube.slice()),
        selectedTube: null,
        moveCount: 0,
        status: "playing",
        history: [],
      };

    case "undo": {
      if (state.history.length === 0) return state;
      const previous = state.history[state.history.length - 1];
      return {
        ...state,
        board: previous.board,
        moveCount: previous.moveCount,
        status: "playing",
        selectedTube: null,
        history: state.history.slice(0, -1),
      };
    }

    case "select": {
      if (state.status !== "playing") return state;
      const { index } = action;

      if (state.selectedTube === null) {
        if (state.board[index].length === 0) return state;
        return { ...state, selectedTube: index };
      }

      if (index === state.selectedTube) {
        return { ...state, selectedTube: null };
      }

      if (isLegalPour(state.board, state.selectedTube, index)) {
        const board = pour(state.board, state.selectedTube, index);
        const entry: HistoryEntry = { board: state.board, moveCount: state.moveCount };
        // Oldest first: dropping from the front (not the back) is what makes
        // this "keep the most recent 200 moves" rather than "keep the first
        // 200 moves ever made".
        const history = [...state.history, entry].slice(-MAX_HISTORY);
        return {
          ...state,
          board,
          selectedTube: null,
          moveCount: state.moveCount + 1,
          status: isBoardSolved(board) ? "won" : "playing",
          history,
        };
      }

      // Not a legal destination - if it's a real candidate source (has
      // something in it), just switch the selection to it rather than
      // requiring the player to first deselect. Tapping around to compare
      // tubes is normal play, not an error. Neither this nor a plain
      // select/deselect above touches history - only a completed pour does.
      if (state.board[index].length > 0) {
        return { ...state, selectedTube: index };
      }
      return { ...state, selectedTube: null };
    }
  }
}

interface BestMoves {
  easy: number | null;
  medium: number | null;
  hard: number | null;
}

const INITIAL_BEST_MOVES: BestMoves = { easy: null, medium: null, hard: null };

export function useColorSort() {
  const [savedDifficultyId, setSavedDifficultyId] = useGameStorage<Difficulty["id"]>(
    "color-sort",
    "difficulty",
    "easy",
  );
  const initialDifficulty = DIFFICULTIES.find((d) => d.id === savedDifficultyId) ?? DIFFICULTIES[0];
  const [bestMoves, setBestMoves] = useGameStorage<BestMoves>("color-sort", "best-moves", INITIAL_BEST_MOVES);

  const [state, dispatch] = useReducer(reducer, initialDifficulty, (d) => newPuzzleState(d));
  const [pendingDifficulty, setPendingDifficulty] = useState<Difficulty | null>(null);

  // Record a best-moves improvement exactly once per win. Guarded by
  // round-transition (leaving "won" resets the flag), not by value equality
  // - the same bug class hit in Blackjack and avoided here for the same
  // reason: guarding on the outcome *value* would wrongly skip a second win
  // in a row that happens to tie the same move count.
  const alreadyCounted = useRef(false);
  useEffect(() => {
    if (state.status !== "won") {
      alreadyCounted.current = false;
      return;
    }
    if (alreadyCounted.current) return;
    alreadyCounted.current = true;
    const current = bestMoves[state.difficulty.id];
    if (current === null || state.moveCount < current) {
      setBestMoves({ ...bestMoves, [state.difficulty.id]: state.moveCount });
    }
  }, [state.status, state.difficulty.id, state.moveCount, bestMoves, setBestMoves]);

  function selectTube(index: number) {
    dispatch({ type: "select", index });
  }

  function startNewPuzzle(difficulty: Difficulty) {
    setSavedDifficultyId(difficulty.id);
    dispatch({ type: "new-puzzle", difficulty });
    setPendingDifficulty(null);
  }

  function selectDifficulty(next: Difficulty) {
    if (next.id === state.difficulty.id) return;
    if (state.status === "playing" && state.moveCount > 0) {
      setPendingDifficulty(next);
    } else {
      startNewPuzzle(next);
    }
  }

  function confirmDifficultyChange() {
    if (pendingDifficulty) startNewPuzzle(pendingDifficulty);
  }

  function cancelDifficultyChange() {
    setPendingDifficulty(null);
  }

  function newPuzzle() {
    startNewPuzzle(state.difficulty);
  }

  function restartPuzzle() {
    dispatch({ type: "restart" });
  }

  function undo() {
    dispatch({ type: "undo" });
  }

  return {
    difficulty: state.difficulty,
    difficulties: DIFFICULTIES,
    board: state.board,
    selectedTube: state.selectedTube,
    moveCount: state.moveCount,
    status: state.status,
    canUndo: state.history.length > 0,
    bestMoves,
    pendingDifficulty,
    selectTube,
    selectDifficulty,
    confirmDifficultyChange,
    cancelDifficultyChange,
    newPuzzle,
    restartPuzzle,
    undo,
  };
}
