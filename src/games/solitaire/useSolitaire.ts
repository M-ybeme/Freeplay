import { useEffect, useReducer, useState } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import type { Card } from "../../components/PlayingCard/types";
import {
  FRESH_STOCK_SIZE,
  createInitialDeal,
  drawFromStock,
  getMovableSequence,
  isValidPersistedRun,
  isWon,
  moveFoundationToTableau,
  moveTableauToFoundation,
  moveTableauToTableau,
  moveWasteToFoundation,
  moveWasteToTableau,
  recycleWaste,
  type PersistedRun,
  type SolitaireRun,
} from "./logic";

export type Selection = { zone: "waste" } | { zone: "tableau"; pile: number; index: number } | { zone: "foundation"; suitIndex: number };

export interface GameState {
  run: SolitaireRun;
  previous: SolitaireRun | null;
}

export type Action = { type: "set-run"; run: SolitaireRun } | { type: "undo" } | { type: "new-game"; rng?: () => number } | { type: "hydrate"; run: PersistedRun };

export function reducer(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "set-run":
      return { run: action.run, previous: state.run };
    case "undo":
      return state.previous ? { run: state.previous, previous: null } : state;
    case "new-game":
      return { run: createInitialDeal(action.rng), previous: null };
    case "hydrate":
      return { run: action.run, previous: null };
  }
}

function sameSelection(a: Selection | null, b: Selection): boolean {
  if (!a) return false;
  if (a.zone !== b.zone) return false;
  if (a.zone === "tableau" && b.zone === "tableau") return a.pile === b.pile && a.index === b.index;
  if (a.zone === "foundation" && b.zone === "foundation") return a.suitIndex === b.suitIndex;
  return true;
}

/** The card(s) `target` would move if selected as a source, or null if it isn't a valid source right now. */
function movableSequenceFor(run: SolitaireRun, target: Selection): Card[] | null {
  if (target.zone === "waste") return run.waste.length > 0 ? [run.waste[run.waste.length - 1]] : null;
  if (target.zone === "foundation") {
    const pile = run.foundations[target.suitIndex];
    return pile.length > 0 ? [pile[pile.length - 1]] : null;
  }
  return getMovableSequence(run.tableau[target.pile], target.index);
}

/**
 * Attempts `from -> to`. A foundation destination is always resolved by the
 * moving card's own suit (there's only ever one correct foundation for a
 * given card), so which of the four foundation slots was actually clicked
 * doesn't matter - clicking any of them behaves identically and correctly.
 */
function tryMoveTo(run: SolitaireRun, from: Selection, to: Selection): SolitaireRun {
  if (to.zone === "tableau") {
    if (from.zone === "waste") return moveWasteToTableau(run, to.pile);
    if (from.zone === "foundation") return moveFoundationToTableau(run, from.suitIndex, to.pile);
    return moveTableauToTableau(run, from.pile, from.index, to.pile);
  }
  if (to.zone === "foundation") {
    if (from.zone === "waste") return moveWasteToFoundation(run);
    if (from.zone === "tableau") return moveTableauToFoundation(run, from.pile);
  }
  return run;
}

function hasProgress(run: SolitaireRun): boolean {
  return run.waste.length > 0 || run.stock.length < FRESH_STOCK_SIZE || run.foundations.some((pile) => pile.length > 0);
}

export function useSolitaire() {
  const [persistedRun, setPersistedRun] = useGameStorage<unknown>("solitaire", "active-run", null);
  const [state, dispatch] = useReducer(reducer, undefined, () => {
    if (isValidPersistedRun(persistedRun)) return { run: persistedRun, previous: null };
    return { run: createInitialDeal(), previous: null };
  });

  const [selected, setSelected] = useState<Selection | null>(null);
  const [pendingNewGame, setPendingNewGame] = useState(false);

  const locked = pendingNewGame;
  const won = isWon(state.run);

  useEffect(() => {
    setPersistedRun({ stock: state.run.stock, waste: state.run.waste, foundations: state.run.foundations, tableau: state.run.tableau });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.run]);

  function commit(next: SolitaireRun): boolean {
    if (next === state.run) return false;
    dispatch({ type: "set-run", run: next });
    setSelected(null);
    return true;
  }

  function stockActivate() {
    if (locked) return;
    if (state.run.stock.length > 0) commit(drawFromStock(state.run));
    else commit(recycleWaste(state.run));
  }

  // Shared by click-to-move and drag-drop: attempts from -> to, returning
  // whether it actually changed anything. An illegal attempt is a pure
  // no-op (state unchanged) - a drag's cards visually "return" simply
  // because nothing about their underlying position ever changed.
  function attemptMove(from: Selection, to: Selection): boolean {
    if (locked) return false;
    return commit(tryMoveTo(state.run, from, to));
  }

  function getSequenceFor(target: Selection): Card[] | null {
    return movableSequenceFor(state.run, target);
  }

  function activateZone(target: Selection) {
    if (locked) return;
    if (selected === null) {
      if (movableSequenceFor(state.run, target)) setSelected(target);
      return;
    }
    if (sameSelection(selected, target)) {
      setSelected(null);
      return;
    }
    if (attemptMove(selected, target)) return;
    // Illegal as a destination - if it's independently a valid source, swap
    // the selection to it rather than silently doing nothing.
    if (movableSequenceFor(state.run, target)) setSelected(target);
  }

  function autoMoveToFoundation(source: Selection) {
    if (locked) return;
    if (source.zone === "waste") commit(moveWasteToFoundation(state.run));
    else if (source.zone === "tableau") commit(moveTableauToFoundation(state.run, source.pile));
    // A foundation card auto-moving to a foundation is not a meaningful action.
  }

  function clearSelection() {
    setSelected(null);
  }

  function undo() {
    if (locked) return;
    dispatch({ type: "undo" });
    setSelected(null);
  }

  function requestNewGame() {
    if (locked) return;
    if (won || !hasProgress(state.run)) {
      dispatch({ type: "new-game" });
      setSelected(null);
      return;
    }
    setPendingNewGame(true);
  }

  function confirmNewGame() {
    dispatch({ type: "new-game" });
    setPendingNewGame(false);
    setSelected(null);
  }

  function cancelNewGame() {
    setPendingNewGame(false);
  }

  return {
    stock: state.run.stock,
    waste: state.run.waste,
    foundations: state.run.foundations,
    tableau: state.run.tableau,
    selected,
    canUndo: state.previous !== null,
    pendingNewGame,
    locked,
    won,
    stockActivate,
    activateZone,
    attemptMove,
    getSequenceFor,
    autoMoveToFoundation,
    clearSelection,
    undo,
    requestNewGame,
    confirmNewGame,
    cancelNewGame,
  };
}

export function isSelectable(run: SolitaireRun, target: Selection): boolean {
  return movableSequenceFor(run, target) !== null;
}
