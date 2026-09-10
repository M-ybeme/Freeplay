# Freeplay

A personal, ad-free collection of small games. See
[Freeplay_Project_Planning.md](./Freeplay_Project_Planning.md) for the
full vision, principles, and roadmap.

## Development

```bash
npm install
npm run dev
```

## Structure

- `src/games/<id>/` — one folder per game, exporting a `GameDefinition`
  and a default component.
- `src/games/index.ts` — the game registry every game is added to.
- `src/components/GameShell` — the shared chrome every game renders inside.
- `src/pages/Home` — the game grid / landing screen.
- `src/services/storage`, `src/hooks/useGameStorage` — localStorage-backed
  persistence, namespaced per game.
