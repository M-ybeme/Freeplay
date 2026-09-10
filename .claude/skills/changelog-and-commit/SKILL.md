---
name: changelog-and-commit
description: How this project commits work and keeps CHANGELOG.md accurate — the two-commit convention, entry format, and the pre-wrap-up check for work that was done but never committed or changelogged. Use whenever committing project work, and always before telling the user a task is finished.
---

# Changelog and Commit Convention

This project's changelog once fell behind: a live-playtesting tweak to
Snake's speed sat as an uncommitted diff across a turn boundary, with no
commit and therefore no changelog entry, until it was noticed and asked
about explicitly. The check at the bottom of this skill exists because of
that — run it before telling the user something is done, not just when
asked to update the changelog.

## Format

`CHANGELOG.md` is newest-first, keyed by short commit hash — there is no
semantic version and none should be invented (no git tags exist;
`package.json`'s `0.1.0` is a placeholder). The file's own header
contains the exact template:

```
## `<short-hash>` — <commit subject>

- What changed, in user-facing / architectural terms — not a file list.
- Any abstraction deliberately deferred and why, if it materially
  explains the project's current shape.
```

Good entries (see the existing ones for calibration) explain *why*, not
just *what* — deliberate omissions, measured numbers (contrast ratios,
pixel shifts, timing), and anything a future session would otherwise
have to rediscover by reading a diff.

## The two-commit workflow

1. Implement and verify the work (see `verify-freeplay-game` if it's a
   game/shell change).
2. Commit the implementation with a descriptive message (include the
   `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` trailer).
3. Get the short hash: `git log -1 --format=%h`.
4. Add one changelog entry, using that hash, above the current top entry
   in `CHANGELOG.md`.
5. Commit `CHANGELOG.md` alone, with a small message like "Add changelog
   entry for X" — this commit does not get its own changelog entry
   (changelog-only commits are self-referential and are skipped; every
   *other* commit should have exactly one entry).

Only commit when the user has asked for it, or it's an approved
continuation of the current task — this follows the project's general
git safety rules, not something special to this skill.

## Before telling the user a task is done

Run this check. It takes seconds and it is the exact thing that failed
once already:

```bash
git status --short          # anything uncommitted that represents finished work?
git log --oneline -5        # what actually landed?
```

Then cross-check: does every commit since your last checkpoint — other
than a commit whose own subject is about the changelog — have a matching
`## \`<hash>\`` entry in `CHANGELOG.md`? If a `PostToolUse` test hook and
a `Stop` dirty-tree reminder are configured for this project, they help
catch pieces of this automatically, but they don't replace this check —
the dirty-tree reminder is deliberately non-blocking, and neither hook
knows whether the changelog itself is up to date.

If you find uncommitted work or an un-changelogged commit while doing
this check, fix it before reporting completion rather than mentioning it
as a caveat.
