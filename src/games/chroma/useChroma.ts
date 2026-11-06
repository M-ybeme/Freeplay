import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import { readJSON, writeJSON } from "../../services/storage/localStorage";
import { CALL_CHANCE, cpuMove, type CpuMove } from "./ai";
import {
  DEFAULT_TARGET,
  TARGETS,
  callLastCard,
  catchLastCard,
  chooseColor,
  drawForTurn,
  finishRound,
  isSavedGame,
  newGame,
  nextRound,
  pass,
  playCard,
  type Color,
  type GameState,
  type RoundState,
  type Seat,
  type Target,
} from "./logic";

/** Pause before a computer player moves, so each turn reads. */
export const AI_DELAY_MS = 650;
/** How long a missed last card stays open: time for you to Catch!, or to call your own. */
export const CATCH_WINDOW_MS = 1600;
const REDUCED_AI_DELAY_MS = 250;
const REDUCED_CATCH_WINDOW_MS = 1200;

/** The person always sits South. */
export const YOU: Seat = 0;

const GAME_KEY = "freeplay:chroma:game";

export type Action =
  | { type: "new-game"; target: Target; seed: number }
  /** `roll` (0-1) decides whether a computer player remembers to call its last card. */
  | { type: "move"; seat: Seat; move: CpuMove; roll?: number }
  | { type: "call"; seat: Seat }
  | { type: "catch" }
  | { type: "next-round"; seed: number };

function applyMove(round: RoundState, seat: Seat, move: CpuMove): RoundState {
  switch (move.type) {
    case "play":
      return playCard(round, seat, move.cardId);
    case "draw":
      return drawForTurn(round, seat);
    case "pass":
      return pass(round, seat);
    case "color":
      return chooseColor(round, seat, move.color);
  }
}

export function reducer(game: GameState, action: Action): GameState {
  switch (action.type) {
    case "new-game":
      return newGame(action.target, action.seed);
    case "move": {
      if (game.status !== "playing") return game;
      let round = applyMove(game.round, action.seat, action.move);
      if (round === game.round) return game;
      const w = round.lastCard;
      if (action.roll !== undefined && w && w.seat === action.seat && !w.called && action.roll < CALL_CHANCE) {
        round = callLastCard(round, action.seat);
      }
      const next = { ...game, round };
      return round.phase === "round-over" ? finishRound(next) : next;
    }
    case "call": {
      const round = callLastCard(game.round, action.seat);
      return round === game.round ? game : { ...game, round };
    }
    case "catch": {
      const round = catchLastCard(game.round);
      return round === game.round ? game : { ...game, round };
    }
    case "next-round":
      return nextRound(game, action.seed);
  }
}

export interface ChromaRecord {
  wins: number;
  losses: number;
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

function validTarget(value: unknown): Target {
  return TARGETS.includes(value as Target) ? (value as Target) : DEFAULT_TARGET;
}

/** True once this game holds anything worth asking about before throwing it away. */
function hasProgress(game: GameState): boolean {
  return game.status === "playing" && (game.roundNumber > 1 || game.round.discard.length > 1);
}

export function useChroma() {
  const [targetPref, setTargetPref] = useGameStorage<Target>("chroma", "target", DEFAULT_TARGET);
  const [record, setRecord] = useGameStorage<ChromaRecord>("chroma", "record", { wins: 0, losses: 0 });
  const [game, dispatch] = useReducer(reducer, null, () => {
    // A refresh resumes the game in progress; a finished one starts fresh.
    const saved = readJSON<unknown>(GAME_KEY, null);
    return isSavedGame(saved) && saved.status === "playing" ? saved : newGame(validTarget(targetPref), newSeed());
  });
  const [pendingTarget, setPendingTarget] = useState<Target | null>(null);

  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const aiDelay = reducedMotion ? REDUCED_AI_DELAY_MS : AI_DELAY_MS;
  const catchWindow = reducedMotion ? REDUCED_CATCH_WINDOW_MS : CATCH_WINDOW_MS;

  // Save every change, so leaving mid-round loses nothing.
  useEffect(() => {
    writeJSON(GAME_KEY, game);
  }, [game]);

  // Count each finished game once: only on the change from playing.
  const lastStatus = useRef(game.status);
  useEffect(() => {
    if (lastStatus.current === "playing" && game.status !== "playing") {
      setRecord(game.status === "won" ? { ...record, wins: record.wins + 1 } : { ...record, losses: record.losses + 1 });
    }
    lastStatus.current = game.status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.status]);

  // The computer players' turns, and catching a last card you didn't call.
  useEffect(() => {
    const round = game.round;
    if (game.status !== "playing" || round.phase === "round-over" || round.turn === YOU) return;
    const missed = round.lastCard && !round.lastCard.called ? round.lastCard.seat : null;
    let action: Action;
    let delay = aiDelay;
    if (missed === YOU) {
      // You get the window to call it; then the next player catches you.
      action = { type: "catch" };
      delay = catchWindow;
    } else {
      action = { type: "move", seat: round.turn, move: cpuMove(round, round.turn), roll: Math.random() };
      // A computer player forgot to call: give you time to catch it.
      if (missed !== null) delay = catchWindow;
    }
    const id = window.setTimeout(() => dispatch(action), delay);
    return () => window.clearTimeout(id);
  }, [game, aiDelay, catchWindow]);

  function startGame(target: Target) {
    setTargetPref(target);
    setPendingTarget(null);
    dispatch({ type: "new-game", target, seed: newSeed() });
  }

  /** New game (same target), or a target change: asks first once there's progress. */
  function requestNewGame(target: Target = game.target) {
    if (hasProgress(game)) setPendingTarget(target);
    else startGame(target);
  }

  return {
    game,
    record,
    pendingTarget,
    play: (cardId: number) => dispatch({ type: "move", seat: YOU, move: { type: "play", cardId } }),
    draw: () => dispatch({ type: "move", seat: YOU, move: { type: "draw" } }),
    keep: () => dispatch({ type: "move", seat: YOU, move: { type: "pass" } }),
    pickColor: (color: Color) => dispatch({ type: "move", seat: YOU, move: { type: "color", color } }),
    callLast: () => dispatch({ type: "call", seat: YOU }),
    catchCpu: () => dispatch({ type: "catch" }),
    nextRound: () => dispatch({ type: "next-round", seed: newSeed() }),
    requestNewGame,
    confirmNewGame: () => pendingTarget !== null && startGame(pendingTarget),
    cancelNewGame: () => setPendingTarget(null),
  };
}
