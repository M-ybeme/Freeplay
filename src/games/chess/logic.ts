/*
 * Chess rules: pure functions, no React/DOM. Full rules - castling,
 * en passant, promotion, check, checkmate, stalemate, and the automatic
 * draws (fifty-move rule, threefold repetition, insufficient material).
 *
 * Squares are 0-63, row 0 = rank 8 (top, black's side), col 0 = file a.
 * Like Reversi, the rules never know who is a person and who is the
 * computer.
 */

export type Color = "white" | "black";
export type PieceType = "p" | "n" | "b" | "r" | "q" | "k";

export interface Piece {
  type: PieceType;
  color: Color;
}

export type Board = (Piece | null)[];

export interface Castling {
  wk: boolean;
  wq: boolean;
  bk: boolean;
  bq: boolean;
}

export interface Position {
  board: Board;
  turn: Color;
  castling: Castling;
  /** Square a pawn can capture into en passant, or null. */
  ep: number | null;
  /** Half-moves since the last capture or pawn move (fifty-move rule). */
  halfmove: number;
  fullmove: number;
}

export interface Move {
  from: number;
  to: number;
  piece: PieceType;
  captured?: PieceType;
  promotion?: PieceType;
  castle?: "k" | "q";
  enPassant?: boolean;
}

export const other = (c: Color): Color => (c === "white" ? "black" : "white");
export const rowOf = (i: number) => i >> 3;
export const colOf = (i: number) => i & 7;
export const sq = (r: number, c: number) => r * 8 + c;
const onBoard = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

export function squareName(i: number): string {
  return `${"abcdefgh"[colOf(i)]}${8 - rowOf(i)}`;
}

export function parseSquare(name: string): number {
  return sq(8 - Number(name[1]), "abcdefgh".indexOf(name[0]));
}

// ---------- FEN ----------

const FEN_PIECES: Record<string, PieceType> = { p: "p", n: "n", b: "b", r: "r", q: "q", k: "k" };

export const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export function fromFEN(fen: string): Position {
  const [placement, turn, castling, ep, half = "0", full = "1"] = fen.trim().split(/\s+/);
  const board: Board = [];
  for (const ch of placement.replace(/\//g, "")) {
    if (/\d/.test(ch)) for (let n = 0; n < Number(ch); n++) board.push(null);
    else board.push({ type: FEN_PIECES[ch.toLowerCase()], color: ch === ch.toUpperCase() ? "white" : "black" });
  }
  return {
    board,
    turn: turn === "w" ? "white" : "black",
    castling: { wk: castling.includes("K"), wq: castling.includes("Q"), bk: castling.includes("k"), bq: castling.includes("q") },
    ep: ep === "-" ? null : parseSquare(ep),
    halfmove: Number(half),
    fullmove: Number(full),
  };
}

export function initialPosition(): Position {
  return fromFEN(START_FEN);
}

/** Identity for repetition: placement, side to move, castling, en passant. */
export function positionKey(p: Position): string {
  const cells = p.board.map((x) => (x ? (x.color === "white" ? x.type.toUpperCase() : x.type) : ".")).join("");
  const c = p.castling;
  return `${cells} ${p.turn[0]} ${c.wk ? "K" : ""}${c.wq ? "Q" : ""}${c.bk ? "k" : ""}${c.bq ? "q" : ""} ${p.ep ?? "-"}`;
}

// ---------- Attacks ----------

const KNIGHT: [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];
const KING: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];
const ROOK_DIRS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
const BISHOP_DIRS: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

