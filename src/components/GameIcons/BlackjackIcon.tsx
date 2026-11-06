interface IconProps {
  className?: string;
}

export function BlackjackIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <polygon
        points="5,5 20,5 20,22 9,22 5,18"
        fill="var(--surface)"
        stroke="var(--uv-purple)"
        strokeWidth="1.75"
        strokeLinejoin="miter"
      />
      <g className="gi-bj-front">
      <polygon
        points="12,10 27,10 27,27 16,27 12,23"
        fill="var(--surface)"
        stroke="var(--laser-blue)"
        strokeWidth="1.75"
        strokeLinejoin="miter"
      />
      <rect
        x="18.5"
        y="16.5"
        width="4"
        height="4"
        fill="var(--hot-pink)"
        transform="rotate(45 20.5 18.5)"
      />
      </g>
    </svg>
  );
}
