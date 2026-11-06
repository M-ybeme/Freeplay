import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ConfirmPrompt } from "../../components/ConfirmPrompt/ConfirmPrompt";
import { ballColor, isStripe } from "./colors";
import {
  canPlaceCue,
  onTheEight,
  remaining,
  type Foul,
  type Group,
  type Level,
  type LossReason,
  type MatchState,
  type Mode,
  type Player,
  type RackState,
} from "./logic";
import { type Spin, BALL_R, POCKETS, TABLE_H, TABLE_W } from "./physics";
import { PoolTable } from "./PoolTable";
import { cpuTurn, defaultAim, usePool } from "./usePool";
import "./Pool.css";

const NAMES: Record<Mode, [string, string]> = { solo: ["You", "CPU"], duo: ["Player 1", "Player 2"] };
const FOUL_TEXT: Record<Foul, string> = {
  scratch: "Scratch",
  "no-hit": "Missed every ball",
  "wrong-ball": "Hit the wrong ball first",
  "no-rail": "No ball reached a cushion",
  "weak-break": "Weak break",
};
const LOSS_TEXT: Record<LossReason, string> = {
  "eight-early": "The 8 went down early.",
  "eight-scratch": "Scratched on the 8.",
  "eight-wrong-pocket": "The 8 went in the wrong pocket.",
  "eight-foul": "Fouled on the 8.",
};
const LEVEL_NAME = (l: Level) => (l <= 2 ? "Rookie" : l <= 4 ? "Casual" : l <= 6 ? "Regular" : l <= 8 ? "Hustler" : "Shark");

/** A pocket's name as it appears on screen. */
function pocketName(i: number, vertical: boolean): string {
  const p = POCKETS[i];
  if (!vertical) {
    const v = p.y === 0 ? "top" : "bottom";
    return p.x === TABLE_W / 2 ? `${v} side` : `${v}-${p.x === 0 ? "left" : "right"}`;
  }
  const h = p.y === 0 ? "left" : "right";
  return p.x === TABLE_W / 2 ? `${h} side` : `${p.x === 0 ? "bottom" : "top"}-${h}`;
}

function listBalls(ids: number[]): string {
  if (ids.length <= 1) return ids.join("");
  return `${ids.slice(0, -1).join(", ")} and ${ids[ids.length - 1]}`;
}

/** What the last shot did, in a sentence. */
function outcomeText(rack: RackState, names: [string, string]): string {
  const o = rack.last;
  if (!o) return "";
  const who = names[o.shooter];
  if (o.rerack) return "The 8 went down on the break: re-rack.";
  const parts: string[] = [];
  if (o.pocketed.length) parts.push(`${who} pocketed ${listBalls(o.pocketed)}.`);
  if (o.assigned) parts.push(o.shooter === 0 && names[0] === "You" ? `You're ${o.assigned}.` : `${who} is ${o.assigned}.`);
  if (o.foul) parts.push(`Foul: ${FOUL_TEXT[o.foul].toLowerCase()}.`);
  return parts.join(" ");
}

function instruction(match: MatchState, names: [string, string], calledName: string | null): string {
  const { rack, mode } = match;
  const who = names[rack.turn];
  const yours = mode === "solo" ? "Your" : `${who}:`;
  if (cpuTurn(match)) return rack.ballInHand ? "CPU has ball in hand…" : "CPU is lining up a shot…";
  if (rack.phase === "break") return `${yours} break. Place the cue ball behind the line, aim, then press Shoot.`;
  const steps: string[] = [];
  if (rack.ballInHand) steps.push(mode === "solo" ? "Ball in hand: drag the cue ball anywhere." : `${who} has ball in hand: drag the cue ball anywhere.`);
  if (onTheEight(rack)) steps.push(calledName ? `Called: ${calledName}.` : "Tap a pocket to call the 8.");
  if (steps.length === 0) steps.push(mode === "solo" ? "Your shot." : `${who}'s shot.`);
  return steps.join(" ");
}

