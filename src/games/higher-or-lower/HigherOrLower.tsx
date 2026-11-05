import { useEffect } from "react";
import { useHigherOrLower } from "./useHigherOrLower";
import "./HigherOrLower.css";

export function HigherOrLower() {
  const { round, current, score, best, status, feedback, isNewBest, guess, restart } =
    useHigherOrLower();

  useEffect(() => {
    if (status !== "playing") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") guess("higher");
      if (event.key === "ArrowDown") guess("lower");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, guess]);

  const displayedValue = status === "gameOver" && feedback ? feedback.revealed : current;
  const valueClass = feedback
    ? feedback.correct
      ? "hol__value--correct"
      : "hol__value--incorrect"
    : "";
  // The new value rolls in from the direction it moved: up from below when
  // it went higher, down from above when it went lower.
  const rollClass = feedback
    ? feedback.revealed > feedback.previous
      ? " hol__value--rolled-up"
      : feedback.revealed < feedback.previous
        ? " hol__value--rolled-down"
        : ""
    : "";
  const missClass = status === "gameOver" && feedback && !feedback.correct ? " fp-shake" : "";
  const accentClass =
    status === "gameOver" ? (isNewBest ? " fp-bg-accent--success" : " fp-bg-accent--danger") : "";

  return (
    <div className={`hol${accentClass}`}>
      <p className="fp-label hol__round">
        // HL-01 · ROUND {String(round).padStart(2, "0")}
      </p>

      <div
        key={status === "gameOver" ? "final" : round}
        className={`hol__value ${valueClass}${rollClass}${missClass}`}
      >
        {displayedValue}
      </div>

      {status === "playing" && (
        <>
          <p className="hol__prompt">Will the next value be higher or lower?</p>
          <p
            key={round}
            className={`hol__feedback ${feedback?.correct ? "hol__feedback--correct fp-enter" : ""}`}
            aria-live="polite"
          >
            {feedback?.correct
              ? `✓ Correct — ${feedback.previous} → ${feedback.revealed}`
              : ""}
          </p>
          <div className="hol__controls">
            <button
              type="button"
              className="fp-btn fp-btn--secondary hol__button"
              onClick={() => guess("lower")}
            >
              <span aria-hidden="true">▼</span> Lower
            </button>
            <button
              type="button"
              className="fp-btn fp-btn--primary hol__button"
              onClick={() => guess("higher")}
            >
              Higher <span aria-hidden="true">▲</span>
            </button>
          </div>
        </>
      )}

      {status === "gameOver" && feedback && (
        <div className="hol__gameover fp-enter" role="alert">
          <p className="fp-result-title fp-result-title--danger">Run over</p>
          <p className="fp-result-detail">
            The signal was {feedback.revealed} — you called {feedback.guess}.
          </p>
          {isNewBest && <p className="fp-badge fp-badge--success">New best</p>}
          <button
            type="button"
            className="fp-btn fp-btn--success hol__button hol__button--restart"
            onClick={restart}
          >
            Play again
          </button>
        </div>
      )}

      <div className="hol__scoreboard">
        <div className="fp-hud-tile">
          <span className="fp-hud-label">Score</span>
          <span className={`fp-hud-value${score > 0 ? " fp-pop" : ""}`} key={score}>
            {String(score).padStart(3, "0")}
          </span>
        </div>
        <div className="fp-hud-tile">
          <span className="fp-hud-label">Best</span>
          <span className={`fp-hud-value${best > 0 ? " fp-pop" : ""}`} key={best}>
            {String(best).padStart(3, "0")}
          </span>
        </div>
      </div>
    </div>
  );
}
