interface IconProps {
  className?: string;
}

// Two signal pairs, each a bent conduit between two nodes - the bends keep
// the two routes clear of one another rather than crossing directly,
// echoing the actual board's pipe-and-node rendering at icon scale.
export function FlowIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path d="M6 6 L6 14 L14 14" stroke="var(--laser-blue)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="6" cy="6" r="3" fill="var(--void)" stroke="var(--laser-blue)" strokeWidth="2" />
      <circle cx="14" cy="14" r="3" fill="var(--void)" stroke="var(--laser-blue)" strokeWidth="2" />

      <path d="M26 26 L26 18 L18 18" stroke="var(--hot-pink)" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="26" cy="26" r="3" fill="var(--void)" stroke="var(--hot-pink)" strokeWidth="2" />
      <circle cx="18" cy="18" r="3" fill="var(--void)" stroke="var(--hot-pink)" strokeWidth="2" />
    </svg>
  );
}
