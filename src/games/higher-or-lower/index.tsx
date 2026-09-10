import type { GameDefinition } from "../../types/game";

export const definition: GameDefinition = {
  id: "higher-or-lower",
  name: "Higher or Lower",
  description: "Guess whether the next card is higher or lower.",
  category: "cards",
  icon: "🎴",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default function HigherOrLower() {
  return <p>Higher or Lower is coming soon.</p>;
}
