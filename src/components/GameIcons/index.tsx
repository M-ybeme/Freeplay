import type { ComponentType } from "react";
import { HigherOrLowerIcon } from "./HigherOrLowerIcon";
import { SnakeIcon } from "./SnakeIcon";
import { BlackjackIcon } from "./BlackjackIcon";
import { MinesweeperIcon } from "./MinesweeperIcon";

interface IconProps {
  className?: string;
}

const icons: Record<string, ComponentType<IconProps>> = {
  "higher-or-lower": HigherOrLowerIcon,
  snake: SnakeIcon,
  blackjack: BlackjackIcon,
  minesweeper: MinesweeperIcon,
};

interface GameIconProps extends IconProps {
  id: string;
}

export function GameIcon({ id, className }: GameIconProps) {
  const Icon = icons[id];
  if (!Icon) return null;
  return <Icon className={className} />;
}
