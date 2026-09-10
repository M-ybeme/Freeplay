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

## `f25a829` — Add project skills and hooks for the established Freeplay workflow

Codifies patterns this project had already been following by hand,
rather than introducing new process. Prompted directly by the gap the
previous entry describes — a Snake speed tweak sat uncommitted and
un-changelogged across a turn boundary until it was noticed and asked
about.

- **Hooks** (`.claude/settings.json`): a `PostToolUse` hook runs the
  test suite after any `src/**/*.ts(x)` edit and blocks with the
  failure output if it doesn't pass. A `Stop` hook prints a non-blocking
  reminder when a turn ends with a dirty working tree.
- Both hook scripts deliberately ignore the JSON payload's `cwd` field
  and rely on their own inherited working directory — a bash-style
  POSIX path (from `$(pwd)` under git-bash) isn't a valid `cwd` for
  native Windows Node, and silently produces an error with empty
  stdout/stderr rather than a useful failure. Also fixed a
  `process.exit()`-truncates-pending-stdio-writes issue on the failure
  path (use `process.exitCode` and let the script end naturally).
- **Skills** (`.claude/skills/`): `new-freeplay-game` (the logic/hook/
  component pattern and architecture guardrails from Higher or Lower
  and Snake), `verify-freeplay-game` (the test/build/dev-server/
  Playwright/live-playtest checklist actually used after each pass),
  and `changelog-and-commit` (the format, the two-commit convention,
  and an explicit pre-completion check for this exact kind of gap).
- Loosened `.gitignore`'s blanket `.claude/` exclusion to just
  `.claude/settings.local.json` and `.claude/scheduled_tasks.lock`, so
  project-level settings/skills/hooks are shared via git rather than
  hidden from it.

## `ad297e5` — Slow Snake's starting speed based on live playtesting feedback

`BASE_TICK_MS` 140 → 190. Playing it live (via the Chrome extension,
with the user driving directly) showed the starting speed already felt
brisk before the score-based ramp-up even began. Progression (4ms
faster per food, 75ms floor) is unchanged — the run-up to max speed is
simply longer now. A reminder of why a hands-on pass matters even after
thorough automated verification: nothing in the test suite or the
Playwright timing checks could have surfaced "this feels too fast."

## `17a448f` — Implement Snake as Freeplay's second complete game

Classic Snake on an 18×18 board (chosen over the brief's suggested ~20
after actually testing cell/touch legibility at 320–390px widths).
Rendered as absolutely-positioned DOM segments over a CSS grid-line
background — no Canvas needed at this scale — inside its own
radar/tactical-display board identity, visually distinct from Higher
or Lower while still built from the shared `fp-*` primitives for chrome
(HUD tiles, buttons, badges, accent backgrounds).

- `logic.ts`: a pure state machine (`ready`/`playing`/`paused`/
  `gameOver`/`won`). A bounded (length-2) direction queue lets a player
  buffer "up then left" as two separate rapid inputs instead of losing
  the first to a stale reversal check against an already-superseded
  direction. `generateFood` enumerates free cells rather than
  rejection-sampling, so it stays correct — and terminates — even on a
  nearly-full board. 28 unit tests cover movement, every reversal/
  buffering rule, growth, food placement (including a full board),
  wall and self collision (including the legal case of moving into the
  tail cell being vacated that same tick), and scoring.
- `useSnake.ts`: a `useReducer`-driven game loop. A single effect keyed
  on `[status, score]` owns the movement `setInterval` and always
  cleans it up, so Strict Mode's mount-cleanup-mount can't double the
  tick rate and leaving/returning to the route can't leak a second
  loop — both verified in-browser by measuring actual elapsed
  time-to-collision rather than trusting the code by inspection alone.
  Keyboard (arrows + WASD + Space/P) and document-visibility auto-pause
  (deliberately does not auto-resume) live in the hook; touch swipe
  lives in the component, since it needs the board's DOM node directly.
- All three input paths — keyboard, swipe, and an on-screen D-pad —
  converge on the same `changeDirection()` call rather than each
  driving game state independently.
- Persists only the best score, through the existing
  `useGameStorage(gameId, key, initial)` hook — no new persistence
  mechanism.

