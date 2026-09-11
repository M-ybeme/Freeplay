import { TUBE_CAPACITY, isLegalPour, isTubeComplete, type Tube } from "./logic";
import { useColorSort } from "./useColorSort";
import "./ColorSort.css";

// Names, not just hues - color identity here must survive color-blindness
// and grayscale screenshots alike. Paired with a distinct geometric mark
// per color in the CSS (.color-sort-mark--N) for the same reason.
const COLOR_NAMES = ["Cyan", "Pink", "Green", "Orange", "Purple", "Yellow", "Teal"];

function describeTube(tube: Tube, index: number): string {
  const label = `Tube ${index + 1}`;
  if (tube.length === 0) return `${label}, empty`;
  if (isTubeComplete(tube)) return `${label}, complete, ${COLOR_NAMES[tube[0]]}`;
  const contents = tube.map((c) => COLOR_NAMES[c]).join(", ");
  return `${label}, contains ${contents} from the bottom, ${TUBE_CAPACITY - tube.length} empty`;
}

export function ColorSort() {
  const {
    difficulty,
    difficulties,
    board,
    selectedTube,
    moveCount,
    status,
    canUndo,
    bestMoves,
    pendingDifficulty,
    selectTube,
    selectDifficulty,
    confirmDifficultyChange,
    cancelDifficultyChange,
    newPuzzle,
    restartPuzzle,
    undo,
  } = useColorSort();

  const won = status === "won";
  const best = bestMoves[difficulty.id];

  return (
    <div className="color-sort">
      <div className="color-sort__hud">
        <p className="fp-label color-sort__level">// Sample processing — {difficulty.label}</p>
        <div className="color-sort__stats">
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Moves</span>
            <span className="fp-hud-value">{moveCount}</span>
          </div>
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Best</span>
            <span className="fp-hud-value">{best ?? "—"}</span>
          </div>
        </div>
      </div>

      <div className="color-sort__difficulty" role="group" aria-label="Difficulty">
        {difficulties.map((d) => (
          <button
            key={d.id}
            type="button"
            className={`fp-btn color-sort__difficulty-btn ${d.id === difficulty.id ? "fp-btn--primary" : "fp-btn--secondary"}`}
            onClick={() => selectDifficulty(d)}
            aria-pressed={d.id === difficulty.id}
          >
            {d.label}
          </button>
        ))}
      </div>

      {pendingDifficulty && (
        <div className="color-sort__confirm" role="alertdialog" aria-label="Confirm new difficulty">
          <p className="fp-label">Start a new {pendingDifficulty.label} puzzle?</p>
          <div className="color-sort__confirm-actions">
            <button type="button" className="fp-btn fp-btn--danger" onClick={confirmDifficultyChange}>
              Yes, restart
            </button>
            <button type="button" className="fp-btn fp-btn--secondary" onClick={cancelDifficultyChange}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="color-sort__rack fp-corner-marks" role="group" aria-label={`${difficulty.label} puzzle`}>
        {board.map((tube, i) => (
          <TubeButton
            key={i}
            tube={tube}
            index={i}
            selected={selectedTube === i}
            legalTarget={selectedTube !== null && selectedTube !== i && isLegalPour(board, selectedTube, i)}
            disabled={won}
            onSelect={selectTube}
          />
        ))}
      </div>

      <div className="color-sort__controls">
        <button
          type="button"
          className="fp-btn fp-btn--secondary color-sort__control-btn"
          onClick={undo}
          disabled={!canUndo}
        >
          Undo
        </button>
        <button
          type="button"
          className="fp-btn fp-btn--secondary color-sort__control-btn"
          onClick={restartPuzzle}
          disabled={won}
        >
          Restart puzzle
        </button>
      </div>

      {won && (
        <div className="color-sort__result fp-bg-accent--success" role="alert">
          <p className="fp-result-title fp-result-title--success">Sorted</p>
          <p className="fp-result-detail">
            {moveCount} moves{best !== null && best < moveCount ? ` — Best ${best}` : ""}
            {best === moveCount && " — New best"}
          </p>
          <button type="button" className="fp-btn fp-btn--success" onClick={newPuzzle}>
            New puzzle
          </button>
        </div>
      )}
    </div>
  );
}

interface TubeButtonProps {
  tube: Tube;
  index: number;
  selected: boolean;
  legalTarget: boolean;
  disabled: boolean;
  onSelect: (index: number) => void;
}

function TubeButton({ tube, index, selected, legalTarget, disabled, onSelect }: TubeButtonProps) {
  const complete = isTubeComplete(tube);
  const slots: (number | null)[] = [...tube, ...Array(TUBE_CAPACITY - tube.length).fill(null)];

  const classNames = ["color-sort-tube"];
  if (selected) classNames.push("color-sort-tube--selected");
  if (legalTarget) classNames.push("color-sort-tube--legal-target");
  if (complete) classNames.push("color-sort-tube--complete");

  return (
    <div className="color-sort-tube-wrap">
      <button
        type="button"
        className={classNames.join(" ")}
        onClick={() => onSelect(index)}
        disabled={disabled}
        aria-pressed={selected}
        aria-label={describeTube(tube, index)}
      >
        <span className="color-sort-tube__slots" aria-hidden="true">
          {slots.map((color, i) => (
            <span
              key={i}
              className={`color-sort-slot ${color !== null ? `color-sort-slot--filled color-sort-mark--${color}` : ""}`}
              style={color !== null ? { ["--seg-color" as string]: `var(--cs-color-${color})` } : undefined}
            />
          ))}
        </span>
      </button>
      <span className="fp-label color-sort-tube__number" aria-hidden="true">
        {String(index + 1).padStart(2, "0")}
      </span>
    </div>
  );
}
