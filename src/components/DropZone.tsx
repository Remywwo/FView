import { useState, useCallback } from "react";
import { getCurrentWebview } from "@tauri-apps/api/webview";

export function DropZone({ onFilePath }: { onFilePath: (path: string) => void }) {
  const [active, setActive] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes("Files")) setActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(false);
  }, []);

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActive(false);

    // First try Tauri webview drop (real file path)
    try {
      const webview = getCurrentWebview();
      await webview.onDragDropEvent((event) => {
        if (event.payload.type === "drop") {
          const paths = event.payload.paths;
          if (paths && paths.length > 0) {
            onFilePath(paths[0]);
          }
        }
      });
    } catch {
      // not in Tauri or no listener
    }

    // Fallback: HTML5 DataTransfer (web context)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const f = e.dataTransfer.files[0] as any;
      const path = f.path;
      if (path) onFilePath(path);
    }
  }, [onFilePath]);

  return (
    <div
      className={`drop-overlay ${active ? "active" : ""}`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="drop-overlay-content">
        Drop a file to preview
      </div>
    </div>
  );
}
