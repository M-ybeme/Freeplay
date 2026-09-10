import { useState } from "react";
import { useGameStorage } from "../../hooks/useGameStorage";
import { isCorrectGuess, nextValue, randomValue, type Guess } from "./logic";

interface Feedback {
  correct: boolean;
  guess: Guess;
  previous: number;
  revealed: number;
}

interface RunState {
  status: "playing" | "gameOver";
  round: number;
  current: number;
  score: number;
  beatBest: boolean;
  feedback: Feedback | null;
}

function newRun(): RunState {
  return {
    status: "playing",
    round: 1,
    current: randomValue(),
    score: 0,
    beatBest: false,
    feedback: null,
  };
}

export function useHigherOrLower() {
  const [best, setBest] = useGameStorage("higher-or-lower", "best-score", 0);
  const [run, setRun] = useState<RunState>(newRun);

  const guess = (guess: Guess) => {
    if (run.status !== "playing") return;

    const revealed = nextValue(run.current);
    const correct = isCorrectGuess(run.current, revealed, guess);
    const feedback: Feedback = { correct, guess, previous: run.current, revealed };

    if (correct) {
      const score = run.score + 1;
      const beatBest = run.beatBest || score > best;
      if (score > best) setBest(score);
      setRun({
        status: "playing",
        round: run.round + 1,
        current: revealed,
        score,
        beatBest,
        feedback,
      });
    } else {
      setRun({ ...run, status: "gameOver", feedback });
    }
  };

  const restart = () => setRun(newRun());

  return {
    round: run.round,
    current: run.current,
    score: run.score,
    best,
    status: run.status,
    feedback: run.feedback,
    isNewBest: run.status === "gameOver" && run.beatBest,
    guess,
    restart,
  };
}