function useVertical(): boolean {
  const query = "(max-aspect-ratio: 1/1)";
  const [vertical, setVertical] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setVertical(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return vertical;
}

export function Pool() {
  const pool = usePool();
  const { match, level, record, rolling, cpuPlan } = pool;
  const { rack, mode, score } = match;
  const names = NAMES[mode];
  const vertical = useVertical();

  const [aim, setAim] = useState(() => defaultAim(rack));
  /** Set on the slider and kept between shots (full for a break). */
  const [power, setPower] = useState(0.45);
  const [spin, setSpin] = useState<Spin>({ x: 0, y: 0 });
  const [called, setCalled] = useState<number | null>(null);
  /** Keyboard only: arrow keys move the cue ball rather than the aim. */
  const [placingKeys, setPlacingKeys] = useState(rack.ballInHand);

  const human = !cpuTurn(match) && rack.phase !== "over";
  const canShoot = human && !rolling;
  const calling = canShoot && onTheEight(rack);
  const needsCall = calling && called === null;

  // Each new turn: aim at the nearest legal ball, fresh call.
  useEffect(() => {
    setAim(defaultAim(rack));
    setCalled(null);
    if (rack.phase === "break") setPower(1);
    else setPower((p) => (p === 1 ? 0.45 : p));
    setPlacingKeys(rack.ballInHand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rack.turn, rack.last, rack.phase, match.rackNumber]);

  const shotReady = canShoot && !needsCall && power > 0.01;

  function shoot() {
    if (!shotReady) return;
    pool.shoot(aim, power, spin, calling ? called : null);
    // Spin is for one shot; it never lingers into the next.
    setSpin({ x: 0, y: 0 });
  }

  function place(x: number, y: number) {
    const cx = Math.min(TABLE_W - BALL_R, Math.max(BALL_R, x));
    const cy = Math.min(TABLE_H - BALL_R, Math.max(BALL_R, y));
    if (canPlaceCue(rack, cx, cy)) pool.place(cx, cy);
  }

  function onTableKey(e: KeyboardEvent<HTMLCanvasElement>) {
    if (!canShoot) return;
    const fine = e.shiftKey ? 0.1 : 1;
    if (rack.ballInHand && placingKeys && e.key.startsWith("Arrow")) {
      // Screen directions into table directions.
      const step = e.shiftKey ? 0.25 : 1;
      const cue = rack.balls[0];
      const [dx, dy] = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key] ?? [0, 0];
      const [tx, ty] = vertical ? [-dy, dx] : [dx, dy];
      place(cue.x + tx * step, cue.y + ty * step);
      e.preventDefault();
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") setAim((a) => a - (fine * Math.PI) / 180);
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") setAim((a) => a + (fine * Math.PI) / 180);
    else if (e.key === "Enter" && rack.ballInHand) setPlacingKeys((v) => !v);
    else if ((e.key === "p" || e.key === "P") && calling) setCalled((c) => ((c ?? -1) + 1) % POCKETS.length);
    else if (e.key === " " || (e.key === "Enter" && !rack.ballInHand)) shoot();
    else return;
    e.preventDefault();
  }

  const calledName = called !== null ? pocketName(called, vertical) : null;
  const statusLine = rolling
    ? "Tap the table to skip ahead."
    : rack.phase === "over"
      ? ""
      : `${outcomeText(rack, names)} ${instruction(match, names, calledName)}`.trim();

  const guide = rolling
    ? null
    : canShoot
      ? { angle: aim, power, line: true }
      : cpuPlan
        ? { angle: cpuPlan.angle, power: 0.3, line: false }
        : null;

  const tableLabel = `Pool table. ${statusLine}${canShoot ? " Arrow keys aim (Shift for fine), Space shoots, P calls a pocket for the 8" + (rack.ballInHand ? ", Enter switches between moving the cue ball and aiming." : ".") : ""}`;

  return (
    <div className={`pool${vertical ? " pool--vertical" : ""}`}>
      <div className="pool__hud">
        {([0, 1] as Player[]).map((p) => (
          <PlayerTile key={p} rack={rack} player={p} name={names[p]} score={score[p]} active={rack.phase !== "over" && rack.turn === p} />
        ))}
      </div>

      <div className="pool__table-area">
        <PoolTable
          balls={rack.balls}
          live={pool.live}
          rolling={rolling}
          vertical={vertical}
          guide={guide}
          kitchen={rack.phase === "break" && rack.ballInHand && canShoot}
          movableCue={canShoot && rack.ballInHand}
          calling={calling}
          called={calling ? called : null}
          dim={rack.phase === "over"}
          label={tableLabel}
          onAim={canShoot ? setAim : undefined}
          onPlace={canShoot && rack.ballInHand ? place : undefined}
          onCall={calling ? setCalled : undefined}
          onSkip={pool.skip}
          onKey={onTableKey}
        />
        {vertical && <PowerSlider power={power} onChange={setPower} disabled={!canShoot} vertical />}
        {rack.phase === "over" && rack.winner !== null && (
          <RackOver match={match} names={names} onNext={pool.nextRack} />
        )}
      </div>

      <div className="pool__controls">
        {!vertical && <PowerSlider power={power} onChange={setPower} disabled={!canShoot} />}
        <div className="pool__shot-row">
          <SpinDial spin={spin} onChange={setSpin} disabled={!canShoot} />
          <NudgeButton label="Fine aim left" symbol="◀" disabled={!canShoot} onStep={() => setAim((a) => a - (0.25 * Math.PI) / 180)} />
          <NudgeButton label="Fine aim right" symbol="▶" disabled={!canShoot} onStep={() => setAim((a) => a + (0.25 * Math.PI) / 180)} />
          <button type="button" className="fp-btn fp-btn--primary pool__shoot" disabled={!shotReady} onClick={shoot}>
            <span>Shoot</span>
            <span className="pool__shoot-spin">{spinName(spin)}</span>
          </button>
        </div>
      </div>

      <p className="pool__status" role="status" aria-live="polite">
        {statusLine}
      </p>

      <div className="pool__settings">
        <div className="fp-seg" role="group" aria-label="Opponent">
          {(["solo", "duo"] as Mode[]).map((m) => (
            <button key={m} type="button" className="fp-seg__btn" aria-pressed={m === mode} onClick={() => m !== mode && pool.requestNewMatch(m)}>
              {m === "solo" ? "vs CPU" : "2 players"}
            </button>
          ))}
        </div>
        {mode === "solo" && (
          <label className="pool__level">
            <span className="pool__level-head">
              <span className="fp-label">CPU skill</span>
              <span className="pool__level-value">
                {level} · {LEVEL_NAME(level)}
              </span>
            </span>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={level}
              aria-valuetext={`${level}, ${LEVEL_NAME(level)}`}
              onChange={(e) => pool.setLevel(Number(e.target.value) as Level)}
            />
            <span className="pool__level-ends" aria-hidden="true">
              <span>Rookie</span>
              <span>Shark</span>
            </span>
          </label>
        )}
        {pool.pendingMode !== null && (
          <ConfirmPrompt
            message={pool.pendingMode === mode ? "Start a new game? This one will be lost." : "Switch and start a new game? This one will be lost."}
            confirmLabel="New game"
            onConfirm={pool.confirmNewMatch}
            onCancel={pool.cancelNewMatch}
          />
        )}
        <div className="fp-controls">
          <button type="button" className="fp-btn fp-btn--secondary" onClick={() => pool.requestNewMatch()} disabled={pool.pendingMode !== null}>
            New game
          </button>
        </div>
        {mode === "solo" && (
          <p className="pool__record">
            Racks vs CPU: {record.wins}W · {record.losses}L
          </p>
        )}
      </div>
    </div>
  );
}

function MiniBall({ id, down }: { id: number; down: boolean }) {
  const c = ballColor(id);
  const style = isStripe(id) ? { background: `linear-gradient(#f4f1ff 0 28%, ${c} 28% 72%, #f4f1ff 72%)` } : { background: c };
  return <span className={`pool-mini${down ? " pool-mini--down" : ""}${id === 8 ? " pool-mini--eight" : ""}`} style={style} title={String(id)} />;
}

function PlayerTile({ rack, player, name, score, active }: { rack: RackState; player: Player; name: string; score: number; active: boolean }) {
  const g: Group | null = rack.groups[player];
  const ids = g === "solids" ? [1, 2, 3, 4, 5, 6, 7] : g === "stripes" ? [9, 10, 11, 12, 13, 14, 15] : [];
  const left = g ? remaining(rack.balls, g) : null;
  return (
    <div className={`fp-hud-tile pool-player${active ? " pool-player--turn" : ""}`}>
      <span className="pool-player__top">
        <span className="fp-hud-label">{name}</span>
        <span className="pool-player__score" aria-label={`${score} racks`}>
          {score}
        </span>
      </span>
      <span className={`pool-player__group${g ? " pool-player__group--set" : ""}`}>
        {g ? `${g === "solids" ? "Solids" : "Stripes"} · ${left} left` : rack.phase === "break" ? "Break" : "Open table"}
      </span>
      <span className="pool-player__balls" aria-hidden="true">
        {ids.map((id) => (
          <MiniBall key={id} id={id} down={rack.balls[id].pocket !== null} />
        ))}
        {g && left === 0 && <MiniBall id={8} down={false} />}
      </span>
    </div>
  );
}

function RackOver({ match, names, onNext }: { match: MatchState; names: [string, string]; onNext: () => void }) {
  const { rack, mode, score } = match;
  const w = rack.winner!;
  const youWon = mode === "solo" ? w === 0 : true;
  const title = mode === "solo" ? (w === 0 ? "You win the rack" : "CPU wins the rack") : `${names[w]} wins the rack`;
  const reason = rack.last?.win ? "Sank the 8 in the called pocket." : rack.last?.loss ? `${names[otherOf(w)]}: ${LOSS_TEXT[rack.last.loss]}` : "";
  const tone = youWon ? "success" : "danger";
  return (
    <div className={`pool-over pool-over--${tone} fp-enter`} role="alert">
      <p className={`fp-result-title fp-result-title--${tone}`}>{title}</p>
      <p className="fp-result-detail">{reason}</p>
      <p className="pool-over__score">
        {names[0]} {score[0]} – {score[1]} {names[1]}
      </p>
      <button type="button" className={`fp-btn ${youWon ? "fp-btn--success" : "fp-btn--primary"}`} onClick={onNext}>
        Next rack
      </button>
    </div>
  );
}

const otherOf = (p: Player): Player => (p === 0 ? 1 : 0);

/** Tap a point on the cue ball to set where the tip strikes. */
function SpinDial({ spin, onChange, disabled }: { spin: Spin; onChange: (s: Spin) => void; disabled: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef(false);
  const set = (e: PointerEvent<HTMLDivElement>) => {
    const box = ref.current!.getBoundingClientRect();
    let x = ((e.clientX - box.left) / box.width) * 2 - 1;
    let y = -(((e.clientY - box.top) / box.height) * 2 - 1);
    const m = Math.hypot(x, y);
    if (m > 1) {
      x /= m;
      y /= m;
    }
    // Snap near the centre to exactly none.
    onChange(m < 0.12 ? { x: 0, y: 0 } : { x: Math.round(x * 20) / 20, y: Math.round(y * 20) / 20 });
  };
  const describe = (s: Spin) => {
    if (s.x === 0 && s.y === 0) return "centre";
    const v = s.y > 0.05 ? `top ${Math.round(s.y * 100)}%` : s.y < -0.05 ? `back ${Math.round(-s.y * 100)}%` : "";
    const h = s.x > 0.05 ? `right ${Math.round(s.x * 100)}%` : s.x < -0.05 ? `left ${Math.round(-s.x * 100)}%` : "";
    return [v, h].filter(Boolean).join(", ");
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, 0.1], ArrowDown: [0, -0.1] }[e.key];
    if (d) {
      let x = Math.round((spin.x + d[0]) * 10) / 10;
      let y = Math.round((spin.y + d[1]) * 10) / 10;
      const m = Math.hypot(x, y);
      if (m > 1) {
        x /= m;
        y /= m;
      }
      onChange({ x, y });
      e.preventDefault();
    } else if (e.key === "Home" || e.key === "0") {
      onChange({ x: 0, y: 0 });
      e.preventDefault();
    }
  };
  return (
    <div className="pool-spin">
      <div
        ref={ref}
        className={`pool-spin__ball${disabled ? " pool-spin__ball--off" : ""}`}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label="Spin"
        aria-valuetext={describe(spin)}
        aria-disabled={disabled}
        onPointerDown={(e) => {
          if (disabled) return;
          drag.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          set(e);
        }}
        onPointerMove={(e) => drag.current && set(e)}
        onPointerUp={() => (drag.current = false)}
        onPointerCancel={() => (drag.current = false)}
        onKeyDown={onKey}
      >
        <span className="pool-spin__dot" style={{ left: `${50 + spin.x * 40}%`, top: `${50 - spin.y * 40}%` }} />
      </div>
      <span className="pool-spin__label" aria-hidden="true">
        Spin
      </span>
    </div>
  );
}

/** A fine-aim button that repeats while held. */
function NudgeButton({ label, symbol, onStep, disabled }: { label: string; symbol: string; onStep: () => void; disabled: boolean }) {
  const timer = useRef<number | null>(null);
  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return (
    <button
      type="button"
      className="fp-btn fp-btn--secondary fp-btn--compact pool__nudge-btn"
      aria-label={label}
      disabled={disabled}
      onPointerDown={() => {
        onStep();
        stop();
        let n = 0;
        timer.current = window.setInterval(() => {
          if (++n > 3) onStep();
        }, 70);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          onStep();
          e.preventDefault();
        }
      }}
    >
      {symbol}
    </button>
  );
}

