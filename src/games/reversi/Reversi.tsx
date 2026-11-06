import { useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { SIZE, cellName, colOf, opponent, rowOf, type Level, type Player } from "./logic";
import { useReversi, type Mode } from "./useReversi";
import "./Reversi.css";

const LEVELS: Level[] = ["easy", "normal", "hard"];

function sideName(mode: Mode, side: Player): string {
  if (mode === "solo") return side === "cyan" ? "You" : "Computer";
  return side === "cyan" ? "Player 1" : "Player 2";
}

function Disc({ side, className = "", style }: { side: Player; className?: string; style?: CSSProperties }) {
  return <span className={`reversi-disc reversi-disc--${side} ${className}`} style={style} aria-hidden="true" />;
}

export function Reversi() {
  const {
    board,
    current,
    status,
    lastMove,
    lastFlips,
    passed,
    history,
    counts,
    moves,
    result,
    mode,
    level,
    showMoves,
    record,
    turnController,
    computerThinking,
    message,
    inProgress,
    canUndo,
    play,
    undo,
    newGame,
    setShowMoves,
  } = useReversi();

  // Switching mode or level mid-game asks first.
  const [pending, setPending] = useState<{ mode?: Mode; level?: Level } | null>(null);
  const request = (next: { mode?: Mode; level?: Level }) => {
    if (inProgress) setPending(next);
    else newGame(next);
  };

  // Roving focus: one cell in the tab order, arrows move between cells.
  const [focusIdx, setFocusIdx] = useState(19);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onBoardKey = (event: KeyboardEvent) => {
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = delta[event.key];
    if (!d) return;
    event.preventDefault();
    const r = Math.min(Math.max(rowOf(focusIdx) + d[0], 0), SIZE - 1);
    const c = Math.min(Math.max(colOf(focusIdx) + d[1], 0), SIZE - 1);
    const next = r * SIZE + c;
    setFocusIdx(next);
    cellRefs.current[next]?.focus();
  };

  const personTurn = turnController === "person";
  const moveNo = history.length;
  const flipped = new Set(lastFlips);

  // "View board" hides the result overlay for this finished position only;
  // keyed on the board itself, so undo or a new game brings it back.
  const [reviewed, setReviewed] = useState<unknown>(null);
  const reviewing = status === "over" && reviewed === board;
  const resultTitle =
    result === "draw"
      ? "Draw"
      : mode === "solo"
        ? result === "cyan"
          ? "You win"
          : "Computer wins"
        : `${sideName(mode, result as Player)} wins`;

  let statusText: string;
  if (status === "over") {
    statusText = reviewing ? `${resultTitle} · ${counts.cyan} – ${counts.pink}` : "Game over";
  } else if (computerThinking) {
    statusText = "Computer is thinking…";
  } else if (mode === "solo") {
    statusText = "Your turn";
  } else {
    statusText = `${sideName(mode, current)}'s turn`;
  }

  return (
    <div className="reversi">
      <div className="reversi__top">
        <div className="reversi__setup">
          <div className="reversi__seg" role="group" aria-label="Players">
            {(["solo", "duo"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                className={`reversi__seg-btn${mode === m ? " reversi__seg-btn--on" : ""}`}
                aria-pressed={mode === m}
                onClick={() => mode !== m && request({ mode: m })}
              >
                {m === "solo" ? "1 Player" : "2 Players"}
              </button>
            ))}
          </div>
          {mode === "solo" && (
            <div className="reversi__seg" role="group" aria-label="Computer level">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`reversi__seg-btn${level === l ? " reversi__seg-btn--on" : ""}`}
                  aria-pressed={level === l}
                  onClick={() => level !== l && request({ level: l })}
                >
                  {l}
                </button>
              ))}
            </div>
          )}
        </div>

        {pending && (
          <div className="reversi__confirm fp-enter" role="alertdialog" aria-label="Abandon this game?">
            <p className="reversi__confirm-text">Abandon this game and start a new one?</p>
            <div className="reversi__confirm-actions">
              <button
                type="button"
                className="fp-btn fp-btn--danger reversi__btn"
                onClick={() => {
                  newGame(pending);
                  setPending(null);
                }}
              >
                New game
              </button>
              <button type="button" className="fp-btn fp-btn--secondary reversi__btn" onClick={() => setPending(null)}>
                Keep playing
              </button>
            </div>
          </div>
        )}

        <div className="reversi__players">
          {(["cyan", "pink"] as Player[]).map((side) => (
            <div
              key={side}
              className={`reversi__player reversi__player--${side}${status === "playing" && current === side ? " reversi__player--active" : ""}`}
            >
              <Disc side={side} className="reversi__player-disc" />
              <span className="reversi__player-name">{sideName(mode, side)}</span>
              <span className="reversi__player-count fp-hud-value" key={counts[side]}>
                {counts[side]}
              </span>
            </div>
          ))}
        </div>

        <p className={`reversi__status${computerThinking ? " reversi__status--thinking" : ""}`}>
          {statusText}
          {status === "playing" && passed && <span className="reversi__pass"> — {sideName(mode, passed)} had no move</span>}
          {reviewing && (
            <button type="button" className="fp-btn fp-btn--secondary fp-btn--compact" onClick={() => setReviewed(null)}>
              Show result
            </button>
          )}
        </p>
      </div>

      <div className="reversi-board-wrap">
        <div className={`reversi-board${personTurn ? " reversi-board--live" : ""}${status === "over" && result !== "draw" && !(mode === "solo" && result === "pink") ? " fp-win-sweep" : ""}`} role="grid" aria-label="Board" onKeyDown={onBoardKey}>
          {board.map((cell, i) => {
            const legal = moves.has(i);
            const isFlip = flipped.has(i);
            const isLast = i === lastMove;
            const label = `${cellName(i)}, ${cell ? sideName(mode, cell) : "empty"}${legal && personTurn ? ", legal move" : ""}`;
            // Ripple outward from the placed disc.
            const dist = lastMove === null ? 0 : Math.max(Math.abs(rowOf(i) - rowOf(lastMove)), Math.abs(colOf(i) - colOf(lastMove)));
            const delay = { "--delay": `${dist * 70}ms` } as CSSProperties;
            return (
              <button
                key={i}
                ref={(el) => {
                  cellRefs.current[i] = el;
                }}
                type="button"
                role="gridcell"
                tabIndex={i === focusIdx ? 0 : -1}
                className={`reversi-cell${legal && personTurn ? " reversi-cell--legal" : ""}${isLast ? " reversi-cell--last" : ""}`}
                aria-label={label}
                aria-disabled={!(legal && personTurn)}
                onFocus={() => setFocusIdx(i)}
                onClick={() => legal && play(i)}
              >
                {cell && isFlip && (
                  <span key={`flip-${moveNo}`} className="reversi-flip">
                    <Disc side={opponent(cell)} className="reversi-disc--out" style={delay} />
                    <Disc side={cell} className="reversi-disc--in" style={delay} />
                  </span>
                )}
                {cell && !isFlip && <Disc key={isLast ? `placed-${moveNo}` : "disc"} side={cell} className={isLast ? "reversi-disc--placed" : ""} />}
                {!cell && legal && personTurn && showMoves && <span className={`reversi-hint reversi-hint--${current}`} aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        {status === "over" && !reviewing && (
          <div className={`reversi__overlay fp-enter fp-settle ${result === "draw" ? "" : mode === "solo" && result === "pink" ? "fp-bg-accent--danger" : "fp-bg-accent--success"}`} role="alert">
            <p
              className={`fp-result-title fp-result-title--${result === "draw" ? "info" : mode === "solo" && result === "pink" ? "danger" : "success"}`}
            >
              {resultTitle}
            </p>
            <p className="fp-result-detail">
              {counts.cyan} – {counts.pink}
            </p>
            {mode === "solo" && (
              <p className="fp-result-detail reversi__record">
                {level}: {record.wins}W {record.losses}L {record.draws}D
              </p>
            )}
            <div className="reversi__overlay-actions">
              <button type="button" className="fp-btn fp-btn--success reversi__btn" onClick={() => newGame()}>
                Play again
              </button>
              <button type="button" className="fp-btn fp-btn--secondary reversi__btn" onClick={() => setReviewed(board)}>
                View board
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="reversi__bottom">
        <div className="reversi__controls">
          <button type="button" className="fp-btn fp-btn--secondary reversi__btn" onClick={undo} disabled={!canUndo}>
            Undo
          </button>
          <button type="button" className="fp-btn fp-btn--secondary reversi__btn" onClick={() => request({})}>
            New game
          </button>
          <button
            type="button"
            className={`reversi__toggle${showMoves ? " reversi__toggle--on" : ""}`}
            aria-pressed={showMoves}
            onClick={() => setShowMoves(!showMoves)}
          >
            <span className="reversi__toggle-box" aria-hidden="true" />
            Show moves
          </button>
        </div>

        {mode === "solo" && (
          <p className="reversi__record-line">
            vs {level}: {record.wins}W · {record.losses}L · {record.draws}D
          </p>
        )}
      </div>

      <p className="reversi__sr" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
