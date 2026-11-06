import { SUIT_PATHS } from "./suitPaths";
import type { Rank, Suit } from "./types";

/*
 * Original court figures and card back, drawn in the same flat line
 * language as the suit glyphs and the chess pieces: chamfered geometry,
 * currentColor, no gradients. Nothing here is copied from a real deck.
 */

type Court = "J" | "Q" | "K";

/* One half of a court card, in a 40 x 37 box standing on y = 37. */
const BODY = "M5 37 V33 C5 28 10 25.5 15 25 H25 C30 25.5 35 28 35 33 V37 Z";
const NECK = "M17.5 21 H22.5 V25.5 H17.5 Z";
const HEAD = "M14.5 13 H25.5 V19 L22.5 22.5 H17.5 L14.5 19 Z";

/* What each court wears and carries: the shape that tells them apart. */
const GEAR: Record<Court, { solid: string; lines: string }> = {
  // Jack: a visored helmet with a crest.
  J: {
    solid: "M13.5 14.5 V11 C13.5 6.5 16.5 4.5 20 4.5 C23.5 4.5 26.5 6.5 26.5 11 V14.5 Z",
    lines: "M15.5 16.5 H24.5 M20 4.5 V1.5",
  },
  // Queen: a pointed tiara with an orb, and a veil to the shoulders.
  Q: {
    solid: "M14 13 L13 6.5 L16.5 9.5 L20 4.5 L23.5 9.5 L27 6.5 L26 13 Z M21.3 2.6 A1.3 1.3 0 1 1 21.29 2.6 Z",
    lines: "M14.5 14 L12 25.5 M25.5 14 L28 25.5",
  },
  // King: a tall crown with a cross, a beard, and a raised blade.
  K: {
    solid: "M13.5 13 V4.5 L17 8 L20 3.5 L23 8 L26.5 4.5 V13 Z",
    lines: "M20 3.5 V0.8 M18.7 1.9 H21.3 M16 19 L20 24 L24 19 M32 4 V24 M30 8.5 H34",
  },
};

/* Rank chevrons on the chest: one for a jack, two for a queen, three for a king. */
const CHEVRONS: Record<Court, number> = { J: 1, Q: 2, K: 3 };

function CourtHalf({ rank }: { rank: Court }) {
  const gear = GEAR[rank];
  const chevrons = Array.from({ length: CHEVRONS[rank] }, (_, i) => {
    const y = 28.5 + i * 2.4;
    return `M8 ${y + 1.8} L10.5 ${y} L13 ${y + 1.8}`;
  }).join(" ");
  return (
    <>
      <path className="pc-court__body" d={BODY} />
      <path className="pc-court__body" d={NECK} />
      <path className="pc-court__head" d={HEAD} />
      <path className="pc-court__gear" d={gear.solid} />
      <path className="pc-court__line" d={`${gear.lines} M15 25 L20 29 L25 25 ${chevrons}`} />
    </>
  );
}

/*
 * A two-ended court figure (mirrored top and bottom, so it reads the same
 * either way up) with the suit on a plate where the halves meet. Fills a
 * panel of about 40:74, which is what the card's court panel works out to.
 */
export function CourtFigure({ rank, suit }: { rank: Rank; suit: Suit }) {
  const court = rank as Court;
  return (
    <svg className="pc-court" viewBox="0 0 40 74" aria-hidden="true" focusable="false">
      <CourtHalf rank={court} />
      <g transform="rotate(180 20 37)">
        <CourtHalf rank={court} />
      </g>
      <path className="pc-court__line" d="M3 37 H14 M26 37 H37" />
      <rect className="pc-court__plate" x="14" y="31" width="12" height="12" />
      <path d={SUIT_PATHS[suit]} fill="currentColor" transform="translate(15.5 32.5) scale(0.375)" />
    </svg>
  );
}

/*
 * The shared Freeplay back: a lit chamfered frame, a second inner frame,
 * corner ticks and a diamond emblem around FP, over the lattice drawn in
 * CSS. Drawn in the card's own 50 x 70 box.
 */
export function CardBackArt() {
  return (
    <svg className="pc-back" viewBox="0 0 50 70" aria-hidden="true" focusable="false">
      <path className="pc-back__frame" d="M10 4.5 H45.5 V60 L40 65.5 H4.5 V10 Z" />
      <path className="pc-back__inner" d="M11.5 8 H42 V58.5 L38.5 62 H8 V11.5 Z" />
      <path className="pc-back__ticks" d="M8 15 V11.5 L11.5 8 H15 M35 62 H38.5 L42 58.5 V55" />
      <path className="pc-back__emblem" d="M25 21 L38 35 L25 49 L12 35 Z" />
      <path className="pc-back__emblem-inner" d="M25 25.5 L33.8 35 L25 44.5 L16.2 35 Z" />
      <text className="pc-back__mark" x="25" y="35" textAnchor="middle" dominantBaseline="central">
        FP
      </text>
    </svg>
  );
}
