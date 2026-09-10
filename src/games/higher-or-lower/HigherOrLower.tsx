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

  return (
    <div className="hol">
      <p className="hol__round">// ROUND {String(round).padStart(2, "0")}</p>

      <div
        key={status === "gameOver" ? "final" : round}
        className={`hol__value ${valueClass}`}
      >
        {displayedValue}
      </div>

      {status === "playing" && (
        <>
          <p className="hol__prompt">Will the next value be higher or lower?</p>
          <p
            className={`hol__feedback ${feedback?.correct ? "hol__feedback--correct" : ""}`}
            aria-live="polite"
          >
            {feedback?.correct
              ? `✓ Correct — ${feedback.previous} → ${feedback.revealed}`
              : ""}
          </p>
          <div className="hol__controls">
            <button
              type="button"
              className="hol__button hol__button--lower"
              onClick={() => guess("lower")}
            >
              <span aria-hidden="true">▼</span> Lower
            </button>
            <button
              type="button"
              className="hol__button hol__button--higher"
              onClick={() => guess("higher")}
            >
              Higher <span aria-hidden="true">▲</span>
            </button>
          </div>
        </>
      )}

      {status === "gameOver" && feedback && (
        <div className="hol__gameover" role="alert">
          <p className="hol__gameover-title">Run over</p>
          <p className="hol__gameover-detail">
            The signal was {feedback.revealed} — you called {feedback.guess}.
          </p>
          {isNewBest && <p className="hol__badge">New best</p>}
          <button
            type="button"
            className="hol__button hol__button--restart"
            onClick={restart}
          >
            Play again
          </button>
        </div>
      )}

      <div className="hol__scoreboard">
        <div className="hol__score">
          <span className="hol__score-label">Score</span>
          <span className="hol__score-value">{String(score).padStart(3, "0")}</span>
        </div>
        <div className="hol__score">
          <span className="hol__score-label">Best</span>
          <span className="hol__score-value">{String(best).padStart(3, "0")}</span>
        </div>
      </div>
    </div>
  );
}
