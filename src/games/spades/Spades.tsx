import { useState, type CSSProperties } from "react";
import { ConfirmPrompt } from "../../components/ConfirmPrompt/ConfirmPrompt";
import { PlayingCard } from "../../components/PlayingCard/PlayingCard";
import { cardName, type Card } from "../../components/PlayingCard/types";
import { chooseBid } from "./ai";
import {
  HAND_SIZE,
  TARGETS,
  legalCards,
  sameCard,
  teamOf,
  type Bid,
  type HandState,
  type Seat,
  type TeamHandResult,
} from "./logic";
import { YOU, useSpades } from "./useSpades";
import "./Spades.css";

const SEAT_NAME: Record<Seat, string> = { 0: "You", 1: "West", 2: "Partner", 3: "East" };
const TARGET_LABEL: Record<number, string> = { 250: "Short · 250", 500: "Full · 500" };

function bidLabel(bid: Bid | null): string {
  if (bid === null) return "—";
  return bid === "nil" ? "Nil" : String(bid);
}

function statusText(hand: HandState, partnerBid: Bid | null): string {
  if (hand.phase === "bidding") {
    if (hand.turn !== YOU) return `${SEAT_NAME[hand.turn]} is bidding…`;
    return partnerBid === null ? "Your bid." : `Your bid. Partner bid ${bidLabel(partnerBid)}.`;
  }
  if (hand.phase === "trick-complete" && hand.trickWinner !== null) {
    return hand.trickWinner === YOU ? "You take the trick." : `${SEAT_NAME[hand.trickWinner]} takes the trick.`;
  }
  if (hand.phase === "playing") {
    if (hand.turn !== YOU) return `${SEAT_NAME[hand.turn]} is playing…`;
    if (hand.trick.length > 0) return "Your turn.";
    const onlySpades = hand.hands[YOU].every((c) => c.suit === "spades");
    return hand.spadesBroken || onlySpades ? "Your lead." : "Your lead. Spades aren't broken yet.";
  }
  return "Hand over.";
}