/** Is square i attacked by any piece of colour `by`? */
export function isAttacked(board: Board, i: number, by: Color): boolean {
  const r = rowOf(i);
  const c = colOf(i);
  // Pawns: a white pawn attacks upward (towards row 0).
  const pr = by === "white" ? r + 1 : r - 1;
  for (const dc of [-1, 1]) {
    if (onBoard(pr, c + dc)) {
      const p = board[sq(pr, c + dc)];
      if (p && p.color === by && p.type === "p") return true;
    }
  }
  for (const [dr, dc] of KNIGHT) {
    if (!onBoard(r + dr, c + dc)) continue;
    const p = board[sq(r + dr, c + dc)];
    if (p && p.color === by && p.type === "n") return true;
  }
  for (const [dr, dc] of KING) {
    if (!onBoard(r + dr, c + dc)) continue;
    const p = board[sq(r + dr, c + dc)];
    if (p && p.color === by && p.type === "k") return true;
  }
  for (const [dirs, kinds] of [
    [ROOK_DIRS, ["r", "q"]],
    [BISHOP_DIRS, ["b", "q"]],
  ] as const) {
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (onBoard(rr, cc)) {
        const p = board[sq(rr, cc)];
        if (p) {
          if (p.color === by && (kinds as readonly string[]).includes(p.type)) return true;
          break;
        }
        rr += dr;
        cc += dc;
      }
    }
  }
  return false;
}

export function kingSquare(board: Board, color: Color): number {
  return board.findIndex((p) => p !== null && p.type === "k" && p.color === color);
}

export function inCheck(pos: Position, color: Color = pos.turn): boolean {
  const k = kingSquare(pos.board, color);
  return k >= 0 && isAttacked(pos.board, k, other(color));
}

// ---------- Move generation ----------

const PROMOTIONS: PieceType[] = ["q", "r", "b", "n"];

/** Every move ignoring whether it leaves your own king in check. */
export function pseudoMoves(pos: Position): Move[] {
  const { board, turn } = pos;
  const moves: Move[] = [];
  const add = (from: number, to: number, extra: Partial<Move> = {}) => {
    const target = board[to];
    moves.push({ from, to, piece: board[from]!.type, ...(target ? { captured: target.type } : {}), ...extra });
  };

  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (!piece || piece.color !== turn) continue;
    const r = rowOf(from);
    const c = colOf(from);

    if (piece.type === "p") {
      const dir = turn === "white" ? -1 : 1;
      const startRow = turn === "white" ? 6 : 1;
      const lastRow = turn === "white" ? 0 : 7;
      const pushTo = (to: number, extra: Partial<Move> = {}) => {
        if (rowOf(to) === lastRow) for (const promotion of PROMOTIONS) add(from, to, { ...extra, promotion });
        else add(from, to, extra);
      };
      if (onBoard(r + dir, c) && !board[sq(r + dir, c)]) {
        pushTo(sq(r + dir, c));
        if (r === startRow && !board[sq(r + 2 * dir, c)]) add(from, sq(r + 2 * dir, c));
      }
      for (const dc of [-1, 1]) {
        if (!onBoard(r + dir, c + dc)) continue;
        const to = sq(r + dir, c + dc);
        const target = board[to];
        if (target && target.color !== turn) pushTo(to);
        else if (to === pos.ep) moves.push({ from, to, piece: "p", captured: "p", enPassant: true });
      }
      continue;
    }

    if (piece.type === "n" || piece.type === "k") {
      for (const [dr, dc] of piece.type === "n" ? KNIGHT : KING) {
        if (!onBoard(r + dr, c + dc)) continue;
        const to = sq(r + dr, c + dc);
        if (board[to]?.color !== turn) add(from, to);
      }
      if (piece.type === "k") addCastles(pos, from, moves);
      continue;
    }

    const dirs = piece.type === "r" ? ROOK_DIRS : piece.type === "b" ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
    for (const [dr, dc] of dirs) {
      let rr = r + dr;
      let cc = c + dc;
      while (onBoard(rr, cc)) {
        const to = sq(rr, cc);
        const target = board[to];
        if (target) {
          if (target.color !== turn) add(from, to);
          break;
        }
        add(from, to);
        rr += dr;
        cc += dc;
      }
    }
  }
  return moves;
}

