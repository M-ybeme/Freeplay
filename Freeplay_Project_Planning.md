# Freeplay --- Project Planning Document

> **Working title:** Freeplay\
> **Project type:** Mobile-first personal mini-game collection\
> **Primary goal:** Build a clean, ad-free collection of small games
> that are quick to open, pleasant to play, and work well on both mobile
> and desktop.

------------------------------------------------------------------------

## 1. Project Vision

Freeplay is a personal web-based arcade containing small games that are
normally buried behind ads, tracking, subscriptions, energy systems,
popups, or other unnecessary friction.

The project should feel more like opening a handheld game collection
than visiting a modern casual-game website:

1.  Open Freeplay.
2.  Pick a game.
3.  Play.

No account should be required. No internet connection should be required
after installation where practical. Games should save relevant settings,
progress, and high scores locally.

Freeplay is intentionally **not** meant to become a large platform.
Individual games can remain simple recreations of familiar game
concepts. The value of the project is the collection, the interface, and
having versions of these games built specifically around personal
preferences.

------------------------------------------------------------------------

## 2. Core Principles

### Mobile First

Every game should be designed around touch controls first and enhanced
for mouse and keyboard second.

Games should:

-   Use large, comfortable touch targets.
-   Avoid hover-only interactions.
-   Avoid controls requiring excessive precision.
-   Support portrait mode by default when appropriate.
-   Support landscape mode when it materially improves the game.
-   Scale cleanly to tablets and desktop displays.
-   Provide keyboard controls on desktop when they improve the
    experience.

### Instant Play

Getting into a game should require as little interaction as possible.

Avoid:

-   Mandatory setup screens.
-   Accounts.
-   Tutorials that cannot be skipped.
-   Excessive menus.
-   Confirmation dialogs for trivial actions.
-   Artificial delays.

### No Monetization Mechanics

Freeplay should contain:

-   No ads.
-   No premium currency.
-   No paid lives.
-   No energy systems.
-   No artificial cooldowns.
-   No engagement notifications.
-   No "watch an ad to continue" mechanics.
-   No dark patterns.

### Local First

Game state should remain on the device whenever practical.

Potential locally stored data includes:

-   High scores.
-   Game settings.
-   Audio preferences.
-   Current games.
-   Statistics.
-   Favorite games.
-   Recently played games.

### Keep It Small

A new game does not need to justify itself as a standalone application.

If a game is fun, useful, or interesting enough to play occasionally, it
can belong in Freeplay.

Do not turn every game into a major development project.

------------------------------------------------------------------------

## 3. Proposed Technology

### Application

-   **React**
-   **TypeScript**
-   **Vite**
-   Responsive CSS
-   React Router or equivalent lightweight routing

### Persistence

Start with:

-   `localStorage` for simple preferences, scores, and settings.

Introduce IndexedDB only when a game has enough persistent state to
justify it.

### Deployment

A static host such as Netlify is sufficient because the initial
application should require no backend.

### Progressive Web App

Freeplay should eventually be installable as a **PWA**.

Desired PWA behavior:

-   Installable on a phone home screen.
-   Standalone application presentation.
-   Cached application shell.
-   Offline access to installed games.
-   Local persistence.
-   Appropriate mobile icons and manifest metadata.

PWA support does not need to block the first playable version.

------------------------------------------------------------------------

## 4. Application Structure

A possible project structure:

``` text
src/
├── app/
│   ├── router/
│   └── providers/
│
├── components/
│   ├── GameCard/
│   ├── GameShell/
│   ├── GameMenu/
│   ├── ScorePanel/
│   ├── MobileControls/
│   └── Modal/
│
├── games/
│   ├── snake/
│   ├── blackjack/
│   ├── minesweeper/
│   └── ...
│
├── hooks/
│   ├── useGameStorage.ts
│   ├── useGameSettings.ts
│   └── useSound.ts
│
├── pages/
│   ├── Home/
│   ├── Category/
│   ├── Favorites/
│   └── Settings/
│
├── services/
│   └── storage/
│
├── styles/
│
└── types/
```

The exact structure should remain flexible until the needs of several
games reveal which abstractions are actually useful.

------------------------------------------------------------------------

## 5. Game Definition

Each game should expose common metadata so Freeplay can automatically
build navigation and discovery interfaces.

Example:

``` ts
interface GameDefinition {
  id: string;
  name: string;
  description: string;
  category: GameCategory;
  icon: string;
  route: string;
  orientation?: "portrait" | "landscape" | "any";
  supportsTouch: boolean;
  supportsKeyboard: boolean;
}
```

Additional metadata can be added later for:

-   Favorites.
-   Recently played.
-   Number of players.
-   Average game length.
-   Tags.
-   Version.
-   Game-specific statistics.

The goal is for adding a new game to require minimal modification
outside that game's own folder.

------------------------------------------------------------------------

## 6. Shared Game Shell

All games should run inside a common `GameShell`.

The shell can provide consistent access to:

