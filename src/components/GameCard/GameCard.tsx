import { Link } from "react-router-dom";
import type { GameDefinition } from "../../types/game";
import { GameIcon } from "../GameIcons";
import "./GameCard.css";

interface GameCardProps {
  game: GameDefinition;
}

export function GameCard({ game }: GameCardProps) {
  return (
    <Link to={`/game/${game.id}`} className="game-card">
      <GameIcon id={game.id} className="game-card__icon" />
      <span className="game-card__name">{game.name}</span>
      <span className="game-card__description">{game.description}</span>
      <span className="fp-label game-card__category">{game.category}</span>
    </Link>
  );
}