export function Spades() {
  const { match, record, pendingTarget, bid, play, nextHand, requestNewMatch, confirmNewMatch, cancelNewMatch } = useSpades();
  const { hand, scores, target, status, lastResult } = match;
  const [selected, setSelected] = useState<Card | null>(null);

  const myTurnToPlay = status === "playing" && hand.phase === "playing" && hand.turn === YOU;
  const myTurnToBid = status === "playing" && hand.phase === "bidding" && hand.turn === YOU;
  const legal = myTurnToPlay ? legalCards(hand.hands[YOU], hand.trick, hand.spadesBroken) : [];
  const isLegal = (c: Card) => legal.some((l) => sameCard(l, c));
  // A selection only means something on your own turn.
  const lifted = myTurnToPlay && selected && isLegal(selected) ? selected : null;
  const suggestion = myTurnToBid ? chooseBid(hand, YOU) : null;
  const winner = hand.phase === "trick-complete" ? hand.trickWinner : null;

  function onCard(card: Card) {
    if (!myTurnToPlay || !isLegal(card)) return;
    if (lifted && sameCard(lifted, card)) {
      setSelected(null);
      play(card);
    } else {
      setSelected(card);
    }
  }

  const myCards = hand.hands[YOU];
  const handStyle = { "--n": Math.max(myCards.length, 1) } as CSSProperties;

  return (
    <div className="spades">
      <div className="spades__side-top">
        <div className="spades__scores">
          {([0, 1] as const).map((team) => (
            <div key={team} className={`fp-hud-tile spades__team spades__team--${team === 0 ? "us" : "them"}`}>
              <span className="fp-hud-label">{team === 0 ? "Us" : "Them"}</span>
              <span className="fp-hud-value">{scores[team].score}</span>
              <span className="spades__bags">
                {scores[team].bags} {scores[team].bags === 1 ? "bag" : "bags"}
              </span>
            </div>
          ))}
        </div>
        <p className="fp-label spades__meta">
          // Hand {match.handNumber} · first to {target}
        </p>
      </div>

      <div className="spades__main">
        <div className="spades-table fp-corner-marks" role="group" aria-label="Card table">
          {([2, 1, 3] as Seat[]).map((seat) => (
            <SeatPanel key={seat} hand={hand} seat={seat} />
          ))}

          <div className="spades-trick" aria-label="Cards on the table">
            {hand.trick.map((p) => (
              <div
                key={p.card.rank + p.card.suit}
                className={`spades-trick__card spades-trick__card--s${p.seat}${winner === p.seat ? " spades-trick__card--winner" : ""}`}
              >
                <PlayingCard card={p.card} />
                <span className="spades__sr">played by {SEAT_NAME[p.seat]}</span>
              </div>
            ))}
          </div>

          <div className={`spades-seat spades-seat--s0${hand.turn === YOU && hand.phase !== "trick-complete" && hand.phase !== "hand-over" ? " spades-seat--turn" : ""}`}>
            <span className="spades-seat__name">You</span>
            <SeatStats bid={bidLabel(hand.bids[YOU])} won={hand.tricksWon[YOU]} />
          </div>

          {lastResult && (
            <HandSummary
              results={lastResult}
              title={status === "won" ? "Match won" : status === "lost" ? "Match lost" : "Hand over"}
              tone={status === "won" ? "success" : status === "lost" ? "danger" : "info"}
              actionLabel={status === "playing" ? "Next hand" : "New game"}
              onAction={status === "playing" ? nextHand : () => requestNewMatch()}
            />
          )}
        </div>

        <div className="spades-hand-wrap">
          <div className="spades-hand" style={handStyle} role="group" aria-label="Your hand">
            {myCards.map((card) => {
              const playable = isLegal(card);
              const up = lifted !== null && sameCard(lifted, card);
              return (
                <button
                  key={card.rank + card.suit}
                  type="button"
                  className={`spades-hand__card${up ? " spades-hand__card--lifted" : ""}${myTurnToPlay && !playable ? " spades-hand__card--blocked" : ""}`}
                  aria-disabled={!playable}
                  aria-label={`${cardName(card)}${up ? ", selected. Press again to play" : ""}`}
                  onClick={() => onCard(card)}
                >
                  <PlayingCard card={card} />
                </button>
              );
            })}
          </div>
        </div>

        {myTurnToBid && (
          <div className="spades-bid fp-enter" role="group" aria-label="Your bid">
            <p className="spades-bid__hint">
              How many tricks will you take?{suggestion !== null && <> Suggested: {bidLabel(suggestion)}.</>}
            </p>
            <div className="spades-bid__grid">
              <button type="button" className="fp-btn fp-btn--secondary spades-bid__btn spades-bid__btn--nil" onClick={() => bid("nil")}>
                Nil
              </button>
              {Array.from({ length: HAND_SIZE }, (_, i) => i + 1).map((n) => (
                <button key={n} type="button" className="fp-btn fp-btn--secondary spades-bid__btn" onClick={() => bid(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="spades__status" role="status" aria-live="polite">
          {status === "playing" ? statusText(hand, hand.bids[2]) : ""}
        </p>

      </div>

      <div className="spades__side-bottom">
        <div className="fp-seg" role="group" aria-label="Match length">
          {TARGETS.map((t) => (
            <button key={t} type="button" className="fp-seg__btn" aria-pressed={t === target} onClick={() => t !== target && requestNewMatch(t)}>
              {TARGET_LABEL[t]}
            </button>
          ))}
        </div>
        {pendingTarget !== null && (
          <ConfirmPrompt
            message={pendingTarget === target ? "Start a new game? This one will be lost." : `Start a new game to ${pendingTarget}? This one will be lost.`}
            confirmLabel="New game"
            onConfirm={confirmNewMatch}
            onCancel={cancelNewMatch}
          />
        )}
        <div className="fp-controls">
          <button type="button" className="fp-btn fp-btn--secondary" onClick={() => requestNewMatch()} disabled={pendingTarget !== null}>
            New game
          </button>
        </div>
        <p className="spades__record">
          Matches: {record.wins}W · {record.losses}L
        </p>
      </div>
    </div>
  );
}

/** "Bid 3 · Won 1" on one line, or two lines for the narrow side seats. */
function SeatStats({ bid, won }: { bid: string; won: number }) {
  return (
    <span className="spades-seat__stats">
      <span>Bid {bid}</span>
      <span className="spades-seat__dot" aria-hidden="true">
        {" · "}
      </span>
      <span>Won {won}</span>
    </span>
  );
}

function SeatPanel({ hand, seat }: { hand: HandState; seat: Seat }) {
  const count = hand.hands[seat].length;
  const thinking = hand.turn === seat && (hand.phase === "bidding" || hand.phase === "playing");
  return (
    <div className={`spades-seat spades-seat--s${seat}${teamOf(seat) === 0 ? " spades-seat--partner" : ""}${thinking ? " spades-seat--turn" : ""}`}>
      <span className="spades-seat__name">{SEAT_NAME[seat]}</span>
      <SeatStats bid={hand.phase === "bidding" && hand.bids[seat] === null && thinking ? "…" : bidLabel(hand.bids[seat])} won={hand.tricksWon[seat]} />
      <span className="spades-seat__cards" aria-label={`${count} cards left`}>
        {count > 0 && <PlayingCard faceDown className="spades-seat__back" />}
        <span className="spades-seat__count" aria-hidden="true">
          {count}
        </span>
      </span>
    </div>
  );
}

interface HandSummaryProps {
  results: [TeamHandResult, TeamHandResult];
  title: string;
  tone: "info" | "success" | "danger";
  actionLabel: string;
  onAction: () => void;
}

/** Laid over the table between hands (and at the end of the match). */
function HandSummary({ results, title, tone, actionLabel, onAction }: HandSummaryProps) {
  const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
  const hasNil = results.some((r) => r.nils.length > 0);
  const nilText = (r: TeamHandResult) => (r.nils.length === 0 ? "—" : r.nils.map((made) => (made ? "Made" : "Failed")).join(", "));
  return (
    <div className={`spades-summary spades-summary--${tone} fp-enter`} role="alert">
      <p className={`fp-result-title fp-result-title--${tone}`}>{title}</p>
      <table className="spades-summary__table">
        <thead>
          <tr>
            <th scope="col" />
            <th scope="col">Us</th>
            <th scope="col">Them</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Bid</th>
            {results.map((r, i) => (
              <td key={i}>{r.bid}</td>
            ))}
          </tr>
          <tr>
            <th scope="row">Tricks</th>
            {results.map((r, i) => (
              <td key={i}>{r.tricks}</td>
            ))}
          </tr>
          {hasNil && (
            <tr>
              <th scope="row">Nil</th>
              {results.map((r, i) => (
                <td key={i}>{nilText(r)}</td>
              ))}
            </tr>
          )}
          <tr>
            <th scope="row">Bags</th>
            {results.map((r, i) => (
              <td key={i}>
                {r.bagsAdded > 0 ? `+${r.bagsAdded}` : "0"}
                {r.bagPenalty && <span className="spades-summary__penalty"> −100</span>}
              </td>
            ))}
          </tr>
          <tr className="spades-summary__points">
            <th scope="row">Points</th>
            {results.map((r, i) => (
              <td key={i} className={r.points < 0 ? "spades-summary__neg" : ""}>
                {signed(r.points)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <button type="button" className={`fp-btn ${tone === "info" ? "fp-btn--primary" : "fp-btn--success"}`} onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}
