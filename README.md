# Freeplay

A personal, ad-free, local-first arcade in the browser. No accounts, no
tracking, no monetization — open it, pick a game, play. Built with a
late-1990s/early-2000s laser-tag-arcade, Y2K-futurism visual identity:
very dark surfaces, blacklight accent colors, angular instrument-panel
framing.

Freeplay supplies the machine — routing, the shared shell, local
persistence, the visual language. Each game supplies its own screen.

See [Freeplay_Project_Planning.md](./Freeplay_Project_Planning.md) for
the full vision, principles, and roadmap, and
[CHANGELOG.md](./CHANGELOG.md) for what's actually been built, commit
by commit.

## Games

- **Higher or Lower** — guess whether the next number is higher or lower.
- **Snake** — guide the snake around the board without hitting yourself.
- **Blackjack** — classic blackjack against the dealer, with a shared
  playing-card system built for future card games to reuse.
- **Minesweeper** — clear the board without detonating a mine, styled as
  a hazard-scanner terminal.

## Development

```bash
npm install
npm run dev      # start the dev server
npm test         # run the test suite (vitest)
npm run build    # type-check and production build
npm run preview  # serve the production build locally
```

## Structure

- `src/games/<id>/` — one folder per game, exporting a `GameDefinition`
  and a default component. Game logic stays local to its own folder
  unless a second game concretely justifies sharing it.
- `src/games/index.ts` — the game registry every game is added to.
- `src/components/GameShell` — the shared chrome every game renders inside.
- `src/components/PlayingCard` — the shared card rendering/data system
  used by Blackjack and available to future card games.
- `src/styles/patterns.css`, `src/styles/theme.css` — shared visual
  primitives and theme tokens (panels, buttons, HUD tiles, badges,
  color/typography tokens).
- `src/pages/Home` — the game grid / landing screen.
- `src/services/storage`, `src/hooks/useGameStorage` — localStorage-backed
  persistence, namespaced per game.

## Deployment

Static build deployed on Netlify (`netlify.toml`); installable as a PWA
with offline support after the first visit.

## License

MIT — see [LICENSE](./LICENSE).
