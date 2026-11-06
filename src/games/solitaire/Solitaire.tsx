import { useRef, useState } from "react";
import { PlayingCard } from "../../components/PlayingCard/PlayingCard";
import { SuitIcon } from "../../components/PlayingCard/SuitIcon";
import { SUITS, cardName, suitLabel, type Card } from "../../components/PlayingCard/types";
import { useSolitaire, type Selection } from "./useSolitaire";
import { FRESH_STOCK_SIZE, type TableauCard as TableauCardModel } from "./logic";
import { useCardMotion } from "./useCardMotion";
import { ConfirmPrompt } from "../../components/ConfirmPrompt/ConfirmPrompt";
import "./Solitaire.css";

const DRAG_THRESHOLD_PX = 6;
const DOUBLE_TAP_MS = 350;

function cardId(card: Card): string {
  return `${card.rank}-${card.suit}`;
}

function selectionKey(sel: Selection): string {
  if (sel.zone === "waste") return "waste";
  if (sel.zone === "tableau") return `tableau-${sel.pile}`;
  return `foundation-${sel.suitIndex}`;
}

function sameZone(a: Selection, b: Selection): boolean {
  return selectionKey(a) === selectionKey(b);
}

function parseZoneTarget(el: HTMLElement): Selection | null {
  const zone = el.dataset.zone;
  if (zone === "waste") return { zone: "waste" };
  if (zone === "tableau") return { zone: "tableau", pile: Number(el.dataset.pile), index: 0 };
  if (zone === "foundation") return { zone: "foundation", suitIndex: Number(el.dataset.suitIndex) };
  return null;
}

interface Gesture {
  pointerId: number;
  source: Selection;
  cards: Card[];
  startX: number;
  startY: number;
  dragging: boolean;
}

