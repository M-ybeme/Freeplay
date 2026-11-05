import { useMemo, useState, type CSSProperties } from "react";
import { LAYOUTS, LAYOUT_BY_ID, faceName, layoutBounds, layoutPositions, type Tile } from "./logic";
import { TileFace } from "./TileFace";
import { formatTime, useMahjong } from "./useMahjong";
import "./Mahjong.css";

function tileStyle(t: Tile): CSSProperties {
  return {
    "--x": t.x / 2,
    "--y": t.y / 2,
    "--z": t.z,
    // Higher layers above lower; within a layer, later rows and columns
    // above earlier ones so the depth edges overlap the right way.
    zIndex: t.z * 1000 + t.y * 20 + t.x,
  } as CSSProperties;
}

export function Mahjong() {
  const {
    tiles,
    layoutId,
    selectedId,
    matched,
    canUndo,
    free,
    won,
    stuck,
    hint,
    blocked,
    removing,
    unrescuable,
    message,
    elapsed,
    started,
    best,
    isNewBest,
    showFree,
    setShowFree,
    select,
    undo,
    shuffle,
    showHint,
    newDeal,
  } = useMahjong();

  // Abandoning a board in progress asks first.
  const [pendingLayout, setPendingLayout] = useState<string | null>(null);
  const requestDeal = (next: string) => {
    if (started && !won) setPendingLayout(next);
    else newDeal(next);
  };

  const bounds = useMemo(() => layoutBounds(layoutPositions(LAYOUT_BY_ID[layoutId])), [layoutId]);
  const stageStyle = { "--cols": bounds.w / 2, "--rows": bounds.h / 2, "--layers": bounds.maxZ } as CSSProperties;

  return (
    <div className="mahjong">
      <div className="mahjong__bar">
        <div className="mahjong__hud">
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Tiles</span>
            <span className={`fp-hud-value${matched > 0 ? " fp-pop" : ""}`} key={tiles.length}>
              {tiles.length}
            </span>
          </div>
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Time</span>
            <span className="fp-hud-value">{formatTime(elapsed)}</span>
          </div>
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Best</span>
            <span className="fp-hud-value">{best === undefined ? "--:--" : formatTime(best)}</span>
          </div>
        </div>

        <div className="mahjong__layouts" role="group" aria-label="Layout">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`mahjong__layout${l.id === layoutId ? " mahjong__layout--on" : ""}`}
              aria-pressed={l.id === layoutId}
              onClick={() => requestDeal(l.id)}
            >
              {l.name}
            </button>
          ))}
        </div>
      </div>

      {pendingLayout && (
        <div className="mahjong__confirm fp-enter" role="alertdialog" aria-label="Abandon this board?">
          <p className="mahjong__confirm-text">Abandon this board and deal {LAYOUT_BY_ID[pendingLayout].name}?</p>
          <div className="mahjong__confirm-actions">
            <button
              type="button"
              className="fp-btn fp-btn--danger mahjong__btn"
              onClick={() => {
                newDeal(pendingLayout);
                setPendingLayout(null);
              }}
            >
              Deal
            </button>
            <button type="button" className="fp-btn fp-btn--secondary mahjong__btn" onClick={() => setPendingLayout(null)}>
              Keep playing
            </button>
          </div>
        </div>
      )}

      <div className={`mahjong-stage${showFree ? " mahjong-stage--show-free" : ""}`} style={stageStyle}>
        <div className="mahjong-board">
          {tiles.map((t) => {
            const isFree = free.has(t.id);
            const classes = [
              "mahjong-tile",
              isFree ? "mahjong-tile--free" : "mahjong-tile--blocked",
              t.id === selectedId && "mahjong-tile--selected",
              hint?.includes(t.id) && "mahjong-tile--hint",
              blocked?.id === t.id && "fp-shake",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <button
                key={blocked?.id === t.id ? `${t.id}-${blocked.nonce}` : t.id}
                type="button"
                className={classes}
                style={tileStyle(t)}
                aria-label={`${faceName(t.faceId)}${isFree ? "" : ", blocked"}`}
                aria-pressed={t.id === selectedId}
                onClick={() => select(t.id)}
              >
                <TileFace faceId={t.faceId} />
              </button>
            );
          })}

          {removing.map((t) => (
            <div key={`gone-${t.id}`} className="mahjong-tile mahjong-tile--leaving" style={tileStyle(t)} aria-hidden="true">
              <TileFace faceId={t.faceId} />
            </div>
          ))}
        </div>

        {won && (
          <div className="mahjong__overlay fp-enter fp-bg-accent--success" role="alert">
            <p className="fp-result-title fp-result-title--success">Board cleared</p>
            <p className="fp-result-detail">
              {LAYOUT_BY_ID[layoutId].name} in {formatTime(elapsed)}
              {best !== undefined && ` — Best ${formatTime(best)}`}
            </p>
            {isNewBest && <p className="fp-badge fp-badge--success">New best</p>}
            <button type="button" className="fp-btn fp-btn--success mahjong__btn" onClick={() => newDeal()}>
              Deal again
            </button>
          </div>
        )}
      </div>

      {stuck && (
        <div className="mahjong__stuck fp-enter" role="alert">
          {unrescuable ? (
            <>
              <p className="mahjong__stuck-text">These tiles can't be cleared in any order.</p>
              <button type="button" className="fp-btn fp-btn--primary mahjong__btn" onClick={() => newDeal()}>
                New deal
              </button>
            </>
          ) : (
            <>
              <p className="mahjong__stuck-text">No moves left.</p>
              <button type="button" className="fp-btn fp-btn--primary mahjong__btn" onClick={shuffle}>
                Shuffle
              </button>
            </>
          )}
        </div>
      )}

      <div className="mahjong__dock">
        <div className="mahjong__controls">
          <button type="button" className="fp-btn fp-btn--secondary mahjong__btn" onClick={showHint} disabled={won || stuck}>
            Hint
          </button>
          <button type="button" className="fp-btn fp-btn--secondary mahjong__btn" onClick={undo} disabled={!canUndo || won}>
            Undo
          </button>
          <button type="button" className="fp-btn fp-btn--secondary mahjong__btn" onClick={shuffle} disabled={won}>
            Shuffle
          </button>
          <button type="button" className="fp-btn fp-btn--secondary mahjong__btn" onClick={() => requestDeal(layoutId)}>
            New
          </button>
        </div>

        <button
          type="button"
          className={`mahjong__toggle${showFree ? " mahjong__toggle--on" : ""}`}
          aria-pressed={showFree}
          onClick={() => setShowFree(!showFree)}
        >
          <span className="mahjong__toggle-box" aria-hidden="true" />
          Dim blocked tiles
        </button>
      </div>

      <p className="mahjong__sr" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}
