/*
 * Mahjong (tile-matching solitaire) rules: pure functions, no React/DOM.
 *
 * Positions are in half-tile units: a tile at (x, y) covers
 * [x, x+2) x [y, y+2) on layer z. Half units let upper layers sit across
 * the seam between two tiles below.
 *
 * A tile is free when nothing on a higher layer overlaps it, and at least
 * one of its left/right sides is open on its own layer.
 *
 * Deals are winnable by construction: the layout is "played" in reverse
 * first (repeatedly removing two random free positions), and each removed
 * pair of positions is then given a matching pair of faces. Playing those
 * pairs in that order clears the board, so a solution always exists.
 */

// ---------- Faces ----------

export type Suit = "orb" | "bar" | "glyph" | "compass" | "core" | "arcade" | "sky";

export interface Face {
  id: string;
  suit: Suit;
  /** 1-9 for orb/bar/glyph; otherwise an index into the set. */
  rank: number;
  /** Corner index text. */
  label: string;
  /** Tiles match when their keys are equal. Bonus sets share one key. */
  matchKey: string;
}

const COMPASS = ["N", "E", "S", "W"];
const CORES = ["P", "C", "G"]; // pink, cyan, green
export const ARCADE_SET = ["joystick", "coin", "star", "bolt"];
export const SKY_SET = ["sun", "moon", "comet", "planet"];

function buildFaces(): Face[] {
  const faces: Face[] = [];
  for (const suit of ["orb", "bar", "glyph"] as const) {
    for (let rank = 1; rank <= 9; rank++) {
      faces.push({ id: `${suit}-${rank}`, suit, rank, label: String(rank), matchKey: `${suit}-${rank}` });
    }
  }
  COMPASS.forEach((d, i) => faces.push({ id: `compass-${d}`, suit: "compass", rank: i, label: d, matchKey: `compass-${d}` }));
  CORES.forEach((c, i) => faces.push({ id: `core-${c}`, suit: "core", rank: i, label: "", matchKey: `core-${c}` }));
  ARCADE_SET.forEach((name, i) => faces.push({ id: `arcade-${name}`, suit: "arcade", rank: i, label: "", matchKey: "arcade" }));
  SKY_SET.forEach((name, i) => faces.push({ id: `sky-${name}`, suit: "sky", rank: i, label: "", matchKey: "sky" }));
  return faces;
}

export const FACES: Face[] = buildFaces();
export const FACE_BY_ID: Record<string, Face> = Object.fromEntries(FACES.map((f) => [f.id, f]));

/**
 * Every matching pair a full set contains: two pairs of each regular face
 * (four copies), and the bonus faces paired up within their set.
 */
export function pairPool(rng: Rng): [Face, Face][] {
  const pool: [Face, Face][] = [];
  for (const face of FACES) {
    if (face.suit === "arcade" || face.suit === "sky") continue;
    pool.push([face, face], [face, face]);
  }
  for (const suit of ["arcade", "sky"] as const) {
    const set = shuffle(
      FACES.filter((f) => f.suit === suit),
      rng,
    );
    pool.push([set[0], set[1]], [set[2], set[3]]);
  }
  return pool;
}

/** Spoken name for a face, for the tile's accessible label. */
export function faceName(faceId: string): string {
  const face = FACE_BY_ID[faceId];
  switch (face.suit) {
    case "orb":
      return `${face.rank} of orbs`;
    case "bar":
      return `${face.rank} of bars`;
    case "glyph":
      return `${face.rank} of glyphs`;
    case "compass":
      return `${{ N: "North", E: "East", S: "South", W: "West" }[face.label]} compass`;
    case "core":
      return `${{ P: "Pink", C: "Cyan", G: "Green" }[faceId.slice(-1)]} core`;
    case "arcade":
      return `Arcade bonus, ${faceId.slice("arcade-".length)}`;
    case "sky":
      return `Sky bonus, ${faceId.slice("sky-".length)}`;
  }
}

// ---------- Layouts ----------

export interface LayoutLayer {
  z: number;
  /** Half-unit offsets for the whole layer. */
  dx?: number;
  dy?: number;
  /** One string per row; "#" places a tile, anything else is a gap. */
  rows: string[];
}

export interface Layout {
  id: string;
  name: string;
  layers: LayoutLayer[];
}

/*
 * Original layouts, sized for a phone: at most 8 tiles wide, so a 320px
 * screen still gets ~31px tiles.
 */