/** Castling: rights intact, path empty, and the king never in or through check. */
function addCastles(pos: Position, from: number, moves: Move[]) {
  const { board, turn, castling } = pos;
  const row = turn === "white" ? 7 : 0;
  if (from !== sq(row, 4)) return;
  const enemy = other(turn);
  if (isAttacked(board, from, enemy)) return;
  const rook = (c: number) => {
    const p = board[sq(row, c)];
    return p?.type === "r" && p.color === turn;
  };
  const kingSide = turn === "white" ? castling.wk : castling.bk;
  const queenSide = turn === "white" ? castling.wq : castling.bq;
  if (
    kingSide &&
    rook(7) &&
    !board[sq(row, 5)] &&
    !board[sq(row, 6)] &&
    !isAttacked(board, sq(row, 5), enemy) &&
    !isAttacked(board, sq(row, 6), enemy)
  ) {
    moves.push({ from, to: sq(row, 6), piece: "k", castle: "k" });
  }
  if (
    queenSide &&
    rook(0) &&
    !board[sq(row, 1)] &&
    !board[sq(row, 2)] &&
    !board[sq(row, 3)] &&
    !isAttacked(board, sq(row, 3), enemy) &&
    !isAttacked(board, sq(row, 2), enemy)
  ) {
    moves.push({ from, to: sq(row, 2), piece: "k", castle: "q" });
  }
}

/** The position after a move (assumed pseudo-legal). */
export function applyMove(pos: Position, m: Move): Position {
  const board = [...pos.board];
  const mover = board[m.from]!;
  board[m.from] = null;
  board[m.to] = m.promotion ? { type: m.promotion, color: mover.color } : mover;

  if (m.enPassant) board[sq(rowOf(m.from), colOf(m.to))] = null;
  if (m.castle) {
    const row = rowOf(m.from);
    const [rf, rt] = m.castle === "k" ? [7, 5] : [0, 3];
    board[sq(row, rt)] = board[sq(row, rf)];
    board[sq(row, rf)] = null;
  }

  const castling = { ...pos.castling };
  if (m.piece === "k") {
    if (mover.color === "white") castling.wk = castling.wq = false;
    else castling.bk = castling.bq = false;
  }
  // A rook moving from, or anything landing on, a corner ends that right.
  for (const s of [m.from, m.to]) {
    if (s === 63) castling.wk = false;
    if (s === 56) castling.wq = false;
    if (s === 7) castling.bk = false;
    if (s === 0) castling.bq = false;
  }

  const double = m.piece === "p" && Math.abs(rowOf(m.to) - rowOf(m.from)) === 2;
  return {
    board,
    turn: other(pos.turn),
    castling,
    ep: double ? (m.from + m.to) / 2 : null,
    halfmove: m.piece === "p" || m.captured ? 0 : pos.halfmove + 1,
    fullmove: pos.turn === "black" ? pos.fullmove + 1 : pos.fullmove,
  };
}

export function legalMoves(pos: Position): Move[] {
  return pseudoMoves(pos).filter((m) => !inCheck(applyMove(pos, m), pos.turn));
}

/** Count leaf positions to a depth - the standard correctness check for move generators. */
export function perft(pos: Position, depth: number): number {
  if (depth === 0) return 1;
  const moves = legalMoves(pos);
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) n += perft(applyMove(pos, m), depth - 1);
  return n;
}

// ---------- Notation ----------

const LETTER: Record<PieceType, string> = { p: "", n: "N", b: "B", r: "R", q: "Q", k: "K" };

