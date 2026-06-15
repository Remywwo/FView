import { useFileLoader } from "@/hooks/useFileLoader";
import { DropZone } from "@/components/DropZone";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { CodePreview } from "@/components/CodePreview";
import { HtmlPreview } from "@/components/HtmlPreview";
import { PdfPreview } from "@/components/PdfPreview";
import { ImagePreview } from "@/components/ImagePreview";
import { TextPreview } from "@/components/TextPreview";

export default function App() {
  const loader = useFileLoader();
  const { current, open, save, saveAs, close, setContent, loadFromPath, isDark, error } = loader;

  return (
    <div className="flex flex-col h-full">
      <div className="toolbar">
        <button onClick={open} title="Open file (⌘O)">Open</button>
        <button onClick={save} disabled={!current?.isEditable || !current?.dirty} title="Save (⌘S)">Save</button>
        <button onClick={saveAs} disabled={!current?.isEditable} title="Save As (⇧⌘S)">Save As</button>
        <button onClick={close} disabled={!current} title="Close (⌘W)">Close</button>
        <span className="divider" />
        {current && <span className="file-info">{current.path || current.name}</span>}
        {current?.dirty && <span className="dirty-dot" title="Unsaved changes">●</span>}
        <div className="spacer" />
        <button onClick={loader.toggleTheme} title="Toggle theme (⌘.)">
          {isDark ? "☀ Light" : "☾ Dark"}
        </button>
      </div>

      <div className="flex-1 min-h-0 relative">
        {!current && <EmptyState onOpen={open} />}
        {error && !current && (
          <div className="empty-state">
            <div className="title" style={{ color: "#ef4444" }}>Error</div>
            <div className="hint">{error}</div>
          </div>
        )}

        {current && current.kind === "markdown" && (
          <MarkdownPreview file={current} setContent={setContent} isDark={isDark} />
        )}
        {current && current.kind === "html" && (
          <HtmlPreview file={current} setContent={setContent} isDark={isDark} />
        )}
        {current && (current.kind === "code" || (current.kind === "text" && current.isEditable)) && (
          <CodePreview file={current} setContent={setContent} isDark={isDark} />
        )}
        {current && current.kind === "text" && !current.isEditable && (
          <TextPreview file={current} />
        )}
        {current && current.kind === "pdf" && (
          <PdfPreview file={current} />
        )}
        {current && current.kind === "image" && (
          <ImagePreview file={current} />
        )}
        {current && current.kind === "unknown" && (
          <UnknownState name={current.name} />
        )}

        <DropZone onFilePath={loadFromPath} />
      </div>
    </div>
  );
}

function EmptyState({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="empty-state">
      <div className="title">FView</div>
      <div className="hint">A minimal file preview & editor</div>
      <div className="hint" style={{ marginTop: "1rem" }}>
        Drop a file anywhere, press <kbd>⌘O</kbd>, or <button onClick={onOpen} className="text-blue-500 hover:underline" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--md-link)", padding: 0 }}>browse</button>
      </div>
      <div className="hint" style={{ marginTop: "2rem", fontSize: "0.8rem", opacity: 0.7 }}>
        Supports Markdown · PDF · TXT · HTML · Code · Images
      </div>
    </div>
  );
}

function UnknownState({ name }: { name: string }) {
  return (
    <div className="empty-state">
      <div className="title">Unsupported file</div>
      <div className="hint">{name}</div>
    </div>
  );
}
