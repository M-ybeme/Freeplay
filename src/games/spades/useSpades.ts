import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Card } from "../../components/PlayingCard/types";
import { useGameStorage } from "../../hooks/useGameStorage";
import { readJSON, writeJSON } from "../../services/storage/localStorage";
import { chooseBid, choosePlay } from "./ai";
import {
  DEFAULT_TARGET,
  TARGETS,
  applyBid,
  applyPlay,
  collectTrick,
  finishHand,
  isSavedMatch,
  newMatch,
  nextHand,
  shuffledDeck,
  type Bid,
  type MatchState,
  type Seat,
  type Target,
} from "./logic";

/** Pause before a computer player bids or plays, so each turn reads. */
export const AI_DELAY_MS = 650;
/** How long a finished trick stays on the table before it's swept up. */
export const TRICK_PAUSE_MS = 1100;
/** Reduced motion: keep the game moving, without the lingering. */
const REDUCED_AI_DELAY_MS = 250;
const REDUCED_TRICK_PAUSE_MS = 500;

/** The person always sits South. */
export const YOU: Seat = 0;

const MATCH_KEY = "freeplay:spades:match";

export type Action =
  | { type: "new-match"; target: Target; deck: Card[] }
  | { type: "bid"; seat: Seat; bid: Bid }
  | { type: "play"; seat: Seat; card: Card }
  | { type: "collect" }
  | { type: "next-hand"; deck: Card[] };

export function reducer(match: MatchState, action: Action): MatchState {
  switch (action.type) {
    case "new-match":
      return newMatch(action.target, action.deck);
    case "bid": {
      const hand = applyBid(match.hand, action.seat, action.bid);
      return hand === match.hand ? match : { ...match, hand };
    }
    case "play": {
      const hand = applyPlay(match.hand, action.seat, action.card);
      return hand === match.hand ? match : { ...match, hand };
    }
    case "collect": {
      const hand = collectTrick(match.hand);
      if (hand === match.hand) return match;
      const next = { ...match, hand };
      return hand.phase === "hand-over" ? finishHand(next) : next;
    }
    case "next-hand":
      return nextHand(match, action.deck);
  }
}

export interface SpadesRecord {
  wins: number;
  losses: number;
}

function validTarget(value: unknown): Target {
  return TARGETS.includes(value as Target) ? (value as Target) : DEFAULT_TARGET;
}

/** True once this match holds anything worth asking about before throwing it away. */
function hasProgress(match: MatchState): boolean {
  return match.status === "playing" && (match.handNumber > 1 || match.hand.bids[YOU] !== null);
}

export function useSpades() {
  const [targetPref, setTargetPref] = useGameStorage<Target>("spades", "target", DEFAULT_TARGET);
  const [record, setRecord] = useGameStorage<SpadesRecord>("spades", "record", { wins: 0, losses: 0 });
  const [match, dispatch] = useReducer(reducer, null, () => {
    // A refresh resumes the match in progress; a finished one starts fresh.
    const saved = readJSON<unknown>(MATCH_KEY, null);
    return isSavedMatch(saved) && saved.status === "playing" ? saved : newMatch(validTarget(targetPref), shuffledDeck());
  });
  const [pendingTarget, setPendingTarget] = useState<Target | null>(null);

  const reducedMotion = useMemo(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches, []);
  const aiDelay = reducedMotion ? REDUCED_AI_DELAY_MS : AI_DELAY_MS;
  const trickPause = reducedMotion ? REDUCED_TRICK_PAUSE_MS : TRICK_PAUSE_MS;

  // Save every change, so leaving mid-hand loses nothing.
  useEffect(() => {
    writeJSON(MATCH_KEY, match);
  }, [match]);

  // Count each finished match once: only on the change from playing.
  const lastStatus = useRef(match.status);
  useEffect(() => {
    if (lastStatus.current === "playing" && match.status !== "playing") {
      setRecord(match.status === "won" ? { ...record, wins: record.wins + 1 } : { ...record, losses: record.losses + 1 });
    }
    lastStatus.current = match.status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.status]);

  // The computer players' turns, and sweeping up finished tricks.
  useEffect(() => {
    const hand = match.hand;
    if (match.status !== "playing") return;
    let action: Action | null = null;
    let delay = aiDelay;
    if (hand.phase === "trick-complete") {
      action = { type: "collect" };
      delay = trickPause;
    } else if (hand.turn !== YOU && hand.phase === "bidding") {
      action = { type: "bid", seat: hand.turn, bid: chooseBid(hand, hand.turn) };
    } else if (hand.turn !== YOU && hand.phase === "playing") {
      action = { type: "play", seat: hand.turn, card: choosePlay(hand, hand.turn) };
    }
    if (!action) return;
    const next = action;
    const id = window.setTimeout(() => dispatch(next), delay);
    return () => window.clearTimeout(id);
  }, [match, aiDelay, trickPause]);

  function startMatch(target: Target) {
    setTargetPref(target);
    setPendingTarget(null);
    dispatch({ type: "new-match", target, deck: shuffledDeck() });
  }

  /** New game (same target), or a target change: asks first once there's progress. */
  function requestNewMatch(target: Target = match.target) {
    if (hasProgress(match)) setPendingTarget(target);
    else startMatch(target);
  }

  return {
    match,
    record,
    pendingTarget,
    bid: (bid: Bid) => dispatch({ type: "bid", seat: YOU, bid }),
    play: (card: Card) => dispatch({ type: "play", seat: YOU, card }),
    nextHand: () => dispatch({ type: "next-hand", deck: shuffledDeck() }),
    requestNewMatch,
    confirmNewMatch: () => pendingTarget !== null && startMatch(pendingTarget),
    cancelNewMatch: () => setPendingTarget(null),
  };
}
