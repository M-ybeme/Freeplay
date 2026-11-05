interface IconProps {
  className?: string;
}

export function MahjongIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect x="9" y="8" width="13" height="17" rx="2" fill="#1b1731" transform="translate(2 2)" />
      <rect x="9" y="8" width="13" height="17" rx="2" fill="var(--surface)" stroke="var(--uv-purple)" strokeWidth="1.5" transform="translate(2 2)" />
      <rect x="6" y="5" width="13" height="17" rx="2" fill="var(--surface)" stroke="var(--laser-blue)" strokeWidth="1.5" />
      <polygon points="12.5,9 17,13.5 12.5,18 8,13.5" fill="none" stroke="var(--hot-pink)" strokeWidth="1.5" />
      <polygon points="12.5,11.8 14.2,13.5 12.5,15.2 10.8,13.5" fill="var(--hot-pink)" />
    </svg>
  );
}
