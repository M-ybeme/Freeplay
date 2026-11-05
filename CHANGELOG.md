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

## `86d9e6f` — Size game screens per game and let boards scale with the screen

- Each game's registry entry now declares a `size` tier, which caps how
  wide the cabinet screen may grow: compact 560px (Higher or Lower,
  Blackjack, Color Sort, the default), standard 680px (Snake, 2048,
  Flow, Minesweeper, Brick Breaker) or wide 1040px (Chess, Reversi,
  Mahjong, Solitaire). Before, every panel was capped at 560px, and
  Solitaire had a one-off 700px `:has()` override.
- Boards size themselves in CSS, with no JavaScript measuring:
  - The screen area (`.game-shell__content`) is a size container named
    `screen`, and the panel is an inline-size container.
  - The panel exposes `--play-h` (visible height left inside it) and
    `--play-w` (its inner width). Each game subtracts only its own
    controls, replacing the per-game guesses such as `100svh - 490px`.
  - Container queries apply style and size containment but not layout
    containment, so Solitaire's fixed-position drag ghost still tracks
    the pointer. Checked by dragging at 1440 and 375px widths.
- Chess and Reversi switch to a side-by-side layout on a landscape
  screen at least 700px wide:
  - The board fills the height on the left, with setup, players and
    status above the middle of a 270-290px column and the buttons below.
  - The board is top-aligned and the grid rows are content-sized, so in
    short windows the board stays fully visible and only the buttons
    scroll.
  - Chess gets a scrolling move list that stays on the newest move and
    shrinks on short windows.
  - Measured boards: 410/420px to 650px at 1440x900, 657/677px at
    1920x1080, and 518px at 1024x768 and 1366x768. Tested in 12 desktop
    window shapes from 800x600 to 1920x1080.
  - Tablet portrait and phones stay stacked, with boards of 524/534px
    on a 768x1024 tablet.
- Mahjong and Solitaire grow, and their panel narrows to fit the board
  instead of leaving empty side margins (Solitaire 664/820px, Mahjong
  720/812px at 1440/1920).
  - Mahjong on wide screens packs its controls into one row above the
    board and one below. Its boards measure 437 to 533px at 1440x900 and
    496 to 725px at 1920x1080, with no tiles clipped or overlapping in
    any layout.
  - Solitaire cards scale from both the panel width and the screen
    height, never below the old 76px on desktop: 98px at 1920x1080 and
    86px on tablet.
- Standard games grow to 520px on tall screens. On laptop-height
  screens they keep a comfortable board that stays fully visible, and
  only the controls below it scroll: at 1366x768, Snake is 420px with
  its D-pad below the fold and Flow is 380px. A first pass shrank both
  to 300px to avoid scrolling; that was reverted after review.
  Minesweeper beginner cells grow 44 to 56px and intermediate 30 to
  33-36px.
- Phones: the panel's top and bottom padding is smaller below 480px, so
  every game gains about 24px of height. At 375x812, scrolling drops in
  Chess (50 to 33px), Reversi (35 to 11px) and Flow (9 to 0).
- Known rough edges:
  - A phone held sideways (844x390) leaves about 140px of play height,
    so Chess and Reversi still scroll there.
  - Flow at 1280x720 keeps its 380px floor with the board's bottom 47px
    below the fold.
  - Minesweeper intermediate and expert still scroll on short screens,
    as before.

## `383325e` — Add Chess: 1-player vs three computer levels, or 2-player on one device

- Game 12, built on the same setup as Reversi: 1 Player (you are cyan
  and move first; the computer is pink) at Easy/Normal/Hard, or
  2 Players sharing the device. Same mid-game confirm prompt, Undo (back
  to your previous turn in solo, one move in duo), "Show moves" toggle
  and per-level W/L/D record.
- Chess is the second game to need the side-controller table, so
  `controllerFor`, `COMPUTER_DELAY_MS` and the W/L/D record moved out of
  Reversi into `src/games/versus.ts`, per the "share once a second game
  needs it" guardrail. Reversi behaves the same. The setup buttons and
  confirm prompt stay copied per game, because the guardrails rule out a
  shared game menu.
