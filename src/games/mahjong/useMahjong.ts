import { useEffect, useMemo, useReducer } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import {
  LAYOUTS,
  availablePairs,
  deal,
  faceName,
  freeIds,
  isStuck,
  isWon,
  selectTile,
  shuffleRemaining,
  undo,
  type GameState,
  type Tile,
} from "./logic";

/** How long a matched pair stays on screen while it fades out. */
const REMOVE_MS = 280;

interface ViewState {
  game: GameState;
  /** A pair the player asked to be shown. Cleared by the next move. */
  hint: [number, number] | null;
  /** The last blocked tile tapped; nonce re-triggers its shake. */
  blocked: { id: number; nonce: number } | null;
  /** Tiles just matched, rendered briefly as they fade out. */
  removing: Tile[];
  /** Play time in ms; starts on the first tap. */
  elapsed: number;
  started: boolean;
  /** Set when a shuffle couldn't find any winnable arrangement. */
  unrescuable: boolean;
  /** Whether this clear beat the layout's record; null until cleared. */
  newBest: boolean | null;
  message: string;
}

type Action =
  | { type: "select"; id: number }
  | { type: "undo" }
  | { type: "shuffle" }
  | { type: "hint" }
  | { type: "deal"; layoutId: string }
  | { type: "tick"; ms: number }
  | { type: "removed" }
  | { type: "result"; newBest: boolean };

function fresh(layoutId: string): ViewState {
  return {
    game: deal(layoutId, Math.random),
    hint: null,
    blocked: null,
    removing: [],
    elapsed: 0,
    started: false,
    unrescuable: false,
    newBest: null,
    message: "",
  };
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function afterMove(view: ViewState, game: GameState): string {
  if (isWon(game)) return `Board cleared in ${formatTime(view.elapsed)}.`;
  if (isStuck(game)) return `Pair cleared. No moves left - shuffle to continue.`;
  return `Pair cleared. ${game.tiles.length} tiles left.`;
}

function reducer(view: ViewState, action: Action): ViewState {
  switch (action.type) {
    case "select": {
      if (isWon(view.game)) return view;
      const { state: game, result } = selectTile(view.game, action.id);
      const tile = view.game.tiles.find((t) => t.id === action.id);
      const base = { ...view, game, started: true, hint: result === "blocked" ? view.hint : null };
      switch (result) {
        case "blocked":
          return {
            ...base,
            blocked: { id: action.id, nonce: (view.blocked?.nonce ?? 0) + 1 },
            message: tile ? `${faceName(tile.faceId)} is blocked.` : view.message,
          };
        case "matched": {
          const gone = view.game.tiles.filter((t) => !game.tiles.includes(t));
          return { ...base, removing: [...view.removing, ...gone], message: afterMove(view, game) };
        }
        case "selected":
        case "switched":
          return { ...base, message: tile ? `${faceName(tile.faceId)} selected.` : view.message };
        case "deselected":
          return { ...base, message: "Selection cleared." };
      }
      return base;
    }
    case "undo": {
      const game = undo(view.game);
      if (game === view.game) return view;
      return { ...view, game, hint: null, unrescuable: false, message: `Undone. ${game.tiles.length} tiles left.` };
    }
    case "shuffle": {
      if (isWon(view.game)) return view;
      const game = shuffleRemaining(view.game, Math.random);
      if (!game) return { ...view, unrescuable: true, message: "These tiles can't be cleared in any order. Start a new deal." };
      return { ...view, game, hint: null, started: true, message: "Tiles shuffled." };
    }
    case "hint": {
      const pairs = availablePairs(view.game.tiles);
      if (pairs.length === 0) return { ...view, message: "No moves left - shuffle to continue." };
      const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
      return {
        ...view,
        hint: [a.id, b.id],
        game: { ...view.game, selectedId: null },
        message: `Try ${faceName(a.faceId)} with ${faceName(b.faceId)}.`,
      };
    }
    case "deal":
      return { ...fresh(action.layoutId), message: "New deal." };
    case "tick":
      return view.started && !isWon(view.game) ? { ...view, elapsed: view.elapsed + action.ms } : view;
    case "removed":
      return view.removing.length ? { ...view, removing: [] } : view;
    case "result":
      return view.newBest === null ? { ...view, newBest: action.newBest } : view;
  }
}

export function useMahjong() {
  const [layoutId, setLayoutId] = useGameStorage("mahjong", "layout", LAYOUTS[0].id);
  const [bestTimes, setBestTimes] = useGameStorage<Record<string, number>>("mahjong", "best-times", {});
  const [showFree, setShowFree] = useGameStorage("mahjong", "show-free", false);
  const [view, dispatch] = useReducer(reducer, layoutId, fresh);
  const { game } = view;

  const won = isWon(game);
  const stuck = isStuck(game);
  const free = useMemo(() => freeIds(game.tiles), [game.tiles]);

  // Clock: counts only while a started, unfinished board is on a visible
  // tab. One interval at a time; cleanup on every change and on unmount.
  const running = view.started && !won;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      if (!document.hidden) dispatch({ type: "tick", ms: 1000 });
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);

  // Matched tiles fade out, then leave the DOM.
  const removingCount = view.removing.length;
  useEffect(() => {
    if (removingCount === 0) return;
    const id = window.setTimeout(() => dispatch({ type: "removed" }), REMOVE_MS);
    return () => window.clearTimeout(id);
  }, [removingCount]);

  // Best time per layout. Judged once, the moment the board is cleared,
  // against the record as it stood then; the reducer keeps the first
  // verdict, so the effect re-running after the record updates is harmless.
  const newBest = view.newBest;
  useEffect(() => {
    if (!won || newBest !== null) return;
    const prev = bestTimes[game.layoutId];
    const beat = prev === undefined || view.elapsed < prev;
    dispatch({ type: "result", newBest: beat });
    if (beat) setBestTimes({ ...bestTimes, [game.layoutId]: view.elapsed });
  }, [won, newBest, view.elapsed, bestTimes, game.layoutId, setBestTimes]);

  return {
    tiles: game.tiles,
    layoutId: game.layoutId,
    selectedId: game.selectedId,
    matched: game.matched,
    canUndo: game.history.length > 0,
    free,
    won,
    stuck,
    hint: view.hint,
    blocked: view.blocked,
    removing: view.removing,
    unrescuable: view.unrescuable,
    message: view.message,
    elapsed: view.elapsed,
    started: view.started,
    best: bestTimes[game.layoutId],
    isNewBest: won && view.newBest === true,
    showFree,
    setShowFree,
    select: (id: number) => dispatch({ type: "select", id }),
    undo: () => dispatch({ type: "undo" }),
    shuffle: () => dispatch({ type: "shuffle" }),
    showHint: () => dispatch({ type: "hint" }),
    newDeal: (nextLayout: string = game.layoutId) => {
      if (nextLayout !== layoutId) setLayoutId(nextLayout);
      dispatch({ type: "deal", layoutId: nextLayout });
    },
  };
}

export { formatTime };
