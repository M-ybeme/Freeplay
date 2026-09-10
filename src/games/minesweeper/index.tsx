import type { GameDefinition } from "../../types/game";

export const definition: GameDefinition = {
  id: "minesweeper",
  name: "Minesweeper",
  description: "Clear the board without detonating a mine.",
  category: "puzzle",
  icon: "💣",
  supportsTouch: true,
  supportsKeyboard: false,
};

export default function Minesweeper() {
  return <p>Minesweeper is coming soon.</p>;
}