- Full rules in a pure `logic.ts`: castling (not out of, through or into
  check), en passant, promotion to any piece via a picker, check,
  checkmate, stalemate, the fifty-move rule, threefold repetition and
  insufficient material. Move names use standard chess notation (SAN),
  including disambiguation. Perft matches the published counts for five
  standard positions (start, Kiwipete, and positions 3, 4 and 5).
- Computer (`ai.ts`):
  - Easy: random, but takes captures it sees.
  - Normal: two-ply full-window search with capture quiescence and
    40-centipawn noise.
  - Hard: iterative-deepening alpha-beta up to 5 plies inside a 700ms
    budget, with MVV-LVA ordering and piece-square tables.

  Measured over 30 Hard moves on the dev machine: 315ms median and 702ms
  max, which blocks the main thread while it thinks. In test matches,
  Normal beat Easy 3/3 and Hard beat Normal 2/2.
- Original SVG pieces: cyan pieces are lit outlines and pink pieces are
  solid, so the sides differ by shape. Moved pieces (and the castling
  rook) slide in from their old square. The last move's squares are
  tinted orange and a checked king glows red. Player cards show captured
  pieces, read from the move list so promotions don't count as losses,
  plus the material lead. The last three move pairs show under the board.
- Tests (27): perft, mate, stalemate, en passant timing, castling rules,
  promotion, SAN disambiguation, pins, every draw rule, undo, and AI
  legality plus tactics (free queen, mate in one, not taking a defended
  pawn). Hard's tests use a fake clock so results don't depend on the
  test machine's speed.
- Known rough edges:
  - On a 320x700 phone the Undo/New row sits below the fold.
  - The board isn't flipped for player 2 in duo.
  - Undoing a finished solo game and finishing it again counts the
    result twice, as in Reversi.

## `eabfe84` — Add Reversi: 1-player vs three computer levels, or 2-player on one device

- Game 11 and the first game with a 2-player mode. The rules in
  `logic.ts` are player-neutral: a move is a move. `controllerFor(mode,
  side)` in the hook is the only place 1-player and 2-player differ
  (solo: you are cyan, the computer is pink; duo: two people sharing the
  device). This is the pattern Chess is meant to reuse. It is
  deliberately local to Reversi until that second game exists, per the
  "share only after a second game needs it" guardrail.
- Named Reversi with its own look (not the trademarked black/white on
  green). Cyan discs are lit rings and pink discs are solid cores, so
  the sides differ by shape. Captured discs flip in a ripple outward
  from the placed disc (70ms per ring of distance). Legal-move markers
  can be turned off. Passes are automatic and announced. Undo in solo
  returns to your previous turn, skipping the computer's reply; in
  duo it steps back one move.
- Computer levels:
  - Easy: greedy for discs, but random about a third of the time.
  - Normal: one ply on a corner/edge square-value table.
  - Hard: negamax alpha-beta at depth 5 on square values plus mobility,
    solving exactly once 10 or fewer squares are empty.

  Hard measured 32ms median and 162ms max per move on the dev machine.
  Depth was raised from 4 after the first measurement showed 90ms max.
  There is a 550ms pause before each computer move so it reads as a
  turn. Solo results go into a per-level W/L/D record.
- Tests (23):
  - Flips in every direction, with no wrapping at the board edge.
  - Passing and game end.
  - Undo, with no nested history.
  - Every level picks only legal moves.
  - Normal takes a free corner.
  - Hard's endgame choice matches a brute-force search.
  - Each level beats the one below it in most games.

  They take about 13s, mostly the full Hard games.
- Known rough edges: on a 320x700 phone the Undo/New row sits about
  80px below the fold, and undoing a finished solo game then finishing
  it again counts the result twice.

## `614bf3d` — Add Mahjong: neon tile-matching solitaire with winnable deals

- Game 10. Tap two free tiles that match to clear them. A tile is free
  when nothing on a higher layer overlaps it (even by half a tile) and
  its left or right side is open. Positions are in half-tile units so
  upper tiles can sit across seams.
