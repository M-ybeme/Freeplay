import type { ReactNode } from "react";
import { cardName, type ChromaCard as Card, type Color } from "./logic";

/*
 * Every colour has a shape, drawn on each card and in the picker, so
 * colour is never the only way to tell cards apart.
 */
export function ColorShape({ color, className }: { color: Color; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`cc-shape ${className ?? ""}`} aria-hidden="true" focusable="false">
      {color === "cyan" && <circle cx="12" cy="12" r="9" />}
      {color === "pink" && <path d="M12 3 21.5 20h-19Z" />}
      {color === "green" && <path d="M12 1.5 22.5 12 12 22.5 1.5 12Z" />}
      {color === "orange" && <rect x="3.5" y="3.5" width="17" height="17" rx="1" />}
    </svg>
  );
}

/** The four colours as quarters of a disc: the wild mark. */
function WildMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false">
      <path d="M12 12V2a10 10 0 0 1 10 10Z" fill="var(--laser-blue)" />
      <path d="M12 12h10a10 10 0 0 1-10 10Z" fill="var(--hot-pink)" />
      <path d="M12 12v10A10 10 0 0 1 2 12Z" fill="var(--toxic)" />
      <path d="M12 12H2A10 10 0 0 1 12 2Z" fill="var(--orange)" />
    </svg>
  );
}

/** Skip: jump past the next player (a skip-forward mark, so it can't be read as a slashed 0). */
function SkipMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M3 5.5 11 12l-8 6.5Z" />
      <path d="M11 5.5 19 12l-8 6.5Z" />
      <rect x="19" y="5.5" width="2.6" height="13" rx="0.6" />
    </svg>
  );
}

function ReverseMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 8.5h14M14.5 4.5l4 4-4 4" />
      <path d="M20 15.5H6M9.5 11.5l-4 4 4 4" />
    </svg>
  );
}

/** The mark in a card's corner (small) or middle (large). */
function Face({ card, size }: { card: Card; size: "corner" | "middle" }): ReactNode {
  const cls = `cc__mark cc__mark--${size}`;
  switch (card.kind) {
    case "number":
      return <span className={`${cls} cc__digit`}>{card.value}</span>;
    case "skip":
      return <SkipMark className={cls} />;
    case "reverse":
      return <ReverseMark className={cls} />;
    case "draw2":
      return <span className={`${cls} cc__digit`}>+2</span>;
    case "wild":
      return size === "middle" ? <WildMark className={cls} /> : <span className={`${cls} cc__digit`}>W</span>;
    case "wild4":
      return size === "middle" ? (
        <span className="cc__wild4">
          <WildMark className={cls} />
          <span className="cc__digit cc__wild4-label">+4</span>
        </span>
      ) : (
        <span className={`${cls} cc__digit`}>+4</span>
      );
  }
}

interface CardProps {
  card?: Card;
  faceDown?: boolean;
  className?: string;
}

/** A Chroma Clash card, sized by `--cc-w` on it or an ancestor. */
export function ChromaCard({ card, faceDown, className }: CardProps) {
  if (faceDown || !card) {
    return (
      <span className={`cc cc--back ${className ?? ""}`} aria-hidden="true">
        <span className="cc__back-mark" />
      </span>
    );
  }
  const tone = card.color ?? "wild";
  return (
    <span className={`cc cc--${tone} cc--k-${card.kind} ${className ?? ""}`} role="img" aria-label={cardName(card)}>
      <span className="cc__corner cc__corner--tl">
        {card.color && <ColorShape color={card.color} />}
        <Face card={card} size="corner" />
      </span>
      <span className="cc__middle">
        {card.color && <ColorShape color={card.color} className="cc-shape--ghost" />}
        <Face card={card} size="middle" />
      </span>
      <span className="cc__corner cc__corner--br">
        {card.color && <ColorShape color={card.color} />}
        <Face card={card} size="corner" />
      </span>
    </span>
  );
}
