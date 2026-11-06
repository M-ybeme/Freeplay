import { useState, useRef, type CSSProperties, type KeyboardEvent } from "react";
import type { Level } from "./ai";
import { colOf, materialBalance, other, rowOf, squareName, type Color, type PieceType, type Position } from "./logic";
import { Piece } from "./Piece";
import { PIECE_NAME, SIDE_NAME, useChess, type Mode } from "./useChess";
import { ConfirmPrompt } from "../../components/ConfirmPrompt/ConfirmPrompt";
import "./Chess.css";

const LEVELS: Level[] = ["easy", "normal", "hard"];
const PROMOTIONS: PieceType[] = ["q", "r", "b", "n"];
const CAPTURE_ORDER: PieceType[] = ["q", "r", "b", "n", "p"];

const DRAW_REASON: Record<string, string> = {
  stalemate: "Stalemate",
  fifty: "Fifty-move rule",
  repetition: "Threefold repetition",
  material: "Not enough material",
};

function sideName(mode: Mode, side: Color): string {
  if (mode === "solo") return side === "white" ? "You" : "Computer";
  return side === "white" ? "Player 1" : "Player 2";
}

/** Pieces `side` has captured, biggest first. Read from the moves, so promotions don't count. */
function capturedBy(played: { move: { captured?: PieceType }; before: Position }[], side: Color): PieceType[] {
  const taken = played.filter((p) => p.before.turn === side && p.move.captured).map((p) => p.move.captured!);
  return taken.sort((x, y) => CAPTURE_ORDER.indexOf(x) - CAPTURE_ORDER.indexOf(y));
}

