import { useEffect, useReducer, useRef } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import {
  INITIAL_STATS,
  applyOutcomeToStats,
  createInitialRound,
  reducer,
  scoreHand,
  type BlackjackStats,
} from "./logic";

const REVEAL_DELAY_MS = 500;
const DRAW_DELAY_MS = 600;

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function useBlackjack() {
  const [stats, setStats] = useGameStorage<BlackjackStats>("blackjack", "stats", INITIAL_STATS);
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialRound());

  // Pacing: the hidden card reveals, then (if needed) the dealer draws one
  // card at a time with a short delay between each — enough to visually
  // follow, not a theatrical casino animation. Reduced motion collapses
  // both delays to effectively immediate.
  useEffect(() => {
    if (state.status !== "dealer-reveal") return;
    const delay = prefersReducedMotion() ? 0 : REVEAL_DELAY_MS;
    const id = window.setTimeout(() => dispatch({ type: "reveal" }), delay);
    return () => window.clearTimeout(id);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "dealer-turn") return;
    const delay = prefersReducedMotion() ? 0 : DRAW_DELAY_MS;
    const id = window.setTimeout(() => dispatch({ type: "dealer-draw" }), delay);
    return () => window.clearTimeout(id);
    // Re-fires after each new dealer card (dealerHand.length changes) so the
    // draw loop continues; the reducer itself decides when to stop.
  }, [state.status, state.dealerHand.length]);

  // Update lifetime stats exactly once per resolved round. Tracking by
  // outcome *value* would wrongly skip a second round in a row that
  // happens to resolve the same way (e.g. two player-win rounds), so the
  // flag instead resets the moment a new round leaves round-over, and
  // guards only against this exact round-over episode re-firing (e.g.
  // Strict Mode's mount-cleanup-remount).
  const alreadyCounted = useRef(false);
  useEffect(() => {
    if (state.status !== "round-over") {
      alreadyCounted.current = false;
      return;
    }
    if (!state.outcome || alreadyCounted.current) return;
    alreadyCounted.current = true;
    setStats(applyOutcomeToStats(stats, state.outcome));
    // Re-firing once more after setStats's own re-render is harmless: the
    // ref guard above makes re-entry a no-op.
  }, [state.status, state.outcome, stats, setStats]);

  return {
    ...state,
    stats,
    playerScore: scoreHand(state.playerHand),
    dealerScore: scoreHand(state.dealerHand),
    hit: () => dispatch({ type: "hit" }),
    stand: () => dispatch({ type: "stand" }),
    deal: () => dispatch({ type: "deal" }),
  };
}
