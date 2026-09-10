import { games } from "../../games";
import { GameCard } from "../../components/GameCard/GameCard";
import "./Home.css";

export function Home() {
  return (
    <div className="home">
      <header className="home__header">
        <h1 className="home__logo">FREEPLAY</h1>
        <p className="fp-label home__tagline">// SYSTEM STATUS: FREE PLAY</p>
        <hr className="fp-divider home__divider" />
      </header>
      <div className="home__grid">
        {games.map((game) => (
          <GameCard key={game.definition.id} game={game.definition} />
        ))}
      </div>
    </div>
  );
}
