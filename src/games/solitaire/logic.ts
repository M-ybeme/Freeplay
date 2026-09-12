// Pure Klondike (Draw 1) rules. No React/DOM. Reuses the shared card
// representation (Card/Suit/Rank/deck/shuffle) from PlayingCard - Solitaire
// owns its own zones and move rules, not a second card system.
import { createDeck, shuffle } from "../../components/PlayingCard/deck";
import { RANKS, SUITS, cardKey, isRedSuit, type Card, type Rank, type Suit } from "../../components/PlayingCard/types";

export interface TableauCard {
  card: Card;
  faceUp: boolean;
}

/** foundations[i] holds SUITS[i]'s cards, ascending from Ace; top = last element. */
export type Foundations = Card[][];
/** Seven piles, bottom-to-top order; top = last element. */
export type Tableau = TableauCard[][];

export interface SolitaireRun {
  /** Top of stock (next to draw) = last element. */
  stock: Card[];
  /** Top of waste (currently playable) = last element. */
  waste: Card[];
  foundations: Foundations;
  tableau: Tableau;
}

const TABLEAU_PILES = 7;
export const FRESH_STOCK_SIZE = 52 - (TABLEAU_PILES * (TABLEAU_PILES + 1)) / 2; // 24

function rankValue(rank: Rank): number {
  return RANKS.indexOf(rank);
}

function suitIndex(suit: Suit): number {
  return SUITS.indexOf(suit);
}

function isOppositeColor(a: Suit, b: Suit): boolean {
  return isRedSuit(a) !== isRedSuit(b);
}

/** Can `upper` legally sit directly on top of `lower` in a tableau pile? */
function isValidStack(lower: Card, upper: Card): boolean {
  return rankValue(lower.rank) === rankValue(upper.rank) + 1 && isOppositeColor(lower.suit, upper.suit);
}

/** `cards` given bottom-to-top (cards[0] is the bottom of the run). */
export function isValidTableauSequence(cards: readonly Card[]): boolean {
  for (let i = 1; i < cards.length; i++) {
    if (!isValidStack(cards[i - 1], cards[i])) return false;
  }
  return true;
}

/**
 * The movable run starting at `startIndex` in `pile` (bottom-to-top order),
 * or null if that position can't start a move: out of bounds, face-down, or
 * (defensively, for persisted/hand-edited state) not actually a valid
 * descending-alternating run. Reachable in-game piles always satisfy the
 * sequence check by construction - every card there arrived via a legal
 * move onto whatever was on top at the time.
 */
export function getMovableSequence(pile: readonly TableauCard[], startIndex: number): Card[] | null {
  if (startIndex < 0 || startIndex >= pile.length) return null;
  if (!pile[startIndex].faceUp) return null;
  const cards = pile.slice(startIndex).map((tc) => tc.card);
  return isValidTableauSequence(cards) ? cards : null;
}

/** Can `bottomCard` (the bottom of the sequence being moved) be placed on `destPile`? */
export function canPlaceOnTableau(destPile: readonly TableauCard[], bottomCard: Card): boolean {
  if (destPile.length === 0) return bottomCard.rank === "K";
  const top = destPile[destPile.length - 1];
  return top.faceUp && isValidStack(top.card, bottomCard);
}

export function canMoveCardToFoundation(foundations: Foundations, card: Card): boolean {
  const pile = foundations[suitIndex(card.suit)];
  if (pile.length === 0) return card.rank === "A";
  const top = pile[pile.length - 1];
  return rankValue(card.rank) === rankValue(top.rank) + 1;
}

function flipExposedTop(pile: readonly TableauCard[]): TableauCard[] {
  if (pile.length === 0) return pile as TableauCard[];
  const top = pile[pile.length - 1];
  if (top.faceUp) return pile as TableauCard[];
  return [...pile.slice(0, -1), { ...top, faceUp: true }];
}

