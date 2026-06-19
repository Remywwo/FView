import type {
  CommandContribution,
  PanelContribution,
  RegistryLike,
  ToolbarContribution,
} from "@/plugins/types";

/**
 * Lightweight listener set for change notifications.
 * Used so that Slot components re-render when toolbar contributions
 * are added or removed at runtime.
 */
type Listener = () => void;

function createEmitter(): { subscribe: (cb: Listener) => () => void; emit: () => void } {
  const listeners = new Set<Listener>();
  return {
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    emit() {
      for (const l of listeners) l();
    },
  };
}

/**
 * In-memory registry for all contributions from the core and from extensions.
 *
 * One Registry instance is created per PluginProvider mount and shared
 * via Context. It exposes typed registration helpers and a small event
 * surface so that Slot components can re-render when toolbar items
 * change.
 *
 * NOTE: All registration methods return a cleanup callback. Callers
 * MUST invoke the cleanup when the contribution should be removed
 * (typically in a React useEffect cleanup).
 */
export class Registry implements RegistryLike {
  private readonly commands = new Map<string, CommandContribution>();
  private readonly toolbars = new Map<string, ToolbarContribution[]>();
  private readonly panels = new Map<string, PanelContribution>();

  private readonly toolbarEmitter = createEmitter();
  private readonly panelEmitter = createEmitter();

  // ── Commands ───────────────────────────────────────────────────────

  /**
   * Register a command. If a command with the same id already exists,
   * the new one replaces it (so extensions can override built-ins).
   */
  registerCommand(cmd: CommandContribution): () => void {
    const existing = this.commands.get(cmd.id);
    this.commands.set(cmd.id, cmd);
    return () => {
      // Only delete if we still own the slot — protect against a
      // double-unregister or replace-then-unregister-old pattern.
      if (this.commands.get(cmd.id) === cmd) {
        this.commands.delete(cmd.id);
      }
      // Suppress unused-param noise when existing is undefined.
      void existing;
    };
  }

  getCommand(id: string): CommandContribution | undefined {
    return this.commands.get(id);
  }

  listCommands(): CommandContribution[] {
    return Array.from(this.commands.values());
  }

  // ── Toolbar ────────────────────────────────────────────────────────

  registerToolbar(item: ToolbarContribution): () => void {
    const list = this.toolbars.get(item.slot) ?? [];
    list.push(item);
    this.toolbars.set(item.slot, list);
    this.toolbarEmitter.emit();
    return () => {
      const current = this.toolbars.get(item.slot);
      if (!current) return;
      const next = current.filter((t) => t !== item);
      if (next.length === 0) {
        this.toolbars.delete(item.slot);
      } else {
        this.toolbars.set(item.slot, next);
      }
      this.toolbarEmitter.emit();
    };
  }

  listToolbar(slot: string): ToolbarContribution[] {
    return this.toolbars.get(slot) ?? [];
  }

  /** Subscribe to toolbar changes (any slot). Used by `<Slot>`. */
  subscribeToolbar(cb: Listener): () => void {
    return this.toolbarEmitter.subscribe(cb);
  }

  // ── Panels ─────────────────────────────────────────────────────────

  registerPanel(panel: PanelContribution): () => void {
    const existing = this.panels.get(panel.id);
    this.panels.set(panel.id, panel);
    this.panelEmitter.emit();
    return () => {
      if (this.panels.get(panel.id) === panel) {
        this.panels.delete(panel.id);
      }
      this.panelEmitter.emit();
      void existing;
    };
  }

  listPanels(): PanelContribution[] {
    return Array.from(this.panels.values());
  }

  subscribePanel(cb: Listener): () => void {
    return this.panelEmitter.subscribe(cb);
  }

  // ── Diagnostics ────────────────────────────────────────────────────

  /** Snapshot of registered contribution counts. For dev/debug use. */
  stats(): { commands: number; toolbarSlots: number; panels: number } {
    return {
      commands: this.commands.size,
      toolbarSlots: this.toolbars.size,
      panels: this.panels.size,
    };
  }
}