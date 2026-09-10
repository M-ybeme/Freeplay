import { useEffect, useState } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import {
  DIFFICULTIES,
  createEmptyBoard,
  revealCell,
  toggleFlag,
  type BoardState,
  type Difficulty,
} from "./logic";

export type InteractionMode = "reveal" | "flag";

interface BestTimes {
  beginner: number | null;
  intermediate: number | null;
  expert: number | null;
}

const INITIAL_BEST_TIMES: BestTimes = { beginner: null, intermediate: null, expert: null };

export function useMinesweeper() {
  const [difficulty, setDifficulty] = useState<Difficulty>(DIFFICULTIES[0]);
  const [board, setBoard] = useState<BoardState>(() => createEmptyBoard(DIFFICULTIES[0]));
  const [mode, setMode] = useState<InteractionMode>("reveal");
  const [elapsed, setElapsed] = useState(0);
  const [pendingDifficulty, setPendingDifficulty] = useState<Difficulty | null>(null);
  const [bestTimes, setBestTimes] = useGameStorage<BestTimes>(
    "minesweeper",
    "best-times",
    INITIAL_BEST_TIMES,
  );

  // Ticks once per second while actively playing. Skipping the increment
  // while the document is hidden (rather than tearing the interval down and
  // rebuilding it) is what gives Option A "pause while hidden, resume
  // automatically" for free — no visibilitychange listener needed.
  useEffect(() => {
    if (board.status !== "playing") return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [board.status]);

  // Record a best time only on a win, and only if it improves the record.
  // Naturally idempotent even if this fires more than once for the same
  // resolved game (elapsed stops changing once status leaves "playing", so
  // a repeat invocation just compares the same value against itself).
  useEffect(() => {
    if (board.status !== "won") return;
    const current = bestTimes[difficulty.id];
    if (current === null || elapsed < current) {
      setBestTimes({ ...bestTimes, [difficulty.id]: elapsed });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.status, difficulty.id, elapsed]);

  function startNewGame(nextDifficulty: Difficulty) {
    setDifficulty(nextDifficulty);
    setBoard(createEmptyBoard(nextDifficulty));
    setElapsed(0);
    setPendingDifficulty(null);
  }

  function selectDifficulty(next: Difficulty) {
    if (next.id === difficulty.id) return;
    if (board.status === "playing") {
      setPendingDifficulty(next);
    } else {
      startNewGame(next);
    }
  }

  function confirmDifficultyChange() {
    if (pendingDifficulty) startNewGame(pendingDifficulty);
  }

  function cancelDifficultyChange() {
    setPendingDifficulty(null);
  }

  function reveal(index: number) {
    setBoard((prev) => revealCell(prev, index));
  }

  function flag(index: number) {
    setBoard((prev) => toggleFlag(prev, index));
  }

  function interact(index: number) {
    if (mode === "flag") flag(index);
    else reveal(index);
  }

  function newGame() {
    startNewGame(difficulty);
  }

  return {
    board,
    difficulty,
    difficulties: DIFFICULTIES,
    mode,
    elapsed,
    bestTimes,
    pendingDifficulty,
    setMode,
    reveal,
    flag,
    interact,
    newGame,
    selectDifficulty,
    confirmDifficultyChange,
    cancelDifficultyChange,
  };
}
