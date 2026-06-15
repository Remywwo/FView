// Cross-platform wrapper: locate cargo and add it to PATH, then exec the given command.
// This avoids requiring the user to manually add ~/.cargo/bin to PATH after rustup install.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir, platform } from "node:os";
import { join } from "node:path";

function isExecutable(p) {
  if (!p) return false;
  if (!existsSync(p)) return false;
  // On Windows, .exe is required
  if (platform === "win32" && !/\.(exe|cmd|bat)$/i.test(p)) return false;
  return true;
}

function findCargoDir() {
  const exe = platform === "win32" ? "cargo.exe" : "cargo";
  const candidates = [
    join(homedir(), ".cargo", "bin"),                    // rustup default
    "/opt/homebrew/bin",                                // macOS Apple Silicon Homebrew
    "/usr/local/bin",                                   // macOS Intel / Linux Homebrew
    "/usr/bin",
    "/root/.cargo/bin",                                 // Linux root user
    "C:\\Users\\runneradmin\\.cargo\\bin",              // GitHub Actions windows
    "C:\\Program Files\\Rust\\bin",                     // Windows standalone
  ];
  for (const dir of candidates) {
    if (isExecutable(join(dir, exe))) return dir;
  }
  return null;
}

const cargoDir = findCargoDir();
if (!cargoDir) {
  console.error("[with-path] Could not locate cargo. Tried:");
  for (const d of [
    join(homedir(), ".cargo", "bin"),
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
  ]) {
    console.error("  -", d);
  }
  console.error("\nPlease install Rust via https://rustup.rs/");
  process.exit(1);
}

const sep = platform === "win32" ? ";" : ":";
process.env.PATH = `${cargoDir}${sep}${process.env.PATH}`;
process.env.CARGO_HOME = process.env.CARGO_HOME || join(homedir(), ".cargo");
process.env.RUSTUP_HOME = process.env.RUSTUP_HOME || join(homedir(), ".rustup");

console.log(`[with-path] cargo resolved at ${join(cargoDir, "cargo")}`);

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
