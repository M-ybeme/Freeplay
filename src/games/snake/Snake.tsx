import { useRef } from "react";
import { useSnake } from "./useSnake";
import "./Snake.css";

const SWIPE_THRESHOLD_PX = 24;

export function Snake() {
  const {
    snake,
    food,
    direction,
    score,
    best,
    status,
    boardSize,
    isNewBest,
    changeDirection,
    togglePause,
    restart,
  } = useSnake();

  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const onTouchStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    touchStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      changeDirection(dx > 0 ? "right" : "left");
    } else {
      changeDirection(dy > 0 ? "down" : "up");
    }
  };

  const cellStyle = (x: number, y: number): React.CSSProperties => ({
    left: `${(x / boardSize) * 100}%`,
    top: `${(y / boardSize) * 100}%`,
    width: `${100 / boardSize}%`,
    height: `${100 / boardSize}%`,
  });

  const canPause = status === "playing" || status === "paused";
  const isGameEnd = status === "gameOver" || status === "won";

  return (
    <div className="snake">
      <div className="snake__hud">
        <div className="fp-hud-tile">
          <span className="fp-hud-label">Score</span>
          <span className="fp-hud-value">{String(score).padStart(3, "0")}</span>
        </div>
        <div className="fp-hud-tile">
          <span className="fp-hud-label">Best</span>
          <span className="fp-hud-value">{String(best).padStart(3, "0")}</span>
        </div>
        {canPause && (
          <button
            type="button"
            className="fp-btn fp-btn--secondary snake__pause"
            onClick={togglePause}
          >
            {status === "paused" ? "Resume" : "Pause"}
          </button>
        )}
      </div>

      <div
        className="snake-board"
        style={{
          backgroundSize: `${100 / boardSize}% ${100 / boardSize}%`,
        }}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {snake.map((segment, index) => (
          <div
            key={index === 0 ? "head" : `body-${index}`}
            className={`snake-segment ${index === 0 ? "snake-segment--head" : ""}`}
            style={cellStyle(segment.x, segment.y)}
          >
            {index === 0 && <span className={`snake-segment__eye snake-segment__eye--${direction}`} />}
          </div>
        ))}

        {food && <div className="snake-food" style={cellStyle(food.x, food.y)} />}

        {status === "ready" && (
          <div className="snake__overlay" role="status" aria-live="polite">
            <p className="snake__overlay-title">Ready</p>
            <p className="snake__overlay-detail">Swipe or press a direction to start</p>
          </div>
        )}

        {status === "paused" && (
          <div className="snake__overlay" role="status" aria-live="polite">
            <p className="snake__overlay-title">Paused</p>
            <p className="snake__overlay-detail">Resume when you're ready</p>
          </div>
        )}

        {isGameEnd && (
          <div className={`snake__overlay ${status === "won" ? "fp-bg-accent--success" : "fp-bg-accent--danger"}`} role="alert">
            <p className="snake__overlay-title">{status === "won" ? "Board cleared" : "Game over"}</p>
            <p className="snake__overlay-detail">
              Score {score} — Best {Math.max(score, best)}
            </p>
            {isNewBest && <p className="fp-badge fp-badge--success">New best</p>}
            <button type="button" className="fp-btn fp-btn--success snake__restart" onClick={restart}>
              Play again
            </button>
          </div>
        )}
      </div>

      <div className="snake__dpad" role="group" aria-label="Directional controls">
        <button
          type="button"
          className="snake__dpad-btn snake__dpad-btn--up"
          aria-label="Move up"
          onClick={() => changeDirection("up")}
        >
          <span aria-hidden="true">▲</span>
        </button>
        <button
          type="button"
          className="snake__dpad-btn snake__dpad-btn--left"
          aria-label="Move left"
          onClick={() => changeDirection("left")}
        >
          <span aria-hidden="true">◀</span>
        </button>
        <button
          type="button"
          className="snake__dpad-btn snake__dpad-btn--right"
          aria-label="Move right"
          onClick={() => changeDirection("right")}
        >
          <span aria-hidden="true">▶</span>
        </button>
        <button
          type="button"
          className="snake__dpad-btn snake__dpad-btn--down"
          aria-label="Move down"
          onClick={() => changeDirection("down")}
        >
          <span aria-hidden="true">▼</span>
        </button>
      </div>
    </div>
  );
}
