import { useEffect, useMemo, useReducer } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import { COMPUTER_DELAY_MS, EMPTY_RECORD, addResult, controllerFor, type MatchRecord, type Mode } from "../versus";
import {
  cellName,
  chooseMove,
  countDiscs,
  createInitialState,
  legalMoves,
  playMove,
  undoMove,
  undoToTurn,
  winner,
  type GameState,
  type Level,
  type Player,
} from "./logic";

export type { Mode } from "../versus";

interface ViewState {
  game: GameState;
  /** Solo result already added to the record for this game. */
  recorded: boolean;
  message: string;
}

type Action = { type: "play"; i: number } | { type: "undo"; mode: Mode } | { type: "reset" } | { type: "recorded" };

const NAMES: Record<Player, string> = { cyan: "Cyan", pink: "Pink" };

function describe(prev: GameState, next: GameState): string {
  const mover = NAMES[prev.current];
  let text = `${mover} ${cellName(next.lastMove!)}, ${next.lastFlips.length} flipped.`;
  if (next.status === "over") {
    const w = winner(next);
    const { cyan, pink } = countDiscs(next.board);
    text += w === "draw" ? ` Game over, draw ${cyan} to ${pink}.` : ` Game over, ${NAMES[w as Player]} wins ${Math.max(cyan, pink)} to ${Math.min(cyan, pink)}.`;
  } else if (next.passed) {
    text += ` ${NAMES[next.passed]} has no move and passes.`;
  }
  return text;
}

function fresh(): ViewState {
  return { game: createInitialState(), recorded: false, message: "" };
}

function reducer(view: ViewState, action: Action): ViewState {
  switch (action.type) {
    case "play": {
      const game = playMove(view.game, action.i);
      if (game === view.game) return view;
      return { ...view, game, message: describe(view.game, game) };
    }
    case "undo": {
      const game = action.mode === "solo" ? undoToTurn(view.game, "cyan") : undoMove(view.game);
      if (game === view.game) return view;
      return { ...view, game, recorded: false, message: "Move undone." };
    }
    case "reset":
      return { ...fresh(), message: "New game." };
    case "recorded":
      return { ...view, recorded: true };
  }
}

export function useReversi() {
  const [mode, setMode] = useGameStorage<Mode>("reversi", "mode", "solo");
  const [level, setLevel] = useGameStorage<Level>("reversi", "level", "normal");
  const [showMoves, setShowMoves] = useGameStorage("reversi", "show-moves", true);
  const [records, setRecords] = useGameStorage<Record<Level, MatchRecord>>("reversi", "records", {
    easy: EMPTY_RECORD,
    normal: EMPTY_RECORD,
    hard: EMPTY_RECORD,
  });
  const [view, dispatch] = useReducer(reducer, undefined, fresh);
  const { game } = view;
  const { board, current } = game;

  const moves = useMemo(() => legalMoves(board, current), [board, current]);
  const turnController = game.status === "playing" ? controllerFor(mode, game.current, "pink") : null;
  const computerThinking = turnController === "computer";

  // The computer's turn: one timeout per position, cleared if anything
  // changes first (undo, new game, mode switch, leaving the page).
  useEffect(() => {
    if (!computerThinking) return;
    const id = window.setTimeout(() => {
      const move = chooseMove(board, current, level, Math.random);
      if (move !== null) dispatch({ type: "play", i: move });
    }, COMPUTER_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [computerThinking, board, current, level]);

  // Solo results go on the record for the level played, once per game.
  const result = winner(game);
  useEffect(() => {
    if (mode !== "solo" || result === null || view.recorded) return;
    const next = addResult(records[level], result === "draw" ? "draw" : result === "cyan" ? "win" : "loss");
    setRecords({ ...records, [level]: next });
    dispatch({ type: "recorded" });
  }, [mode, result, view.recorded, records, level, setRecords]);

  return {
    ...game,
    counts: countDiscs(game.board),
    moves,
    result,
    mode,
    level,
    showMoves,
    record: records[level],
    turnController,
    computerThinking,
    message: view.message,
    inProgress: game.status === "playing" && game.history.length > 0,
    canUndo: mode === "solo" ? game.history.some((h) => h.current === "cyan") && !computerThinking : game.history.length > 0,
    play: (i: number) => {
      if (turnController === "person") dispatch({ type: "play", i });
    },
    undo: () => dispatch({ type: "undo", mode }),
    newGame: (next?: { mode?: Mode; level?: Level }) => {
      if (next?.mode && next.mode !== mode) setMode(next.mode);
      if (next?.level && next.level !== level) setLevel(next.level);
      dispatch({ type: "reset" });
    },
    setShowMoves,
  };
}
