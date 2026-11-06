import { describe, expect, it } from "vitest";
import {
  DIFFICULTIES,
  FALLBACK_ROUTES,
  beginRoute,
  countSolutions,
  cellPairOwner,
  connectedPairCount,
  createEmptyRoutes,
  extendRoute,
  extendRouteThroughPath,
  fillCount,
  generatePuzzle,
  isPairConnected,
  isSolved,
  isValidPersistedRun,
  isValidPuzzle,
  isValidRoutes,
  resolveDragStart,
  resolveEndpointOwner,
  routeTouchesItself,
  validatePuzzle,
  type CellCoord,
  type Puzzle,
  type Routes,
} from "./logic";

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

// ---------- generation ----------

describe("generatePuzzle - solution validity", () => {
  for (const difficulty of DIFFICULTIES) {
    it(`produces a valid ${difficulty.label} puzzle across a seed sweep`, () => {
      for (let seed = 0; seed < 25; seed++) {
        const puzzle = generatePuzzle(difficulty, mulberry32(seed * 101 + 3));
        expect(puzzle.difficultyId).toBe(difficulty.id);
        expect(puzzle.size).toBe(difficulty.size);
        expect(puzzle.pairCount).toBe(difficulty.pairs);
        expect(puzzle.endpoints).toHaveLength(difficulty.pairs);
        expect(puzzle.solution).toHaveLength(difficulty.pairs);
        expect(validatePuzzle(puzzle)).toBe(true);
      }
    });
  }

  it("covers every board cell exactly once", () => {
    const puzzle = generatePuzzle(DIFFICULTIES[2], mulberry32(5));
    const seen = new Set<string>();
    for (const path of puzzle.solution) {
      for (const [r, c] of path) {
        const key = `${r},${c}`;
        expect(seen.has(key)).toBe(false);
        seen.add(key);
      }
    }
    expect(seen.size).toBe(puzzle.size * puzzle.size);
  });

  it("gives every route at least two cells", () => {
    for (let seed = 0; seed < 15; seed++) {
      const puzzle = generatePuzzle(DIFFICULTIES[1], mulberry32(seed));
      for (const path of puzzle.solution) expect(path.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("has endpoint coordinates that lie on their own route's ends", () => {
    const puzzle = generatePuzzle(DIFFICULTIES[0], mulberry32(11));
    for (let p = 0; p < puzzle.pairCount; p++) {
      const [a, b] = puzzle.endpoints[p];
      const path = puzzle.solution[p];
      const first = path[0];
      const last = path[path.length - 1];
      const matches =
        (a[0] === first[0] && a[1] === first[1] && b[0] === last[0] && b[1] === last[1]) ||
        (a[0] === last[0] && a[1] === last[1] && b[0] === first[0] && b[1] === first[1]);
      expect(matches).toBe(true);
    }
  });

  it("never assigns the same endpoint coordinate to two pairs", () => {
    for (let seed = 0; seed < 15; seed++) {
      const puzzle = generatePuzzle(DIFFICULTIES[2], mulberry32(seed * 3));
      const seen = new Set<string>();
      for (const [a, b] of puzzle.endpoints) {
        for (const pt of [a, b]) {
          const key = `${pt[0]},${pt[1]}`;
          expect(seen.has(key)).toBe(false);
          seen.add(key);
        }
      }
    }
  });
});

describe("generatePuzzle - repeatability", () => {
  it("produces the identical puzzle from the same seed and difficulty", () => {
    const a = generatePuzzle(DIFFICULTIES[1], mulberry32(999));
    const b = generatePuzzle(DIFFICULTIES[1], mulberry32(999));
    expect(a).toEqual(b);
  });
});

// The old generator cut one snake through every cell into pieces, so ~98%
// of Easy puzzles could only be finished with a route hugging itself -
// technically winnable, but read by players as impossible.
describe("generatePuzzle - every puzzle is fairly winnable", () => {
  for (const difficulty of DIFFICULTIES) {
    it(`never needs a route that touches itself (${difficulty.label})`, () => {
      for (let seed = 0; seed < 25; seed++) {
        const puzzle = generatePuzzle(difficulty, mulberry32(seed * 7 + 1));
        for (const path of puzzle.solution) expect(routeTouchesItself(path)).toBe(false);
      }
    });

    it(`has exactly one solution (${difficulty.label})`, () => {
      for (let seed = 0; seed < 15; seed++) {
        const puzzle = generatePuzzle(difficulty, mulberry32(seed * 13 + 2));
        expect(countSolutions(puzzle)).toBe(1);
      }
    });
  }

  it("joins side-by-side dots directly, at most once per puzzle", () => {
    for (const difficulty of DIFFICULTIES) {
      for (let seed = 0; seed < 20; seed++) {
        const puzzle = generatePuzzle(difficulty, mulberry32(seed * 31 + 4));
        let adjacentPairs = 0;
        puzzle.endpoints.forEach(([a, b], p) => {
          if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) !== 1) return;
          adjacentPairs++;
          expect(puzzle.solution[p]).toHaveLength(2);
        });
        expect(adjacentPairs).toBeLessThanOrEqual(1);
      }
    }
  });

  it("keeps the fallback boards valid, clean and single-solution", () => {
    for (const difficulty of DIFFICULTIES) {
      const routes = FALLBACK_ROUTES[difficulty.id];
      const puzzle: Puzzle = {
        difficultyId: difficulty.id,
        size: difficulty.size,
        pairCount: difficulty.pairs,
        endpoints: routes.map((r) => [r[0], r[r.length - 1]] as [CellCoord, CellCoord]),
        solution: routes,
      };
      expect(isValidPuzzle(puzzle)).toBe(true);
      expect(countSolutions(puzzle)).toBe(1);
    }
  });

  it("falls back to a fixed board when no attempt is allowed", () => {
    const puzzle = generatePuzzle(DIFFICULTIES[0], mulberry32(1), 0);
    expect(puzzle.solution).toEqual(FALLBACK_ROUTES.easy);
  });
});

describe("routeTouchesItself", () => {
  it("accepts a straight line and an L", () => {
    expect(routeTouchesItself([[0, 0], [0, 1], [0, 2]])).toBe(false);
    expect(routeTouchesItself([[0, 0], [1, 0], [1, 1], [1, 2]])).toBe(false);
  });

  it("rejects a U-turn that runs alongside itself", () => {
    expect(routeTouchesItself([[0, 0], [0, 1], [1, 1], [1, 0]])).toBe(true);
  });

  it("rejects side-by-side dots joined the long way round", () => {
    expect(routeTouchesItself([[0, 0], [1, 0], [1, 1], [1, 2], [0, 2], [0, 1]])).toBe(true);
  });
});

describe("countSolutions", () => {
  it("finds the single fill of a board with one possible answer", () => {
    // Two rows, each its own pair: the only full fill is the two lines.
    expect(countSolutions({ size: 2, endpoints: [[[0, 0], [0, 1]], [[1, 0], [1, 1]]] })).toBe(1);
  });

  it("reports zero when no full fill exists", () => {
    // Opposite corners of a 2x2 board: any route leaves one cell empty.
    expect(countSolutions({ size: 2, endpoints: [[[0, 0], [1, 1]]] })).toBe(0);
  });

  it("stops counting at the cap when the fill is ambiguous", () => {
    // Opposite corners of a 3x3 board: several routes cover every cell.
    expect(countSolutions({ size: 3, endpoints: [[[0, 0], [2, 2]]] }, 2)).toBe(2);
  });

  it("returns null when it runs out of search budget", () => {
    expect(countSolutions({ size: 5, endpoints: [[[0, 0], [4, 4]]] }, 1000, 10)).toBeNull();
  });
});

describe("generatePuzzle - variety", () => {
  it("does not generate the same layout for every seed", () => {
    const layouts = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const puzzle = generatePuzzle(DIFFICULTIES[0], mulberry32(seed * 17 + 1));
      layouts.add(JSON.stringify(puzzle.endpoints));
    }
    expect(layouts.size).toBeGreaterThan(10);
  });

  it("does not make every pair's endpoints trivially adjacent", () => {
    let trivialAcrossSweep = 0;
    let totalPairs = 0;
    for (let seed = 0; seed < 20; seed++) {
      const puzzle = generatePuzzle(DIFFICULTIES[2], mulberry32(seed * 29 + 5));
      for (const path of puzzle.solution) {
        totalPairs++;
        if (path.length === 2) trivialAcrossSweep++;
      }
    }
    expect(trivialAcrossSweep / totalPairs).toBeLessThan(0.5);
  });
});

describe("validatePuzzle", () => {
  function trivialPuzzle(): Puzzle {
    // 2x2 board, one pair covering all 4 cells in an L-shape.
    return {
      difficultyId: "easy",
      size: 2,
      pairCount: 1,
      endpoints: [[[0, 0], [1, 1]]],
      solution: [
        [
          [0, 0],
          [0, 1],
          [1, 1],
        ],
      ],
    };
  }

  it("rejects a puzzle that does not cover every cell", () => {
    expect(validatePuzzle(trivialPuzzle())).toBe(false); // covers 3 of 4 cells
  });

  // 2x2 board, two pairs, one per row: full coverage with clean routes.
  function twoRowPuzzle(): Puzzle {
    return {
      difficultyId: "easy",
      size: 2,
      pairCount: 2,
      endpoints: [
        [[0, 0], [0, 1]],
        [[1, 0], [1, 1]],
      ],
      solution: [
        [
          [0, 0],
          [0, 1],
        ],
        [
          [1, 0],
          [1, 1],
        ],
      ],
    };
  }

  it("accepts a full-coverage puzzle", () => {
    expect(validatePuzzle(twoRowPuzzle())).toBe(true);
  });

  it("rejects a route that touches itself (as the old generator made)", () => {
    const puzzle = trivialPuzzle();
    puzzle.solution[0].push([1, 0]);
    puzzle.endpoints[0] = [[0, 0], [1, 0]]; // a U round the 2x2 board: full coverage, but it hugs itself
    expect(validatePuzzle(puzzle)).toBe(false);
  });

  it("rejects a route with a diagonal step", () => {
    const puzzle = trivialPuzzle();
    puzzle.solution[0] = [
      [0, 0],
      [1, 1],
    ];
    puzzle.endpoints[0] = [[0, 0], [1, 1]];
    expect(validatePuzzle(puzzle)).toBe(false);
  });

  it("rejects a route shorter than two cells", () => {
    const puzzle: Puzzle = {
      difficultyId: "easy",
      size: 1,
      pairCount: 1,
      endpoints: [[[0, 0], [0, 0]]],
      solution: [[[0, 0]]],
    };
    expect(validatePuzzle(puzzle)).toBe(false);
  });

  it("rejects overlapping routes", () => {
    const puzzle: Puzzle = {
      difficultyId: "easy",
      size: 2,
      pairCount: 2,
      endpoints: [
        [[0, 0], [0, 1]],
        [[1, 0], [1, 1]],
      ],
      solution: [
        [
          [0, 0],
          [0, 1],
        ],
        [
          [0, 1],
          [1, 1],
        ],
      ],
    };
    expect(validatePuzzle(puzzle)).toBe(false);
  });

  it("rejects endpoint metadata that doesn't match the route's own ends", () => {
    const puzzle = twoRowPuzzle();
    puzzle.endpoints[0] = [[0, 0], [1, 1]]; // [1,1] belongs to the other route
    expect(validatePuzzle(puzzle)).toBe(false);
  });

  it("rejects a pair whose two endpoints are the same cell", () => {
    const puzzle = twoRowPuzzle();
    puzzle.endpoints[0] = [[0, 0], [0, 0]];
    expect(validatePuzzle(puzzle)).toBe(false);
  });

  it("rejects duplicate endpoint coordinates across different pairs", () => {
    const puzzle: Puzzle = {
      difficultyId: "easy",
      size: 2,
      pairCount: 2,
      endpoints: [
        [[0, 0], [0, 1]],
        [[0, 0], [1, 1]],
      ],
      solution: [
        [
          [0, 0],
          [0, 1],
        ],
        [
          [0, 0],
          [1, 0],
          [1, 1],
        ],
      ],
    };
    expect(validatePuzzle(puzzle)).toBe(false);
  });
});

// ---------- player path editing ----------

function simplePuzzle(): Puzzle {
  // 3x3 board, two pairs, a known simple full-coverage solution:
  //  A A B
  //  A A B
  //  A A B
  // Pair A: (0,0)->(1,0)->(1,1)->(0,1) [square-ish], pair B: (0,2)->(1,2)->(2,2), plus A needs (2,0)/(2,1) too for full coverage.
  // Keep it small and hand-verified instead: 2x3 board, two pairs of length 3 each.
  return {
    difficultyId: "easy",
    size: 3,
    pairCount: 2,
    endpoints: [
      [[0, 0], [2, 0]],
      [[0, 2], [2, 2]],
    ],
    solution: [
      [
        [0, 0],
        [1, 0],
        [2, 0],
      ],
      [
        [0, 2],
        [1, 2],
        [2, 2],
      ],
    ],
  };
}

describe("resolveDragStart / resolveEndpointOwner / cellPairOwner", () => {
  it("resolves an endpoint cell to its pair", () => {
    const puzzle = simplePuzzle();
    expect(resolveEndpointOwner(puzzle, [0, 0])).toBe(0);
    expect(resolveEndpointOwner(puzzle, [2, 2])).toBe(1);
    expect(resolveEndpointOwner(puzzle, [1, 1])).toBeNull();
  });

  it("resolves a drag start on an existing path cell to its pair", () => {
    const puzzle = simplePuzzle();
    const routes: Routes = createEmptyRoutes(2);
    routes[0] = [
      [0, 0],
      [1, 0],
    ];
    expect(resolveDragStart(puzzle, routes, [1, 0])).toBe(0);
    expect(cellPairOwner(routes, [1, 0])).toBe(0);
    expect(cellPairOwner(routes, [1, 2])).toBeNull();
  });

  it("does not resolve an empty, non-endpoint cell", () => {
    const puzzle = simplePuzzle();
    const routes = createEmptyRoutes(2);
    expect(resolveDragStart(puzzle, routes, [1, 1])).toBeNull();
  });
});

describe("beginRoute", () => {
  it("starts a fresh route at an untouched endpoint", () => {
    const puzzle = simplePuzzle();
    const routes = createEmptyRoutes(2);
    const next = beginRoute(puzzle, routes, 0, [0, 0]);
    expect(next[0]).toEqual([[0, 0]]);
  });

  it("truncates to the touched cell when re-touching the pair's own route", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    const next = beginRoute(puzzle, routes, 0, [1, 0]);
    expect(next[0]).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  it("starting fresh from the other endpoint discards the old anchor's progress", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [
      [0, 0],
      [1, 0],
    ];
    const next = beginRoute(puzzle, routes, 0, [2, 0]);
    expect(next[0]).toEqual([[2, 0]]);
  });
});

describe("extendRoute", () => {
  it("stops a route at its partner endpoint - no extending past the end", () => {
    const puzzle = simplePuzzle();
    const [a, b] = puzzle.endpoints[0];
    let routes = beginRoute(puzzle, createEmptyRoutes(puzzle.pairCount), 0, a);
    routes = extendRouteThroughPath(puzzle, routes, 0, b);
    expect(isPairConnected(puzzle, routes, 0)).toBe(true);
    const tip = routes[0][routes[0].length - 1];
    for (const [dr, dc] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const beyond: [number, number] = [tip[0] + dr, tip[1] + dc];
      if (routes[0].some((c) => c[0] === beyond[0] && c[1] === beyond[1])) continue;
      expect(extendRoute(puzzle, routes, 0, beyond)).toBe(routes);
    }
  });

  it("still lets a finished route be backtracked", () => {
    const puzzle = simplePuzzle();
    const [a, b] = puzzle.endpoints[0];
    let routes = beginRoute(puzzle, createEmptyRoutes(puzzle.pairCount), 0, a);
    routes = extendRouteThroughPath(puzzle, routes, 0, b);
    const shorter = extendRoute(puzzle, routes, 0, routes[0][routes[0].length - 2]);
    expect(shorter[0]).toHaveLength(routes[0].length - 1);
  });

  it("extends orthogonally from the tip", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [[0, 0]];
    const next = extendRoute(puzzle, routes, 0, [1, 0]);
    expect(next[0]).toEqual([
      [0, 0],
      [1, 0],
    ]);
  });

  it("rejects a diagonal extension", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [[0, 0]];
    const next = extendRoute(puzzle, routes, 0, [1, 1]);
    expect(next).toBe(routes);
  });

  it("rejects a non-adjacent jump", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [[0, 0]];
    const next = extendRoute(puzzle, routes, 0, [2, 0]);
    expect(next).toBe(routes);
  });

  it("backtracks by one cell", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [
      [0, 0],
      [1, 0],
    ];
    const next = extendRoute(puzzle, routes, 0, [0, 0]);
    expect(next[0]).toEqual([[0, 0]]);
  });

  it("backtracks multiple cells in one call", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    // extend to (2,1), a cell outside the pair's own route (adjacent to tip)
    routes[0].push();
    const next = extendRoute(puzzle, routes, 0, [0, 0]);
    expect(next[0]).toEqual([[0, 0]]);
  });

  it("completes the pair when reaching its matching endpoint", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [
      [0, 0],
      [1, 0],
    ];
    const next = extendRoute(puzzle, routes, 0, [2, 0]);
    expect(isPairConnected(puzzle, next, 0)).toBe(true);
  });

  it("rejects entry onto another pair's endpoint", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [
      [0, 0],
      [0, 1],
    ];
    const next = extendRoute(puzzle, routes, 0, [0, 2]); // pair 1's endpoint
    expect(next).toBe(routes);
  });

  it("claims a cell from another pair's route and truncates it from that point", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [[0, 0]];
    routes[1] = [
      [0, 2],
      [0, 1],
    ];
    const next = extendRoute(puzzle, routes, 0, [0, 1]);
    expect(next[0]).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(next[1]).toEqual([[0, 2]]);
  });

  it("a completed pair can be edited again (rerouted)", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    expect(isPairConnected(puzzle, routes, 0)).toBe(true);
    const rerouted = beginRoute(puzzle, routes, 0, [1, 0]);
    expect(rerouted[0]).toEqual([
      [0, 0],
      [1, 0],
    ]);
    expect(isPairConnected(puzzle, rerouted, 0)).toBe(false);
  });

  it("does nothing when the pair has no active route", () => {
    const puzzle = simplePuzzle();
    const routes = createEmptyRoutes(2);
    const next = extendRoute(puzzle, routes, 0, [1, 0]);
    expect(next).toBe(routes);
  });

  it("the route remains a contiguous orthogonal chain after a sequence of operations", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes = beginRoute(puzzle, routes, 0, [0, 0]);
    routes = extendRoute(puzzle, routes, 0, [1, 0]);
    routes = extendRoute(puzzle, routes, 0, [2, 0]);
    const path = routes[0];
    for (let i = 1; i < path.length; i++) {
      const dr = Math.abs(path[i][0] - path[i - 1][0]);
      const dc = Math.abs(path[i][1] - path[i - 1][1]);
      expect(dr + dc).toBe(1);
    }
  });
});