- Deals are winnable by construction. The layout is first "played" in
  reverse, repeatedly removing two random free positions, and each
  removed pair of positions then gets a matching pair of faces, so that
  order is a guaranteed solution. A test replays the build order as legal
  moves to a cleared board for 40 seeds of every layout. An exact
  backtracking solver was tried and was too slow on 80-tile boards.
  Shuffle redeals the remaining faces the same winnable way, and returns
  nothing when the remaining positions can't be cleared in any
  arrangement (e.g. two tiles stacked), which the UI turns into a "new
  deal" prompt.
- Neon tile set with the real set's structure: Orbs, Bars and Glyphs
  1-9, four Compass tiles, three Cores, and two four-face bonus sets
  (Arcade, Sky) where any two faces from the same set match. Every suit
  differs by shape as well as colour, and numbered tiles carry a corner
  index. Dark faces were chosen first; light faces are the fallback if
  they don't read well in play.
- Three original layouts sized for phones (at most 8 tiles wide):
  Pyramid 82, Fortress 80, Diamond 80. Tiles size from the stage with
  container units, solving `cols * tw + layers * 0.14 * tw = 100cqw` so
  each layer's up-left shift (14% of a tile) still fits; lower layers
  are shaded slightly so stacks read as height. Tiles are 30x38px at
  320px wide. On a 320x700 screen the Diamond controls sit about 110px
  below the fold; desktop fits all three layouts without scrolling.
- Hint (a random available pair), Undo (pairs and shuffles), an
  abandon-board confirm, an optional "Dim blocked tiles" assist, and a
  live region that speaks tile names and events. The clock starts on the
  first tap and counts only while the tab is visible. Best time per
  layout is persisted; whether this clear beat the record is decided
  once, at the moment of clearing, and kept in the reducer. A board in
  progress is not saved across reloads.

## `08b2bfc` — Add Brick Breaker: neon wall-breaking arcade game

- Game 9, and the second real-time game after Snake. Drag anywhere on
  the field to steer (a mouse just hovers; keyboard players hold arrows
  or A/D), and release the drag, press Space or press Launch to serve.
  Space or P pauses, and the game pauses itself when the tab is hidden.
- Rules in `logic.ts` run in field units (100 x 130) with time passed in.
  The paddle bounce angle comes from where the ball hits, capped at 60
  degrees from vertical so it can never skim sideways forever. Speed
  rises slightly with each paddle hit and with each level, up to a cap.
  Movement is split into sub-steps of half the ball's radius, and frames
  are clamped to 50ms, so the ball can't tunnel through a brick. The
  trade-off: below 20fps the game slows rather than skipping ahead.
- Five original wall layouts cycle with a faster ball. Armoured bricks
  take two hits and are marked by shape (a solid inner plate, then crack
  stripes), not by colour alone. Scoring: 10 per brick, 30 per armoured
  brick, 50 per cleared wall. 3 balls; the best score is persisted.
- The hook adds view-only state around the rules: a 7-point light
  trail, brick bursts that last 320ms, and a live-region message that
  changes only on events (lost ball, cleared wall, game over), never per
  frame. The rAF loop runs only while serving or playing.
- The field caps its width by the height left after the cabinet chrome,
  `(100svh - 380px) * 100/130`, so the whole field fits on screen: 256px
  wide at 320x700, and 400x520 at 1440x900 with no scroll. The
  balls-left pips sit inside the field so the HUD stays one row on
  phones.
- 30 logic tests, including no tunnelling at max speed and a
  ball-tracking paddle clearing wall 1 without losing a ball. Not yet
  playtested at a real frame rate: the browser pane was hidden during
  verification, which throttles rendering to about 4fps.

## `02e4041` — Arcade-floor home: neon sign, cabinet game cards, grid floor

- Game cards are now small cabinets. Each has a marquee in its
  category's colour (arcade pink, cards purple, puzzle cyan), the icon on
  a CRT screen with scanlines, and a deck with the category and PRESS
  START. Hovering or focusing one lifts it, makes it glow and blinks
  PRESS START, and pressing it flashes the screen. The colour comes from
  one `--accent` per card, applied with color-mix.
- Descriptions are no longer body copy. They stay in each card's
  accessible name (a visually hidden span) and in its title tooltip.
- The FREEPLAY logo is a neon sign: a cyan tube in a pink tube frame
  that flickers on. The tagline that repeated the logo is replaced by a
  blinking "Insert coin · No coin needed" line.
