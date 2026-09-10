#!/usr/bin/env node
// PostToolUse hook (Edit|Write): runs the test suite after a source file
// changes and blocks (exit 2) with the failure output if it doesn't pass.
// Keeps regressions from sitting unnoticed the way they can when tests are
// only run manually every so often.
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const filePath = String(input?.tool_input?.file_path ?? "").replace(/\\/g, "/");

// Only source files feed the test suite; skip CSS/markdown/config edits.
if (!/\/src\/.*\.tsx?$/.test(filePath)) {
  process.exit(0);
}

try {
  // No explicit cwd: rely on this hook process's own inherited working
  // directory (Claude Code launches project hooks from the project root).
  // The JSON payload's `cwd` field isn't used here because its path format
  // isn't guaranteed to match what this platform's Node expects.
  execSync("npm test --silent", {
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 30000,
  });
  process.exit(0);
} catch (err) {
  const output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
  // Use exitCode (not exit()) so the write below is guaranteed to flush
  // before the process terminates - process.exit() can truncate in-flight
  // stdio writes, especially on Windows pipes.
  process.exitCode = 2;
  process.stderr.write(
    `Tests failed after editing ${filePath}:\n\n${output}\n` +
      `Fix the failing test(s) (or the code they're testing) before continuing.\n`,
  );
}
