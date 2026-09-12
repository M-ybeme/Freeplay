import { describe, expect, it } from "vitest";
import { SUITS, type Card } from "../../components/PlayingCard/types";
import { createInitialDeal, type SolitaireRun, type TableauCard } from "./logic";
import { reducer, type GameState } from "./useSolitaire";

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function c(rank: Card["rank"], suit: Card["suit"]): Card {
  return { rank, suit };
}

function up(card: Card): TableauCard {
  return { card, faceUp: true };
}

function emptyRun(): SolitaireRun {
  return { stock: [], waste: [], foundations: SUITS.map(() => []), tableau: Array.from({ length: 7 }, () => []) };
}

function fixedState(run: SolitaireRun = createInitialDeal(mulberry32(1)), previous: SolitaireRun | null = null): GameState {
  return { run, previous };
}

describe("reducer - set-run / undo", () => {
  it("set-run records the previous run as the undo point", () => {
    const state = fixedState();
    const nextRun = { ...state.run, waste: [state.run.stock[0]] };
    const next = reducer(state, { type: "set-run", run: nextRun });
    expect(next.run).toBe(nextRun);
    expect(next.previous).toBe(state.run);
  });

  it("undo restores the previous run and clears the undo point", () => {
    const before = createInitialDeal(mulberry32(2));
    const after = { ...before, waste: [before.stock[0]] };
    const state = fixedState(after, before);
    const next = reducer(state, { type: "undo" });
    expect(next.run).toBe(before);
    expect(next.previous).toBeNull();
  });

  it("undo is a no-op when there is no undo point", () => {
    const state = fixedState();
    const next = reducer(state, { type: "undo" });
    expect(next).toBe(state);
  });

  it("undo after a move exposing a hidden card restores it face-down again", () => {
    const before = emptyRun();
    before.tableau[0] = [{ card: c("K", "clubs"), faceUp: false }, up(c("8", "hearts"))];
    before.tableau[1] = [up(c("9", "spades"))];
    // Simulate the move having already happened via moveTableauToTableau semantics manually.
    const after: SolitaireRun = {
      ...before,
      tableau: [
        [{ card: c("K", "clubs"), faceUp: true }], // auto-flipped
        [up(c("9", "spades")), up(c("8", "hearts"))],
        ...before.tableau.slice(2),
      ],
    };
    const state = fixedState(after, before);
    const next = reducer(state, { type: "undo" });
    expect(next.run.tableau[0]).toEqual([{ card: c("K", "clubs"), faceUp: false }, up(c("8", "hearts"))]);
  });
});

describe("reducer - new-game / hydrate", () => {
  it("new-game deals a fresh run and clears the undo point", () => {
    const state = fixedState();
    const next = reducer(state, { type: "new-game", rng: mulberry32(3) });
    expect(next.run).not.toBe(state.run);
    expect(next.previous).toBeNull();
    expect(next.run.tableau.map((p) => p.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("hydrate loads the given run as-is with no undo point", () => {
    const state = fixedState();
    const run = createInitialDeal(mulberry32(4));
    const next = reducer(state, { type: "hydrate", run });
    expect(next.run).toBe(run);
    expect(next.previous).toBeNull();
  });
});