-   Back/home navigation.
-   Game title.
-   Restart/new game.
-   Pause when relevant.
-   Rules/help.
-   Sound controls.
-   Game-specific settings.
-   Score/statistics.
-   Fullscreen or expanded presentation where supported.

The shell should stay out of the way during play, particularly on small
screens.

Games should be allowed to hide unnecessary shell controls.

------------------------------------------------------------------------

## 7. Game Categories

Initial categories could include:

### Arcade

Short, reaction-oriented games.

Examples:

-   Snake
-   Breakout
-   Pong
-   Asteroids-inspired shooter
-   Flappy-style game
-   Simple endless runner

### Cards & Casino

Games involving cards, dice, or casino-style mechanics using entirely
fictional currency where currency is useful.

Examples:

-   Blackjack
-   Solitaire
-   War
-   Higher or Lower
-   Poker variants
-   Video poker
-   Yahtzee
-   Farkle
-   Liar's Dice

### Puzzle

Games focused on logic and problem solving.

Examples:

-   Minesweeper
-   Sudoku
-   2048
-   Lights Out
-   Sliding puzzle
-   Nonogram
-   Memory matching

### Word & Trivia

Examples:

-   Word guessing game
-   Hangman
-   Trivia
-   Anagrams
-   Word search

### Strategy

Examples:

-   Checkers
-   Connect Four
-   Tic-Tac-Toe variants
-   Small grid strategy games
-   Simple tower defense
-   Lightweight turn-based games

### Idle / Time Killers

Examples:

-   Incremental game
-   Tiny management game
-   Simple idle RPG
-   Number-growth games

### Original / Experimental

A home for ideas that do not fit elsewhere.

This could eventually include:

-   D&D-inspired dice games.
-   Procedural dungeon challenges.
-   Combat experiments.
-   Tiny RPG systems.
-   Programming experiments that happen to be fun.

Categories should emerge from the actual library rather than becoming
requirements to fill.

------------------------------------------------------------------------

## 8. Home Screen

The home screen should prioritize getting into a game quickly.

Potential sections:

-   **Continue Playing**
-   **Recently Played**
-   **Favorites**
-   **All Games**
-   Category shortcuts

For the earliest version, a simple responsive game grid is sufficient.

Each game card could show:

-   Icon/art.
-   Name.
-   Short description.
-   Category.

Avoid filling the interface with metadata that does not help choose a
game.

------------------------------------------------------------------------

## 9. Responsive Design

### Mobile

Mobile is the primary target.

Design around:

-   Thumb-friendly navigation.
-   44px+ touch targets where practical.
-   Minimal persistent navigation.
-   No horizontal page overflow.
-   Game boards that adapt to available width.
-   Preventing accidental browser gestures where appropriate without
    breaking normal navigation.

### Desktop

Desktop should enhance rather than replace the mobile experience.

Possible enhancements:

-   Wider game grids.
-   Keyboard shortcuts.
-   Larger game boards.
-   Side panels for statistics/settings when space permits.
-   Mouse-specific interactions where useful.

The same game logic should power both layouts.

------------------------------------------------------------------------

## 10. Input Architecture

Games should not tightly couple their logic to a specific input device.

Where useful, translate physical input into game actions:

``` text
Touch / Keyboard / Mouse
          ↓
     Game Actions
          ↓
      Game Logic
```

For example, Snake should understand:

``` ts
move("up");
move("down");
move("left");
move("right");
```

rather than making its core game logic directly dependent on keyboard
events.

This makes mobile and desktop controls substantially easier to support
together.

------------------------------------------------------------------------

## 11. Game State

Where practical, separate game state from rendering.

A game should generally have:

``` text
Input
  ↓
Game Logic
  ↓
Game State
  ↓
UI
```

This makes it easier to:

-   Restart games.
-   Save games.
-   Test game logic.
-   Add alternate controls.
-   Add difficulty settings.
-   Potentially add simple AI opponents.

Not every tiny game needs an elaborate state architecture. Use the
simplest implementation that remains understandable.

------------------------------------------------------------------------

## 12. Shared Features

These should be introduced gradually rather than built before the first
games exist.

### High Scores

A shared system could track:

-   Best score.
-   Best time.
-   Fewest moves.
-   Win streak.
-   Game-specific records.

### Statistics

Possible statistics:

-   Games played.
-   Games won.
-   Total play time.
-   Highest score.
-   Longest streak.

Statistics should be interesting rather than engagement bait.

### Favorites

Allow games to be pinned to the home screen.

### Recently Played

Keep frequently used games easy to reach.

### Sound

Provide global sound preferences while allowing individual games to
define their own sound effects.

The application should remember the user's preference.

### Themes

Potential later feature.

Do not build a large theming engine unless there is a genuine desire for
one.

------------------------------------------------------------------------

## 13. Accessibility

Even as a personal project, basic accessibility will improve the overall
interface.

Aim for:

-   Keyboard-accessible controls.
-   Visible focus states.
-   Semantic buttons.
-   Adequate contrast.
-   Text alternatives where appropriate.
-   Reduced-motion support.
-   Avoiding color as the sole indicator of game state.

