import type { GameDefinition } from "../../types/game";
import { Chroma } from "./Chroma";

export const definition: GameDefinition = {
  id: "chroma",
  name: "Chroma Clash",
  description: "Match colour, number or symbol and empty your hand first. You against three computer players.",
  category: "cards",
  size: "wide",
  orientation: "any",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default Chroma;
