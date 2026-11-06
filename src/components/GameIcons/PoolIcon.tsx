interface IconProps {
  className?: string;
}

/* An 8 ball with a cue lined up on it. In attract mode the cue draws
   back and strikes, and the ball rolls off and back. */
export function PoolIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <g className="gi-pl-cue">
        <path d="M3.5 28.5 12.6 19.4" stroke="var(--uv-purple)" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M12.6 19.4 13.6 18.4" stroke="var(--laser-blue)" strokeWidth="2.2" strokeLinecap="round" />
      </g>
      <g className="gi-pl-ball">
        <circle cx="20" cy="12" r="7.5" fill="#15121f" stroke="var(--uv-purple)" strokeWidth="1.4" />
        <circle cx="20" cy="12" r="3.6" fill="#f4f1ff" />
        <text x="20" y="14.4" textAnchor="middle" fontSize="6.4" fontWeight="800" fill="#15121f" style={{ fontFamily: "var(--font-display)" }}>
          8
        </text>
        <circle cx="17.3" cy="8.6" r="1.4" fill="#fff" opacity="0.35" />
      </g>
    </svg>
  );
}