describe("extendRouteThroughPath (fast-drag interpolation)", () => {
  it("fills in intermediate cells when the target is two cells away", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [[0, 0]];
    const next = extendRouteThroughPath(puzzle, routes, 0, [2, 0]);
    expect(next[0]).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ]);
  });

  it("stops at the last legal cell instead of jumping past an illegal one", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [[0, 0]];
    routes[1] = [
      [0, 2],
      [1, 2],
      [2, 2],
    ];
    // Target (2,1) would require passing legally through (1,0) but the path
    // there isn't blocked - use a target that requires crossing a reserved
    // endpoint to prove the interpolation halts rather than teleporting.
    routes[0] = [[0, 1]];
    const next = extendRouteThroughPath(puzzle, routes, 0, [0, 2]);
    // (0,2) is pair 1's endpoint - entry is rejected outright, so the route
    // must be completely unchanged, not partially advanced toward it.
    expect(next[0]).toEqual([[0, 1]]);
  });

  it("jumps straight back via a single backtrack rather than stepping", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    const next = extendRouteThroughPath(puzzle, routes, 0, [0, 0]);
    expect(next[0]).toEqual([[0, 0]]);
  });
});

describe("solved detection", () => {
  it("requires all pairs connected", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    routes[0] = [
      [0, 0],
      [0, 1],
      [0, 2],
    ]; // wrong path, not reaching pair 0's endpoint
    expect(isSolved(puzzle, routes)).toBe(false);
  });

  it("requires full board coverage even when all pairs are connected", () => {
    const puzzle = simplePuzzle();
    let routes = createEmptyRoutes(2);
    // Both pairs connect via the shortest legal route, but 3 middle-column
    // cells are never touched - 6 of 9 board cells filled, not solved.
    routes[0] = [
      [0, 0],
      [1, 0],
      [2, 0],
    ];
    routes[1] = [
      [0, 2],
      [1, 2],
      [2, 2],
    ];
    expect(connectedPairCount(puzzle, routes)).toBe(2);
    expect(fillCount(routes)).toBe(6);
    expect(isSolved(puzzle, routes)).toBe(false);
  });

  it("solved when all pairs connect and every cell is covered", () => {
    const puzzle: Puzzle = {
      difficultyId: "easy",
      size: 2,
      pairCount: 2,
      endpoints: [
        [[0, 0], [1, 0]],
        [[0, 1], [1, 1]],
      ],
      solution: [
        [
          [0, 0],
          [1, 0],
        ],
        [
          [0, 1],
          [1, 1],
        ],
      ],
    };
    let routes = createEmptyRoutes(2);
    routes[0] = [
      [0, 0],
      [1, 0],
    ];
    routes[1] = [
      [0, 1],
      [1, 1],
    ];
    expect(isSolved(puzzle, routes)).toBe(true);
  });
});

