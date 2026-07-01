import { useEffect, useRef, useState } from "react";
import type { LoadedFile } from "@/hooks/useFileLoader";
import { useI18n } from "@/hooks/useI18n";
import { triggerAIPanel } from "@/plugins/extensions/ai-assistant";

type Status = "loading" | "ready" | "error";

export function DocxPreview({ file }: { file: LoadedFile }) {
  const { t, lang } = useI18n();
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; text: string } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setError(null);

    const container = containerRef.current;
    if (!container) return;
    container.innerHTML = "";

    if (!file.binaryBytes) {
      setError("No DOCX data available");
      setStatus("error");
      return;
    }

    (async () => {
      try {
        const { renderAsync } = await import("docx-preview");
        await renderAsync(
          file.binaryBytes!.slice(),
          container,
          undefined,
          {
            className: "docx",
            inWrapper: true,
            breakPages: true,
            ignoreWidth: false,
            ignoreHeight: false,
            ignoreFonts: false,
            useBase64URL: true,
            renderHeaders: true,
            renderFooters: true,
            renderFootnotes: true,
            renderEndnotes: true,
            renderChanges: false,
            renderComments: false,
          },
        );
        if (!cancelled) setStatus("ready");
      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : String(e);
        setError(message);
        setStatus("error");
        console.error("DOCX render error", e);
      }
    })();

    return () => {
      cancelled = true;
      if (container) container.innerHTML = "";
    };
  }, [file.path, file.binaryBytes]);

  return (
    <div
      className="flex flex-col h-full"
      onContextMenu={(e) => {
        const sel = window.getSelection()?.toString().trim();
        if (sel) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, text: sel }); }
      }}
    >
      <div
        className="flex-1 min-h-0 overflow-auto"
        style={{ background: "var(--md-code-bg)" }}
      >
        {status === "loading" && (
          <div className="empty-state">
            <div className="hint">{t("app.docxLoading")}</div>
          </div>
        )}
        {status === "error" && (
          <div className="empty-state">
            <div className="title" style={{ color: "#ef4444" }}>
              {t("app.docxError")}
            </div>
            <div className="hint">{error}</div>
          </div>
        )}
        <div
          ref={containerRef}
          className="docx-preview-container"
        />
      </div>

      {ctxMenu && (
        <div
          style={{
            position: "fixed", left: ctxMenu.x, top: ctxMenu.y, zIndex: 200,
            background: "var(--md-bg)", border: "1px solid var(--md-border)",
            borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: 4,
          }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          <button
            onClick={() => { triggerAIPanel(ctxMenu.text); setCtxMenu(null); }}
            style={{
              display: "block", width: "100%", padding: "6px 14px",
              border: "none", background: "none", color: "var(--md-fg)",
              fontSize: 13, cursor: "pointer", textAlign: "left", borderRadius: 4, whiteSpace: "nowrap",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--md-code-bg)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            ✨ {lang === "zh" ? "AI 对话" : "Ask AI"}
          </button>
        </div>
      )}
    </div>
  );
}
