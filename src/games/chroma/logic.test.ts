import { describe, expect, it } from "vitest";
import {
  type ChromaCard,
  type Color,
  type GameState,
  type RoundState,
  type Seat,
  callLastCard,
  cardPoints,
  catchLastCard,
  chooseColor,
  createDeck,
  DECK_SIZE,
  drawCards,
  drawForTurn,
  finishRound,
  isSavedGame,
  legalPlays,
  newGame,
  nextRound,
  pass,
  playCard,
  scoreRound,
  sortHand,
  startRound,
  stepSeat,
} from "./logic";

let nextId = 1000;
const num = (color: Color, value: number): ChromaCard => ({ id: nextId++, kind: "number", color, value });
const act = (color: Color, kind: "skip" | "reverse" | "draw2"): ChromaCard => ({ id: nextId++, kind, color });
const wild = (kind: "wild" | "wild4" = "wild"): ChromaCard => ({ id: nextId++, kind, color: null });

/** A hand-built round: `top` on the discard, filler cards in the draw pile. */
function round(hands: ChromaCard[][], top: ChromaCard, extra: Partial<RoundState> = {}): RoundState {
  const drawPile = Array.from({ length: 20 }, (_, i) => num("cyan", (i % 9) + 1));
  return {
    hands,
    drawPile,
    discard: [top],
    color: top.color ?? "cyan",
    turn: 0,
    direction: 1,
    phase: "playing",
    drawnCard: null,
    colorEffect: null,
    lastCard: null,
    preCalled: null,
    winner: null,
    events: [],
    rng: 1,
    ...extra,
  };
}
const filler = (n: number) => Array.from({ length: n }, () => num("orange", 5));

describe("deck", () => {
  it("has 108 cards in the classic mix", () => {
    const deck = createDeck();
    expect(deck).toHaveLength(DECK_SIZE);
    expect(new Set(deck.map((c) => c.id)).size).toBe(DECK_SIZE);
    for (const color of ["cyan", "pink", "green", "orange"] as const) {
      const mine = deck.filter((c) => c.color === color);
      expect(mine).toHaveLength(25);
      expect(mine.filter((c) => c.kind === "number" && c.value === 0)).toHaveLength(1);
      expect(mine.filter((c) => c.kind === "number" && c.value === 7)).toHaveLength(2);
      expect(mine.filter((c) => c.kind === "draw2")).toHaveLength(2);
    }
    expect(deck.filter((c) => c.kind === "wild")).toHaveLength(4);
    expect(deck.filter((c) => c.kind === "wild4")).toHaveLength(4);
  });

  it("scores numbers at face value, actions 20, wilds 50", () => {
    expect(cardPoints(num("pink", 7))).toBe(7);
    expect(cardPoints(act("pink", "skip"))).toBe(20);
    expect(cardPoints(wild("wild4"))).toBe(50);
  });

  it("sorts by colour, then value, wilds last", () => {
    const sorted = sortHand([wild(), num("pink", 3), num("cyan", 9), act("cyan", "skip"), num("cyan", 1)]);
    expect(sorted.map((c) => `${c.color}:${c.kind}:${c.value ?? ""}`)).toEqual([
      "cyan:number:1",
      "cyan:number:9",
      "cyan:skip:",
      "pink:number:3",
      "null:wild:",
    ]);
  });
});