- A perspective grid floor sits behind the row of cabinets. It is a
  fixed, clipped element, so it never adds scroll width.
- Two cabinets per row on phones: 8 games in about 1.5 screens at 320px
  (the old one-per-row cards needed about 3), with every name on one
  line. Three per row from 560px and four from 760px. Auto-fill gave an
  uneven five-and-three at 1440px.
- Flicker and blink are off under reduced motion.

## `b199f5e` — Cabinet shell: neon marquee, CRT screen and control deck

- The game shell is now an arcade cabinet, top to bottom. A backlit
  marquee shows the game's name in pink neon and flickers on when the game
  opens. The game panel is a CRT: rounded glass in a dark bezel, faint
  scanlines (8% black, 1px in 3), darker edges and a cyan glow, with a
  power-on effect where a bright line opens out. A control deck holds an
  EXIT arcade button and a CREDITS: FREE PLAY readout.
- Everything is chrome around the panel, so no game changed. The
  scanline and vignette layers sit at z-index 4: above the games' own
  layered pieces (z 1-3), below Solitaire's drag ghost and overlays
  (z 20+). Both take no pointer input.
- Built mobile first. The marquee is 56px tall and the deck 62px. The
  bezel is 6px on phones and 10px from 480px up, and the panel's
  horizontal padding shrinks by the same amount, so games keep their
  inner width. This matters for Solitaire, which sizes its cards from it.
  The deck pads for safe areas, and on wide screens it keeps its controls
  lined up under the cabinet (720px).
- Measured all 8 games at 320, 390 and 1440px with no horizontal page
  overflow. Minesweeper's beginner board (322px minimum) still scrolls
  inside its wrapper at 320, the same as before this change.
- Known costs: about 57px less vertical room than the old header, and
  EXIT now comes after the game in tab order because it sits at the
  bottom. The flicker, power-on and blink are off under reduced motion.

## `564e779` — Fix Flow pipes joining non-consecutive cells and routes extending past their end

- Pipe connectors are now derived from route order (each cell links only
  to the cells before and after it in its own path). They had been
  derived from "the neighbour has the same owner", so a route that
  doubled back beside itself drew a grid of false joins, and two
  same-colour endpoints sitting side by side were bridged directly.
- `extendRoute` refuses forward extension once the pair is connected, so
  a drag that keeps going after reaching the partner endpoint stops
  there. Backtracking a finished route still works.
- Verified in the browser with a U-shaped route between adjacent
  endpoints, dragged on past the end: no bridge, and the extra cells
  stayed empty.

## `0b12bbc` — Design pass: quieter card backs, court-card panels, Solitaire layout and HUD

- Shared PlayingCard backs now recede (mark at 40% cyan, no glow); a
  layout lights one explicitly with `.playing-card--back-lit` (Solitaire's
  stock). With 20+ backs on a Solitaire table, the glowing mark on every
  one was the loudest thing on screen.
- Court cards get a chamfered, suit-tinted panel (color-mix on
  currentColor) with one/two/three rank chevrons for J/Q/K, a rule and the
  name, inset to clear the corner-index strip.
- Compact mode via container query below 48px card width: big side-by-side
  rank + suit index and one large centre suit, replacing ~6px pips. Kicks
  in for phone Solitaire (29-36px) and long Blackjack hands (42px).
- Solitaire card width is now `clamp(28px, (90vw - 84px) / 7, 76px)` and
  the board, HUD and controls take their width from the seven columns.
  The old fixed steps overflowed in two places: 70px cards in ~62px 1fr
  tracks at 1100px+, and a 306px board in a 256px panel at 320px
  (measured after: board right edge 287px vs panel inner 288px). The
  panel widens to 700px for Solitaire only, via `:has(.solitaire)`.
- The Solitaire top row shares the tableau's grid: stock over pile 1,
  waste over pile 2, foundations over piles 4-7.
- Empty slots are visible sockets (cyan dashed outline, faint fill, inset
  shadow) with an A hint on foundations and a K hint on empty piles. The
  stock shows offset depth edges plus a count badge, and the waste shows
  an edge once cards are underneath. The edges sit on the stock button,
  not the card, because the card's clip-path would clip a box-shadow.
