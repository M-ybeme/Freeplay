interface IconProps {
  className?: string;
}

export function ReversiIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect x="3" y="3" width="26" height="26" rx="2" fill="none" stroke="var(--line)" strokeWidth="1" />
      <line x1="16" y1="3" x2="16" y2="29" stroke="var(--line)" strokeWidth="1" />
      <line x1="3" y1="16" x2="29" y2="16" stroke="var(--line)" strokeWidth="1" />
      <circle cx="9.5" cy="9.5" r="4" fill="none" stroke="var(--laser-blue)" strokeWidth="2" />
      <circle cx="22.5" cy="22.5" r="4" fill="none" stroke="var(--laser-blue)" strokeWidth="2" />
      <circle className="gi-rv-flip" cx="22.5" cy="9.5" r="4.6" fill="var(--hot-pink)" />
      <circle cx="9.5" cy="22.5" r="4.6" fill="var(--hot-pink)" />
    </svg>
  );
}
