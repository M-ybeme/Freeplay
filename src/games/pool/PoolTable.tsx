import { useEffect, useRef, type KeyboardEvent, type MutableRefObject, type PointerEvent } from "react";
import { ballColor, isStripe } from "./colors";
import type { BallSpot } from "./logic";
import { type World, BALL_R, HEAD_X, POCKETS, TABLE_H, TABLE_W } from "./physics";

/** Rail width around the playing surface, in table inches. */
export const RAIL = 3.4;
const FULL_W = TABLE_W + 2 * RAIL;
const FULL_H = TABLE_H + 2 * RAIL;

export interface TableView {
  /** Long axis up the screen (phones in portrait), break end at the bottom. */
  vertical: boolean;
}

export interface Guide {
  angle: number;
  /** 0-1: how far the cue is drawn back. */
  power: number;
  /** Show the dotted aiming line (your shot) or just the cue (computer's). */
  line: boolean;
}

interface Props {
  balls: readonly BallSpot[];
  live: MutableRefObject<World | null>;
  rolling: boolean;
  vertical: boolean;
  guide: Guide | null;
  /** Shade the area behind the head string (placing for the break). */
  kitchen: boolean;
  /** The cue ball can be dragged. */
  movableCue: boolean;
  /** Pockets light up to be called; this one is called. */
  calling: boolean;
  called: number | null;
  /** Dim everything under the end-of-rack panel. */
  dim: boolean;
  label: string;
  onAim?: (angle: number) => void;
  onPlace?: (x: number, y: number) => void;
  onCall?: (pocket: number) => void;
  onSkip?: () => void;
  onKey?: (e: KeyboardEvent<HTMLCanvasElement>) => void;
}

/** Table inches to canvas pixels (and back), for either orientation. */
function mapper(vertical: boolean, scale: number) {
  return {
    toScreen: (x: number, y: number): [number, number] =>
      vertical ? [(y + RAIL) * scale, (TABLE_W + RAIL - x) * scale] : [(x + RAIL) * scale, (y + RAIL) * scale],
    toTable: (sx: number, sy: number): [number, number] =>
      vertical ? [TABLE_W + RAIL - sy / scale, sx / scale - RAIL] : [sx / scale - RAIL, sy / scale - RAIL],
    /** A table angle as a screen angle. */
    angle: (a: number) => (vertical ? a - Math.PI / 2 : a),
  };
}

/** Where the cue ball's path first meets a ball or a cushion. */
function traceAim(balls: readonly { id: number; x: number; y: number; pocket: number | null }[], angle: number) {
  const cue = balls.find((b) => b.id === 0)!;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  let t = Infinity;
  let hit: { id: number; x: number; y: number } | null = null;
  for (const b of balls) {
    if (b.id === 0 || b.pocket !== null) continue;
    const ox = b.x - cue.x;
    const oy = b.y - cue.y;
    const along = ox * dx + oy * dy;
    if (along <= 0) continue;
    const perp2 = ox * ox + oy * oy - along * along;
    const r2 = (2 * BALL_R) ** 2;
    if (perp2 > r2) continue;
    const d = along - Math.sqrt(r2 - perp2);
    if (d < t) {
      t = d;
      hit = b;
    }
  }
  // Cushions, as the box the ball's centre stays inside.
  const walls = [
    dx > 0 ? (TABLE_W - BALL_R - cue.x) / dx : dx < 0 ? (BALL_R - cue.x) / dx : Infinity,
    dy > 0 ? (TABLE_H - BALL_R - cue.y) / dy : dy < 0 ? (BALL_R - cue.y) / dy : Infinity,
  ];
  const wall = Math.min(...walls);
  if (wall < t) return { x: cue.x + dx * wall, y: cue.y + dy * wall, ball: null, wallX: walls[0] <= walls[1] };
  return { x: cue.x + dx * t, y: cue.y + dy * t, ball: hit, wallX: false };
}