- The Solitaire HUD is Foundation / Stock / Hidden, all derived from the
  run itself, so they stay right across reload and undo without new
  persisted state.
- Blackjack's lifetime record moves from one cramped label line to four
  HUD tiles (W/L/P/BJ - "Blackjacks" overflowed at 320px).

## `d6601e5` — Add state-change motion across every game, Home, and the shell

- Shared motion patterns in patterns.css: `.fp-enter` (panels rise in),
  `.fp-pop` (a HUD value that changed, re-triggered by keying the element
  on its value), `.fp-shake` (a miss or loss). Entrances use fill-mode
  `backwards`, never `both` - a finished animation still holding
  `transform` would turn the game panel into a containing block for
  Solitaire's position: fixed drag ghost, and would pin Home cards'
  hover lift off for good.
- 2048: tiles now slide to where they land (110ms) instead of the board
  redrawing. A pure `traceMove` (property-tested against moveBoard over
  random boards in all four directions) maps every tile's from/to; the
  component infers the direction by comparing boards because key handling
  lives inside use2048. Merging tiles travel as short-lived ghosts carrying
  their old value; the merged tile and the spawned tile appear only once
  the slide lands. The old per-tile mount pop was removed - it fired on
  every tile that moved into a previously-empty cell.
- Blackjack: cards slide in from the shoe in alternating deal order
  (140ms apart), the hole card flips on reveal, and the hand's width and
  overlap transition as it tightens. Cards are now keyed by identity, not
  index - before, a new round reused the previous round's elements, so the
  deal animation only ever played once.
- Higher or Lower: the value rolls up or down by the direction it moved; a
  wrong call lands then shakes.
- Minesweeper: newly revealed cells ripple outward from the clicked cell
  (Chebyshev distance, capped at 650ms so a big flood-fill still settles
  fast); flags drop in; the triggered mine flashes and the board shakes.
- Color Sort: the selected tube lifts; a pour tips the source toward the
  target and drops the arriving segments in; a completed tube hops; a new
  arrangement refills tube by tube; solving waves across the rack.
- Snake: segments glide for exactly one tick (`--tick` from
  tickDurationForScore), only while playing so a restart doesn't sweep
  across the board. Safe because walls end the run - there is no
  wrap-around. Food pops in where it spawns; a crash flashes the head.
- Flow: pipes grow out from the cell centre as a route is drawn; solving
  sweeps a diagonal glow.
- Every Web Animations API path checks prefers-reduced-motion itself,
  since the global CSS rule only reaches CSS animations.
- Not exercised in the browser: the 2048 milestone overlay, Color Sort,
  Flow and Snake win states.

## `e1659c9` — Fix card pip/index collision and tableau fan; add Solitaire card motion

- Shared PlayingCard: the corner index now lives in a narrow edge strip
  (rank 18cqw, "10" 13cqw, suit 12cqw at 4%/5% from the corner) and
  number-card pips sit in their own central band (`inset: 14% 34%`,
  14cqw pips). Measured across every rank at 36-96px widths: zero
  pip/index overlaps, minimum clearance 6.6% of card width. Previously
  the corner pips of every 4-10 landed on the index. Blackjack and
  Higher or Lower inherit the fix.
- Solitaire tableau fan was additive (positive margin pushed each card
  *below* the previous, 102px apart for an 81px card); each card is now
  pulled up by a card height minus the fan step, so the board fits on
  screen without scrolling at 375px and desktop.
- `useCardMotion` (FLIP via the Web Animations API): cards glide between
  piles keyed by rank-suit, flip when revealed or drawn, deal from the
  stock in true Klondike order (~1s), and settle from the drag ghost on
  drop (springing back on an illegal drop). Positions are board-relative
  layout offsets, not transformed rects, so a mid-flight measurement or
  the confirm panel shifting the board doesn't read as every card
  moving. WAAPI isn't reached by the global reduced-motion CSS rule, so
  the hook checks the media query itself and skips everything.
- Waste and foundations render their top two cards stacked so nothing
  blanks while the top card is in flight; the PlayingCard mount fade is
  disabled on this board because remounts would replay it.
