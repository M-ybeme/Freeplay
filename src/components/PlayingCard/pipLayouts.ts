import type { Rank } from "./types";

export interface PipPosition {
  x: number;
  y: number;
}

// Approximate standard playing-card pip arrangements as points on a
// 0-100 (x, y) grid. Not obsessively traditional (no rotated bottom pips),
// but immediately readable at small sizes.
export const PIP_LAYOUTS: Partial<Record<Rank, PipPosition[]>> = {
  "2": [
    { x: 50, y: 0 },
    { x: 50, y: 100 },
  ],
  "3": [
    { x: 50, y: 0 },
    { x: 50, y: 50 },
    { x: 50, y: 100 },
  ],
  "4": [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
  ],
  "5": [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 50 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
  ],
  "6": [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 50 },
    { x: 100, y: 50 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
  ],
  "7": [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 25 },
    { x: 0, y: 50 },
    { x: 100, y: 50 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
  ],
  "8": [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 25 },
    { x: 0, y: 50 },
    { x: 100, y: 50 },
    { x: 50, y: 75 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
  ],
  "9": [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 0, y: 35 },
    { x: 100, y: 35 },
    { x: 50, y: 50 },
    { x: 0, y: 65 },
    { x: 100, y: 65 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
  ],
  "10": [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 50, y: 15 },
    { x: 0, y: 35 },
    { x: 100, y: 35 },
    { x: 0, y: 65 },
    { x: 100, y: 65 },
    { x: 50, y: 85 },
    { x: 0, y: 100 },
    { x: 100, y: 100 },
  ],
};
