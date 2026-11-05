import { useCallback, useLayoutEffect, useRef, useState, type DependencyList, type RefObject } from "react";

/*
 * Card motion for the Solitaire board, done FLIP-style (First, Last,
 * Invert, Play) on top of React's normal render:
 *
 *   - Every rendered card wrapper carries `data-card-id` (rank-suit, unique
 *     per deck) and `data-face-up`. After each layout change we measure
 *     every card, compare against where that same id was last time, and
 *     play a transform from the old spot back to "no transform" — so cards
 *     glide between piles even though React unmounts/remounts them there.
 *   - A card that was face-down last time and is face-up now gets a flip.
 *   - A brand-new waste card (no previous position) flies out of the stock.
 *   - On a fresh deal, tableau cards fly out of the stock in dealing order.
 *   - `settleFrom` lets a drag drop override the starting point with where
 *     the drag ghost actually was, so a dropped card continues from under
 *     the pointer (legal drop) or springs back from it (illegal drop).
 *
 * Everything here uses the Web
 * Animations API, which the global prefers-reduced-motion CSS rule can't
 * reach — so reduced motion is checked explicitly and skips it all.
 */

const FLY_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";
const FLIP_MS = 220;
const DEAL_STAGGER_MS = 22;
const DEAL_FLY_MS = 300;

interface Snapshot {
  x: number;
  y: number;
  faceUp: boolean;
}

interface Point {
  x: number;
  y: number;
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Layout position relative to the board (which is position: relative, so
 * the offsetParent chain stops there), deliberately *ignoring* transforms
 * (offsetLeft/Top rather than getBoundingClientRect). Cards are often
 * measured while one of our own animations is still moving them — a
 * second effect pass, or a move made mid-flight — and a transformed
 * reading would be stored as where the card "was", making the next change
 * fly cards in from a stale spot. Board-relative (not page) coordinates
 * mean things that shift the whole board — scrolling, the new-game
 * confirm panel opening above it — don't read as every card moving.
 */
function boardPoint(el: HTMLElement, board: HTMLElement): Point {
  let x = 0;
  let y = 0;
  for (let n: HTMLElement | null = el; n && n !== board; n = n.offsetParent as HTMLElement | null) {
    x += n.offsetLeft;
    y += n.offsetTop;
  }
  return { x, y };
}

function flyDuration(dx: number, dy: number): number {
  return Math.min(340, 170 + Math.hypot(dx, dy) * 0.3);
}

/** Lift the card above its neighbours for the length of a flight. */
function fly(el: HTMLElement, dx: number, dy: number, duration: number, delay = 0): Animation {
  el.classList.add("solitaire-card--in-flight");
  const anim = el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "translate(0, 0)" }], {
    duration,
    delay,
    easing: FLY_EASING,
    fill: "backwards",
  });
  const done = () => el.classList.remove("solitaire-card--in-flight");
  anim.addEventListener("finish", done);
  anim.addEventListener("cancel", done);
  return anim;
}

function flip(el: HTMLElement, delay: number) {
  const face = el.querySelector<HTMLElement>(".playing-card");
  if (!face) return;
  face.animate(
    [
      { transform: "perspective(600px) rotateY(90deg)", filter: "brightness(1.4)" },
      { transform: "perspective(600px) rotateY(0deg)", filter: "brightness(1)" },
    ],
    { duration: FLIP_MS, delay, easing: "ease-out", fill: "backwards" },
  );
}

function pulseFoundation(el: HTMLElement, delay: number) {
  const zone = el.closest<HTMLElement>(".solitaire-foundation");
  if (!zone) return;
  zone.animate(
    [
      { boxShadow: "0 0 0 0 rgba(140, 255, 0, 0.75)", transform: "scale(1.06)" },
      { boxShadow: "0 0 0 10px rgba(140, 255, 0, 0)", transform: "scale(1)" },
    ],
    { duration: 480, delay, easing: "ease-out" },
  );
}

