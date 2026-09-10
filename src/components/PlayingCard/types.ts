export type Suit = "spades" | "hearts" | "diamonds" | "clubs";

export type Rank = "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  rank: Rank;
  suit: Suit;
}

export const SUITS: readonly Suit[] = ["spades", "hearts", "diamonds", "clubs"];

export const RANKS: readonly Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export function isRedSuit(suit: Suit): boolean {
  return suit === "hearts" || suit === "diamonds";
}

export function suitLabel(suit: Suit): string {
  return suit.charAt(0).toUpperCase() + suit.slice(1);
}

const RANK_LABELS: Record<Rank, string> = {
  A: "Ace",
  "2": "Two",
  "3": "Three",
  "4": "Four",
  "5": "Five",
  "6": "Six",
  "7": "Seven",
  "8": "Eight",
  "9": "Nine",
  "10": "Ten",
  J: "Jack",
  Q: "Queen",
  K: "King",
};

export function rankLabel(rank: Rank): string {
  return RANK_LABELS[rank];
}

export function cardName(card: Card): string {
  return `${rankLabel(card.rank)} of ${suitLabel(card.suit)}`;
}

export function cardKey(card: Card): string {
  return `${card.rank}-${card.suit}`;
}
