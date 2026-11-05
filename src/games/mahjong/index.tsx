import type { GameDefinition } from "../../types/game";
import { Mahjong } from "./Mahjong";

export const definition: GameDefinition = {
  id: "mahjong",
  name: "Mahjong",
  description: "Match free pairs of tiles until the whole stack is cleared.",
  category: "puzzle",
  size: "wide",
  orientation: "any",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default Mahjong;
