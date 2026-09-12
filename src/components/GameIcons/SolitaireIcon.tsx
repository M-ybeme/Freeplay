interface IconProps {
  className?: string;
}

// A small fan of three cards pivoting from one base point - distinct from
// Blackjack's two flat overlapping cards - with a suit pip on the upright
// center card standing in for the foundation motif.
export function SolitaireIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <g transform="rotate(-16 16 27)">
        <rect x="10" y="4" width="12" height="17" rx="1.5" fill="var(--surface)" stroke="var(--muted)" strokeWidth="1.5" />
      </g>
      <g transform="rotate(16 16 27)">
        <rect x="10" y="4" width="12" height="17" rx="1.5" fill="var(--surface)" stroke="var(--muted)" strokeWidth="1.5" />
      </g>
      <rect x="10" y="4" width="12" height="17" rx="1.5" fill="var(--surface)" stroke="var(--laser-blue)" strokeWidth="1.75" />
      <path d="M16 9 L19.2 13 L16 17 L12.8 13 Z" fill="var(--hot-pink)" />
    </svg>
  );
}
