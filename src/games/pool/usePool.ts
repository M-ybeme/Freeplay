import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import { readJSON, writeJSON } from "../../services/storage/localStorage";
import { planShot, type ShotPlan } from "./ai";
import {
  DEFAULT_LEVEL,
  LEVELS,
  isSavedMatch,
  legalTargets,
  newMatch,
  nextRack,
  placeCue,
  resolveShot,
  scoreRack,
  shotWorld,
  type Level,
  type MatchState,
  type Mode,
  type Player,
  type RackState,
} from "./logic";
import { type Spin, type World, MAX_SHOT_TIME, cloneWorld, nextDt, simulate, step } from "./physics";

/** The computer "studies the table" before its shot... */
export const CPU_THINK_MS = 700;
/** ...then shows its aim for this long before it strikes. */
export const CPU_AIM_MS = 900;
const REDUCED_CPU_THINK_MS = 300;
const REDUCED_CPU_AIM_MS = 400;

const MATCH_KEY = "freeplay:pool:match";

type Action =
  | { type: "new-match"; mode: Mode; seed: number }
  | { type: "place"; x: number; y: number }
  | { type: "settle"; rack: RackState }
  | { type: "next-rack"; seed: number };

function reducer(match: MatchState, action: Action): MatchState {
  switch (action.type) {
    case "new-match":
      return newMatch(action.mode, action.seed);
    case "place": {
      const rack = placeCue(match.rack, action.x, action.y);
      return rack === match.rack ? match : { ...match, rack };
    }
    case "settle": {
      const next = { ...match, rack: action.rack };
      return action.rack.phase === "over" ? scoreRack(next) : next;
    }
    case "next-rack":
      return nextRack(match, action.seed);
  }
}

export interface PoolRecord {
  wins: number;
  losses: number;
}

const newSeed = () => Math.floor(Math.random() * 2 ** 31);

/** The default aim: straight at the nearest ball you may hit. */
export function defaultAim(rack: RackState): number {
  const cue = rack.balls[0];
  let best = 0;
  let bestD = Infinity;
  for (const id of legalTargets(rack)) {
    const b = rack.balls[id];
    const d = Math.hypot(b.x - cue.x, b.y - cue.y);
    if (d < bestD) {
      bestD = d;
      best = Math.atan2(b.y - cue.y, b.x - cue.x);
    }
  }
  return best;
}

/** Is it the computer's turn? */
export const cpuTurn = (match: MatchState) => match.mode === "solo" && match.rack.turn === 1 && match.rack.phase !== "over";

function hasProgress(match: MatchState): boolean {
  return match.rackNumber > 1 || match.rack.phase !== "break";
}

