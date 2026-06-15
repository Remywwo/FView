import CodeMirror from "@uiw/react-codemirror";
import type { Extension } from "@codemirror/state";
import type { LoadedFile } from "@/hooks/useFileLoader";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";
import { css } from "@codemirror/lang-css";
import { html } from "@codemirror/lang-html";
import { xml } from "@codemirror/lang-xml";

interface Props {
  file: LoadedFile;
  setContent: (s: string) => void;
  isDark: boolean;
  readOnly?: boolean;
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

export function CodePreview({ file, setContent, isDark, readOnly = false }: Props) {
  return (
    <div className="flex flex-col h-full">
      <div className="toolbar">
        <span className="file-info">{file.name}</span>
        {file.language && (
          <>
            <span className="divider" />
            <span className="file-info">{file.language}</span>
          </>
        )}
        {readOnly && (
          <>
            <span className="divider" />
            <span className="file-info" style={{ color: "var(--md-muted)" }}>read-only</span>
          </>
        )}
      </div>
      <div className="flex-1 min-h-0">
        <CodeMirror
          value={file.content}
          onChange={readOnly ? undefined : setContent}
          theme={isDark ? "dark" : "light"}
          extensions={languageExtension(file.language)}
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
          style={{ height: "100%" }}
        />
      </div>
    </div>
  );
}
