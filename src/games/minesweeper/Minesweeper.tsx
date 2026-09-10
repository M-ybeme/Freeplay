import { useRef } from "react";
import { cellLabel, type Cell } from "./logic";
import { useMinesweeper } from "./useMinesweeper";
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

  const gameOver = board.status === "won" || board.status === "lost";
  const minesLeft = difficulty.mines - board.cells.filter((c) => c.flagged).length;
  const bestTime = bestTimes[difficulty.id];

  function clearLongPressTimer() {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function onPointerDown(e: React.PointerEvent, index: number) {
    if (e.pointerType === "mouse" || gameOver) return;
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
    interact(index);
  }

  function onPointerCancel() {
    clearLongPressTimer();
    pressState.current = null;
  }

  function onClick(index: number) {
    interact(index);
  }

  function onContextMenu(e: React.MouseEvent, index: number) {
    e.preventDefault();
    if (!gameOver) flag(index);
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
      if (!gameOver) interact(index);
      return;
    }
    if (e.key === "f" || e.key === "F") {
      e.preventDefault();
      if (!gameOver) flag(index);
    }
  }

  return (
    <div className="minesweeper">
      <div className="minesweeper__hud">
        <p className="fp-label minesweeper__level">// Hazard scan — {difficulty.label}</p>
        <div className="minesweeper__stats">
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Mines</span>
            <span className="fp-hud-value">{formatMines(minesLeft)}</span>
          </div>
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Time</span>
            <span className="fp-hud-value">{formatTime(elapsed)}</span>
          </div>
        </div>
      </div>

      <div className="minesweeper__difficulty" role="group" aria-label="Difficulty">
        {difficulties.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`fp-btn minesweeper__difficulty-btn ${d.id === difficulty.id ? "fp-btn--primary" : "fp-btn--secondary"}`}
            onClick={() => selectDifficulty(d)}
            aria-pressed={d.id === difficulty.id}
          >
            {d.label}
          </button>
        ))}
      </div>

      {pendingDifficulty && (
        <div className="minesweeper__confirm" role="alertdialog" aria-label="Confirm new difficulty">
          <p className="fp-label">Start a new {pendingDifficulty.label} game?</p>
          <div className="minesweeper__confirm-actions">
            <button type="button" className="fp-btn fp-btn--danger" onClick={confirmDifficultyChange}>
              Yes, restart
            </button>
            <button type="button" className="fp-btn fp-btn--secondary" onClick={cancelDifficultyChange}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="minesweeper__mode" role="group" aria-label="Interaction mode">
        <button
          type="button"
          className={`fp-btn minesweeper__mode-btn ${mode === "reveal" ? "fp-btn--primary" : "fp-btn--secondary"}`}
          onClick={() => setMode("reveal")}
          aria-pressed={mode === "reveal"}
        >
          Reveal
        </button>
        <button
          type="button"
          className={`fp-btn minesweeper__mode-btn ${mode === "flag" ? "fp-btn--primary" : "fp-btn--secondary"}`}
          onClick={() => setMode("flag")}
          aria-pressed={mode === "flag"}
        >
          Flag
        </button>
      </div>

      <div className={`minesweeper__board-wrap minesweeper__board-wrap--${difficulty.id}`}>
        <div
          ref={boardRef}
          className={`minesweeper-board minesweeper-board--${difficulty.id} fp-corner-marks`}
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
              gameOver={gameOver}
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
          className={`minesweeper__result ${board.status === "won" ? "fp-bg-accent--success" : "fp-bg-accent--danger"}`}
          role="alert"
        >
          <p
            className={`minesweeper__result-title minesweeper__result-title--${board.status === "won" ? "success" : "danger"}`}
          >
            {board.status === "won" ? "Board cleared" : "Detonated"}
          </p>
          <p className="minesweeper__result-detail">
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
  gameOver: boolean;
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
  gameOver,
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
  if (gameOver && !cell.revealed) classNames.push("minesweeper-cell--inert");

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
