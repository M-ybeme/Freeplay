import { describe, expect, it } from "vitest";
import type { Card } from "../../components/PlayingCard/types";
import {
  INITIAL_STATS,
  applyOutcomeToStats,
  createInitialRound,
  reducer,
  resolveOutcome,
  scoreHand,
  shouldDealerHit,
  type RoundState,
} from "./logic";

function card(rank: Card["rank"], suit: Card["suit"] = "spades"): Card {
  return { rank, suit };
}

describe("scoreHand", () => {
  it("scores a basic hard hand", () => {
    expect(scoreHand([card("9"), card("7")])).toMatchObject({ total: 16, soft: false, isBust: false });
  });

  it("counts a single ace as 11 when it fits", () => {
    const score = scoreHand([card("A"), card("6")]);
    expect(score.total).toBe(17);
    expect(score.soft).toBe(true);
  });

  it("converts an ace to 1 when 11 would bust", () => {
    const score = scoreHand([card("A"), card("6"), card("10")]);
    expect(score.total).toBe(17);
    expect(score.soft).toBe(false);
  });

  it("handles multiple aces, demoting only as many as needed", () => {
    // A + A + 9 = 11 + 11 + 9 = 31 -> demote one ace -> 21, still soft (one ace left at 11)
    const score = scoreHand([card("A"), card("A"), card("9")]);
    expect(score.total).toBe(21);
    expect(score.soft).toBe(true);
    expect(score.isBlackjack).toBe(false); // 3 cards, not a natural
  });

  it("demotes both aces when needed", () => {
    // A + A + 9 + K = 11+11+9+10=41 -> demote twice -> 21, hard
    const score = scoreHand([card("A"), card("A"), card("9"), card("K")]);
    expect(score.total).toBe(21);
    expect(score.soft).toBe(false);
  });

  it("identifies a natural blackjack (2 cards totaling 21)", () => {
    const score = scoreHand([card("A"), card("K")]);
    expect(score.total).toBe(21);
    expect(score.isBlackjack).toBe(true);
  });

  it("does not treat an ordinary 21 (3+ cards) as a natural blackjack", () => {
    const score = scoreHand([card("7"), card("7"), card("7")]);
    expect(score.total).toBe(21);
    expect(score.isBlackjack).toBe(false);
  });

  it("detects a bust", () => {
    const score = scoreHand([card("K"), card("Q"), card("5")]);
    expect(score.total).toBe(25);
    expect(score.isBust).toBe(true);
  });

  it("treats face cards as 10", () => {
    expect(scoreHand([card("K"), card("Q")]).total).toBe(20);
    expect(scoreHand([card("J"), card("5")]).total).toBe(15);
  });
});

describe("shouldDealerHit", () => {
  it("hits below 17", () => {
    expect(shouldDealerHit(scoreHand([card("9"), card("7")]))).toBe(true); // 16
  });

  it("stands on a hard 17", () => {
    expect(shouldDealerHit(scoreHand([card("10"), card("7")]))).toBe(false);
  });

  it("stands on a soft 17 (does not hit)", () => {
    const score = scoreHand([card("A"), card("6")]);
    expect(score.soft).toBe(true);
    expect(score.total).toBe(17);
    expect(shouldDealerHit(score)).toBe(false);
  });

  it("does not hit above 17", () => {
    expect(shouldDealerHit(scoreHand([card("10"), card("9")]))).toBe(false); // 19
  });
});

describe("resolveOutcome", () => {
  const hand = (total: number, opts: Partial<{ isBust: boolean; isBlackjack: boolean; soft: boolean }> = {}) => ({
    total,
    soft: opts.soft ?? false,
    isBust: opts.isBust ?? false,
    isBlackjack: opts.isBlackjack ?? false,
  });

  it("resolves player blackjack over a non-blackjack dealer", () => {
    expect(resolveOutcome(hand(21, { isBlackjack: true }), hand(20))).toBe("player-blackjack");
  });

  it("resolves dealer blackjack over a non-blackjack player", () => {
    expect(resolveOutcome(hand(20), hand(21, { isBlackjack: true }))).toBe("dealer-blackjack");
  });

  it("pushes when both have blackjack", () => {
    expect(resolveOutcome(hand(21, { isBlackjack: true }), hand(21, { isBlackjack: true }))).toBe("push");
  });

  it("resolves a player bust as a loss regardless of dealer total", () => {
    expect(resolveOutcome(hand(25, { isBust: true }), hand(18))).toBe("player-bust");
  });

  it("resolves a dealer bust as a win when the player has not busted", () => {
    expect(resolveOutcome(hand(18), hand(23, { isBust: true }))).toBe("dealer-bust");
  });

  it("resolves the higher non-busted total as the winner", () => {
    expect(resolveOutcome(hand(19), hand(17))).toBe("player-win");
    expect(resolveOutcome(hand(17), hand(19))).toBe("dealer-win");
  });

  it("pushes on equal totals", () => {
    expect(resolveOutcome(hand(18), hand(18))).toBe("push");
  });
});

describe("applyOutcomeToStats", () => {
  it("counts a player blackjack as both a win and a blackjack", () => {
    const stats = applyOutcomeToStats(INITIAL_STATS, "player-blackjack");
    expect(stats).toEqual({ wins: 1, losses: 0, pushes: 0, blackjacks: 1 });
  });

  it("counts player-win and dealer-bust as wins", () => {
    expect(applyOutcomeToStats(INITIAL_STATS, "player-win").wins).toBe(1);
    expect(applyOutcomeToStats(INITIAL_STATS, "dealer-bust").wins).toBe(1);
  });

  it("counts dealer-blackjack, dealer-win, and player-bust as losses", () => {
    expect(applyOutcomeToStats(INITIAL_STATS, "dealer-blackjack").losses).toBe(1);
    expect(applyOutcomeToStats(INITIAL_STATS, "dealer-win").losses).toBe(1);
    expect(applyOutcomeToStats(INITIAL_STATS, "player-bust").losses).toBe(1);
  });

  it("counts push as a push", () => {
    expect(applyOutcomeToStats(INITIAL_STATS, "push").pushes).toBe(1);
  });
});

