import { describe, expect, it } from "vitest";
import { RANKS, SUITS, cardKey, cardName, isRedSuit, rankLabel, suitLabel, type Card } from "./types";

describe("suit and rank coverage", () => {
  it("can represent all 52 standard rank/suit combinations uniquely", () => {
    const cards: Card[] = [];
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ rank, suit });
      }
    }
    expect(cards).toHaveLength(52);
    const uniqueKeys = new Set(cards.map(cardKey));
    expect(uniqueKeys.size).toBe(52);
  });

  it("has exactly 4 suits and 13 ranks", () => {
    expect(SUITS).toHaveLength(4);
    expect(RANKS).toHaveLength(13);
  });
});

describe("isRedSuit", () => {
  it("classifies hearts and diamonds as red", () => {
    expect(isRedSuit("hearts")).toBe(true);
    expect(isRedSuit("diamonds")).toBe(true);
  });

  it("classifies spades and clubs as not red", () => {
    expect(isRedSuit("spades")).toBe(false);
    expect(isRedSuit("clubs")).toBe(false);
  });
});

describe("labels", () => {
  it("labels number ranks as themselves and face/ace ranks by name", () => {
    expect(rankLabel("2")).toBe("Two");
    expect(rankLabel("10")).toBe("Ten");
    expect(rankLabel("A")).toBe("Ace");
    expect(rankLabel("J")).toBe("Jack");
    expect(rankLabel("Q")).toBe("Queen");
    expect(rankLabel("K")).toBe("King");
  });

  it("capitalizes suit labels", () => {
    expect(suitLabel("spades")).toBe("Spades");
    expect(suitLabel("hearts")).toBe("Hearts");
    expect(suitLabel("diamonds")).toBe("Diamonds");
    expect(suitLabel("clubs")).toBe("Clubs");
  });

  it("builds a full accessible card name", () => {
    expect(cardName({ rank: "K", suit: "hearts" })).toBe("King of Hearts");
    expect(cardName({ rank: "A", suit: "spades" })).toBe("Ace of Spades");
    expect(cardName({ rank: "7", suit: "diamonds" })).toBe("Seven of Diamonds");
  });
});