- Undoing a draw doesn't animate the card back into the stock - left
  as-is.

## `c52a58b` — Add Solitaire as Game 8: Klondike Draw 1 with tap, drag, and keyboard play

- Reuses the shared Card/deck/PlayingCard system from Blackjack (types,
  createDeck/shuffle, the card face and back components) rather than
  duplicating card definitions - rules and zone state (stock, waste,
  four suit-indexed foundations, seven tableau piles) stay entirely
  game-local, per the established "shared card representation without
  a shared game engine" boundary.
- Every move is a pure function that returns the exact same run
  reference when illegal, matching the reference-equality no-op
  convention already used in Flow/2048. Moving a sequence away that
  exposes a face-down tableau card auto-flips it; single-slot Undo
  restores the entire prior run wholesale, which reverses that auto-
  flip for free rather than needing dedicated flip-back logic.
- Input is one Pointer Events state machine per card/zone, not separate
  mouse/touch/drag code paths: movement under a 6px threshold resolves
  as a tap (select-or-move, or a double-tap within 350ms triggering the
  standard auto-foundation shortcut), movement past it becomes a drag
  with a floating ghost and live legal-drop highlighting. The same
  primitives back full keyboard play (13 real tab stops for the zones,
  arrow keys move an in-pile cursor, Enter/Space select-or-activate) -
  verified by completing every move class keyboard-only.
- Persisted state is validated locally: exactly 52 unique card
  identities across every zone, each foundation ascending same-suit
  from Ace, and every tableau pile's face-down cards forming a bottom-
  anchored prefix with a valid alternating-descending face-up suffix -
  malformed data discards to a fresh deal rather than crashing.
- A fix during implementation removed CSS Grid's default row-stretch on
  the tableau, which had been making every pile's click/focus target as
  tall as the longest pile instead of just its own cards.

## `55a4259` — Add Flow as Game 7: signal-routing puzzle with guaranteed-solvable generation

- Puzzles are generated solved-first: a randomized full-board Hamiltonian
  path (Warnsdorff-guided backtracking, with a guaranteed boustrophedon
  fallback so generation always terminates) is cut into per-pair
  contiguous segments, so every puzzle handed to the player already has
  a known valid solution by construction rather than scattering
  endpoints and hoping a solver can close the gap. A lightweight quality
  gate rejects a dominant single path, too many trivially-adjacent
  pairs, or a mostly-straight-line layout before a segmentation is
  accepted.
- Completion requires full-board coverage, not just matching every pair
  - three unused cells with all pairs connected is not a solved puzzle.
  The player-path model is deliberately unaware of the hidden solution:
  it only ever sees the puzzle's endpoints and the player's own drawn
  routes.
- Dragging into a cell already owned by another pair claims it and
  truncates that pair's route from that cell onward (chosen over a
  reject-on-touch model after implementing and playtesting both); same-
  drag backtracking and starting a new drag on an existing path cell
  both truncate to that point, so correcting a route never requires
  clearing it first.
- Fast pointer movement is resolved to a sequence of legal single-step
  extensions before it reaches the reducer, so a sparse pointermove
  stream can't skip cells or jump past an illegal one - the same
  primitives back a full keyboard model (roving tabindex, Enter/Space to
  edit a pair, arrows to extend/backtrack), verified by completing an
  entire generated puzzle keyboard-only.
- Every pair gets a distinct geometric endpoint marker in addition to
  its color, following the precedent Color Sort established for color-
  independent identity.
- The active puzzle (full definition + player routes) persists across
  reload and is validated locally against malformed shapes, out-of-
  bounds coordinates, cross-pair occupancy overlaps, and discontinuous
  routes before being trusted.

## `519f492` — Add 2048 as Game 6 with single-step undo and Fusion Matrix visuals

- Standard 2048 rules (4x4 board, compress→merge→compress, no chain
  merges per move, exact spawn/scoring/game-over semantics) as pure,
  fully-tested logic (`logic.ts`) with injectable randomness, matching
  Snake/Color Sort/Blackjack's `rng: () => number = Math.random`
  convention rather than a bespoke PRNG.
