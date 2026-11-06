import type { GameDefinition } from "../../types/game";
import { Spades } from "./Spades";

export const definition: GameDefinition = {
  id: "spades",
  name: "Spades",
  description: "Partnership trick-taking. You and a computer partner against two computer opponents.",
  category: "cards",
  size: "wide",
  orientation: "any",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default Spades;
