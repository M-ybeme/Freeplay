import type { GameDefinition } from "../../types/game";
import { Minesweeper } from "./Minesweeper";

export const definition: GameDefinition = {
  id: "minesweeper",
  name: "Minesweeper",
  description: "Clear the board without detonating a mine.",
  category: "puzzle",
  size: "standard",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default Minesweeper;
