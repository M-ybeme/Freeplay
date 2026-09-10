import { Navigate, useParams } from "react-router-dom";
import { getGameById } from "../../games";
import { GameShell } from "../../components/GameShell/GameShell";

export function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const entry = gameId ? getGameById(gameId) : undefined;

  if (!entry) {
    return <Navigate to="/" replace />;
  }

  const { definition, Component } = entry;

  return (
    <GameShell title={definition.name}>
      <Component />
    </GameShell>
  );
}
