interface IconProps {
  className?: string;
}

export function MinesweeperIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <polygon
        points="16,6 26,16 16,26 6,16"
        fill="none"
        stroke="var(--hot-pink)"
        strokeWidth="2"
        strokeLinejoin="miter"
      />
      <line x1="16" y1="2" x2="16" y2="5" stroke="var(--orange)" strokeWidth="2" />
      <line x1="16" y1="27" x2="16" y2="30" stroke="var(--orange)" strokeWidth="2" />
      <line x1="2" y1="16" x2="5" y2="16" stroke="var(--orange)" strokeWidth="2" />
      <line x1="27" y1="16" x2="30" y2="16" stroke="var(--orange)" strokeWidth="2" />
      <circle cx="16" cy="16" r="3" fill="var(--orange)" />
    </svg>
  );
}
