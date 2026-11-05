import type { GameDefinition } from "../../types/game";
import { Reversi } from "./Reversi";

export const definition: GameDefinition = {
  id: "reversi",
  name: "Reversi",
  description: "Outflank to flip discs your colour. Play the computer or a friend.",
  category: "strategy",
  orientation: "any",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default Reversi;