describe("dealing", () => {
  it("deals seven each and keeps one whole deck", () => {
    for (let seed = 1; seed < 60; seed++) {
      const r = startRound(3, seed);
      const total = r.hands.flat().length + r.drawPile.length + r.discard.length;
      expect(total).toBe(DECK_SIZE);
      expect(r.discard[0].kind).not.toBe("wild4");
      const drew2 = r.discard[0].kind === "draw2";
      expect(r.hands.map((h) => h.length).sort()).toEqual(drew2 ? [7, 7, 7, 9] : [7, 7, 7, 7]);
    }
  });

  it("applies a turned-up action card to the first player", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed < 400; seed++) {
      const r = startRound(3, seed);
      const kind = r.discard[0].kind;
      seen.add(kind);
      if (kind === "skip") expect(r.turn).toBe(1);
      else if (kind === "reverse") expect([r.turn, r.direction]).toEqual([3, -1]);
      else if (kind === "draw2") expect([r.turn, r.hands[0].length]).toEqual([1, 9]);
      else if (kind === "wild") expect([r.turn, r.phase]).toEqual([0, "choose-color"]);
      else expect([r.turn, r.phase, r.color]).toEqual([0, "playing", r.discard[0].color]);
    }
    expect(seen).toEqual(new Set(["number", "skip", "reverse", "draw2", "wild"]));
  });

  it("is repeatable from a seed", () => {
    expect(startRound(1, 42)).toEqual(startRound(1, 42));
  });
});

describe("legal plays", () => {
  it("matches colour, number or symbol; wilds always", () => {
    const hand = [num("cyan", 2), num("pink", 5), act("green", "skip"), num("orange", 9), wild()];
    const legal = legalPlays(hand, num("pink", 2), "pink");
    expect(legal.map((c) => c.id)).toEqual([hand[0].id, hand[1].id, hand[4].id]);
    expect(legalPlays(hand, act("pink", "skip"), "pink").map((c) => c.id)).toEqual([hand[1].id, hand[2].id, hand[4].id]);
  });

  it("follows a wild's chosen colour, not the card", () => {
    const hand = [num("green", 3), num("pink", 3)];
    expect(legalPlays(hand, wild(), "green").map((c) => c.id)).toEqual([hand[0].id]);
  });

  it("allows Wild Draw Four only without the colour to match", () => {
    const four = wild("wild4");
    expect(legalPlays([num("cyan", 1), four], num("cyan", 8), "cyan")).not.toContain(four);
    // A same-number card of another colour doesn't count against it.
    expect(legalPlays([num("pink", 8), four], num("cyan", 8), "cyan")).toContain(four);
  });

  it("rejects a card that doesn't match, or out of turn", () => {
    const hand = [num("orange", 4), ...filler(3)];
    const r = round([hand, filler(5), filler(5), filler(5)], num("cyan", 7), { color: "cyan" });
    expect(playCard(r, 0, hand[0].id)).toBe(r);
    const r2 = round([[num("cyan", 4)], [num("cyan", 1)], filler(5), filler(5)], num("cyan", 7));
    expect(playCard(r2, 1, r2.hands[1][0].id)).toBe(r2);
  });
});

describe("turns", () => {
  const hands = () => [[num("cyan", 1), num("cyan", 2), num("pink", 9)], filler(5), filler(5), filler(5)];

  it("passes play to the next seat in the current direction", () => {
    const r = round(hands(), num("cyan", 7));
    const after = playCard(r, 0, r.hands[0][0].id);
    expect([after.turn, after.color, after.hands[0].length]).toEqual([1, "cyan", 2]);
    expect(stepSeat(0, -1)).toBe(3);
    const back = playCard({ ...r, direction: -1 }, 0, r.hands[0][0].id);
    expect(back.turn).toBe(3);
  });

  it("skip jumps a seat; reverse turns play round", () => {
    const h = hands();
    h[0].push(act("cyan", "skip"), act("cyan", "reverse"));
    const r = round(h, num("cyan", 7));
    expect(playCard(r, 0, h[0][3].id).turn).toBe(2);
    const rev = playCard(r, 0, h[0][4].id);
    expect([rev.turn, rev.direction]).toEqual([3, -1]);
  });

  it("draw two makes the next player draw and lose their turn", () => {
    const h = hands();
    h[0].push(act("cyan", "draw2"));
    const r = playCard(round(h, num("cyan", 7)), 0, h[0][3].id);
    expect([r.turn, r.hands[1].length]).toEqual([2, 7]);
    expect(r.events).toContainEqual({ type: "penalty", seat: 1, count: 2, reason: "draw2" });
  });

  it("wilds wait for a colour, then wild draw four lands", () => {
    const h = [[num("pink", 1), num("pink", 2), wild("wild4")], filler(5), filler(5), filler(5)];
    const r = playCard(round(h, num("cyan", 7)), 0, h[0][2].id);
    expect([r.phase, r.turn]).toEqual(["choose-color", 0]);
    expect(chooseColor(r, 1, "pink")).toBe(r);
    const done = chooseColor(r, 0, "pink");
    expect([done.phase, done.color, done.turn, done.hands[1].length]).toEqual(["playing", "pink", 2, 9]);
  });

  it("a plain wild just sets the colour", () => {
    const h = [[num("pink", 1), wild(), num("pink", 3)], filler(5), filler(5), filler(5)];
    const r = chooseColor(playCard(round(h, num("cyan", 7)), 0, h[0][1].id), 0, "green");
    expect([r.color, r.turn, r.hands[1].length]).toEqual(["green", 1, 5]);
  });
});