function replaceAt<T>(list: readonly T[], index: number, value: T): T[] {
  const next = list.slice();
  next[index] = value;
  return next;
}

// Every move function below returns the exact same `run` reference when the
// requested move is illegal (checked with `===`), and a new object only on
// a fully-applied, atomic change - there is no partial-mutation path.

export function drawFromStock(run: SolitaireRun): SolitaireRun {
  if (run.stock.length === 0) return run;
  const card = run.stock[run.stock.length - 1];
  return { ...run, stock: run.stock.slice(0, -1), waste: [...run.waste, card] };
}

/**
 * Recycles waste back into stock preserving draw order: if waste (bottom to
 * top) is [A, B, C], the next three draws after recycling must again be A,
 * then B, then C - so the new stock is the reverse of waste (`[C, B, A]`),
 * since draws pop from the end.
 */
export function recycleWaste(run: SolitaireRun): SolitaireRun {
  if (run.stock.length !== 0 || run.waste.length === 0) return run;
  return { ...run, stock: run.waste.slice().reverse(), waste: [] };
}

export function moveWasteToTableau(run: SolitaireRun, toPile: number): SolitaireRun {
  if (run.waste.length === 0) return run;
  const card = run.waste[run.waste.length - 1];
  if (!canPlaceOnTableau(run.tableau[toPile], card)) return run;
  const tableau = replaceAt(run.tableau, toPile, [...run.tableau[toPile], { card, faceUp: true }]);
  return { ...run, waste: run.waste.slice(0, -1), tableau };
}

export function moveWasteToFoundation(run: SolitaireRun): SolitaireRun {
  if (run.waste.length === 0) return run;
  const card = run.waste[run.waste.length - 1];
  if (!canMoveCardToFoundation(run.foundations, card)) return run;
  const foundations = replaceAt(run.foundations, suitIndex(card.suit), [...run.foundations[suitIndex(card.suit)], card]);
  return { ...run, waste: run.waste.slice(0, -1), foundations };
}

export function moveTableauToTableau(run: SolitaireRun, fromPile: number, cardIndex: number, toPile: number): SolitaireRun {
  if (fromPile === toPile) return run;
  const sequence = getMovableSequence(run.tableau[fromPile], cardIndex);
  if (!sequence) return run;
  if (!canPlaceOnTableau(run.tableau[toPile], sequence[0])) return run;

  const remainingSource = flipExposedTop(run.tableau[fromPile].slice(0, cardIndex));
  const destPile = [...run.tableau[toPile], ...sequence.map((card) => ({ card, faceUp: true }))];
  let tableau = replaceAt(run.tableau, fromPile, remainingSource);
  tableau = replaceAt(tableau, toPile, destPile);
  return { ...run, tableau };
}

export function moveTableauToFoundation(run: SolitaireRun, fromPile: number): SolitaireRun {
  const pile = run.tableau[fromPile];
  if (pile.length === 0) return run;
  const top = pile[pile.length - 1];
  if (!top.faceUp || !canMoveCardToFoundation(run.foundations, top.card)) return run;

  const tableau = replaceAt(run.tableau, fromPile, flipExposedTop(pile.slice(0, -1)));
  const foundations = replaceAt(run.foundations, suitIndex(top.card.suit), [...run.foundations[suitIndex(top.card.suit)], top.card]);
  return { ...run, tableau, foundations };
}

export function moveFoundationToTableau(run: SolitaireRun, suitIdx: number, toPile: number): SolitaireRun {
  const pile = run.foundations[suitIdx];
  if (pile.length === 0) return run;
  const card = pile[pile.length - 1];
  if (!canPlaceOnTableau(run.tableau[toPile], card)) return run;

  const foundations = replaceAt(run.foundations, suitIdx, pile.slice(0, -1));
  const tableau = replaceAt(run.tableau, toPile, [...run.tableau[toPile], { card, faceUp: true }]);
  return { ...run, foundations, tableau };
}

