import type { GameDefinition } from "../../types/game";
import { BrickBreaker } from "./BrickBreaker";

export const definition: GameDefinition = {
  id: "brick-breaker",
  name: "Brick Breaker",
  description: "Bounce the ball off your paddle and break down every wall.",
  category: "arcade",
  orientation: "portrait",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default BrickBreaker;
