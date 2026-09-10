import type { CSSProperties } from "react";
import { PlayingCard } from "../../components/PlayingCard/PlayingCard";
import { useBlackjack } from "./useBlackjack";
import { scoreHand, type Outcome } from "./logic";
import "./Blackjack.css";

const RESULT_COPY: Record<Outcome, { title: string; accent: "success" | "danger" | "info" }> = {
  "player-blackjack": { title: "Blackjack", accent: "success" },
  "dealer-bust": { title: "Win — dealer bust", accent: "success" },
  "player-win": { title: "Win", accent: "success" },
  push: { title: "Push", accent: "info" },
  "dealer-blackjack": { title: "Dealer blackjack", accent: "danger" },
  "player-bust": { title: "Bust", accent: "danger" },
  "dealer-win": { title: "Loss", accent: "danger" },
};

function handStyle(count: number): CSSProperties {
  const width = count <= 3 ? 68 : count <= 5 ? 58 : count <= 7 ? 50 : 42;
  const overlapFraction = count <= 3 ? 0.42 : count <= 5 ? 0.55 : count <= 7 ? 0.62 : 0.7;
  return {
    ["--pc-width" as string]: `${width}px`,
    ["--pc-overlap" as string]: `-${Math.round(width * overlapFraction)}px`,
  };
}

function scoreLabel(total: number, soft: boolean, isBust: boolean, isBlackjack: boolean): string {
  if (isBlackjack) return "Blackjack";
  if (isBust) return `${total} — bust`;
  if (soft) return `${total} (soft)`;
  return `${total}`;
}

export function Blackjack() {
  const {
    playerHand,
    dealerHand,
    status,
    outcome,
    playerScore,
    dealerScore,
    stats,
    hit,
    stand,
    deal,
  } = useBlackjack();

  const dealerHidden = status === "player-turn";
  const dealerUpCardScore = dealerHand.length > 0 ? scoreHand([dealerHand[0]]).total : 0;
  const result = outcome ? RESULT_COPY[outcome] : null;
  const accentClass = result
    ? result.accent === "success"
      ? "fp-bg-accent--success"
      : result.accent === "danger"
        ? "fp-bg-accent--danger"
        : ""
    : "";

  return (
    <div className="blackjack">
      <div className={`blackjack-table fp-corner-marks ${accentClass}`}>
        <div className="blackjack-zone blackjack-zone--dealer">
          <p className="fp-label blackjack-zone__label">// Dealer</p>
          <div className="blackjack-hand" style={handStyle(dealerHand.length)}>
            {dealerHand.map((c, i) => (
              <PlayingCard
                key={i}
                card={c}
                faceDown={dealerHidden && i === 1}
                className="blackjack-hand__card"
              />
            ))}
          </div>
          <p className="blackjack-zone__value">
            {dealerHidden
              ? `Shows ${dealerUpCardScore}`
              : scoreLabel(dealerScore.total, dealerScore.soft, dealerScore.isBust, dealerScore.isBlackjack)}
          </p>
        </div>

        <hr className="fp-divider blackjack-table__divider" />

        <div className="blackjack-zone blackjack-zone--player">
          <p className="fp-label blackjack-zone__label">// Player</p>
          <div className="blackjack-hand" style={handStyle(playerHand.length)}>
            {playerHand.map((c, i) => (
              <PlayingCard key={i} card={c} className="blackjack-hand__card" />
            ))}
          </div>
          <p className="blackjack-zone__value">
            {scoreLabel(playerScore.total, playerScore.soft, playerScore.isBust, playerScore.isBlackjack)}
          </p>
        </div>

        {result && (
          <div className="blackjack-result" role="alert">
            <p className={`fp-result-title fp-result-title--${result.accent}`}>{result.title}</p>
            <p className="fp-result-detail">
              {playerScore.total} — {dealerScore.total}
            </p>
          </div>
        )}
      </div>

      <div className="blackjack-controls">
        {status === "player-turn" && (
          <>
            <button type="button" className="fp-btn fp-btn--secondary" onClick={hit}>
              Hit
            </button>
            <button type="button" className="fp-btn fp-btn--primary" onClick={stand}>
              Stand
            </button>
          </>
        )}
        {status === "round-over" && (
          <button type="button" className="fp-btn fp-btn--success" onClick={deal}>
            Deal again
          </button>
        )}
        {(status === "dealer-reveal" || status === "dealer-turn") && (
          <p className="fp-label blackjack-controls__waiting" aria-live="polite">
            Dealer playing…
          </p>
        )}
      </div>

      <div className="blackjack-stats fp-hud-tile">
        <span className="fp-hud-label">W {stats.wins} · L {stats.losses} · P {stats.pushes} · BJ {stats.blackjacks}</span>
      </div>
    </div>
  );
}

