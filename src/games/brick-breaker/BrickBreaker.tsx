import { useRef, type CSSProperties, type PointerEvent } from "react";
import { BALL_R, FIELD_H, FIELD_W, PADDLE_H, PADDLE_W, PADDLE_Y, START_LIVES } from "./logic";
import { useBrickBreaker } from "./useBrickBreaker";
import "./BrickBreaker.css";

/** Field units to a positioned box, as percentages of the field. */
function box(x: number, y: number, w: number, h: number): CSSProperties {
  return {
    left: `${(x / FIELD_W) * 100}%`,
    top: `${(y / FIELD_H) * 100}%`,
    width: `${(w / FIELD_W) * 100}%`,
    height: `${(h / FIELD_H) * 100}%`,
  };
}

const ROW_COLOURS = 5;

export function BrickBreaker() {
  const {
    status,
    level,
    lives,
    score,
    best,
    paddleX,
    ball,
    bricks,
    trail,
    bursts,
    message,
    isNewBest,
    movePaddle,
    launch,
    togglePause,
    restart,
  } = useBrickBreaker();

  const fieldRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const toFieldX = (clientX: number) => {
    const rect = fieldRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return paddleX;
    return ((clientX - rect.left) / rect.width) * FIELD_W;
  };

  // Drag (or, with a mouse, just move) to steer; releasing a drag while
  // serving launches the ball.
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (status !== "serve" && status !== "playing") return;
    draggingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    movePaddle(toFieldX(event.clientX));
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (draggingRef.current || event.pointerType === "mouse") movePaddle(toFieldX(event.clientX));
  };
  const onPointerUp = () => {
    if (draggingRef.current && status === "serve") launch();
    draggingRef.current = false;
  };

  const canPause = status === "playing" || status === "paused";

  return (
    <div className="breaker">
      <div className="breaker__hud">
        <div className="fp-hud-tile">
          <span className="fp-hud-label">Score</span>
          <span className={`fp-hud-value${score > 0 ? " fp-pop" : ""}`} key={score}>
            {String(score).padStart(4, "0")}
          </span>
        </div>
        <div className="fp-hud-tile">
          <span className="fp-hud-label">Best</span>
          <span className="fp-hud-value">{String(best).padStart(4, "0")}</span>
        </div>
      </div>

      <div
        ref={fieldRef}
        className={`breaker-field fp-corner-marks${status === "gameOver" ? " fp-shake" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {/* A cleared wall: the field flares once as the next wall arrives (remounts per level). */}
        {level > 1 && <span key={level} className="breaker__wall-flash" aria-hidden="true" />}
        <span className="breaker__lives" role="img" aria-label={`${lives} of ${START_LIVES} balls left`}>
          {Array.from({ length: START_LIVES }, (_, i) => (
            <span key={i} className={`breaker__life${i < lives ? " breaker__life--on" : ""}`} />
          ))}
        </span>
        <span className="fp-label breaker-field__tag" aria-hidden="true">
          Wall {String(level).padStart(2, "0")}
        </span>

        {bricks.map((b) => (
          <div
            key={`${level}-${b.id}`}
            className={`breaker-brick breaker-brick--c${b.row % ROW_COLOURS}${b.maxHp > 1 ? " breaker-brick--armoured" : ""}${b.hp < b.maxHp ? " breaker-brick--cracked" : ""}`}
            style={box(b.x, b.y, b.w, b.h)}
          />
        ))}

        {bursts.map((b) => (
          <div
            key={`burst-${b.bornAt}-${b.id}`}
            className={`breaker-burst breaker-brick--c${b.row % ROW_COLOURS}`}
            style={box(b.x, b.y, b.w, b.h)}
          />
        ))}

        {trail.map((p, i) => (
          <div
            key={i}
            className="breaker-trail"
            style={{
              ...box(p.x - BALL_R, p.y - BALL_R, BALL_R * 2, BALL_R * 2),
              opacity: 0.4 * (1 - i / trail.length),
              transform: `scale(${1 - i / (trail.length + 2)})`,
            }}
          />
        ))}

        <div className="breaker-ball" style={box(ball.x - BALL_R, ball.y - BALL_R, BALL_R * 2, BALL_R * 2)} />
        <div className="breaker-paddle" style={box(paddleX - PADDLE_W / 2, PADDLE_Y, PADDLE_W, PADDLE_H)} />

        {status === "serve" && (
          <div className="breaker__overlay breaker__overlay--serve">
            <p className="fp-result-title fp-result-title--info">{level === 1 && score === 0 ? "Ready" : `Wall ${level}`}</p>
            <p className="fp-result-detail">Drag to aim, release to launch</p>
            <button
              type="button"
              className="fp-btn fp-btn--primary breaker__launch"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={launch}
            >
              Launch
            </button>
          </div>
        )}

        {status === "paused" && (
          <div className="breaker__overlay fp-enter">
            <p className="fp-result-title fp-result-title--info">Paused</p>
            <p className="fp-result-detail">Resume when you're ready</p>
          </div>
        )}

        {status === "gameOver" && (
          <div className="breaker__overlay breaker__overlay--end fp-enter fp-settle fp-bg-accent--danger">
            <p className="fp-result-title fp-result-title--danger">Game over</p>
            <p className="fp-result-detail">
              Score {score} — Wall {level} — Best {Math.max(score, best)}
            </p>
            {isNewBest && <p className="fp-badge fp-badge--success">New best</p>}
            <button type="button" className="fp-btn fp-btn--success breaker__restart" onClick={restart}>
              Play again
            </button>
          </div>
        )}
      </div>

      <div className="breaker__controls">
        <p className="breaker__hint">
          <span className="breaker__hint-touch">Drag anywhere on the screen to steer.</span>
          <span className="breaker__hint-keys">← → or A D to steer · Space to launch / pause</span>
        </p>
        {canPause && (
          <button type="button" className="fp-btn fp-btn--secondary breaker__pause" onClick={togglePause}>
            {status === "paused" ? "Resume" : "Pause"}
          </button>
        )}
      </div>

      <p className="breaker__sr" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