export function PoolTable(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const propsRef = useRef(props);
  const drag = useRef<"aim" | "place" | null>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const bg = useRef<{ key: string; layer: HTMLCanvasElement } | null>(null);
  const tokens = useRef<{ purple: string; cyan: string; toxic: string; pink: string } | null>(null);

  // Size the canvas to its box, crisply.
  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      size.current = { w, h, dpr };
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      draw();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw on every change, and every frame while balls roll.
  useEffect(() => {
    propsRef.current = props;
    draw();
    if (!props.rolling) return;
    let id = requestAnimationFrame(function frame() {
      draw();
      id = requestAnimationFrame(frame);
    });
    return () => cancelAnimationFrame(id);
  });

  function draw() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const p = propsRef.current;
    const { w, dpr } = size.current;
    if (w === 0) return;
    const scale = w / (p.vertical ? FULL_H : FULL_W);
    const m = mapper(p.vertical, scale);
    if (!tokens.current) {
      const css = getComputedStyle(canvas);
      const token = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
      tokens.current = {
        purple: token("--uv-purple", "#8b3dff"),
        cyan: token("--laser-blue", "#00d9ff"),
        toxic: token("--toxic", "#8cff00"),
        pink: token("--hot-pink", "#ff2bd6"),
      };
    }
    const { purple, cyan, toxic, pink } = tokens.current;

    const rect = (x0: number, y0: number, x1: number, y1: number): [number, number, number, number] => {
      const [ax, ay] = m.toScreen(x0, y0);
      const [bx, by] = m.toScreen(x1, y1);
      return [Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay)];
    };

    // The table itself (rails, felt, markings, pockets) only changes with
    // size or a few flags, so it's painted once into a layer and copied
    // each frame; redrawing its glows every frame was too slow to keep up.
    const key = `${canvas.width}x${canvas.height}:${p.vertical}:${p.kitchen}:${p.calling}:${p.called}`;
    if (!bg.current || bg.current.key !== key) {
      const layer = document.createElement("canvas");
      layer.width = canvas.width;
      layer.height = canvas.height;
      const g = layer.getContext("2d")!;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Rails.
      const [rx, ry, rw, rh] = rect(-RAIL, -RAIL, TABLE_W + RAIL, TABLE_H + RAIL);
      g.fillStyle = "#150d2b";
      g.beginPath();
      g.roundRect(rx + 1, ry + 1, rw - 2, rh - 2, RAIL * scale * 0.7);
      g.fill();
      g.strokeStyle = purple;
      g.lineWidth = 1.5;
      g.shadowColor = purple;
      g.shadowBlur = 10;
      g.stroke();
      g.shadowBlur = 0;

      // Felt.
      const [fx, fy, fw, fh] = rect(0, 0, TABLE_W, TABLE_H);
      const felt = g.createRadialGradient(fx + fw / 2, fy + fh / 2, 0, fx + fw / 2, fy + fh / 2, Math.max(fw, fh) * 0.6);
      felt.addColorStop(0, "#132a5c");
      felt.addColorStop(1, "#0a1433");
      g.fillStyle = felt;
      g.fillRect(fx, fy, fw, fh);
      g.strokeStyle = "rgba(0, 217, 255, 0.35)";
      g.lineWidth = 1;
      g.strokeRect(fx + 0.5, fy + 0.5, fw - 1, fh - 1);

      // Diamonds on the rails.
      g.fillStyle = "rgba(196, 160, 255, 0.55)";
      for (let i = 1; i < 8; i++) {
        if (i === 4) continue;
        for (const y of [-RAIL / 2, TABLE_H + RAIL / 2]) {
          const [sx, sy] = m.toScreen((i * TABLE_W) / 8, y);
          g.beginPath();
          g.arc(sx, sy, Math.max(1, scale * 0.35), 0, Math.PI * 2);
          g.fill();
        }
      }
      for (let i = 1; i < 4; i++) {
        for (const x of [-RAIL / 2, TABLE_W + RAIL / 2]) {
          const [sx, sy] = m.toScreen(x, (i * TABLE_H) / 4);
          g.beginPath();
          g.arc(sx, sy, Math.max(1, scale * 0.35), 0, Math.PI * 2);
          g.fill();
        }
      }

      // Head string and foot spot.
      if (p.kitchen) {
        const [kx, ky, kw, kh] = rect(0, 0, HEAD_X, TABLE_H);
        g.fillStyle = "rgba(0, 217, 255, 0.07)";
        g.fillRect(kx, ky, kw, kh);
      }
      g.strokeStyle = p.kitchen ? "rgba(0, 217, 255, 0.55)" : "rgba(0, 217, 255, 0.18)";
      g.setLineDash([4, 5]);
      g.beginPath();
      g.moveTo(...m.toScreen(HEAD_X, 0));
      g.lineTo(...m.toScreen(HEAD_X, TABLE_H));
      g.stroke();
      g.setLineDash([]);
      const [spx, spy] = m.toScreen((3 * TABLE_W) / 4, TABLE_H / 2);
      g.fillStyle = "rgba(0, 217, 255, 0.3)";
      g.beginPath();
      g.arc(spx, spy, Math.max(1.2, scale * 0.3), 0, Math.PI * 2);
      g.fill();

      // Pockets.
      POCKETS.forEach((pk, i) => {
        const [sx, sy] = m.toScreen(pk.x, pk.y);
        const r = (i === 1 || i === 4 ? 2.1 : 2.4) * scale;
        g.fillStyle = "#020104";
        g.beginPath();
        g.arc(sx, sy, r, 0, Math.PI * 2);
        g.fill();
        const isCalled = p.called === i;
        if (p.calling || isCalled) {
          g.strokeStyle = isCalled ? toxic : pink;
          g.lineWidth = isCalled ? 3 : 2;
          g.shadowColor = g.strokeStyle;
          g.shadowBlur = isCalled ? 14 : 8;
        } else {
          g.strokeStyle = "rgba(139, 61, 255, 0.6)";
          g.lineWidth = 1;
        }
        g.stroke();
        g.shadowBlur = 0;
      });
      bg.current = { key, layer };
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bg.current.layer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Balls: the live shot if one is rolling, else the table at rest.
    const balls = p.live.current?.balls ?? p.balls;
    const br = BALL_R * scale;
    const cue = balls.find((b) => b.id === 0);

    // The aim guide under the balls.
    if (p.guide && cue && cue.pocket === null && !p.rolling && p.guide.line) {
      const hit = traceAim(balls, p.guide.angle);
      ctx.strokeStyle = "rgba(244, 241, 255, 0.75)";
      ctx.lineWidth = 1.25;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.moveTo(...m.toScreen(cue.x, cue.y));
      ctx.lineTo(...m.toScreen(hit.x, hit.y));
      ctx.stroke();
      ctx.setLineDash([]);
      // Ghost ball where the cue ball will be at contact.
      ctx.strokeStyle = "rgba(244, 241, 255, 0.6)";
      ctx.beginPath();
      ctx.arc(...m.toScreen(hit.x, hit.y), br, 0, Math.PI * 2);
      ctx.stroke();
      if (hit.ball) {
        // Where the object ball goes (the line of centres), and the cue ball (the tangent).
        const nx = hit.ball.x - hit.x;
        const ny = hit.ball.y - hit.y;
        const n = Math.hypot(nx, ny) || 1;
        const ux = nx / n;
        const uy = ny / n;
        ctx.strokeStyle = toxic;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(...m.toScreen(hit.ball.x, hit.ball.y));
        ctx.lineTo(...m.toScreen(hit.ball.x + ux * 9, hit.ball.y + uy * 9));
        ctx.stroke();
        const dx = Math.cos(p.guide.angle);
        const dy = Math.sin(p.guide.angle);
        const along = dx * ux + dy * uy;
        const tx = dx - along * ux;
        const ty = dy - along * uy;
        const tn = Math.hypot(tx, ty);
        if (tn > 0.05) {
          ctx.strokeStyle = "rgba(244, 241, 255, 0.35)";
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(...m.toScreen(hit.x, hit.y));
          ctx.lineTo(...m.toScreen(hit.x + (tx / tn) * 6 * tn, hit.y + (ty / tn) * 6 * tn));
          ctx.stroke();
        }
      }
    }

    for (const b of balls) {
      if (b.pocket !== null) continue;
      const [sx, sy] = m.toScreen(b.x, b.y);
      const color = ballColor(b.id);
      // Shadow.
      ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
      ctx.beginPath();
      ctx.arc(sx + br * 0.18, sy + br * 0.22, br, 0, Math.PI * 2);
      ctx.fill();
      ctx.save();
      ctx.beginPath();
      ctx.arc(sx, sy, br, 0, Math.PI * 2);
      ctx.clip();
      if (isStripe(b.id)) {
        ctx.fillStyle = "#f4f1ff";
        ctx.fillRect(sx - br, sy - br, br * 2, br * 2);
        ctx.fillStyle = color;
        ctx.fillRect(sx - br, sy - br * 0.55, br * 2, br * 1.1);
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(sx - br, sy - br, br * 2, br * 2);
      }
      // A glint of light.
      const shine = ctx.createRadialGradient(sx - br * 0.4, sy - br * 0.45, 0, sx - br * 0.4, sy - br * 0.45, br * 1.2);
      shine.addColorStop(0, "rgba(255, 255, 255, 0.55)");
      shine.addColorStop(0.35, "rgba(255, 255, 255, 0.08)");
      shine.addColorStop(1, "rgba(0, 0, 0, 0.3)");
      ctx.fillStyle = shine;
      ctx.fillRect(sx - br, sy - br, br * 2, br * 2);
      ctx.restore();
      if (b.id === 8) {
        ctx.strokeStyle = purple;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, br, 0, Math.PI * 2);
        ctx.stroke();
      }
      if (b.id === 0) {
        ctx.shadowColor = cyan;
        ctx.shadowBlur = p.rolling ? 0 : 8;
        ctx.strokeStyle = "rgba(0, 217, 255, 0.6)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, br, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (br >= 5.5) {
        // The number, on a small white disc.
        ctx.fillStyle = "#f4f1ff";
        ctx.beginPath();
        ctx.arc(sx, sy, br * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#120c26";
        ctx.font = `700 ${Math.round(br * 0.68)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(String(b.id), sx, sy + br * 0.04);
      }
    }

    // Ball in hand: a ring around the cue ball says "drag me".
    if (p.movableCue && cue && cue.pocket === null && !p.rolling) {
      const [sx, sy] = m.toScreen(cue.x, cue.y);
      ctx.strokeStyle = cyan;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(sx, sy, br * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // The cue stick, drawn back by the power.
    if (p.guide && cue && cue.pocket === null && !p.rolling) {
      const a = m.angle(p.guide.angle);
      const [sx, sy] = m.toScreen(cue.x, cue.y);
      const gap = br * 1.6 + p.guide.power * br * 9;
      const len = scale * 42;
      const x0 = sx - Math.cos(a) * gap;
      const y0 = sy - Math.sin(a) * gap;
      const x1 = x0 - Math.cos(a) * len;
      const y1 = y0 - Math.sin(a) * len;
      const grad = ctx.createLinearGradient(x0, y0, x1, y1);
      grad.addColorStop(0, "#f4f1ff");
      grad.addColorStop(0.04, cyan);
      grad.addColorStop(0.06, "#3a2470");
      grad.addColorStop(1, "#1a0f33");
      ctx.strokeStyle = grad;
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(2.5, br * 0.55);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.lineCap = "butt";
    }

    if (p.dim) {
      ctx.fillStyle = "rgba(8, 6, 18, 0.55)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function tablePoint(e: PointerEvent<HTMLCanvasElement>): [number, number] {
    const box = e.currentTarget.getBoundingClientRect();
    const { w } = size.current;
    const scale = w / (props.vertical ? FULL_H : FULL_W);
    return mapper(props.vertical, scale).toTable(e.clientX - box.left, e.clientY - box.top);
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    if (props.rolling) {
      props.onSkip?.();
      return;
    }
    const [x, y] = tablePoint(e);
    if (props.calling && props.onCall) {
      const near = POCKETS.findIndex((pk) => Math.hypot(pk.x - x, pk.y - y) < 6);
      if (near >= 0) {
        props.onCall(near);
        return;
      }
    }
    const cue = props.balls[0];
    if (props.movableCue && props.onPlace && Math.hypot(cue.x - x, cue.y - y) < BALL_R * 3.2) {
      drag.current = "place";
    } else if (props.onAim) {
      drag.current = "aim";
      props.onAim(Math.atan2(y - cue.y, x - cue.x));
    } else return;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    const [x, y] = tablePoint(e);
    const cue = props.balls[0];
    if (drag.current === "place") props.onPlace?.(x, y);
    else if (Math.hypot(x - cue.x, y - cue.y) > 0.5) props.onAim?.(Math.atan2(y - cue.y, x - cue.x));
  }

  return (
    <div ref={wrapRef} className={`pool-table${props.vertical ? " pool-table--vertical" : ""}`}>
      <canvas
        ref={canvasRef}
        className="pool-table__canvas"
        tabIndex={0}
        role="img"
        aria-label={props.label}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
        onKeyDown={props.onKey}
      />
    </div>
  );
}
