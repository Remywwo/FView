import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { CommandContribution } from "@/plugins/types";

/**
 * Public surface of the command system. Provided via React Context
 * by `<CommandProvider>`.
 */
interface CommandAPI {
  /** Register a command. Returns a cleanup callback that removes it. */
  register: (cmd: CommandContribution) => () => void;
  /** Execute a command by id. Returns the command's result if any. */
  execute: (id: string, ...args: unknown[]) => void | Promise<void>;
  /** Look up a registered command by id. Returns undefined if not found. */
  getCommand: (id: string) => CommandContribution | undefined;
}

const CommandContext = createContext<CommandAPI | null>(null);

/**
 * Low-level accessor for the command API. Throws if called outside
 * a `<CommandProvider>`.
 */
export function useCommandContext(): CommandAPI {
  const ctx = useContext(CommandContext);
  if (!ctx) {
    throw new Error("useCommandContext must be used within CommandProvider");
  }
  return ctx;
}

/**
 * Returns a stable callback that executes the named command.
 * Use this in onClick handlers, etc.
 */
export function useCommand(id: string): () => void {
  const ctx = useCommandContext();
  return useCallback(() => {
    void ctx.execute(id);
  }, [ctx, id]);
}

/**
 * Returns a stable callback that executes the named command with
 * the given arguments at call time. Convenience wrapper over
 * `useCommand` for parameterized actions.
 */
export function useCommandWith(id: string): (...args: unknown[]) => void {
  const ctx = useCommandContext();
  return useCallback(
    (...args: unknown[]) => {
      void ctx.execute(id, ...args);
    },
    [ctx, id],
  );
}

/**
 * Registers a command for the lifetime of the calling component.
 *
 * The latest `run` closure is always invoked (via ref), so handlers
 * that close over hook state (e.g. `open` from `useFileLoader`) stay
 * fresh without re-registering on every render. Re-registration only
 * happens when `id` changes.
 *
 * Usage:
 *   useRegisterCommand({ id: "file.open", label: "Open", shortcut: "Mod+O", run: open });
 */
export function useRegisterCommand(cmd: CommandContribution): void {
  const { register } = useCommandContext();
  const cmdRef = useRef(cmd);
  cmdRef.current = cmd;
  // Stable registration — keyed on id so a stable run closure can
  // capture fresh state via cmdRef without churning the registry.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    return register({
      id: cmd.id,
      label: cmd.label,
      shortcut: cmd.shortcut,
      capture: cmd.capture,
      when: cmd.when,
      run: (...args) => cmdRef.current.run(...args),
    });
    // We intentionally only re-register when the command id changes.
    // Other fields (label, shortcut, run) update via cmdRef.
  }, [register, cmd.id]);
}

// ── Shortcut parsing & matching ─────────────────────────────────────

interface ParsedShortcut {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  /** Lowercased character ("o", ".") or special key ("ArrowLeft"). */
  key: string;
}

function parseShortcut(shortcut: string): ParsedShortcut {
  const result: ParsedShortcut = { mod: false, shift: false, alt: false, key: "" };
  for (const part of shortcut.split("+").map((p) => p.trim())) {
    if (part === "Mod") result.mod = true;
    else if (part === "Shift") result.shift = true;
    else if (part === "Alt") result.alt = true;
    else result.key = part.length === 1 ? part.toLowerCase() : part;
  }
  return result;
}

function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  const platform = navigator.platform || "";
  const userAgent = navigator.userAgent || "";
  return /Mac|iPhone|iPad/.test(platform) || /Mac OS X/.test(userAgent);
}

function eventKey(e: KeyboardEvent): string {
  if (e.key.length === 1) return e.key.toLowerCase();
  return e.key;
}

function matches(e: KeyboardEvent, parsed: ParsedShortcut): boolean {
  const mod = isMacPlatform() ? e.metaKey : e.ctrlKey;
  if (mod !== parsed.mod) return false;
  if (e.shiftKey !== parsed.shift) return false;
  if (e.altKey !== parsed.alt) return false;
  return eventKey(e) === parsed.key;
}

// ── Provider ────────────────────────────────────────────────────────

/**
 * Wraps the app and centralizes all keyboard shortcut handling.
 *
 * Two registries are kept:
 *   - bubble registry: commands without `capture: true`
 *   - capture registry: commands with `capture: true` (e.g. ⇧⌘O)
 *
 * Two listeners are installed:
 *   1. capture-phase listener checks only the capture registry
 *   2. bubble-phase listener checks the bubble registry, then
 *      falls back to capture registry if no match (so commands
 *      without `capture: true` still work even if user code also
 *      listens on capture).
 *
 * Place this Provider ABOVE any hook that calls `useCommands` —
 * typically in `main.tsx`, above `<App />`.
 */
export function CommandProvider({ children }: { children: ReactNode }) {
  // Stable refs across renders — commands register here, listeners read here.
  const bubbleRef = useRef<Map<string, CommandContribution>>(new Map());
  const captureRef = useRef<Map<string, CommandContribution>>(new Map());

  const register = useCallback((cmd: CommandContribution): (() => void) => {
    // Commands are always stored in the registry so that `execute(id)`
    // can find them. The keydown listener below simply skips commands
    // without a shortcut, but execute() works for any registered command
    // (this matters for plugin commands invoked by toolbar buttons).
    const target = cmd.capture ? captureRef.current : bubbleRef.current;
    target.set(cmd.id, cmd);
    return () => {
      if (target.get(cmd.id) === cmd) {
        target.delete(cmd.id);
      }
    };
  }, []);

  const execute = useCallback(
    (id: string, ...args: unknown[]) => {
      const cmd = bubbleRef.current.get(id) ?? captureRef.current.get(id);
      if (!cmd) return;
      return cmd.run(...args);
    },
    [],
  );

  const getCommand = useCallback((id: string) => {
    return bubbleRef.current.get(id) ?? captureRef.current.get(id);
  }, []);

  const api = useMemo<CommandAPI>(
    () => ({ register, execute, getCommand }),
    [register, execute, getCommand],
  );

  // Global keydown listener — installed once for the lifetime of the Provider.
  useEffect(() => {
    const captureHandler = (e: KeyboardEvent) => {
      for (const cmd of captureRef.current.values()) {
        if (cmd.shortcut && matches(e, parseShortcut(cmd.shortcut))) {
          e.preventDefault();
          e.stopPropagation();
          void cmd.run();
          return;
        }
      }
    };

    const bubbleHandler = (e: KeyboardEvent) => {
      // Try bubble registry first.
      for (const cmd of bubbleRef.current.values()) {
        if (cmd.shortcut && matches(e, parseShortcut(cmd.shortcut))) {
          e.preventDefault();
          void cmd.run();
          return;
        }
      }
      // Fall back to capture registry so a capture command still fires
      // if the capture listener was somehow bypassed.
      for (const cmd of captureRef.current.values()) {
        if (cmd.shortcut && matches(e, parseShortcut(cmd.shortcut))) {
          e.preventDefault();
          void cmd.run();
          return;
        }
      }
    };

    window.addEventListener("keydown", captureHandler, { capture: true });
    window.addEventListener("keydown", bubbleHandler);
    return () => {
      window.removeEventListener("keydown", captureHandler, { capture: true } as EventListenerOptions);
      window.removeEventListener("keydown", bubbleHandler);
    };
  }, []);

  return <CommandContext.Provider value={api}>{children}</CommandContext.Provider>;
}