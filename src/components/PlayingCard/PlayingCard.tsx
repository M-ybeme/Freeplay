import { SuitIcon } from "./SuitIcon";
import { PIP_LAYOUTS } from "./pipLayouts";
import { cardName, isRedSuit, type Card } from "./types";
import "./PlayingCard.css";

const FACE_LABELS: Record<string, string> = { J: "Jack", Q: "Queen", K: "King" };

interface PlayingCardProps {
  card?: Card;
  faceDown?: boolean;
  className?: string;
}

// Renders one card face-up (given data) or face-down (the shared Freeplay
// back). This component only knows how to display a card — no game rules,
// no scoring, no notion of whether a card "can" be played. `card` is
// optional specifically so a face-down card never needs its identity
// passed in at all, which is what keeps the hidden dealer card from ever
// having its rank/suit reach the DOM before reveal.
export function PlayingCard({ card, faceDown, className }: PlayingCardProps) {
  if (faceDown || !card) {
    return (
      <div
        className={`playing-card playing-card--back ${className ?? ""}`}
        role="img"
        aria-label="Hidden card"
      >
        <div className="playing-card__back-frame">
          <span className="playing-card__back-mark">FP</span>
        </div>
      </div>
    );
  }

  const red = isRedSuit(card.suit);
  const colorClass = red ? "playing-card--red" : "playing-card--black";
  const rankClassName = `playing-card__rank${card.rank === "10" ? " playing-card__rank--ten" : ""}`;

  return (
    <div
      className={`playing-card ${colorClass} ${className ?? ""}`}
      role="img"
      aria-label={cardName(card)}
    >
      <span className="playing-card__index playing-card__index--top" aria-hidden="true">
        <span className={rankClassName}>{card.rank}</span>
        <SuitIcon suit={card.suit} className="playing-card__index-suit" />
      </span>

      <div
        className={`playing-card__center${PIP_LAYOUTS[card.rank] ? " playing-card__center--pips" : ""}`}
        aria-hidden="true"
      >
        <CardCenter rank={card.rank} suit={card.suit} />
      </div>

      <span className="playing-card__index playing-card__index--bottom" aria-hidden="true">
        <span className={rankClassName}>{card.rank}</span>
        <SuitIcon suit={card.suit} className="playing-card__index-suit" />
      </span>
    </div>
  );
}

function CardCenter({ rank, suit }: Card) {
  if (rank === "A") {
    return (
      <div className="playing-card__ace">
        <SuitIcon suit={suit} className="playing-card__ace-icon" />
      </div>
    );
  }

  const faceLabel = FACE_LABELS[rank];
  if (faceLabel) {
    return (
      <div className="playing-card__face">
        <span className="playing-card__face-letter">{rank}</span>
        <SuitIcon suit={suit} className="playing-card__face-suit" />
        <span className="playing-card__face-label">{faceLabel}</span>
      </div>
    );
  }

  const pips = PIP_LAYOUTS[rank] ?? [];
  return (
    <div className="playing-card__pips">
      {pips.map((pos, i) => (
        <SuitIcon
          key={i}
          suit={suit}
          className="playing-card__pip"
          style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
        />
      ))}
    </div>
  );
}
