#!/usr/bin/env node
// Stop hook: a gentle, non-blocking reminder when a turn ends with
// uncommitted changes sitting in the working tree. Never blocks — some
// turns legitimately end mid-task — but exists so real work (a tuning
// change, a small fix) doesn't quietly sit uncommitted across turns the
// way a Snake speed adjustment once did.
import { execSync } from "node:child_process";

try {
  // No explicit cwd: rely on this hook process's own inherited working
  // directory (Claude Code launches project hooks from the project root).
  const status = execSync("git status --short", { encoding: "utf8" });
  if (status.trim().length > 0) {
    const lines = status.trim().split("\n").map((line) => `  ${line}`).join("\n");
    console.log(
      `Note: uncommitted changes in the working tree:\n${lines}\n` +
        `If this is finished work, consider committing it (and updating CHANGELOG.md) ` +
        `before moving on.`,
    );
  }
} catch {
  // Not a git repo (or git unavailable) - nothing to say.
}

// No explicit process.exit(0) here: let the script end naturally so any
// pending stdout write flushes fully before the process terminates.
