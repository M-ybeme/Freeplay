import type { GameDefinition } from "../../types/game";
import { Snake } from "./Snake";

export const definition: GameDefinition = {
  id: "snake",
  name: "Snake",
  description: "Guide the snake around the board without hitting yourself.",
  category: "arcade",
  orientation: "any",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default Snake;
