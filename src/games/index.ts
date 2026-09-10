import type { ComponentType } from "react";
import type { GameDefinition } from "../types/game";
import { definition as higherOrLowerDefinition, default as HigherOrLower } from "./higher-or-lower";
import { definition as snakeDefinition, default as Snake } from "./snake";
import { definition as blackjackDefinition, default as Blackjack } from "./blackjack";
import { definition as minesweeperDefinition, default as Minesweeper } from "./minesweeper";

export interface GameEntry {
  definition: GameDefinition;
  Component: ComponentType;
}

export const games: GameEntry[] = [
  { definition: higherOrLowerDefinition, Component: HigherOrLower },
  { definition: snakeDefinition, Component: Snake },
  { definition: blackjackDefinition, Component: Blackjack },
  { definition: minesweeperDefinition, Component: Minesweeper },
];

export function getGameById(id: string): GameEntry | undefined {
  return games.find((game) => game.definition.id === id);
}
