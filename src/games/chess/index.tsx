import type { GameDefinition } from "../../types/game";
import { Chess } from "./Chess";

export const definition: GameDefinition = {
  id: "chess",
  name: "Chess",
  description: "Full-rules chess. Play the computer at three levels, or a friend.",
  category: "strategy",
  orientation: "any",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default Chess;
