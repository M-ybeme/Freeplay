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

### Phase 1 --- Foundation

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

### Phase 2 --- First Playable Game

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

### Phase 3 --- Input & Game Loop

Build **Snake**.

Add:

-   Keyboard input.
-   Mobile input.
-   Game loop utilities if genuinely reusable.
-   Pause/restart.
-   High scores.

**Exit condition:** Freeplay supports a real-time game comfortably on
mobile and desktop.

### Phase 4 --- Complex Game State

Build **Blackjack**.

Use it to establish patterns for:

-   Turn/state transitions.
-   Card assets/components.
-   Game-specific settings.
-   Statistics.
-   Persistent state where useful.

### Phase 5 --- Grid & Alternate Input

Build **Minesweeper**.

Solve:

-   Responsive grids.
-   Touch alternatives to right-click.
-   Difficulty selection.
-   Timer behavior.

### Phase 6 --- PWA

Once the basic application is worth keeping installed:

-   Add web app manifest.
-   Add application icons.
-   Add service worker/offline caching.
-   Test installation on Android/mobile.
-   Test offline behavior.
-   Test standalone presentation.

### Phase 7 --- Grow Organically

Stop treating development as a roadmap.

Add a game when there is a game worth adding.

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