export const LAYOUTS: Layout[] = [
  {
    id: "pyramid",
    name: "Pyramid",
    layers: [
      { z: 0, rows: ["########", "########", "########", "########", "########", "########"] },
      { z: 1, dx: 2, dy: 2, rows: ["######", "######", "######", "######"] },
      { z: 2, dx: 4, dy: 4, rows: ["####", "####"] },
      { z: 3, dx: 6, dy: 5, rows: ["##"] },
    ],
  },
  {
    id: "fortress",
    name: "Fortress",
    layers: [
      { z: 0, rows: ["########", "########", "########", "########", "########", "########"] },
      { z: 1, rows: ["##....##", "##....##", "..####..", "..####..", "##....##", "##....##"] },
      { z: 2, rows: ["........", "........", "...##...", "...##..."] },
      { z: 2, dx: 1, dy: 1, rows: ["#.....#", ".......", ".......", ".......", "#.....#"] },
    ],
  },
  {
    id: "diamond",
    name: "Diamond",
    layers: [
      { z: 0, rows: ["...##...", "..####..", ".######.", "########", "########", ".######.", "..####..", "...##..."] },
      { z: 1, dy: 2, rows: ["...##...", "..####..", ".######.", ".######.", "..####..", "...##..."] },
      { z: 2, dy: 4, rows: ["...##...", "..####..", "..####..", "...##..."] },
      { z: 3, dy: 6, rows: ["...##...", "...##..."] },
    ],
  },
];

export const LAYOUT_BY_ID: Record<string, Layout> = Object.fromEntries(LAYOUTS.map((l) => [l.id, l]));

export interface Position {
  x: number;
  y: number;
  z: number;
}

export function layoutPositions(layout: Layout): Position[] {
  const positions: Position[] = [];
  for (const layer of layout.layers) {
    layer.rows.forEach((row, r) => {
      [...row].forEach((ch, c) => {
        if (ch === "#") positions.push({ x: (layer.dx ?? 0) + c * 2, y: (layer.dy ?? 0) + r * 2, z: layer.z });
      });
    });
  }
  return positions;
}

/** Board extent in half units, plus the highest layer. */
export function layoutBounds(positions: Position[]): { w: number; h: number; maxZ: number } {
  let w = 0;
  let h = 0;
  let maxZ = 0;
  for (const p of positions) {
    w = Math.max(w, p.x + 2);
    h = Math.max(h, p.y + 2);
    maxZ = Math.max(maxZ, p.z);
  }
  return { w, h, maxZ };
}

// ---------- Freeness ----------

function overlaps(a: Position, b: Position): boolean {
  return Math.abs(a.x - b.x) < 2 && Math.abs(a.y - b.y) < 2;
}

export function isFree(p: Position, all: readonly Position[]): boolean {
  let leftBlocked = false;
  let rightBlocked = false;
  for (const o of all) {
    if (o === p) continue;
    if (o.z > p.z && overlaps(o, p)) return false;
    if (o.z === p.z && Math.abs(o.y - p.y) < 2) {
      if (o.x === p.x - 2) leftBlocked = true;
      else if (o.x === p.x + 2) rightBlocked = true;
    }
  }
  return !(leftBlocked && rightBlocked);
}

// ---------- Random ----------

export type Rng = () => number;

/** Small seeded PRNG so deals are reproducible in tests. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const MAX_DEAL_ATTEMPTS = 200;

/**
 * A removal order for these positions: pairs of positions, each pair free
 * at the moment it is removed. Null if this random attempt dead-ended.
 */
export function removalOrder<T extends Position>(positions: readonly T[], rng: Rng): [T, T][] | null {
  let remaining = [...positions];
  const order: [T, T][] = [];
  while (remaining.length > 0) {
    const free = remaining.filter((p) => isFree(p, remaining));
    if (free.length < 2) return null;
    const [a, b] = shuffle(free, rng);
    order.push([a, b]);
    remaining = remaining.filter((p) => p !== a && p !== b);
  }
  return order;
}

function solvableOrder<T extends Position>(positions: readonly T[], rng: Rng): [T, T][] | null {
  if (positions.length % 2 !== 0) return null;
  for (let attempt = 0; attempt < MAX_DEAL_ATTEMPTS; attempt++) {
    const order = removalOrder(positions, rng);
    if (order) return order;
  }
  return null;
}

// ---------- Game ----------

export interface Tile extends Position {
  id: number;
  faceId: string;
}

export interface GameState {
  layoutId: string;
  tiles: Tile[];
  selectedId: number | null;
  /** Tile sets before each match or shuffle, newest last, for undo. */
  history: Tile[][];
  /** Pairs cleared so far this deal. */
  matched: number;
}

export function deal(layoutId: string, rng: Rng): GameState {
  return dealWithSolution(layoutId, rng).state;
}

