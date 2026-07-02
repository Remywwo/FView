import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { EditorView, keymap } from "@codemirror/view";
import { searchKeymap } from "@codemirror/search";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { invoke } from "@tauri-apps/api/core";
import type { LoadedFile } from "@/hooks/useFileLoader";
import { useSettings } from "@/hooks/useSettings";
import { useI18n } from "@/hooks/useI18n";
import { isTauriRuntime } from "@/utils/platform";

const CODE_FONT_FAMILY = '"JetBrains Mono", "SF Mono", Menlo, Monaco, Consolas, monospace';
const PREVIEW_SELECTION_STYLE_ID = "fview-preview-selection-style";

interface Props {
  file: LoadedFile;
  setContent: (s: string) => void;
  isDark: boolean;
}

type Mode = "split" | "editor" | "preview";

function withPreviewSelectionStyle(content: string, highlightColor: string): string {
  const style = `<style id="${PREVIEW_SELECTION_STYLE_ID}">::selection{background:color-mix(in srgb, ${highlightColor} 46%, transparent);color:inherit}::-moz-selection{background:color-mix(in srgb, ${highlightColor} 46%, transparent);color:inherit}</style>`;
  const withoutPrevious = content.replace(
    new RegExp(`<style\\s+id=["']${PREVIEW_SELECTION_STYLE_ID}["'][\\s\\S]*?<\\/style>`, "i"),
    "",
  );
  if (/<\/head\s*>/i.test(withoutPrevious)) {
    return withoutPrevious.replace(/<\/head\s*>/i, `${style}</head>`);
  }
  return `${style}${withoutPrevious}`;
}

