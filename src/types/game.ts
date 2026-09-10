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
  icon: string;
  orientation?: "portrait" | "landscape" | "any";
  supportsTouch: boolean;
  supportsKeyboard: boolean;
}
