interface IconProps {
  className?: string;
}

export function SnakeIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <polyline
        className="gi-snake-body"
        points="5,25 12,25 12,17 19,17 19,10"
        fill="none"
        stroke="var(--toxic)"
        strokeWidth="3"
        strokeLinecap="square"
        strokeLinejoin="miter"
        strokeDasharray="4.5 2.2"
      />
      <rect x="19" y="6" width="7" height="7" fill="var(--toxic)" />
      <rect x="21.2" y="8.2" width="2.4" height="2.4" fill="var(--void)" />
    </svg>
  );
}
