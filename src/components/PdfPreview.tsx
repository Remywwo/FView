import { useEffect, useRef, useState } from "react";

import * as pdfjs from "pdfjs-dist";
import { TextLayer } from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";
import type { LoadedFile } from "@/hooks/useFileLoader";
import { buildOutlineTree, type PdfOutlineNode } from "@/components/PdfOutlineDrawer";
import { useI18n } from "@/hooks/useI18n";
import {
  setPdfPageText,
  setPdfOutline,
  setPdfTotalPages,
  setCurrentPdfPage,
  clearPdfContext,
} from "@/plugins/extensions/ai-assistant/pdfContext";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export function PdfPreview({ file, onOutlineReady, jumpRef }: { file: LoadedFile; onOutlineReady?: (outline: PdfOutlineNode[] | null) => void; jumpRef?: React.MutableRefObject<((page: number) => void) | null> }) {
  const { t } = useI18n();

  // Tell the AI panel (rendered in a portal) to sit higher above the floating toolbar
  useEffect(() => {
    document.documentElement.style.setProperty("--ai-panel-bottom", "80px");
    return () => { document.documentElement.style.removeProperty("--ai-panel-bottom"); };
  }, []);
  const [pages, setPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Expose page-jump for sidebar outline
  useEffect(() => {
    if (jumpRef) jumpRef.current = setCurrentPage;
    return () => { if (jumpRef) jumpRef.current = null; };
  }, [jumpRef, setCurrentPage]);
  const [scale, setScale] = useState(1.4);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [jumpInput, setJumpInput] = useState("");
  const [outline, setOutline] = useState<PdfOutlineNode[] | null>(null);
  const [outlineLoading, setOutlineLoading] = useState(true);
  const [pageText, setPageText] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const canvasWrapRef = useRef<HTMLDivElement | null>(null);
  const textLayerRef = useRef<HTMLDivElement | null>(null);
  const canvasScrollRef = useRef<HTMLDivElement | null>(null);
  const hoveredAreaRef = useRef<"canvas" | null>(null);
  const jumpInputRef = useRef<HTMLInputElement | null>(null);
  const docRef = useRef<pdfjs.PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setOutline(null);
    setOutlineLoading(true);
    (async () => {
      try {
        if (!file.binaryBytes) {
          setError("No PDF data available");
          setLoading(false);
          setOutlineLoading(false);
          return;
        }
        const loadingTask = pdfjs.getDocument({ data: file.binaryBytes.slice() });
        const doc = await loadingTask.promise;
        if (cancelled) return;
        docRef.current = doc;
        setPages(doc.numPages);
          setPdfTotalPages(doc.numPages);
        setCurrentPage(1);
        setLoading(false);

        try {
          const raw = await doc.getOutline();
          if (cancelled) return;
          const tree = await buildOutlineTree(raw ?? null, doc);
          if (cancelled) return;
          setOutline(tree);
          setPdfOutline(tree);
          onOutlineReady?.(tree);
        } catch (e) {
          console.warn("Failed to load PDF outline", e);
        } finally {
          if (!cancelled) setOutlineLoading(false);
        }
      } catch (e: any) {
        console.error(e);
        setError(e?.message || String(e));
        setLoading(false);
        setOutlineLoading(false);
      }
    })();
    return () => { cancelled = true; clearPdfContext(); };
  }, [file.path, file.binaryBytes]);

  useEffect(() => {
    if (!canvasRef.current) return;
    let cancelled = false;
    let renderTask: pdfjs.RenderTask | null = null;
    let textLayer: TextLayer | null = null;
    const doc = docRef.current; // capture into local — never cross-doc via ref
    if (!doc || currentPage < 1 || currentPage > pages) return;
    (async () => {
      try {
        const page = await doc.getPage(currentPage);
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

        // Render text layer for selection
        if (textLayerRef.current && !cancelled) {
          const container = textLayerRef.current;
          container.innerHTML = "";
          // Sync scale-factor so text layer's CSS transforms align with the canvas.
          // setLayerDimensions uses --scale-factor to compute container size, and
          // each span uses it as transform: scale(). We must use the user-scale
          // only — canvas physical pixels are scaled by the same factor via its
          // own CSS width/height.
          if (canvasWrapRef.current) {
            canvasWrapRef.current.style.setProperty("--scale-factor", String(scale));
            canvasWrapRef.current.style.setProperty("--scale-round-x", "1px");
            canvasWrapRef.current.style.setProperty("--scale-round-y", "1px");
          }
          const textContent = await page.streamTextContent();
          if (cancelled) return;
          textLayer = new TextLayer({
            textContentSource: textContent,
            container,
            viewport,
          });
          await textLayer.render();
        }
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
      if (textLayer) {
        try { textLayer.cancel(); } catch {}
      }
    };
  }, [currentPage, scale, pages]);

  // Extract current page text for the AI mini chat.
  useEffect(() => {
    let cancelled = false;
    const doc = docRef.current;
    if (!doc || currentPage < 1 || currentPage > pages) return;
    (async () => {
      try {
        const page = await doc.getPage(currentPage);
        if (cancelled) return;
        const tc = await page.getTextContent();
        const text = tc.items.map((it: unknown) => (it as { str?: string }).str ?? "").join(" ");
        if (!cancelled) {
          setPageText(text);
          setPdfPageText(currentPage, text);
        }
      } catch { /* text extraction is best-effort */ }
    })();
    return () => { cancelled = true; };
  }, [currentPage, pages]);

  // Notify the PDF context cache of current page changes.
  useEffect(() => { setCurrentPdfPage(currentPage); }, [currentPage]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      if (pages <= 0) return;

      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === "g") {
        e.preventDefault();
        jumpInputRef.current?.focus();
        jumpInputRef.current?.select();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        const dir = e.key === "ArrowDown" ? 1 : -1;
        const targetEl = canvasScrollRef.current;
        if (targetEl) {
          const step = e.shiftKey ? targetEl.clientHeight - 40 : 60;
          targetEl.scrollTop += dir * step;
        }
        return;
      }

      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setCurrentPage((p) => Math.max(1, p - 1));
      } else if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setCurrentPage((p) => Math.min(pages, p + 1));
      } else if (e.key === "Home") {
        e.preventDefault();
        setCurrentPage(1);
      } else if (e.key === "End") {
        e.preventDefault();
        setCurrentPage(pages);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [pages]);

  const commitJump = () => {
    const n = parseInt(jumpInput, 10);
    if (Number.isFinite(n) && n >= 1 && n <= pages) {
      setCurrentPage(n);
    }
  };

  const goPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goNext = () => setCurrentPage((p) => Math.min(pages, p + 1));

  return (
    <div className="h-full relative">
      <div className="h-full relative" style={{ background: "var(--md-code-bg)" }}>
        <div
          ref={canvasScrollRef}
          className="h-full overflow-auto" style={{ paddingBottom: 54, paddingTop: 30 }}
          onMouseEnter={() => { hoveredAreaRef.current = "canvas"; }}
          onMouseLeave={() => { if (hoveredAreaRef.current === "canvas") hoveredAreaRef.current = null; }}
        >
        {loading && <div className="empty-state"><div>{t("pdf.loading")}</div></div>}
        {error && <div className="empty-state"><div className="title" style={{ color: "#ef4444" }}>{t("pdf.error")}</div><div className="hint">{error}</div></div>}
          {!loading && !error && (
            <div className="flex justify-center py-6">
              <div ref={canvasWrapRef} style={{ position: "relative" }}>
                <canvas ref={canvasRef} className="shadow-lg" style={{ background: "white" }} />
                <div ref={textLayerRef} className="textLayer" style={{ position: "absolute", top: 0, left: 0 }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Floating toolbar at bottom — frosted glass pill */}
      <div className="pdf-toolbar">
        <button onClick={goPrev} disabled={currentPage <= 1} title={t("pdf.prevTitle")}>{t("pdf.prev")}</button>
        <span className="pdf-toolbar-page">{pages > 0 ? `${currentPage} / ${pages}` : t("pdf.gotoPlaceholder")}</span>
        <button onClick={goNext} disabled={currentPage >= pages} title={t("pdf.nextTitle")}>{t("pdf.next")}</button>
        <span className="pdf-toolbar-divider" />
        <span className="pdf-toolbar-label">{t("pdf.goTo")}</span>
        <input
          ref={jumpInputRef}
          type="number"
          className="pdf-toolbar-input"
          min={1}
          max={pages || 1}
          value={jumpInput}
          placeholder={t("pdf.gotoPlaceholder")}
          onChange={(e) => setJumpInput(e.target.value)}
          onBlur={commitJump}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitJump();
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setJumpInput("");
              e.currentTarget.blur();
            }
          }}
          disabled={pages <= 0}
          title={t("pdf.gotoTitle")}
          aria-label={t("pdf.gotoTitle")}
        />
        <span className="pdf-toolbar-divider" />
        <button onClick={() => setScale((s) => Math.max(0.5, +(s - 0.2).toFixed(2)))}>−</button>
        <span className="pdf-toolbar-page">{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((s) => Math.min(4, +(s + 0.2).toFixed(2)))}>+</button>
      </div>
    </div>
  );
}
