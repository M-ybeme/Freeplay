interface IconProps {
  className?: string;
}

// Four small energy units converging into one stronger, brighter core -
// abstract fusion geometry rather than literal numerals, which would be
// illegible at card/icon size.
export function Game2048Icon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect className="gi-2048-tile gi-2048-tl" x="3" y="3" width="6" height="6" fill="var(--laser-blue)" />
      <rect className="gi-2048-tile gi-2048-tr" x="23" y="3" width="6" height="6" fill="var(--laser-blue)" />
      <rect className="gi-2048-tile gi-2048-bl" x="3" y="23" width="6" height="6" fill="var(--laser-blue)" />
      <rect className="gi-2048-tile gi-2048-br" x="23" y="23" width="6" height="6" fill="var(--laser-blue)" />
      <line x1="9" y1="9" x2="12.5" y2="12.5" stroke="var(--muted)" strokeWidth="1.5" />
      <line x1="23" y1="9" x2="19.5" y2="12.5" stroke="var(--muted)" strokeWidth="1.5" />
      <line x1="9" y1="23" x2="12.5" y2="19.5" stroke="var(--muted)" strokeWidth="1.5" />
      <line x1="23" y1="23" x2="19.5" y2="19.5" stroke="var(--muted)" strokeWidth="1.5" />
      <rect className="gi-2048-merge" x="11" y="11" width="10" height="10" fill="var(--hot-pink)" />
    </svg>
  );
}
