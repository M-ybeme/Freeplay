import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import type { GameCategory, GameDefinition } from "../../types/game";
import { GameIcon } from "../GameIcons";
import "./GameCard.css";

interface GameCardProps {
  game: GameDefinition;
  /** Position in the grid, used to stagger the entrance animation. */
  index?: number;
}

/* Each cabinet's marquee and screen glow take their category's colour, so
   a row of machines reads by kind at a glance. */
const CATEGORY_ACCENT: Record<GameCategory, string> = {
  arcade: "var(--hot-pink)",
  cards: "var(--uv-purple-text)",
  puzzle: "var(--laser-blue)",
  word: "var(--toxic)",
  strategy: "var(--orange)",
  idle: "var(--toxic)",
  experimental: "var(--orange)",
};

/*
 * A game on the home floor is a small arcade cabinet: a lit marquee with
 * its name, its icon on a CRT screen, and a control deck. The description
 * is kept for screen readers and as a tooltip rather than as body copy.
 */
export function GameCard({ game, index = 0 }: GameCardProps) {
  const style = { "--i": index, "--accent": CATEGORY_ACCENT[game.category] } as CSSProperties;

  return (
    <Link to={`/game/${game.id}`} className="game-card" style={style} title={game.description}>
      <span className="game-card__marquee">
        <span className="game-card__name">{game.name}</span>
      </span>
      <span className="game-card__screen" aria-hidden="true">
        <GameIcon id={game.id} className="game-card__icon" />
      </span>
      <span className="game-card__deck" aria-hidden="true">
        <span className="game-card__category">{game.category}</span>
        <span className="game-card__start">Press start</span>
      </span>
      <span className="game-card__sr">{game.description}</span>
    </Link>
  );
}