describe("restart semantics", () => {
  it("createEmptyRoutes clears all pairs back to untouched", () => {
    const routes = createEmptyRoutes(3);
    expect(routes).toEqual([[], [], []]);
  });
});

// ---------- solvability via player-path logic (uses the generator's known solution) ----------

describe("solvability through player-path rules", () => {
  it("a generated puzzle's own known solution can be completed via beginRoute/extendRoute, one pair at a time", () => {
    for (const difficulty of DIFFICULTIES) {
      const puzzle = generatePuzzle(difficulty, mulberry32(4242));
      let routes = createEmptyRoutes(puzzle.pairCount);
      for (let p = 0; p < puzzle.pairCount; p++) {
        const path = puzzle.solution[p];
        routes = beginRoute(puzzle, routes, p, path[0]);
        for (let i = 1; i < path.length; i++) {
          const before = routes;
          routes = extendRoute(puzzle, routes, p, path[i]);
          expect(routes).not.toBe(before); // every solution step must be legal
        }
        expect(isPairConnected(puzzle, routes, p)).toBe(true);
      }
      expect(isSolved(puzzle, routes)).toBe(true);
    }
  });
});

// ---------- persisted-state validation ----------

describe("isValidPuzzle", () => {
  it("accepts a real generated puzzle", () => {
    const puzzle = generatePuzzle(DIFFICULTIES[0], mulberry32(1));
    expect(isValidPuzzle(puzzle)).toBe(true);
  });

  it("rejects an unsupported difficulty id", () => {
    const puzzle = generatePuzzle(DIFFICULTIES[0], mulberry32(1)) as unknown as Record<string, unknown>;
    expect(isValidPuzzle({ ...puzzle, difficultyId: "nightmare" })).toBe(false);
  });

  it("rejects mismatched grid dimensions", () => {
    const puzzle = generatePuzzle(DIFFICULTIES[0], mulberry32(1));
    expect(isValidPuzzle({ ...puzzle, size: 9 })).toBe(false);
  });

  it("rejects non-object/null input", () => {
    expect(isValidPuzzle(null)).toBe(false);
    expect(isValidPuzzle("puzzle")).toBe(false);
    expect(isValidPuzzle(42)).toBe(false);
  });

  it("rejects a saved puzzle from the old snake-cutting generator", () => {
    // Old style: one snake across the 5x5 rows, cut into four pieces. The
    // first piece turns at the row end and runs back alongside itself.
    const snake: CellCoord[] = [];
    for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) snake.push([r, r % 2 ? 4 - c : c]);
    const cuts = [0, 7, 13, 19, 25];
    const solution = cuts.slice(0, -1).map((start, i) => snake.slice(start, cuts[i + 1]));
    const old: Puzzle = {
      difficultyId: "easy",
      size: 5,
      pairCount: 4,
      endpoints: solution.map((r) => [r[0], r[r.length - 1]] as [CellCoord, CellCoord]),
      solution,
    };
    expect(isValidPuzzle(old)).toBe(false);
  });

  it("rejects a puzzle whose solution doesn't actually validate", () => {
    const puzzle = generatePuzzle(DIFFICULTIES[0], mulberry32(1));
    const broken = { ...puzzle, solution: puzzle.solution.map((p) => p.slice(0, 1)) };
    expect(isValidPuzzle(broken)).toBe(false);
  });
});

