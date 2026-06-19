import { useState, useCallback, useEffect } from "react";
import type { ExtensionManifest, ExtensionContext } from "@/plugins/types";
import type { ConcreteHostAPI } from "@/plugins/host";
import { useRegisterCommand } from "@/hooks/useCommands";
import { useSettings } from "@/hooks/useSettings";
import { ChatPanel } from "./ui/ChatPanel";
import { useAIProvider } from "./hooks/useAIProvider";

/** Module-level signal — PdfPreview calls this to open the panel with a question. */
let panelTrigger: ((q: string) => void) | null = null;

export function triggerAIPanel(question: string) {
  panelTrigger?.(question);
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
  const [compact, setCompact] = useState(false);
  const [clearKey, setClearKey] = useState(0);
  const { settings } = useSettings();
  const aiProvider = useAIProvider();
  const getProvider = useCallback(() => aiProvider, [aiProvider]);
  const host = ctx.host as ConcreteHostAPI;

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(() => { setOpen(false); setCompact(false); }, 350);
  }, []);

  const isSupported = useCallback(() => {
    const f = host.file.get();
    if (!f) return true; // No file open — allow general chat.
    return f.kind === "markdown" || f.kind === "pdf";
  }, [host]);

  const openPanel = useCallback(() => {
    if (!isSupported()) {
      host.notify("AI only supports Markdown and PDF", "warn");
      return;
    }
    setCompact(false);
    setOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, [isSupported, host]);

  const toggle = useCallback(() => {
    if (open) close();
    else if (isSupported()) openPanel();
    else {
      host.notify("AI only supports Markdown and PDF", "warn");
    }
  }, [open, isSupported, openPanel, close, host]);

  // When a PDF is opened, show the panel in compact mode by default.
  useEffect(() => {
    const check = () => {
      const f = host.file.get();
      if (!f) { setClearKey((k) => k + 1); return; }
      // Only support Markdown and PDF.
      if (f.kind !== "markdown" && f.kind !== "pdf") {
        if (open) close();
        return;
      }
      if (f.kind === "pdf") {
        setInitialQuestion(null);
        setCompact(true);
        setOpen(true);
        requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
      }
    };
    const unsub = host.file.subscribe(check);
    return unsub;
  }, [host, open, close]);

  // Module-level trigger so external code can open the panel with a question.
  useEffect(() => {
    panelTrigger = (q: string) => {
      setInitialQuestion(q);
      setCompact(false);
      setOpen(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    };
    return () => { panelTrigger = null; };
  }, []);

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
          host.notify("No file open", "warn");
        }
      }
    },
  });

  // Shortcut: explain code (or selection)
  useRegisterCommand({
    id: "ai.explain",
    label: "AI: Explain Code",
    shortcut: "Mod+Shift+E",
    run: () => {
      const sel = host.selection.get();
      const text = sel.code || sel.markdown;
      if (text) {
        openPanel();
      } else {
        host.notify("Select some code first", "warn");
      }
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        title={host.i18n.t("ai.openPanel")}
        style={{ fontSize: 13 }}
      >
        ✨ AI
      </button>

      {/* Panel — always mounted, hidden via CSS when closed so messages survive toggle. */}
      <div
        style={{
          position: "fixed",
          bottom: 12,
          left: "50%",
          width: 560,
          maxWidth: "calc(100vw - 48px)",
          zIndex: open ? 50 : -1,
          borderRadius: 12,
          boxShadow: visible ? "0 4px 24px rgba(0,0,0,0.14)" : "none",
          opacity: visible ? 1 : 0,
          transform: visible ? "translateX(-50%) translateY(0)" : "translateX(-50%) translateY(100%)",
          transition: "opacity 0.3s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease",
          overflow: "hidden",
          pointerEvents: open ? "auto" : "none",
        }}
      >
        <ChatPanel provider={getProvider} onClose={close} compact={compact} initialQuestion={initialQuestion} clearKey={clearKey} />
      </div>
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
      slot: "toolbar-end",
      order: 5,
      render: () => <AIPanelSlot ctx={ctx} />,
    });

    return () => {
      cleanupToolbar();
    };
  },
};

export default manifest;
