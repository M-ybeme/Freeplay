import { useState } from "react";
import { readJSON, writeJSON } from "../services/storage/localStorage";

// Namespaces the key by gameId so different games never collide on the same storage key.
export function useGameStorage<T>(gameId: string, key: string, initialValue: T) {
  const storageKey = `freeplay:${gameId}:${key}`;
  const [value, setValue] = useState<T>(() => readJSON(storageKey, initialValue));

  const update = (next: T) => {
    setValue(next);
    writeJSON(storageKey, next);
  };

  return [value, update] as const;
}
