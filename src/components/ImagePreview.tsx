import { useEffect, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type { LoadedFile } from "@/hooks/useFileLoader";
import { useI18n } from "@/hooks/useI18n";
import { mimeForImage } from "@/utils/fileDetector";

export function ImagePreview({ file }: { file: LoadedFile }) {
  const { t } = useI18n();
  const [scale, setScale] = useState(1);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!file.binaryBytes) {
          setError("No image data");
          return;
        }
        // Build a blob URL for portability
        const mime = mimeForImage(file.extension);
        const blob = new Blob([file.binaryBytes as BlobPart], { type: mime });
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setSrc(url);
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [file.path, file.binaryBytes]);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  return (
    <div className="flex flex-col h-full">
      <div className="toolbar">
        <button onClick={() => setScale((s) => Math.max(0.1, +(s - 0.1).toFixed(2)))}>−</button>
        <span className="file-info">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(5, +(s + 0.1).toFixed(2)))}>+</button>
        <button onClick={() => setScale(1)}>{t("image.reset")}</button>
        <button onClick={() => setScale((s) => Math.min(5, +(s + 0.2).toFixed(2)))}>{t("image.fit")}</button>
        <div className="spacer" />
        <span className="file-info">{t("image.readOnly")}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto" style={{ background: "var(--md-code-bg)" }}>
        {error && <div className="empty-state"><div className="title" style={{ color: "#ef4444" }}>{t("image.error")}</div><div className="hint">{error}</div></div>}
        {src && (
          <div className="flex justify-center items-center min-h-full p-6">
            <img
              src={src}
              alt={file.name}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                transform: `scale(${scale})`,
                transformOrigin: "center center",
                transition: "transform 0.1s",
              }}
              draggable={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
