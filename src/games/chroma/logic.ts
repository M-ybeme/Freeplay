/*
 * Chroma Clash: a colour-matching shedding game for four players. You sit
 * at seat 0 (South); computer players at 1 West, 2 North, 3 East. With
 * direction +1 play goes 0 -> 1 -> 2 -> 3 (clockwise round the table).
 *
 * The round state carries its own random-number state, so reshuffling the
 * draw pile mid-round keeps every rule a pure function (and a saved game
 * resumes exactly).
 */

export type Color = "cyan" | "pink" | "green" | "orange";
export type Kind = "number" | "skip" | "reverse" | "draw2" | "wild" | "wild4";
export type Seat = 0 | 1 | 2 | 3;
export type Direction = 1 | -1;

export interface ChromaCard {
  /** Unique 0-107, for identity and React keys. */
  id: number;
  kind: Kind;
  /** Null for wilds. */
  color: Color | null;
  /** 0-9 for number cards. */
  value?: number;
}

export const COLORS: readonly Color[] = ["cyan", "pink", "green", "orange"];
export const SEATS: readonly Seat[] = [0, 1, 2, 3];
export const HAND_START = 7;
export const DECK_SIZE = 108;
export const TARGETS = [200, 500] as const;
export type Target = (typeof TARGETS)[number];
export const DEFAULT_TARGET: Target = 500;
/** Cards drawn for not calling "last card" in time. */
export const LAST_CARD_PENALTY = 2;

export type Phase =
  /** `turn` must play a card or draw. */
  | "playing"
  /** `turn` drew a playable card: play it or pass. */
  | "drawn"
  /** `turn` must name a colour (a wild was just played, or turned up to start). */
  | "choose-color"
  | "round-over";

/** A player down to one card, until the next player acts. */
export interface LastCardWindow {
  seat: Seat;
  called: boolean;
}

/** What just happened, for the status line. */
export type Event =
  | { type: "start"; card: ChromaCard }
  | { type: "play"; seat: Seat; card: ChromaCard }
  | { type: "draw"; seat: Seat; count: number }
  | { type: "pass"; seat: Seat }
  | { type: "color"; seat: Seat; color: Color }
  | { type: "penalty"; seat: Seat; count: number; reason: "draw2" | "wild4" | "caught" }
  | { type: "call"; seat: Seat };

export interface RoundState {
  hands: ChromaCard[][];
  drawPile: ChromaCard[];
  /** Last element is the top card. */
  discard: ChromaCard[];
  /** The colour to match (a wild's chosen colour, otherwise the top card's). */
  color: Color;
  turn: Seat;
  direction: Direction;
  phase: Phase;
  /** Id of the card just drawn, which is the only one playable in "drawn". */
  drawnCard: number | null;
  /** How the turn moves on once a colour is chosen. */
  colorEffect: "wild" | "wild4" | "start" | null;
  lastCard: LastCardWindow | null;
  /** Called "last card" early, while holding two cards. */
  preCalled: Seat | null;
  winner: Seat | null;
  events: Event[];
  rng: number;
}

export interface RoundResult {
  winner: Seat;
  points: number;
  /** Points left in each seat's hand (0 for the winner). */
  leftovers: number[];
  cardsLeft: number[];
}

export type GameStatus = "playing" | "won" | "lost";

export interface GameState {
  version: 1;
  target: Target;
  scores: number[];
  round: RoundState;
  roundNumber: number;
  dealer: Seat;
  lastResult: RoundResult | null;
  status: GameStatus;
}

// ---------- Random ----------

/** mulberry32 step: returns [value in 0..1, next state]. */
export function nextRandom(state: number): [number, number] {
  const a = (state + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, a];
}

