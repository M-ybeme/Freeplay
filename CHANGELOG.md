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

## `6e84af3` — Document the organic-growth roadmap: next four games

Planning/documentation only — no implementation. Freeplay has entered
Phase 7 ("Grow Organically"), and this records the concrete plan for
it rather than leaving that phase undocumented.

- `Freeplay_Project_Planning.md`'s milestones section now marks
  Phases 1-6 (foundation through PWA) complete.
- New Section 29 documents the next four games — **Color Sort, 2048,
  Flow, Solitaire**, in that order — with the reasoning behind the
  order and the design/technical constraints already known for each:
  guaranteed-solvable procedural generation for Color Sort and Flow
  (construct from a known-solvable state, don't random-then-verify),
  2048's rules and its explicit exemption from any solvability
  guarantee, and Solitaire's two deliberate choices — traditional
  (not-always-winnable) Klondike deals for v1, and reusing the
  existing `PlayingCard` system rather than building a second card
  system.
- Documents explicit architecture guardrails against premature
  abstraction across the four (no shared `PuzzleEngine`/`GridGame`/
  `SolverFramework`/etc.) — two games needing solvable generation, or
  two using a grid, is not evidence they share structure.

---

## `1fd03fc` — Fix Minesweeper flags not sticking on real touchscreens

Reported from real-phone testing: tapping a cell in Flag mode (or
releasing a long-press) briefly flagged it and then immediately
unflagged it again — flags never visibly stuck.

- **Root cause**: a touch tap fires the full Pointer Events sequence
  Minesweeper uses (down/move/up) *and* a trailing synthetic `click`
  a moment later (standard touch/mouse compatibility behavior), which
  also ran through `onClick`'s `interact()` call. In Flag mode that's
  `toggleFlag` firing twice per tap. Never caught before because prior
  testing used either mouse `.click()` or manually dispatched pointer
  events — neither triggers a browser's real synthetic click; only
  actual hardware touch (or CDP-injected touch) does.
- `preventDefault()` in the pointer handlers did not reliably suppress
  the trailing click (confirmed via diagnostic — Chromium still fired
  it for a CDP-synthesized touch). Fixed instead with an explicit
  guard: a ref set on every touch `pointerdown`, cleared by `onClick`,
  so `onClick` ignores exactly the one synthetic click that follows a
  touch interaction the pointer-event path already handled — correct
  regardless of engine-specific click-suppression behavior.
- Added `-webkit-touch-callout: none` so iOS's press-and-hold callout
  can't hijack a long-press before the timer fires.
- Verified with real touch simulation (CDP touch events): tap-to-flag
  sticks, a second tap unflags cleanly, long-press flags without also
  revealing, a quick reveal-mode tap still reveals, a move-past-
  threshold drag still cancels cleanly, and the Expert board's
  horizontal touch-scroll is unaffected.

---

## `6e47fc6` — Expand README and add MIT license

README now explains what Freeplay is, lists the four games, and
documents the available npm scripts and shared-code structure instead
of just the structure section. Adds an MIT `LICENSE` and a `license`
field in `package.json`.

---

## `8522d89` — Add PWA support: installable, offline-capable via vite-plugin-pwa

Freeplay is now installable and works offline after one online visit,
using the standard Vite PWA route (`vite-plugin-pwa`'s `generateSW`
mode) rather than a hand-authored service worker — one of the rare
cases where a new dependency is justified, since precaching, manifest
integration, and update behavior are real repeated PWA concerns, not
Freeplay-specific logic.

- Precaches the JS/CSS bundle, self-hosted Orbitron font files, and
  all icons at build time. No runtime caching rules, no API/data
  layer — the app has no backend to account for.
- `registerType: 'autoUpdate'` (skipWaiting + clientsClaim): a
  redeploy reaches an already-open tab automatically on its next load
  — no update prompt, no manual cache clearing. Verified by simulating
  a redeploy against a live preview server and confirming an open tab
  picked up the new build within about a second.
- New manifest (name/short_name/description, `display: standalone`,
  theme/background color matching the app's void background, no
  forced orientation) and a new icon set (192/512/maskable PNGs +
  apple-touch-icon), derived from one new SVG mark — a geometric
  laser-blue "F" on the void background. The prior `favicon.svg` was
  an unrelated purple abstract shape that didn't reference Freeplay or
  its established palette, so it was replaced rather than adapted.
- `index.html` gains theme-color/description meta tags and an
  apple-touch-icon link; no other markup changes.
- No safe-area (`env(safe-area-inset-*)`) handling was added — the
  viewport meta doesn't set `viewport-fit=cover`, so iOS already
  reserves notch/home-indicator space by default and there was nothing
  to fix.

Verified: offline reload and direct-URL refresh work for Home and all
four games (client-side routing intact); Orbitron loads offline with
no fallback; gameplay and localStorage persistence work fully offline;
zero console/network errors across a full mixed online+offline session
at 320/390/768/1440px. Netlify's existing SPA-fallback redirect is
untouched and unaffected, since `sw.js`/manifest/icons are real files
Netlify serves before the wildcard rule applies.

No install-prompt UI, no update modal, no IndexedDB, no push
notifications, no forced portrait orientation.

---

## `983bf6a` — Fix corner-index readability on the shared playing card

The rank/suit corner index on `PlayingCard` was already a centered flex
column, so horizontal alignment was never the actual problem. The real
bug was the rank-to-suit gap: 1cqw, which rounds to well under a pixel
at realistic hand sizes, so the suit glyph read as touching the rank on
every card. Most visible on "10" specifically, since two digit glyphs
sitting right above the icon read as more crowded than one character
even with the identical gap.

- Widened the gap to a proportionally meaningful 4cqw.
- Gave the two-character "10" rank a dedicated, modestly reduced
  size/tracking (`.playing-card__rank--ten`) so its footprint and
  visual weight land close to a single-character rank instead of
  dominating the corner.
- Verified across all 52 rank/suit combinations, both indexes, five
  card widths (42-96px), and a heavily overlapping Blackjack hand where
  only a card's corner sliver is visible. No accessible-name or
  hidden-card semantics changed.

---

## `96fcb91` — Cross-game consistency pass and Netlify deploy config

A polish pass across all four completed games (Higher or Lower, Snake,
Blackjack, Minesweeper) plus Home/GameShell, done by actually playing
through every game at 320/390/768/1440px rather than reading CSS and
guessing what "should" be shared. Deliberately conservative: most of
what the audit checked (HUD tiles, buttons, panel widths, action
terminology, decorative motifs, icon family, layout-shift, persistence,
lifecycle, accessibility, reduced motion) held up and was left alone.

- **Fixed:** a real 320px-only bug in Higher or Lower — the "Higher"
  button's CSS grid track blew out past its content's intrinsic width
  (grid items default to `min-width: auto`) and the overflow was
  silently clipped by the panel's `overflow: hidden`, cutting off the
  button's right border invisibly. A page-level horizontal-overflow
  check didn't catch it, since the clipping panel absorbs it before it
  reaches the document. Fixed with `min-width: 0` on the grid item plus
  slightly tighter padding/letter-spacing so the label fits.
- **Shared:** `.fp-result-title` (+ `--success`/`--danger`/`--info`)
  and `.fp-result-detail` in `patterns.css`. All four games had
  independently written the same font/size/weight/letter-spacing/color
  treatment for their round-end heading and detail line — genuine
  convergent duplication across all four, not a coincidence of a few
  shared properties. Each game keeps its own result markup, layout,
  and accent logic; only the text treatment moved.
- **Left alone:** the shared shell/panel-width strategy (no game is
  fighting it with overrides, so no `size="compact"/"wide"` API was
  added); action-label wording (Play Again / Deal Again / New Game are
  contextual, not inconsistent); the icon family, decorative motifs,
  and HUD styling (already healthy); Blackjack's compact lifetime-stats
  row (a different concept from a live score, correctly not forced
  into a generic HUD tile).
- Adds `netlify.toml` (build command, `dist` publish dir, SPA fallback
  redirect to `index.html`) — deployment config only, no SDKs, plugins,
  functions, or new dependencies.

---

## `cebbaf9` — Implement Minesweeper as Freeplay's fourth complete game

Minesweeper as Freeplay's fourth complete game, styled as a hazard
scanner / bomb-disposal terminal rather than a classic Windows-95
board. Pure/testable logic, no shared abstractions extracted — nothing
about this game generalized cleanly to the other three.

- **Board logic** (`logic.ts`) — pure `createEmptyBoard`/`placeMines`/
  `revealCell`/`toggleFlag`, an iterative (non-recursive, index-cursor
  queue) flood fill, and first-click safety: the clicked cell plus its
  full neighborhood is excluded from mine placement where the board
  has room, degrading gracefully (clicked cell only, then no exclusion)
  on boards too small or dense for a full exclusion zone. Mines are
  placed lazily on the first reveal, merging in any flags set
  beforehand rather than discarding them.
- **Three difficulty presets** — Beginner (9×9/10) and Intermediate
  (16×16/40) match the classic values. Expert is reshaped to **24×20
  (480 cells) at 99 mines** rather than the classic 30×16 — identical
  cell count and mine density, just a less extreme aspect ratio so it
  stays usable on a phone instead of forcing a very short, very wide
  board.
- **Input** — mouse click/right-click for reveal/flag; touch uses
  Pointer Events with a ~420ms long-press-to-flag, cancelled if the
  pointer moves past a small tolerance (so a scroll or drag never also
  fires a reveal), fully separate from the mouse handlers so neither
  path can double-fire. A Reveal/Flag mode toggle covers touch devices
  where long-press is impractical. The board also supports full
  keyboard play: arrow-key roving-focus grid navigation, Enter/Space to
  reveal, F to flag.
- **Timer** — starts on first reveal, stops incrementing (without a
  separate "paused" state) while `document.hidden`, via a plain
  `setInterval` that just skips ticking rather than tearing down and
  rebuilding around a visibility listener.
- **Persistence** — best time per difficulty only (`useGameStorage`),
  not full board/session state — a fresh page load always starts a new
  game.
- **Visual identity** — dot-matrix/grid-line board background, 2-corner
  `fp-corner-marks` framing (reused from Snake/Home rather than
  redefined), a small pennant-shaped flag and a compact core+ring mine
  glyph (no cartoon bomb), and a distinct dark "hazard void" treatment
  for the specific mine that ended the game vs. the merely-revealed
  others. Reuses `fp-panel`, `fp-btn`, `fp-hud-tile`, and theme tokens
  throughout — no new shared primitives were needed.
- Responsive board sizing is CSS-only (`minmax()` grid tracks per
  difficulty), with a horizontal-scroll fallback for Expert on narrow
  viewports — fixed a real bug where `justify-content: center` on the
  scroll wrapper made the left half of an overflowing board
  unreachable, since `scrollLeft` can't go negative.

No changes to Higher or Lower, Snake, or Blackjack, and no new shared
abstraction beyond what `GameIcons` and `PlayingCard` already cover.

---

## `5675792` — Implement Blackjack and a shared Freeplay playing-card system

Blackjack as Freeplay's third complete game, and the first to establish
shared infrastructure other card games can reuse without modification.

- **Shared playing-card system** (`src/components/PlayingCard/`) — the
  one abstraction explicitly justified here, since it's a visual/data
  representation, not speculative game logic: `types.ts` (Suit/Rank/Card
  + accessible-name helpers), `deck.ts` (pure, seedable `createDeck()` +
  Fisher-Yates `shuffle()`), four hand-authored `SuitIcon` glyphs
  (currentColor, matching the existing game-icon line language — no
  emoji, no library), and `PlayingCard.tsx`/`.css`. A card renders from
  `{rank, suit}` data, or face-down using the shared Freeplay back
  (cyan/UV-purple crosshatch, angular inset frame, glowing "FP" mark)
  when **no card data is passed at all** — the hidden dealer card's
  rank/suit never reaches the DOM before reveal. Pip layouts for 2–10, a
  large centered mark for Ace, stylized letter+icon+label composition
  for J/Q/K (no illustrated court art). Every internal element sizes via
  container-query (`cqw`) units against `--pc-width`, so one component
  scales from a packed mobile hand to a full desktop card with no
  separate variants.
- New theme tokens `--card-face`/`-2`, `--card-ink`, `--card-red` —
  cards are a pale surface, which inverts the rest of the app's
  dark-on-light contrast direction. The existing neon `--hot-pink`
  measured 2.55:1 against the pale card face; `--card-red` (#b3005c)
  measures 5.46:1.
- **Blackjack** (`src/games/blackjack/`) keeps rules local: pure hand
  scoring (ace-as-11-then-demote-as-needed, soft/hard, natural blackjack
  is specifically a 2-card 21), dealer stands on all 17s including soft,
  and a reducer over explicit round states (player-turn / dealer-reveal
  / dealer-turn / round-over). Dealer reveal and each draw are paced
  with a short `setTimeout` (collapsed to ~0ms under
  `prefers-reduced-motion`). Lifetime stats (wins/losses/pushes/
  blackjacks) persist via the existing `useGameStorage`, counted exactly
  once per round via a ref guarding by round-transition rather than by
  outcome value (so two identical outcomes in a row both count — an
  earlier, wrong version of this guard would have skipped the second).
- Table surface is a dark holographic dealer/player layout (not felt),
  with a responsive overlapping hand layout that scales card size and
  overlap by hand length, built from the existing `fp-btn`/`fp-badge`/
  `fp-bg-accent` language for controls and results.
- 84 tests total (12 shared card-system + 39 Blackjack logic, on top of
  the existing 33). Verified in-browser: every outcome type displays
  correctly (sampled over 60+ real rounds plus a targeted run for dealer
  blackjack specifically), hidden-card DOM inspection confirmed zero
  rank/suit leakage before reveal, hand overlap verified at 2/3/5/7/9
  cards with no horizontal overflow, stats persistence confirmed across
  reload, reduced-motion confirmed (~40ms resolution vs 500ms+ normal).
- Deliberately deferred: betting/chips/currency, insurance, surrender,
  splitting, double-down, multiple simultaneous hands, and difficulty
  modes — v1 is single-hand Blackjack against a dealer, nothing more.

## `56be361` — Visual personality pass: custom icons, arcade framing, radar board

Pushed Freeplay's Y2K/laser-tag identity further via geometry and
technical detailing rather than more glow, after manual review judged
the app read as a polished launcher more than a distinct arcade
interface. Background intensity is unchanged.

- Replaced all four emoji game icons with hand-authored SVGs
  (`src/components/GameIcons/`): opposing cyan/UV-purple chevrons for
  Higher or Lower, a dashed angular polyline with a filled head+eye for
  Snake (echoing its own in-game rendering), two overlapping corner-cut
  card silhouettes with a diamond pip for Blackjack, and a hot-pink
  diamond ring with orange ticks for Minesweeper (a radar contact, not a
  cartoon bomb). All four share a 32×32 viewBox, consistent line weight,
  and a stroke-linework-plus-one-filled-accent construction.
  `GameDefinition.icon` (the emoji string) is removed entirely —
  `GameCard` looks the icon up by game id instead.
- Home: the grid gained a `// Select game` / `NN games online` header bar
  over a divider, and the grid itself sits in a light frame with corner
  marks — reads as a console selection area, not a bare card list.
- `GameCard`: a small top-right corner tick, a background shift plus icon
  brightness bump on hover, and a larger icon as the primary anchor.
- Higher or Lower: a second panel corner bracket (bottom-right) and a
  small `HL-01` identifier folded into the existing round-counter line —
  no new rows, no change to the number's dominance.
- Snake: stronger grid-line and new dot-matrix board texture, a small
  "Grid 18×18" corner readout, and D-pad buttons that gained the angular
  corner-cut language, a laser-blue static tint, and a more tactile
  pressed state.
- Shared (`patterns.css`): `.fp-corner-marks` (two-corner L-bracket
  framing — Home's grid and Snake's board both use it) and a second
  corner on `.fp-panel--brackets` (top-left + bottom-right, benefiting
  every game's outer shell uniformly, not just Higher or Lower). Moved
  the panel's top-sheen from `::before` onto the element's own
  `background` so both pseudo-elements stay free for the two
  brackets — a real conflict hit while implementing this (a surface only
  has two pseudo-element slots), not a hypothetical one.
- Deliberately not added: a four-corner bracket treatment (only two
  pseudo-elements exist per surface — two opposite corners is the
  honest ceiling without extra DOM nodes), any decorative motif beyond
  corner marks and small labels, per-cell board coordinates, or any
  change to Snake's rules/speed or Higher or Lower's logic.

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
