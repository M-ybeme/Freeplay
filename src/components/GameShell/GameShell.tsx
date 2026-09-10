import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import "./GameShell.css";

interface GameShellProps {
  title: string;
  children: ReactNode;
}

export function GameShell({ title, children }: GameShellProps) {
  const navigate = useNavigate();

  return (
    <div className="game-shell">
      <header className="game-shell__header">
        <button
          type="button"
          className="game-shell__back"
          onClick={() => navigate("/")}
          aria-label="Back to home"
        >
          ←
        </button>
        <h1 className="game-shell__title">{title}</h1>
      </header>
      <main className="game-shell__content">
        <div className="game-shell__panel">{children}</div>
      </main>
    </div>
  );
}
