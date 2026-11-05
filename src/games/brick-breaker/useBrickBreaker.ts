import { useEffect, useReducer, useRef } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import {
  createInitialState,
  launch,
  movePaddleTo,
  pause,
  step,
  togglePause,
  type Brick,
  type GameState,
} from "./logic";

/** How many past ball positions the light trail keeps. */
const TRAIL_LENGTH = 7;
/** How long a destroyed brick's burst stays on screen. */
const BURST_MS = 320;

export interface Burst extends Brick {
  bornAt: number;
}

/*
 * The rules live in logic.ts. This wrapper adds what only the screen needs:
 * the ball's recent positions (for the trail), short-lived bursts where
 * bricks were destroyed, and a message for the live region that changes
 * only on events (a lost ball, a cleared wall), never per frame.
 */
interface ViewState {
  game: GameState;
  trail: { x: number; y: number }[];
  bursts: Burst[];
  clock: number;
  message: string;
}

type Action =
  | { type: "frame"; dt: number; dir: -1 | 0 | 1 }
  | { type: "paddle"; x: number }
  | { type: "launch" }
  | { type: "toggle-pause" }
  | { type: "pause" }
  | { type: "restart" };

function initialView(): ViewState {
  return { game: createInitialState(), trail: [], bursts: [], clock: 0, message: "" };
}

function eventMessage(prev: GameState, next: GameState): string | null {
  if (next.level > prev.level) return `Wall cleared. Level ${next.level}.`;
  if (next.lives < prev.lives) {
    return next.lives > 0
      ? `Ball lost. ${next.lives} ${next.lives === 1 ? "ball" : "balls"} left.`
      : `Game over. Score ${next.score}.`;
  }
  return null;
}

function reducer(view: ViewState, action: Action): ViewState {
  switch (action.type) {
    case "frame": {
      const prev = view.game;
      const game = step(prev, action.dt, action.dir);
      if (game === prev && view.trail.length === 0 && view.bursts.length === 0) return view;

      const clock = view.clock + action.dt;
      const trail = game.status === "playing" ? [{ x: game.ball.x, y: game.ball.y }, ...view.trail].slice(0, TRAIL_LENGTH) : [];

      let bursts = view.bursts.filter((b) => clock - b.bornAt < BURST_MS);
      if (game.bricks !== prev.bricks && game.level === prev.level) {
        const left = new Set(game.bricks.map((b) => b.id));
        const gone = prev.bricks.filter((b) => !left.has(b.id));
        bursts = bursts.concat(gone.map((b) => ({ ...b, bornAt: clock })));
      } else if (game.level > prev.level) {
        // The last brick of the wall still bursts.
        bursts = bursts.concat(prev.bricks.map((b) => ({ ...b, bornAt: clock })));
      }

      return { game, trail, bursts, clock, message: eventMessage(prev, game) ?? view.message };
    }
    case "paddle":
      return { ...view, game: movePaddleTo(view.game, action.x) };
    case "launch":
      return { ...view, game: launch(view.game), message: "" };
    case "toggle-pause": {
      const game = togglePause(view.game);
      return { ...view, game, message: game.status === "paused" ? "Paused." : game.status === "playing" ? "Resumed." : view.message };
    }
    case "pause":
      return { ...view, game: pause(view.game) };
    case "restart":
      return initialView();
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export function useBrickBreaker() {
  const [best, setBest] = useGameStorage("brick-breaker", "best-score", 0);
  const [view, dispatch] = useReducer(reducer, undefined, initialView);
  const { game } = view;
  const heldRef = useRef({ left: false, right: false });

  // Animation loop: runs only while serving (so held keys can move the
  // paddle) or playing. Cleanup cancels the frame, so a status change or
  // Strict Mode's mount-cleanup-mount never leaves two loops running.
  const loopActive = game.status === "serve" || game.status === "playing";
  useEffect(() => {
    if (!loopActive) return;
    let last = performance.now();
    let id = requestAnimationFrame(function frame(now) {
      const dt = now - last;
      last = now;
      const held = heldRef.current;
      const dir = held.left === held.right ? 0 : held.left ? -1 : 1;
      dispatch({ type: "frame", dt, dir });
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  }, [loopActive]);

  // Keyboard: hold arrows/A/D to steer; Space launches, then pauses and
  // resumes; P pauses. Ignored while an editable control has focus.
  const statusRef = useRef(game.status);
  useEffect(() => {
    statusRef.current = game.status;
  }, [game.status]);
  useEffect(() => {
    const setHeld = (key: string, down: boolean) => {
      if (key === "arrowleft" || key === "a") heldRef.current.left = down;
      else if (key === "arrowright" || key === "d") heldRef.current.right = down;
      else return false;
      return true;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const key = event.key.toLowerCase();
      if (setHeld(key, true)) {
        event.preventDefault();
        return;
      }
      if (key === " ") {
        event.preventDefault();
        dispatch(statusRef.current === "serve" ? { type: "launch" } : { type: "toggle-pause" });
      } else if (key === "p") {
        event.preventDefault();
        dispatch({ type: "toggle-pause" });
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      setHeld(event.key.toLowerCase(), false);
    };
    const releaseAll = () => {
      heldRef.current = { left: false, right: false };
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
    };
  }, []);

  // Auto-pause when the tab/app is backgrounded; resuming is explicit.
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) dispatch({ type: "pause" });
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (game.score > best) setBest(game.score);
  }, [game.score, best, setBest]);

  // Snapshot of the record when this run started, so "new best" compares
  // against the old record rather than the one this run already bumped.
  const bestAtRunStartRef = useRef(best);
  const runStarted = game.status === "serve" && game.level === 1 && game.score === 0;
  useEffect(() => {
    if (runStarted) bestAtRunStartRef.current = best;
  }, [runStarted, best]);

  return {
    ...game,
    best,
    trail: view.trail,
    bursts: view.bursts,
    message: view.message,
    isNewBest: game.status === "gameOver" && game.score > bestAtRunStartRef.current,
    movePaddle: (x: number) => dispatch({ type: "paddle", x }),
    launch: () => dispatch({ type: "launch" }),
    togglePause: () => dispatch({ type: "toggle-pause" }),
    restart: () => dispatch({ type: "restart" }),
  };
}