export function usePool() {
  const [modePref, setModePref] = useGameStorage<Mode>("pool", "mode", "solo");
  const [levelPref, setLevelPref] = useGameStorage<Level>("pool", "level", DEFAULT_LEVEL);
  const [record, setRecord] = useGameStorage<PoolRecord>("pool", "record", { wins: 0, losses: 0 });
  const level: Level = LEVELS.includes(levelPref) ? levelPref : DEFAULT_LEVEL;
  const [match, dispatch] = useReducer(reducer, null, () => {
    const saved = readJSON<unknown>(MATCH_KEY, null);
    return isSavedMatch(saved) ? saved : newMatch(modePref === "duo" ? "duo" : "solo", newSeed());
  });
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);

  /** The shot being played out on screen, if any. Drawn from this ref every frame. */
  const live = useRef<World | null>(null);
  const [rolling, setRolling] = useState(false);
  /** The settled result of the shot in flight, committed when the animation ends. */
  const pending = useRef<{ rack: RackState; shooter: Player } | null>(null);
  /** The computer's aim while it lines up, for drawing. */
  const [cpuPlan, setCpuPlan] = useState<ShotPlan | null>(null);

  const reducedMotion = useRef(window.matchMedia("(prefers-reduced-motion: reduce)").matches).current;

  // Save every settled table (a shot in flight is saved as its result).
  useEffect(() => {
    if (!pending.current) writeJSON(MATCH_KEY, match);
  }, [match]);

  const settle = useCallback(() => {
    const p = pending.current;
    if (!p) return;
    pending.current = null;
    live.current = null;
    setRolling(false);
    dispatch({ type: "settle", rack: p.rack });
  }, []);

  // A finished rack against the computer counts once, when it settles.
  const lastPhase = useRef(match.rack.phase);
  useEffect(() => {
    if (lastPhase.current !== "over" && match.rack.phase === "over" && match.mode === "solo") {
      setRecord(match.rack.winner === 0 ? { ...record, wins: record.wins + 1 } : { ...record, losses: record.losses + 1 });
    }
    lastPhase.current = match.rack.phase;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.rack.phase]);

  /** Strike: the result is worked out at once (and saved), then played out on screen. */
  const shoot = useCallback(
    (angle: number, power: number, spin: Spin, called: number | null) => {
      if (live.current || match.rack.phase === "over") return;
      const start = shotWorld(match.rack, angle, power, spin);
      const end = simulate(cloneWorld(start));
      const rack = resolveShot(match.rack, end.balls, end.log, called, newSeed());
      pending.current = { rack, shooter: match.rack.turn };
      writeJSON(MATCH_KEY, { ...match, rack });
      live.current = start;
      setRolling(true);
    },
    [match],
  );

  // Play the shot out in real time, with exactly the steps the result used.
  useEffect(() => {
    if (!rolling) return;
    let last = performance.now();
    let id = requestAnimationFrame(function frame(now) {
      const w = live.current;
      if (!w) return;
      // A slow frame still advances the shot in real time (up to a tenth of a second),
      // and a shot never plays on past the physics' own time limit.
      const target = w.time + Math.min(0.1, Math.max(0, now - last) / 1000);
      last = now;
      let moving = true;
      while (moving && w.time < target) moving = step(w, nextDt(w));
      if (moving && w.time < MAX_SHOT_TIME) id = requestAnimationFrame(frame);
      else settle();
    });
    return () => cancelAnimationFrame(id);
  }, [rolling, settle]);

  // The computer's turn: think, then place the cue ball and show its aim.
  useEffect(() => {
    if (rolling || !cpuTurn(match)) return;
    const think = reducedMotion ? REDUCED_CPU_THINK_MS : CPU_THINK_MS;
    const id = window.setTimeout(() => {
      const plan = planShot(match.rack, level, newSeed());
      if (plan.place && match.rack.ballInHand) dispatch({ type: "place", x: plan.place.x, y: plan.place.y });
      setCpuPlan(plan);
    }, think);
    return () => window.clearTimeout(id);
    // Only a new table (or a change of who's shooting) restarts the computer's turn.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.rack.turn, match.rack.last, match.rack.phase, match.mode, rolling]);

  // When the computer's aim is up (and the cue ball placed), strike after the pause.
  useEffect(() => {
    if (!cpuPlan || rolling) return;
    const aim = reducedMotion ? REDUCED_CPU_AIM_MS : CPU_AIM_MS;
    const id = window.setTimeout(() => {
      shoot(cpuPlan.angle, cpuPlan.power, cpuPlan.spin, cpuPlan.called);
      setCpuPlan(null);
    }, aim);
    return () => window.clearTimeout(id);
  }, [cpuPlan, rolling, shoot, reducedMotion]);

  function startMatch(mode: Mode) {
    setModePref(mode);
    setPendingMode(null);
    setCpuPlan(null);
    pending.current = null;
    live.current = null;
    setRolling(false);
    dispatch({ type: "new-match", mode, seed: newSeed() });
  }

  /** New game, or a mode change: asks first once a rack is under way. */
  function requestNewMatch(mode: Mode = match.mode) {
    if (hasProgress(match)) setPendingMode(mode);
    else startMatch(mode);
  }

  return {
    match,
    level,
    record,
    pendingMode,
    live,
    rolling,
    cpuPlan,
    shoot,
    /** Finish the shot on screen now. */
    skip: settle,
    place: (x: number, y: number) => dispatch({ type: "place", x, y }),
    nextRack: () => dispatch({ type: "next-rack", seed: newSeed() }),
    setLevel: (l: Level) => setLevelPref(l),
    requestNewMatch,
    confirmNewMatch: () => pendingMode !== null && startMatch(pendingMode),
    cancelNewMatch: () => setPendingMode(null),
  };
}
