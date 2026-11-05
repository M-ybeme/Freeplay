import { useLayoutEffect, useRef, type RefObject } from "react";

type Rack = readonly (readonly number[])[];

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Pour motion for the Color Sort rack (Web Animations API, so reduced
 * motion is checked here - the global CSS rule can't reach it):
 *
 * - A single pour (one tube shrank, one grew) tips the source tube toward
 *   the target, and the segments that arrived drop into the target from
 *   above, one after another. Undo is the same shape in reverse, so it
 *   animates too.
 * - Any bigger change (new puzzle, restart, difficulty) refills every tube,
 *   segment by segment, left to right.
 *
 * Slots render bottom-first (column-reverse), so segment j of a tube is
 * the j-th `.color-sort-slot` in DOM order.
 */
export function usePourMotion(rackRef: RefObject<HTMLElement | null>, board: Rack) {
  const previous = useRef<Rack | null>(null);

  useLayoutEffect(() => {
    const prev = previous.current;
    previous.current = board;
    const rack = rackRef.current;
    if (!prev || prev === board || !rack || prefersReducedMotion()) return;

    const slotsOf = (tube: number) =>
      Array.from(rack.querySelectorAll<HTMLElement>(`[data-tube="${tube}"] .color-sort-slot`));
    const tubeEl = (tube: number) => rack.querySelector<HTMLElement>(`[data-tube="${tube}"] .color-sort-tube`);

    const changed = board.map((_, i) => i).filter((i) => prev[i]?.length !== board[i].length);
    const grew = changed.filter((i) => board[i].length > (prev[i]?.length ?? 0));
    const shrank = changed.filter((i) => board[i].length < (prev[i]?.length ?? 0));

    if (prev.length === board.length && grew.length === 1 && shrank.length === 1) {
      const [to] = grew;
      const [from] = shrank;
      const lean = to > from ? 12 : -12;
      tubeEl(from)?.animate(
        [{ transform: "rotate(0deg)" }, { transform: `translateY(-6px) rotate(${lean}deg)` }, { transform: "rotate(0deg)" }],
        { duration: 300, easing: "ease-in-out" },
      );
      const slots = slotsOf(to);
      for (let j = prev[to].length; j < board[to].length; j++) {
        slots[j]?.animate(
          [
            { transform: "translateY(-140%)", opacity: 0 },
            { transform: "none", opacity: 1 },
          ],
          { duration: 220, delay: 90 + (j - prev[to].length) * 60, easing: "cubic-bezier(0.34, 1.4, 0.64, 1)", fill: "backwards" },
        );
      }
      return;
    }

    // A whole new arrangement: fill every tube from the bottom up.
    board.forEach((tube, i) => {
      const slots = slotsOf(i);
      tube.forEach((_, j) => {
        slots[j]?.animate(
          [
            { transform: "translateY(-60%) scaleY(0.4)", opacity: 0 },
            { transform: "none", opacity: 1 },
          ],
          { duration: 240, delay: i * 45 + j * 35, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "backwards" },
        );
      });
    });
  }, [board, rackRef]);
}