export function Solitaire() {
  const {
    stock,
    waste,
    foundations,
    tableau,
    selected,
    canUndo,
    pendingNewGame,
    locked,
    won,
    stockActivate,
    activateZone,
    attemptMove,
    getSequenceFor,
    autoMoveToFoundation,
    clearSelection,
    undo,
    requestNewGame,
    confirmNewGame,
    cancelNewGame,
  } = useSolitaire();

  const gestureRef = useRef<Gesture | null>(null);
  const lastTapRef = useRef<{ key: string; time: number } | null>(null);
  const [drag, setDrag] = useState<{ cards: Card[]; x: number; y: number } | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [cursor, setCursor] = useState<{ pile: number; index: number }>({ pile: 0, index: 0 });
  const [focusedPile, setFocusedPile] = useState<number | null>(null);

  const foundationCount = foundations.reduce((sum, p) => sum + p.length, 0);
  // Derived straight from the run (never a separate counter), so they stay
  // right across reloads and undo.
  const hiddenCount = tableau.reduce((sum, pile) => sum + pile.filter((tc) => !tc.faceUp).length, 0);

  const boardRef = useRef<HTMLDivElement>(null);
  const { settleFrom } = useCardMotion(boardRef, [stock, waste, foundations, tableau], {
    key: stock,
    fresh: stock.length === FRESH_STOCK_SIZE && waste.length === 0 && foundationCount === 0,
  });
  // The originals stay in the layout while their ghost follows the pointer,
  // but are hidden so the card reads as picked up rather than duplicated.
  const draggingIds = new Set(drag?.cards.map(cardId) ?? []);

  function isSelected(target: Selection): boolean {
    if (!selected) return false;
    if (target.zone !== selected.zone) return false;
    if (selected.zone === "tableau" && target.zone === "tableau") {
      return target.pile === selected.pile && target.index >= selected.index;
    }
    return sameZone(selected, target);
  }

  function onZonePointerDown(e: React.PointerEvent, target: Selection) {
    if (locked) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const cards = getSequenceFor(target);
    gestureRef.current = { pointerId: e.pointerId, source: target, cards: cards ?? [], startX: e.clientX, startY: e.clientY, dragging: false };
  }

  function onZonePointerMove(e: React.PointerEvent) {
    const g = gestureRef.current;
    if (!g || g.pointerId !== e.pointerId) return;
    if (!g.dragging) {
      const dx = e.clientX - g.startX;
      const dy = e.clientY - g.startY;
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
      if (g.cards.length === 0) return; // not a draggable source - resolves as a tap on release
      g.dragging = true;
      setDrag({ cards: g.cards, x: e.clientX, y: e.clientY });
    } else {
      setDrag((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const zoneEl = el instanceof Element ? el.closest<HTMLElement>("[data-zone]") : null;
      setDragOverKey(zoneEl?.dataset.zoneKey ?? null);
    }
  }

  function onZonePointerUp(e: React.PointerEvent) {
    const g = gestureRef.current;
    gestureRef.current = null;
    if (!g || g.pointerId !== e.pointerId) return;

    if (g.dragging) {
      // Wherever the ghost is right now becomes the starting point of the
      // settle animation: onto the destination for a legal drop, back to
      // the source pile for an illegal one.
      const origins = new Map<string, { x: number; y: number }>();
      document.querySelectorAll<HTMLElement>("[data-ghost-id]").forEach((el) => {
        const r = el.getBoundingClientRect();
        origins.set(el.dataset.ghostId!, { x: r.left, y: r.top });
      });
      settleFrom(origins);
      setDrag(null);
      setDragOverKey(null);
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const zoneEl = el instanceof Element ? el.closest<HTMLElement>("[data-zone]") : null;
      const dest = zoneEl ? parseZoneTarget(zoneEl) : null;
      // An illegal (or missing) drop target is a no-op for game state; the
      // settle animation above is what visibly returns the cards.
      if (dest) attemptMove(g.source, dest);
      return;
    }

    // A plain tap/click - not enough movement to count as a drag.
    if (g.cards.length === 0) {
      activateZone(g.source);
      return;
    }
    const key = selectionKey(g.source);
    const last = lastTapRef.current;
    const now = performance.now();
    if (last && last.key === key && now - last.time < DOUBLE_TAP_MS) {
      lastTapRef.current = null;
      autoMoveToFoundation(g.source);
      return;
    }
    lastTapRef.current = { key, time: now };
    activateZone(g.source);
  }

  function onZonePointerCancel() {
    gestureRef.current = null;
    setDrag(null);
    setDragOverKey(null);
  }

  function onTableauKeyDown(e: React.KeyboardEvent, pile: number) {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      if (locked) return;
      const base = cursor.pile === pile ? cursor.index : tableau[pile].length - 1;
      const delta = e.key === "ArrowUp" ? -1 : 1;
      const next = Math.min(tableau[pile].length - 1, Math.max(0, base + delta));
      setCursor({ pile, index: next });
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (locked) return;
      const index = cursor.pile === pile ? cursor.index : Math.max(0, tableau[pile].length - 1);
      activateZone({ zone: "tableau", pile, index });
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      clearSelection();
    }
  }

  function onZoneKeyDown(e: React.KeyboardEvent, onActivate: () => void) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!locked) onActivate();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      clearSelection();
    }
  }

  function cardLabel(card: Card, context: string): string {
    return `${cardName(card)}, ${context}`;
  }

  return (
    <div className={`solitaire${won ? " solitaire--won" : ""}`}>
      <div className="solitaire__hud">
        <p className="fp-label solitaire__level">// Card terminal — Klondike, draw 1</p>
        <div className="solitaire__stats">
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Foundation</span>
            <span className="fp-hud-value solitaire__count" key={foundationCount}>
              {foundationCount} / 52
            </span>
          </div>
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Stock</span>
            <span className="fp-hud-value">{stock.length}</span>
          </div>
          <div className="fp-hud-tile">
            <span className="fp-hud-label">Hidden</span>
            <span className={`fp-hud-value${hiddenCount < 21 ? " fp-pop" : ""}`} key={hiddenCount}>
              {hiddenCount}
            </span>
          </div>
        </div>
      </div>

      {pendingNewGame && (
        <ConfirmPrompt
          message="Start a new game? This one will be lost."
          confirmLabel="New game"
          onConfirm={confirmNewGame}
          onCancel={cancelNewGame}
        />
      )}

      <div className="solitaire-board fp-corner-marks" ref={boardRef}>
        <div className="solitaire-row">
          <button
            type="button"
            className={`solitaire-stock${stock.length > 2 ? " solitaire-stock--deep" : stock.length === 2 ? " solitaire-stock--shallow" : ""}`}
            data-motion-origin="stock"
            onClick={stockActivate}
            disabled={locked}
            aria-label={stock.length > 0 ? `Stock, ${stock.length} cards, draw one` : "Stock empty, tap to recycle waste"}
          >
            {stock.length > 0 ? (
              <>
                <PlayingCard faceDown className="playing-card--back-lit" />
                <span className="solitaire-stock__count" aria-hidden="true">
                  {stock.length}
                </span>
              </>
            ) : (
              <div className="solitaire-slot solitaire-slot--recycle" aria-hidden="true">
                <span className="solitaire-slot__recycle-icon">&#8635;</span>
              </div>
            )}
          </button>

          <div
            className={`solitaire-waste${waste.length > 2 ? " solitaire-waste--deep" : ""} ${isSelected({ zone: "waste" }) ? "solitaire-zone--selected" : ""} ${dragOverKey === "waste" ? "solitaire-zone--drag-over" : ""}`}
            data-zone="waste"
            data-zone-key="waste"
            role="button"
            tabIndex={0}
            aria-label={waste.length > 0 ? cardLabel(waste[waste.length - 1], "waste") + (isSelected({ zone: "waste" }) ? ", selected" : "") : "Waste, empty"}
            onPointerDown={(e) => onZonePointerDown(e, { zone: "waste" })}
            onPointerMove={onZonePointerMove}
            onPointerUp={onZonePointerUp}
            onPointerCancel={onZonePointerCancel}
            onKeyDown={(e) => onZoneKeyDown(e, () => activateZone({ zone: "waste" }))}
          >
            {waste.length > 0 ? (
              <div className="solitaire-stack" aria-hidden="true">
                {waste.slice(-2).map((card, i, shown) => {
                  const isTop = i === shown.length - 1;
                  return (
                    <div
                      key={cardId(card)}
                      className={`solitaire-stack__card${isTop && draggingIds.has(cardId(card)) ? " solitaire-card--lifted" : ""}`}
                      data-card-id={cardId(card)}
                      data-face-up="true"
                      data-from-stock={isTop ? "true" : undefined}
                    >
                      <PlayingCard card={card} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="solitaire-slot" aria-hidden="true" />
            )}
          </div>

          <div className="solitaire-foundations">
            {SUITS.map((suit, i) => {
              const pile = foundations[i];
              const top = pile[pile.length - 1];
              const target: Selection = { zone: "foundation", suitIndex: i };
              return (
                <div
                  key={suit}
                  className={`solitaire-foundation ${isSelected(target) ? "solitaire-zone--selected" : ""} ${dragOverKey === `foundation-${i}` ? "solitaire-zone--drag-over" : ""}`}
                  data-zone="foundation"
                  data-suit-index={i}
                  data-zone-key={`foundation-${i}`}
                  role="button"
                  tabIndex={0}
                  aria-label={top ? cardLabel(top, "foundation") + (isSelected(target) ? ", selected" : "") : `Empty ${suitLabel(suit)} foundation`}
                  onPointerDown={(e) => onZonePointerDown(e, target)}
                  onPointerMove={onZonePointerMove}
                  onPointerUp={onZonePointerUp}
                  onPointerCancel={onZonePointerCancel}
                  onKeyDown={(e) => onZoneKeyDown(e, () => activateZone(target))}
                >
                  {top ? (
                    <div className="solitaire-stack" aria-hidden="true">
                      {pile.slice(-2).map((card, j, shown) => {
                        const isTop = j === shown.length - 1;
                        return (
                          <div
                            key={cardId(card)}
                            className={`solitaire-stack__card${isTop && draggingIds.has(cardId(card)) ? " solitaire-card--lifted" : ""}`}
                            data-card-id={cardId(card)}
                            data-face-up="true"
                            data-foundation-top={isTop ? "true" : undefined}
                          >
                            <PlayingCard card={card} />
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="solitaire-slot solitaire-slot--foundation" aria-hidden="true">
                      <span className="solitaire-slot__hint">A</span>
                      <SuitIcon suit={suit} className="solitaire-slot__suit" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="solitaire-tableau">
          {tableau.map((pile, p) => {
            const target: Selection = { zone: "tableau", pile: p, index: Math.max(0, pile.length - 1) };
            return (
              <div
                key={p}
                className="solitaire-pile"
                data-zone="tableau"
                data-pile={p}
                data-zone-key={`tableau-${p}`}
                role="group"
                tabIndex={0}
                aria-label={`Tableau pile ${p + 1}${pile.length === 0 ? ", empty" : ""}`}
                onFocus={() => setFocusedPile(p)}
                onBlur={() => setFocusedPile((prev) => (prev === p ? null : prev))}
                onKeyDown={(e) => onTableauKeyDown(e, p)}
                onPointerDown={(e) => {
                  if (pile.length === 0) onZonePointerDown(e, target);
                }}
                onPointerMove={onZonePointerMove}
                onPointerUp={(e) => {
                  if (pile.length === 0) onZonePointerUp(e);
                }}
                onPointerCancel={onZonePointerCancel}
              >
                {pile.length === 0 && (
                  <div
                    className={`solitaire-slot solitaire-slot--tableau ${isSelected(target) ? "solitaire-zone--selected" : ""} ${dragOverKey === `tableau-${p}` ? "solitaire-zone--drag-over" : ""}`}
                    aria-hidden="true"
                  >
                    <span className="solitaire-slot__hint">K</span>
                  </div>
                )}
                {pile.map((tc: TableauCardModel, i) => {
                  const cardTarget: Selection = { zone: "tableau", pile: p, index: i };
                  const selectedHere = isSelected(cardTarget);
                  const isCursor = focusedPile === p && (cursor.pile === p ? cursor.index : pile.length - 1) === i;
                  const classNames = ["solitaire-pile__card"];
                  if (selectedHere) classNames.push("solitaire-zone--selected");
                  if (isCursor) classNames.push("solitaire-pile__card--cursor");
                  if (dragOverKey === `tableau-${p}` && i === pile.length - 1) classNames.push("solitaire-zone--drag-over");
                  if (draggingIds.has(cardId(tc.card))) classNames.push("solitaire-card--lifted");
                  return (
                    <div
                      key={cardId(tc.card)}
                      className={classNames.join(" ")}
                      data-card-id={cardId(tc.card)}
                      data-face-up={tc.faceUp ? "true" : "false"}
                      // Klondike deal order: row i covers piles i..6, so
                      // earlier rows contribute 7, 6, 5... cards before it.
                      data-deal-order={i * 7 - (i * (i - 1)) / 2 + (p - i)}
                      style={{ ["--card-overlap" as string]: i === 0 ? "0px" : pile[i - 1].faceUp ? "var(--overlap-up)" : "var(--overlap-down)" }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onZonePointerDown(e, cardTarget);
                      }}
                      onPointerMove={onZonePointerMove}
                      onPointerUp={(e) => {
                        e.stopPropagation();
                        onZonePointerUp(e);
                      }}
                      onPointerCancel={onZonePointerCancel}
                    >
                      <div aria-hidden="true">
                        <PlayingCard card={tc.card} faceDown={!tc.faceUp} />
                      </div>
                    </div>
                  );
                })}
                {/* Screen-reader-only description of the actual top card, since
                    every visible card above carries aria-hidden (the pile's own
                    group label plus this cursor description is the accessible
                    surface, not each stacked card). */}
                <span className="solitaire-sr-only">
                  {pile.length > 0 &&
                    (() => {
                      const idx = cursor.pile === p ? cursor.index : pile.length - 1;
                      const tc = pile[idx];
                      return tc.faceUp ? cardLabel(tc.card, `position ${idx + 1} of pile ${p + 1}`) : `Face-down card, position ${idx + 1} of pile ${p + 1}`;
                    })()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {drag && (
        <div className="solitaire-drag-ghost" style={{ left: drag.x, top: drag.y }} aria-hidden="true">
          {drag.cards.map((card, i) => (
            <div key={cardId(card)} className="solitaire-drag-ghost__card" data-ghost-id={cardId(card)} style={{ top: `calc(${i} * var(--overlap-up))` }}>
              <PlayingCard card={card} />
            </div>
          ))}
        </div>
      )}

      <div className="fp-controls">
        <button type="button" className="fp-btn fp-btn--secondary" onClick={undo} disabled={!canUndo || locked}>
          Undo
        </button>
        <button type="button" className="fp-btn fp-btn--secondary" onClick={requestNewGame} disabled={locked}>
          New game
        </button>
      </div>

      {won && (
        <div className="solitaire__result fp-bg-accent--success" role="alert">
          <p className="fp-result-title fp-result-title--success">Deck cleared</p>
          <p className="fp-result-detail">All foundations complete</p>
          <button type="button" className="fp-btn fp-btn--success" onClick={requestNewGame}>
            New game
          </button>
        </div>
      )}
    </div>
  );
}
