import { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ExtensionManifest, ExtensionContext } from "@/plugins/types";
import type { ConcreteHostAPI } from "@/plugins/host";
import { useRegisterCommand } from "@/hooks/useCommands";
import { useSettings } from "@/hooks/useSettings";
import { ChatPanel } from "./ui/ChatPanel";
import { useAIProvider } from "./hooks/useAIProvider";

/** Module-level signal. Validates config before opening. Returns false if blocked. */
let panelTrigger: ((q: string, autoSend?: boolean) => boolean) | null = null;

export function triggerAIPanel(question: string, autoSend = false): boolean {
  if (!panelTrigger) return false;
  return panelTrigger(question, autoSend);
}

/**
 * Wrapper that holds the open/close state for the ChatPanel so it can
 * be toggled from the toolbar button. Rendered inline via the toolbar
 * contribution — the panel itself is a fixed-position overlay.
 */
function AIPanelSlot({ ctx }: { ctx: ExtensionContext }) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [initialQuestion, setInitialQuestion] = useState<string | null>(null);
  const [clearKey, setClearKey] = useState(0);
  const [focusKey, setFocusKey] = useState(0);
  const pendingInputRef = useRef<string | null>(null);
  const { settings } = useSettings();
  const aiProvider = useAIProvider();
  const getProvider = useCallback(() => aiProvider, [aiProvider]);
  const host = ctx.host as ConcreteHostAPI;

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(() => { setOpen(false); }, 350);
  }, []);

  const isSupported = useCallback(() => {
    const f = host.file.get();
    if (!f) return true; // No file open — allow general chat.
    return f.kind === "markdown" || f.kind === "pdf" || f.kind === "docx";
  }, [host]);

  const openPanel = useCallback((q?: string, autoSend?: boolean) => {
    if (!isSupported()) {
      host.notify(host.i18n.t("ai.unsupportedType"), "warn");
      return false;
    }
    if (settings.aiProvider === "none" || !settings.aiApiKey) {
      host.notify(host.i18n.t("ai.noApiKey"), "warn");
      return false;
    }
    if (q) {
      setInitialQuestion(q);
      if (autoSend) pendingInputRef.current = q;
    }
    setOpen(true);
    setFocusKey((k) => k + 1);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    return true;
  }, [settings, isSupported, host]);

  const toggle = useCallback(() => {
    if (open) { close(); return; }
    openPanel();
  }, [open, openPanel, close]);

  // Track file changes — clear chat context on every switch, close panel
  // only when moving to an unsupported type.
  useEffect(() => {
    let lastPath = host.file.get()?.path ?? "";
    const check = () => {
      const f = host.file.get();
      const currentPath = f?.path ?? "";
      if (currentPath !== lastPath) {
        lastPath = currentPath;
        setClearKey((k) => k + 1);
        pendingInputRef.current = null;
        setInitialQuestion(null);
        if (!f || (f.kind !== "markdown" && f.kind !== "pdf" && f.kind !== "docx")) {
          if (open) close();
        }
      }
    };
    const unsub = host.file.subscribe(check);
    return unsub;
  }, [host, open, close]);

  // Module-level trigger so external code can open the panel with a question.
  // Validates AI config — returns false if the panel couldn't be opened.
  useEffect(() => {
    panelTrigger = (q: string, autoSend = false) => {
      if (!isSupported()) {
        host.notify(host.i18n.t("ai.unsupportedType"), "warn");
        return false;
      }
      if (settings.aiProvider === "none" || !settings.aiApiKey) {
        host.notify(host.i18n.t("ai.noApiKey"), "warn");
        return false;
      }
      setInitialQuestion(autoSend ? q : null);
      pendingInputRef.current = autoSend ? q : (autoSend ? null : q);
      setOpen(true);
      setFocusKey((k) => k + 1);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      return true;
    };
    return () => { panelTrigger = null; };
  }, [isSupported, settings.aiProvider, settings.aiApiKey, host]);

  // Shortcut: toggle AI panel
  useRegisterCommand({
    id: "ai.toggle",
    label: "AI: Toggle Panel",
    shortcut: "Mod+Shift+A",
    run: toggle,
  });

  // Shortcut: summarize document / selection
  useRegisterCommand({
    id: "ai.summarize",
    label: "AI: Summarize",
    shortcut: "Mod+Shift+Y",
    run: () => {
      const sel = host.selection.get();
      const selectionText = sel.markdown || sel.code || sel.html;
      if (selectionText) {
        openPanel();
      } else {
        const file = host.file.get();
        if (file) {
          openPanel();
        } else {
          host.notify(host.i18n.t("ai.noFile"), "warn");
        }
      }
    },
  });

  return (
    <>
      <button
        type="button"
        data-tauri-drag-region="no-drag"
        onClick={toggle}
        title={host.i18n.t("ai.openPanel")}
        style={{ fontSize: 13 }}
      >
        ✨ AI
      </button>

      {/* Panel rendered via portal to avoid backdrop-filter containing block on toolbar */}
      {open && createPortal(
        <div
          style={{
            position: "fixed",
            bottom: "var(--ai-panel-bottom, 12px)",
            left: "calc(var(--sidebar-width, 290px) + (100vw - var(--sidebar-width, 290px)) / 2)",
            width: 560,
            maxWidth: "calc(100vw - var(--sidebar-width, 290px) - 48px)",
            zIndex: open ? 50 : -1,
            background: "var(--md-bg)",
            borderRadius: 12,
            boxShadow: visible ? "0 4px 24px rgba(0,0,0,0.14)" : "none",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(100%)",
            transition: "opacity 0.3s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease",
            overflow: "hidden",
            pointerEvents: open ? "auto" : "none",
          }}
        >
          <ChatPanel provider={getProvider} onClose={close} initialQuestion={initialQuestion} clearKey={clearKey} pendingInput={pendingInputRef.current} focusKey={focusKey} />
        </div>,
        document.body,
      )}
    </>
  );
}

const manifest: ExtensionManifest = {
  id: "ai.assistant",
  name: "AI Assistant",
  version: "0.1.0",
  activate(ctx) {
    const cleanupToolbar = ctx.host.registry.registerToolbar({
      id: "ai.toggle-chat",
      slot: "sidebar-bottom",
      order: 5,
      render: () => <AIPanelSlot ctx={ctx} />,
    });

    return () => {
      cleanupToolbar();
    };
  },
};

export default manifest;
