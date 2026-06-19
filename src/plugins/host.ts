import type { LoadedFile } from "@/hooks/useFileLoader";
import type { Lang } from "@/hooks/useI18n";
import type { Settings } from "@/hooks/useSettings";
import type {
  CommandContribution,
  HostAPI as HostAPIProtocol,
  PanelContribution,
  RegistryLike,
  ToolbarContribution,
} from "@/plugins/types";
import { type SelectionSnapshot, subscribeSelection, getSelection } from "@/hooks/useSelection";
import { Registry } from "@/plugins/registry";

/**
 * Notification levels. "info" is the default if omitted.
 */
export type NotifyLevel = "info" | "warn" | "error";

/**
 * A single toast / notification. The host renders these via a small
 * toast manager (added in PR5). The `id` is used for deduping.
 */
export interface Notification {
  id: number;
  message: string;
  level: NotifyLevel;
  /** Auto-dismiss timestamp in ms since epoch (0 = sticky). */
  expiresAt: number;
}

/**
 * Minimal subscription bus used by the host to fan out changes
 * (file changed, theme changed, settings changed, notifications added)
 * to plugins without forcing them to re-render on every event.
 */
function createBus(): { subscribe: (cb: () => void) => () => void; emit: () => void } {
  const listeners = new Set<() => void>();
  return {
    subscribe(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    emit() {
      for (const cb of listeners) cb();
    },
  };
}

/**
 * Dependencies the HostAPI factory needs. These are the values returned
 * by the existing host hooks, captured by reference in App.tsx so that
 * the HostAPI itself is a stable object across renders.
 */
export interface HostDeps {
  loader: {
    get: () => LoadedFile | null;
    setContent: (text: string) => void;
  };
  folder: {
    openFolder: () => Promise<void>;
  };
  theme: {
    isDark: () => boolean;
    toggle: () => void;
  };
  i18n: {
    t: (key: string) => string;
    lang: () => Lang;
  };
  settings: {
    get: () => Settings;
    update: (patch: Partial<Settings>) => void;
  };
  /** Function that resolves a command id to its registered handler. */
  resolveCommand: (id: string) => CommandContribution | undefined;
  /** Function that registers an external command into the global command bus. */
  registerCommand: (cmd: CommandContribution) => () => void;
}

/**
 * The concrete shape exposed to extensions. Mirrors the protocol in
 * `types.ts` but with concrete types in place of `unknown`. The protocol
 * type uses `unknown` to avoid circular imports; this concrete shape
 * is assignable to it.
 */
export interface ConcreteHostAPI extends Omit<HostAPIProtocol, "file" | "selection" | "settings" | "registry" | "notify"> {
  readonly file: {
    get(): LoadedFile | null;
    subscribe(cb: () => void): () => void;
    setContent(text: string): void;
    _emit(): void;
  };
  readonly selection: {
    get(): SelectionSnapshot;
    subscribe(cb: () => void): () => void;
  };
  readonly settings: {
    get(): Settings;
    update(patch: Partial<Settings>): void;
  };
  readonly registry: Registry;
  /** Subscribe to host-wide state changes (theme, settings, etc.). Does NOT fire on notifications. */
  readonly events: {
    subscribe(cb: () => void): () => void;
  };
  /** Subscribe to notification events (toast shown / dismissed). Separate from `events`. */
  readonly onNotification: {
    subscribe(cb: () => void): () => void;
  };
  /**
   * Show a toast/notification. Returns the notification id for advanced
   * use (e.g. programmatic dismissal).
   */
  notify(message: string, level?: NotifyLevel): number;
}

/**
 * Construct a stable HostAPI instance from the captured host dependencies.
 *
 * The returned object keeps the same identity across calls — App.tsx
 * uses `useMemo` keyed on the deps so the host reference never churns.
 * Plugins read it from PluginContext.
 */
export function createHostAPI(deps: HostDeps): ConcreteHostAPI {
  const registry = new Registry();
  const eventsBus = createBus();       // theme, settings, etc.
  const notifyBus = createBus();       // notifications only
  const fileBus = createBus();         // file changes only
  let nextNotificationId = 1;

  const host: ConcreteHostAPI = {
    file: {
      get: () => deps.loader.get(),
      setContent: (text) => deps.loader.setContent(text),
      subscribe: fileBus.subscribe,
      _emit: fileBus.emit,
    },
    selection: {
      get: () => getSelection(),
      subscribe: (cb) => subscribeSelection(cb),
    },
    theme: {
      isDark: () => deps.theme.isDark(),
      toggle: () => deps.theme.toggle(),
    },
    i18n: {
      t: (key) => deps.i18n.t(key),
      lang: () => deps.i18n.lang(),
    },
    settings: {
      get: () => deps.settings.get(),
      update: (patch) => deps.settings.update(patch),
    },
    commands: {
      register: (cmd) => deps.registerCommand(cmd),
      execute: (id, ...args) => {
        const cmd = deps.resolveCommand(id);
        return cmd ? cmd.run(...args) : undefined;
      },
    },
    registry,
    events: {
      subscribe: eventsBus.subscribe,
    },
    onNotification: {
      subscribe: notifyBus.subscribe,
    },
    notify: (message, level = "info") => {
      const id = nextNotificationId++;
      const notification: Notification = {
        id,
        message,
        level,
        expiresAt: Date.now() + 4000,
      };
      notificationQueue.push(notification);
      notifyBus.emit();
      return id;
    },
  };

  return host;
}

/**
 * Module-level notification queue. PR5 will add a `<ToastHost>` that
 * subscribes to `host.onNotification` and drains this list to render toasts.
 */
export const notificationQueue: Notification[] = [];

/**
 * Convenience: build a `RegistryLike` adapter around the concrete
 * registry, for plugins that prefer the narrower protocol surface.
 */
export function asRegistryLike(reg: Registry): RegistryLike {
  return {
    registerToolbar: (item: ToolbarContribution) => reg.registerToolbar(item),
    registerPanel: (panel: PanelContribution) => reg.registerPanel(panel),
    listToolbar: (slot: string) => reg.listToolbar(slot),
  };
}