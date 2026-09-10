import type { GameDefinition } from "../../types/game";
import { Blackjack } from "./Blackjack";

export const definition: GameDefinition = {
  id: "blackjack",
  name: "Blackjack",
  description: "Classic blackjack against the dealer.",
  category: "cards",
  supportsTouch: true,
  supportsKeyboard: false,
};

export default Blackjack;
