import { games } from "../../games";
import { GameCard } from "../../components/GameCard/GameCard";
import "./Home.css";

/*
 * Home is the arcade floor: a neon sign over a row of cabinets, standing
 * on a grid floor that fades into the dark. The floor and glow are purely
 * decorative and sit behind everything.
 */
export function Home() {
  return (
    <div className="home">
      <div className="home__floor" aria-hidden="true" />

      <header className="home__header">
        <h1 className="home__logo">Freeplay</h1>
        <p className="home__tagline">
          <span className="home__tagline-blink">Insert coin</span>
          <span className="home__tagline-sep" aria-hidden="true">
            ·
          </span>
          <span>No coin needed</span>
        </p>
      </header>

      <section className="home__select" aria-labelledby="home-select-label">
        <div className="home__select-bar">
          <h2 id="home-select-label" className="fp-label home__select-label">
            // Select game
          </h2>
          <p className="fp-label home__select-count">
            {String(games.length).padStart(2, "0")} machines online
          </p>
        </div>
        <div className="home__grid">
          {games.map((game, i) => (
            <GameCard key={game.definition.id} game={game.definition} index={i} />
          ))}
        </div>
      </section>
    </div>
  );
}
