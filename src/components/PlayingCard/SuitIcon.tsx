import { SUIT_PATHS } from "./suitPaths";
import type { Suit } from "./types";

interface SuitIconProps {
  suit: Suit;
  className?: string;
  style?: React.CSSProperties;
}

export function SuitIcon({ suit, className, style }: SuitIconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true" focusable="false">
      <path d={SUIT_PATHS[suit]} fill="currentColor" />
    </svg>
  );
}
