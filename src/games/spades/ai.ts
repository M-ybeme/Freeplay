import type { Card, Suit } from "../../components/PlayingCard/types";
import {
  HAND_SIZE,
  beats,
  legalCards,
  partnerOf,
  rankValue,
  teamOf,
  winningPlay,
  type Bid,
  type HandState,
  type Seat,
} from "./logic";

/*
 * The one computer player, used for your partner and both opponents. It
 * plays honestly: it sees its own cards, the bids, and what has been
 * played, never anyone else's hand.
 */

const SIDE_SUITS: readonly Suit[] = ["hearts", "clubs", "diamonds"];

function bySuit(cards: readonly Card[], suit: Suit): Card[] {
  return cards.filter((c) => c.suit === suit);
}

function low(cards: readonly Card[]): Card {
  return cards.reduce((a, b) => (rankValue(b.rank) < rankValue(a.rank) ? b : a));
}

function high(cards: readonly Card[]): Card {
  return cards.reduce((a, b) => (rankValue(b.rank) > rankValue(a.rank) ? b : a));
}

// ---------- Bidding ----------

/**
 * Roughly how many tricks this hand takes: high spades and long spades,
 * side-suit aces and guarded kings, and a spade or two for each short
 * side suit it can trump.
 */
export function estimateTricks(hand: readonly Card[]): number {
  const spades = bySuit(hand, "spades").map((c) => rankValue(c.rank));
  const has = (v: number) => spades.includes(v);
  let tricks = 0;
  let spadesUsed = 0;
  if (has(14)) { tricks += 1; spadesUsed += 1; }
  if (has(13) && spades.length >= 2) { tricks += 1; spadesUsed += 1; }
  if (has(12) && spades.length >= 3) { tricks += 1; spadesUsed += 1; }
  // Length beyond four spades usually wins on its own.
  tricks += Math.max(0, spades.length - 4);
  let spareSpades = Math.max(0, Math.min(spades.length, 4) - spadesUsed);

  for (const suit of SIDE_SUITS) {
    const ranks = bySuit(hand, suit).map((c) => rankValue(c.rank));
    const n = ranks.length;
    if (ranks.includes(14) && n <= 6) tricks += 1;
    if (ranks.includes(13) && n >= 2 && n <= 5) tricks += ranks.includes(14) ? 0.8 : 0.6;
    if (ranks.includes(12) && n >= 3 && n <= 4 && ranks.includes(13)) tricks += 0.3;
    // Short suits let spare low spades trump.
    const ruffs = n === 0 ? 2 : n === 1 ? 1 : n === 2 ? 0.5 : 0;
    const used = Math.min(spareSpades, ruffs);
    tricks += used * 0.8;
    spareSpades -= Math.ceil(used);
  }
  return tricks;
}

/** A hand weak enough to try for nil: no high spades, no aces, low cards to hide behind. */
export function looksNil(hand: readonly Card[]): boolean {
  const spades = bySuit(hand, "spades");
  if (spades.length > 3 || spades.some((c) => rankValue(c.rank) >= 11)) return false;
  if (hand.some((c) => c.rank === "A" || c.rank === "K")) return false;
  // Every side suit with cards needs a low card to duck with.
  return SIDE_SUITS.every((s) => {
    const cards = bySuit(hand, s);
    return cards.length === 0 || rankValue(low(cards).rank) <= 5;
  });
}

export function chooseBid(hand: HandState, seat: Seat): Bid {
  const cards = hand.hands[seat];
  const partnerBid = hand.bids[partnerOf(seat)];
  const estimate = estimateTricks(cards);
  if (estimate < 1.5 && partnerBid !== "nil" && looksNil(cards)) return "nil";
  // Rounded slightly up. Tuned over 2,000 bot-only hands, counting each bag
  // at the 10 points it eventually costs: -0.25 bid 9.9 a table and made
  // 97% but took 1.6 bags a team; +0.25 bids 11.5, makes 89%, takes 0.9
  // bags, and nets the most; +0.5 already drops to 75% made.
  let bid = Math.max(1, Math.round(estimate + 0.25));
  if (typeof partnerBid === "number") bid = Math.min(bid, HAND_SIZE - partnerBid);
  return Math.max(1, Math.min(HAND_SIZE, bid));
}

// ---------- Play ----------

/** Cards not yet seen, from this seat's point of view. */
function unseen(hand: HandState, seat: Seat): Card[] {
  const seen = new Set([...hand.played, ...hand.hands[seat]].map((c) => c.rank + c.suit));
  const all: Card[] = [];
  for (const suit of ["spades", ...SIDE_SUITS] as Suit[]) {
    for (const rank of ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const) {
      if (!seen.has(rank + suit)) all.push({ rank, suit });
    }
  }
  return all;
}