- Single-slot Undo (not a stack): restores the exact previous
  board/score/milestone state. Deliberately does not preserve RNG state
  across the undo point, so redoing the same move can spawn a different
  tile — chosen over building a seeded/serialized PRNG solely to make
  Undo cheat-proof, per the same simplicity-first reasoning already
  applied elsewhere in this project.
- New Game confirmation gating is centralized at the hook's `move()`/
  `undo()` entry points (a single choke point for every input path)
  rather than checked separately in each handler — an explicit
  architectural fix for the exact bug class just found and fixed twice
  in Color Sort and Minesweeper, where a pending confirmation didn't
  actually block every interaction path.
- Unlike Freeplay's other arcade-style games, 2048 persists the active
  run (board/score/milestone), not just the best score. Persisted state
  is validated locally in `logic.ts` (board shape, cell values, score,
  flag types) before being trusted; malformed data falls back to a
  fresh game instead of crashing.
- Visual identity ("Fusion Matrix") uses escalating energy-tier colors
  through the existing theme palette rather than a per-value rainbow,
  reuses Snake's board-sizing formula (`min(420px, 80vh, 80vw)`) to stay
  clear of the overflow-centering bug class found in Minesweeper, and
  uses `touch-action: none` for swipe scroll-prevention per the lesson
  from the earlier Minesweeper touch-flag investigation.

## `4376c9f` — Fix Minesweeper difficulty confirmation not gating board interaction

The same bug Color Sort's review found in its `pendingDifficulty` flow
already existed in Minesweeper: cell interaction was only ever gated
by `gameOver`, never by a pending difficulty confirmation, so a player
could keep revealing/flagging cells - including solving or losing the
board - while the confirmation sat unresolved.

- Root cause differs slightly from Color Sort's: `gameOver` protection
  here is partly enforced at the pure logic layer (`revealCell`/
  `toggleFlag` already refuse to mutate once `board.status` leaves
  "playing"), which is why `onClick` had no `gameOver` check at all
  and still worked. `pendingDifficulty` is a UI-only concept the logic
  layer has no notion of, and `board.status` stays "playing" the whole
  time a confirmation is open - so all five interaction paths (pointer
  tap, long-press, mouse click, right-click flag, keyboard
  Enter/Space/F) needed an explicit check, not just one.
- Fixed with one derived `boardLocked = gameOver || pendingDifficulty
  !== null`, used everywhere `gameOver` was already checked plus the
  two places (`onPointerUp`, `onClick`) that had no explicit gate
  before. Also passed it into `MineCell` (renaming its `gameOver` prop
  to `locked`) so unrevealed cells get the same inert/pointer-events
  treatment as real game-over, as defense in depth alongside the
  handler-level checks.
- Arrow-key focus movement is intentionally untouched and still works
  while a confirmation is pending - only state-mutating actions are
  gated.
- Verified live: the exact reported reproduction (reveal a cell,
  select another difficulty, then try click/right-click/a real 550ms
  touch long-press/Enter+F) now registers zero board changes while
  pending; the timer keeps advancing normally throughout; canceling
  restores full interaction exactly as it was; confirming starts the
  requested difficulty normally.

Separately discovered, **not fixed here**: at exactly 320px, the
Beginner board renders wider than its wrap container, and centering
the overflow silently swallows clicks on cell 0 - the same overflow-
centering bug class fixed for Expert months ago, this time on a
non-scrolling tier. Confirmed pre-existing and unrelated to this
change; left for a dedicated follow-up.

---

## `5b8a204` — Fix Color Sort review findings: pending-difficulty gating, undo cap, dead state, unused export

Four findings from an external multi-agent review of the Color Sort +
Undo work, addressed as a focused follow-up.

- **Fixed a real bug**: `TubeButton.disabled` only checked `won`, so a
  pending difficulty-change confirmation didn't stop the player from
  continuing to pour in the existing puzzle underneath it - including
  solving it while the confirmation sat unresolved. Tubes (and, by the
  same "no board manipulation while a decision is unresolved"
  principle, Undo and Restart puzzle) are now also disabled while a
  difficulty change is pending. Keyboard interaction is gated the same
  way for free, since these are native disabled `<button>`s.
