interface IconProps {
  className?: string;
}

export function ChessIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <path d="M3 3h8.67v8.67H3zM20.33 3H29v8.67h-8.67zM11.67 11.67h8.66v8.66h-8.66zM3 20.33h8.67V29H3zM20.33 20.33H29V29h-8.67z" fill="var(--line)" opacity="0.35" />
      <rect x="3" y="3" width="26" height="26" rx="1.5" fill="none" stroke="var(--line)" strokeWidth="1" />
      {/* Cyan outline king, pink solid knight. */}
      <path
        d="M10.4 6.5h1.6v1.8h1.8v1.6h-1.8v1.6h-1.6V9.9H8.6V8.3h1.8zM8 13c2-1.4 4.6-1.4 6.6 0l-.8 3.2 1.4 5H7.4l1.4-5z"
        fill="none"
        stroke="var(--laser-blue)"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path className="gi-ch-knight" d="M18.5 26l.8-4.4-2.1-1.6.5-2.6 3.1-3.1.3-1.8 1.8 1.6c2.4 1 3.7 3.9 3.2 7.6l-.5 4.3z" fill="var(--hot-pink)" />
    </svg>
  );
}