describe("drawing", () => {
  it("draws one; if it fits you may play it or pass", () => {
    const r = round([[num("orange", 1)], filler(5), filler(5), filler(5)], num("cyan", 7));
    // The draw pile is all cyan, so the drawn card plays.
    const drew = drawForTurn(r, 0);
    expect([drew.phase, drew.turn, drew.hands[0].length]).toEqual(["drawn", 0, 2]);
    // Only the drawn card can be played now.
    expect(playCard(drew, 0, r.hands[0][0].id)).toBe(drew);
    const played = playCard(drew, 0, drew.drawnCard!);
    expect([played.turn, played.hands[0].length]).toEqual([1, 1]);
    const passed = pass(drew, 0);
    expect([passed.turn, passed.phase, passed.hands[0].length]).toEqual([1, "playing", 2]);
  });

  it("moves on at once if the drawn card doesn't fit", () => {
    const r = round([[num("orange", 1)], filler(5), filler(5), filler(5)], num("pink", 7), { color: "pink" });
    const drew = drawForTurn(r, 0);
    expect([drew.phase, drew.turn, drew.hands[0].length]).toEqual(["playing", 1, 2]);
  });

  it("reshuffles the discard pile (keeping the top card) when the deck runs out", () => {
    const top = num("cyan", 7);
    const under = [num("pink", 1), num("pink", 2), num("pink", 3)];
    const r = round([[num("orange", 1)], filler(5), filler(5), filler(5)], top, { drawPile: [], discard: [...under, top] });
    const { round: after, drawn } = drawCards(r, 1, 2);
    expect(drawn).toHaveLength(2);
    expect(after.discard).toEqual([top]);
    expect(after.drawPile).toHaveLength(1);
  });

  it("stops if there is nothing left to draw", () => {
    const r = round([[num("orange", 1)], filler(5), filler(5), filler(5)], num("cyan", 7), { drawPile: [] });
    const { drawn } = drawCards(r, 1, 4);
    expect(drawn).toHaveLength(0);
    expect(drawForTurn(r, 0).turn).toBe(1);
  });
});

