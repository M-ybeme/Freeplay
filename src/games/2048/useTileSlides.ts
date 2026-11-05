import { useLayoutEffect, useRef, type RefObject } from "react";
import { BOARD_SIZE, moveBoard, traceMove, type Board, type Direction } from "./logic";

export const SLIDE_MS = 110;
const DIRECTIONS: Direction[] = ["left", "right", "up", "down"];

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Which direction turns `prev` into `next` (ignoring the one tile spawned
 * afterwards), or null for anything that is not a single move - undo, a new
 * game, a restored run. Key handling lives inside use2048, so the
 * component infers the move from the boards rather than being told.
 */
function inferDirection(prev: Board, next: Board, spawned: [number, number] | null): Direction | null {
  const withoutSpawn = next.map((row) => row.slice());
  if (spawned) withoutSpawn[spawned[0]][spawned[1]] = 0;
  for (const dir of DIRECTIONS) {
    const result = moveBoard(prev, dir);
    if (!result.changed) continue;
    let same = true;
    for (let r = 0; r < BOARD_SIZE && same; r++) {
      for (let c = 0; c < BOARD_SIZE; c++) {
        if (result.board[r][c] !== withoutSpawn[r][c]) {
          same = false;
          break;
        }
      }
    }
    if (same) return dir;
  }
  return null;
}

/**
 * Slides tiles to where they landed after each move (FLIP via the Web
 * Animations API). Tiles that merge travel as two short-lived ghost tiles
 * carrying their old value, and the merged tile appears once they arrive;
 * the merge pulse and spawn pop are CSS, delayed to match SLIDE_MS.
 */
export function useTileSlides(
  boardRef: RefObject<HTMLElement | null>,
  board: Board,
  spawned: [number, number] | null,
  tileClassFor: (value: number) => string,
) {
  const previous = useRef<Board | null>(null);

  useLayoutEffect(() => {
    const prev = previous.current;
    previous.current = board;
    const root = boardRef.current;
    if (!prev || prev === board || !root || prefersReducedMotion()) return;

    const dir = inferDirection(prev, board, spawned);
    if (!dir) return;

    const cellAt = (r: number, c: number) => root.querySelector<HTMLElement>(`[data-cell="${r}-${c}"]`);
    const origin = cellAt(0, 0);
    const right = cellAt(0, 1);
    const below = cellAt(1, 0);
    if (!origin || !right || !below) return;
    const pitchX = right.offsetLeft - origin.offsetLeft;
    const pitchY = below.offsetTop - origin.offsetTop;
    const options: KeyframeAnimationOptions = { duration: SLIDE_MS, easing: "cubic-bezier(0.3, 0.7, 0.4, 1)" };

    for (const slide of traceMove(prev, dir)) {
      const [fr, fc] = slide.from;
      const [tr, tc] = slide.to;
      const dx = (fc - tc) * pitchX;
      const dy = (fr - tr) * pitchY;

      if (!slide.merging) {
        if (dx === 0 && dy === 0) continue;
        cellAt(tr, tc)?.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: "none" }], options);
        continue;
      }

      // Merging: a ghost carrying the *old* value travels in its place.
      const source = cellAt(fr, fc);
      if (!source) continue;
      const value = prev[fr][fc];
      const ghost = document.createElement("div");
      ghost.className = `${tileClassFor(value)} game2048-ghost`;
      ghost.textContent = String(value);
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, {
        left: `${source.offsetLeft}px`,
        top: `${source.offsetTop}px`,
        width: `${source.offsetWidth}px`,
        height: `${source.offsetHeight}px`,
      });
      root.appendChild(ghost);
      const anim = ghost.animate([{ transform: "none" }, { transform: `translate(${-dx}px, ${-dy}px)` }], {
        ...options,
        fill: "forwards",
      });
      const remove = () => ghost.remove();
      anim.addEventListener("finish", remove);
      anim.addEventListener("cancel", remove);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board]);
}
