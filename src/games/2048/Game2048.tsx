import { useRef } from "react";
import { BOARD_SIZE, type Board } from "./logic";
import { use2048 } from "./use2048";
import "./Game2048.css";

const SWIPE_THRESHOLD_PX = 24;

function digitTier(value: number): string {
  const digits = String(value).length;
  if (digits <= 2) return "digits-1-2";
  if (digits === 3) return "digits-3";
  if (digits === 4) return "digits-4";
  return "digits-5-plus";
}

/** Escalating energy tiers, not a literal rainbow-per-value palette - each step reads as "hotter", building toward the 2048 fusion moment. */
function energyTier(value: number): number {
  if (value <= 4) return 1;
  if (value <= 16) return 2;
  if (value <= 64) return 3;
  if (value <= 256) return 4;
  if (value <= 1024) return 5;
  return 6; // 2048+
}

function boardLabel(board: Board): string {
  const occupied = board.flat().filter((v) => v !== 0).length;
  return `Fusion matrix, ${occupied} of ${BOARD_SIZE * BOARD_SIZE} cells occupied`;
}

export function Game2048() {
  const {
    board,
    score,
    bestScore,
    canUndo,
    lastMergedCells,
    lastSpawnedCell,
    gameOver,
    showMilestonePrompt,
    pendingNewGame,
    move,
    undo,
    acknowledgeMilestone,
    requestNewGame,
    confirmNewGame,
    cancelNewGame,
  } = use2048();

  const gestureStart = useRef<{ x: number; y: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    gestureStart.current = { x: e.clientX, y: e.clientY };
  }

  function onPointerMove(e: React.PointerEvent) {
    // Only suppress the page's own scroll/pan once a gesture on the board is
    // actually underway - touch-action: none on the board (CSS) is what
    // reliably stops native scrolling; this is a secondary safety net.
    if (gestureStart.current) e.preventDefault();
  }

  function onPointerUp(e: React.PointerEvent) {
    const start = gestureStart.current;
    gestureStart.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return; // a tap, not a swipe
    if (Math.abs(dx) > Math.abs(dy)) {
      move(dx > 0 ? "right" : "left");
    } else {
      move(dy > 0 ? "down" : "up");
    }
  }

  function onPointerCancel() {
    gestureStart.current = null;
  }

  const mergedSet = new Set(lastMergedCells.map(([r, c]) => `${r}-${c}`));
  const spawnedKey = lastSpawnedCell ? `${lastSpawnedCell[0]}-${lastSpawnedCell[1]}` : null;

  return (
    <div className="game2048">
      <div className="game2048__hud">
        <p className="fp-label game2048__level">// Fusion matrix</p>
        <div className="game2048__stats">
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Score</span>
            <span className="fp-hud-value">{score}</span>
          </div>
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Best</span>
            <span className="fp-hud-value">{bestScore}</span>
          </div>
        </div>
      </div>

      {pendingNewGame && (
        <div className="game2048__confirm" role="alertdialog" aria-label="Confirm new game">
          <p className="fp-label">Start a new game? Current progress will be lost.</p>
          <div className="game2048__confirm-actions">
            <button type="button" className="fp-btn fp-btn--danger" onClick={confirmNewGame}>
              Yes, restart
            </button>
            <button type="button" className="fp-btn fp-btn--secondary" onClick={cancelNewGame}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div
        className="game2048-board fp-corner-marks"
        role="group"
        aria-label={boardLabel(board)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {board.map((row, r) =>
          row.map((value, c) => {
            const key = `${r}-${c}`;
            if (value === 0) return <div key={key} className="game2048-cell" />;
            const classNames = [
              "game2048-cell",
              "game2048-tile",
              `game2048-tile--tier-${energyTier(value)}`,
              `game2048-tile--${digitTier(value)}`,
            ];
            if (mergedSet.has(key)) classNames.push("game2048-tile--merged");
            if (spawnedKey === key) classNames.push("game2048-tile--spawned");
            return (
              <div key={key} className={classNames.join(" ")}>
                {value}
              </div>
            );
          }),
        )}

        {showMilestonePrompt && (
          <div className="game2048__overlay fp-bg-accent--success" role="status">
            <p className="fp-result-title fp-result-title--success">Core stable</p>
            <p className="fp-result-detail">2048 reached</p>
            <div className="game2048__overlay-actions">
              <button type="button" className="fp-btn fp-btn--success" onClick={acknowledgeMilestone}>
                Continue
              </button>
              <button type="button" className="fp-btn fp-btn--secondary" onClick={requestNewGame}>
                New game
              </button>
            </div>
          </div>
        )}

        {gameOver && (
          <div className="game2048__overlay fp-bg-accent--danger" role="alert">
            <p className="fp-result-title fp-result-title--danger">Matrix locked</p>
            <p className="fp-result-detail">No moves remaining</p>
            <div className="game2048__overlay-actions">
              <button type="button" className="fp-btn fp-btn--success" onClick={requestNewGame}>
                New game
              </button>
              {canUndo && (
                <button type="button" className="fp-btn fp-btn--secondary" onClick={undo}>
                  Undo
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="game2048__controls">
        <button
          type="button"
          className="fp-btn fp-btn--secondary game2048__control-btn"
          onClick={undo}
          disabled={!canUndo || pendingNewGame}
        >
          Undo
        </button>
        <button
          type="button"
          className="fp-btn fp-btn--secondary game2048__control-btn"
          onClick={requestNewGame}
          disabled={pendingNewGame}
        >
          New game
        </button>
      </div>
    </div>
  );
}
