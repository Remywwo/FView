import { Fragment, useEffect, useState } from "react";
import { useExtensionContext } from "@/hooks/usePlugin";
import type { ToolbarContribution } from "@/plugins/types";

interface SlotProps {
  /** Slot name — matches `ToolbarContribution.slot`. */
  name: string;
}

/**
 * Renders the toolbar contributions registered for the named slot.
 *
 * Empty when no plugin has registered anything, so the visual layout
 * is unaffected. Re-renders when contributions are added or removed.
 *
 * Placement: drop `<Slot name="..." />` anywhere a plugin should be
 * able to inject UI (toolbar, status bar, side panel, etc.).
 */
export function Slot({ name }: SlotProps) {
  const { host } = useExtensionContext();
  const [items, setItems] = useState<ToolbarContribution[]>(() => host.registry.listToolbar(name));

  useEffect(() => {
    // Re-read on subscribe (handles the case where the initial list
    // grew between mount and effect) and on every registry change.
    setItems(host.registry.listToolbar(name));
    return host.registry.subscribeToolbar(() => {
      setItems(host.registry.listToolbar(name));
    });
  }, [host.registry, name]);

  if (items.length === 0) return null;

  const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <>
      {sorted.map((item) => (
        <Fragment key={item.id}>{item.render()}</Fragment>
      ))}
    </>
  );
}