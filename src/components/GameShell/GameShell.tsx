import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import "./GameShell.css";

interface GameShellProps {
  title: string;
  size?: "compact" | "standard" | "wide";
  children: ReactNode;
}

/*
 * Every game runs inside an arcade cabinet: a lit marquee with the game's
 * name, the game itself on a CRT screen, and a control deck with EXIT and
 * the credits readout. All of it is chrome around the panel, so the games
 * themselves don't know or care.
 */
export function GameShell({ title, size = "compact", children }: GameShellProps) {
  const navigate = useNavigate();

  return (
    <div className="game-shell" data-size={size}>
      <header className="game-shell__marquee">
        <h1 className="game-shell__title">{title}</h1>
      </header>
      <main className="game-shell__content">
        <div className="game-shell__panel fp-panel">{children}</div>
      </main>
      <footer className="game-shell__deck">
        <button type="button" className="game-shell__back" onClick={() => navigate("/")} aria-label="Exit to game select">
          <span aria-hidden="true">◄</span> Exit
        </button>
        <span className="game-shell__credits">
          Credits <span className="game-shell__credits-value">Free play</span>
        </span>
      </footer>
    </div>
  );
}
