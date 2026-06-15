import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeRaw from "rehype-raw";
import CodeMirror from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import type { LoadedFile } from "@/hooks/useFileLoader";
import { useFileLoader } from "@/hooks/useFileLoader";

interface Props {
  file: LoadedFile;
  setContent: (s: string) => void;
  isDark: boolean;
}

type Mode = "split" | "editor" | "preview";

export function MarkdownPreview({ file, setContent, isDark }: Props) {
  const { save, saveAs } = useFileLoader();
  const [mode, setMode] = useState<Mode>("split");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "p" && !e.shiftKey) {
        e.preventDefault();
        setMode((m) => (m === "split" ? "preview" : m === "preview" ? "editor" : "split"));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const editor = (
    <div className="h-full overflow-hidden">
      <CodeMirror
        value={file.content}
        onChange={setContent}
        theme={isDark ? "dark" : "light"}
        extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
        basicSetup={{
          lineNumbers: false,
          foldGutter: false,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          indentOnInput: true,
        }}
        placeholder="Start writing markdown..."
        style={{ height: "100%" }}
      />
    </div>
  );

  const preview = (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-[860px] px-12 py-10 md-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeHighlight]}
          components={{
            a({ node: _node, ...props }) {
              return <a {...props} target="_blank" rel="noreferrer" />;
            },
          }}
        >
          {file.content}
        </ReactMarkdown>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="toolbar">
        <span className="file-info">{file.name}</span>
        <span className="divider" />
        <button onClick={() => setMode("split")} disabled={mode === "split"}>Split</button>
        <button onClick={() => setMode("editor")} disabled={mode === "editor"}>Edit</button>
        <button onClick={() => setMode("preview")} disabled={mode === "preview"}>Preview</button>
        <div className="spacer" />
        <span className="file-info">⌘P toggle</span>
      </div>
      <div className="flex-1 min-h-0">
        {mode === "editor" && editor}
        {mode === "preview" && preview}
        {mode === "split" && (
          <PanelGroup direction="horizontal" autoSaveId="md-split">
            <Panel defaultSize={50} minSize={20}>
              {editor}
            </Panel>
            <PanelResizeHandle />
            <Panel defaultSize={50} minSize={20}>
              {preview}
            </Panel>
          </PanelGroup>
        )}
      </div>
    </div>
  );
}
