export type GameCategory =
  | "arcade"
  | "cards"
  | "puzzle"
  | "word"
  | "strategy"
  | "idle"
  | "experimental";

export interface GameDefinition {
  id: string;
  name: string;
  description: string;
  category: GameCategory;
  orientation?: "portrait" | "landscape" | "any";
  /**
   * Largest the cabinet screen may grow (a cap, not a fixed size):
   * compact 560px for simple games, standard 680px for single-board
   * games, wide 1040px for complex boards. Defaults to compact.
   */
  size?: "compact" | "standard" | "wide";
  /**
   * Most people who can play on one device (hot-seat). Defaults to 1;
   * games above 1 show a player tag on their home cabinet.
   */
  maxPlayers?: number;
  supportsTouch: boolean;
  supportsKeyboard: boolean;
}
