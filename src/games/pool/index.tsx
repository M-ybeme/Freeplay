import type { GameDefinition } from "../../types/game";
import { Pool } from "./Pool";

export const definition: GameDefinition = {
  id: "pool",
  name: "8-Ball",
  description: "Classic 8-ball pool with spin. Play the computer at any skill level, or a friend on the same screen.",
  category: "arcade",
  size: "wide",
  orientation: "any",
  maxPlayers: 2,
  supportsTouch: true,
  supportsKeyboard: true,
};

export default Pool;
