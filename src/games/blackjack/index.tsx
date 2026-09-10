import type { GameDefinition } from "../../types/game";

export const definition: GameDefinition = {
  id: "blackjack",
  name: "Blackjack",
  description: "Classic blackjack against the dealer.",
  category: "cards",
  icon: "🂡",
  supportsTouch: true,
  supportsKeyboard: false,
};

export default function Blackjack() {
  return <p>Blackjack is coming soon.</p>;
}
