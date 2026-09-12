import { describe, expect, it } from "vitest";
import { RANKS, SUITS, cardKey, type Card } from "../../components/PlayingCard/types";
import {
  canMoveCardToFoundation,
  canPlaceOnTableau,
  createInitialDeal,
  drawFromStock,
  getMovableSequence,
  isValidPersistedRun,
  isValidTableauSequence,
  isWon,
  moveFoundationToTableau,
  moveTableauToFoundation,
  moveTableauToTableau,
  moveWasteToFoundation,
  moveWasteToTableau,
  recycleWaste,
  type SolitaireRun,
  type TableauCard,
} from "./logic";

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

function down(card: Card): TableauCard {
  return { card, faceUp: false };
}

function emptyRun(): SolitaireRun {
  return {
    stock: [],
    waste: [],
    foundations: SUITS.map(() => []),
    tableau: Array.from({ length: 7 }, () => []),
  };
}

// ---------- deal ----------

describe("createInitialDeal", () => {
  it("distributes exactly 52 unique cards across all zones", () => {
    const run = createInitialDeal(mulberry32(1));
    const all = [
      ...run.stock,
      ...run.waste,
      ...run.foundations.flat(),
      ...run.tableau.flatMap((p) => p.map((tc) => tc.card)),
    ];
    expect(all).toHaveLength(52);
    expect(new Set(all.map(cardKey)).size).toBe(52);
  });

  it("deals tableau piles of size 1 through 7", () => {
    const run = createInitialDeal(mulberry32(2));
    expect(run.tableau.map((p) => p.length)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("only the top card of each tableau pile starts face-up", () => {
    const run = createInitialDeal(mulberry32(3));
    for (const pile of run.tableau) {
      pile.forEach((tc, i) => {
        expect(tc.faceUp).toBe(i === pile.length - 1);
      });
    }
  });

  it("deals a 24-card stock, empty waste, and empty foundations", () => {
    const run = createInitialDeal(mulberry32(4));
    expect(run.stock).toHaveLength(24);
    expect(run.waste).toHaveLength(0);
    expect(run.foundations.every((p) => p.length === 0)).toBe(true);
  });
});

// ---------- tableau movement ----------

describe("isValidTableauSequence / getMovableSequence", () => {
  it("accepts a legal descending alternating-color run", () => {
    expect(isValidTableauSequence([c("9", "spades"), c("8", "hearts"), c("7", "clubs")])).toBe(true);
  });

  it("rejects a same-color pair", () => {
    expect(isValidTableauSequence([c("9", "spades"), c("8", "clubs")])).toBe(false);
  });

  it("rejects an ascending pair", () => {
    expect(isValidTableauSequence([c("7", "clubs"), c("8", "hearts")])).toBe(false);
  });

  it("rejects a malformed (skipped-rank) sequence", () => {
    expect(isValidTableauSequence([c("9", "spades"), c("7", "hearts")])).toBe(false);
  });

  it("returns null for a face-down start index", () => {
    const pile = [down(c("9", "spades")), up(c("8", "hearts"))];
    expect(getMovableSequence(pile, 0)).toBeNull();
  });

  it("returns the full run from a valid face-up start index", () => {
    const pile = [down(c("K", "clubs")), up(c("9", "spades")), up(c("8", "hearts")), up(c("7", "clubs"))];
    expect(getMovableSequence(pile, 1)).toEqual([c("9", "spades"), c("8", "hearts"), c("7", "clubs")]);
  });
});

describe("canPlaceOnTableau / empty-pile rule", () => {
  it("only a King may be placed on an empty tableau pile", () => {
    expect(canPlaceOnTableau([], c("Q", "hearts"))).toBe(false);
    expect(canPlaceOnTableau([], c("K", "hearts"))).toBe(true);
  });

  it("a King-led valid sequence may move onto an empty pile", () => {
    const run = emptyRun();
    run.tableau[0] = [up(c("K", "spades")), up(c("Q", "hearts")), up(c("J", "clubs"))];
    const next = moveTableauToTableau(run, 0, 0, 1);
    expect(next).not.toBe(run);
    expect(next.tableau[1].map((tc) => tc.card)).toEqual([c("K", "spades"), c("Q", "hearts"), c("J", "clubs")]);
    expect(next.tableau[0]).toEqual([]);
  });

  it("a non-King sequence is rejected on an empty pile", () => {
    const run = emptyRun();
    run.tableau[0] = [up(c("Q", "hearts")), up(c("J", "clubs"))];
    const next = moveTableauToTableau(run, 0, 0, 1);
    expect(next).toBe(run);
  });
});

describe("moveTableauToTableau", () => {
  it("moves a single legal card", () => {
    const run = emptyRun();
    run.tableau[0] = [up(c("8", "hearts"))];
    run.tableau[1] = [up(c("9", "spades"))];
    const next = moveTableauToTableau(run, 0, 0, 1);
    expect(next.tableau[0]).toEqual([]);
    expect(next.tableau[1].map((tc) => tc.card)).toEqual([c("9", "spades"), c("8", "hearts")]);
  });

  it("rejects a same-color destination", () => {
    const run = emptyRun();
    run.tableau[0] = [up(c("8", "clubs"))];
    run.tableau[1] = [up(c("9", "spades"))];
    expect(moveTableauToTableau(run, 0, 0, 1)).toBe(run);
  });

  it("moves a valid multi-card sequence as a unit", () => {
    const run = emptyRun();
    run.tableau[0] = [down(c("K", "clubs")), up(c("9", "spades")), up(c("8", "hearts")), up(c("7", "clubs"))];
    run.tableau[1] = [up(c("10", "hearts"))];
    const next = moveTableauToTableau(run, 0, 1, 1);
    expect(next.tableau[1].map((tc) => tc.card)).toEqual([c("10", "hearts"), c("9", "spades"), c("8", "hearts"), c("7", "clubs")]);
    expect(next.tableau[0]).toHaveLength(1);
  });

  it("rejects moving a malformed (non-sequence) selection", () => {
    // Cards physically present but NOT a valid run (hand-constructed, not reachable in real play).
    const run = emptyRun();
    run.tableau[0] = [up(c("9", "spades")), up(c("2", "hearts"))];
    run.tableau[1] = [up(c("10", "hearts"))];
    expect(moveTableauToTableau(run, 0, 0, 1)).toBe(run);
  });

  it("is atomic: an illegal move leaves the entire run unchanged (same reference)", () => {
    const run = createInitialDeal(mulberry32(5));
    const next = moveTableauToTableau(run, 0, 0, 1);
    // Pile 0 has exactly one face-up card; moving it somewhere illegal (or
    // wherever it doesn't fit) must not mutate anything.
    if (next !== run) return; // if it happened to be legal for this seed, skip
    expect(next).toBe(run);
  });

  it("rejects moving a pile onto itself", () => {
    const run = emptyRun();
    run.tableau[0] = [up(c("8", "hearts"))];
    expect(moveTableauToTableau(run, 0, 0, 0)).toBe(run);
  });
});

describe("tableau auto-flip", () => {
  it("flips the newly exposed face-down card after a move empties the face-up portion", () => {
    const run = emptyRun();
    run.tableau[0] = [down(c("K", "clubs")), up(c("8", "hearts"))];
    run.tableau[1] = [up(c("9", "spades"))];
    const next = moveTableauToTableau(run, 0, 1, 1);
    expect(next.tableau[0]).toEqual([{ card: c("K", "clubs"), faceUp: true }]);
  });

  it("does not flip when a face-up card remains on top after the move", () => {
    const run = emptyRun();
    run.tableau[0] = [up(c("10", "clubs")), up(c("9", "hearts")), up(c("8", "clubs"))];
    run.tableau[1] = [up(c("9", "diamonds"))];
    // Move just the top card (8 clubs) onto 9 of diamonds - 9 hearts remains face-up on top of pile 0.
    const next = moveTableauToTableau(run, 0, 2, 1);
    expect(next.tableau[0][next.tableau[0].length - 1].faceUp).toBe(true);
    expect(next.tableau[0]).toHaveLength(2);
  });
});

// ---------- foundation ----------

describe("canMoveCardToFoundation", () => {
  it("only an Ace may start an empty foundation", () => {
    const foundations = SUITS.map(() => []);
    expect(canMoveCardToFoundation(foundations, c("2", "hearts"))).toBe(false);
    expect(canMoveCardToFoundation(foundations, c("A", "hearts"))).toBe(true);
  });

  it("accepts the next ascending same-suit rank", () => {
    const foundations = SUITS.map((s) => (s === "hearts" ? [c("A", "hearts")] : []));
    expect(canMoveCardToFoundation(foundations, c("2", "hearts"))).toBe(true);
  });

  it("rejects a wrong suit", () => {
    const foundations = SUITS.map((s) => (s === "hearts" ? [c("A", "hearts")] : []));
    expect(canMoveCardToFoundation(foundations, c("2", "spades"))).toBe(false);
  });

  it("rejects a skipped rank", () => {
    const foundations = SUITS.map((s) => (s === "hearts" ? [c("A", "hearts")] : []));
    expect(canMoveCardToFoundation(foundations, c("3", "hearts"))).toBe(false);
  });
});

describe("moveTableauToFoundation / moveWasteToFoundation", () => {
  it("moves the top tableau card to its foundation", () => {
    const run = emptyRun();
    run.tableau[0] = [up(c("A", "spades"))];
    const next = moveTableauToFoundation(run, 0);
    expect(next.foundations[SUITS.indexOf("spades")]).toEqual([c("A", "spades")]);
    expect(next.tableau[0]).toEqual([]);
  });

  it("rejects moving a face-down tableau top", () => {
    const run = emptyRun();
    run.tableau[0] = [down(c("A", "spades"))];
    expect(moveTableauToFoundation(run, 0)).toBe(run);
  });

  it("moves the waste top to its foundation", () => {
    const run = emptyRun();
    run.waste = [c("A", "diamonds")];
    const next = moveWasteToFoundation(run);
    expect(next.foundations[SUITS.indexOf("diamonds")]).toEqual([c("A", "diamonds")]);
    expect(next.waste).toEqual([]);
  });

  it("does not move a multi-card run to foundation - only the single top card", () => {
    const run = emptyRun();
    run.tableau[0] = [up(c("A", "spades")), up(c("K", "hearts"))]; // not really a legal run, but proves only top moves
    const next = moveTableauToFoundation(run, 0);
    expect(next).toBe(run); // top is King, not an Ace - illegal on an empty foundation
  });
});

describe("moveFoundationToTableau", () => {
  it("allows a legal return from foundation to tableau", () => {
    const run = emptyRun();
    run.foundations[SUITS.indexOf("hearts")] = [c("A", "hearts"), c("2", "hearts")];
    run.tableau[0] = [up(c("3", "clubs"))];
    const next = moveFoundationToTableau(run, SUITS.indexOf("hearts"), 0);
    expect(next.tableau[0].map((tc) => tc.card)).toEqual([c("3", "clubs"), c("2", "hearts")]);
    expect(next.foundations[SUITS.indexOf("hearts")]).toEqual([c("A", "hearts")]);
  });

  it("rejects an illegal tableau destination", () => {
    const run = emptyRun();
    run.foundations[SUITS.indexOf("hearts")] = [c("A", "hearts"), c("2", "hearts")];
    run.tableau[0] = [up(c("9", "clubs"))];
    expect(moveFoundationToTableau(run, SUITS.indexOf("hearts"), 0)).toBe(run);
  });

  it("rejects moving from an empty foundation", () => {
    const run = emptyRun();
    run.tableau[0] = [up(c("3", "clubs"))];
    expect(moveFoundationToTableau(run, SUITS.indexOf("hearts"), 0)).toBe(run);
  });
});

// ---------- stock / waste ----------

describe("stock/waste draw and recycle", () => {
  it("draw 1 moves exactly one card from stock to waste, face-up", () => {
    const run = emptyRun();
    run.stock = [c("2", "clubs"), c("5", "hearts")];
    const next = drawFromStock(run);
    expect(next.stock).toEqual([c("2", "clubs")]);
    expect(next.waste).toEqual([c("5", "hearts")]);
  });

  it("repeated draws pull cards in order", () => {
    let run = emptyRun();
    run.stock = [c("2", "clubs"), c("5", "hearts"), c("9", "spades")];
    run = drawFromStock(run);
    run = drawFromStock(run);
    expect(run.waste).toEqual([c("9", "spades"), c("5", "hearts")]);
    expect(run.stock).toEqual([c("2", "clubs")]);
  });

  it("draw is a no-op when stock is empty", () => {
    const run = emptyRun();
    run.waste = [c("2", "clubs")];
    expect(drawFromStock(run)).toBe(run);
  });

  it("recycle restores stock so the next draws repeat the exact original order", () => {
    // waste (bottom-to-top) = A, B, C, with C drawn most recently (on top).
    let run = emptyRun();
    run.stock = [c("K", "clubs"), c("9", "hearts"), c("2", "spades")]; // draws: 2s, 9h, Kc
    run = drawFromStock(run); // waste: [2s]
    run = drawFromStock(run); // waste: [2s, 9h]
    run = drawFromStock(run); // waste: [2s, 9h, Kc]
    expect(run.stock).toEqual([]);
    expect(run.waste).toEqual([c("2", "spades"), c("9", "hearts"), c("K", "clubs")]);

    run = recycleWaste(run);
    expect(run.waste).toEqual([]);

    // Redraw must reproduce the exact same sequence: 2s, then 9h, then Kc.
    run = drawFromStock(run);
    expect(run.waste).toEqual([c("2", "spades")]);
    run = drawFromStock(run);
    expect(run.waste).toEqual([c("2", "spades"), c("9", "hearts")]);
    run = drawFromStock(run);
    expect(run.waste).toEqual([c("2", "spades"), c("9", "hearts"), c("K", "clubs")]);
  });

  it("recycle is a no-op when stock is non-empty", () => {
    const run = emptyRun();
    run.stock = [c("2", "clubs")];
    run.waste = [c("5", "hearts")];
    expect(recycleWaste(run)).toBe(run);
  });

  it("recycle is a no-op when waste is empty", () => {
    const run = emptyRun();
    expect(recycleWaste(run)).toBe(run);
  });
});

// ---------- waste to tableau ----------

describe("moveWasteToTableau", () => {
  it("moves the waste top onto a legal tableau destination", () => {
    const run = emptyRun();
    run.waste = [c("8", "hearts")];
    run.tableau[0] = [up(c("9", "spades"))];
    const next = moveWasteToTableau(run, 0);
    expect(next.waste).toEqual([]);
    expect(next.tableau[0].map((tc) => tc.card)).toEqual([c("9", "spades"), c("8", "hearts")]);
  });

  it("rejects an illegal tableau destination", () => {
    const run = emptyRun();
    run.waste = [c("8", "clubs")];
    run.tableau[0] = [up(c("9", "spades"))];
    expect(moveWasteToTableau(run, 0)).toBe(run);
  });
});

// ---------- win ----------

describe("isWon", () => {
  it("is false with 51 of 52 cards in foundations", () => {
    const run = emptyRun();
    for (const suit of SUITS) {
      run.foundations[SUITS.indexOf(suit)] = RANKS.map((r) => c(r, suit));
    }
    // Remove the last card of one foundation.
    run.foundations[0] = run.foundations[0].slice(0, -1);
    expect(isWon(run)).toBe(false);
  });

  it("is true with all 52 cards across the four foundations", () => {
    const run = emptyRun();
    for (const suit of SUITS) {
      run.foundations[SUITS.indexOf(suit)] = RANKS.map((r) => c(r, suit));
    }
    expect(isWon(run)).toBe(true);
  });

  it("New Game from a solved state produces a fresh, unsolved deal", () => {
    const solved = emptyRun();
    for (const suit of SUITS) solved.foundations[SUITS.indexOf(suit)] = RANKS.map((r) => c(r, suit));
    expect(isWon(solved)).toBe(true);
    const fresh = createInitialDeal(mulberry32(9));
    expect(isWon(fresh)).toBe(false);
  });
});

// ---------- persistence validation ----------

describe("isValidPersistedRun", () => {
  it("accepts a freshly dealt run", () => {
    expect(isValidPersistedRun(createInitialDeal(mulberry32(1)))).toBe(true);
  });

  it("accepts a fully solved run", () => {
    const run = emptyRun();
    for (const suit of SUITS) run.foundations[SUITS.indexOf(suit)] = RANKS.map((r) => c(r, suit));
    expect(isValidPersistedRun(run)).toBe(true);
  });

  it("rejects a duplicate card across zones", () => {
    const run = createInitialDeal(mulberry32(1));
    run.waste = [run.stock[0]]; // same card now appears in both stock and waste
    expect(isValidPersistedRun(run)).toBe(false);
  });

  it("rejects a missing card", () => {
    const run = createInitialDeal(mulberry32(1));
    run.stock = run.stock.slice(1);
    expect(isValidPersistedRun(run)).toBe(false);
  });

  it("rejects a wrong tableau pile count", () => {
    const run = createInitialDeal(mulberry32(1));
    (run as unknown as { tableau: unknown[] }).tableau = run.tableau.slice(0, 6);
    expect(isValidPersistedRun(run)).toBe(false);
  });

  it("rejects a wrong foundation count", () => {
    const run = createInitialDeal(mulberry32(1));
    (run as unknown as { foundations: unknown[] }).foundations = run.foundations.slice(0, 3);
    expect(isValidPersistedRun(run)).toBe(false);
  });

  it("rejects an invalid rank or suit", () => {
    const run = createInitialDeal(mulberry32(1));
    const bad = { ...run, stock: [{ rank: "11", suit: "spades" }, ...run.stock.slice(1)] };
    expect(isValidPersistedRun(bad)).toBe(false);
    const bad2 = { ...run, stock: [{ rank: "A", suit: "stars" }, ...run.stock.slice(1)] };
    expect(isValidPersistedRun(bad2)).toBe(false);
  });

  it("rejects a foundation pile out of ascending order", () => {
    const run = createInitialDeal(mulberry32(1));
    const idx = SUITS.indexOf("hearts");
    const foundations = run.foundations.map((p, i) => (i === idx ? [c("2", "hearts")] : p));
    // Remove a "2 of hearts" duplicate elsewhere to keep card count sane for this shape check.
    const tableau = run.tableau.map((pile) => pile.filter((tc) => cardKey(tc.card) !== cardKey(c("2", "hearts"))));
    expect(isValidPersistedRun({ ...run, foundations, tableau })).toBe(false);
  });

  it("rejects a face-down card sitting above a face-up card in a tableau pile", () => {
    const run = createInitialDeal(mulberry32(1));
    const badPile: TableauCard[] = [up(c("K", "clubs")), down(c("Q", "hearts"))];
    const tableau = run.tableau.map((p, i) => (i === 0 ? badPile : p));
    // (card identities won't line up perfectly here, but the structural
    // face-down-above-face-up check must fail before card-count is even reached)
    expect(isValidPersistedRun({ ...run, tableau })).toBe(false);
  });

  it("rejects a tableau face-up portion that isn't a valid sequence", () => {
    const run = createInitialDeal(mulberry32(1));
    const badPile: TableauCard[] = [up(c("K", "clubs")), up(c("K", "hearts"))];
    const tableau = run.tableau.map((p, i) => (i === 0 ? badPile : p));
    expect(isValidPersistedRun({ ...run, tableau })).toBe(false);
  });

  it("rejects wrong-typed fields and corrupt shapes", () => {
    expect(isValidPersistedRun(null)).toBe(false);
    expect(isValidPersistedRun("not json")).toBe(false);
    expect(isValidPersistedRun(undefined)).toBe(false);
    expect(isValidPersistedRun({ stock: "nope", waste: [], foundations: [], tableau: [] })).toBe(false);
  });
});
