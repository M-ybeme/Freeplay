import { useEffect, useState, type RefObject } from "react";
import { ATTRACT_DWELL_MS, ATTRACT_IDLE_MS, advance, startRun, type AttractRun } from "./attract";

/** Any of these means someone is at the machines: the spotlight stops. */
const ACTIVITY_EVENTS = ["pointermove", "pointerdown", "keydown", "wheel", "scroll", "touchstart"] as const;

/**
 * Which cabinet in `gridRef`'s children is awake, or null. Starts after
 * ATTRACT_IDLE_MS without input, moves on every ATTRACT_DWELL_MS, rests
 * after ATTRACT_ROUNDS rounds, and stops on any input. Never runs with
 * reduced motion or while the tab is hidden, and only wakes cabinets that
 * are mostly on screen.
 */
export function useAttract(gridRef: RefObject<HTMLElement | null>, count: number): number | null {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || count === 0) return;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cards = Array.from(grid.children);
    const visible = new Set<number>();
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(
            (entries) => {
              for (const e of entries) {
                const i = cards.indexOf(e.target);
                if (e.intersectionRatio >= 0.6) visible.add(i);
                else visible.delete(i);
              }
            },
            { threshold: [0, 0.6, 1] },
          );
    if (observer) cards.forEach((c) => observer.observe(c));
    else cards.forEach((_, i) => visible.add(i));

    let timer: number | undefined;
    let run: AttractRun | null = null;

    function clear() {
      if (timer !== undefined) window.clearTimeout(timer);
      timer = undefined;
    }

    function step() {
      run = advance(run ?? startRun(count), count, (i) => visible.has(i));
      if (!run) {
        // Rest until the next interaction re-arms the idle timer.
        setActive(null);
        timer = undefined;
        return;
      }
      setActive(run.current);
      timer = window.setTimeout(step, ATTRACT_DWELL_MS);
    }

    function schedule() {
      if (motion.matches || document.hidden) return;
      timer = window.setTimeout(step, ATTRACT_IDLE_MS);
    }

    function arm() {
      clear();
      run = null;
      setActive(null);
      schedule();
    }

    const opts = { passive: true, capture: true } as const;
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, arm, opts));
    document.addEventListener("visibilitychange", arm);
    motion.addEventListener("change", arm);
    schedule();

    return () => {
      clear();
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, arm, opts));
      document.removeEventListener("visibilitychange", arm);
      motion.removeEventListener("change", arm);
      observer?.disconnect();
    };
  }, [gridRef, count]);

  return active;
}
