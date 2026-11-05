/*
 * Shared by the head-to-head board games (Reversi, Chess): who controls
 * each side, and the per-level win/loss/draw record for 1-player games.
 *
 * The rules in each game never know who is playing. This table is the
 * only place 1-player and 2-player differ. Solo: the person plays the
 * side that moves first, the computer plays the other. Duo: two people
 * share the device.
 */

export type Mode = "solo" | "duo";
export type Controller = "person" | "computer";

export function controllerFor<Side>(mode: Mode, side: Side, computerSide: Side): Controller {
  return mode === "solo" && side === computerSide ? "computer" : "person";
}

/** Pause before the computer moves, so its reply reads as a turn. */
export const COMPUTER_DELAY_MS = 550;

export interface MatchRecord {
  wins: number;
  losses: number;
  draws: number;
}

export const EMPTY_RECORD: MatchRecord = { wins: 0, losses: 0, draws: 0 };

export function addResult(record: MatchRecord, outcome: "win" | "loss" | "draw"): MatchRecord {
  if (outcome === "win") return { ...record, wins: record.wins + 1 };
  if (outcome === "loss") return { ...record, losses: record.losses + 1 };
  return { ...record, draws: record.draws + 1 };
}
