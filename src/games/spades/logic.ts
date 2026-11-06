import { createDeck, shuffle } from "../../components/PlayingCard/deck";
import type { Card, Rank, Suit } from "../../components/PlayingCard/types";

/*
 * Partnership Spades. Seats go clockwise from the person: 0 South (you),
 * 1 West, 2 North (your partner), 3 East. Even seats are "us", odd seats
 * "them". Play passes to the left, which from South is West.
 */

export type Seat = 0 | 1 | 2 | 3;
export type Team = 0 | 1;
/** 1-13 tricks, or nil (take none). */
export type Bid = number | "nil";

export const SEATS: readonly Seat[] = [0, 1, 2, 3];
export const HAND_SIZE = 13;
export const TARGETS = [250, 500] as const;
export type Target = (typeof TARGETS)[number];
export const DEFAULT_TARGET: Target = 500;
/** A team at or below this loses outright. */
export const LOSE_FLOOR = -200;
export const NIL_POINTS = 100;
export const BAG_LIMIT = 10;
export const BAG_PENALTY = 100;

export interface Play {
  seat: Seat;
  card: Card;
}

export type Phase = "bidding" | "playing" | "trick-complete" | "hand-over";

export interface HandState {
  dealer: Seat;
  hands: Card[][];
  bids: (Bid | null)[];
  tricksWon: number[];
  /** Cards on the table this trick, in play order. */
  trick: Play[];
  /** Every card played this hand (for the AI's memory). */
  played: Card[];
  turn: Seat;
  spadesBroken: boolean;
  phase: Phase;
  /** Who took the trick on the table, once it's complete. */
  trickWinner: Seat | null;
}

export interface TeamScore {
  score: number;
  bags: number;
}

export interface TeamHandResult {
  /** Sum of the team's number bids (nil counts 0). */
  bid: number;
  /** Tricks taken by the team's non-nil bidders. */
  tricks: number;
  /** Per nil bidder on the team: made (true) or failed. */
  nils: boolean[];
  /** Points from this hand, including nil and bag penalties. */
  points: number;
  bagsAdded: number;
  /** True when this hand's bags crossed the limit. */
  bagPenalty: boolean;
}

export type MatchStatus = "playing" | "won" | "lost";

export interface MatchState {
  version: 1;
  target: Target;
  scores: [TeamScore, TeamScore];
  hand: HandState;
  handNumber: number;
  /** Results of the hand just finished, shown in the summary. */
  lastResult: [TeamHandResult, TeamHandResult] | null;
  status: MatchStatus;
}

// ---------- Cards ----------

const RANK_VALUE: Record<Rank, number> = {
  "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13, A: 14,
};

export function rankValue(rank: Rank): number {
  return RANK_VALUE[rank];
}

/** Hand order: spades, hearts, clubs, diamonds (colours alternate), low to high. */
const SUIT_ORDER: Record<Suit, number> = { spades: 0, hearts: 1, clubs: 2, diamonds: 3 };

export function sortHand(cards: readonly Card[]): Card[] {
  return [...cards].sort((a, b) => SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit] || rankValue(a.rank) - rankValue(b.rank));
}

