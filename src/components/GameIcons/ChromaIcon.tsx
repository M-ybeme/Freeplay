interface IconProps {
  className?: string;
}

/* Two neon cards: a pink triangle under a cyan +4, the game's signature
   card. In attract mode the front card flips to its wild face and back. */
export function ChromaIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <g transform="rotate(-14 16 16)">
        <rect x="5" y="5" width="15" height="21" rx="2" fill="var(--surface)" stroke="var(--hot-pink)" strokeWidth="1.5" />
        <path d="M12.5 11.5 16 17.5H9Z" fill="var(--hot-pink)" />
      </g>
      <g className="gi-cc-front">
        <rect x="11" y="6" width="16" height="22" rx="2" fill="var(--surface)" stroke="var(--laser-blue)" strokeWidth="1.75" />
        <text
          className="gi-cc-face"
          x="19"
          y="20.6"
          textAnchor="middle"
          fill="var(--laser-blue)"
          fontSize="10"
          fontWeight="800"
          style={{ fontFamily: "var(--font-display)" }}
        >
          +4
        </text>
        <g className="gi-cc-wild" opacity="0">
          <path d="M19 17v-4.5a4.5 4.5 0 0 1 4.5 4.5Z" fill="var(--laser-blue)" />
          <path d="M19 17h4.5a4.5 4.5 0 0 1-4.5 4.5Z" fill="var(--hot-pink)" />
          <path d="M19 17v4.5a4.5 4.5 0 0 1-4.5-4.5Z" fill="var(--toxic)" />
          <path d="M19 17h-4.5a4.5 4.5 0 0 1 4.5-4.5Z" fill="var(--orange)" />
        </g>
      </g>
    </svg>
  );
}
