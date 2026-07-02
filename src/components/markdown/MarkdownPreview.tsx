import { useCallback, useEffect, useRef, useState } from "react";
import type { LexicalEditor } from "lexical";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import { triggerAIPanel } from "@/plugins/extensions/ai-assistant";
import type { LoadedFile } from "@/hooks/useFileLoader";
import { useSettings, getFontStack } from "@/hooks/useSettings";
import { useI18n } from "@/hooks/useI18n";
import { useTheme } from "@/hooks/useTheme";
import { MarkdownEditor } from "./editor/MarkdownEditor";
import { applyGithubTheme } from "./themes/loadTheme";

interface Props {
  file: LoadedFile;
  setContent: (s: string) => void;
  markDirty?: () => void;
  onSelectionChange?: (text: string) => void;
  onTocContainerReady?: (el: HTMLDivElement | null) => void;
}

export function MarkdownPreview({ file, setContent, markDirty, onTocContainerReady }: Props) {
  const { settings } = useSettings();
  const { lang } = useI18n();
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [tocContainer, setTocContainer] = useState<HTMLDivElement | null>(null);
  const editorRef = useRef<LexicalEditor | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; text: string } | null>(null);

  const onEditorReady = useCallback(() => {}, []);
  const setEditorContainerRef = useCallback((el: HTMLDivElement | null) => {
    containerRef.current = el;
    setTocContainer(el);
    onTocContainerReady?.(el);
  }, [onTocContainerReady]);

  // Close context menu
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  useEffect(() => { applyGithubTheme(isDark); }, [isDark]);

  // Inject font settings.
  useEffect(() => {
    const id = "md-font-style";
    document.getElementById(id)?.remove();
    const fontFamily = getFontStack(settings.fontFamily) || settings.fontFamily;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .lexical-editor { font-family:${fontFamily}; font-size:${settings.fontSize}px; line-height:${settings.lineHeight}; }
      .lexical-editor p { font-size:${settings.fontSize}px; line-height:${settings.lineHeight}; }
    `;
    document.head.appendChild(style);
    return () => { document.getElementById(id)?.remove(); };
  }, [settings.fontSize, settings.fontFamily, settings.lineHeight]);

  // Intercept external link clicks.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest<HTMLAnchorElement>(".milkdown a");
      const lexicalLink = (e.target as HTMLElement)?.closest<HTMLAnchorElement>(".lexical-editor a");
      const link = lexicalLink ?? a;
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (href.startsWith("http://") || href.startsWith("https://")) {
        e.preventDefault(); e.stopPropagation();
        void openExternal(href);
      }
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, []);

  return (
    <div
      style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column" }}
      onContextMenu={(e) => {
        const domSel = window.getSelection()?.toString().trim();
        if (domSel) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, text: domSel }); return; }
        const lexicalEditor = (e.currentTarget as HTMLElement).querySelector(".lexical-editor") as HTMLElement | null;
        if (!lexicalEditor) return;
        const text = window.getSelection()?.toString().trim() ?? "";
        if (text) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, text }); }
      }}
    >
      {/* Editor */}
      <div
        ref={setEditorContainerRef}
        style={{ flex: 1, position: "relative", minHeight: 0 }}
      >
        <MarkdownEditor
          content={file.content}
          onContentChange={setContent}
          onDirtyChange={markDirty}
          editorRef={editorRef}
          onEditorReady={onEditorReady}
        />
      </div>

      {/* AI context menu */}
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
