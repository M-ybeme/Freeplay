import type { ComponentType } from "react";
import { HigherOrLowerIcon } from "./HigherOrLowerIcon";
import { SnakeIcon } from "./SnakeIcon";
import { BlackjackIcon } from "./BlackjackIcon";
import { MinesweeperIcon } from "./MinesweeperIcon";
import { ColorSortIcon } from "./ColorSortIcon";
import { Game2048Icon } from "./Game2048Icon";
import { FlowIcon } from "./FlowIcon";
import { SolitaireIcon } from "./SolitaireIcon";
import { BrickBreakerIcon } from "./BrickBreakerIcon";

interface IconProps {
  className?: string;
}

const icons: Record<string, ComponentType<IconProps>> = {
  "higher-or-lower": HigherOrLowerIcon,
  snake: SnakeIcon,
  blackjack: BlackjackIcon,
  minesweeper: MinesweeperIcon,
  "color-sort": ColorSortIcon,
  "2048": Game2048Icon,
  flow: FlowIcon,
  solitaire: SolitaireIcon,
  "brick-breaker": BrickBreakerIcon,
};

interface GameIconProps extends IconProps {
  id: string;
}

export function GameIcon({ id, className }: GameIconProps) {
  const Icon = icons[id];
  if (!Icon) return null;
  return <Icon className={className} />;
}
