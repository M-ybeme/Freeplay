import { useLayoutEffect, useRef } from "react";
import { cellLabel, type Cell } from "./logic";
import { useMinesweeper } from "./useMinesweeper";
import { ConfirmPrompt } from "../../components/ConfirmPrompt/ConfirmPrompt";
import "./Minesweeper.css";

const LONG_PRESS_MS = 420;
const MOVE_TOLERANCE_PX = 10;

const NUMBER_COLORS: Record<number, string> = {
  1: "var(--laser-blue)",
  2: "var(--toxic)",
  3: "var(--hot-pink)",
  4: "var(--uv-purple-text)",
  5: "var(--orange)",
  6: "var(--text)",
  7: "var(--muted)",
  8: "var(--text)",
};

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatMines(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}${String(Math.abs(n)).padStart(2, "0")}`;
}

export function Minesweeper() {
  const {
    board,
    difficulty,
    difficulties,
    mode,
    elapsed,
    bestTimes,
    pendingDifficulty,
    setMode,
    flag,
    interact,
    newGame,
    requestNewGame,
    selectDifficulty,
    confirmDifficultyChange,
    cancelDifficultyChange,
  } = useMinesweeper();

  const boardRef = useRef<HTMLDivElement>(null);
  const pressState = useRef<{
    x: number;
    y: number;
    index: number;
    firedLongPress: boolean;
    movedTooFar: boolean;
  } | null>(null);
  const longPressTimer = useRef<number | null>(null);
  // Set on every touch pointerdown, cleared by onClick. A touch tap fires
  // the full pointer sequence below *and* a trailing synthetic click a
  // moment later (standard touch/mouse compatibility behavior) - relying on
  // preventDefault() to suppress that click is not reliable across engines,
  // so onClick explicitly ignores itself once per touch interaction instead.
  const suppressNextClick = useRef(false);

  const gameOver = board.status === "won" || board.status === "lost";
  // A pending difficulty confirmation must be just as modal as game-over is:
  // no reveal, flag, or long-press should be able to mutate the board while
  // it's unresolved. Unlike gameOver, pendingDifficulty is a UI-only concept
  // the pure logic layer (revealCell/toggleFlag) has no notion of - those
  // only guard on board.status, which stays "playing" the whole time a
  // confirmation is pending - so every interaction path below has to check
  // this explicitly rather than being able to rely on the logic layer.
  const boardLocked = gameOver || pendingDifficulty !== null;
  const minesLeft = difficulty.mines - board.cells.filter((c) => c.flagged).length;
  const bestTime = bestTimes[difficulty.id];

  // Where the latest reveal started, so newly revealed cells can ripple
  // outward from it instead of all appearing in the same frame.
  const originRef = useRef<number | null>(null);
  const previousCells = useRef<Cell[] | null>(null);

  function revealFrom(index: number) {
    originRef.current = index;
    interact(index);
  }

  useLayoutEffect(() => {
    const prev = previousCells.current;
    previousCells.current = board.cells;
    const root = boardRef.current;
    // A different board (new game / difficulty) is a reset, not a reveal.
    if (!prev || prev === board.cells || prev.length !== board.cells.length || !root) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    const cols = difficulty.cols;
    const origin = board.triggeredIndex ?? originRef.current ?? 0;
    const or = Math.floor(origin / cols);
    const oc = origin % cols;
    board.cells.forEach((cell, i) => {
      if (!cell.revealed || prev[i].revealed) return;
      const el = root.querySelector<HTMLElement>(`[data-index="${i}"]`);
      if (!el) return;
      const distance = Math.max(Math.abs(Math.floor(i / cols) - or), Math.abs((i % cols) - oc));
      el.animate(
        [
          { transform: "scale(0.55)", opacity: 0.2, filter: "brightness(2)" },
          { transform: "scale(1)", opacity: 1, filter: "none" },
        ],
        {
          duration: 220,
          // Capped so a huge flood-fill still settles in well under a second.
          delay: Math.min(distance * (cell.hasMine ? 45 : 28), 650),
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
          fill: "backwards",
        },
      );
    });
  }, [board.cells, board.triggeredIndex, difficulty.cols]);

  function clearLongPressTimer() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent, index: number) {
    if (e.pointerType === "mouse" || boardLocked) return;
    suppressNextClick.current = true;
    pressState.current = { x: e.clientX, y: e.clientY, index, firedLongPress: false, movedTooFar: false };
    longPressTimer.current = window.setTimeout(() => {
      if (pressState.current) pressState.current.firedLongPress = true;
      flag(index);
    }, LONG_PRESS_MS);
  }

  function onPointerMove(e: React.PointerEvent) {
    const state = pressState.current;
    if (!state || state.movedTooFar) return;
    const dx = e.clientX - state.x;
    const dy = e.clientY - state.y;
    if (Math.hypot(dx, dy) > MOVE_TOLERANCE_PX) {
      // Moving this far means the gesture is a scroll/drag, not a tap or a
      // hold-in-place — cancel the long-press timer *and* remember not to
      // treat the eventual pointerup as a tap-to-reveal either.
      state.movedTooFar = true;
      clearLongPressTimer();
    }
  }

  function onPointerUp(e: React.PointerEvent, index: number) {
    if (e.pointerType === "mouse") return;
    clearLongPressTimer();
    const state = pressState.current;
    pressState.current = null;
    // A long-press already acted, and a gesture that moved past the
    // tolerance was a scroll/drag rather than a tap — neither should also
    // reveal the cell the pointer happens to lift over.
    if (state?.firedLongPress || state?.movedTooFar) return;
    // boardLocked alone (without a corresponding onPointerDown) would still
    // reach here: onPointerDown bails out early while locked and never sets
    // pressState, so `state` is null here too, same as after a completed
    // long-press - this check can't be folded into the one above.
    if (boardLocked) return;
    revealFrom(index);
  }

  function onPointerCancel() {
    clearLongPressTimer();
    pressState.current = null;
  }

  function onClick(index: number) {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    // Mouse clicks have no other gate: revealCell/toggleFlag already refuse
    // to mutate once board.status leaves "playing" (covering gameOver), but
    // they have no notion of pendingDifficulty, so this is the only place
    // that protects a mouse click while a confirmation is pending.
    if (boardLocked) return;
    revealFrom(index);
  }

  function onContextMenu(e: React.MouseEvent, index: number) {
    e.preventDefault();
    if (!boardLocked) flag(index);
  }

  function focusCell(index: number) {
    const el = boardRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    el?.focus();
  }

  function onBoardKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    const indexAttr = target.getAttribute("data-index");
    if (indexAttr === null) return;
    const index = Number(indexAttr);
    const { rows, cols } = difficulty;
    const row = Math.floor(index / cols);
    const col = index % cols;

    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };

    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      const nextRow = Math.min(rows - 1, Math.max(0, row + dr));
      const nextCol = Math.min(cols - 1, Math.max(0, col + dc));
      focusCell(nextRow * cols + nextCol);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!boardLocked) revealFrom(index);
      return;
    }
    if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      if (!boardLocked) flag(index);
    }
  }

  return (
    <div className="minesweeper">
      <div className="minesweeper__hud">
        <p className="fp-label minesweeper__level">// Hazard scan — {difficulty.label}</p>
        <div className="minesweeper__stats">
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Mines</span>
            <span className={`fp-hud-value${minesLeft !== difficulty.mines ? " fp-pop" : ""}`} key={minesLeft}>
              {formatMines(minesLeft)}
            </span>
          </div>
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Time</span>
            <span className="fp-hud-value">{formatTime(elapsed)}</span>
          </div>
        </div>
      </div>

      <div className="fp-seg" role="group" aria-label="Difficulty">
        {difficulties.map((d) => (
          <button
            key={d.id}
            type="button"
            className="fp-seg__btn"
            onClick={() => selectDifficulty(d)}
            aria-pressed={d.id === difficulty.id}
          >
            {d.label}
          </button>
        ))}
      </div>

      {pendingDifficulty && (
        <ConfirmPrompt
          message={
            pendingDifficulty.id === difficulty.id
              ? "Start a new game? This one will be lost."
              : `Start a new ${pendingDifficulty.label} game? This one will be lost.`
          }
          confirmLabel="New game"
          onConfirm={confirmDifficultyChange}
          onCancel={cancelDifficultyChange}
        />
      )}

      <div className="minesweeper__tools">
        <div className="fp-seg" role="group" aria-label="Interaction mode">
          <button
            type="button"
            className="fp-seg__btn"
            onClick={() => setMode("reveal")}
            aria-pressed={mode === "reveal"}
          >
            Reveal
          </button>
          <button
            type="button"
            className="fp-seg__btn"
            onClick={() => setMode("flag")}
            aria-pressed={mode === "flag"}
          >
            Flag
          </button>
        </div>
        <button type="button" className="fp-btn fp-btn--secondary minesweeper__new" onClick={requestNewGame} disabled={pendingDifficulty !== null}>
          New game
        </button>
      </div>

      <div className={`minesweeper__board-wrap minesweeper__board-wrap--${difficulty.id}`}>
        <div
          ref={boardRef}
          className={`minesweeper-board minesweeper-board--${difficulty.id} fp-corner-marks${board.status === "lost" ? " fp-shake" : ""}${board.status === "won" ? " fp-win-sweep" : ""}`}
          style={{
            ["--cols" as string]: difficulty.cols,
            ["--rows" as string]: difficulty.rows,
          }}
          onKeyDown={onBoardKeyDown}
          role="grid"
          aria-label={`${difficulty.label} minesweeper board`}
        >
          {board.cells.map((cell, i) => (
            <MineCell
              key={i}
              cell={cell}
              index={i}
              row={Math.floor(i / difficulty.cols)}
              col={i % difficulty.cols}
              isTriggered={board.triggeredIndex === i}
              locked={boardLocked}
              tabIndex={i === 0 ? 0 : -1}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerCancel}
              onClick={onClick}
              onContextMenu={onContextMenu}
            />
          ))}
        </div>
      </div>

      {gameOver && (
        <div
          className={`minesweeper__result fp-enter ${board.status === "won" ? "fp-bg-accent--success" : "fp-bg-accent--danger"}`}
          role="alert"
        >
          <p className={`fp-result-title fp-result-title--${board.status === "won" ? "success" : "danger"}`}>
            {board.status === "won" ? "Board cleared" : "Detonated"}
          </p>
          <p className="fp-result-detail">
            {board.status === "won" ? `Time ${formatTime(elapsed)}` : "Game over"}
            {bestTime !== null && ` — Best ${formatTime(bestTime)}`}
          </p>
          <button type="button" className="fp-btn fp-btn--success" onClick={newGame}>
            New game
          </button>
        </div>
      )}
    </div>
  );
}

interface MineCellProps {
  cell: Cell;
  index: number;
  row: number;
  col: number;
  isTriggered: boolean;
  /** True for a genuine game-over *or* a pending difficulty confirmation - either way, the board must stop accepting input. */
  locked: boolean;
  tabIndex: number;
  onPointerDown: (e: React.PointerEvent, index: number) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent, index: number) => void;
  onPointerCancel: () => void;
  onClick: (index: number) => void;
  onContextMenu: (e: React.MouseEvent, index: number) => void;
}

function MineCell({
  cell,
  index,
  row,
  col,
  isTriggered,
  locked,
  tabIndex,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onClick,
  onContextMenu,
}: MineCellProps) {
  const classNames = ["minesweeper-cell"];
  if (cell.revealed) classNames.push("minesweeper-cell--revealed");
  if (cell.revealed && cell.hasMine) classNames.push("minesweeper-cell--mine");
  if (isTriggered) classNames.push("minesweeper-cell--triggered");
  if (cell.flagged) classNames.push("minesweeper-cell--flagged");
  if (locked && !cell.revealed) classNames.push("minesweeper-cell--inert");

  return (
    <div
      className={classNames.join(" ")}
      data-index={index}
      role="gridcell"
      tabIndex={tabIndex}
      aria-label={cellLabel(cell, row, col, isTriggered)}
      onPointerDown={(e) => onPointerDown(e, index)}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => onPointerUp(e, index)}
      onPointerCancel={onPointerCancel}
      onClick={() => onClick(index)}
      onContextMenu={(e) => onContextMenu(e, index)}
    >
      {cell.flagged && !cell.revealed && <span className="minesweeper-cell__flag" aria-hidden="true" />}
      {cell.revealed && cell.hasMine && <span className="minesweeper-cell__mine" aria-hidden="true" />}
      {cell.revealed && !cell.hasMine && cell.adjacent > 0 && (
        <span
          className="minesweeper-cell__number"
          style={{ color: NUMBER_COLORS[cell.adjacent] }}
          aria-hidden="true"
        >
          {cell.adjacent}
        </span>
      )}
    </div>
  );
}
