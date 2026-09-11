import { describe, expect, it } from "vitest";
import { DIFFICULTIES, createEmptyRoutes, generatePuzzle, type Puzzle, type Routes } from "./logic";
import { reducer, type GameState } from "./useFlow";

function mulberry32(seed: number): () => number {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fixedState(): GameState {
  const puzzle = generatePuzzle(DIFFICULTIES[0], mulberry32(1));
  return { puzzle, routes: createEmptyRoutes(puzzle.pairCount) };
}

describe("reducer - generate", () => {
  it("builds a fresh puzzle at the requested difficulty with empty routes", () => {
    const state = fixedState();
    const next = reducer(state, { type: "generate", difficulty: DIFFICULTIES[2], rng: mulberry32(7) });
    expect(next.puzzle.difficultyId).toBe("hard");
    expect(next.routes).toEqual(createEmptyRoutes(next.puzzle.pairCount));
  });

  it("produces a different puzzle object than the previous one", () => {
    const state = fixedState();
    const next = reducer(state, { type: "generate", difficulty: DIFFICULTIES[0], rng: mulberry32(2) });
    expect(next.puzzle).not.toBe(state.puzzle);
  });
});

describe("reducer - restart", () => {
  it("clears all routes but keeps the exact same puzzle", () => {
    const state = fixedState();
    state.routes[0] = [state.puzzle.endpoints[0][0]];
    const next = reducer(state, { type: "restart" });
    expect(next.puzzle).toBe(state.puzzle);
    expect(next.routes).toEqual(createEmptyRoutes(state.puzzle.pairCount));
  });
});

describe("reducer - hydrate", () => {
  it("loads the given puzzle and routes as-is", () => {
    const state = fixedState();
    const puzzle: Puzzle = generatePuzzle(DIFFICULTIES[1], mulberry32(9));
    const routes: Routes = createEmptyRoutes(puzzle.pairCount);
    routes[0] = [puzzle.endpoints[0][0]];
    const next = reducer(state, { type: "hydrate", puzzle, routes });
    expect(next.puzzle).toBe(puzzle);
    expect(next.routes).toBe(routes);
  });
});

describe("reducer - begin-route / extend-route", () => {
  it("begin-route starts a route at the given pair/cell", () => {
    const state = fixedState();
    const cell = state.puzzle.endpoints[0][0];
    const next = reducer(state, { type: "begin-route", pairIndex: 0, cell });
    expect(next.routes[0]).toEqual([cell]);
  });

  it("extend-route appends a legal adjacent cell", () => {
    let state = fixedState();
    const start = state.puzzle.endpoints[0][0];
    state = reducer(state, { type: "begin-route", pairIndex: 0, cell: start });
    const second = state.puzzle.solution[0][1];
    const next = reducer(state, { type: "extend-route", pairIndex: 0, cell: second });
    expect(next.routes[0]).toEqual([start, second]);
  });

  it("extend-route on an illegal cell leaves routes untouched (same reference)", () => {
    let state = fixedState();
    const start = state.puzzle.endpoints[0][0];
    state = reducer(state, { type: "begin-route", pairIndex: 0, cell: start });
    // A far-away, non-adjacent cell can never be a legal single-step extension.
    const farCell: [number, number] = [state.puzzle.size - 1, state.puzzle.size - 1];
    const next = reducer(state, { type: "extend-route", pairIndex: 0, cell: farCell });
    expect(next.routes).toBe(state.routes);
  });
});

describe("reducer - set-routes", () => {
  it("replaces routes wholesale, puzzle unchanged", () => {
    const state = fixedState();
    const routes: Routes = createEmptyRoutes(state.puzzle.pairCount);
    routes[1] = [state.puzzle.endpoints[1][0]];
    const next = reducer(state, { type: "set-routes", routes });
    expect(next.puzzle).toBe(state.puzzle);
    expect(next.routes).toBe(routes);
  });
});
