import {
  createContext,
  useContext,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { ExtensionManifest } from "@/plugins/types";
import type { ConcreteHostAPI } from "@/plugins/host";

/**
 * PluginContext exposes the active HostAPI to plugin React components.
 *
 * The host itself is constructed by App.tsx (where all the host hooks
 * live) and passed in via `<PluginProvider host={...}>`. The Provider
 * is mounted inside App.tsx — not at the root in main.tsx — so that
 * React 18 StrictMode's double-mount of providers does not reset
 * `useFileLoader` state (current file, dirty flag, etc.).
 */
interface PluginContextValue {
  host: ConcreteHostAPI;
}

const PluginContext = createContext<PluginContextValue | null>(null);

export function useExtensionContext(): PluginContextValue {
  const ctx = useContext(PluginContext);
  if (!ctx) {
    throw new Error("useExtensionContext must be used within PluginProvider");
  }
  return ctx;
}

interface PluginProviderProps {
  host: ConcreteHostAPI;
  /** Extensions to activate on mount. */
  extensions?: ExtensionManifest[];
  children: ReactNode;
}

/**
 * Wraps the app with the plugin Context and activates all provided
 * extensions on mount. Cleanup callbacks returned from `activate()`
 * are invoked when the Provider unmounts (or when the extensions
 * array reference changes).
 */
export function PluginProvider({ host, extensions = [], children }: PluginProviderProps) {
  // Keep the latest host in a ref so activate() closures always call
  // into the freshest host without re-running the activation effect.
  const hostRef = useRef(host);
  hostRef.current = host;

  // Stable extensions key — activating again only when the array
  // identity changes (App.tsx passes a memoized array).
  useEffect(() => {
    if (extensions.length === 0) return;
    const cleanups: Array<() => void> = [];
    for (const ext of extensions) {
      try {
        const cleanup = ext.activate({ host: hostRef.current });
        cleanups.push(typeof cleanup === "function" ? cleanup : () => undefined);
      } catch (err) {
        // Swallow plugin activation errors so one bad plugin can't
        // break the host. The plugin author should have caught this.
        // eslint-disable-next-line no-console
        console.error(`[plugins] activate failed for "${ext.id}":`, err);
      }
    }
    return () => {
      for (const cleanup of cleanups) {
        try {
          cleanup();
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(`[plugins] cleanup failed:`, err);
        }
      }
    };
  }, [extensions]);

  return <PluginContext.Provider value={{ host }}>{children}</PluginContext.Provider>;
}