export function sameCard(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

export function teamOf(seat: Seat): Team {
  return (seat % 2) as Team;
}

export function partnerOf(seat: Seat): Seat {
  return ((seat + 2) % 4) as Seat;
}

export function nextSeat(seat: Seat): Seat {
  return ((seat + 1) % 4) as Seat;
}

// ---------- Dealing ----------

/** Deal a fresh hand. Bidding and the first lead start left of the dealer. */
export function dealHand(dealer: Seat, deck: readonly Card[]): HandState {
  const hands = SEATS.map((s) => sortHand(deck.slice(s * HAND_SIZE, (s + 1) * HAND_SIZE)));
  return {
    dealer,
    hands,
    bids: [null, null, null, null],
    tricksWon: [0, 0, 0, 0],
    trick: [],
    played: [],
    turn: nextSeat(dealer),
    spadesBroken: false,
    phase: "bidding",
    trickWinner: null,
  };
}

export function shuffledDeck(rng: () => number = Math.random): Card[] {
  return shuffle(createDeck(), rng);
}

export function newMatch(target: Target, deck: readonly Card[], dealer: Seat = 3): MatchState {
  return {
    version: 1,
    target,
    scores: [
      { score: 0, bags: 0 },
      { score: 0, bags: 0 },
    ],
    hand: dealHand(dealer, deck),
    handNumber: 1,
    lastResult: null,
    status: "playing",
  };
}

// ---------- Bidding ----------

export function isValidBid(bid: Bid): boolean {
  return bid === "nil" || (Number.isInteger(bid) && bid >= 1 && bid <= HAND_SIZE);
}

export function applyBid(hand: HandState, seat: Seat, bid: Bid): HandState {
  if (hand.phase !== "bidding" || hand.turn !== seat || !isValidBid(bid)) return hand;
  const bids = hand.bids.slice();
  bids[seat] = bid;
  const done = bids.every((b) => b !== null);
  return {
    ...hand,
    bids,
    phase: done ? "playing" : "bidding",
    // Everyone has bid once, so the turn is back with the first bidder,
    // who also leads the first trick.
    turn: done ? nextSeat(hand.dealer) : nextSeat(seat),
  };
}

// ---------- Play ----------

/** Cards `seat` may play now. */
export function legalCards(cards: readonly Card[], trick: readonly Play[], spadesBroken: boolean): Card[] {
  if (trick.length === 0) {
    if (spadesBroken) return [...cards];
    const nonSpades = cards.filter((c) => c.suit !== "spades");
    return nonSpades.length > 0 ? nonSpades : [...cards];
  }
  const led = trick[0].card.suit;
  const follow = cards.filter((c) => c.suit === led);
  return follow.length > 0 ? follow : [...cards];
}

export function isLegalPlay(hand: HandState, seat: Seat, card: Card): boolean {
  return legalCards(hand.hands[seat], hand.trick, hand.spadesBroken).some((c) => sameCard(c, card));
}

/** Does `a` beat `b`, given the suit that was led? */
export function beats(a: Card, b: Card, led: Suit): boolean {
  if (a.suit === b.suit) return rankValue(a.rank) > rankValue(b.rank);
  if (a.suit === "spades") return true;
  if (b.suit === "spades") return false;
  return a.suit === led;
}

/** The play currently winning a (possibly partial) trick. */
export function winningPlay(trick: readonly Play[]): Play {
  const led = trick[0].card.suit;
  return trick.reduce((best, p) => (beats(p.card, best.card, led) ? p : best));
}

export function applyPlay(hand: HandState, seat: Seat, card: Card): HandState {
  if (hand.phase !== "playing" || hand.turn !== seat || !isLegalPlay(hand, seat, card)) return hand;
  const hands = hand.hands.slice();
  hands[seat] = hands[seat].filter((c) => !sameCard(c, card));
  const trick = [...hand.trick, { seat, card }];
  const spadesBroken = hand.spadesBroken || card.suit === "spades";
  const played = [...hand.played, card];
  if (trick.length < 4) {
    return { ...hand, hands, trick, played, spadesBroken, turn: nextSeat(seat) };
  }
  return { ...hand, hands, trick, played, spadesBroken, phase: "trick-complete", trickWinner: winningPlay(trick).seat };
}

/** Sweep a finished trick to its winner, who leads next. */
export function collectTrick(hand: HandState): HandState {
  if (hand.phase !== "trick-complete" || hand.trickWinner === null) return hand;
  const winner = hand.trickWinner;
  const tricksWon = hand.tricksWon.slice();
  tricksWon[winner] += 1;
  const over = hand.hands.every((h) => h.length === 0);
  return {
    ...hand,
    tricksWon,
    trick: [],
    trickWinner: null,
    turn: winner,
    phase: over ? "hand-over" : "playing",
  };
}

// ---------- Scoring ----------

/**
 * Score one team's hand. Number bids combine into one contract made by
 * the non-nil bidders' tricks: making it scores 10 a trick plus 1 a bag
 * (each trick over); missing it costs 10 a trick. A nil bidder scores
 * +100 for taking nothing, -100 otherwise, and any tricks they do take
 * count as bags rather than toward their partner's contract. Every 10
 * bags costs 100.
 */
export function scoreTeam(hand: HandState, team: Team, before: TeamScore): { result: TeamHandResult; after: TeamScore } {
  const seats = SEATS.filter((s) => teamOf(s) === team);
  let bid = 0;
  let tricks = 0;
  let bagsAdded = 0;
  let points = 0;
  const nils: boolean[] = [];
  for (const s of seats) {
    const b = hand.bids[s];
    if (b === "nil") {
      const made = hand.tricksWon[s] === 0;
      nils.push(made);
      points += made ? NIL_POINTS : -NIL_POINTS;
      bagsAdded += hand.tricksWon[s];
    } else {
      bid += b ?? 0;
      tricks += hand.tricksWon[s];
    }
  }
  if (bid > 0) {
    if (tricks >= bid) {
      points += 10 * bid;
      bagsAdded += tricks - bid;
    } else {
      points -= 10 * bid;
    }
  } else {
    bagsAdded += tricks;
  }
  points += bagsAdded;
  let bags = before.bags + bagsAdded;
  let bagPenalty = false;
  while (bags >= BAG_LIMIT) {
    bags -= BAG_LIMIT;
    points -= BAG_PENALTY;
    bagPenalty = true;
  }
  return {
    result: { bid, tricks, nils, points, bagsAdded, bagPenalty },
    after: { score: before.score + points, bags },
  };
}

/** Who has won, if anyone. Equal scores past the line play another hand. */
export function matchOutcome(scores: readonly TeamScore[], target: Target): MatchStatus {
  const [us, them] = scores.map((s) => s.score);
  const finished = us >= target || them >= target || us <= LOSE_FLOOR || them <= LOSE_FLOOR;
  if (!finished || us === them) return "playing";
  return us > them ? "won" : "lost";
}

/** Score the finished hand into the match. */
export function finishHand(match: MatchState): MatchState {
  if (match.hand.phase !== "hand-over" || match.lastResult) return match;
  const a = scoreTeam(match.hand, 0, match.scores[0]);
  const b = scoreTeam(match.hand, 1, match.scores[1]);
  const scores: [TeamScore, TeamScore] = [a.after, b.after];
  return { ...match, scores, lastResult: [a.result, b.result], status: matchOutcome(scores, match.target) };
}

/** Deal the next hand; the deal moves one seat to the left. */
export function nextHand(match: MatchState, deck: readonly Card[]): MatchState {
  if (match.status !== "playing" || !match.lastResult) return match;
  return {
    ...match,
    hand: dealHand(nextSeat(match.hand.dealer), deck),
    handNumber: match.handNumber + 1,
    lastResult: null,
  };
}

/** A saved match is only resumed if it still has the shape this code expects. */
export function isSavedMatch(value: unknown): value is MatchState {
  const m = value as MatchState | null;
  return (
    !!m &&
    m.version === 1 &&
    TARGETS.includes(m.target) &&
    Array.isArray(m.scores) &&
    m.scores.length === 2 &&
    !!m.hand &&
    Array.isArray(m.hand.hands) &&
    m.hand.hands.length === 4 &&
    m.hand.hands.reduce((n, h) => n + h.length, 0) + m.hand.played.length === 52
  );
}
