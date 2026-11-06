import { useEffect, useRef, useState } from "react";
import { extendRoute, isPairConnected, resolveEndpointOwner, type CellCoord } from "./logic";
import { useFlow } from "./useFlow";
import { ConfirmPrompt } from "../../components/ConfirmPrompt/ConfirmPrompt";
import "./Flow.css";

// Color name + geometric marker per pair, matching the principle Color Sort
// established: identity must survive color-blindness and grayscale alike,
// so every pair gets a distinct shape (via CSS clip-path, see Flow.css)
// alongside its hue. Six entries covers Hard's max pair count.
const SIGNAL_COLOR_NAMES = ["Cyan", "Lime", "Orange", "Magenta", "Violet", "Yellow"];
const SIGNAL_MARKER_NAMES = ["Circle", "Ring", "Triangle", "Diamond", "Pentagon", "Hexagon"];

function pairLabel(pairIndex: number): string {
  return `${SIGNAL_COLOR_NAMES[pairIndex]} ${SIGNAL_MARKER_NAMES[pairIndex]} signal`;
}

const DIRECTION_KEYS: Record<string, [number, number]> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
};

function cellFromPoint(x: number, y: number): CellCoord | null {
  const el = document.elementFromPoint(x, y);
  const cellEl = el instanceof Element ? el.closest<HTMLElement>("[data-row]") : null;
  if (!cellEl) return null;
  const row = Number(cellEl.dataset.row);
  const col = Number(cellEl.dataset.col);
  if (Number.isNaN(row) || Number.isNaN(col)) return null;
  return [row, col];
}