/** A card nobody else can beat in its own suit (the top card still out). */
function isTopCard(card: Card, out: readonly Card[]): boolean {
  return !out.some((c) => c.suit === card.suit && rankValue(c.rank) > rankValue(card.rank));
}

/** How many more tricks this seat's team still wants (nil bidders excluded). */
function tricksStillNeeded(hand: HandState, seat: Seat): number {
  const team = teamOf(seat);
  let bid = 0;
  let won = 0;
  for (const s of [0, 1, 2, 3] as Seat[]) {
    if (teamOf(s) !== team) continue;
    const b = hand.bids[s];
    if (b === "nil") continue;
    bid += b ?? 0;
    won += hand.tricksWon[s];
  }
  return bid - won;
}

export function choosePlay(hand: HandState, seat: Seat): Card {
  const mine = hand.hands[seat];
  const legal = legalCards(mine, hand.trick, hand.spadesBroken);
  if (legal.length === 1) return legal[0];

  const partner = partnerOf(seat);
  const myNil = hand.bids[seat] === "nil" && hand.tricksWon[seat] === 0;
  const partnerNil = hand.bids[partner] === "nil" && hand.tricksWon[partner] === 0;
  const opponents = ([0, 1, 2, 3] as Seat[]).filter((s) => teamOf(s) !== teamOf(seat));
  const nilOpponent = opponents.find((s) => hand.bids[s] === "nil" && hand.tricksWon[s] === 0);
  const need = tricksStillNeeded(hand, seat);
  const out = unseen(hand, seat);

  // ----- Leading -----
  if (hand.trick.length === 0) {
    const nonSpades = legal.filter((c) => c.suit !== "spades");
    const pool = nonSpades.length > 0 ? nonSpades : legal;
    if (myNil) return low(pool);
    const winners = legal.filter((c) => isTopCard(c, out));
    const sideWinners = winners.filter((c) => c.suit !== "spades");
    if ((need > 0 || partnerNil) && winners.length > 0) {
      return sideWinners.length > 0 ? high(sideWinners) : high(winners);
    }
    // Lead low from the longest side suit: cheap, and keeps control.
    const suits = [...new Set(pool.map((c) => c.suit))];
    const longest = suits.reduce((a, b) => (bySuit(pool, b).length > bySuit(pool, a).length ? b : a));
    return low(bySuit(pool, longest));
  }

  // ----- Following -----
  const led = hand.trick[0].card.suit;
  const current = winningPlay(hand.trick);
  const winsNow = (c: Card) => beats(c, current.card, led);
  const winning = legal.filter(winsNow);
  const losing = legal.filter((c) => !winsNow(c));
  const last = hand.trick.length === 3;
  const cheapestWin = () => {
    // Prefer following suit over trumping when both win.
    const inSuit = winning.filter((c) => c.suit === led);
    return low(inSuit.length > 0 ? inSuit : winning);
  };
  /** Shed a card: the highest loser, else the lowest card (from side suits first). */
  const shedHigh = () => (losing.length > 0 ? high(losing) : low(legal));
  const shedLow = () => {
    const pool = losing.length > 0 ? losing : legal;
    const sides = pool.filter((c) => c.suit !== "spades");
    return low(sides.length > 0 ? sides : pool);
  };

  if (myNil) {
    // Duck as high as safely possible; if forced to win, win with the biggest card.
    return losing.length > 0 ? high(losing) : high(legal);
  }

  // Cover a nil partner: take the trick off them if they're winning it.
  if (partnerNil && current.seat === partner) {
    return winning.length > 0 ? cheapestWin() : shedLow();
  }

  // Help set a nil opponent: let them keep the trick.
  if (nilOpponent !== undefined && current.seat === nilOpponent) {
    return losing.length > 0 ? high(losing) : low(legal);
  }

  // Partner already has it (and it's safe enough): don't waste a card.
  if (current.seat === partner && !partnerNil) {
    const safe = last || isTopCard(current.card, out) || current.card.suit === "spades";
    if (safe) return need > 0 ? shedLow() : shedHigh();
  }

  if (need > 0 || partnerNil) {
    if (winning.length > 0) {
      const choice = cheapestWin();
      // In second or third seat, a low winner may just be overtaken; use a
      // top card if we have one in the suit, otherwise the cheap winner.
      if (!last && choice.suit === led && !isTopCard(choice, out)) {
        const top = winning.filter((c) => c.suit === led && isTopCard(c, out));
        if (top.length > 0) return low(top);
      }
      return choice;
    }
    return shedLow();
  }

  // Contract made: avoid bags.
  return shedHigh();
}