function shuffleWith<T>(items: readonly T[], rng: number): [T[], number] {
  const out = [...items];
  let r = rng;
  for (let i = out.length - 1; i > 0; i--) {
    const [x, next] = nextRandom(r);
    r = next;
    const j = Math.floor(x * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return [out, r];
}

// ---------- Cards ----------

export function createDeck(): ChromaCard[] {
  const deck: ChromaCard[] = [];
  let id = 0;
  for (const color of COLORS) {
    deck.push({ id: id++, kind: "number", color, value: 0 });
    for (let v = 1; v <= 9; v++) {
      deck.push({ id: id++, kind: "number", color, value: v });
      deck.push({ id: id++, kind: "number", color, value: v });
    }
    for (const kind of ["skip", "reverse", "draw2"] as const) {
      deck.push({ id: id++, kind, color });
      deck.push({ id: id++, kind, color });
    }
  }
  for (let i = 0; i < 4; i++) deck.push({ id: id++, kind: "wild", color: null });
  for (let i = 0; i < 4; i++) deck.push({ id: id++, kind: "wild4", color: null });
  return deck;
}

export function cardPoints(card: ChromaCard): number {
  if (card.kind === "number") return card.value ?? 0;
  if (card.kind === "wild" || card.kind === "wild4") return 50;
  return 20;
}

export function isWild(card: ChromaCard): boolean {
  return card.kind === "wild" || card.kind === "wild4";
}

const COLOR_NAME: Record<Color, string> = { cyan: "Cyan", pink: "Pink", green: "Green", orange: "Orange" };
const KIND_NAME: Record<Kind, string> = { number: "", skip: "Skip", reverse: "Reverse", draw2: "Draw Two", wild: "Wild", wild4: "Wild Draw Four" };

export function colorName(color: Color): string {
  return COLOR_NAME[color];
}

export function cardName(card: ChromaCard): string {
  if (isWild(card)) return KIND_NAME[card.kind];
  const face = card.kind === "number" ? String(card.value) : KIND_NAME[card.kind];
  return `${COLOR_NAME[card.color!]} ${face}`;
}

/** Hand order: by colour, then numbers low to high, then actions; wilds last. */
export function sortHand(cards: readonly ChromaCard[]): ChromaCard[] {
  const kindOrder: Record<Kind, number> = { number: 0, skip: 1, reverse: 2, draw2: 3, wild: 4, wild4: 5 };
  const colorOrder = (c: ChromaCard) => (c.color ? COLORS.indexOf(c.color) : 4);
  return [...cards].sort(
    (a, b) => colorOrder(a) - colorOrder(b) || kindOrder[a.kind] - kindOrder[b.kind] || (a.value ?? 0) - (b.value ?? 0) || a.id - b.id,
  );
}

// ---------- Matching ----------

export function topCard(round: RoundState): ChromaCard {
  return round.discard[round.discard.length - 1];
}

/** Does `card` match the pile (ignoring the Draw Four restriction)? */
export function matches(card: ChromaCard, top: ChromaCard, color: Color): boolean {
  if (isWild(card)) return true;
  if (card.color === color) return true;
  if (card.kind === "number") return top.kind === "number" && top.value === card.value;
  return card.kind === top.kind;
}

/**
 * Cards `hand` may play now. A Wild Draw Four is only allowed while
 * holding nothing of the colour to match.
 */
export function legalPlays(hand: readonly ChromaCard[], top: ChromaCard, color: Color): ChromaCard[] {
  const hasColor = hand.some((c) => c.color === color);
  return hand.filter((c) => matches(c, top, color) && !(c.kind === "wild4" && hasColor));
}

export function stepSeat(seat: Seat, direction: Direction, steps = 1): Seat {
  return ((((seat + direction * steps) % 4) + 4) % 4) as Seat;
}

// ---------- Drawing ----------

/**
 * Take `count` cards for `seat`, reshuffling the discard pile (all but its
 * top card) into a new draw pile when it runs out. Stops early if there
 * is truly nothing left to draw.
 */
export function drawCards(round: RoundState, seat: Seat, count: number): { round: RoundState; drawn: ChromaCard[] } {
  let drawPile = round.drawPile;
  let discard = round.discard;
  let rng = round.rng;
  const drawn: ChromaCard[] = [];
  for (let i = 0; i < count; i++) {
    if (drawPile.length === 0) {
      if (discard.length <= 1) break;
      const top = discard[discard.length - 1];
      [drawPile, rng] = shuffleWith(discard.slice(0, -1), rng);
      discard = [top];
    }
    drawn.push(drawPile[drawPile.length - 1]);
    drawPile = drawPile.slice(0, -1);
  }
  const hands = round.hands.slice();
  hands[seat] = sortHand([...hands[seat], ...drawn]);
  return { round: { ...round, hands, drawPile, discard, rng }, drawn };
}

// ---------- Dealing ----------

/**
 * Deal seven each and turn up the first card. A Wild Draw Four can't
 * start the pile (it goes back in and another is turned). Any other
 * action card turned up takes effect on the first player, as if the
 * dealer had played it.
 */
export function startRound(dealer: Seat, seed: number): RoundState {
  let [deck, rng] = shuffleWith(createDeck(), seed);
  const hands: ChromaCard[][] = [[], [], [], []];
  for (let i = 0; i < HAND_START; i++) for (const s of SEATS) hands[s].push(deck.pop()!);
  let first = deck.pop()!;
  while (first.kind === "wild4") {
    const [x, next] = nextRandom(rng);
    rng = next;
    deck.splice(Math.floor(x * deck.length), 0, first);
    first = deck.pop()!;
  }
  let round: RoundState = {
    hands: hands.map(sortHand),
    drawPile: deck,
    discard: [first],
    color: first.color ?? "cyan",
    turn: stepSeat(dealer, 1),
    direction: 1,
    phase: "playing",
    drawnCard: null,
    colorEffect: null,
    lastCard: null,
    preCalled: null,
    winner: null,
    events: [{ type: "start", card: first }],
    rng,
  };
  const leftOfDealer = stepSeat(dealer, 1);
  switch (first.kind) {
    case "wild":
      // The first player names the colour, then plays as normal.
      round = { ...round, phase: "choose-color", colorEffect: "start" };
      break;
    case "skip":
      round = { ...round, turn: stepSeat(dealer, 1, 2) };
      break;
    case "reverse":
      // Play starts with the dealer and goes the other way.
      round = { ...round, direction: -1, turn: dealer };
      break;
    case "draw2": {
      const { round: r } = drawCards(round, leftOfDealer, 2);
      round = { ...r, turn: stepSeat(dealer, 1, 2), events: [...r.events, { type: "penalty", seat: leftOfDealer, count: 2, reason: "draw2" }] };
      break;
    }
  }
  return round;
}

export function newGame(target: Target, seed: number, dealer: Seat = 3): GameState {
  return {
    version: 1,
    target,
    scores: [0, 0, 0, 0],
    round: startRound(dealer, seed),
    roundNumber: 1,
    dealer,
    lastResult: null,
    status: "playing",
  };
}

// ---------- Turns ----------

/**
 * Close any open last-card window: the next player acting ends it. A
 * player who didn't call is caught only if `caught` (the hook decides:
 * the computer players always catch you; you catch them with Catch!).
 */
function closeWindow(round: RoundState): RoundState {
  return round.lastCard ? { ...round, lastCard: null } : round;
}

/** Penalise an uncalled last card, if there is one. */
export function catchLastCard(round: RoundState): RoundState {
  const w = round.lastCard;
  if (!w || w.called || round.phase === "round-over") return round;
  const { round: r } = drawCards(round, w.seat, LAST_CARD_PENALTY);
  return { ...r, lastCard: null, events: [{ type: "penalty", seat: w.seat, count: LAST_CARD_PENALTY, reason: "caught" }] };
}

/** Call "last card": with two cards on your turn (ahead of playing), or with one while the window is open. */
export function callLastCard(round: RoundState, seat: Seat): RoundState {
  if (round.lastCard && round.lastCard.seat === seat && !round.lastCard.called) {
    return { ...round, lastCard: { seat, called: true }, events: [...round.events, { type: "call", seat }] };
  }
  if (round.turn === seat && round.hands[seat].length === 2 && round.preCalled !== seat && (round.phase === "playing" || round.phase === "drawn")) {
    return { ...round, preCalled: seat, events: [...round.events, { type: "call", seat }] };
  }
  return round;
}

/** Move the turn on `steps` seats in the current direction. */
function advance(round: RoundState, from: Seat, steps = 1): RoundState {
  return { ...round, turn: stepSeat(from, round.direction, steps), phase: "playing", drawnCard: null, colorEffect: null };
}

function endRound(round: RoundState, winner: Seat): RoundState {
  return { ...round, phase: "round-over", winner, lastCard: null, drawnCard: null, colorEffect: null };
}

/** Apply a played card's effect and pass the turn on. */
function resolve(round: RoundState, seat: Seat, card: ChromaCard): RoundState {
  const next = stepSeat(seat, round.direction);
  const out = round.hands[seat].length === 0;
  switch (card.kind) {
    case "skip":
      return out ? endRound(round, seat) : advance(round, seat, 2);
    case "reverse": {
      const r = { ...round, direction: (-round.direction) as Direction };
      return out ? endRound(r, seat) : advance(r, seat);
    }
    case "draw2": {
      const { round: r } = drawCards(round, next, 2);
      const withEvent = { ...r, events: [...r.events, { type: "penalty" as const, seat: next, count: 2, reason: "draw2" as const }] };
      return out ? endRound(withEvent, seat) : advance(withEvent, seat, 2);
    }
    case "wild4": {
      const { round: r } = drawCards(round, next, 4);
      const withEvent = { ...r, events: [...r.events, { type: "penalty" as const, seat: next, count: 4, reason: "wild4" as const }] };
      return out ? endRound(withEvent, seat) : advance(withEvent, seat, 2);
    }
    default:
      return out ? endRound(round, seat) : advance(round, seat);
  }
}

export function playCard(round: RoundState, seat: Seat, cardId: number): RoundState {
  if (round.turn !== seat) return round;
  if (round.phase !== "playing" && !(round.phase === "drawn" && round.drawnCard === cardId)) return round;
  const hand = round.hands[seat];
  const card = hand.find((c) => c.id === cardId);
  if (!card || !legalPlays(hand, topCard(round), round.color).some((c) => c.id === cardId)) return round;

  let r = closeWindow(round);
  const hands = r.hands.slice();
  hands[seat] = hand.filter((c) => c.id !== cardId);
  r = { ...r, hands, discard: [...r.discard, card], events: [{ type: "play", seat, card }] };

  // Down to one card: open the last-card window (already called if called early).
  if (hands[seat].length === 1) r = { ...r, lastCard: { seat, called: r.preCalled === seat } };
  r = { ...r, preCalled: null };

  if (isWild(card)) {
    // Going out on a wild needs no colour; the Draw Four still lands.
    if (hands[seat].length === 0) return resolve({ ...r, color: r.color }, seat, card);
    return { ...r, phase: "choose-color", colorEffect: card.kind as "wild" | "wild4", drawnCard: null };
  }
  return resolve({ ...r, color: card.color! }, seat, card);
}

export function chooseColor(round: RoundState, seat: Seat, color: Color): RoundState {
  if (round.phase !== "choose-color" || round.turn !== seat || !COLORS.includes(color)) return round;
  const r: RoundState = { ...round, color, events: [...round.events, { type: "color", seat, color }] };
  if (round.colorEffect === "start") return { ...r, phase: "playing", colorEffect: null };
  return resolve(r, seat, topCard(round));
}

/** Draw one card. If it can be played, the drawer may play it or pass. */
export function drawForTurn(round: RoundState, seat: Seat): RoundState {
  if (round.phase !== "playing" || round.turn !== seat) return round;
  const closed = closeWindow(round);
  const { round: r, drawn } = drawCards(closed, seat, 1);
  const events: Event[] = [{ type: "draw", seat, count: drawn.length }];
  const card = drawn[0];
  if (card && legalPlays(r.hands[seat], topCard(r), r.color).some((c) => c.id === card.id)) {
    return { ...r, phase: "drawn", drawnCard: card.id, events };
  }
  return { ...advance(r, seat), preCalled: null, events };
}

export function pass(round: RoundState, seat: Seat): RoundState {
  if (round.phase !== "drawn" || round.turn !== seat) return round;
  return { ...advance(round, seat), preCalled: null, events: [{ type: "pass", seat }] };
}

// ---------- Scoring ----------

export function scoreRound(round: RoundState): RoundResult | null {
  if (round.phase !== "round-over" || round.winner === null) return null;
  const leftovers = round.hands.map((h) => h.reduce((n, c) => n + cardPoints(c), 0));
  return {
    winner: round.winner,
    points: leftovers.reduce((a, b) => a + b, 0),
    leftovers,
    cardsLeft: round.hands.map((h) => h.length),
  };
}

/** Score a finished round into the game, once. */
export function finishRound(game: GameState): GameState {
  if (game.lastResult || game.round.phase !== "round-over") return game;
  const result = scoreRound(game.round);
  if (!result) return game;
  const scores = game.scores.slice();
  scores[result.winner] += result.points;
  const over = scores[result.winner] >= game.target;
  return {
    ...game,
    scores,
    lastResult: result,
    status: over ? (result.winner === 0 ? "won" : "lost") : "playing",
  };
}

export function nextRound(game: GameState, seed: number): GameState {
  if (game.status !== "playing" || !game.lastResult) return game;
  const dealer = stepSeat(game.dealer, 1);
  return { ...game, round: startRound(dealer, seed), roundNumber: game.roundNumber + 1, dealer, lastResult: null };
}

/** A saved game is resumed only if it still holds exactly one full deck. */
export function isSavedGame(value: unknown): value is GameState {
  const g = value as GameState | null;
  if (!g || g.version !== 1 || !TARGETS.includes(g.target) || !g.round || !Array.isArray(g.round.hands)) return false;
  const r = g.round;
  if (r.hands.length !== 4 || !Array.isArray(r.drawPile) || !Array.isArray(r.discard) || r.discard.length === 0) return false;
  const ids = new Set([...r.hands.flat(), ...r.drawPile, ...r.discard].map((c) => c.id));
  return ids.size === DECK_SIZE && r.hands.flat().length + r.drawPile.length + r.discard.length === DECK_SIZE;
}
