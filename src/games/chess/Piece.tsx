import type { CSSProperties } from "react";
import type { Color, PieceType } from "./logic";

/*
 * Original neon pieces, drawn in a 40x40 box and cropped to them. The two sides differ in
 * shape as well as colour: cyan pieces are lit outlines with hollow
 * bodies, pink pieces are solid. Every piece shares one base plate.
 */

const BASE = "M10 31.5 H30 V35.5 H10 Z";

const SHAPES: Record<PieceType, { body: string; detail?: string }> = {
  p: {
    body: "M20 8.5 A5 5 0 1 1 19.99 8.5 Z M15.5 20 H24.5 L23 22 L25.5 31.5 H14.5 L17 22 Z",
  },
  r: {
    body: "M12 8 H15.5 V11.5 H18.25 V8 H21.75 V11.5 H24.5 V8 H28 V15 L25.5 17.5 V27.5 L28 31.5 H12 L14.5 27.5 V17.5 L12 15 Z",
    detail: "M16 17.5 H24",
  },
  n: {
    body: "M14 31.5 L15.5 23 L11.5 20 L12.5 15 L18.5 9 L19 5.5 L22.5 8.5 C27 10.5 29.5 16 28.5 23 L27.5 31.5 Z",
    detail: "M17.5 14 h0.01 M15 20.5 L19.5 18.5",
  },
  b: {
    body: "M20 3.5 A2.2 2.2 0 1 1 19.99 3.5 Z M20 7.5 C25 11 27.5 16 24 21 L25 31.5 H15 L16 21 C12.5 16 15 11 20 7.5 Z",
    detail: "M22.5 12 L18 17.5 M16 21 H24",
  },
  q: {
    body: "M9.5 11 L13 24 L15 10 L17.5 22.5 L20 7.5 L22.5 22.5 L25 10 L27 24 L30.5 11 L27.5 31.5 H12.5 Z",
    detail: "M13.5 27 H26.5",
  },
  k: {
    body: "M18.5 3.5 H21.5 V7 H25 V10 H21.5 V13 H18.5 V10 H15 V7 H18.5 Z M14 16 C17.5 13.5 22.5 13.5 26 16 L24.5 22 L27 31.5 H13 L15.5 22 Z",
    detail: "M15.5 22 H24.5",
  },
};

export function Piece({ type, color, className = "", style }: { type: PieceType; color: Color; className?: string; style?: CSSProperties }) {
  const shape = SHAPES[type];
  return (
    <svg
      className={`chess-piece chess-piece--${color === "white" ? "cyan" : "pink"} ${className}`}
      viewBox="4.5 4.5 31 31"
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <path className="chess-piece__body" d={`${shape.body} ${BASE}`} />
      {shape.detail && <path className="chess-piece__detail" d={shape.detail} />}
    </svg>
  );
}
