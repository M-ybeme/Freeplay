import type { GameDefinition } from "../../types/game";
import { Solitaire } from "./Solitaire";

export const definition: GameDefinition = {
  id: "solitaire",
  name: "Solitaire",
  description: "Build alternating runs and move every card to the foundations.",
  category: "cards",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default Solitaire;
