import { describe, expect, it } from "vitest";
import {
  FACES,
  FACE_BY_ID,
  LAYOUTS,
  availablePairs,
  deal,
  dealWithSolution,
  freeIds,
  isFree,
  isStuck,
  isWon,
  layoutBounds,
  layoutPositions,
  matchKey,
  mulberry32,
  pairPool,
  removalOrder,
  selectTile,
  shuffleRemaining,
  undo,
  type GameState,
  type Position,
  type Tile,
} from "./logic";

const tile = (id: number, x: number, y: number, z: number, faceId: string): Tile => ({ id, x, y, z, faceId });

function state(tiles: Tile[]): GameState {
  return { layoutId: "pyramid", tiles, selectedId: null, history: [], matched: 0 };
}

describe("faces", () => {
  it("has 34 regular faces plus two bonus sets of four", () => {
    expect(FACES).toHaveLength(34 + 8);
    expect(new Set(FACES.map((f) => f.id)).size).toBe(FACES.length);
  });

  it("matches bonus faces within their set only", () => {
    expect(FACE_BY_ID["arcade-coin"].matchKey).toBe(FACE_BY_ID["arcade-star"].matchKey);
    expect(FACE_BY_ID["arcade-coin"].matchKey).not.toBe(FACE_BY_ID["sky-sun"].matchKey);
    expect(FACE_BY_ID["orb-3"].matchKey).not.toBe(FACE_BY_ID["bar-3"].matchKey);
  });

  it("builds a full set's worth of matching pairs (144 tiles)", () => {
    const pool = pairPool(mulberry32(1));
    expect(pool).toHaveLength(72);
    for (const [a, b] of pool) expect(a.matchKey).toBe(b.matchKey);
  });
});

describe("layouts", () => {
  it.each(LAYOUTS.map((l) => [l.id, l] as const))("%s has an even tile count, fits the pair pool and is at most 8 tiles wide", (_, layout) => {
    const positions = layoutPositions(layout);
    expect(positions.length % 2).toBe(0);
    expect(positions.length / 2).toBeLessThanOrEqual(72);
    expect(layoutBounds(positions).w).toBeLessThanOrEqual(16);
  });

  it.each(LAYOUTS.map((l) => [l.id, l] as const))("%s has no two tiles in the same space", (_, layout) => {
    const positions = layoutPositions(layout);
    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const [a, b] = [positions[i], positions[j]];
        const clash = a.z === b.z && Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
        expect(clash).toBe(false);
      }
    }
  });

  it.each(LAYOUTS.map((l) => [l.id, l] as const))("%s has every upper tile resting on something", (_, layout) => {
    const positions = layoutPositions(layout);
    for (const p of positions.filter((q) => q.z > 0)) {
      const below = positions.some((q) => q.z === p.z - 1 && Math.abs(q.x - p.x) < 2 && Math.abs(q.y - p.y) < 2);
      expect(below).toBe(true);
    }
  });
});

