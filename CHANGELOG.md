# Changelog

Notable changes to this project, grouped by commit, **newest first**.
There is no release/version scheme yet (no git tags, and `package.json`'s
`0.1.0` is a placeholder) — entries are keyed by short commit hash instead.

When adding an entry for a new game or feature, copy the pattern below:

```
## `<short-hash>` — <commit subject>

- What changed, in user-facing / architectural terms — not a file list.
- Any abstraction deliberately deferred and why, if it materially
  explains the project's current shape.
```

---

## `5cb22c6` — Implement Higher or Lower as the first complete game

The first fully playable game in Freeplay, replacing its placeholder.

- Pure game logic in `logic.ts`: fixed 1–100 range, tie-rerolling so
  every round has an unambiguous result, and guess evaluation — covered
  by unit tests in `logic.test.ts`.
- `useHigherOrLower.ts`: a hook local to this game owning round/score/
  game-over state and persisting the best score through the existing
  `useGameStorage(gameId, key, initial)` hook.
- `HigherOrLower.tsx` / `.css`: the playable screen — dominant current
  number, Higher/Lower controls, score/best display, game-over panel —
  styled with the established laser-tag/blacklight palette.
- Corrected the game's registry entry (icon, category) now that it's a
  number-guessing game rather than a card game.
- Introduced **vitest** as the project's first test runner, added only
  to test this game's pure logic.
- Everything besides the vitest dependency lives inside
  `src/games/higher-or-lower/`. No shared `ScorePanel`, `MobileControls`,
  or generic game-state framework was added — those stay deferred until
  a second and third game show what's actually common between them.

## `02e7395` — Replace generic Vite README with project-specific one

Swapped the default `create-vite` README for one describing Freeplay
itself: how to run it, and the purpose of each top-level `src/` folder.

## `fb4665b` — Scaffold Freeplay Phase 1 foundation

Initial commit. Stood up the Phase 1 foundation from the project
planning document.

- Vite + React + TypeScript app, with `react-router-dom` for routing
  (`/` home grid, `/game/:gameId` game screen).
- A `GameDefinition` type and a game registry (`src/games/index.ts`)
  so adding a game means adding one folder and one registry line.
- Shared `GameShell` component (back navigation + title) that every
  game renders inside, and a `GameCard` component for the home grid.
- `localStorage`-backed persistence: `services/storage` plus the
  `useGameStorage(gameId, key, initial)` hook, namespaced per game.
- Four placeholder game entries — Higher or Lower, Snake, Blackjack,
  Minesweeper — each a stub proving the registry/routing/shell pattern.
- Global theme (`styles/theme.css`) applying the dark/blacklight color
  palette from the planning doc's visual direction.
- Of the planning doc's proposed structure, only `GameCard`/`GameShell`
  (of the sketched components) and `Home`/`Game` (of the sketched pages)
  were actually built. `GameMenu`, `ScorePanel`, `MobileControls`,
  `Modal`, `Category`, `Favorites`, and `Settings` were left unbuilt —
  the doc itself calls the full structure flexible until real games
  reveal which abstractions are needed.
