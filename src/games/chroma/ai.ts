/*
 * The computer players: one rule-based strategy, every seat for itself.
 * It sees its own hand, the pile and how many cards everyone holds.
 */
import {
  type ChromaCard,
  type Color,
  type RoundState,
  type Seat,
  COLORS,
  cardPoints,
  isWild,
  legalPlays,
  SEATS,
  stepSeat,
  topCard,
} from "./logic";

/** Opponents at or under this many cards are worth attacking. */
export const DANGER_CARDS = 2;
/** How often a computer player remembers to call its last card. */
export const CALL_CHANCE = 0.85;
/** Holding at least this many cards, it draws rather than spend its only wild. */
export const SAVE_WILDS_FROM = 5;

function colorCounts(hand: readonly ChromaCard[]): Record<Color, number> {
  const counts: Record<Color, number> = { cyan: 0, pink: 0, green: 0, orange: 0 };
  for (const c of hand) if (c.color) counts[c.color]++;
  return counts;
}

/** The colour to name for a wild: the one it holds most of. */
export function chooseWildColor(hand: readonly ChromaCard[], seat: Seat = 0): Color {
  const counts = colorCounts(hand);
  let best: Color = COLORS[seat % COLORS.length];
  let bestScore = -1;
  for (const color of COLORS) {
    // Points break ties, so high cards get a chance to go.
    const score = counts[color] * 100 + hand.filter((c) => c.color === color).reduce((n, c) => n + cardPoints(c), 0);
    if (score > bestScore) {
      best = color;
      bestScore = score;
    }
  }
  return best;
}

/** How much `seat` wants to play `card` now; higher is better. */
function rate(round: RoundState, seat: Seat, card: ChromaCard, nextIsDanger: boolean, anyDanger: boolean): number {
  const hand = round.hands[seat];
  const rest = hand.filter((c) => c.id !== card.id);
  const counts = colorCounts(rest);
  let score = 0;

  if (isWild(card)) {
    // Wilds are kept for when nothing else fits, or to stop a near-winner.
    score = card.kind === "wild4" ? (nextIsDanger ? 60 : -40) : -30;
    if (rest.length === 0) score += 100;
    return score;
  }

  // Stay in the colour it holds most of, and shed points while it can.
  score += counts[card.color!] * 4 + cardPoints(card) / 5;

  const attack = card.kind === "draw2" ? 30 : card.kind === "skip" ? 22 : card.kind === "reverse" ? 14 : 0;
  if (nextIsDanger) score += attack;
  else if (attack && !anyDanger && rest.length > 2) score -= 6; // save it for later
  return score;
}

/** The card to play, or null to draw. */
export function chooseCard(round: RoundState, seat: Seat): ChromaCard | null {
  const hand = round.hands[seat];
  const legal = round.phase === "drawn" ? hand.filter((c) => c.id === round.drawnCard) : legalPlays(hand, topCard(round), round.color);
  if (legal.length === 0) return null;
  const next = stepSeat(seat, round.direction);
  const nextIsDanger = round.hands[next].length <= DANGER_CARDS;
  const anyDanger = SEATS.some((s) => s !== seat && round.hands[s].length <= DANGER_CARDS);
  let best = legal[0];
  let bestScore = -Infinity;
  for (const card of legal) {
    const score = rate(round, seat, card, nextIsDanger, anyDanger);
    if (score > bestScore) {
      best = card;
      bestScore = score;
    }
  }
  // With only wilds to play and a big hand, draw first and keep them.
  const onlyWilds = legal.every(isWild);
  if (round.phase === "playing" && onlyWilds && !anyDanger && hand.length >= SAVE_WILDS_FROM) return null;
  if (round.phase === "drawn") {
    // A drawn wild is kept unless it's needed now; everything else goes.
    const keep = isWild(best) && hand.length > 3 && !nextIsDanger;
    return keep ? null : best;
  }
  return best;
}

export type CpuMove = { type: "play"; cardId: number } | { type: "draw" } | { type: "pass" } | { type: "color"; color: Color };

/** The one move `seat` makes from here (the round must be waiting on it). */
export function cpuMove(round: RoundState, seat: Seat): CpuMove {
  if (round.phase === "choose-color") return { type: "color", color: chooseWildColor(round.hands[seat], seat) };
  const card = chooseCard(round, seat);
  if (card) return { type: "play", cardId: card.id };
  return round.phase === "drawn" ? { type: "pass" } : { type: "draw" };
}
