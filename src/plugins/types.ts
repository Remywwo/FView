import type { ReactNode } from "react";

/**
 * A named action that can be triggered from anywhere in the app.
 *
 * Commands are the canonical way for plugins to expose functionality.
 * Built-in commands (file.open, theme.toggle, etc.) live in the core hooks;
 * plugins contribute additional commands via the same registry.
 */
export interface CommandContribution {
  /** Stable identifier, e.g. "file.open", "ai.summarize.selection". */
  id: string;
  /** Human-readable label for command palette / debug UI. */
  label: string;
  /**
   * Shortcut string in the format "Mod+O", "Mod+Shift+S", "Mod+.".
   * Mod maps to ⌘ on macOS and Ctrl on Windows/Linux.
   * When omitted, the command has no shortcut.
   */
  shortcut?: string;
  /**
   * If true, the shortcut listener runs during the capture phase.
   * Required for shortcuts that must fire before any other listener
   * (e.g. ⇧⌘O which previously lived in App.tsx with capture:true).
   */
  capture?: boolean;
  /**
   * Optional predicate expression evaluated at trigger time.
   * Reserved for future "context-sensitive" commands (e.g. only when
   * current.kind === 'pdf'). Unused for now — all commands fire on
   * shortcut regardless of focus.
   */
  when?: string;
  /** Handler invoked when the command is executed. */
  run: (...args: unknown[]) => void | Promise<void>;
}

/**
 * A contribution to a named UI slot.
 *
 * The host renders contributions at well-known slot names
 * ("toolbar-end", "status-bar", etc.). Each contribution's `render`
 * returns the React tree to embed. Use `order` to control placement
 * within a slot when multiple plugins contribute.
 */
export interface ToolbarContribution {
  id: string;
  /** Slot name — match the value passed to `<Slot name="..." />`. */
  slot: string;
  /** Sort key within the slot. Lower numbers render first. */
  order?: number;
  render: () => ReactNode;
}

/**
 * A contribution for a side panel.
 *
 * Panels are stacked or floating panels that extensions can mount.
 * This is a placeholder for future work (e.g. AI chat panel).
 */
export interface PanelContribution {
  id: string;
  title: string;
  render: () => ReactNode;
}

/**
 * Minimal, stable host API exposed to extensions.
 *
 * Defined here as an opaque interface — concrete shape lives in
 * `src/plugins/host.ts` to avoid circular imports between types and
 * runtime implementations.
 */
export interface HostAPI {
  readonly file: {
    get(): unknown | null;
    subscribe(cb: () => void): () => void;
    setContent(text: string): void;
  };
  readonly selection: {
    get(): unknown;
    subscribe(cb: () => void): () => void;
  };
  readonly theme: {
    isDark(): boolean;
    toggle(): void;
  };
  readonly i18n: {
    t(key: string): string;
    lang(): string;
  };
  readonly settings: {
    get(): unknown;
    update(patch: unknown): void;
  };
  readonly commands: {
    register(cmd: CommandContribution): () => void;
    execute(id: string, ...args: unknown[]): void | Promise<void>;
  };
  readonly registry: RegistryLike;
  notify(message: string, level?: "info" | "warn" | "error"): void;
}

/**
 * A trimmed view of the Registry that extensions may use to register
 * their own contributions. Concrete `Registry` lives in registry.ts;
 * this interface exists so HostAPI can be typed without importing it.
 */
export interface RegistryLike {
  registerToolbar(item: ToolbarContribution): () => void;
  registerPanel(panel: PanelContribution): () => void;
  listToolbar(slot: string): ToolbarContribution[];
}

/**
 * The context passed to an extension's activate() function.
 * Currently only exposes the host API; may grow to include
 * storage paths, capabilities, etc.
 */
export interface ExtensionContext {
  host: HostAPI;
}

/**
 * An extension's static manifest.
 *
 * Extensions are statically imported (no runtime loading yet) and
 * activated by the PluginProvider at mount time. The optional
 * return value from activate() is a cleanup callback invoked when
 * the extension is unregistered or the host unmounts.
 */
export interface ExtensionManifest {
  /** Stable identifier, e.g. "demo.hello". */
  id: string;
  /** Human-readable name shown in the extensions manager (future). */
  name: string;
  /** Semver string, used for diagnostics and future updates. */
  version: string;
  activate(ctx: ExtensionContext): void | (() => void);
}