export function shakeCards(board: HTMLElement | null, ids: string[]) {
  if (!board || prefersReducedMotion()) return;
  for (const id of ids) {
    const el = board.querySelector<HTMLElement>(`[data-card-id="${id}"]`);
    el?.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-4px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(-2px)" },
        { transform: "translateX(0)" },
      ],
      { duration: 260, easing: "ease-in-out" },
    );
  }
}

/**
 * `deal.key` identifies one dealt layout (the stock array works: every new
 * deal creates a new one, while undo restores a previously-seen one), and
 * `deal.fresh` says the board is in its just-dealt shape. A deal animation
 * plays only the first time a fresh-shaped key is seen, so undoing back to
 * the opening position doesn't replay it.
 */
export function useCardMotion(boardRef: RefObject<HTMLElement | null>, deps: DependencyList, deal: { key: object; fresh: boolean }) {
  const seenDeals = useRef(new WeakSet<object>());
  const previous = useRef<Map<string, Snapshot>>(new Map());
  const overrides = useRef<Map<string, Point> | null>(null);
  const [settleTick, setSettleTick] = useState(0);

  const boardWidth = useRef(0);

  /** `origins` are viewport (client) positions, e.g. from getBoundingClientRect on the drag ghost. */
  const settleFrom = useCallback((origins: Map<string, Point>) => {
    overrides.current = origins;
    setSettleTick((t) => t + 1);
  }, []);

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    const els = Array.from(board.querySelectorAll<HTMLElement>("[data-card-id]"));
    const next = new Map<string, Snapshot>();
    for (const el of els) {
      next.set(el.dataset.cardId!, { ...boardPoint(el, board), faceUp: el.dataset.faceUp === "true" });
    }
    // A resize changes every card's position at once; that's not a move.
    const resized = boardWidth.current !== 0 && boardWidth.current !== board.offsetWidth;
    boardWidth.current = board.offsetWidth;
    const before = resized ? new Map<string, Snapshot>() : previous.current;
    const boardBox = board.getBoundingClientRect();
    const origins = overrides.current
      ? new Map(
          Array.from(overrides.current, ([id, p]) => [id, { x: p.x - boardBox.left - board.clientLeft, y: p.y - boardBox.top - board.clientTop }] as const),
        )
      : null;
    const isNewDeal = deal.fresh && !seenDeals.current.has(deal.key);
    seenDeals.current.add(deal.key);
    previous.current = next;
    overrides.current = null;

    if (prefersReducedMotion()) return;

    const stockEl = board.querySelector<HTMLElement>("[data-motion-origin='stock']");
    const stock = stockEl ? boardPoint(stockEl, board) : null;

    if (isNewDeal && stock) {
      // Tableau cards fly out of the stock in the order a person would
      // deal them: across the row, then down.
      for (const el of els) {
        const order = el.dataset.dealOrder;
        if (order === undefined) continue;
        const now = next.get(el.dataset.cardId!)!;
        const delay = Number(order) * DEAL_STAGGER_MS;
        fly(el, stock.x - now.x, stock.y - now.y, DEAL_FLY_MS, delay);
        if (now.faceUp) flip(el, delay + DEAL_FLY_MS * 0.6);
      }
      return;
    }

    for (const el of els) {
      const id = el.dataset.cardId!;
      const now = next.get(id)!;
      const old = before.get(id);
      let from: Point | undefined = origins?.get(id) ?? old;
      let turnedUp = old ? !old.faceUp && now.faceUp : false;
      if (!old && !from && el.dataset.fromStock === "true" && stock) {
        from = stock;
        turnedUp = true;
      }

      let landAt = 0;
      if (from) {
        const dx = from.x - now.x;
        const dy = from.y - now.y;
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          landAt = flyDuration(dx, dy);
          fly(el, dx, dy, landAt);
          if (el.dataset.foundationTop === "true") pulseFoundation(el, landAt * 0.8);
        }
      }
      if (turnedUp) flip(el, landAt * 0.5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, settleTick]);

  return { settleFrom };
}
