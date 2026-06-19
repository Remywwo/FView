import { useMemo, useRef, type CSSProperties } from "react";
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
  /**
   * Optional callback invoked whenever the editor selection changes.
   * Receives the selected text, or an empty string when the selection
   * is collapsed. Used by the plugin system to expose selection state.
   */
  onSelectionChange?: (text: string) => void;
}

function languageExtension(lang: string | undefined): Extension[] {
  if (!lang) return [];
  switch (lang) {
    case "javascript":
    case "typescript":
      return [javascript({ jsx: lang === "javascript", typescript: lang === "typescript" })];
    case "python":
      return [python()];
    case "rust":
      return [rust()];
    case "json":
      return [json()];
    case "css":
    case "scss":
    case "sass":
    case "less":
      return [css()];
    case "html":
    case "vue":
    case "svelte":
      return [html()];
    case "xml":
    case "svg":
      return [xml()];
    default:
      return [];
  }
}

export function CodePreview({ file, setContent, isDark, readOnly = false, onSelectionChange }: Props) {
  const { settings } = useSettings();
  const { t } = useI18n();

  // Hold the latest onSelectionChange so the EditorView update listener
  // (registered once via the extensions array) always calls the freshest
  // callback without re-binding on every render.
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

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
      // Report selection state to the host (PR3a).
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

  return (
    <div className="flex flex-col h-full">
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
        />
      </div>
    </div>
  );
}
