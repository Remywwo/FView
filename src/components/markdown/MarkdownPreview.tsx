import { useCallback, useEffect, useRef, useState } from "react";
import type { EditorView } from "@milkdown/kit/prose/view";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import { triggerAIPanel } from "@/plugins/extensions/ai-assistant";
import type { LoadedFile } from "@/hooks/useFileLoader";
import { useSettings, getFontStack } from "@/hooks/useSettings";
import { useI18n } from "@/hooks/useI18n";
import { useTheme } from "@/hooks/useTheme";
import { useRegisterCommand } from "@/hooks/useCommands";
import { MarkdownEditor } from "./editor/MarkdownEditor";
import { SearchBar } from "./editor/SearchBar";
import { useSearch } from "./editor/useSearch";
import { WysiwygToc } from "@/components/WysiwygToc";
import { applyGithubTheme } from "./themes/loadTheme";
import frameDark from "@milkdown/crepe/theme/frame-dark.css?url";

interface Props {
  file: LoadedFile;
  setContent: (s: string) => void;
  onSelectionChange?: (text: string) => void;
}

export function MarkdownPreview({ file, setContent }: Props) {
  const { settings } = useSettings();
  const { lang } = useI18n();
  const { isDark } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tocContainer, setTocContainer] = useState<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  // Incremented when view is ready to trigger search hook re-render.
  const [, setViewReady] = useState(0);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; text: string } | null>(null);

  const search = useSearch(viewRef);
  const onViewReady = useCallback(() => setViewReady((n) => n + 1), []);

  // Cmd+F → toggle search bar
  const toggleSearch = useCallback(() => search.toggle(), [search]);
  useRegisterCommand({ id: "md.find", label: "Find", shortcut: "Mod+F", capture: true, run: toggleSearch });

  // Close context menu
  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  useEffect(() => { applyGithubTheme(isDark); }, [isDark]);

  // Inject Milkdown dark theme CSS when dark mode is active.
  // The light theme is statically imported in MarkdownEditor.tsx as the base.
  useEffect(() => {
    const id = "md-crepe-dark";
    if (isDark) {
      if (!document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = frameDark;
        document.head.appendChild(link);
      }
    } else {
      document.getElementById(id)?.remove();
    }
  }, [isDark]);

  // Inject font settings.
  useEffect(() => {
    const id = "md-font-style";
    document.getElementById(id)?.remove();
    const fontFamily = getFontStack(settings.fontFamily) || settings.fontFamily;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .milkdown { font-size:${settings.fontSize}px; line-height:${settings.lineHeight}; }
      .milkdown .ProseMirror { font-family:${fontFamily}; padding-left:230px; padding-right:230px; }
      .milkdown .ProseMirror p { font-size:${settings.fontSize}px; line-height:${settings.lineHeight}; }
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
      if (!a) return;
      const href = a.getAttribute("href") || "";
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
        const proseMirror = (e.currentTarget as HTMLElement).querySelector(".ProseMirror") as HTMLElement | null;
        if (!proseMirror) return;
        const text = window.getSelection()?.toString().trim() ?? "";
        if (text) { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY, text }); }
      }}
    >
      {/* Search bar */}
      {search.open && (
        <SearchBar
          term={search.term}
          onTermChange={search.setTerm}
          total={search.total}
          activeIdx={search.activeIdx}
          onNext={search.next}
          onPrev={search.prev}
          onClose={search.close}
        />
      )}

      {/* Editor */}
      <div
        ref={(el) => { (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el; setTocContainer(el); }}
        style={{ flex: 1, position: "relative", minHeight: 0 }}
      >
        <MarkdownEditor
          content={file.content}
          onContentChange={setContent}
          viewRef={viewRef}
          onViewReady={onViewReady}
        />
        <WysiwygToc container={tocContainer} />
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
