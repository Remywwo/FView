import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { LoadedFile } from "@/hooks/useFileLoader";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export function PdfPreview({ file }: { file: LoadedFile }) {
  const [pages, setPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.4);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const docRef = useRef<pdfjs.PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        if (!file.binaryBytes) {
          setError("No PDF data available");
          setLoading(false);
          return;
        }
        const loadingTask = pdfjs.getDocument({ data: file.binaryBytes.slice() });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        docRef.current = doc;
        setPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);
      } catch (e: any) {
        console.error(e);
        setError(e?.message || String(e));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [file.path, file.binaryBytes]);

  useEffect(() => {
    if (!docRef.current || !canvasRef.current) return;
    let cancelled = false;
    let renderTask: pdfjs.RenderTask | null = null;
    (async () => {
      try {
        const page = await docRef.current!.getPage(currentPage);
        if (cancelled) return;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current!;
        const ctx = canvas.getContext("2d")!;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        renderTask = page.render({ canvasContext: ctx, viewport });
        await renderTask.promise;
      } catch (e: any) {
        if (e?.name !== "RenderingCancelledException") {
          console.error("PDF render error", e);
        }
      }
    })();
    return () => {
      cancelled = true;
      if (renderTask) {
        try { renderTask.cancel(); } catch {}
      }
    };
  }, [currentPage, scale, pages]);

  return (
    <div className="flex flex-col h-full">
      <div className="toolbar">
        <span className="file-info">{file.name}</span>
        <span className="divider" />
        <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>‹ Prev</button>
        <span className="file-info">{pages > 0 ? `${currentPage} / ${pages}` : "—"}</span>
        <button onClick={() => setCurrentPage((p) => Math.min(pages, p + 1))} disabled={currentPage >= pages}>Next ›</button>
        <span className="divider" />
        <button onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))}>−</button>
        <span className="file-info">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(4, +(s + 0.2).toFixed(2)))}>+</button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto" style={{ background: "var(--md-code-bg)" }}>
        {loading && <div className="empty-state"><div>Loading PDF…</div></div>}
        {error && <div className="empty-state"><div className="title" style={{ color: "#ef4444" }}>PDF error</div><div className="hint">{error}</div></div>}
        {!loading && !error && (
          <div className="flex justify-center py-6">
            <canvas ref={canvasRef} className="shadow-lg" style={{ background: "white" }} />
          </div>
        )}
      </div>
    </div>
  );
}