Fixed a real shared bug this game exposed: `GameShell`'s panel had a
`min-height` floor but no `flex-shrink: 0`, so on a short viewport it
could be compressed below what a game's content actually needed —
and because the panel clips overflow, the excess (Snake's D-pad)
simply vanished instead of the content area scrolling to reach it.
Confirmed this fix does not reintroduce Higher or Lower's
previously-fixed game-over layout shift (still measured at 0px).

Deliberately not built: power-ups, enemies, multiple game modes,
difficulty settings, a project-wide input manager, or a generic game
loop/engine — input translation (keyboard/swipe/D-pad → direction)
stays local to Snake, same as the direction-buffering logic, until a
second game needs the identical pattern.

## `37beb9c` — Establish a reusable Freeplay visual language from the UI reference board

Extracted recurring ideas from a visual reference board (`images/ui_elements.png`
— a style guide, not an asset sheet) into a small shared CSS primitive layer
(`src/styles/patterns.css`), then proved it on Home/`GameCard` and Higher or
Lower before Snake inherits it. Higher or Lower's rules/scoring/persistence
are unchanged — only its CSS classes changed to adopt the shared primitives.

- `.fp-panel(--brackets)`: the arcade-console containment (inset surface,
  clipped corners, thin border, top sheen, one restrained corner bracket).
  `GameShell`'s panel now composes this instead of owning its own copy.
- `.fp-btn` + `--primary/--secondary/--success/--danger`: a shared button
  language (hover glow, disabled, shared high-contrast `:focus-visible`
  ring) — replaces Higher or Lower's bespoke button CSS entirely.
- `.fp-badge` + variants: outlined glowing status pills, replacing the old
  solid-fill "New Best" badge.
- `.fp-hud-tile`/`.fp-hud-label`/`.fp-hud-value`: inset digit-readout
  styling for score/stat displays.
- `.fp-label`, `.fp-divider`, `.fp-bg-accent--success/--danger`: a shared
  technical-label style, a restrained divider line, and sparing
  accent-background tints for special moments — used on Higher or Lower's
  game-over panel (danger tint on a plain loss, success tint on a new best).
- Self-hosted **Orbitron** (OFL-1.1, via `@fontsource`, bundled by Vite —
  no runtime font CDN, offline/PWA-safe) applied to headings, the FREEPLAY
  wordmark, and HUD numerals only; body/prompt/description text stays
  system sans-serif.
- Body background gained a faint fixed star/dot field and two low-opacity
  corner glows behind content — restrained atmosphere, not a scene.
- Deliberately not copied from the reference: the literal synthwave grid-
  horizon background variant (contradicts the project's own anti-1980s-
  retro direction), the full gradient/orbital logo treatment (a bespoke
  logo-design task, not a font swap), and most of the decorative-motif
  catalog (starbursts, barcode lines, hash marks, directional arrows) —
  kept to corner brackets + a divider + the background texture to stay
  restrained rather than visually dense.

## `41c57f5` — Refine shared GameShell/GameCard for touch target, contrast, and layout stability

A shell/usability review of the running app (Home + Higher or Lower, mobile
and desktop) surfaced four concrete issues living in shared code — meaning
every future game would have inherited them unfixed. This pass addressed
all four without touching Higher or Lower's rules, scoring, or persistence.

- `GameShell`'s back button measured ~41×36px; now 44×44px.
- Category label text used `--uv-purple` at 4.03:1 contrast (below WCAG
  AA's 4.5:1 for small text). Added `--uv-purple-text`, a lighter tint of
  the same hue, for text use — `--uv-purple` is kept for borders/glows.
  Measured result: 5.26:1.
- `GameShell`'s content area centered vertically, so Higher or Lower's
  number jumped ~28px when the game-over panel (taller than the playing
  controls) replaced it. Content now renders inside a fixed-floor,
  top-anchored panel — a game's leading content sits at a constant offset
  regardless of what renders below it. Measured shift after the fix: 0px,
  across playing/correct/game-over/new-best.
- Hover and keyboard focus were visually identical (same faint box-shadow
  on both). Split into a restrained hover glow plus a distinct
  high-contrast `:focus-visible` outline (new `--focus-ring` token),
  extended to `GameCard` for consistency. Mouse clicks confirmed not to
  trigger the outline (`:focus-visible`, not `:focus`).
- The same panel introduces a restrained arcade-panel containment (inset
  surface, clipped corners, thin border, subtle top sheen) that games
  render inside via `GameShell` rather than floating on bare background —
  the shared surface Snake's board can sit inside too.
- Deliberately deferred: display typography for the FREEPLAY wordmark
  (still plain system sans-serif). Judged to be a branding decision
  needing its own pass — font choice, weight, and offline/self-hosting
  implications — not a small drop-in for a shell-stability pass. Desktop
  home-page whitespace was also left alone, as instructed — expected to
  shrink naturally as the game library grows rather than being padded out
  with filler content now.

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
