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
  const sep = platform === "win32" ? ";" : ":";
  const tried = [];

  // 1. Scan current PATH first — cargo may already be there
  //    (GitHub Actions Windows runner puts cargo in PATH; on Linux/macOS
  //    it works after `dtolnay/rust-toolchain` configures the toolchain)
  for (const dir of (process.env.PATH || "").split(sep)) {
    if (!dir) continue;
    tried.push(dir);
    if (isExecutable(join(dir, exe))) return dir;
  }

  // 2. Fall back to common install locations
  const home = homedir();
  const candidates = [
    process.env.CARGO_HOME ? join(process.env.CARGO_HOME, "bin") : null,
    platform === "win32" && process.env.USERPROFILE
      ? join(process.env.USERPROFILE, ".cargo", "bin")
      : null,
    join(home, ".cargo", "bin"),                        // rustup default
    platform === "win32" ? "C:\\Users\\runneradmin\\.cargo\\bin" : null,
    platform === "win32" ? "C:\\Program Files\\Rust\\bin" : null,
    "/opt/homebrew/bin",                                // macOS Apple Silicon Homebrew
    "/usr/local/bin",                                   // macOS Intel / Linux Homebrew
    "/usr/bin",
    "/root/.cargo/bin",                                 // Linux root user
    "/home/runner/.cargo/bin",                          // GitHub Actions Linux
  ].filter(Boolean);
  for (const dir of candidates) {
    tried.push(dir);
    if (isExecutable(join(dir, exe))) return dir;
  }
  return null;
}

const cargoDir = findCargoDir();
if (!cargoDir) {
  console.error("[with-path] Could not locate cargo. Tried:");
  const tried = [
    ...(process.env.PATH || "").split(platform === "win32" ? ";" : ":"),
    process.env.CARGO_HOME ? join(process.env.CARGO_HOME, "bin") : null,
    platform === "win32" && process.env.USERPROFILE
      ? join(process.env.USERPROFILE, ".cargo", "bin")
      : null,
    join(homedir(), ".cargo", "bin"),
    platform === "win32" ? "C:\\Users\\runneradmin\\.cargo\\bin" : null,
    platform === "win32" ? "C:\\Program Files\\Rust\\bin" : null,
    "/opt/homebrew/bin",
    "/usr/local/bin",
    "/usr/bin",
    "/root/.cargo/bin",
    "/home/runner/.cargo/bin",
  ].filter(Boolean);
  for (const d of new Set(tried)) console.error("  -", d);
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