------------------------------------------------------------------------

## 14. Suggested First Games

> **Status: all four complete.** See `CHANGELOG.md` for what was
> actually built (each deviated from this original sketch in small,
> documented ways — e.g. Minesweeper's Expert board is reshaped for
> mobile). This section is kept as the original reasoning for *why*
> these four were chosen, not as a description of the current
> implementation.

The first games should test different pieces of the architecture without
being difficult to implement.

### 1. Higher or Lower

Tests:

-   Basic game routing.
-   Shared shell.
-   Touch controls.
-   Score persistence.
-   Restart behavior.

### 2. Snake

Tests:

-   Real-time game loops.
-   Keyboard controls.
-   Touch/swipe or on-screen controls.
-   Responsive game boards.
-   High scores.

### 3. Blackjack

Tests:

-   More complicated state.
-   Card rendering.
-   Game rules.
-   Multiple actions.
-   Persistent statistics.

### 4. Minesweeper

Tests:

-   Grid layouts.
-   Touch interactions.
-   Long-press/right-click equivalents.
-   Difficulty settings.
-   Timers.

Once these work well, the architecture should be mature enough to reveal
what actually needs to be shared between games.

------------------------------------------------------------------------

## 15. Initial Milestones

> **Status: Phases 1-6 are complete.** Freeplay has four finished games,
> is deployed on Netlify, and is installable/offline-capable as a PWA.
> The project has entered Phase 7. See [Section 29](#29-organic-growth-roadmap)
> for the concrete next-games roadmap that phase now follows.

### Phase 1 --- Foundation ✅ Complete

-   Create React + TypeScript + Vite project.
-   Establish responsive application layout.
-   Add routing.
-   Create game metadata system.
-   Build home screen.
-   Build initial `GameShell`.
-   Establish local persistence helper.
-   Add placeholder game entries.

**Exit condition:** The application can display a library of games and
navigate into a standardized game screen.

### Phase 2 --- First Playable Game ✅ Complete

Build one deliberately simple game.

Recommended: **Higher or Lower**.

Use it to validate:

-   Game registration.
-   Mobile layout.
-   Game shell.
-   Local storage.
-   Restart behavior.
-   Score tracking.

**Exit condition:** Freeplay is technically a usable game application.

### Phase 3 --- Input & Game Loop ✅ Complete

Build **Snake**.

Add:

-   Keyboard input.
-   Mobile input.
-   Game loop utilities if genuinely reusable.
-   Pause/restart.
-   High scores.

**Exit condition:** Freeplay supports a real-time game comfortably on
mobile and desktop.

### Phase 4 --- Complex Game State ✅ Complete

Built **Blackjack**, and with it Freeplay's shared `PlayingCard`
system (types, deck utilities, custom suit SVGs, the card renderer and
back, responsive/container-query sizing, corner-index readability,
accessibility treatment). This is real, evidence-backed shared
infrastructure now, not speculation — see Section 29 for how
Solitaire is expected to reuse it directly.

Established patterns for:

-   Turn/state transitions.
-   Card assets/components.
-   Game-specific settings.
-   Statistics.
-   Persistent state where useful.

### Phase 5 --- Grid & Alternate Input ✅ Complete

Built **Minesweeper**. Solved:

-   Responsive grids.
-   Touch alternatives to right-click (long-press, explicit
    Reveal/Flag mode toggle).
-   Difficulty selection.
-   Timer behavior.

### Phase 6 --- PWA ✅ Complete

-   Added a web app manifest and a Freeplay-identity icon set
    (192/512/maskable PNGs, apple-touch-icon).
-   Added service worker/offline caching via `vite-plugin-pwa`
    (`generateSW` mode, `registerType: 'autoUpdate'`).
-   Verified offline behavior, direct-route refresh, and persistence
    for all four games at multiple viewports.
-   Deployed on Netlify with a working SPA-fallback redirect.

### Phase 7 --- Grow Organically (current phase)

Stop treating development as a roadmap in the sense of a fixed
sequence to complete. Add a game when there is a game worth adding.

That said, "organic" does not mean "undocumented." The next four
games the project actually wants to add are known, and their order is
intentional — see **[Section 29, Organic Growth Roadmap](#29-organic-growth-roadmap)**
for the concrete plan, the reasoning behind the order, and the
design/technical constraints already known about each one. Phase 7
does not commit to a fixed backlog beyond these four; it commits to
building them one at a time, each as its own complete vertical slice,
before deciding what (if anything) comes after.

------------------------------------------------------------------------

## 16. Explicit Non-Goals

Unless the project's purpose changes, Freeplay does **not** need:

-   User accounts.
-   Cloud saves.
-   A database.
-   Multiplayer infrastructure.
-   Social features.
-   Public leaderboards.
-   Monetization.
-   Advertising.
-   Analytics.
-   Daily rewards.
-   Achievements merely for engagement.
-   A content management system.
-   A complicated backend.
-   An aggressive release schedule.

These can be reconsidered only if a concrete feature actually requires
them.

------------------------------------------------------------------------

## 17. Scope Guardrails

The biggest project risk is turning a casual personal arcade into
another large software platform.

Before adding infrastructure, ask:

> Does one of the games I actually want to play require this?

If the answer is no, do not build it yet.

A game is allowed to be small.

A game is allowed to be derivative of a familiar concept.

A game is allowed to have only one mode.

A game is allowed to be finished in a weekend.

The collection becomes valuable by accumulating good small experiences,
not by making every individual game enormous.

------------------------------------------------------------------------

## 18. Definition of Done for a Game

A game can be considered complete when:

-   It is fully playable.
-   It works comfortably on a phone.
-   It works on desktop.
-   Its primary controls are obvious.
-   Restart/new-game behavior works.
-   Relevant state or high scores persist.
-   It handles screen resizing reasonably.
-   It has no known game-breaking bugs.
-   It feels good enough that it would be preferable to opening an
    ad-supported version elsewhere.

Anything beyond that is optional.

------------------------------------------------------------------------

## 19. Future Possibilities

These are ideas, not commitments.

-   Game search.
-   Favorites.
-   Recently played.
-   Game statistics.
-   Multiple visual themes.
-   Import/export local save data.
-   Controller/Gamepad API support.
-   Daily generated puzzles that do **not** punish missed days.
-   Procedurally generated games.
-   Local multiplayer/pass-and-play games.
-   Optional AI opponents.
-   Custom difficulty settings.
-   A unified fictional arcade currency purely for scorekeeping.
-   Unlockable cosmetic themes earned through play rather than
    purchases.
-   D&D/TTRPG-inspired mini-games.
-   Original experimental games.

------------------------------------------------------------------------

## 20. Project Identity

**Freeplay** works well as a working title because "Free Play" is both
an arcade-machine state and a concise statement of the project's
philosophy.

The application is not trying to sell the player anything.

It is simply:

> Pick a game. Play it.

That should remain the guiding principle as the project grows.

---

## 21. Visual Direction

### Core Aesthetic

Freeplay should use a **late-1990s / early-2000s laser-tag arena and arcade aesthetic** rather than a generic 1980s retro-arcade or synthwave look.

The target feeling is:

> Walking into a laser-tag arena attached to an arcade around 2000–2005, where every machine is permanently set to FREE PLAY.

Visual references include:

- Blacklight-lit laser-tag arenas.
- 1990s/2000s arcade carpet patterns.
- Dark arcade interiors.
- UV-reactive geometric shapes.
- Translucent colored plastic.
- Y2K futurism.
- PlayStation 2-era interface design.
- Chrome and metallic accents.
- Segmented digital displays.
- Bright laser-like accent colors against very dark surfaces.

The design should feel nostalgic without becoming a direct recreation of an old operating system or arcade cabinet.

### Avoid Generic 1980s Retro Styling

Freeplay should **not** default to the common synthwave treatment of:

- Constant scanlines.
- Pixel fonts everywhere.
- Sunset gradients.
- Palm trees.
- Outrun-style perspective grids.
- Excessive CRT distortion.
- Pac-Man-era visual language.

Individual games can use pixel art when appropriate, but the Freeplay application shell should feel closer to **Y2K arcade futurism** than 1980s arcade nostalgia.

---

## 22. Color Direction

The primary application surfaces should remain extremely dark so that brighter accents resemble blacklight and laser illumination.

Possible starting palette:

```css
--void:       #080612;
--surface:    #111022;
--surface-2:  #19162d;

--laser-blue: #00d9ff;
--uv-purple:  #8b3dff;
--toxic:      #8cff00;
--hot-pink:   #ff2bd6;
--orange:     #ff8a00;

--text:       #f4f1ff;
--muted:      #9690ad;
```

These values are a starting point rather than a locked design system.

### Color Usage

Bright colors should primarily communicate:

- Selection.
- Focus.
- Active controls.
- Game categories.
- Scores.
- Status.
- Important feedback.

Avoid making every surface glow.

Most of the interface should remain dark and restrained so that neon elements have meaningful contrast. Excessive glow would make the interface harder to read and push the design toward a generic "gaming website."

---

## 23. UI Style

### Game Cards

Game cards should feel closer to **arcade selection panels** than modern SaaS cards.

Potential characteristics:

- Dark textured interiors.
- Angular or clipped corners.
- Thin illuminated borders.
- Large game artwork or icon.
- Strong game title.
- Small category indicator.
- Optional high-score or last-played information.
- A brighter illuminated state when selected or pressed.

Cards should remain large enough for comfortable mobile interaction.

### Navigation

Navigation should be simple and arcade-like.

Potential primary categories:

```text
ARCADE
CARDS
PUZZLE
STRATEGY
WORD
OTHER
```

On mobile, these could appear as a horizontally scrollable selector or compact category control.

On desktop, the same navigation can expand without changing the fundamental interaction model.

### Game Screens

The shared `GameShell` should retain the Freeplay visual identity while giving the game itself most of the available space.

Controls such as:

- Back.
- Pause.
- Restart.
- Sound.
- Rules.
- Settings.

should resemble physical or illuminated arcade controls without sacrificing usability.

---

## 24. Typography

Typography should reinforce the Y2K arcade aesthetic without compromising readability.

Use:

- A distinctive futuristic/display typeface for the Freeplay logo and major headings.
- A highly readable sans-serif for normal UI text.
- Monospaced or segmented-display styling selectively for scores, timers, credits, or system messages.

Avoid using novelty fonts for long text.

Typography should suggest early-2000s futurism rather than imitate an 8-bit game.

---

## 25. Texture and Decorative Language

### Arcade Carpet

The classic arcade/bowling-alley carpet aesthetic should become a recurring visual motif.

Possible pattern elements:

- Squiggles.
- Lightning bolts.
- Triangles.
- Stars.
- Dots.
- Broken lines.
- Abstract geometric shapes.
- Small bursts and orbit-like forms.

The pattern should **not** be used at full intensity behind important content.

Good uses include:

- Splash/loading screens.
- Category banners.
- Empty states.
- Modal backdrops.
- Decorative strips.
- Low-opacity background texture.
- Borders or separators.

The goal is recognition, not visual noise.

### Y2K Futurism

Additional decorative motifs can include:

- Orbital rings.
- Laser streaks.
- Chrome accents.
- Metallic gradients.
- Translucent plastic-like panels.
- Abstract technical markings.
- Small system labels.
- Segmented displays.
- Geometric cutouts.

These should be used sparingly enough that the application remains practical on a phone.

---

## 26. Logo and Branding Direction

The **FREEPLAY** wordmark should feel like something that could have appeared on an arcade machine, laser-tag scoreboard, or game console interface around the early 2000s.

Potential treatment:

- Wide or extended futuristic lettering.
- Slightly angular letterforms.
- A laser streak, orbit, or geometric mark incorporated into the wordmark.
- Restrained metallic or illuminated treatment.

A possible supporting system label:

```text
FREEPLAY
// SYSTEM STATUS: FREE PLAY
```

The branding should communicate the project's core premise: every game is available immediately, with no coins, ads, subscriptions, or monetization barriers.

---

## 27. Motion and Feedback

Animation should make the interface feel responsive rather than constantly animated.

Potential effects:

- Border illumination when a game card is selected.
- Short light sweeps across active controls.
- Small score pulses.
- Quick panel transitions.
- Brief "system boot" effects when entering a game.
- Subtle button depression/illumination.

Avoid:

- Constant glowing animation.
- Long loading animations.
- Excessive screen shake.
- Animations that delay interaction.
- Motion purely for decoration.

Respect `prefers-reduced-motion`.

---

## 28. Visual Design Principle

Freeplay should be recognizable from a screenshot even when the logo is not visible.

The visual identity should come from the combination of:

```text
Dark arcade environment
        +
Blacklight color palette
        +
Y2K futurism
        +
Arcade carpet geometry
        +
Modern mobile usability
```

The theme is not decoration applied after the application is built. It reinforces the product concept itself:

> Freeplay is a personal arcade where every cabinet is permanently set to FREE PLAY.

The interface should therefore feel like choosing a machine in an arcade while remaining substantially cleaner and easier to use than an actual early-2000s interface.

---

## 29. Organic Growth Roadmap

### 29.1 Where the project stands

Freeplay has completed its original four-game milestone, a cross-game
consistency pass, Netlify deployment, and PWA/offline installation
(Phases 1-6 above). The product is mobile-first, desktop-compatible,
locally persistent, visually cohesive across four distinct games, and
intentionally free of accounts, ads, tracking, and unnecessary
platform features.

The project has entered Phase 7, "Grow Organically." This section
documents the next four games actually planned for that phase, their
order, and the design/technical constraints already known about each
— so that "organic" growth is still a deliberate, documented decision
rather than an ad-hoc one when implementation begins.

The core product principle is unchanged and still governs every game
added from here on:

> **Freeplay supplies the machine. The game supplies the screen.**

Each new game shares Freeplay's shell and visual vocabulary
(`GameShell`, `patterns.css`, theme tokens) while establishing its own
distinct play-surface identity. None of the four below should read as
a reskin of an existing game's screen.

### 29.2 The next four games, in order

1. **Color Sort**
2. **2048**
3. **Flow**
4. **Solitaire** (Klondike)

This order is intentional:

-   **Color Sort** is next because it's naturally mobile-first,
    immediately understandable, compact, and meaningfully different
    from the existing four games, while introducing exactly one hard
    new problem — procedural puzzle generation with guaranteed
    solvability — without becoming a large subsystem.
-   **2048** follows because it's comparatively contained. It
    introduces a different interaction pattern (whole-board
    directional transformation, merge behavior, swipe-centric
    controls) and gives a complexity break after Color Sort's
    generation work, rather than stacking two hard generation problems
    back to back.
-   **Flow** comes third because it's likely the most algorithmically
    interesting of the four — it combines guaranteed-solvable
    generation, path construction, and touch-drawing interaction.
    Building it after Color Sort means the lessons learned validating
    one solvable-generation approach are fresh, even though Flow's
    generator/solver logic is its own — not a shared framework.
-   **Solitaire** comes last because it's the largest single
    UI/state-management addition of the four (deck setup, tableau
    rules, foundations, stock/waste, hidden/revealed cards, undo). It
    is better tackled after the other three, both because it's the
    biggest scope and because it can directly reuse the shared
    `PlayingCard` system already proven by Blackjack, rather than
    needing new foundational infrastructure the way the other three
    do.

**Recommended cadence:** implement one game at a time, end to end,
before starting the next:

```text
Game 5 — Color Sort
  implement -> test -> browser/mobile walkthrough -> visual polish
  -> offline/PWA verification -> changelog -> commit -> actually play it

then Game 6 — 2048 (same process)
then Game 7 — Flow (same process)
then Game 8 — Solitaire (same process)
```

Do not implement multiple games simultaneously, and do not build
infrastructure for a later game while working on an earlier one merely
because it's known to be coming. Let each finished game inform the
next rather than trying to predict all four up front.

### 29.3 Game 5 — Color Sort

**Concept.** The player sees tubes containing stacked colored
segments. Each tube has exactly 4 slots. A puzzle contains enough
colors to exactly fill some number of tubes, plus roughly 2-3 empty
helper tubes depending on difficulty/size. The objective: rearrange
until every occupied tube holds only one color.

**Interaction.** Mobile-first default is tap-source, tap-destination,
pour — not drag-and-drop, unless testing later shows drag materially
improves the game. Desktop mouse interaction should behave
equivalently. The UI must clearly indicate: selected tube, legal
destination, illegal move, and completed tube.

**Pouring rule.** A pour is legal when the source has contents, the
destination has capacity, and the destination is empty or its top
color matches the source's top color. A pour transfers the *largest
contiguous group* of the source's top color that legally fits — the
player should never have to move identical adjacent segments one at a
time. Example: a source topped with two BLUE segments over RED/GREEN,
poured into a destination with two BLUE segments and two empty slots,
moves both BLUE segments in one action.

**Guaranteed-solvable generation (the primary technical challenge).**
Do not randomly distribute colors and hope the result is solvable, and
do not repeatedly generate arbitrary boards until one happens to pass
a solver unless there's a strong reason to. Prefer constructing
puzzles from a known-solvable state and scrambling backward from
there:

```text
start with solved tubes
  -> controlled scrambling / reverse construction
  -> mixed puzzle, with a known path back to solved
```

The invariant that matters: **every generated puzzle must have at
least one known path to victory.** The exact algorithm should be
designed carefully at implementation time, not assumed now.

Solvable is necessary but not sufficient — the generator also needs to
avoid trivial puzzles (tubes left solved from the start, two-move
solutions, a scramble that trivially reverses itself, large portions
of the puzzle that never interact). Eventually worth tracking: scramble
depth, number of mixed tubes, color-transition count, minimum
meaningful move count, temporary-storage pressure. Don't over-engineer
difficulty scoring for v1 — just structure generation so difficulty can
become deliberate later instead of accidental.

**Color accessibility.** Gameplay depends on distinguishing colors, so
identity cannot rely on hue alone. Consider a subtle secondary
identifier per color — texture/pattern, symbol, stripe/dot treatment,
or shape marker — that complements rather than overwhelms the tubes.

**Visual identity.** Not generic cartoon glassware/glossy liquid.
Think **chromatic containment / sample-processing terminal**:
transparent containment tubes, luminous colored material, technical
tube numbering, subtle fill-level markings, selected-container
brackets, a controlled transfer animation, dark lab/arcade surface.
Keep it readable — the colored pieces are the focus, not the vessel.

**Pure logic to isolate:** legal-move detection, pour calculation, win
detection, puzzle generation, puzzle validation.

**Difficulty (local to this game):** number of colors, number of
helper tubes, scramble complexity.

**Persistence (ideas, not commitments):** best move count or
completion stats, selected difficulty, possibly the active puzzle if
sessions turn out to run long.

### 29.4 Game 6 — 2048

**Rules.** Standard 2048 on a 4x4 grid. Tiles slide in one of four
directions; matching values merge once per move (2+2->4, 4+4->8, ...,
1024+1024->2048); a tile produced by a merge cannot merge again in the
same move. After a board-changing move, spawn a new tile per standard
2048 behavior. No spawn after a move that doesn't change the board.

**Controls.** Mobile: swipe up/down/left/right, robust against normal
scroll/gesture interference. Desktop: arrow keys, optionally WASD if
consistent with Freeplay's existing input conventions (Snake already
supports both).

**State.** Track at minimum: current score, best score, current board,
game-over state, 2048-reached state. Decide persistence-across-reload
deliberately rather than mechanically copying the arcade-style games'
"fresh run" convention — a 2048 run can run long, so preserving the
current board may genuinely improve usability here in a way it
wouldn't for Higher or Lower or Snake. Make that call at implementation
time based on how the game actually plays.

**Visual identity.** Not the original beige board. Numerical hierarchy
must stay extremely readable, but Freeplay's version can lean into
**energy fusion / numerical reactor matrix**: dark matrix, luminous
tiles whose intensity increases with value, a restrained merge pulse,
a technical score display, strong large numerals. Do not let glow make
high-value tiles unreadable.

**Generation.** No solvability machinery needed — the board starts
valid and evolves entirely through legal moves. Do not attempt to
guarantee every run is winnable; that's not a real constraint for this
game the way it is for Color Sort or Flow.

**Pure logic to isolate:** directional movement, merge behavior, score
calculation, spawn eligibility, game-over detection.

**Difficulty:** probably none.

**Persistence (ideas):** best score, possibly the current board/run.

### 29.5 Game 7 — Flow

**Concept.** A grid contains multiple pairs of matching colored
endpoints. The player connects each pair with an uninterrupted path;
paths cannot improperly cross or share a cell. Being able to redraw an
earlier path that turns out to block another pair is central to the
game's appeal — don't design the interaction in a way that makes
revision awkward.

**Controls.** Primary interaction is direct drawing: touch an
endpoint, drag through the grid, connect the matching endpoint. Mouse
dragging should behave equivalently on desktop. The player must be
able to revise a path without a delete menu — investigate natural
behaviors like dragging backward along the current path to shorten it,
starting again from an endpoint to replace its path, or drawing
through an existing path to reroute it. It should feel like drawing,
not editing graph data.

**Guaranteed-solvable generation.** As with Color Sort: don't place
endpoint pairs randomly and hope they form a valid puzzle. Prefer
constructing the solution first:

```text
construct valid non-intersecting paths
  -> derive endpoint pairs from those paths
  -> hide the paths, present only the endpoints
```

This guarantees at least one known solution per puzzle. The generator
needs its own careful design at implementation time — it is **not**
the same generator as Color Sort's, despite both games needing
guaranteed solvability (see the architecture guardrails below).

Puzzle quality matters as much as solvability: avoid boards where
every connection is obvious, endpoints sit trivially adjacent, paths
never spatially interact, one arrangement predetermines everything
else, or large unused areas make the puzzle meaningless. Eventually
worth a solver/validator that can assess solvability, ambiguity, path
interactions, forced moves, solution complexity, and possibly
uniqueness — but v1 doesn't need a perfect difficulty model, just
generation designed with future validation in mind.

**Board-coverage rule — decide explicitly, don't inherit it by
accident.** Before implementation, choose deliberately between (1)
merely connecting all matching pairs, or (2) connecting all pairs
*and* filling every grid cell (common in games in this family).
Research the gameplay implications and write down the choice as an
explicit Freeplay rule rather than whatever the easiest implementation
happens to produce.

**Color accessibility.** Same requirement as Color Sort: endpoint
identity cannot rely solely on hue. Consider a center symbol, ring
pattern, geometric mark, or endpoint glyph per pair; the paths
themselves can stay primarily color-driven.

**Visual identity.** Not colored dots on white graph paper. Think
**signal-routing / circuit-path terminal**: dark technical grid,
luminous connection nodes, energized paths, subtle grid
coordinates/instrumentation, a connection pulse on completion, clean
path geometry. Keep the board uncluttered — topology needs to stay
immediately readable.

**Pure logic to isolate:** path legality, path replacement, completion
detection, puzzle generation, puzzle validation.

**Difficulty:** grid dimensions, number of pairs, path
interaction/complexity.

**Persistence (ideas):** completion/best metrics by difficulty,
possibly the active puzzle.

### 29.6 Game 8 — Solitaire (Klondike)

Begin specifically with **Klondike**. Don't treat "Solitaire" as a
generic framework meant to cover every solitaire variant — that's
exactly the kind of speculative abstraction this project avoids.

**Why it's last.** Solitaire is larger than it looks: deck setup,
tableau rules, foundation rules, stock/waste behavior, hidden/revealed
cards, overlapping stack layout, drag/tap interaction, win detection,
responsive layout, and substantial game-state manipulation. But
Freeplay already has real infrastructure for it — the shared
`PlayingCard` system built for and proven by Blackjack: card
types/suits/ranks, deck utilities, the custom suit SVGs, the card
renderer and back, responsive container-query sizing, corner-index
readability, and its accessibility treatment. **Reuse that system
directly. Do not build a second card system.**

**Rules for v1.** Standard Klondike, **Draw 1** by default (switch to
Draw 3 only if implementation surfaces a strong gameplay reason to).
7 tableau columns, 4 foundations, stock, waste, alternating-color
descending tableau construction, same-suit ascending foundations
(A->K), Kings into empty tableau columns, face-down tableau cards
revealed when uncovered, win when all cards reach the foundations.

**Interaction.** Must work comfortably with both touch and mouse.
Investigate a combination of tap-to-select/tap-destination, drag and
drop, and double-tap/double-click to send an eligible card to its
foundation. Drag-and-drop should not be the *only* way to play on
mobile. Moving a valid multi-card tableau sequence must be supported.

**Undo.** Plan for it from the state-transition design, not as
something bolted on after. Solitaire is long-form and accidental moves
are common on touch — undo is worth substantially more here than in a
short-form game like Higher or Lower.

**Solvability policy — deliberately different from Color Sort and
Flow.** Traditional randomized Klondike deals are not guaranteed
solvable, and that's normal and expected for the genre in a way an
unsolvable generated Color Sort or Flow puzzle would not be. Do not
build Solitaire solver machinery just because the other two puzzle
games guarantee solutions. At implementation time, choose explicitly
between:

-   **Traditional deals** — random legal shuffle; some deals may be
    unwinnable. **This is the current v1 preference.**
-   **Guaranteed-solvable deals** — requires construction or solver
    validation, substantially more complexity.

Document whichever is chosen, and why, in that game's own
implementation notes.

**Visual identity.** Not Windows Solitaire, not a casino site. Build
around the existing shared cards. Think **Freeplay card terminal /
holographic tabletop**, but distinguish it from Blackjack: Blackjack is
a focused dealer-versus-player table, Solitaire should feel like a
spacious personal card workspace — broader playfield, tableau-centered
layout, quieter background, restrained foundation/stock outlines, less
dramatic outcome presentation during normal play. The cards should
dominate the screen.

**Pure logic to isolate:** deal construction, legal tableau moves,
legal foundation moves, stock/waste behavior, reveal behavior, win
detection, undo state transitions.

**Difficulty:** probably none initially.

**Persistence (ideas):** wins, games played, possibly win streak,
potentially the active deal (sessions can run long).

### 29.7 Architecture guardrails for these four games

The existing principle still governs every one of these
implementations:

> **Abstract from evidence, not prediction.**

Knowing four games are coming is not evidence that they share
structure. In particular, do **not** preemptively build:

-   `PuzzleEngine`
-   `GridGame`
-   `GameBoard`
-   `GameState`
-   `GameResult`
-   `TouchGame`
-   `ProceduralPuzzleGenerator`
-   `SolverFramework`
-   `DragManager`
-   `GameHistory`
-   `DifficultySystem`

Color Sort and Flow both need guaranteed-solvable generation, but
their state spaces and generation methods are fundamentally different
— do not force them through one generic puzzle-generation abstraction.
2048 and Flow both use grids, but their grid semantics are unrelated —
do not build a generic grid engine. Blackjack and Solitaire both use
cards, and **here real shared infrastructure already exists**
(`PlayingCard`) — reuse it; that's the evidence-backed exception, not
a precedent for abstracting the others.

**Pure logic, as always.** Keep deterministic game logic separate from
React/UI for each game, testable without rendering components — see
each game's "pure logic to isolate" list above.

**Randomness and deterministic testing.** Don't scatter direct
`Math.random()` calls through game logic. Prefer an injectable/
seedable random-source boundary where it actually helps reproducible
testing — particularly for Color Sort and Flow puzzle generation,
Solitaire deal construction, and 2048 tile spawning. Production
gameplay can stay genuinely random; tests should be reproducible.

**Difficulty stays local.** No global Freeplay difficulty framework.
Difficulty means something different per game (see each game's section
above); some of the four probably need none at all (2048, Solitaire
v1).

**Persistence stays local.** No global stats system. Decide what to
persist per game, based on how it actually plays once built — the
lists above are planning ideas, not requirements.

**Accessibility is designed in, not patched on.** Color Sort and Flow
specifically need a planned secondary identifier so gameplay never
depends on hue alone. Every new game continues Freeplay's existing
standards: keyboard support where useful, visible focus, minimum touch
targets, reduced-motion support, semantic controls, meaningful
accessible state, and no game-state information leaked to assistive
technology before it should be visible.

**Offline/PWA.** Every new game becomes part of the installed arcade
and must work online, offline after a deploy/cache update, in normal
browser mode, and in installed standalone mode. No new game introduces
a network dependency for core gameplay; all required assets ship
bundled locally — the same standard Minesweeper and Blackjack already
meet.

### 29.8 Roadmap perspective

These four games are not the start of an obligation to continually
expand Freeplay. They are games actually wanted in the personal
arcade. That distinction matters: once Solitaire is done, the right
move is to decide what's next based on what's actually wanted then,
not to assume a Game 9 is owed.

Freeplay still does not need, and should not accumulate:

-   A giant backlog of hypothetical games.
-   Engagement systems, achievements for their own sake, or daily
    rewards.
-   Accounts, leaderboards, or social features.
-   Monetization, ads, or arbitrary progression/content feeds.

Freeplay's value remains a collection of games worth keeping because
the owner actually wants to play them — not a platform with a backlog
to clear.