/** As deal(), plus the pair order the board was built from (a known solution). */
export function dealWithSolution(layoutId: string, rng: Rng): { state: GameState; solution: [number, number][] } {
  const layout = LAYOUT_BY_ID[layoutId] ?? LAYOUTS[0];
  const positions = layoutPositions(layout);
  const order = solvableOrder(positions, rng);
  if (!order) throw new Error(`Layout ${layout.id} could not be dealt`);
  const pairs = shuffle(pairPool(rng), rng).slice(0, order.length);

  const tiles: Tile[] = [];
  const pairTiles: [Tile, Tile][] = [];
  order.forEach(([pa, pb], i) => {
    const [fa, fb] = pairs[i];
    const ta = { ...pa, id: 0, faceId: fa.id };
    const tb = { ...pb, id: 0, faceId: fb.id };
    tiles.push(ta, tb);
    pairTiles.push([ta, tb]);
  });
  // Ids in board (draw) order, not removal order, so they leak nothing
  // about the solution.
  tiles.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
  tiles.forEach((t, i) => (t.id = i));

  return {
    state: { layoutId: layout.id, tiles, selectedId: null, history: [], matched: 0 },
    solution: pairTiles.map(([a, b]) => [a.id, b.id]),
  };
}

export function matchKey(tile: Tile): string {
  return FACE_BY_ID[tile.faceId].matchKey;
}

export function freeIds(tiles: readonly Tile[]): Set<number> {
  return new Set(tiles.filter((t) => isFree(t, tiles)).map((t) => t.id));
}

/** Every pair of free tiles that match right now. */
export function availablePairs(tiles: readonly Tile[]): [Tile, Tile][] {
  const free = tiles.filter((t) => isFree(t, tiles));
  const pairs: [Tile, Tile][] = [];
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (matchKey(free[i]) === matchKey(free[j])) pairs.push([free[i], free[j]]);
    }
  }
  return pairs;
}

export function isWon(state: GameState): boolean {
  return state.tiles.length === 0;
}

export function isStuck(state: GameState): boolean {
  return state.tiles.length > 0 && availablePairs(state.tiles).length === 0;
}

export type SelectResult = "selected" | "deselected" | "matched" | "blocked" | "switched";

/**
 * Tap a tile. A blocked tile can't be picked; a free tile becomes the
 * selection, clears it if already selected, or - if it matches the
 * selection - removes both.
 */
export function selectTile(state: GameState, id: number): { state: GameState; result: SelectResult } {
  const tile = state.tiles.find((t) => t.id === id);
  if (!tile || !isFree(tile, state.tiles)) return { state, result: "blocked" };

  if (state.selectedId === null) return { state: { ...state, selectedId: id }, result: "selected" };
  if (state.selectedId === id) return { state: { ...state, selectedId: null }, result: "deselected" };

  const selected = state.tiles.find((t) => t.id === state.selectedId);
  if (selected && matchKey(selected) === matchKey(tile)) {
    return {
      state: {
        ...state,
        tiles: state.tiles.filter((t) => t.id !== id && t.id !== selected.id),
        selectedId: null,
        history: [...state.history, state.tiles],
        matched: state.matched + 1,
      },
      result: "matched",
    };
  }
  return { state: { ...state, selectedId: id }, result: "switched" };
}

export function undo(state: GameState): GameState {
  if (state.history.length === 0) return state;
  const tiles = state.history[state.history.length - 1];
  const removedPair = tiles.length > state.tiles.length;
  return {
    ...state,
    tiles,
    selectedId: null,
    history: state.history.slice(0, -1),
    matched: removedPair ? state.matched - 1 : state.matched,
  };
}

/**
 * Redeal the remaining faces onto the remaining positions so the board
 * is winnable again. Null if no arrangement of these positions can be
 * cleared at all (e.g. the last two tiles stacked on each other).
 */
export function shuffleRemaining(state: GameState, rng: Rng): GameState | null {
  if (state.tiles.length === 0) return null;
  const order = solvableOrder(state.tiles, rng);
  if (!order) return null;

  const byKey = new Map<string, string[]>();
  for (const t of state.tiles) {
    const key = matchKey(t);
    byKey.set(key, [...(byKey.get(key) ?? []), t.faceId]);
  }
  const facePairs: [string, string][] = [];
  for (const faces of byKey.values()) {
    const mixed = shuffle(faces, rng);
    for (let i = 0; i + 1 < mixed.length; i += 2) facePairs.push([mixed[i], mixed[i + 1]]);
  }
  const pairs = shuffle(facePairs, rng);

  const faceForId = new Map<number, string>();
  order.forEach(([a, b], i) => {
    faceForId.set(a.id, pairs[i][0]);
    faceForId.set(b.id, pairs[i][1]);
  });

  return {
    ...state,
    tiles: state.tiles.map((t) => ({ ...t, faceId: faceForId.get(t.id)! })),
    selectedId: null,
    history: [...state.history, state.tiles],
  };
}