describe("isValidRoutes", () => {
  it("accepts empty routes for a valid puzzle", () => {
    const puzzle = generatePuzzle(DIFFICULTIES[0], mulberry32(1));
    expect(isValidRoutes(createEmptyRoutes(puzzle.pairCount), puzzle)).toBe(true);
  });

  it("accepts in-progress routes matching the pair count", () => {
    const puzzle = simplePuzzle();
    const routes: Routes = [[[0, 0], [1, 0]], []];
    expect(isValidRoutes(routes, puzzle)).toBe(true);
  });

  it("rejects a wrong pair count", () => {
    const puzzle = simplePuzzle();
    expect(isValidRoutes([[]], puzzle)).toBe(false);
  });

  it("rejects an out-of-bounds coordinate", () => {
    const puzzle = simplePuzzle();
    const routes: Routes = [[[0, 0], [99, 0]], []];
    expect(isValidRoutes(routes, puzzle)).toBe(false);
  });

  it("rejects duplicate occupancy across two pairs' paths", () => {
    const puzzle = simplePuzzle();
    const routes: Routes = [
      [[0, 0], [0, 1]],
      [[0, 2], [0, 1]],
    ];
    expect(isValidRoutes(routes, puzzle)).toBe(false);
  });

  it("rejects a discontinuous (non-adjacent-step) route", () => {
    const puzzle = simplePuzzle();
    const routes: Routes = [[[0, 0], [2, 0]], []];
    expect(isValidRoutes(routes, puzzle)).toBe(false);
  });

  it("rejects a route whose anchor isn't one of the pair's own endpoints", () => {
    const puzzle = simplePuzzle();
    const routes: Routes = [[[1, 0], [1, 1]], []];
    expect(isValidRoutes(routes, puzzle)).toBe(false);
  });

  it("rejects malformed cell entries (strings, nulls, wrong-length tuples)", () => {
    const puzzle = simplePuzzle();
    expect(isValidRoutes([[["a", "b"]], []], puzzle)).toBe(false);
    expect(isValidRoutes([[null], []], puzzle)).toBe(false);
    expect(isValidRoutes([[[0]], []], puzzle)).toBe(false);
  });
});

describe("isValidPersistedRun", () => {
  it("accepts a valid puzzle + routes pairing", () => {
    const puzzle = generatePuzzle(DIFFICULTIES[0], mulberry32(1));
    expect(isValidPersistedRun({ puzzle, routes: createEmptyRoutes(puzzle.pairCount) })).toBe(true);
  });

  it("rejects a corrupt/non-object value", () => {
    expect(isValidPersistedRun(null)).toBe(false);
    expect(isValidPersistedRun("not json")).toBe(false);
    expect(isValidPersistedRun(undefined)).toBe(false);
  });

  it("rejects when routes don't match the puzzle's pair count", () => {
    const puzzle = generatePuzzle(DIFFICULTIES[0], mulberry32(1));
    expect(isValidPersistedRun({ puzzle, routes: [] })).toBe(false);
  });

  it("rejects when the puzzle itself is structurally invalid", () => {
    const puzzle = generatePuzzle(DIFFICULTIES[0], mulberry32(1));
    const brokenPuzzle = { ...puzzle, endpoints: [] };
    expect(isValidPersistedRun({ puzzle: brokenPuzzle, routes: [] })).toBe(false);
  });
});
