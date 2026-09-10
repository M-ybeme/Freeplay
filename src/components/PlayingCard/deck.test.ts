import { describe, expect, it } from "vitest";
import { createDeck, shuffle } from "./deck";
import { cardKey } from "./types";

describe("createDeck", () => {
  it("produces 52 unique cards", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map(cardKey)).size).toBe(52);
  });
});

describe("shuffle", () => {
  it("preserves all 52 cards (same multiset, different order)", () => {
    const deck = createDeck();
    const shuffled = shuffle(deck, () => 0.42);
    expect(shuffled).toHaveLength(52);
    expect(new Set(shuffled.map(cardKey))).toEqual(new Set(deck.map(cardKey)));
  });

  it("does not mutate the input array", () => {
    const deck = createDeck();
    const originalFirst = deck[0];
    shuffle(deck, () => 0.9);
    expect(deck[0]).toBe(originalFirst);
  });

  it("is deterministic for a given rng", () => {
    const deck = createDeck();
    const a = shuffle(deck, () => 0.5);
    const b = shuffle(deck, () => 0.5);
    expect(a).toEqual(b);
  });

  it("actually reorders when rng varies (not a no-op)", () => {
    const deck = createDeck();
    let i = 0;
    const seq = [0.9, 0.1, 0.8, 0.2, 0.7, 0.3, 0.6, 0.4, 0.5, 0.05];
    const rng = () => seq[i++ % seq.length];
    const shuffled = shuffle(deck, rng);
    expect(shuffled).not.toEqual(deck);
  });
});
