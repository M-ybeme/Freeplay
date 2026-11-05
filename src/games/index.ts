import type { ComponentType } from "react";
import type { GameDefinition } from "../types/game";
import { definition as higherOrLowerDefinition, default as HigherOrLower } from "./higher-or-lower";
import { definition as snakeDefinition, default as Snake } from "./snake";
import { definition as blackjackDefinition, default as Blackjack } from "./blackjack";
import { definition as minesweeperDefinition, default as Minesweeper } from "./minesweeper";
import { definition as colorSortDefinition, default as ColorSort } from "./color-sort";
import { definition as game2048Definition, default as Game2048 } from "./2048";
import { definition as flowDefinition, default as Flow } from "./flow";
import { definition as solitaireDefinition, default as Solitaire } from "./solitaire";
import { definition as brickBreakerDefinition, default as BrickBreaker } from "./brick-breaker";
import { definition as mahjongDefinition, default as Mahjong } from "./mahjong";

export interface GameEntry {
  definition: GameDefinition;
  Component: ComponentType;
}

export const games: GameEntry[] = [
  { definition: higherOrLowerDefinition, Component: HigherOrLower },
  { definition: snakeDefinition, Component: Snake },
  { definition: blackjackDefinition, Component: Blackjack },
  { definition: minesweeperDefinition, Component: Minesweeper },
  { definition: colorSortDefinition, Component: ColorSort },
  { definition: game2048Definition, Component: Game2048 },
  { definition: flowDefinition, Component: Flow },
  { definition: solitaireDefinition, Component: Solitaire },
  { definition: brickBreakerDefinition, Component: BrickBreaker },
  { definition: mahjongDefinition, Component: Mahjong },
];

export function getGameById(id: string): GameEntry | undefined {
  return games.find((game) => game.definition.id === id);
}
