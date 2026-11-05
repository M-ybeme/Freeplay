import { memo } from "react";
import { FACE_BY_ID } from "./logic";

/*
 * Neon tile faces, drawn in a 40 x 50 box. Each suit has its own shape
 * as well as its own colour, so matching never depends on hue alone:
 *   orbs   - glowing rings (cyan)          bars  - laser bars (green)
 *   glyphs - circuit numerals (pink)       compass - arrows N/E/S/W
 *   cores  - diamond / ring / hexagon      bonus - arcade and sky sets
 */

const COLS = [11, 20, 29];
const ROWS = [14, 25, 36];

/** Pip positions for 1-9, in the 3 x 3 grid above. */
const PIPS: Record<number, [number, number][]> = {
  1: [[20, 25]],
  2: [
    [20, 15],
    [20, 35],
  ],
  3: [
    [11, 14],
    [20, 25],
    [29, 36],
  ],
  4: [
    [12, 15],
    [28, 15],
    [12, 35],
    [28, 35],
  ],
  5: [
    [11, 14],
    [29, 14],
    [20, 25],
    [11, 36],
    [29, 36],
  ],
  6: [
    [13, 14],
    [27, 14],
    [13, 25],
    [27, 25],
    [13, 36],
    [27, 36],
  ],
  7: [
    [11, 14],
    [20, 14],
    [29, 14],
    [13, 26],
    [27, 26],
    [13, 37],
    [27, 37],
  ],
  8: COLS.flatMap((x) => ROWS.map((y) => [x, y] as [number, number])).filter(([x, y]) => !(x === 20 && y === 25)),
  9: COLS.flatMap((x) => ROWS.map((y) => [x, y] as [number, number])),
};

const CORE_COLOURS = { P: "var(--hot-pink)", C: "var(--laser-blue)", G: "var(--toxic)" } as const;

function Orbs({ n }: { n: number }) {
  if (n === 1) {
    return (
      <g stroke="var(--laser-blue)" fill="none">
        <circle cx="20" cy="25" r="10" strokeWidth="2.2" />
        <circle cx="20" cy="25" r="5" strokeWidth="1.4" />
        <circle cx="20" cy="25" r="1.8" fill="var(--laser-blue)" stroke="none" />
      </g>
    );
  }
  const r = n <= 4 ? 4.6 : 3.6;
  return (
    <g stroke="var(--laser-blue)" fill="none" strokeWidth="1.6">
      {PIPS[n].map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={r} />
          <circle cx={x} cy={y} r={1.3} fill="var(--laser-blue)" stroke="none" />
        </g>
      ))}
    </g>
  );
}

function Bars({ n }: { n: number }) {
  if (n === 1) {
    return (
      <g fill="var(--toxic)">
        <rect x="17" y="10" width="6" height="30" rx="3" />
        <rect x="11" y="23" width="18" height="4" rx="2" opacity="0.6" />
      </g>
    );
  }
  const h = n <= 4 ? 11 : 8;
  return (
    <g fill="var(--toxic)">
      {PIPS[n].map(([x, y], i) => (
        <rect key={i} x={x - 1.6} y={y - h / 2} width="3.2" height={h} rx="1.6" />
      ))}
    </g>
  );
}

function Glyph({ n }: { n: number }) {
  return (
    <g>
      <text
        x="20"
        y="30"
        textAnchor="middle"
        fontFamily="Orbitron, sans-serif"
        fontWeight="900"
        fontSize="21"
        fill="var(--hot-pink)"
      >
        {n}
      </text>
      <polyline points="8,40 15,40 18,36 26,36 29,40 32,40" fill="none" stroke="var(--hot-pink)" strokeWidth="1.2" opacity="0.8" />
      <circle cx="8" cy="40" r="1.4" fill="var(--hot-pink)" />
      <circle cx="32" cy="40" r="1.4" fill="var(--hot-pink)" />
    </g>
  );
}

const COMPASS_ROTATION: Record<string, number> = { N: 0, E: 90, S: 180, W: 270 };

function Compass({ dir }: { dir: string }) {
  return (
    <g>
      <circle cx="20" cy="26" r="11" fill="none" stroke="var(--orange)" strokeWidth="1.2" opacity="0.6" />
      <g transform={`rotate(${COMPASS_ROTATION[dir]} 20 26)`}>
        <polygon points="20,13 26,27 20,24 14,27" fill="var(--orange)" />
        <polygon points="20,39 24,28 20,30 16,28" fill="none" stroke="var(--orange)" strokeWidth="1" opacity="0.7" />
      </g>
    </g>
  );
}

