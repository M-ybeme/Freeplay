import { useState, type CSSProperties } from "react";
import { ConfirmPrompt } from "../../components/ConfirmPrompt/ConfirmPrompt";
import { ChromaCard, ColorShape } from "./ChromaCard";
import {
  COLORS,
  TARGETS,
  cardName,
  colorName,
  legalPlays,
  topCard,
  type ChromaCard as Card,
  type Event,
  type GameState,
  type RoundResult,
  type RoundState,
  type Seat,
} from "./logic";
import { YOU, useChroma } from "./useChroma";
import "./Chroma.css";

const SEAT_NAME: Record<Seat, string> = { 0: "You", 1: "West", 2: "North", 3: "East" };
const TARGET_LABEL: Record<number, string> = { 200: "Short · 200", 500: "Full · 500" };
/** Past this many cards your hand wraps onto another row, so each card stays easy to tap. */
const ROW_MAX = 12;

function describe(e: Event): string {
  const who = SEAT_NAME[e.type === "start" ? YOU : e.seat];
  switch (e.type) {
    case "start":
      return `Turned up ${cardName(e.card)}.`;
    case "play":
      return `${who} played ${cardName(e.card)}.`;
    case "draw":
      return e.count === 0 ? `${who} couldn't draw.` : `${who} drew a card.`;
    case "pass":
      return `${who} kept the card.`;
    case "color":
      return `${who} picked ${colorName(e.color)}.`;
    case "call":
      return e.seat === YOU ? "You called last card!" : `${who} called last card!`;
    case "penalty":
      if (e.reason === "caught") return e.seat === YOU ? "Caught! You didn't call last card: +2." : `${who} was caught: +2.`;
      return e.seat === YOU ? `You draw ${e.count}.` : `${who} draws ${e.count}.`;
  }
}

function turnText(round: RoundState): string {
  const t = round.turn;
  if (round.phase === "choose-color") return t === YOU ? "Pick a colour." : `${SEAT_NAME[t]} is picking a colour…`;
  if (t !== YOU) return `${SEAT_NAME[t]}'s turn…`;
  if (round.phase === "drawn") return "Play it or keep it?";
  const playable = legalPlays(round.hands[YOU], topCard(round), round.color).length > 0;
  return playable ? "Your turn." : "Nothing to play: draw a card.";
}

/** Split `cards` into rows of at most ROW_MAX, as even as possible. */
function rows(cards: Card[]): Card[][] {
  const count = Math.max(1, Math.ceil(cards.length / ROW_MAX));
  const per = Math.ceil(cards.length / count);
  return Array.from({ length: count }, (_, i) => cards.slice(i * per, (i + 1) * per));
}

