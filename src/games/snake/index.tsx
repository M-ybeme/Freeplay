import type { GameDefinition } from "../../types/game";

export const definition: GameDefinition = {
  id: "snake",
  name: "Snake",
  description: "Guide the snake around the board without hitting yourself.",
  category: "arcade",
  icon: "🐍",
  orientation: "any",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default function Snake() {
  return <p>Snake is coming soon.</p>;
}
