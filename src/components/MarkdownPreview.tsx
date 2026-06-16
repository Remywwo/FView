import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { MarkdownView } from "@/components/MarkdownView";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { languages } from "@codemirror/language-data";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { EditorView, keymap } from "@codemirror/view";
import { searchKeymap } from "@codemirror/search";
import type { LoadedFile } from "@/hooks/useFileLoader";
import { useFileLoader } from "@/hooks/useFileLoader";
import { useSettings, getFontStack } from "@/hooks/useSettings";
import { useI18n } from "@/hooks/useI18n";
import { useScrollSync } from "@/hooks/useScrollSync";
import { extractHeadings } from "@/utils/extractHeadings";
import { TocSidebar } from "@/components/TocSidebar";

interface Props {
  file: LoadedFile;
  setContent: (s: string) => void;
  isDark: boolean;
}

type Mode = "split" | "editor" | "preview";

export function MarkdownPreview({ file, setContent, isDark }: Props) {
  const { save, saveAs } = useFileLoader();
  const { settings } = useSettings();
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>("split");

  const proseStyle: CSSProperties = {
    fontFamily: getFontStack(settings.fontFamily),
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
  };

  const editorFontStack = getFontStack(settings.fontFamily);

  const editorStyle = {
    "--cm-font-family": editorFontStack,
    "--cm-font-size": `${settings.fontSize}px`,
    "--cm-line-height": String(settings.lineHeight),
  } as CSSProperties;

  const editorExtensions = useMemo(
    () => [
      markdown({ base: markdownLanguage, codeLanguages: languages }),
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

  const headings = useMemo(() => extractHeadings(file.content), [file.content]);

  const cmRef = useRef<ReactCodeMirrorRef | null>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [previewScrollEl, setPreviewScrollEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (cmRef.current?.view) setEditorView(cmRef.current.view);
    });
    return () => cancelAnimationFrame(id);
  }, [file.path]);

  useScrollSync(editorView, previewScrollEl, mode === "split");

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
        ref={cmRef}
        value={file.content}
        onChange={setContent}
        theme={isDark ? "dark" : "light"}
        extensions={editorExtensions}
        basicSetup={{
          lineNumbers: true,
          foldGutter: false,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
          indentOnInput: true,
        }}
        placeholder="Start writing markdown..."
        style={{ height: "100%", ...editorStyle }}
      />
    </div>
  );

  const preview = (
    <div className="relative h-full">
      <div
        ref={setPreviewScrollEl}
        className="h-full overflow-auto preview-scroll"
      >
        <div className="mx-auto px-12 py-10 prose dark:prose-invert" style={proseStyle}>
          <MarkdownView content={file.content} fileDir={file.path.replace(/[\\/][^\\/]*$/, "")} />
        </div>
      </div>
      <TocSidebar headings={headings} />
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="toolbar">
        <button onClick={() => setMode("split")} disabled={mode === "split"}>{t("md.split")}</button>
        <button onClick={() => setMode("editor")} disabled={mode === "editor"}>{t("md.edit")}</button>
        <button onClick={() => setMode("preview")} disabled={mode === "preview"}>{t("md.preview")}</button>
        <div className="spacer" />
        <span className="file-info">{t("md.modeHint")}</span>
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
