export const MIN_VALUE = 1;
export const MAX_VALUE = 100;

export type Guess = "higher" | "lower";

export function randomValue(): number {
  return Math.floor(Math.random() * (MAX_VALUE - MIN_VALUE + 1)) + MIN_VALUE;
}

// Rerolls on a tie so every round has an unambiguous higher/lower outcome.
export function nextValue(current: number): number {
  let value = randomValue();
  while (value === current) {
    value = randomValue();
  }
  return value;
}

export function isCorrectGuess(current: number, revealed: number, guess: Guess): boolean {
  return guess === "higher" ? revealed > current : revealed < current;
}
