import { useEffect, useReducer, useRef } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import {
  BOARD_SIZE,
  applyDirectionInput,
  createInitialState,
  tick,
  tickDurationForScore,
  togglePause,
  type Direction,
  type GameState,
} from "./logic";

type Action =
  | { type: "tick" }
  | { type: "input"; direction: Direction }
  | { type: "toggle-pause" }
  | { type: "pause" }
  | { type: "restart" };

function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "tick":
      return tick(state, BOARD_SIZE);
    case "input":
      return applyDirectionInput(state, action.direction);
    case "toggle-pause":
      return togglePause(state);
    case "pause":
      return state.status === "playing" ? { ...state, status: "paused" } : state;
    case "restart":
      return createInitialState(BOARD_SIZE);
  }
}

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

export function useSnake() {
  const [best, setBest] = useGameStorage("snake", "best-score", 0);
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState(BOARD_SIZE));

  // Movement loop: only ticks while playing, at a cadence derived from score.
  // Cleanup always clears the interval, so a status/score change (or Strict
  // Mode's mount-cleanup-mount) can never leave two intervals running.
  useEffect(() => {
    if (state.status !== "playing") return;
    const ms = tickDurationForScore(state.score);
    const id = window.setInterval(() => dispatch({ type: "tick" }), ms);
    return () => window.clearInterval(id);
  }, [state.status, state.score]);

  // Keyboard: arrows + WASD for direction, space/P to toggle pause. Ignored
  // while an unrelated editable control has focus.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();

      const direction = DIRECTION_KEYS[key];
      if (direction) {
        event.preventDefault();
        dispatch({ type: "input", direction });
        return;
      }
      if (key === " " || key === "p") {
        event.preventDefault();
        dispatch({ type: "toggle-pause" });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Auto-pause when the tab/app is backgrounded. Deliberately does not
  // auto-resume — the player must explicitly resume so they aren't killed
  // the instant they return.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) dispatch({ type: "pause" });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (state.score > best) setBest(state.score);
  }, [state.score, best, setBest]);

  // Snapshots `best` at the moment each run starts (mount, and every restart)
  // so "new best" can be judged against the record as it stood before this
  // run, rather than against `best` after it may have already been bumped
  // mid-run by the effect above — correct regardless of effect ordering.
  const bestAtRunStartRef = useRef(best);
  useEffect(() => {
    if (state.status === "ready") bestAtRunStartRef.current = best;
  }, [state.status, best]);

  const isGameEnd = state.status === "gameOver" || state.status === "won";

  return {
    ...state,
    best,
    boardSize: BOARD_SIZE,
    isNewBest: isGameEnd && state.score > bestAtRunStartRef.current,
    changeDirection: (direction: Direction) => dispatch({ type: "input", direction }),
    togglePause: () => dispatch({ type: "toggle-pause" }),
    restart: () => dispatch({ type: "restart" }),
  };
}
