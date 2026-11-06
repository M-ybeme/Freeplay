import { useRef } from "react";
import { games } from "../../games";
import { GameCard } from "../../components/GameCard/GameCard";
import { useAttract } from "./useAttract";
import "./Home.css";

/*
 * Home is the arcade floor: a neon sign over a row of cabinets, standing
 * on a grid floor that fades into the dark. The floor and glow are purely
 * decorative and sit behind everything.
 */
export function Home() {
  const gridRef = useRef<HTMLDivElement>(null);
  // Attract mode: after a quiet spell, cabinets wake one at a time.
  const awake = useAttract(gridRef, games.length);

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
        <div className="home__grid" ref={gridRef}>
          {games.map((game, i) => (
            <GameCard key={game.definition.id} game={game.definition} index={i} attract={i === awake} />
          ))}
        </div>
      </section>
    </div>
  );
}
