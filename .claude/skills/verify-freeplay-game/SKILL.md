---
name: verify-freeplay-game
description: The standard verification pass for Freeplay work — tests, build, dev server, Playwright checks across viewports, and a live playtest. Use after implementing or changing a game, or after a shared shell/visual-language change, before considering the work done.
---

# Verify a Freeplay Game or Shell Change

"Tests pass" and "it built" are necessary, not sufficient. This project's
standard is closer to "I actually played it and it felt right" — Snake's
starting speed only got caught because someone played it live, not
because any automated check flagged it.

## 1. Tests and build

```bash
npm test
npm run build
rm -rf dist   # build output isn't committed; clean it up after checking it succeeded
```

Fix failures before doing anything else. (If a `PostToolUse` hook is
active, it's already running tests after every source edit — this step
is the final confirmation, not the first line of defense.)

## 2. Dev server

```bash
curl -sf http://localhost:5173 >/dev/null && echo running || echo "need to start"
```

If not running, start it in the background and wait for it to actually
serve before doing anything else:

```bash
nohup npm run dev -- --port 5173 > /tmp/freeplay-dev.log 2>&1 &
timeout 30 bash -c 'until curl -sf http://localhost:5173 >/dev/null; do sleep 1; done'
```

Remember whether *you* started it. If you did, stop it when you're done
(find the PID via `Get-NetTCPConnection -LocalPort 5173 -State Listen`
in PowerShell, or the equivalent for whatever port you used, then stop
that process). If it was already running when you arrived, leave it
running — it's probably serving someone else's session too.

## 3. Automated browser pass (Playwright)

Write a throwaway Node script in the scratchpad directory using
`playwright`'s `chromium.launch()` — this project has no dedicated test
harness for this, every prior verification pass has used an ad hoc
script, and that's fine. Cover:

- **Viewports**: 320, 375 or 390, 768, 1440 px wide, at a realistic
  height (e.g. 844 for phone, 900 for desktop). Screenshot each — actually
  read the resulting image, don't just check for the absence of errors.
- **No horizontal overflow**: `document.documentElement.scrollWidth >
  document.documentElement.clientWidth` should be false at every width.
- **Console**: attach `page.on('console', ...)` and `page.on('pageerror',
  ...)` before navigating; assert no errors after a full play session.
- **Reduced motion**: `browser.newPage({ reducedMotion: 'reduce' })` —
  confirm the game still renders correctly and doesn't get stuck in a
  mid-transition state.
- **Focus-visible**: `page.keyboard.press('Tab')`, then check
  `getComputedStyle(document.activeElement)` for a visible outline —
  and give any CSS `transition` a moment (`waitForTimeout`) before
  reading computed styles, or you'll catch the pre-transition value and
  wrongly conclude the style isn't applying.
- **The actual game loop, end to end**: start a run, make it win and
  lose (or reach whatever the terminal states are), trigger the
  restart path, and confirm state resets correctly (score back to
  zero, best preserved). For anything with real-time behavior (a
  movement loop, a timer), measure actual elapsed wall-clock time
  against the expected tick rate rather than trusting the code by
  inspection — this is exactly how Snake's Strict-Mode-doesn't-double-
  the-tick-rate claim got confirmed, not by reading the effect and
  assuming.
- **Persistence**: reload the page; confirm best score survived and the
  current run did not (fresh state, not a resumed game-over screen).
- **Route navigation**: navigate away to Home and back; confirm no
  leaked timers/listeners (re-check the tick-rate measurement above
  after remounting) and no console errors.

## 4. Live playtest (when the user wants to watch or drive)

When the user asks to see it via the `claude-in-chrome` extension: load
the tool set (`ToolSearch` with the core browser tools), navigate to the
running dev server, and either narrate a play session yourself or hand
control to the user. If the game has any real-time cadence (a tick,
animation, or timer), **expect that you cannot react fast enough over a
screenshot round-trip to actually play it well** — say so, and let the
user drive directly rather than fighting the latency. Live play is how
"game feel" problems (a starting speed that's technically-correct but
subjectively too fast, a swipe threshold that feels finicky, a D-pad
that's slightly out of thumb reach) get caught — the automated pass
above verifies correctness, not feel.

## 5. Report, don't just assert

When reporting results, give specifics: measured pixel values, measured
timings, the actual contrast ratio computed, the actual viewport widths
tested — not just "verified touch targets are large enough" or "checked
contrast." A number the user can sanity-check themselves is worth more
than a claim they have to trust.