export function Chroma() {
  const c = useChroma();
  const { game, record, pendingTarget } = c;
  const { round, scores, target, status, lastResult } = game;
  const [selected, setSelected] = useState<number | null>(null);

  const live = status === "playing" && round.phase !== "round-over";
  const myTurn = live && round.turn === YOU;
  const myHand = round.hands[YOU];
  const legal = myTurn && (round.phase === "playing" || round.phase === "drawn")
    ? round.phase === "drawn"
      ? myHand.filter((card) => card.id === round.drawnCard)
      : legalPlays(myHand, topCard(round), round.color)
    : [];
  const isLegal = (card: Card) => legal.some((l) => l.id === card.id);
  const lifted = selected !== null && legal.some((l) => l.id === selected) ? selected : null;
  const canDraw = myTurn && round.phase === "playing";
  const mustDraw = canDraw && legal.length === 0;

  const lastWin = live ? round.lastCard : null;
  const canCall =
    (lastWin?.seat === YOU && !lastWin.called) ||
    (myTurn && myHand.length === 2 && round.preCalled !== YOU && legal.length > 0);
  const catchable = lastWin && !lastWin.called && lastWin.seat !== YOU ? lastWin.seat : null;
  const calledSeat = (seat: Seat) => (lastWin?.seat === seat && lastWin.called) || (seat === YOU && round.preCalled === YOU);

  function onCard(card: Card) {
    if (!isLegal(card)) return;
    if (lifted === card.id) {
      setSelected(null);
      c.play(card.id);
    } else {
      setSelected(card.id);
    }
  }

  const statusLine = live ? `${round.events.map(describe).join(" ")} ${turnText(round)}`.trim() : "";
  const top = topCard(round);
  const clockwise = round.direction === 1;

  return (
    <div className="chroma">
      <div className="chroma__side-top">
        <div className="chroma__scores">
          {([0, 1, 2, 3] as Seat[]).map((seat) => (
            <div key={seat} className={`fp-hud-tile chroma__score${seat === YOU ? " chroma__score--you" : ""}`}>
              <span className="fp-hud-label">{SEAT_NAME[seat]}</span>
              <span className="fp-hud-value">{scores[seat]}</span>
            </div>
          ))}
        </div>
        <p className="fp-label chroma__meta">
          // Round {game.roundNumber} · first to {target}
        </p>
      </div>

      <div className="chroma__main">
        <div className="chroma-table fp-corner-marks" role="group" aria-label="Card table">
          {([2, 1, 3] as Seat[]).map((seat) => (
            <SeatPanel key={seat} round={round} seat={seat} live={live} called={calledSeat(seat)} />
          ))}

          <div className="chroma-center">
            <div className="chroma-piles">
              <button
                type="button"
                className={`chroma-draw${mustDraw ? " chroma-draw--hint" : ""}`}
                disabled={!canDraw}
                onClick={() => {
                  setSelected(null);
                  c.draw();
                }}
                aria-label={`Draw a card, ${round.drawPile.length} left`}
              >
                <ChromaCard faceDown />
                <span className="chroma-draw__label" aria-hidden="true">
                  Draw
                </span>
              </button>
              <div className="chroma-discard">
                <ChromaCard key={top.id} card={top} className="chroma-discard__card" />
              </div>
            </div>
            <div className="chroma-now">
              <span className={`chroma-now__color chroma-now__color--${round.color}`}>
                <ColorShape color={round.color} />
                {colorName(round.color)}
              </span>
              <span className="chroma-now__dir" aria-label={clockwise ? "Play goes clockwise" : "Play goes anticlockwise"}>
                <svg viewBox="0 0 24 24" className={clockwise ? "" : "chroma-now__dir--flip"} aria-hidden="true">
                  <path d="M19 12a7 7 0 1 1-2.05-4.95" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                  <path d="M17.5 3v4.5H13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            </div>
          </div>

          <div className={`chroma-seat chroma-seat--s0${live && round.turn === YOU ? " chroma-seat--turn" : ""}`}>
            <span className="chroma-seat__name">You</span>
            <span className="chroma-seat__count">{myHand.length} {myHand.length === 1 ? "card" : "cards"}</span>
            {calledSeat(YOU) && <span className="chroma-seat__called">Last card</span>}
          </div>

          {lastResult && (
            <RoundSummary
              result={lastResult}
              game={game}
              onAction={status === "playing" ? c.nextRound : () => c.requestNewGame()}
            />
          )}
        </div>

        <div className="chroma-hand-wrap" role="group" aria-label="Your hand">
          {rows(myHand).map((row, i) => (
            <div key={i} className="chroma-hand" style={{ "--n": Math.max(row.length, 1) } as CSSProperties}>
              {row.map((card) => {
                const playable = isLegal(card);
                const up = lifted === card.id;
                const drawn = round.phase === "drawn" && card.id === round.drawnCard;
                return (
                  <button
                    key={card.id}
                    type="button"
                    className={`chroma-hand__card${up ? " chroma-hand__card--lifted" : ""}${drawn ? " chroma-hand__card--drawn" : ""}${myTurn && !playable ? " chroma-hand__card--blocked" : ""}`}
                    aria-disabled={!playable}
                    aria-label={`${cardName(card)}${up ? ", selected. Press again to play" : ""}`}
                    onClick={() => onCard(card)}
                  >
                    <ChromaCard card={card} />
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="chroma-actions">
          {myTurn && round.phase === "choose-color" && (
            <div className="chroma-picker fp-enter" role="group" aria-label="Pick a colour">
              <div className="chroma-picker__grid">
                {COLORS.map((color) => (
                  <button key={color} type="button" className={`chroma-picker__btn chroma-picker__btn--${color}`} onClick={() => c.pickColor(color)}>
                    <ColorShape color={color} />
                    {colorName(color)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {myTurn && round.phase === "drawn" && (
            <>
              <button type="button" className="fp-btn fp-btn--primary fp-btn--compact" onClick={() => c.play(round.drawnCard!)}>
                Play it
              </button>
              <button type="button" className="fp-btn fp-btn--secondary fp-btn--compact" onClick={c.keep}>
                Keep it
              </button>
            </>
          )}
          {canCall && (
            <button type="button" className="fp-btn fp-btn--success fp-btn--compact chroma-actions__call" onClick={c.callLast}>
              Last card!
            </button>
          )}
          {catchable !== null && (
            <button type="button" className="fp-btn fp-btn--danger fp-btn--compact chroma-actions__catch" onClick={c.catchCpu}>
              Catch {SEAT_NAME[catchable]}!
            </button>
          )}
        </div>

        <p className="chroma__status" role="status" aria-live="polite">
          {statusLine}
        </p>
      </div>

      <div className="chroma__side-bottom">
        <div className="fp-seg" role="group" aria-label="Game length">
          {TARGETS.map((t) => (
            <button key={t} type="button" className="fp-seg__btn" aria-pressed={t === target} onClick={() => t !== target && c.requestNewGame(t)}>
              {TARGET_LABEL[t]}
            </button>
          ))}
        </div>
        {pendingTarget !== null && (
          <ConfirmPrompt
            message={pendingTarget === target ? "Start a new game? This one will be lost." : `Start a new game to ${pendingTarget}? This one will be lost.`}
            confirmLabel="New game"
            onConfirm={c.confirmNewGame}
            onCancel={c.cancelNewGame}
          />
        )}
        <div className="fp-controls">
          <button type="button" className="fp-btn fp-btn--secondary" onClick={() => c.requestNewGame()} disabled={pendingTarget !== null}>
            New game
          </button>
        </div>
        <p className="chroma__record">
          Games: {record.wins}W · {record.losses}L
        </p>
      </div>
    </div>
  );
}

function SeatPanel({ round, seat, live, called }: { round: RoundState; seat: Seat; live: boolean; called: boolean }) {
  const count = round.hands[seat].length;
  const turn = live && round.turn === seat;
  return (
    <div className={`chroma-seat chroma-seat--s${seat}${turn ? " chroma-seat--turn" : ""}`}>
      <span className="chroma-seat__name">{SEAT_NAME[seat]}</span>
      <span className="chroma-seat__cards" aria-label={`${count} ${count === 1 ? "card" : "cards"}`}>
        {/* A small stack: up to three backs, then the count. */}
        <span className="chroma-seat__stack" aria-hidden="true">
          {Array.from({ length: Math.min(count, 3) }, (_, i) => (
            <ChromaCard key={i} faceDown />
          ))}
        </span>
        <span className="chroma-seat__count" aria-hidden="true">
          {count}
        </span>
      </span>
      {called && <span className="chroma-seat__called">Last card</span>}
    </div>
  );
}

/** Laid over the table between rounds (and at the end of the game). */
function RoundSummary({ result, game, onAction }: { result: RoundResult; game: GameState; onAction: () => void }) {
  const { status, scores } = game;
  const tone = status === "won" ? "success" : status === "lost" ? "danger" : "info";
  const winner = result.winner === YOU ? "You win" : `${SEAT_NAME[result.winner]} wins`;
  const title = status === "won" ? "Game won" : status === "lost" ? `${SEAT_NAME[result.winner]} wins the game` : `${winner} the round`;
  return (
    <div className={`chroma-summary chroma-summary--${tone} fp-enter`} role="alert">
      <p className={`fp-result-title fp-result-title--${tone}`}>{title}</p>
      <p className="fp-result-detail chroma-summary__detail">
        +{result.points} to {result.winner === YOU ? "you" : SEAT_NAME[result.winner]}
      </p>
      <table className="chroma-summary__table">
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Cards left</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {([0, 1, 2, 3] as Seat[]).map((seat) => (
            <tr key={seat} className={seat === result.winner ? "chroma-summary__winner" : ""}>
              <th scope="row">{SEAT_NAME[seat]}</th>
              <td>{result.cardsLeft[seat]}</td>
              <td>{scores[seat]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className={`fp-btn ${tone === "info" ? "fp-btn--primary" : "fp-btn--success"}`} onClick={onAction}>
        {status === "playing" ? "Next round" : "New game"}
      </button>
    </div>
  );
}
