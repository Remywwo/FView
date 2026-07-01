import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { LoadedFile } from "@/hooks/useFileLoader";
import { useI18n } from "@/hooks/useI18n";
import { mimeForImage } from "@/utils/fileDetector";

const MAX_SCALE = 9.99;
const SCALE_STEP = 0.05;
const SVG_DEFAULT_SIZE = { w: 300, h: 150 };

/** Decode UTF-8 bytes into a string, stripping a leading BOM if present. */
function utf8Decode(bytes: Uint8Array): string {
  let text = new TextDecoder("utf-8").decode(bytes);
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return text;
}

/**
 * Pull the nominal size out of an SVG document by looking at its root
 * <svg> element's width/height attributes, falling back to viewBox.
 * Returns null when neither is usable; callers should fall back to a
 * sensible default in that case.
 */
function parseSvgNominalSize(text: string): { w: number; h: number } | null {
  if (typeof DOMParser === "undefined") return null;
  try {
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    const root = doc.documentElement;
    if (!root || root.nodeName.toLowerCase() !== "svg") return null;
    const w = parseFloat(root.getAttribute("width") ?? "");
    const h = parseFloat(root.getAttribute("height") ?? "");
    if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { w, h };
    const vb = root.getAttribute("viewBox");
    if (vb) {
      const parts = vb.trim().split(/[\s,]+/).map(parseFloat);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return { w: parts[2], h: parts[3] };
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function ImagePreview({ file }: { file: LoadedFile }) {
  const { t } = useI18n();
  const [scale, setScale] = useState(1);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [viewSize, setViewSize] = useState({ w: 0, h: 0 });
  const [inputVal, setInputVal] = useState("");
  const [inputFocus, setInputFocus] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ active: false, startX: 0, startY: 0, scrollX: 0, scrollY: 0 });
  const userAdjustedRef = useRef(false);

  const isSvg = file.extension.toLowerCase() === "svg";
  const svgWrapId = `svg-wrap-${useId()}`;

  // SVG path: decode the bytes once and extract nominal dimensions up
  // front. We inline the SVG into the DOM (dangerouslySetInnerHTML)
  // rather than handing it to an <img> tag because Tauri's WKWebView
  // backend cannot reliably decode image/svg+xml through either
  // blob: or data: URLs — the <img> fires onError and renders the
  // broken-image icon. Inline SVG avoids URL/mime negotiation entirely.
  const svgText = useMemo(() => {
    if (!isSvg || !file.binaryBytes) return null;
    try {
      return utf8Decode(file.binaryBytes as Uint8Array);
    } catch {
      return null;
    }
  }, [isSvg, file.binaryBytes]);

  const svgSize = useMemo(
    () => (svgText ? parseSvgNominalSize(svgText) : null),
    [svgText],
  );

  // Track preview area size via ResizeObserver
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setViewSize({ w: entry.contentRect.width, h: entry.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset on file change
  useEffect(() => {
    setNatural(null);
    setSrc(null);
    setError(null);
    prevFitRef.current = null;
    userAdjustedRef.current = false;
  }, [file.path]);

  // Generate blob URL for non-SVG images
  useEffect(() => {
    if (isSvg) return;
    if (!file.binaryBytes) {
      setError("No image data");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const mime = mimeForImage(file.extension);
        const blob = new Blob([file.binaryBytes as BlobPart], { type: mime });
        const url = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        setSrc(url);
        setError(null);
      } catch (e: any) {
        setError(e?.message || String(e));
      }
    })();
    return () => { cancelled = true; };
  }, [file.path, file.binaryBytes, isSvg]);

  // Cleanup blob URL on src change / unmount
  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  // For SVG path we already know the nominal size, so set natural
  // eagerly. For raster images natural arrives via <img onLoad>.
  useEffect(() => {
    if (isSvg) setNatural(svgSize ?? SVG_DEFAULT_SIZE);
  }, [isSvg, svgSize]);

  // fitRatio = scale needed to fit within the preview area (capped at 1)
  const fitRatio = useMemo(() => {
    if (!natural || viewSize.w <= 0 || viewSize.h <= 0) return null;
    if (natural.w <= 0 || natural.h <= 0) return null;
    return Math.min(1, viewSize.w / natural.w, viewSize.h / natural.h);
  }, [natural, viewSize]);

  // When fitRatio becomes available, set scale to it (unless user
  // already adjusted).
  const prevFitRef = useRef<number | null>(null);
  useEffect(() => {
    if (fitRatio === null) return;
    if (prevFitRef.current === null) {
      setScale(fitRatio);
      userAdjustedRef.current = false;
    } else if (!userAdjustedRef.current && fitRatio !== prevFitRef.current) {
      setScale(fitRatio);
    }
    prevFitRef.current = fitRatio;
  }, [fitRatio]);

  // Display dimensions: natural * scale (kept for the <img> path; the
  // SVG path uses inline-block + transform on the wrapper).
  const dims = useMemo(() => {
    if (!natural) return null;
    return {
      w: Math.round(natural.w * scale),
      h: Math.round(natural.h * scale),
    };
  }, [natural, scale]);

  const overflowing = dims && viewSize.w > 0
    ? dims.w > viewSize.w || dims.h > viewSize.h
    : false;

  const adjustScale = useCallback((fn: (prev: number) => number) => {
    userAdjustedRef.current = true;
    setScale(fn);
  }, []);

  const resetScale = useCallback(() => {
    if (fitRatio !== null) {
      setScale(fitRatio);
      userAdjustedRef.current = false;
    }
  }, [fitRatio]);

  const zoomIn = useCallback(() => adjustScale((s) => Math.min(MAX_SCALE, +(s + SCALE_STEP).toFixed(4))), [adjustScale]);
  const zoomOut = useCallback(() => adjustScale((s) => Math.max(0.01, +(s - SCALE_STEP).toFixed(4))), [adjustScale]);

  // Keyboard shortcuts: Ctrl+= / Ctrl++ zoom in, Ctrl+- zoom out, Ctrl+0 reset
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "=" || e.key === "+") { e.preventDefault(); zoomIn(); }
      else if (e.key === "-") { e.preventDefault(); zoomOut(); }
      else if (e.key === "0") { e.preventDefault(); resetScale(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomIn, zoomOut, resetScale]);

  const commitScaleInput = useCallback(() => {
    const v = inputVal.replace("%", "").trim();
    if (v === "") { setInputVal(""); setInputFocus(false); return; }
    const n = parseFloat(v);
    if (isNaN(n)) { setInputVal(""); setInputFocus(false); return; }
    const pct = Math.min(999, Math.max(1, Math.round(n))) / 100;
    setScale(pct);
    userAdjustedRef.current = true;
    setInputVal("");
    setInputFocus(false);
  }, [inputVal]);

  const onScaleInputKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      setInputVal("");
      setInputFocus(false);
    }
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0 || !overflowing) return;
    const el = scrollRef.current;
    if (!el) return;
    dragRef.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      scrollX: el.scrollLeft,
      scrollY: el.scrollTop,
    };
    setDragging(true);
    e.preventDefault();
  }, [overflowing]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.active) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollLeft = dragRef.current.scrollX - (e.clientX - dragRef.current.startX);
    el.scrollTop = dragRef.current.scrollY - (e.clientY - dragRef.current.startY);
  }, []);

  const onMouseUp = useCallback(() => {
    dragRef.current.active = false;
    setDragging(false);
  }, []);

  const showSvg = isSvg && svgText && !error;
  const showImg = !isSvg && src && !error;

  return (
    <div ref={rootRef} className="h-full relative" style={{ background: "var(--md-code-bg)" }}>
      {/* Scroll container fills the entire preview area */}
      <div
        ref={scrollRef}
        style={{
          position: "absolute",
          inset: 0,
          overflow: "auto",
          paddingBottom: 72,
          cursor: overflowing ? (dragging ? "grabbing" : "grab") : "default",
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {error && (
          <div className="empty-state" style={{ height: "100%" }}>
            <div className="title" style={{ color: "#ef4444" }}>{t("image.error")}</div>
            <div className="hint">{error}</div>
          </div>
        )}

        {showSvg && (
          <div
            style={{
              minWidth: "100%",
              minHeight: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: 16,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: dims?.w ?? SVG_DEFAULT_SIZE.w,
                height: dims?.h ?? SVG_DEFAULT_SIZE.h,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <style>{`#${svgWrapId} > svg { width: 100%; height: 100%; display: block; }`}</style>
              <div
                id={svgWrapId}
                style={{ width: "100%", height: "100%", display: "flex" }}
                dangerouslySetInnerHTML={{ __html: svgText ?? "" }}
              />
            </div>
          </div>
        )}

        {showImg && (
          <div
            style={{
              minWidth: "100%",
              minHeight: "100%",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <img
              src={src}
              alt={file.name}
              onLoad={(e) => {
                setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight });
                setError(null);
              }}
              onError={() => {
                setError(`Image failed to load: ${file.name}`);
              }}
              style={
                dims
                  ? {
                      width: dims.w,
                      height: dims.h,
                      maxWidth: "none",
                      maxHeight: "none",
                      display: "block",
                      flexShrink: 0,
                    }
                  : {
                      maxWidth: "100%",
                      maxHeight: "100%",
                      objectFit: "contain",
                      display: "block",
                    }
              }
              draggable={false}
            />
          </div>
        )}
      </div>

      {/* Floating toolbar at bottom — frosted glass pill */}
      <div className="pdf-toolbar">
        <button onClick={zoomOut} title="Ctrl+−">−</button>
        {inputFocus ? (
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            className="pdf-toolbar-input"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onBlur={commitScaleInput}
            onKeyDown={onScaleInputKeyDown}
          />
        ) : (
          <span
            className="pdf-toolbar-page"
            style={{ cursor: "pointer" }}
            title={t("image.clickToEdit")}
            onClick={() => { setInputVal(String(Math.round(scale * 100))); setInputFocus(true); }}
          >
            {Math.round(scale * 100)}%
          </span>
        )}
        <button onClick={zoomIn} title="Ctrl++">+</button>
        <button onClick={resetScale} title="Ctrl+0">{t("image.reset")}</button>
      </div>
    </div>
  );
}
