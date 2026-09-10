import { Link } from "react-router-dom";
import type { GameDefinition } from "../../types/game";
import "./GameCard.css";

interface GameCardProps {
  game: GameDefinition;
}

export function GameCard({ game }: GameCardProps) {
  return (
    <Link to={`/game/${game.id}`} className="game-card">
      <span className="game-card__icon" aria-hidden="true">
        {game.icon}
      </span>
      <span className="game-card__name">{game.name}</span>
      <span className="game-card__description">{game.description}</span>
      <span className="fp-label game-card__category">{game.category}</span>
    </Link>
  );
}
