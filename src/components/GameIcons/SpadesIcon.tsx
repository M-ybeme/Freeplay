import { SUIT_PATHS } from "../PlayingCard/suitPaths";

interface IconProps {
  className?: string;
}

/* A card laid on the trick: a spade over a card already on the table. */
export function SpadesIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <g transform="rotate(-14 16 16)">
        <rect x="5" y="5" width="15" height="21" rx="1.75" fill="var(--surface)" stroke="var(--muted)" strokeWidth="1.5" />
      </g>
      <g className="gi-sp-card">
        <rect x="11" y="6" width="16" height="22" rx="1.75" fill="var(--surface)" stroke="var(--uv-purple)" strokeWidth="1.75" />
        {/* The shared suit glyph is drawn in a 24-unit box. */}
        <path d={SUIT_PATHS.spades} fill="var(--laser-blue)" transform="translate(13.6 9.6) scale(0.45)" />
      </g>
    </svg>
  );
}