export function Flow() {
  const {
    puzzle,
    routes,
    difficulty,
    difficulties,
    activePair,
    justConnectedPair,
    pendingDifficulty,
    locked,
    solved,
    connectedCount,
    filled,
    totalCells,
    beginDrag,
    continueDrag,
    extendActiveRoute,
    endDrag,
    restart,
    requestNewPuzzle,
    requestDifficulty,
    confirmPending,
    cancelPending,
  } = useFlow();

  const boardRef = useRef<HTMLDivElement>(null);
  const [focusedCell, setFocusedCell] = useState<CellCoord>([0, 0]);

  // A brand new puzzle (new game, restart, difficulty switch, reload) should
  // always start roving focus back at the top-left corner rather than
  // wherever the previous puzzle's board happened to leave it.
  useEffect(() => {
    setFocusedCell([0, 0]);
  }, [puzzle]);

  function focusCellEl(row: number, col: number) {
    boardRef.current?.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`)?.focus();
  }

  function onBoardPointerDown(e: React.PointerEvent) {
    if (locked) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    try {
      boardRef.current?.setPointerCapture(e.pointerId);
    } catch {
      // Pointer capture can throw in rare edge cases (already-released
      // pointer id); dragging still works via document.elementFromPoint,
      // it just loses the "keep tracking outside the board" guarantee.
    }
    beginDrag(cell);
  }

  function onBoardPointerMove(e: React.PointerEvent) {
    if (locked || activePair === null) return;
    const cell = cellFromPoint(e.clientX, e.clientY);
    if (!cell) return;
    continueDrag(cell);
  }

  function onBoardPointerUp() {
    endDrag();
  }

  function onBoardKeyDown(e: React.KeyboardEvent) {
    const target = e.target as HTMLElement;
    const rowAttr = target.getAttribute("data-row");
    const colAttr = target.getAttribute("data-col");
    if (rowAttr === null || colAttr === null) return;
    const row = Number(rowAttr);
    const col = Number(colAttr);

    const delta = DIRECTION_KEYS[e.key];
    if (delta) {
      e.preventDefault();
      if (locked) return;
      const [dr, dc] = delta;

      if (activePair !== null) {
        const candidate: CellCoord = [row + dr, col + dc];
        if (candidate[0] < 0 || candidate[0] >= puzzle.size || candidate[1] < 0 || candidate[1] >= puzzle.size) return;
        // Check legality with the same pure function before moving focus,
        // so an illegal arrow press leaves the roving-focus cell exactly
        // where it was rather than jumping onto a cell the route didn't
        // actually reach.
        const attempted = extendRoute(puzzle, routes, activePair, candidate);
        if (attempted === routes) return;
        extendActiveRoute(candidate);
        setFocusedCell(candidate);
        focusCellEl(candidate[0], candidate[1]);
        return;
      }

      const nextRow = Math.min(puzzle.size - 1, Math.max(0, row + dr));
      const nextCol = Math.min(puzzle.size - 1, Math.max(0, col + dc));
      setFocusedCell([nextRow, nextCol]);
      focusCellEl(nextRow, nextCol);
      return;
    }

    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (locked) return;
      if (activePair !== null) {
        endDrag();
      } else {
        beginDrag([row, col]);
      }
      return;
    }

    if (e.key === "Escape" && activePair !== null) {
      e.preventDefault();
      endDrag();
    }
  }

  const owners: (number | null)[][] = Array.from({ length: puzzle.size }, () => Array(puzzle.size).fill(null));
  for (let p = 0; p < routes.length; p++) {
    for (const [r, c] of routes[p]) owners[r][c] = p;
  }

  // Pipe joins come from route *order*: each cell links only to the cells
  // just before and after it in its own path. Deriving them from "the
  // neighbour has the same colour" joined every touching cell of a route
  // that doubled back alongside itself, drawing a grid instead of a line.
  const links = Array.from({ length: puzzle.size }, () =>
    Array.from({ length: puzzle.size }, () => ({ up: false, down: false, left: false, right: false })),
  );
  for (const path of routes) {
    for (let i = 0; i < path.length; i++) {
      const [r, c] = path[i];
      for (const other of [path[i - 1], path[i + 1]]) {
        if (!other) continue;
        const [orow, ocol] = other;
        if (orow === r - 1 && ocol === c) links[r][c].up = true;
        if (orow === r + 1 && ocol === c) links[r][c].down = true;
        if (orow === r && ocol === c - 1) links[r][c].left = true;
        if (orow === r && ocol === c + 1) links[r][c].right = true;
      }
    }
  }

  function editingStatus(): string {
    if (activePair === null) return "";
    const path = routes[activePair];
    const connected = isPairConnected(puzzle, routes, activePair);
    return `${pairLabel(activePair)} selected. Path length ${path.length}.${connected ? " Connected." : ""}`;
  }

  function cellLabel(row: number, col: number, owner: number | null): string {
    const base = `Row ${row + 1}, column ${col + 1}`;
    const endpointPair = resolveEndpointOwner(puzzle, [row, col]);
    if (endpointPair !== null) {
      const connected = isPairConnected(puzzle, routes, endpointPair);
      return `${base}, ${pairLabel(endpointPair)} endpoint${connected ? ", connected" : ""}`;
    }
    if (owner !== null) return `${base}, ${pairLabel(owner)} path`;
    return `${base}, empty`;
  }

  return (
    <div className="flow">
      <div className="flow__hud">
        <p className="fp-label flow__level">// Signal routing — {difficulty.label}</p>
        <div className="flow__stats">
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Pairs</span>
            <span className={`fp-hud-value${connectedCount > 0 ? " fp-pop" : ""}`} key={connectedCount}>
              {connectedCount} / {puzzle.pairCount}
            </span>
          </div>
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Fill</span>
            <span className="fp-hud-value">
              {filled} / {totalCells}
            </span>
          </div>
        </div>
      </div>

      <div className="fp-seg" role="group" aria-label="Difficulty">
        {difficulties.map((d) => (
          <button
            key={d.id}
            type="button"
            className="fp-seg__btn"
            onClick={() => requestDifficulty(d)}
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
              ? "Start a new puzzle? This one will be lost."
              : `Start a new ${pendingDifficulty.label} puzzle? This one will be lost.`
          }
          confirmLabel="New puzzle"
          onConfirm={confirmPending}
          onCancel={cancelPending}
        />
      )}

      <p className="flow__status" role="status" aria-live="polite">
        {editingStatus()}
      </p>

      <div
        ref={boardRef}
        className={`flow-board fp-corner-marks${solved ? " flow-board--solved" : ""}`}
        style={{ ["--size" as string]: puzzle.size }}
        role="grid"
        aria-label={`${difficulty.label} signal routing board`}
        onPointerDown={onBoardPointerDown}
        onPointerMove={onBoardPointerMove}
        onPointerUp={onBoardPointerUp}
        onPointerCancel={onBoardPointerUp}
        onKeyDown={onBoardKeyDown}
      >
        {Array.from({ length: puzzle.size }, (_, row) =>
          Array.from({ length: puzzle.size }, (_, col) => {
            const owner = owners[row][col];
            const endpointPair = resolveEndpointOwner(puzzle, [row, col]);
            const connected = owner !== null && isPairConnected(puzzle, routes, owner);
            const classNames = ["flow-cell"];
            if (owner !== null) classNames.push("flow-cell--occupied");
            if (owner !== null && owner === activePair) classNames.push("flow-cell--active");
            if (connected) classNames.push("flow-cell--connected");
            if (owner !== null && owner === justConnectedPair) classNames.push("flow-cell--pulse");

            const { up: connectsUp, down: connectsDown, left: connectsLeft, right: connectsRight } = links[row][col];

            const isFocusable = focusedCell[0] === row && focusedCell[1] === col;

            return (
              <div
                key={`${row}-${col}`}
                className={classNames.join(" ")}
                data-row={row}
                data-col={col}
                role="gridcell"
                tabIndex={isFocusable ? 0 : -1}
                aria-label={cellLabel(row, col, owner)}
                style={{
                  ["--d" as string]: row + col,
                  ...(owner !== null ? { ["--signal" as string]: `var(--flow-signal-${owner})` } : {}),
                }}
              >
                {owner !== null && (
                  <>
                    {connectsUp && <span className="flow-cell__pipe flow-cell__pipe--up" aria-hidden="true" />}
                    {connectsDown && <span className="flow-cell__pipe flow-cell__pipe--down" aria-hidden="true" />}
                    {connectsLeft && <span className="flow-cell__pipe flow-cell__pipe--left" aria-hidden="true" />}
                    {connectsRight && <span className="flow-cell__pipe flow-cell__pipe--right" aria-hidden="true" />}
                    {/* Skip the round conduit node on endpoint cells - the
                        endpoint's own marker already signals "occupied"
                        there, and stacking both made the marker disappear
                        into an equally-bright same-hue blob once connected. */}
                    {endpointPair === null && <span className="flow-cell__node" aria-hidden="true" />}
                  </>
                )}
                {endpointPair !== null && (
                  <span
                    className={`flow-cell__endpoint flow-cell__endpoint--${endpointPair}`}
                    style={{ ["--signal" as string]: `var(--flow-signal-${endpointPair})` }}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          }),
        )}
      </div>

      <div className="fp-controls flow__controls">
        <button type="button" className="fp-btn fp-btn--secondary" onClick={restart} disabled={locked}>
          Restart
        </button>
        <button type="button" className="fp-btn fp-btn--secondary" onClick={requestNewPuzzle} disabled={locked}>
          New puzzle
        </button>
      </div>

      {solved && (
        <div className="flow__result fp-bg-accent--success fp-enter" role="alert">
          <p className="fp-result-title fp-result-title--success">Routing complete</p>
          <p className="fp-result-detail">All signals linked</p>
          <button type="button" className="fp-btn fp-btn--success" onClick={requestNewPuzzle}>
            New puzzle
          </button>
        </div>
      )}
    </div>
  );
}
