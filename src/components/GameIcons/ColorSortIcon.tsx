interface IconProps {
  className?: string;
}

export function ColorSortIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path
        d="M11 4 L11 20 A5 5 0 0 0 21 20 L21 4"
        fill="none"
        stroke="var(--laser-blue)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M12.2 19.4 A4 4 0 0 0 19.8 19.4 L19.8 15 L12.2 15 Z" fill="var(--toxic)" />
      <rect className="gi-cs-block" x="12.2" y="9" width="7.6" height="4.5" fill="var(--hot-pink)" />
      <line x1="9" y1="4" x2="23" y2="4" stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
