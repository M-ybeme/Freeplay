import type { Suit } from "./types";

interface SuitIconProps {
  suit: Suit;
  className?: string;
  style?: React.CSSProperties;
}

// Simple, crisp, single-fill geometric suit glyphs (currentColor) matching
// the line/shape language of the custom game icons — clean geometry, no
// gradients or skeuomorphism, legible at very small sizes.
const PATHS: Record<Suit, string> = {
  spades:
    "M12 2C9 6 3 10 3 14.5 3 17.5 5.5 20 8.5 20c1.5 0 2.7-.6 3.5-1.5-.3 2-1.5 3-3.5 3.5h7c-2-.5-3.2-1.5-3.5-3.5.8.9 2 1.5 3.5 1.5 3 0 5.5-2.5 5.5-5.5C21 10 15 6 12 2z",
  hearts:
    "M12 21S4.5 16.5 2 12C0.5 8 2 3 6 3c2.5 0 4 1.5 6 4 2-2.5 3.5-4 6-4 4 0 5.5 5 4 9-2.5 4.5-10 9-10 9z",
  diamonds: "M12 2 20 12 12 22 4 12Z",
  clubs:
    "M12 4a4 4 0 0 1 3.6 5.8A4 4 0 1 1 13.2 17h-2.4a4 4 0 1 1-2.4-7.2A4 4 0 0 1 12 4ZM10 15l-1 6h6l-1-6Z",
};

export function SuitIcon({ suit, className, style }: SuitIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true" focusable="false">
      <path d={PATHS[suit]} fill="currentColor" />
    </svg>
  );
}
