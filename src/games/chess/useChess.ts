import { useEffect, useMemo, useReducer } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import { COMPUTER_DELAY_MS, EMPTY_RECORD, addResult, controllerFor, type MatchRecord, type Mode } from "../versus";
import { chooseMove, type Level } from "./ai";
import {
  createGame,
  inCheck,
  kingSquare,
  legalMoves,
  playMove,
  squareName,
  undoMove,
  undoToTurn,
  winner,
  type Color,
  type GameState,
  type Move,
  type PieceType,
} from "./logic";

export type { Mode } from "../versus";

/** The person always plays cyan (white, moves first); in solo the computer is pink. */
const COMPUTER_SIDE: Color = "black";

export const SIDE_NAME: Record<Color, string> = { white: "Cyan", black: "Pink" };
export const PIECE_NAME: Record<PieceType, string> = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

const RESULT_TEXT: Record<string, string> = {
  stalemate: "Stalemate, draw.",
  fifty: "Draw by the fifty-move rule.",
  repetition: "Draw by threefold repetition.",
  material: "Draw, not enough material to mate.",
};

interface ViewState {
  game: GameState;
  /** Solo result already added to the record for this game. */
  recorded: boolean;
  message: string;
  /** The last change was a move (slide it in), not an undo or reset. */
  slide: boolean;
}

type Action = { type: "play"; move: Move } | { type: "undo"; mode: Mode } | { type: "reset" } | { type: "recorded" };

/** Spoken description of the move just played, for the live region. */
function describe(next: GameState): string {
  const { move, before } = next.moves[next.moves.length - 1];
  const side = SIDE_NAME[before.turn];
  let text: string;
  if (move.castle) text = `${side} castles ${move.castle === "k" ? "king side" : "queen side"}`;
  else {
    text = `${side} ${PIECE_NAME[move.piece]} ${squareName(move.from)} to ${squareName(move.to)}`;
    if (move.captured) text += `, takes ${PIECE_NAME[move.captured]}`;
    if (move.promotion) text += `, promotes to ${PIECE_NAME[move.promotion]}`;
  }
  text += ".";
  if (next.status === "checkmate") text += ` Checkmate, ${SIDE_NAME[before.turn]} wins.`;
  else if (next.status !== "playing") text += ` ${RESULT_TEXT[next.status]}`;
  else if (inCheck(next.position)) text += " Check.";
  return text;
}

function fresh(): ViewState {
  return { game: createGame(), recorded: false, message: "", slide: false };
}

function reducer(view: ViewState, action: Action): ViewState {
  switch (action.type) {
    case "play": {
      const game = playMove(view.game, action.move);
      if (game === view.game) return view;
      return { ...view, game, message: describe(game), slide: true };
    }
    case "undo": {
      const game = action.mode === "solo" ? undoToTurn(view.game, "white") : undoMove(view.game);
      if (game === view.game) return view;
      return { ...view, game, recorded: false, message: "Move undone.", slide: false };
    }
    case "reset":
      return { ...fresh(), message: "New game." };
    case "recorded":
      return { ...view, recorded: true };
  }
}

export function useChess() {
  const [mode, setMode] = useGameStorage<Mode>("chess", "mode", "solo");
  const [level, setLevel] = useGameStorage<Level>("chess", "level", "normal");
  const [showMoves, setShowMoves] = useGameStorage("chess", "show-moves", true);
  const [records, setRecords] = useGameStorage<Record<Level, MatchRecord>>("chess", "records", {
    easy: EMPTY_RECORD,
    normal: EMPTY_RECORD,
    hard: EMPTY_RECORD,
  });
  const [view, dispatch] = useReducer(reducer, undefined, fresh);
  const { game } = view;
  const { position, status } = game;

  const moves = useMemo(() => legalMoves(position), [position]);
  const turnController = status === "playing" ? controllerFor(mode, position.turn, COMPUTER_SIDE) : null;
  const computerThinking = turnController === "computer";

  // The computer's turn: one timeout per position, cleared if anything
  // changes first (undo, new game, mode switch, leaving the page).
  useEffect(() => {
    if (!computerThinking) return;
    const id = window.setTimeout(() => {
      const move = chooseMove(position, level);
      if (move) dispatch({ type: "play", move });
    }, COMPUTER_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [computerThinking, position, level]);

  // Solo results go on the record for the level played, once per game.
  const result = winner(game);
  useEffect(() => {
    if (mode !== "solo" || result === null || view.recorded) return;
    setRecords({ ...records, [level]: addResult(records[level], result === "draw" ? "draw" : result === "white" ? "win" : "loss") });
    dispatch({ type: "recorded" });
  }, [mode, result, view.recorded, records, level, setRecords]);

  const checked = status !== "stalemate" && inCheck(position) ? kingSquare(position.board, position.turn) : null;

  return {
    ...game,
    moves,
    played: game.moves,
    lastMove: game.moves.length ? game.moves[game.moves.length - 1].move : null,
    checked,
    result,
    mode,
    level,
    showMoves,
    record: records[level],
    turnController,
    computerThinking,
    message: view.message,
    slide: view.slide,
    inProgress: status === "playing" && game.moves.length > 0,
    canUndo: mode === "solo" ? game.moves.some((m) => m.before.turn === "white") && !computerThinking : game.moves.length > 0,
    play: (move: Move) => {
      if (turnController === "person") dispatch({ type: "play", move });
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