function Core({ kind }: { kind: "P" | "C" | "G" }) {
  const c = CORE_COLOURS[kind];
  if (kind === "P") {
    return (
      <g stroke={c} fill="none" strokeWidth="2">
        <polygon points="20,12 31,25 20,38 9,25" />
        <polygon points="20,19 25,25 20,31 15,25" fill={c} stroke="none" />
      </g>
    );
  }
  if (kind === "C") {
    return (
      <g stroke={c} fill="none" strokeWidth="2">
        <circle cx="20" cy="25" r="11" />
        <circle cx="20" cy="25" r="5.5" fill={c} stroke="none" />
        <line x1="20" y1="10" x2="20" y2="14" />
        <line x1="20" y1="36" x2="20" y2="40" />
      </g>
    );
  }
  return (
    <g stroke={c} fill="none" strokeWidth="2">
      <polygon points="20,12 31,18.5 31,31.5 20,38 9,31.5 9,18.5" />
      <polygon points="20,19 25.5,22 25.5,28 20,31 14.5,28 14.5,22" fill={c} stroke="none" />
    </g>
  );
}

const ARCADE_COLOUR = "var(--uv-purple-text)";
const SKY_COLOUR = "#ffd166";

function Arcade({ name }: { name: string }) {
  const c = ARCADE_COLOUR;
  switch (name) {
    case "joystick":
      return (
        <g>
          <rect x="10" y="32" width="20" height="6" rx="2" fill="none" stroke={c} strokeWidth="1.6" />
          <line x1="20" y1="32" x2="20" y2="18" stroke={c} strokeWidth="2.4" />
          <circle cx="20" cy="15" r="5" fill={c} />
        </g>
      );
    case "coin":
      return (
        <g stroke={c} fill="none" strokeWidth="1.8">
          <circle cx="20" cy="25" r="11" />
          <circle cx="20" cy="25" r="7.5" strokeWidth="1" />
          <line x1="20" y1="19" x2="20" y2="31" strokeWidth="2.4" />
        </g>
      );
    case "star":
      return <polygon points="20,11 23.5,21 34,21 25.5,27.5 28.5,38 20,31.5 11.5,38 14.5,27.5 6,21 16.5,21" fill={c} />;
    default:
      return <polygon points="23,9 12,27 19,27 16,41 29,22 21.5,22" fill={c} />;
  }
}

function Sky({ name }: { name: string }) {
  const c = SKY_COLOUR;
  switch (name) {
    case "sun":
      return (
        <g stroke={c} strokeWidth="1.8">
          <circle cx="20" cy="25" r="6" fill={c} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <line key={i} x1={20 + Math.cos(a) * 9} y1={25 + Math.sin(a) * 9} x2={20 + Math.cos(a) * 13} y2={25 + Math.sin(a) * 13} />;
          })}
        </g>
      );
    case "moon":
      return <path d="M26 12 A13 13 0 1 0 26 38 A8 13 0 0 1 26 12 Z" fill={c} />;
    case "comet":
      return (
        <g stroke={c} strokeWidth="1.6" strokeLinecap="round">
          <circle cx="26" cy="19" r="5" fill={c} stroke="none" />
          <line x1="22" y1="23" x2="10" y2="35" />
          <line x1="20" y1="20" x2="11" y2="27" opacity="0.7" />
          <line x1="25" y1="25" x2="18" y2="36" opacity="0.7" />
        </g>
      );
    default:
      return (
        <g>
          <circle cx="20" cy="25" r="7" fill={c} />
          <ellipse cx="20" cy="25" rx="14" ry="4.5" fill="none" stroke={c} strokeWidth="1.6" transform="rotate(-20 20 25)" />
        </g>
      );
  }
}

function FaceArt({ faceId }: { faceId: string }) {
  const face = FACE_BY_ID[faceId];
  switch (face.suit) {
    case "orb":
      return <Orbs n={face.rank} />;
    case "bar":
      return <Bars n={face.rank} />;
    case "glyph":
      return <Glyph n={face.rank} />;
    case "compass":
      return <Compass dir={face.label} />;
    case "core":
      return <Core kind={faceId.slice(-1) as "P" | "C" | "G"} />;
    case "arcade":
      return <Arcade name={faceId.slice("arcade-".length)} />;
    case "sky":
      return <Sky name={faceId.slice("sky-".length)} />;
  }
}

export const TileFace = memo(function TileFace({ faceId }: { faceId: string }) {
  const face = FACE_BY_ID[faceId];
  return (
    <svg className="mahjong-face" viewBox="0 0 40 50" aria-hidden="true" focusable="false">
      <FaceArt faceId={faceId} />
      {face.label && (
        <text className="mahjong-face__index" x="4" y="9" fontSize="7.5">
          {face.label}
        </text>
      )}
    </svg>
  );
});
