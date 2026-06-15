import { useEffect, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { html } from "@codemirror/lang-html";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { invoke } from "@tauri-apps/api/core";
import type { LoadedFile } from "@/hooks/useFileLoader";

interface Props {
  file: LoadedFile;
  setContent: (s: string) => void;
  isDark: boolean;
}

type Mode = "split" | "editor" | "preview";

export function HtmlPreview({ file, setContent, isDark }: Props) {
  const [mode, setMode] = useState<Mode>("split");
  const [port, setPort] = useState<number | null>(null);
  const [iframeKey, setIframeKey] = useState(0);
  const [serverError, setServerError] = useState<string | null>(null);
  const fileRef = useRef(file);
  fileRef.current = file;
  const latestContentRef = useRef(file.content);
  latestContentRef.current = file.content;

  // Start server when file changes
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setServerError(null);
        const p = await invoke<number>("start_html_server", {
          htmlPath: fileRef.current.path,
          initialContent: latestContentRef.current,
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
  }, [file.path]);

  // Push content to server on edit (debounced) and reload iframe
  useEffect(() => {
    if (port === null) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        await invoke("update_html_preview_content", {
          content: latestContentRef.current,
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
  }, [file.content, port]);

  // Stop server on unmount
  useEffect(() => {
    return () => {
      invoke("stop_html_server").catch(() => {});
    };
  }, []);

  const editor = (
    <CodeMirror
      value={file.content}
      onChange={setContent}
      theme={isDark ? "dark" : "light"}
      extensions={[html()]}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
      }}
      style={{ height: "100%" }}
    />
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
    <div className="flex flex-col h-full">
      <div className="toolbar">
        <span className="file-info">{file.name}</span>
        <span className="divider" />
        <button onClick={() => setMode("split")} disabled={mode === "split"}>
          Split
        </button>
        <button onClick={() => setMode("editor")} disabled={mode === "editor"}>
          Edit
        </button>
        <button onClick={() => setMode("preview")} disabled={mode === "preview"}>
          Preview
        </button>
        <span className="divider" />
        <button
          onClick={() => setIframeKey((k) => k + 1)}
          disabled={port === null}
          title="Reload preview"
        >
          Reload
        </button>
        <div className="spacer" />
        {port !== null && (
          <span className="file-info">127.0.0.1:{port}</span>
        )}
      </div>
      <div className="flex-1 min-h-0">
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
    </div>
  );
}
