import { describe, expect, it } from "vitest";
import type { Card, Rank, Suit } from "../../components/PlayingCard/types";
import { chooseBid, choosePlay, estimateTricks, looksNil } from "./ai";
import {
  applyBid,
  applyPlay,
  collectTrick,
  finishHand,
  isLegalPlay,
  newMatch,
  nextHand,
  shuffledDeck,
  type Bid,
  type HandState,
  type MatchState,
  type Seat,
} from "./logic";

const SUIT: Record<string, Suit> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };
function cards(codes: string): Card[] {
  return codes.split(" ").map((code) => ({ rank: code.slice(0, -1) as Rank, suit: SUIT[code.slice(-1)] }));
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

/**
 * A hand mid-play. Each card in `trick` is added to its player's hand
 * before being played, so the fixture only lists what's left to choose from.
 */
function playingHand(hands: string[], bids: Bid[], trick: [Seat, string][] = [], turn?: Seat): HandState {
  const held = hands.map((codes) => (codes ? cards(codes) : []));
  for (const [s, code] of trick) held[s] = [...held[s], ...cards(code)];
  let h: HandState = {
    dealer: 3,
    hands: held,
    bids,
    tricksWon: [0, 0, 0, 0],
    trick: [],
    played: [],
    turn: trick.length ? trick[0][0] : (turn ?? 0),
    spadesBroken: true,
    phase: "playing",
    trickWinner: null,
  };
  for (const [s, code] of trick) h = applyPlay(h, s, cards(code)[0]);
  return h;
}

/** Four computer players play a whole match; returns it and the number of hands. */
function botMatch(seed: number): { match: MatchState; hands: number } {
  const rng = seeded(seed);
  let m = newMatch(500, shuffledDeck(rng));
  for (let guard = 0; guard < 200 && m.status === "playing"; guard++) {
    let h = m.hand;
    while (h.phase === "bidding") h = applyBid(h, h.turn, chooseBid(h, h.turn));
    while (h.phase !== "hand-over") {
      if (h.phase === "trick-complete") {
        h = collectTrick(h);
        continue;
      }
      const card = choosePlay(h, h.turn);
      if (!isLegalPlay(h, h.turn, card)) throw new Error(`illegal play by ${h.turn}`);
      h = applyPlay(h, h.turn, card);
    }
    m = finishHand({ ...m, hand: h });
    if (m.status === "playing") m = nextHand(m, shuffledDeck(rng));
  }
  return { match: m, hands: m.handNumber };
}

describe("bidding", () => {
  it("counts high spades, aces and long spades", () => {
    expect(estimateTricks(cards("AS KS QS JS 10S 9S AH AC AD 2H 3H 4C 5D"))).toBeGreaterThanOrEqual(8);
    expect(estimateTricks(cards("2S 3H 4H 5H 6H 7C 8C 9C 2D 3D 4D 5D 6D"))).toBeLessThan(1);
  });

  it("bids nil only on a weak, low hand", () => {
    expect(looksNil(cards("2S 3H 4H 5H 6H 7C 8C 2C 9D 3D 4D 5D 6D"))).toBe(true);
    expect(looksNil(cards("QS 3H 4H 5H 6H 7C 8C 2C 9D 3D 4D 5D 6D"))).toBe(false);
    expect(looksNil(cards("2S 3H 4H 5H 6H 7C 8C 2C AD 3D 4D 5D 6D"))).toBe(false);
  });

  it("never bids nil on top of a nil partner, and always bids 1-13 otherwise", () => {
    const h = playingHand(["2S 3H 4H 5H 6H 7C 8C 2C 9D 3D 4D 5D 6D", "", "", ""], ["nil", 3, "nil", 3]);
    const bid = chooseBid({ ...h, bids: [null, 3, "nil", 3], phase: "bidding" }, 0);
    expect(bid).not.toBe("nil");
    expect(bid).toBeGreaterThanOrEqual(1);
  });
});

describe("play", () => {
  it("doesn't overtake a partner who is winning with the top card", () => {
    // West led 2H, partner North played AH; East to play holds KH 3H.
    const h = playingHand(["", "4C", "5C", "KH 3H"], [3, 3, 3, 3], [[1, "2H"], [2, "AH"]]);
    expect(choosePlay(h, 3)).toEqual(cards("3H")[0]);
  });

  it("wins cheaply in last seat when tricks are still needed", () => {
    // North (an opponent of East) is winning with JH.
    const h = playingHand(["", "", "", "KH QH 2H"], [3, 3, 3, 3], [[0, "4H"], [1, "10H"], [2, "JH"]]);
    expect(choosePlay(h, 3)).toEqual(cards("QH")[0]);
  });

  it("ducks once the contract is made", () => {
    const h = playingHand(["", "", "", "KH 9H 2H"], [1, 1, 1, 1], [[0, "10H"], [1, "JH"], [2, "4H"]]);
    h.tricksWon = [0, 1, 0, 1];
    expect(choosePlay(h, 3)).toEqual(cards("9H")[0]);
  });

  it("a nil bidder plays the highest card that still loses", () => {
    const h = playingHand(["", "", "", "KH 9H 2H"], [3, 3, 3, "nil"], [[0, "10H"], [1, "JH"], [2, "4H"]]);
    expect(choosePlay(h, 3)).toEqual(cards("9H")[0]);
  });

  it("covers a nil partner who is winning the trick", () => {
    // East bid nil and is winning with 9H; West holds QH 3H.
    const h = playingHand(["", "QH 3H", "", ""], [3, 3, 3, "nil"], [[2, "5H"], [3, "9H"]]);
    expect(choosePlay(h, 1)).toEqual(cards("QH")[0]);
  });

  it("lets a nil opponent keep the trick", () => {
    // West bid nil and is winning with 9H; North holds QH 3H.
    const h = playingHand(["", "", "QH 3H", ""], [3, "nil", 3, 3], [[0, "5H"], [1, "9H"]]);
    expect(choosePlay(h, 2)).toEqual(cards("3H")[0]);
  });
});

describe("whole matches", () => {
  it("only ever plays legal cards, and every match ends", () => {
    for (let seed = 1; seed <= 40; seed++) {
      const { match, hands } = botMatch(seed);
      expect(match.status).not.toBe("playing");
      expect(hands).toBeLessThan(200);
    }
  });

  it("bids sensibly: most hands' total bids land near 13", () => {
    const rng = seeded(99);
    const totals: number[] = [];
    for (let i = 0; i < 300; i++) {
      let h = newMatch(500, shuffledDeck(rng)).hand;
      while (h.phase === "bidding") h = applyBid(h, h.turn, chooseBid(h, h.turn));
      totals.push(h.bids.reduce<number>((n, b) => n + (b === "nil" ? 0 : (b ?? 0)), 0));
    }
    const near = totals.filter((t) => t >= 9 && t <= 14).length;
    expect(near / totals.length).toBeGreaterThan(0.75);
  });
});
