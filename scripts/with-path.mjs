// Cross-platform wrapper: locate cargo and add it to PATH, then exec the given command.

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

function isExecutable(p) {
  if (!p) return false;
  // On Windows, existsSync can be unreliable (e.g. GitHub Actions runner
  // overrides HOME to a temp dir and path resolution may fail). Try to
  // actually run cargo --version and trust the exit code.
  try {
    const r = spawnSync(p, ["--version"], { timeout: 5000, windowsHide: true });
    return r.status === 0;
  } catch {
    return false;
  }
}

function findCargoDir() {
  const exe = platform === "win32" ? "cargo.exe" : "cargo";
  const sep = platform() === "win32" ? ";" : ":";

  // 1. Scan current PATH first
  for (const dir of (process.env.PATH || "").split(sep)) {
    if (!dir) continue;
    if (isExecutable(join(dir, exe))) return dir;
  }

  // 2. Fall back to common install locations
  const home = homedir();
  const candidates = [
    process.env.CARGO_HOME ? join(process.env.CARGO_HOME, "bin") : null,
    join(home, ".cargo", "bin"),
    platform() === "win32" && process.env.USERPROFILE
      ? join(process.env.USERPROFILE, ".cargo", "bin")
      : null,
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/root/.cargo/bin",
    "/home/runner/.cargo/bin",
  ].filter(Boolean);
  for (const dir of candidates) {
    if (isExecutable(join(dir, exe))) return dir;
  }
  return null;
}

const cargoDir = findCargoDir();
if (!cargoDir) {
  console.error("[with-path] Could not locate cargo.");
  console.error("  CARGO_HOME =", process.env.CARGO_HOME || "(unset)");
  console.error("  PATH first 10 entries:");
  (process.env.PATH || "").split(platform() === "win32" ? ";" : ":").slice(0, 10).forEach(d => console.error("   ", d));
  process.exit(1);
}

const sep = platform() === "win32" ? ";" : ":";
process.env.PATH = `${cargoDir}${sep}${process.env.PATH}`;
process.env.CARGO_HOME = process.env.CARGO_HOME || join(homedir(), ".cargo");
process.env.RUSTUP_HOME = process.env.RUSTUP_HOME || join(homedir(), ".rustup");

console.log(`[with-path] cargo resolved at ${join(cargoDir, platform() === "win32" ? "cargo.exe" : "cargo")}`);

const { spawn } = await import("node:child_process");
const [, , cmd, ...args] = process.argv;
if (!cmd) {
  console.error("Usage: node scripts/with-path.mjs <command> [args...]");
  process.exit(1);
}

const child = spawn(cmd, args, { stdio: "inherit", env: process.env });
child.on("error", (err) => {
  console.error(`[with-path] failed to spawn ${cmd}:`, err.message);
  process.exit(1);
});
child.on("exit", (code) => process.exit(code ?? 0));