describe("createInitialRound", () => {
  it("deals two cards each to player and dealer from a shuffled 52-card shoe", () => {
    const round = createInitialRound(() => 0.3);
    expect(round.playerHand).toHaveLength(2);
    expect(round.dealerHand).toHaveLength(2);
    expect(round.deck).toHaveLength(48);
  });

  it("starts in player-turn unless the player was dealt a natural", () => {
    // rng that won't realistically produce a natural on the first two cards
    const round = createInitialRound(() => 0.5);
    if (!scoreHand(round.playerHand).isBlackjack) {
      expect(round.status).toBe("player-turn");
    }
  });
});

describe("reducer", () => {
  function playingState(overrides: Partial<RoundState> = {}): RoundState {
    return {
      deck: [card("5"), card("6"), card("7")],
      playerHand: [card("9"), card("7")],
      dealerHand: [card("10"), card("6")],
      status: "player-turn",
      outcome: null,
      ...overrides,
    };
  }

  it("hit draws a card into the player's hand from the top of the deck", () => {
    const state = playingState();
    const next = reducer(state, { type: "hit" });
    expect(next.playerHand).toHaveLength(3);
    expect(next.playerHand[2]).toEqual(card("5"));
    expect(next.deck).toHaveLength(2);
  });

  it("hit that busts the player moves straight to dealer-reveal", () => {
    const state = playingState({ playerHand: [card("K"), card("Q")], deck: [card("5")] });
    const next = reducer(state, { type: "hit" });
    expect(next.status).toBe("dealer-reveal");
  });

  it("hit that does not bust stays in player-turn", () => {
    const state = playingState({ playerHand: [card("2"), card("3")], deck: [card("4")] });
    const next = reducer(state, { type: "hit" });
    expect(next.status).toBe("player-turn");
  });

  it("stand moves to dealer-reveal", () => {
    const next = reducer(playingState(), { type: "stand" });
    expect(next.status).toBe("dealer-reveal");
  });

  it("ignores hit/stand outside player-turn", () => {
    const state = playingState({ status: "round-over" });
    expect(reducer(state, { type: "hit" })).toBe(state);
    expect(reducer(state, { type: "stand" })).toBe(state);
  });

  it("reveal resolves immediately if the player already busted", () => {
    const state = playingState({
      status: "dealer-reveal",
      playerHand: [card("K"), card("Q"), card("5")],
      dealerHand: [card("10"), card("6")],
    });
    const next = reducer(state, { type: "reveal" });
    expect(next.status).toBe("round-over");
    expect(next.outcome).toBe("player-bust");
  });

  it("reveal resolves immediately if the dealer already has 17+", () => {
    const state = playingState({
      status: "dealer-reveal",
      playerHand: [card("9"), card("8")],
      dealerHand: [card("10"), card("9")],
    });
    const next = reducer(state, { type: "reveal" });
    expect(next.status).toBe("round-over");
    expect(next.outcome).toBe("dealer-win");
  });

  it("reveal moves to dealer-turn if the dealer must draw", () => {
    const state = playingState({
      status: "dealer-reveal",
      dealerHand: [card("10"), card("6")], // 16
    });
    const next = reducer(state, { type: "reveal" });
    expect(next.status).toBe("dealer-turn");
  });

  it("reveal resolves a dealer blackjack immediately", () => {
    const state = playingState({
      status: "dealer-reveal",
      dealerHand: [card("A"), card("K")],
    });
    const next = reducer(state, { type: "reveal" });
    expect(next.status).toBe("round-over");
    expect(next.outcome).toBe("dealer-blackjack");
  });

  it("dealer-draw keeps drawing while under 17", () => {
    const state: RoundState = {
      deck: [card("2"), card("3")],
      playerHand: [card("9"), card("8")],
      dealerHand: [card("10"), card("2")], // 12
      status: "dealer-turn",
      outcome: null,
    };
    const afterFirst = reducer(state, { type: "dealer-draw" });
    expect(afterFirst.dealerHand).toHaveLength(3); // 12 + 2 = 14
    expect(afterFirst.status).toBe("dealer-turn");

    const afterSecond = reducer(afterFirst, { type: "dealer-draw" });
    expect(afterSecond.dealerHand).toHaveLength(4); // 14 + 3 = 17
    expect(afterSecond.status).toBe("round-over");
  });

  it("dealer-draw resolves a dealer bust", () => {
    const state: RoundState = {
      deck: [card("K")],
      playerHand: [card("9"), card("8")],
      dealerHand: [card("10"), card("6")], // 16
      status: "dealer-turn",
      outcome: null,
    };
    const next = reducer(state, { type: "dealer-draw" });
    expect(next.status).toBe("round-over");
    expect(next.outcome).toBe("dealer-bust");
  });

  it("ignores reveal/dealer-draw outside their expected status", () => {
    const state = playingState();
    expect(reducer(state, { type: "reveal" })).toBe(state);
    expect(reducer(state, { type: "dealer-draw" })).toBe(state);
  });

  it("deal starts a brand new round", () => {
    const state = playingState({ status: "round-over", outcome: "push" });
    const next = reducer(state, { type: "deal", rng: () => 0.1 });
    expect(next.outcome).toBeNull();
    expect(next.playerHand).toHaveLength(2);
    expect(next.dealerHand).toHaveLength(2);
  });
});
