import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../../components/PlayingCard/types";
import {
  applyBid,
  applyPlay,
  beats,
  collectTrick,
  dealHand,
  finishHand,
  isSavedMatch,
  legalCards,
  matchOutcome,
  newMatch,
  nextHand,
  scoreTeam,
  shuffledDeck,
  sortHand,
  winningPlay,
  type Bid,
  type HandState,
  type Play,
  type Seat,
} from "./logic";

const SUIT: Record<string, Suit> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
/** "AS" -> ace of spades, "10H" -> ten of hearts. */
function c(code: string): Card {
  return { rank: code.slice(0, -1) as Rank, suit: SUIT[code.slice(-1)] };
}
function cards(codes: string): Card[] {
  return codes.split(" ").map(c);
}
function play(seat: Seat, code: string): Play {
  return { seat, card: c(code) };
}

function seeded(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A hand in the playing phase with the given cards and bids. */
function playingHand(hands: string[], bids: Bid[] = [3, 3, 3, 3], turn: Seat = 0, spadesBroken = false): HandState {
  return {
    dealer: 3,
    hands: hands.map(cards),
    bids,
    tricksWon: [0, 0, 0, 0],
    trick: [],
    played: [],
    turn,
    spadesBroken,
    phase: "playing",
    trickWinner: null,
  };
}

/** A finished hand for scoring. */
function finished(bids: Bid[], tricksWon: number[]): HandState {
  return { ...dealHand(3, shuffledDeck(seeded(1))), bids, tricksWon, hands: [[], [], [], []], phase: "hand-over" };
}

describe("dealing", () => {
  it("deals 13 sorted cards to each seat from one full deck", () => {
    const hand = dealHand(3, shuffledDeck(seeded(7)));
    expect(hand.hands.map((h) => h.length)).toEqual([13, 13, 13, 13]);
    const all = hand.hands.flat().map((x) => x.rank + x.suit);
    expect(new Set(all).size).toBe(52);
    for (const h of hand.hands) expect(h).toEqual(sortHand(h));
  });

  it("starts bidding left of the dealer", () => {
    expect(dealHand(3, shuffledDeck()).turn).toBe(0);
    expect(dealHand(0, shuffledDeck()).turn).toBe(1);
  });

  it("sorts spades, hearts, clubs, diamonds, low to high", () => {
    expect(sortHand(cards("AD 2S KH 3C AS 10H"))).toEqual(cards("2S AS 10H KH 3C AD"));
  });
});

describe("bidding", () => {
  it("takes bids in turn and moves to play after four", () => {
    let h = dealHand(3, shuffledDeck(seeded(2)));
    h = applyBid(h, 0, 4);
    h = applyBid(h, 1, "nil");
    h = applyBid(h, 2, 3);
    expect(h.phase).toBe("bidding");
    h = applyBid(h, 3, 2);
    expect(h.phase).toBe("playing");
    expect(h.bids).toEqual([4, "nil", 3, 2]);
    expect(h.turn).toBe(0);
  });

  it("ignores out-of-turn and invalid bids", () => {
    const h = dealHand(3, shuffledDeck(seeded(2)));
    expect(applyBid(h, 1, 3)).toBe(h);
    expect(applyBid(h, 0, 0)).toBe(h);
    expect(applyBid(h, 0, 14)).toBe(h);
    expect(applyBid(h, 0, 2.5)).toBe(h);
  });
});

describe("legal plays", () => {
  it("must follow the suit led", () => {
    expect(legalCards(cards("2H 9H 3S KD"), [play(1, "5H")], true)).toEqual(cards("2H 9H"));
  });

  it("may play anything when void in the suit led", () => {
    expect(legalCards(cards("3S KD"), [play(1, "5H")], false)).toEqual(cards("3S KD"));
  });

  it("can't lead spades until they're broken", () => {
    expect(legalCards(cards("2H 3S KD"), [], false)).toEqual(cards("2H KD"));
    expect(legalCards(cards("2H 3S KD"), [], true)).toEqual(cards("2H 3S KD"));
  });

  it("may lead spades with nothing else", () => {
    expect(legalCards(cards("3S QS"), [], false)).toEqual(cards("3S QS"));
  });
});

describe("tricks", () => {
  it("highest of the suit led wins without spades", () => {
    expect(winningPlay([play(0, "5H"), play(1, "KH"), play(2, "AD"), play(3, "9H")]).seat).toBe(1);
  });

  it("any spade beats the suit led, highest spade wins", () => {
    expect(winningPlay([play(0, "AH"), play(1, "2S"), play(2, "KH"), play(3, "5S")]).seat).toBe(3);
  });

  it("off-suit discards never win", () => {
    expect(beats(c("AD"), c("2H"), "hearts")).toBe(false);
  });

  it("plays a trick through to its winner, who leads next", () => {
    let h = playingHand(["5H 2C", "KH 3C", "AH 4C", "2S 5C"]);
    h = applyPlay(h, 0, c("5H"));
    h = applyPlay(h, 1, c("KH"));
    h = applyPlay(h, 2, c("AH"));
    expect(h.phase).toBe("playing");
    h = applyPlay(h, 3, c("2S"));
    expect(h.phase).toBe("trick-complete");
    expect(h.trickWinner).toBe(3);
    expect(h.spadesBroken).toBe(true);
    h = collectTrick(h);
    expect(h.tricksWon).toEqual([0, 0, 0, 1]);
    expect(h.turn).toBe(3);
    expect(h.trick).toEqual([]);
    expect(h.phase).toBe("playing");
  });

  it("rejects an illegal or out-of-turn card", () => {
    const h = playingHand(["5H 2C", "KH 3C", "AH 4C", "2S 5C"]);
    expect(applyPlay(h, 1, c("KH"))).toBe(h);
    const led = applyPlay(h, 0, c("5H"));
    expect(applyPlay(led, 1, c("3C"))).toBe(led);
  });

  it("ends the hand after the last trick", () => {
    let h = playingHand(["5H", "KH", "AH", "9H"]);
    for (const [s, x] of [[0, "5H"], [1, "KH"], [2, "AH"], [3, "9H"]] as const) h = applyPlay(h, s, c(x));
    h = collectTrick(h);
    expect(h.phase).toBe("hand-over");
    expect(h.tricksWon[2]).toBe(1);
  });
});

describe("scoring", () => {
  const zero = { score: 0, bags: 0 };

  it("makes the contract: 10 a trick plus 1 a bag", () => {
    const { result, after } = scoreTeam(finished([3, 1, 2, 1], [4, 2, 2, 5]), 0, zero);
    expect(result).toMatchObject({ bid: 5, tricks: 6, points: 51, bagsAdded: 1 });
    expect(after).toEqual({ score: 51, bags: 1 });
  });

  it("misses the contract: minus 10 a trick", () => {
    const { after } = scoreTeam(finished([4, 1, 3, 1], [3, 5, 2, 3]), 0, zero);
    expect(after).toEqual({ score: -70, bags: 0 });
  });

  it("nil made scores 100 and the partner carries the contract", () => {
    const { result, after } = scoreTeam(finished(["nil", 4, 4, 4], [0, 4, 5, 4]), 0, zero);
    expect(result.nils).toEqual([true]);
    expect(after).toEqual({ score: 100 + 40 + 1, bags: 1 });
  });

  it("nil failed costs 100, and its tricks are bags, not the partner's", () => {
    const { result, after } = scoreTeam(finished(["nil", 4, 4, 4], [2, 4, 3, 4]), 0, zero);
    expect(result.nils).toEqual([false]);
    // Partner bid 4, took 3: -40. Nil -100. Two nil tricks are bags: +2.
    expect(after).toEqual({ score: -100 - 40 + 2, bags: 2 });
  });

  it("every 10 bags costs 100", () => {
    const { result, after } = scoreTeam(finished([1, 1, 1, 1], [5, 1, 5, 2]), 0, { score: 200, bags: 9 });
    // Bid 2, took 10: +20 +8 bags. 17 bags -> one penalty, 7 left.
    expect(result.bagPenalty).toBe(true);
    expect(after).toEqual({ score: 200 + 28 - 100, bags: 7 });
  });

  it("two nil bidders: every trick is a bag", () => {
    const { after } = scoreTeam(finished(["nil", 5, "nil", 5], [0, 6, 1, 6]), 0, zero);
    expect(after).toEqual({ score: 100 - 100 + 1, bags: 1 });
  });
});

describe("match", () => {
  it("is won at the target and lost at -200", () => {
    expect(matchOutcome([{ score: 500, bags: 0 }, { score: 300, bags: 0 }], 500)).toBe("won");
    expect(matchOutcome([{ score: 120, bags: 0 }, { score: 260, bags: 0 }], 250)).toBe("lost");
    expect(matchOutcome([{ score: -200, bags: 0 }, { score: 10, bags: 0 }], 500)).toBe("lost");
    expect(matchOutcome([{ score: 100, bags: 0 }, { score: -210, bags: 0 }], 500)).toBe("won");
    expect(matchOutcome([{ score: 499, bags: 0 }, { score: 0, bags: 0 }], 500)).toBe("playing");
  });

  it("higher score wins when both pass the target; a tie plays on", () => {
    expect(matchOutcome([{ score: 510, bags: 0 }, { score: 530, bags: 0 }], 500)).toBe("lost");
    expect(matchOutcome([{ score: 510, bags: 0 }, { score: 510, bags: 0 }], 500)).toBe("playing");
  });

  it("scores a finished hand once, then deals the next with the deal moved left", () => {
    let m = newMatch(500, shuffledDeck(seeded(3)));
    m = { ...m, hand: finished([3, 3, 3, 3], [3, 3, 4, 3]) };
    m = finishHand(m);
    expect(m.scores[0].score).toBe(61);
    expect(finishHand(m)).toBe(m);
    const next = nextHand(m, shuffledDeck(seeded(4)));
    expect(next.handNumber).toBe(2);
    expect(next.hand.dealer).toBe(0);
    expect(next.hand.turn).toBe(1);
    expect(next.lastResult).toBeNull();
  });

  it("recognises a saved match and rejects a broken one", () => {
    const m = newMatch(250, shuffledDeck(seeded(5)));
    expect(isSavedMatch(JSON.parse(JSON.stringify(m)))).toBe(true);
    expect(isSavedMatch({ ...m, version: 2 })).toBe(false);
    expect(isSavedMatch({ ...m, hand: { ...m.hand, hands: [[], [], [], []] } })).toBe(false);
    expect(isSavedMatch(null)).toBe(false);
  });
});