export function Chess() {
  const {
    position,
    status,
    moves,
    played,
    lastMove,
    checked,
    result,
    mode,
    level,
    showMoves,
    record,
    turnController,
    computerThinking,
    message,
    slide,
    inProgress,
    canUndo,
    play,
    undo,
    newGame,
    setShowMoves,
  } = useChess();
  const { board, turn } = position;

  // Switching mode or level mid-game asks first.
  const [pending, setPending] = useState<{ mode?: Mode; level?: Level } | null>(null);
  const request = (next: { mode?: Mode; level?: Level }) => {
    if (inProgress) setPending(next);
    else newGame(next);
  };

  // Selection and the promotion picker belong to one position; any move,
  // undo or new game clears them without an effect.
  const [sel, setSel] = useState<{ position: Position; from: number; promo?: number } | null>(null);
  const selected = sel?.position === position ? sel.from : null;
  const promoTo = sel?.position === position ? (sel.promo ?? null) : null;

  const personTurn = turnController === "person";
  const targets = selected === null ? [] : moves.filter((m) => m.from === selected);
  const targetSet = new Set(targets.map((m) => m.to));
  const movable = new Set(moves.map((m) => m.from));

  const onSquare = (i: number) => {
    if (!personTurn) return;
    if (selected !== null && targetSet.has(i)) {
      const options = targets.filter((m) => m.to === i);
      if (options.length > 1) setSel({ position, from: selected, promo: i });
      else play(options[0]);
      return;
    }
    if (movable.has(i) && i !== selected) setSel({ position, from: i });
    else setSel(null);
  };

  const promote = (type: PieceType) => {
    const m = targets.find((x) => x.to === promoTo && x.promotion === type);
    if (m) play(m);
  };

  // Roving focus: one square in the tab order, arrows move between squares.
  const [focusIdx, setFocusIdx] = useState(52);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const onBoardKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      setSel(null);
      return;
    }
    const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    const d = delta[event.key];
    if (!d) return;
    event.preventDefault();
    const r = Math.min(Math.max(rowOf(focusIdx) + d[0], 0), 7);
    const c = Math.min(Math.max(colOf(focusIdx) + d[1], 0), 7);
    const next = r * 8 + c;
    setFocusIdx(next);
    cellRefs.current[next]?.focus();
  };

  // Slide the moved piece (and the castling rook) in from where it was.
  const slides = new Map<number, number>();
  if (slide && lastMove) {
    slides.set(lastMove.to, lastMove.from);
    if (lastMove.castle) {
      const row = rowOf(lastMove.from);
      slides.set(row * 8 + (lastMove.castle === "k" ? 5 : 3), row * 8 + (lastMove.castle === "k" ? 7 : 0));
    }
  }

  // A capture: the taken piece shrinks away on its square while the
  // attacker slides in (en passant takes from beside the target square).
  let capturedAt: { sq: number; type: PieceType; color: Color } | null = null;
  if (slide && lastMove?.captured) {
    const mover = board[lastMove.to]?.color;
    if (mover) {
      const at = lastMove.enPassant ? rowOf(lastMove.from) * 8 + colOf(lastMove.to) : lastMove.to;
      capturedAt = { sq: at, type: lastMove.captured, color: other(mover) };
    }
  }

  const balance = materialBalance(board);
  const lead = (side: Color) => (side === "white" ? balance : -balance);

  // Last few moves as "12. Nf3 Nc6".
  const pairs: string[] = [];
  for (let n = 0; n < played.length; n += 2) {
    pairs.push(`${n / 2 + 1}. ${played[n].san}${played[n + 1] ? " " + played[n + 1].san : ""}`);
  }

  const personLost = mode === "solo" && result === "black";
  const resultTitle =
    result === "draw" ? "Draw" : mode === "solo" ? (result === "white" ? "You win" : "Computer wins") : `${sideName(mode, result as Color)} wins`;

  // "View board" hides the result overlay for this finished position only;
  // keyed on the position itself, so undo or a new game brings it back.
  const [reviewed, setReviewed] = useState<unknown>(null);
  const reviewing = status !== "playing" && reviewed === position;

  let statusText: string;
  if (status !== "playing") statusText = reviewing ? resultTitle : "Game over";
  else if (computerThinking) statusText = "Computer is thinking…";
  else if (mode === "solo") statusText = "Your turn";
  else statusText = `${sideName(mode, turn)}'s turn`;

  return (
    <div className="chess">
      <div className="chess__top">
        <div className="chess__setup">
          <div className="fp-seg" role="group" aria-label="Players">
            {(["solo", "duo"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                className="fp-seg__btn"
                aria-pressed={mode === m}
                onClick={() => mode !== m && request({ mode: m })}
              >
                {m === "solo" ? "1 Player" : "2 Players"}
              </button>
            ))}
          </div>
          {mode === "solo" && (
            <div className="fp-seg" role="group" aria-label="Computer level">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className="fp-seg__btn"
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
        <ConfirmPrompt
          message="Start a new game? This one will be lost."
          confirmLabel="New game"
          onConfirm={() => {
            newGame(pending);
            setPending(null);
          }}
          onCancel={() => setPending(null)}
        />
      )}

      <div className="chess__players">
        {(["white", "black"] as Color[]).map((side) => {
          const taken = capturedBy(played, side);
          return (
            <div
              key={side}
              className={`chess__player chess__player--${side === "white" ? "cyan" : "pink"}${status === "playing" && turn === side ? " chess__player--active" : ""}`}
            >
              <Piece type="k" color={side} className="chess__player-icon" />
              <span className="chess__player-name">{sideName(mode, side)}</span>
              <span className="chess__taken" aria-label={taken.length ? `Captured: ${taken.map((t) => PIECE_NAME[t]).join(", ")}` : "No captures"}>
                {taken.map((t, n) => (
                  <Piece key={n} type={t} color={side === "white" ? "black" : "white"} className="chess__taken-piece" />
                ))}
                {lead(side) > 0 && <span className="chess__lead">+{lead(side)}</span>}
              </span>
            </div>
          );
        })}
      </div>

      <p className={`chess__status${computerThinking ? " chess__status--thinking" : ""}`}>
        {statusText}
        {status === "playing" && checked !== null && <span className="chess__check"> — Check</span>}
        {reviewing && (
          <button type="button" className="fp-btn fp-btn--secondary fp-btn--compact" onClick={() => setReviewed(null)}>
            Show result
          </button>
        )}
      </p>

      </div>

      <div className="chess-board-wrap">
        <div className={`chess-board${status === "checkmate" && !personLost ? " fp-win-sweep" : ""}`} role="grid" aria-label="Board" onKeyDown={onBoardKey}>
          {board.map((piece, i) => {
            const r = rowOf(i);
            const c = colOf(i);
            const isTarget = targetSet.has(i);
            const canSelect = personTurn && movable.has(i);
            const from = slides.get(i);
            const slideStyle =
              from === undefined ? undefined : ({ "--dx": colOf(from) - c, "--dy": rowOf(from) - r } as CSSProperties);
            let label = `${squareName(i)}, ${piece ? `${SIDE_NAME[piece.color].toLowerCase()} ${PIECE_NAME[piece.type]}` : "empty"}`;
            if (i === selected) label += ", selected";
            else if (isTarget) label += piece ? ", capture" : ", move here";
            if (i === checked) label += ", in check";
            const classes = [
              "chess-sq",
              (r + c) % 2 ? "chess-sq--dark" : "chess-sq--light",
              lastMove && (i === lastMove.from || i === lastMove.to) ? "chess-sq--last" : "",
              i === selected ? "chess-sq--selected" : "",
              i === checked ? "chess-sq--check" : "",
              canSelect || isTarget ? "chess-sq--live" : "",
            ].join(" ");
            return (
              <button
                key={i}
                ref={(el) => {
                  cellRefs.current[i] = el;
                }}
                type="button"
                role="gridcell"
                tabIndex={i === focusIdx ? 0 : -1}
                className={classes}
                aria-label={label}
                aria-disabled={!(canSelect || isTarget)}
                onFocus={() => setFocusIdx(i)}
                onClick={() => onSquare(i)}
              >
                {c === 0 && (
                  <span className="chess-sq__rank" aria-hidden="true">
                    {8 - r}
                  </span>
                )}
                {r === 7 && (
                  <span className="chess-sq__file" aria-hidden="true">
                    {"abcdefgh"[c]}
                  </span>
                )}
                {capturedAt?.sq === i && (
                  <span key={`taken-${played.length}`} className="chess-taken" aria-hidden="true">
                    <Piece type={capturedAt.type} color={capturedAt.color} />
                  </span>
                )}
                {piece && (
                  <span key={from === undefined ? "still" : `slide-${played.length}`} className={`chess-slide${from === undefined ? "" : " chess-slide--moving"}`} style={slideStyle}>
                    <Piece type={piece.type} color={piece.color} />
                  </span>
                )}
                {isTarget && (showMoves || piece) && <span className={`chess-hint${piece ? " chess-hint--capture" : ""}`} aria-hidden="true" />}
              </button>
            );
          })}
        </div>

        {promoTo !== null && (
          <div className="chess__promo fp-enter" role="dialog" aria-label="Promote pawn to">
            <p className="fp-label">Promote to</p>
            <div className="chess__promo-row">
              {PROMOTIONS.map((t) => (
                <button key={t} type="button" className="chess__promo-btn" aria-label={PIECE_NAME[t]} onClick={() => promote(t)}>
                  <Piece type={t} color={turn} />
                </button>
              ))}
            </div>
            <button type="button" className="fp-btn fp-btn--secondary chess__btn" onClick={() => setSel(null)}>
              Cancel
            </button>
          </div>
        )}

        {status !== "playing" && !reviewing && (
          <div className={`chess__overlay fp-enter fp-settle ${result === "draw" ? "" : personLost ? "fp-bg-accent--danger" : "fp-bg-accent--success"}`} role="alert">
            <p className={`fp-result-title fp-result-title--${result === "draw" ? "info" : personLost ? "danger" : "success"}`}>{resultTitle}</p>
            <p className="fp-result-detail">{status === "checkmate" ? `Checkmate in ${Math.ceil(played.length / 2)} moves` : DRAW_REASON[status]}</p>
            {mode === "solo" && (
              <p className="fp-result-detail chess__record">
                {level}: {record.wins}W {record.losses}L {record.draws}D
              </p>
            )}
            <div className="chess__overlay-actions">
              <button type="button" className="fp-btn fp-btn--success chess__btn" onClick={() => newGame()}>
                Play again
              </button>
              <button type="button" className="fp-btn fp-btn--secondary chess__btn" onClick={() => setReviewed(position)}>
                View board
              </button>
            </div>
          </div>
        )}
      </div>
      <div className="chess__bottom">

        {/* Newest moves stay in view: the last few on one line when stacked, a scrolling list beside the board. */}
        <div className="chess__moves">
          <ol className="chess__moves-list" aria-label="Moves">
            {pairs.map((pair) => (
              <li key={pair} className="chess__move">
                {pair}
              </li>
            ))}
          </ol>
        </div>

        <div className="fp-controls">
          <button type="button" className="fp-btn fp-btn--secondary" onClick={undo} disabled={!canUndo}>
            Undo
          </button>
          <button type="button" className="fp-btn fp-btn--secondary" onClick={() => request({})}>
            New game
          </button>
          <button
            type="button"
            className="fp-toggle"
            aria-pressed={showMoves}
            onClick={() => setShowMoves(!showMoves)}
          >
            <span className="fp-toggle__box" aria-hidden="true" />
            Show moves
          </button>
        </div>

      {mode === "solo" && (
        <p className="chess__record-line">
          vs {level}: {record.wins}W · {record.losses}L · {record.draws}D
        </p>
      )}

      </div>
      <p className="chess__sr" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