export function HtmlPreview({ file, setContent, isDark }: Props) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("split");
  const [port, setPort] = useState<number | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [editorCtxMenu, setEditorCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { settings } = useSettings();
  const fileRef = useRef(file);
  fileRef.current = file;
  const latestContentRef = useRef(file.content);
  latestContentRef.current = file.content;

  const extensions = useMemo(
    () => [
      html(),
      EditorView.lineWrapping,
      keymap.of(searchKeymap),
      EditorView.theme({
        ".cm-content": { lineHeight: "var(--cm-line-height)" },
        ".cm-line": { lineHeight: "inherit" },
        ".cm-gutters": { lineHeight: "inherit" },
      }),
    ],
    [settings.lineHeight],
  );

  const editorStyle = {
    "--cm-font-family": CODE_FONT_FAMILY,
    "--cm-font-size": `${settings.fontSize}px`,
    "--cm-line-height": String(settings.lineHeight),
  } as CSSProperties;

  // Start server when file changes
  useEffect(() => {
    if (!isTauriRuntime()) {
      setPort(null);
      setServerError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        setServerError(null);
        const p = await invoke<number>("start_html_server", {
          htmlPath: fileRef.current.path,
          initialContent: withPreviewSelectionStyle(
            latestContentRef.current,
            settings.highlightColor,
          ),
        });
        if (!cancelled) {
          setPort(p);
          setIframeKey((k) => k + 1);
        }
      } catch (e: any) {
        if (!cancelled) {
          setPort(null);
          setServerError(e?.message || String(e));
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file.path, settings.highlightColor]);

  // Close context menus on outside click
  useEffect(() => {
    if (!ctxMenu && !editorCtxMenu) return;
    const close = () => { setCtxMenu(null); setEditorCtxMenu(null); };
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu, editorCtxMenu]);

  const handleEditorFormat = () => {
    const view = viewRef.current;
    if (!view) return;
    const doc = view.state.doc;
    const text = doc.toString();
    // Void / self-closing elements that don't need a closing tag.
    const VOID = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
    const lines = text.split("\n");
    let depth = 0;
    const formatted = lines.map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return "";
      // Closing tag → outdent first
      const closeMatch = trimmed.match(/^<\/\s*(\w+)[^>]*>/);
      if (closeMatch) depth = Math.max(0, depth - 1);
      // Decrease for closing brackets too (JS/CSS inside <style>/<script>)
      if (/^[\}\)\]]/.test(trimmed)) depth = Math.max(0, depth - 1);
      const indented = "  ".repeat(depth) + trimmed;
      // Count opening tags (not self-closing, not void)
      const openTags = [...trimmed.matchAll(/<(\w+)(?:\s[^>]*)?>/g)]
        .filter((m) => !trimmed.includes(`</${m[1]}>`) && !VOID.has(m[1].toLowerCase()));
      // Count closing tags
      const closeTags = [...trimmed.matchAll(/<\/\s*\w+[^>]*>/g)];
      // Count opening brackets
      const bracketOpens = (trimmed.match(/[\{\(\[]/g) || []).length;
      const bracketCloses = (trimmed.match(/[\}\)\]]/g) || []).length;
      depth = Math.max(0, depth + openTags.length - closeTags.length + bracketOpens - bracketCloses);
      return indented;
    });
    view.dispatch({ changes: { from: 0, to: doc.length, insert: formatted.join("\n") } });
    setEditorCtxMenu(null);
  };

  const handleEditorCopy = async () => {
    const view = viewRef.current;
    if (!view) return;
    const sel = view.state.selection.main;
    const text = sel.empty ? view.state.doc.toString() : view.state.sliceDoc(sel.from, sel.to);
    try { await navigator.clipboard.writeText(text); } catch {}
    setEditorCtxMenu(null);
  };

  const handleEditorCut = async () => {
    const view = viewRef.current;
    if (!view) return;
    const sel = view.state.selection.main;
    if (sel.empty) return;
    const text = view.state.sliceDoc(sel.from, sel.to);
    try { await navigator.clipboard.writeText(text); } catch {}
    view.dispatch({ changes: { from: sel.from, to: sel.to } });
    setEditorCtxMenu(null);
  };

  const handleEditorPaste = async () => {
    const view = viewRef.current;
    if (!view) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const sel = view.state.selection.main;
        view.dispatch({ changes: { from: sel.from, to: sel.to, insert: text } });
      }
    } catch {}
    setEditorCtxMenu(null);
  };

  // Push content to server on edit (debounced) and reload iframe
  useEffect(() => {
    if (!isTauriRuntime()) return;
    if (port === null) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        await invoke("update_html_preview_content", {
          content: withPreviewSelectionStyle(
            latestContentRef.current,
            settings.highlightColor,
          ),
        });
        if (!cancelled) setIframeKey((k) => k + 1);
      } catch (e) {
        console.error("Failed to push content to HTML server", e);
      }
    }, 150);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [file.content, port, settings.highlightColor]);

  // Stop server on unmount
  useEffect(() => {
    if (!isTauriRuntime()) return;
    return () => {
      invoke("stop_html_server").catch(() => {});
    };
  }, []);

  const editor = (
    <div
      style={{ height: "100%" }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); setEditorCtxMenu({ x: e.clientX, y: e.clientY }); }}
    >
      <CodeMirror
        value={file.content}
        onChange={setContent}
        theme={isDark ? "dark" : "light"}
        extensions={extensions}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
        }}
        style={{ height: "100%", ...editorStyle }}
        onCreateEditor={(view) => { viewRef.current = view; }}
      />
    </div>
  );

  const previewSrc = port
    ? `http://127.0.0.1:${port}/${encodeURIComponent(file.name)}?v=${iframeKey}`
    : "about:blank";

  const previewPane = (
    <div className="relative w-full h-full">
      {serverError && (
        <div className="absolute inset-0 flex items-center justify-center text-red-500 text-sm">
          {serverError}
        </div>
      )}
      <iframe
        key={iframeKey}
        src={previewSrc}
        title="HTML preview"
        sandbox="allow-same-origin allow-scripts allow-forms"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          background: isDark ? "#1e1e1e" : "#ffffff",
        }}
      />
    </div>
  );

  return (
    <div
      className="html-preview-wrapper"
      onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ x: e.clientX, y: e.clientY }); }}
    >
      {/* Floating toolbar at bottom — frosted glass pill */}
      <div className="pdf-toolbar">
        <button onClick={() => setMode("split")} disabled={mode === "split"}>
          {t("html.split")}
        </button>
        <button onClick={() => setMode("editor")} disabled={mode === "editor"}>
          {t("html.edit")}
        </button>
        <button onClick={() => setMode("preview")} disabled={mode === "preview"}>
          {t("html.preview")}
        </button>
        <span className="pdf-toolbar-divider" />
        <button
          onClick={() => setIframeKey((k) => k + 1)}
          disabled={port === null}
          title={t("html.reloadTitle")}
        >
          {t("html.reload")}
        </button>
        {port !== null && (
          <>
            <span className="pdf-toolbar-divider" />
            <span className="pdf-toolbar-page">127.0.0.1:{port}</span>
          </>
        )}
      </div>
      <div className="html-preview-content">
        {mode === "split" && (
          <PanelGroup direction="horizontal" autoSaveId="html-split">
            <Panel defaultSize={50} minSize={20}>
              {editor}
            </Panel>
            <PanelResizeHandle />
            <Panel defaultSize={50} minSize={20}>
              {previewPane}
            </Panel>
          </PanelGroup>
        )}
        {mode === "editor" && editor}
        {mode === "preview" && previewPane}
      </div>

      {ctxMenu && (
        <div
          className="context-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y, position: "fixed", zIndex: 200 }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          <button className="context-menu-item" onClick={() => { navigator.clipboard.writeText(file.content).catch(() => {}); setCtxMenu(null); }}>
            {t("html.copySource")}
          </button>
          <button className="context-menu-item" onClick={() => { setIframeKey((k) => k + 1); setCtxMenu(null); }}>
            {t("html.reload")}
          </button>
        </div>
      )}
      {editorCtxMenu && (
        <div
          className="context-menu"
          style={{ left: editorCtxMenu.x, top: editorCtxMenu.y, position: "fixed", zIndex: 200 }}
          onMouseLeave={() => setEditorCtxMenu(null)}
        >
          <button className="context-menu-item" onClick={handleEditorFormat}>{t("code.format")}</button>
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={handleEditorCopy}>{t("code.copy")}</button>
          <button className="context-menu-item" onClick={handleEditorCut}>{t("code.cut")}</button>
          <button className="context-menu-item" onClick={handleEditorPaste}>{t("code.paste")}</button>
        </div>
      )}
    </div>
  );
}
