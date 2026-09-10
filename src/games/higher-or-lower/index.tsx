import type { GameDefinition } from "../../types/game";
import { HigherOrLower } from "./HigherOrLower";

export const definition: GameDefinition = {
  id: "higher-or-lower",
  name: "Higher or Lower",
  description: "Guess whether the next number is higher or lower.",
  category: "arcade",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default HigherOrLower;
