import type { GameDefinition } from "../../types/game";
import { Flow } from "./Flow";

export const definition: GameDefinition = {
  id: "flow",
  name: "Flow",
  description: "Connect matching signals and fill the entire grid.",
  category: "puzzle",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default Flow;
