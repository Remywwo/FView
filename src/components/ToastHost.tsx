import { useEffect, useRef, useState } from "react";
import { useExtensionContext } from "@/hooks/usePlugin";
import { notificationQueue, type Notification } from "@/plugins/host";

/**
 * Subscribes to host notifications and renders them as transient
 * toasts in the bottom-right corner.
 *
 * Reads from the module-level `notificationQueue` (populated by
 * `host.notify`) and tracks which ids have already been shown so
 * re-renders don't replay old toasts.
 */
export function ToastHost() {
  const { host } = useExtensionContext();
  const [toasts, setToasts] = useState<Notification[]>([]);
  const seenIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    // Mark anything already queued at mount time so we don't replay it.
    for (const n of notificationQueue) seenIds.current.add(n.id);
    return host.onNotification.subscribe(() => {
      const fresh: Notification[] = [];
      for (const n of notificationQueue) {
        if (!seenIds.current.has(n.id)) {
          seenIds.current.add(n.id);
          fresh.push(n);
        }
      }
      if (fresh.length === 0) return;
      setToasts((prev) => [...prev, ...fresh]);
      for (const n of fresh) {
        const ms = Math.max(n.expiresAt - Date.now(), 0);
        window.setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== n.id));
        }, ms);
      }
    });
  }, [host.onNotification]);

  if (toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          aria-live="polite"
          style={{
            pointerEvents: "auto",
            background:
              t.level === "error"
                ? "rgba(220, 38, 38, 0.95)"
                : t.level === "warn"
                  ? "rgba(217, 119, 6, 0.95)"
                  : "rgba(15, 23, 42, 0.95)",
            color: "#fff",
            padding: "10px 14px",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
            fontSize: 13,
            maxWidth: 320,
            lineHeight: 1.4,
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}