describe("freeness", () => {
  const row: Position[] = [
    { x: 0, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
  ];

  it("frees the ends of a row and blocks the middle", () => {
    expect(isFree(row[0], row)).toBe(true);
    expect(isFree(row[1], row)).toBe(false);
    expect(isFree(row[2], row)).toBe(true);
  });

  it("blocks a tile covered from above, even by half a tile", () => {
    const covered = [...row, { x: 3, y: 1, z: 1 }];
    expect(isFree(covered[2], covered)).toBe(false);
    expect(isFree(covered[0], covered)).toBe(true);
    expect(isFree(covered[3], covered)).toBe(true);
  });

  it("only counts side neighbours that share rows", () => {
    const offset: Position[] = [
      { x: 0, y: 0, z: 0 },
      { x: 2, y: 2, z: 0 },
      { x: 4, y: 0, z: 0 },
    ];
    expect(isFree(offset[1], offset)).toBe(true);
    const halfOff: Position[] = [
      { x: 0, y: 1, z: 0 },
      { x: 2, y: 0, z: 0 },
      { x: 4, y: 1, z: 0 },
    ];
    expect(isFree(halfOff[1], halfOff)).toBe(false);
  });
});

describe("dealing", () => {
  it.each(LAYOUTS.map((l) => [l.id] as const))("deals %s with every position filled by matching pairs", (id) => {
    const game = deal(id, mulberry32(7));
    const positions = layoutPositions(LAYOUTS.find((l) => l.id === id)!);
    expect(game.tiles).toHaveLength(positions.length);
    const counts = new Map<string, number>();
    for (const t of game.tiles) counts.set(matchKey(t), (counts.get(matchKey(t)) ?? 0) + 1);
    for (const n of counts.values()) expect(n % 2).toBe(0);
    expect(new Set(game.tiles.map((t) => t.id)).size).toBe(game.tiles.length);
  });

  it("is reproducible from a seed and different across seeds", () => {
    expect(deal("pyramid", mulberry32(3)).tiles).toEqual(deal("pyramid", mulberry32(3)).tiles);
    expect(deal("pyramid", mulberry32(3)).tiles).not.toEqual(deal("pyramid", mulberry32(4)).tiles);
  });

  it("deals only winnable boards: the build order replays as legal moves to a clear board", () => {
    for (const layout of LAYOUTS) {
      for (let seed = 1; seed <= 40; seed++) {
        const { state: start, solution } = dealWithSolution(layout.id, mulberry32(seed * 101));
        let s = start;
        for (const [a, b] of solution) {
          const first = selectTile(s, a);
          expect(first.result, `${layout.id} seed ${seed}`).toBe("selected");
          const second = selectTile(first.state, b);
          expect(second.result, `${layout.id} seed ${seed}`).toBe("matched");
          s = second.state;
        }
        expect(isWon(s)).toBe(true);
      }
    }
  });

  it("returns null when positions cannot all be removed", () => {
    const stacked: Position[] = [
      { x: 0, y: 0, z: 0 },
      { x: 0, y: 0, z: 1 },
    ];
    expect(removalOrder(stacked, mulberry32(1))).toBeNull();
  });
});

describe("selecting and matching", () => {
  const tiles = [
    tile(0, 0, 0, 0, "orb-1"),
    tile(1, 2, 0, 0, "bar-5"),
    tile(2, 4, 0, 0, "orb-1"),
    tile(3, 0, 4, 0, "arcade-coin"),
    tile(4, 4, 4, 0, "arcade-star"),
  ];

  it("selects, deselects and switches between free tiles", () => {
    let s = selectTile(state(tiles), 0);
    expect(s.result).toBe("selected");
    expect(s.state.selectedId).toBe(0);
    s = selectTile(s.state, 0);
    expect(s.result).toBe("deselected");
    expect(s.state.selectedId).toBeNull();
    s = selectTile(selectTile(s.state, 0).state, 3);
    expect(s.result).toBe("switched");
    expect(s.state.selectedId).toBe(3);
  });

  it("refuses a blocked tile and keeps the selection", () => {
    const s = selectTile({ ...state(tiles), selectedId: 0 }, 1);
    expect(s.result).toBe("blocked");
    expect(s.state.selectedId).toBe(0);
  });

  it("removes a matching pair and records it for undo", () => {
    const s = selectTile(selectTile(state(tiles), 0).state, 2);
    expect(s.result).toBe("matched");
    expect(s.state.tiles.map((t) => t.id)).toEqual([1, 3, 4]);
    expect(s.state.matched).toBe(1);
    expect(s.state.history).toHaveLength(1);
  });

  it("matches different faces from the same bonus set", () => {
    const s = selectTile(selectTile(state(tiles), 3).state, 4);
    expect(s.result).toBe("matched");
  });

  it("undo puts the pair back", () => {
    const matched = selectTile(selectTile(state(tiles), 0).state, 2).state;
    const back = undo(matched);
    expect(back.tiles).toEqual(tiles);
    expect(back.matched).toBe(0);
    expect(undo(back)).toBe(back);
  });

  it("lists available pairs and knows won and stuck", () => {
    expect(availablePairs(tiles).map(([a, b]) => [a.id, b.id])).toEqual([
      [0, 2],
      [3, 4],
    ]);
    expect(freeIds(tiles).has(1)).toBe(false);
    expect(isWon(state([]))).toBe(true);
    expect(isStuck(state([]))).toBe(false);
    const stuck = [tile(0, 0, 0, 0, "orb-1"), tile(1, 2, 0, 0, "orb-1"), tile(2, 4, 0, 0, "bar-2"), tile(3, 6, 0, 0, "bar-2")];
    // Free: 0 (orb) and 3 (bar) - no match available.
    expect(isStuck(state(stuck))).toBe(true);
  });

  it("a whole deal can be cleared by repeatedly playing an available pair", () => {
    let s = deal("diamond", mulberry32(99));
    const rng = mulberry32(5);
    for (let i = 0; i < 200 && !isWon(s); i++) {
      if (isStuck(s)) s = shuffleRemaining(s, rng)!;
      const [a, b] = availablePairs(s.tiles)[0];
      s = selectTile(selectTile(s, a.id).state, b.id).state;
    }
    expect(isWon(s)).toBe(true);
  });
});

describe("shuffling", () => {
  it("keeps positions and faces, only rearranging which face is where, and stays winnable", () => {
    let s = deal("fortress", mulberry32(11));
    // Play a few pairs first.
    for (let i = 0; i < 6; i++) {
      const [a, b] = availablePairs(s.tiles)[0];
      s = selectTile(selectTile(s, a.id).state, b.id).state;
    }
    const shuffled = shuffleRemaining(s, mulberry32(2))!;
    expect(shuffled.tiles.map(({ id, x, y, z }) => ({ id, x, y, z }))).toEqual(s.tiles.map(({ id, x, y, z }) => ({ id, x, y, z })));
    expect(shuffled.tiles.map((t) => t.faceId).sort()).toEqual(s.tiles.map((t) => t.faceId).sort());
    expect(availablePairs(shuffled.tiles).length).toBeGreaterThan(0);
    expect(undo(shuffled).tiles).toEqual(s.tiles);
  });

  it("gives up when the remaining tiles can't be cleared in any arrangement", () => {
    const s = state([tile(0, 0, 0, 0, "orb-1"), tile(1, 0, 0, 1, "orb-1")]);
    expect(shuffleRemaining(s, mulberry32(1))).toBeNull();
  });
});