/** What spin the next shot carries, in pool words. */
function spinName(s: Spin): string {
  const v = s.y > 0.15 ? "Follow" : s.y < -0.15 ? "Draw" : "";
  const h = s.x > 0.15 ? "right" : s.x < -0.15 ? "left" : "";
  if (!v && !h) return "No spin";
  if (!v) return `${h === "right" ? "Right" : "Left"} english`;
  return h ? `${v} + ${h}` : v;
}

/** Power: tap or drag anywhere on the track. It keeps its setting between shots. */
function PowerSlider({ power, onChange, disabled, vertical = false }: { power: number; onChange: (p: number) => void; disabled: boolean; vertical?: boolean }) {
  const drag = useRef(false);
  const set = (e: PointerEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const f = vertical ? (box.bottom - e.clientY) / box.height : (e.clientX - box.left) / box.width;
    onChange(Math.min(1, Math.max(0.02, Math.round(f * 50) / 50)));
  };
  const pct = Math.round(power * 100);
  return (
    <div
      className={`pool-power${vertical ? " pool-power--vertical" : ""}${disabled ? " pool-power--off" : ""}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Power"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-valuetext={`${pct}%`}
      aria-disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        drag.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        set(e);
      }}
      onPointerMove={(e) => drag.current && set(e)}
      onPointerUp={() => (drag.current = false)}
      onPointerCancel={() => (drag.current = false)}
      onKeyDown={(e) => {
        if (disabled) return;
        const big = e.shiftKey ? 0.1 : 0.02;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") onChange(Math.min(1, Math.round((power + big) * 100) / 100));
        else if (e.key === "ArrowLeft" || e.key === "ArrowDown") onChange(Math.max(0.02, Math.round((power - big) * 100) / 100));
        else if (e.key === "Home") onChange(0.02);
        else if (e.key === "End") onChange(1);
        else return;
        e.preventDefault();
      }}
    >
      <span className="pool-power__fill" style={vertical ? { height: `${pct}%` } : { width: `${pct}%` }} />
      <span className="pool-power__label">
        {vertical ? (
          <>
            {pct}
            <small>%</small>
          </>
        ) : (
          `Power ${pct}%`
        )}
      </span>
    </div>
  );
}
