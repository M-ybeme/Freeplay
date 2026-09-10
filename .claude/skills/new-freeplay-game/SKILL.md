---
name: new-freeplay-game
description: Scaffold a new Freeplay game (e.g. Blackjack, Minesweeper) following the file/architecture pattern established by Higher or Lower and confirmed by Snake. Use when starting implementation of a new game for this project.
---

# New Freeplay Game

Freeplay games follow one consistent structure now, proven across two
real games. Use it as-is. Don't invent a different shape unless the game
genuinely can't fit it — and if you think it can't, say so explicitly
before deviating.

## File layout

```
src/games/<id>/
  logic.ts          pure game rules — no React, no DOM
  logic.test.ts      vitest, tests logic.ts directly
  use<Name>.ts       React hook: state + effects + side-effect cleanup
  <Name>.tsx         presentational component
  <Name>.css         this game's own visual identity
  index.tsx          GameDefinition + default export (registry entry point)
```

## logic.ts

- Pure functions and/or a pure reducer over a plain state object. No
  `useState`, no DOM, no timers — those live in the hook.
- Export tunable constants at the top (board size, speeds, thresholds,
  queue limits) rather than burying magic numbers in functions. Both
  Higher or Lower (`MIN_VALUE`/`MAX_VALUE`) and Snake (`BOARD_SIZE`,
  `BASE_TICK_MS`, etc.) do this — it's also what makes live-playtesting
  feedback ("this feels too fast") a one-line fix instead of a hunt.
- If the game has more than a couple of states (ready/playing/paused/
  game-over/won, say), model it as an explicit `status` union and a
  single `tick`/`step`-style transition function, the way Snake does.
  For something as simple as Higher or Lower, plain state + a couple of
  pure helper functions is enough — don't force a state machine where a
  boolean would do.
- Any bounded queue, buffer, or "reject invalid transition" logic (like
  Snake's direction buffer) belongs here, fully pure and fully testable
  without touching React.

## logic.test.ts

- Test the rules, not the rendering. Cover: the core mechanic advancing
  correctly, every rejection/validation rule, edge cases at the
  boundaries (an empty/full board, a zero/max score), and whatever
  "this could loop forever or crash" case exists for this game (Snake's
  full-board food generation is the template).
- Higher or Lower shipped with 5 tests; Snake shipped with 28. Match the
  actual complexity of the game's rules — don't pad for a number, and
  don't skip a real edge case to save time.

## use&lt;Name&gt;.ts

- Wraps logic.ts in a hook. `useState` is fine for simple state;
  `useReducer` is worth it once there are several action types or any
  risk of a stale closure (Snake's pause-toggle is the reason to prefer
  it — the reducer always sees current state, a keyboard-handler closure
  might not).
- Own every side effect here: timers, `keydown` listeners,
  `visibilitychange`, etc. Each one MUST have a cleanup function, and
  effects that depend on evolving state (a movement loop keyed on
  score-derived speed) must be verified to not double up under Strict
  Mode or leak across route navigation — don't just trust the code,
  measure it (see the verify-freeplay-game skill).
- Best score / durable state goes through the existing
  `useGameStorage(gameId, key, initialValue)` hook from
  `src/hooks/useGameStorage.ts`. Never invent a second persistence
  mechanism. Only persist what genuinely needs to survive a refresh —
  the current run does not.
- If you need to know whether *this* run beat the best score, snapshot
  the best at run-start (a ref, or a state field) and compare against
  that snapshot — not against the live `best` value, which may already
  have been bumped mid-run by another effect. Both existing games do
  this for exactly that reason.

## &lt;Name&gt;.tsx / &lt;Name&gt;.css

- Don't import or render `GameShell` yourself — `src/pages/Game/Game.tsx`
  already wraps every game in it via the registry. Your component is
  just what goes *inside* the shell's panel.
- Reuse the shared visual primitives from `src/styles/patterns.css` for
  anything that isn't specific to this game's identity:
  `.fp-btn`(`--primary`/`--secondary`/`--success`/`--danger`),
  `.fp-badge`(`--success`/`--danger`/`--info`), `.fp-hud-tile` /
  `.fp-hud-label` / `.fp-hud-value`, `.fp-label`, `.fp-divider`,
  `.fp-bg-accent--success`/`--danger`. Compose them with a local class
  for game-specific sizing (Snake does this: `fp-btn fp-btn--primary
  hol__button`-style composition, not a from-scratch button).
- Give the game's actual *play surface* its own identity — the thing
  that makes it recognizably this game, not another arcade panel.
  Higher or Lower's giant glowing number and Snake's radar-grid board
  are both bespoke CSS, not `.fp-panel`. `.fp-panel` is for containment
  (the shell around content); it's not meant to also be the content.
- Use `var(--font-display)` (Orbitron) for headings/scores/big display
  numbers; leave body/prompt/description text on the default system
  font. Use the existing theme tokens (`--laser-blue`, `--uv-purple`,
  `--toxic`, `--hot-pink`, `--orange`, `--muted`, `--focus-ring`) rather
  than new hex values, unless a new token is genuinely justified (see
  the accessibility note below).
- Accessibility floor, non-negotiable: real `<button>` elements for
  every control, `:focus-visible` distinct from `:hover` (reuse
  `--focus-ring`, and remember `clip-path` clips outlines too — set
  `clip-path: none` under `:focus-visible` on any angular-cut element),
  44×44px minimum touch targets, status changes exposed via
  `role="status"`/`role="alert"` without per-tick noise, and color never
  as the sole signal (pair it with text).
- If a check against the palette shows a color failing ~4.5:1 contrast
  for small text, don't just make the text bigger to dodge the AA
  large-text exception — add a lighter *-text token (see
  `--uv-purple-text`) and keep the saturated version for borders/glow.

## index.tsx

Match this exactly (see `higher-or-lower/index.tsx` or `snake/index.tsx`):

```tsx
import type { GameDefinition } from "../../types/game";
import { YourComponent } from "./YourComponent";

export const definition: GameDefinition = {
  id: "your-id",
  name: "Display Name",
  description: "One sentence, shown on the home card.",
  category: "arcade" | "cards" | "puzzle" | "word" | "strategy" | "idle" | "experimental",
  icon: "🎲",
  supportsTouch: true,
  supportsKeyboard: true,
};

export default YourComponent;
```

Then check `src/games/index.ts` — if this game already exists there as a
placeholder stub, its `index.tsx` import already works unchanged; you're
just replacing the placeholder file's contents. There's nothing else to
register.

## Architecture guardrails (repeat every time, because it's tempting to skip)

- No generic `ScorePanel`, `MobileControls`, `GameMenu`, input manager, or
  game-engine abstraction. Keep game-specific logic local to this folder.
- Only move something to shared code after a **second** game demonstrates
  the identical need — not because you can imagine a future one wanting
  it. (The one real precedent so far: Snake exposed a genuine `GameShell`
  sizing bug, which got fixed in `GameShell.css` directly — that's a bug
  fix in existing shared infrastructure, not a new abstraction, and it's
  the right kind of shared-code change to make.)
- Don't touch other games' files while implementing this one. If you spot
  a real bug elsewhere, report it — don't fix it as part of this task
  unless asked.

## When you're done

1. Run the **verify-freeplay-game** skill's checklist before calling this
   finished.
2. Run the **changelog-and-commit** skill to record the work.
