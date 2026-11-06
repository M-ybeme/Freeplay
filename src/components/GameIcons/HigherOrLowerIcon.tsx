interface IconProps {
  className?: string;
}

export function HigherOrLowerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <polyline
        className="gi-hol-up"
        points="8,15 16,7 24,15"
        fill="none"
        stroke="var(--laser-blue)"
        strokeWidth="2.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <polyline
        className="gi-hol-down"
        points="8,17 16,25 24,17"
        fill="none"
        stroke="var(--uv-purple)"
        strokeWidth="2.5"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
      <line x1="12.5" y1="16" x2="19.5" y2="16" stroke="var(--muted)" strokeWidth="1.5" />
    </svg>
  );
}
