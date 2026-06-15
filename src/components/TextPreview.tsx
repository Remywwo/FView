import type { LoadedFile } from "@/hooks/useFileLoader";

export function TextPreview({ file }: { file: LoadedFile }) {
  const lines = file.content.split(/\r?\n/);
  return (
    <div className="flex flex-col h-full">
      <div className="toolbar">
        <span className="file-info">{file.name}</span>
        <span className="divider" />
        <span className="file-info">{file.content.length.toLocaleString()} chars · {lines.length.toLocaleString()} lines</span>
        <div className="spacer" />
        <span className="file-info">read-only</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto" style={{ background: "var(--md-bg)" }}>
        <pre className="md-content m-0 px-6 py-4" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "JetBrains Mono, SF Mono, Menlo, Monaco, Consolas, monospace", fontSize: "13px", lineHeight: 1.6 }}>
          {file.content}
        </pre>
      </div>
    </div>
  );
}