- Bounded undo history at 200 entries, dropping the oldest on
  overflow - a deterministic memory bound, not a response to an
  observed problem.
- Removed the dead `status` field from `HistoryEntry`: a history entry
  can only ever be created while `state.status === "playing"` (the
  reducer returns early otherwise), so the stored value could never
  vary. Undo now restores `"playing"` directly.
- Removed the unused `tubeCount` export from `logic.ts` - its only
  caller was its own test; production generation never used it.

Left unchanged, per review triage: synchronous puzzle generation
(measured 156-371ms for Hard - a theoretical worst case, not a
demonstrated problem) and localStorage shape validation (pre-existing
pattern shared with Blackjack and Minesweeper, not a Color-Sort-only
fix).

---

## `3b14bd2` — Add Undo to Color Sort

A local history stack of immutable board snapshots, taken right before
each successful pour — a plain stack, not a tree, so making a new move
after undoing just pushes a fresh entry with no special branching
logic needed to discard whatever was abandoned.

- Only a completed, state-changing pour creates a history entry;
  selecting/deselecting a tube and tapping an illegal destination
  never touch it.
- Undo reverses the move count too, and is never itself counted as a
  move. It also works from a solved puzzle - it restores the
  immediately previous unsolved state and the win banner disappears.
- Best-move persistence lives entirely in the hook's own effect, which
  the undo action can't reach, so a recorded best cannot be erased by
  undoing afterward (verified live: won at 63 moves, undid once, best
  still 63 in storage).
- Restart, New Puzzle, and difficulty switching all clear history and
  reset moves, matching their existing behavior.
- No pour animation was touched or added - state changes stay instant,
  preserving the game's deliberate no-animation feel.
- UI is a plain "Undo" button next to "Restart puzzle", same `fp-btn`
  language as the rest of the app; at 320/390px the two buttons wrap
  to a stacked layout rather than compressing side by side.
- 11 new tests, exporting the hook's reducer as a pure function to
  test directly rather than adding a React hook-testing dependency.

---

## `9a17128` — Implement Color Sort as Freeplay's fifth complete game

Pour tubes to gather each color into one place, styled as a chromatic
containment / sample-processing terminal - the first of the four
organic-growth games, and the first to need guaranteed-solvable
procedural generation.

- Generation randomly distributes color units into tubes, then
  verifies solvability with a solver, rather than reverse-scrambling
  from a solved state. That's a deliberate, structural choice, not a
  shortcut: a Color Sort pour is only ever legal onto an empty tube or
  a matching top color, so every tube stays single-color for as long
  as it's only been touched by legal pours - reversing a sequence of
  legal pours can permute which tube holds how much of a color, but
  can never produce the jumbled, multi-color tubes a real puzzle
  needs. Legal-pour reversal is structurally incapable of generating
  this game's puzzles.
- The solver itself went through a real redesign: an initial BFS
  implementation exhausted a 200,000-state cap and multiple GB of
  memory trying to verify 7-8 color boards, because BFS holds the
  entire search frontier in memory and this puzzle's branching factor
  makes that frontier explode before reaching a solution. Replaced
  with an iterative DFS using a move-ordering heuristic and a
  visited-state set - memory proportional to one path, not the whole
  frontier - solving every difficulty tier in well under half a
  second across a wide seed sweep.
- Hard is tuned to 7 colors + 3 helpers, not 8 - measured directly
  that 8-color boards routinely took 5+ seconds or timed out
  regardless of helper-tube count, while 7 colors solved reliably in
  under 400ms. A real difficulty knob, chosen from measurement rather
  than a round number.
- Each color has both a name and a distinct geometric mark (circle,
  ring, triangle, diamond, pentagon, plus, hexagon) on its segments,
  so play never depends on hue alone.
- Tap-source/tap-destination interaction using real `<button>`
  elements, so keyboard play (Tab + Enter) needed no extra code.
  Legal destinations highlight live while a tube is selected, which
  doubles as the "illegal move" indication - proactive guidance
  instead of a reactive error.
- Persists selected difficulty and best move count per difficulty; the
  active puzzle does not persist, matching the other arcade-style
  games rather than Blackjack/Minesweeper's longer-session model.

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
