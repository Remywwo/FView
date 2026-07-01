import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { searchKeymap } from "@codemirror/search";
import type { Extension } from "@codemirror/state";
import type { LoadedFile } from "@/hooks/useFileLoader";
import { useSettings } from "@/hooks/useSettings";
import { useI18n } from "@/hooks/useI18n";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { xml } from "@codemirror/lang-xml";

const CODE_FONT_FAMILY = '"JetBrains Mono", "SF Mono", Menlo, Monaco, Consolas, monospace';

interface Props {
  file: LoadedFile;
  setContent: (s: string) => void;
  isDark: boolean;
  readOnly?: boolean;
  onSelectionChange?: (text: string) => void;
}

function languageExtension(lang: string | undefined): Extension[] {
  if (!lang) return [];
  switch (lang) {
    case "javascript":
    case "typescript":
      return [javascript({ jsx: lang === "javascript", typescript: lang === "typescript" })];
    case "python": return [python()];
    case "rust": return [rust()];
    case "json": return [json()];
    case "css": case "scss": case "sass": case "less": return [css()];
    case "html": case "vue": case "svelte": return [html()];
    case "xml": case "svg": return [xml()];
    default: return [];
  }
}

export function CodePreview({ file, setContent, isDark, readOnly = false, onSelectionChange }: Props) {
  const { settings } = useSettings();
  const { t } = useI18n();

  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  // Hold a ref to the EditorView so context-menu actions can reach it.
  const viewRef = useRef<EditorView | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!ctxMenu) return;
    const close = () => setCtxMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [ctxMenu]);

  const extensions = useMemo<Extension[]>(
    () => [
      ...languageExtension(file.language),
      EditorView.lineWrapping,
      keymap.of(searchKeymap),
      EditorView.theme({
        ".cm-content": { lineHeight: "var(--cm-line-height)" },
        ".cm-line": { lineHeight: "inherit" },
        ".cm-gutters": { lineHeight: "inherit" },
      }),
      EditorView.updateListener.of((viewUpdate) => {
        if (!viewUpdate.selectionSet) return;
        const cb = onSelectionChangeRef.current;
        if (!cb) return;
        const sel = viewUpdate.state.selection.main;
        const text = sel.empty ? "" : viewUpdate.state.sliceDoc(sel.from, sel.to);
        cb(text);
      }),
    ],
    [file.language, settings.lineHeight],
  );

  const editorStyle = {
    "--cm-font-family": CODE_FONT_FAMILY,
    "--cm-font-size": `${settings.fontSize}px`,
    "--cm-line-height": String(settings.lineHeight),
  } as CSSProperties;

  // ── context menu actions ──────────────────────────────────────
  const handleFormat = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    try {
      // Attempt per-language formatting via CodeMirror's built-in indent.
      const doc = view.state.doc;
      const text = doc.toString();
      // Re-indent: handles braces/brackets + HTML tags for mixed content.
      const VOID = new Set(["area","base","br","col","embed","hr","img","input","link","meta","param","source","track","wbr"]);
      const lines = text.split("\n");
      let depth = 0;
      const formatted = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed) return "";
        // Closing tag → outdent
        const closeTag = trimmed.match(/^<\/\s*(\w+)[^>]*>/);
        if (closeTag) depth = Math.max(0, depth - 1);
        if (/^[\}\)\]]/.test(trimmed)) depth = Math.max(0, depth - 1);
        const indented = "  ".repeat(depth) + trimmed;
        // Opening tags (not self-closing, not void)
        const openTags = [...trimmed.matchAll(/<(\w+)(?:\s[^>]*)?>/g)]
          .filter((m) => !trimmed.includes(`</${m[1]}>`) && !VOID.has(m[1].toLowerCase()));
        const closeTags = [...trimmed.matchAll(/<\/\s*\w+[^>]*>/g)];
        const bracketOpens = (trimmed.match(/[\{\(\[]/g) || []).length;
        const bracketCloses = (trimmed.match(/[\}\)\]]/g) || []).length;
        depth = Math.max(0, depth + openTags.length - closeTags.length + bracketOpens - bracketCloses);
        return indented;
      });
      view.dispatch({ changes: { from: 0, to: doc.length, insert: formatted.join("\n") } });
      setCtxMenu(null);
    } catch {
      // silently ignore format failures
    }
  }, []);

  const handleCopy = useCallback(async () => {
    const view = viewRef.current;
    if (!view) return;
    const sel = view.state.selection.main;
    const text = sel.empty ? view.state.doc.toString() : view.state.sliceDoc(sel.from, sel.to);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback silently
    }
    setCtxMenu(null);
  }, []);

  const handleCut = useCallback(async () => {
    const view = viewRef.current;
    if (!view || readOnly) return;
    const sel = view.state.selection.main;
    if (sel.empty) return;
    const text = view.state.sliceDoc(sel.from, sel.to);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // fallback
    }
    view.dispatch({ changes: { from: sel.from, to: sel.to } });
    setCtxMenu(null);
  }, [readOnly]);

  const handlePaste = useCallback(async () => {
    const view = viewRef.current;
    if (!view || readOnly) return;
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const sel = view.state.selection.main;
        view.dispatch({ changes: { from: sel.from, to: sel.to, insert: text } });
      }
    } catch {
      // clipboard read denied
    }
    setCtxMenu(null);
  }, [readOnly]);

  return (
    <div
      className="flex flex-col h-full"
      data-cm-code-preview=""
      onContextMenu={(e) => {
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <div className="toolbar">
        {file.language && <span className="file-info">{file.language}</span>}
        {readOnly && (
          <>
            <span className="divider" />
            <span className="file-info" style={{ color: "var(--md-muted)" }}>{t("code.readOnly")}</span>
          </>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <CodeMirror
          value={file.content}
          onChange={readOnly ? undefined : setContent}
          theme={isDark ? "dark" : "light"}
          extensions={extensions}
          editable={!readOnly}
          readOnly={readOnly}
          basicSetup={{
            lineNumbers: true,
            foldGutter: true,
            highlightActiveLine: !readOnly,
            highlightSelectionMatches: !readOnly,
            indentOnInput: !readOnly,
            bracketMatching: true,
            closeBrackets: !readOnly,
            autocompletion: !readOnly,
          }}
          style={{ height: "100%", ...editorStyle }}
          onCreateEditor={(view) => { viewRef.current = view; }}
        />
      </div>

      {/* Context menu */}
      {ctxMenu && (
        <div
          className="context-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y, position: "fixed", zIndex: 200 }}
          onMouseLeave={() => setCtxMenu(null)}
        >
          <button className="context-menu-item" onClick={handleFormat}>
            {t("code.format")}
          </button>
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={handleCopy}>
            {t("code.copy")}
          </button>
          {!readOnly && (
            <>
              <button className="context-menu-item" onClick={handleCut}>
                {t("code.cut")}
              </button>
              <button className="context-menu-item" onClick={handlePaste}>
                {t("code.paste")}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