describe("last card", () => {
  const twoLeft = () => round([[num("cyan", 1), num("cyan", 2)], filler(5), filler(5), filler(5)], num("cyan", 7));

  it("opens an uncalled window when you go down to one", () => {
    const s = twoLeft();
    const r = playCard(s, 0, s.hands[0][0].id);
    expect(r.lastCard).toEqual({ seat: 0, called: false });
  });

  it("calling inside the window is safe", () => {
    const s = twoLeft();
    const r = callLastCard(playCard(s, 0, s.hands[0][0].id), 0);
    expect(r.lastCard).toEqual({ seat: 0, called: true });
    expect(catchLastCard(r)).toBe(r);
  });

  it("calling early with two cards carries into the window", () => {
    const s = twoLeft();
    const called = callLastCard(s, 0);
    expect(called.preCalled).toBe(0);
    expect(playCard(called, 0, s.hands[0][0].id).lastCard).toEqual({ seat: 0, called: true });
    // Not with three cards.
    const three = round([[num("cyan", 1), num("cyan", 2), num("cyan", 3)], filler(5), filler(5), filler(5)], num("cyan", 7));
    expect(callLastCard(three, 0)).toBe(three);
  });

  it("being caught costs two cards", () => {
    const s = twoLeft();
    const r = catchLastCard(playCard(s, 0, s.hands[0][0].id));
    expect([r.hands[0].length, r.lastCard]).toEqual([3, null]);
    expect(r.events).toEqual([{ type: "penalty", seat: 0, count: 2, reason: "caught" }]);
  });

  it("the next player acting closes the window", () => {
    const s = twoLeft();
    const r = playCard(s, 0, s.hands[0][0].id);
    expect(drawForTurn(r, 1).lastCard).toBeNull();
  });
});

describe("scoring", () => {
  function wonRound(): RoundState {
    const h = [[num("cyan", 1)], [num("pink", 9), act("green", "skip")], [wild()], [num("orange", 0)]];
    return playCard(round(h, num("cyan", 7)), 0 as Seat, h[0][0].id);
  }

  it("ends the round when a hand empties and scores the others' cards", () => {
    const r = wonRound();
    expect([r.phase, r.winner]).toEqual(["round-over", 0]);
    expect(scoreRound(r)).toEqual({ winner: 0, points: 79, leftovers: [0, 29, 50, 0], cardsLeft: [0, 2, 1, 1] });
  });

  it("going out on a draw card still makes the next player draw", () => {
    const h = [[act("cyan", "draw2")], filler(5), filler(5), filler(5)];
    const r = playCard(round(h, num("cyan", 7)), 0, h[0][0].id);
    expect([r.phase, r.hands[1].length]).toEqual(["round-over", 7]);
  });

  it("going out on a wild needs no colour", () => {
    const h = [[wild()], filler(5), filler(5), filler(5)];
    expect(playCard(round(h, num("cyan", 7)), 0, h[0][0].id).phase).toBe("round-over");
  });

  it("adds the round once and ends the game at the target", () => {
    const game: GameState = { ...newGame(200, 5), round: wonRound(), scores: [130, 40, 0, 0] };
    const scored = finishRound(game);
    expect([scored.scores[0], scored.status]).toEqual([209, "won"]);
    expect(finishRound(scored)).toBe(scored);
    expect(nextRound(scored, 9)).toBe(scored);
  });

  it("deals the next round with the dealer moving on", () => {
    const scored = finishRound({ ...newGame(500, 5), round: wonRound() });
    expect(scored.status).toBe("playing");
    const next = nextRound(scored, 9);
    expect([next.roundNumber, next.dealer, next.lastResult]).toEqual([2, 0, null]);
    expect(next.round.phase === "playing" || next.round.phase === "choose-color").toBe(true);
  });

  it("a computer reaching the target loses you the game", () => {
    const h = [[num("pink", 4)], [num("cyan", 1)], [wild()], [wild()]];
    const r = playCard(round(h, num("cyan", 7), { turn: 1 }), 1, h[1][0].id);
    const scored = finishRound({ ...newGame(200, 5), round: r, scores: [0, 150, 0, 0] });
    expect([scored.scores[1], scored.status]).toEqual([254, "lost"]);
  });
});

describe("saved games", () => {
  it("accepts a fresh game and rejects broken ones", () => {
    const g = newGame(500, 11);
    expect(isSavedGame(JSON.parse(JSON.stringify(g)))).toBe(true);
    expect(isSavedGame(null)).toBe(false);
    expect(isSavedGame({ ...g, version: 2 })).toBe(false);
    expect(isSavedGame({ ...g, target: 300 })).toBe(false);
    const missing = { ...g, round: { ...g.round, drawPile: g.round.drawPile.slice(1) } };
    expect(isSavedGame(missing)).toBe(false);
  });
});