/** Standard algebraic notation, e.g. Nf3, exd5, O-O, e8=Q+, Qxf7#. */
export function toSAN(pos: Position, m: Move, legal: Move[] = legalMoves(pos)): string {
  let san: string;
  if (m.castle) {
    san = m.castle === "k" ? "O-O" : "O-O-O";
  } else {
    const capture = m.captured ? "x" : "";
    if (m.piece === "p") {
      san = `${capture ? "abcdefgh"[colOf(m.from)] + "x" : ""}${squareName(m.to)}${m.promotion ? "=" + LETTER[m.promotion] : ""}`;
    } else {
      // Disambiguate when another piece of the same kind can reach the square.
      const rivals = legal.filter((o) => o.piece === m.piece && o.to === m.to && o.from !== m.from);
      let dis = "";
      if (rivals.length) {
        const sameFile = rivals.some((o) => colOf(o.from) === colOf(m.from));
        const sameRank = rivals.some((o) => rowOf(o.from) === rowOf(m.from));
        if (!sameFile) dis = "abcdefgh"[colOf(m.from)];
        else if (!sameRank) dis = String(8 - rowOf(m.from));
        else dis = squareName(m.from);
      }
      san = `${LETTER[m.piece]}${dis}${capture}${squareName(m.to)}`;
    }
  }
  const after = applyMove(pos, m);
  if (inCheck(after)) san += legalMoves(after).length === 0 ? "#" : "+";
  return san;
}

// ---------- Game ----------

export type Status = "playing" | "checkmate" | "stalemate" | "fifty" | "repetition" | "material";

export interface PlayedMove {
  move: Move;
  san: string;
  /** Position before this move, for undo and repetition. */
  before: Position;
}

export interface GameState {
  position: Position;
  status: Status;
  moves: PlayedMove[];
}

export function createGame(pos: Position = initialPosition()): GameState {
  return { position: pos, status: statusOf(pos, []), moves: [] };
}

/** Bare kings, or king plus one minor piece, or bishops all on one colour. */
export function insufficientMaterial(board: Board): boolean {
  const minors: { type: PieceType; square: number }[] = [];
  for (let i = 0; i < 64; i++) {
    const p = board[i];
    if (!p || p.type === "k") continue;
    if (p.type === "p" || p.type === "r" || p.type === "q") return false;
    minors.push({ type: p.type, square: i });
  }
  if (minors.length <= 1) return true;
  if (minors.every((m) => m.type === "b")) {
    const shade = (i: number) => (rowOf(i) + colOf(i)) % 2;
    return minors.every((m) => shade(m.square) === shade(minors[0].square));
  }
  return false;
}

function statusOf(pos: Position, history: PlayedMove[]): Status {
  if (legalMoves(pos).length === 0) return inCheck(pos) ? "checkmate" : "stalemate";
  if (insufficientMaterial(pos.board)) return "material";
  if (pos.halfmove >= 100) return "fifty";
  const key = positionKey(pos);
  if (history.filter((h) => positionKey(h.before) === key).length >= 2) return "repetition";
  return "playing";
}

export function playMove(game: GameState, m: Move): GameState {
  if (game.status !== "playing") return game;
  const legal = legalMoves(game.position);
  const match = legal.find((l) => l.from === m.from && l.to === m.to && (l.promotion ?? null) === (m.promotion ?? null));
  if (!match) return game;
  const san = toSAN(game.position, match, legal);
  const position = applyMove(game.position, match);
  const moves = [...game.moves, { move: match, san, before: game.position }];
  return { position, status: statusOf(position, moves), moves };
}

export function undoMove(game: GameState): GameState {
  if (game.moves.length === 0) return game;
  const last = game.moves[game.moves.length - 1];
  return { position: last.before, status: "playing", moves: game.moves.slice(0, -1) };
}

/** Back to the last time `color` was about to move (vs the computer: skip its reply). */
export function undoToTurn(game: GameState, color: Color): GameState {
  for (let n = game.moves.length - 1; n >= 0; n--) {
    if (game.moves[n].before.turn === color) {
      return { position: game.moves[n].before, status: "playing", moves: game.moves.slice(0, n) };
    }
  }
  return game;
}

export function winner(game: GameState): Color | "draw" | null {
  if (game.status === "playing") return null;
  if (game.status === "checkmate") return other(game.position.turn);
  return "draw";
}

export const PIECE_VALUE: Record<PieceType, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };

/** Material lead for white, in pawns (for the score display). */
export function materialBalance(board: Board): number {
  let total = 0;
  for (const p of board) if (p) total += (p.color === "white" ? 1 : -1) * PIECE_VALUE[p.type];
  return Math.round(total / 100);
}
