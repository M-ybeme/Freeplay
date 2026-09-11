import type { GameDefinition } from "../../types/game";
import { ColorSort } from "./ColorSort";

export const definition: GameDefinition = {
  id: "color-sort",
  name: "Color Sort",
  description: "Pour tubes to gather each color into one place.",
  category: "puzzle",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default ColorSort;
