interface IconProps {
  className?: string;
}

export function BrickBreakerIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect x="3" y="4" width="8" height="4" fill="var(--hot-pink)" />
      <rect x="12" y="4" width="8" height="4" fill="var(--orange)" />
      <g className="gi-bb-brick">
        <rect x="21" y="4" width="8" height="4" fill="none" stroke="var(--laser-blue)" strokeWidth="1.5" />
        <rect x="23.5" y="5.4" width="3" height="1.2" fill="var(--laser-blue)" />
      </g>
      <rect x="7.5" y="9.5" width="8" height="4" fill="var(--toxic)" />
      <line className="gi-bb-trail" x1="10" y1="25" x2="19" y2="16" stroke="var(--laser-blue)" strokeWidth="1.2" strokeDasharray="1.5 1.8" opacity="0.7" />
      <circle className="gi-bb-ball" cx="20" cy="15" r="2.2" fill="#fff" />
      <rect className="gi-bb-paddle" x="5" y="25.5" width="12" height="2.8" rx="1.4" fill="var(--hot-pink)" />
    </svg>
  );
}