export function isWon(run: SolitaireRun): boolean {
  return run.foundations.every((pile) => pile.length === RANKS.length);
}

export function createInitialDeal(rng: () => number = Math.random): SolitaireRun {
  const deck = shuffle(createDeck(), rng);
  let i = 0;
  const tableau: Tableau = [];
  for (let pileIndex = 0; pileIndex < TABLEAU_PILES; pileIndex++) {
    const pile: TableauCard[] = [];
    for (let depth = 0; depth <= pileIndex; depth++) {
      pile.push({ card: deck[i++], faceUp: depth === pileIndex });
    }
    tableau.push(pile);
  }
  return {
    stock: deck.slice(i),
    waste: [],
    foundations: SUITS.map(() => []),
    tableau,
  };
}

// ============================================================
// Persisted-state validation
// ============================================================

export type PersistedRun = SolitaireRun;

function isValidCard(value: unknown): value is Card {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.rank === "string" && (RANKS as readonly string[]).includes(v.rank) && typeof v.suit === "string" && (SUITS as readonly string[]).includes(v.suit);
}

function isValidTableauCard(value: unknown): value is TableauCard {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return isValidCard(v.card) && typeof v.faceUp === "boolean";
}

function isValidFoundationPile(pile: unknown, suit: Suit): pile is Card[] {
  if (!Array.isArray(pile) || !pile.every(isValidCard)) return false;
  for (let r = 0; r < pile.length; r++) {
    if (pile[r].suit !== suit) return false;
    if (rankValue(pile[r].rank) !== r) return false;
  }
  return true;
}

function isValidTableauPile(pile: unknown): pile is TableauCard[] {
  if (!Array.isArray(pile) || !pile.every(isValidTableauCard)) return false;
  let seenFaceUp = false;
  for (const tc of pile as TableauCard[]) {
    if (tc.faceUp) seenFaceUp = true;
    else if (seenFaceUp) return false; // a face-down card can never sit above a face-up one
  }
  const firstFaceUp = (pile as TableauCard[]).findIndex((tc) => tc.faceUp);
  if (firstFaceUp === -1) return true;
  const sequence = (pile as TableauCard[]).slice(firstFaceUp).map((tc) => tc.card);
  return isValidTableauSequence(sequence);
}

/**
 * Full structural validation of a persisted run: correct shapes, every
 * foundation ascending same-suit from Ace, every tableau pile's face-down
 * cards forming a bottom prefix with a valid alternating-descending face-up
 * suffix, and - the strongest check - exactly the 52 standard card
 * identities present across every zone with no duplicates or omissions.
 */
export function isValidPersistedRun(value: unknown): value is PersistedRun {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;

  if (!Array.isArray(v.stock) || !v.stock.every(isValidCard)) return false;
  if (!Array.isArray(v.waste) || !v.waste.every(isValidCard)) return false;

  if (!Array.isArray(v.foundations) || v.foundations.length !== SUITS.length) return false;
  for (let i = 0; i < SUITS.length; i++) {
    if (!isValidFoundationPile(v.foundations[i], SUITS[i])) return false;
  }

  if (!Array.isArray(v.tableau) || v.tableau.length !== TABLEAU_PILES) return false;
  for (const pile of v.tableau) {
    if (!isValidTableauPile(pile)) return false;
  }

  const allCards: Card[] = [
    ...(v.stock as Card[]),
    ...(v.waste as Card[]),
    ...(v.foundations as Card[][]).flat(),
    ...(v.tableau as TableauCard[][]).flatMap((pile) => pile.map((tc) => tc.card)),
  ];
  if (allCards.length !== 52) return false;
  const keys = new Set(allCards.map(cardKey));
  // Rank/suit are both already constrained to their fixed enums above, so
  // 52 unique keys can only mean exactly the standard deck - no separate
  // "every identity present" pass is needed on top of this.
  return keys.size === 52;
}
