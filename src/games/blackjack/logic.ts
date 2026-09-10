import { createDeck, shuffle } from "../../components/PlayingCard/deck";
import type { Card } from "../../components/PlayingCard/types";

export const DEALER_STAND_TOTAL = 17;

export type RoundStatus = "player-turn" | "dealer-reveal" | "dealer-turn" | "round-over";

export type Outcome =
  | "player-blackjack"
  | "dealer-blackjack"
  | "push"
  | "player-win"
  | "dealer-win"
  | "player-bust"
  | "dealer-bust";

export interface HandScore {
  total: number;
  soft: boolean;
  isBlackjack: boolean;
  isBust: boolean;
}

export interface RoundState {
  deck: Card[];
  playerHand: Card[];
  dealerHand: Card[];
  status: RoundStatus;
  outcome: Outcome | null;
}

export interface BlackjackStats {
  wins: number;
  losses: number;
  pushes: number;
  blackjacks: number;
}

export const INITIAL_STATS: BlackjackStats = { wins: 0, losses: 0, pushes: 0, blackjacks: 0 };

function rankValue(card: Card): number {
  if (card.rank === "A") return 11;
  if (card.rank === "K" || card.rank === "Q" || card.rank === "J") return 10;
  return Number(card.rank);
}

/**
 * Scores a hand, counting aces as 11 where possible and demoting them to 1
 * (one at a time) only as needed to avoid busting. `soft` reflects whether
 * at least one ace is still being counted as 11 in the returned total.
 */
export function scoreHand(hand: Card[]): HandScore {
  let total = 0;
  let acesAsEleven = 0;
  for (const card of hand) {
    total += rankValue(card);
    if (card.rank === "A") acesAsEleven += 1;
  }
  while (total > 21 && acesAsEleven > 0) {
    total -= 10;
    acesAsEleven -= 1;
  }
  return {
    total,
    soft: acesAsEleven > 0,
    isBust: total > 21,
    isBlackjack: hand.length === 2 && total === 21,
  };
}

export function shouldDealerHit(score: HandScore): boolean {
  return score.total < DEALER_STAND_TOTAL;
}

export function resolveOutcome(player: HandScore, dealer: HandScore): Outcome {
  if (player.isBlackjack && dealer.isBlackjack) return "push";
  if (player.isBlackjack) return "player-blackjack";
  if (dealer.isBlackjack) return "dealer-blackjack";
  if (player.isBust) return "player-bust";
  if (dealer.isBust) return "dealer-bust";
  if (player.total > dealer.total) return "player-win";
  if (dealer.total > player.total) return "dealer-win";
  return "push";
}

export function isPlayerOutcome(outcome: Outcome): boolean {
  return outcome === "player-blackjack" || outcome === "player-win" || outcome === "dealer-bust";
}

export function applyOutcomeToStats(stats: BlackjackStats, outcome: Outcome): BlackjackStats {
  switch (outcome) {
    case "player-blackjack":
      return { ...stats, wins: stats.wins + 1, blackjacks: stats.blackjacks + 1 };
    case "player-win":
    case "dealer-bust":
      return { ...stats, wins: stats.wins + 1 };
    case "dealer-blackjack":
    case "dealer-win":
    case "player-bust":
      return { ...stats, losses: stats.losses + 1 };
    case "push":
      return { ...stats, pushes: stats.pushes + 1 };
  }
}

/** A fresh shoe, dealt two cards each to player and dealer, alternating. */
export function createInitialRound(rng: () => number = Math.random): RoundState {
  const shoe = shuffle(createDeck(), rng);
  const playerHand = [shoe[0], shoe[2]];
  const dealerHand = [shoe[1], shoe[3]];
  const deck = shoe.slice(4);
  const playerScore = scoreHand(playerHand);
  return {
    deck,
    playerHand,
    dealerHand,
    status: playerScore.isBlackjack ? "dealer-reveal" : "player-turn",
    outcome: null,
  };
}

export type Action =
  | { type: "hit" }
  | { type: "stand" }
  | { type: "reveal" }
  | { type: "dealer-draw" }
  | { type: "deal"; rng?: () => number };

export function reducer(state: RoundState, action: Action): RoundState {
  switch (action.type) {
    case "hit": {
      if (state.status !== "player-turn") return state;
      const [card, ...rest] = state.deck;
      const playerHand = [...state.playerHand, card];
      const score = scoreHand(playerHand);
      return {
        ...state,
        deck: rest,
        playerHand,
        status: score.isBust ? "dealer-reveal" : "player-turn",
      };
    }

    case "stand": {
      if (state.status !== "player-turn") return state;
      return { ...state, status: "dealer-reveal" };
    }

    case "reveal": {
      if (state.status !== "dealer-reveal") return state;
      const playerScore = scoreHand(state.playerHand);
      const dealerScore = scoreHand(state.dealerHand);
      if (playerScore.isBust || playerScore.isBlackjack || dealerScore.isBlackjack) {
        return { ...state, status: "round-over", outcome: resolveOutcome(playerScore, dealerScore) };
      }
      if (!shouldDealerHit(dealerScore)) {
        return { ...state, status: "round-over", outcome: resolveOutcome(playerScore, dealerScore) };
      }
      return { ...state, status: "dealer-turn" };
    }

    case "dealer-draw": {
      if (state.status !== "dealer-turn") return state;
      const [card, ...rest] = state.deck;
      const dealerHand = [...state.dealerHand, card];
      const dealerScore = scoreHand(dealerHand);
      if (shouldDealerHit(dealerScore) && !dealerScore.isBust) {
        return { ...state, deck: rest, dealerHand };
      }
      const playerScore = scoreHand(state.playerHand);
      return {
        ...state,
        deck: rest,
        dealerHand,
        status: "round-over",
        outcome: resolveOutcome(playerScore, dealerScore),
      };
    }

    case "deal":
      return createInitialRound(action.rng);
  }
}
