import { describe, expect, it } from "vitest";
import { type CpuMove, chooseCard, chooseWildColor, cpuMove } from "./ai";
import {
  type ChromaCard,
  type Color,
  type GameState,
  type RoundState,
  type Seat,
  callLastCard,
  catchLastCard,
  chooseColor,
  DECK_SIZE,
  drawForTurn,
  finishRound,
  legalPlays,
  newGame,
  nextRandom,
  nextRound,
  pass,
  playCard,
  topCard,
} from "./logic";

let nextId = 2000;
const num = (color: Color, value: number): ChromaCard => ({ id: nextId++, kind: "number", color, value });
const act = (color: Color, kind: "skip" | "reverse" | "draw2"): ChromaCard => ({ id: nextId++, kind, color });
const wild = (kind: "wild" | "wild4" = "wild"): ChromaCard => ({ id: nextId++, kind, color: null });

function round(hands: ChromaCard[][], top: ChromaCard, extra: Partial<RoundState> = {}): RoundState {
  return {
    hands,
    drawPile: Array.from({ length: 20 }, () => num("orange", 5)),
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

describe("choices", () => {
  it("names the colour it holds most of", () => {
    expect(chooseWildColor([num("pink", 1), num("green", 2), num("pink", 3), wild()])).toBe("pink");
  });

  it("stays in its strongest colour", () => {
    const hand = [num("cyan", 3), num("pink", 3), num("pink", 8), num("pink", 1)];
    const r = round([hand, filler(6), filler(6), filler(6)], num("cyan", 3));
    expect(chooseCard(r, 0)?.id).toBe(hand[1].id);
  });

  it("keeps wilds while a colour card fits", () => {
    const hand = [wild(), num("cyan", 2), num("pink", 6), num("green", 1)];
    const r = round([hand, filler(6), filler(6), filler(6)], num("cyan", 3));
    expect(chooseCard(r, 0)?.id).toBe(hand[1].id);
  });

  it("hits a next player close to winning", () => {
    const hand = [num("cyan", 9), act("cyan", "draw2"), num("cyan", 4), num("pink", 2)];
    const calm = round([hand, filler(6), filler(6), filler(6)], num("cyan", 3));
    expect(chooseCard(calm, 0)?.kind).toBe("number");
    const tense = round([hand, filler(1), filler(6), filler(6)], num("cyan", 3));
    expect(chooseCard(tense, 0)?.kind).toBe("draw2");
  });

  it("saves Wild Draw Four for an emergency", () => {
    const hand = [wild("wild4"), num("pink", 2), num("green", 7), num("green", 8), num("pink", 4)];
    const calm = round([hand, filler(6), filler(6), filler(6)], num("cyan", 3));
    expect(chooseCard(calm, 0)).toBeNull();
    // With a small hand it plays it to get rid of 50 points.
    const short = round([hand.slice(0, 3), filler(6), filler(6), filler(6)], num("cyan", 3));
    expect(chooseCard(short, 0)?.kind).toBe("wild4");
    const tense = round([hand, filler(2), filler(6), filler(6)], num("cyan", 3));
    expect(chooseCard(tense, 0)?.kind).toBe("wild4");
  });

  it("draws when nothing fits, and plays a drawn card that does", () => {
    const r = round([[num("pink", 2)], filler(6), filler(6), filler(6)], num("cyan", 3));
    expect(cpuMove(r, 0)).toEqual({ type: "draw" });
    const drew = drawForTurn({ ...r, color: "orange", discard: [num("orange", 3)] }, 0);
    expect(drew.phase).toBe("drawn");
    expect(cpuMove(drew, 0)).toEqual({ type: "play", cardId: drew.drawnCard });
  });
});

// ---------- Whole games, computer players in every seat ----------

export interface SimStats {
  rounds: number;
  turns: number;
  wins: number[];
  draws: number;
  caught: number;
}

export function applyMove(r: RoundState, seat: Seat, move: CpuMove): RoundState {
  switch (move.type) {
    case "play":
      return playCard(r, seat, move.cardId);
    case "draw":
      return drawForTurn(r, seat);
    case "pass":
      return pass(r, seat);
    case "color":
      return chooseColor(r, seat, move.color);
  }
}

/** Play a whole game. Throws if a move is refused, cards go missing or a round never ends. */
export function simulateGame(seed: number, target: 200 | 500 = 500, stats?: SimStats, mover: typeof cpuMove = cpuMove): GameState {
  let game = newGame(target, seed);
  let rng = seed * 7919;
  const rand = () => {
    const [x, next] = nextRandom(rng);
    rng = next;
    return x;
  };
  for (let roundGuard = 0; roundGuard < 200; roundGuard++) {
    let r = game.round;
    for (let step = 0; r.phase !== "round-over"; step++) {
      if (step > 3000) throw new Error(`round ${game.roundNumber} of seed ${seed} never ended`);
      const seat = r.turn;
      // An uncalled last card is caught half the time before the next move.
      if (r.lastCard && !r.lastCard.called && r.lastCard.seat !== seat && rand() < 0.5) {
        r = catchLastCard(r);
        if (stats) stats.caught++;
      }
      const move = mover(r, seat);
      if (move.type === "play" && r.phase === "playing") {
        const legal = legalPlays(r.hands[seat], topCard(r), r.color);
        if (!legal.some((c) => c.id === move.cardId)) throw new Error("illegal play chosen");
      }
      const after = applyMove(r, seat, move);
      if (after === r) throw new Error(`move refused: ${JSON.stringify(move)} in ${r.phase}`);
      r = after;
      if (r.lastCard?.seat === seat && !r.lastCard.called && rand() < 0.85) r = callLastCard(r, seat);
      const total = r.hands.flat().length + r.drawPile.length + r.discard.length;
      if (total !== DECK_SIZE) throw new Error(`deck holds ${total} cards`);
      if (stats) {
        stats.turns++;
        if (move.type === "draw") stats.draws++;
      }
    }
    game = finishRound({ ...game, round: r });
    if (stats) {
      stats.rounds++;
      stats.wins[r.winner!]++;
    }
    if (game.status !== "playing") return game;
    game = nextRound(game, seed * 31 + game.roundNumber);
  }
  throw new Error(`game ${seed} never ended`);
}

describe("simulated games", () => {
  it("plays 60 games to the end with only legal moves", () => {
    const stats: SimStats = { rounds: 0, turns: 0, wins: [0, 0, 0, 0], draws: 0, caught: 0 };
    for (let seed = 1; seed <= 60; seed++) {
      const g = simulateGame(seed, seed % 2 ? 500 : 200, stats);
      expect(g.status).not.toBe("playing");
      expect(Math.max(...g.scores)).toBeGreaterThanOrEqual(g.target);
    }
    // Every seat wins some rounds: no seat is stuck or favoured by turn order.
    expect(Math.min(...stats.wins)).toBeGreaterThan(stats.rounds * 0.12);
  });
});
