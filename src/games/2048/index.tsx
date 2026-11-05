import type { GameDefinition } from "../../types/game";
import { Game2048 } from "./Game2048";

export const definition: GameDefinition = {
  id: "2048",
  name: "2048",
  description: "Slide and merge matching numbers to build higher tiles.",
  category: "puzzle",
  size: "standard",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default Game2048;
