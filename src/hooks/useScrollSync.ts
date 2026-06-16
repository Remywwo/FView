import { useEffect, useRef } from "react";
import type { EditorView } from "@codemirror/view";

const DELAY_MS = 80;
const LOCK_MS = 400;

export function useScrollSync(
  editorView: EditorView | null,
  previewScroll: HTMLElement | null,
  enabled: boolean,
) {
  const lockUntilRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled || !editorView || !previewScroll) return;

    const editorScroll = editorView.scrollDOM;
    const isLocked = () => performance.now() < lockUntilRef.current;
    const cancelPending = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    /** Find first block element whose data-source-line is >= lineNo */
    const findBlockAtLine = (lineNo: number): HTMLElement | null => {
      const blocks = previewScroll.querySelectorAll<HTMLElement>("[data-source-line]");
      let best: HTMLElement | null = null;
      let bestLine = Infinity;
      for (const el of Array.from(blocks)) {
        const ln = parseInt(el.getAttribute("data-source-line") || "0", 10);
        if (ln >= lineNo && ln < bestLine) {
          best = el;
          bestLine = ln;
        }
      }
      return best;
    };

    /** Find first block element visible at the given scrollTop */
    const findBlockAtScrollTop = (scrollTop: number): HTMLElement | null => {
      const blocks = previewScroll.querySelectorAll<HTMLElement>("[data-source-line]");
      let best: HTMLElement | null = null;
      let bestOffset = Infinity;
      for (const el of Array.from(blocks)) {
        const off = el.offsetTop;
        if (off <= scrollTop && scrollTop - off < bestOffset) {
          best = el;
          bestOffset = scrollTop - off;
        }
      }
      return best;
    };

    const onEditorScroll = () => {
      if (isLocked()) return;
      cancelPending();
      timerRef.current = window.setTimeout(() => {
        const top = editorScroll.scrollTop;
        const block = editorView.lineBlockAtHeight(top);
        if (!block) return;
        const lineNo = editorView.state.doc.lineAt(block.from).number;

        const target = findBlockAtLine(lineNo);
        if (target) {
          lockUntilRef.current = performance.now() + LOCK_MS;
          previewScroll.scrollTop = target.offsetTop;
        }
      }, DELAY_MS);
    };

    const onPreviewScroll = () => {
      if (isLocked()) return;
      cancelPending();
      timerRef.current = window.setTimeout(() => {
        const top = previewScroll.scrollTop;
        const target = findBlockAtScrollTop(top);
        if (!target) return;
        const lineNo = parseInt(target.getAttribute("data-source-line") || "0", 10);
        if (!lineNo) return;

        try {
          const line = editorView.state.doc.line(lineNo);
          const block = editorView.lineBlockAt(line.from);
          if (block) {
            lockUntilRef.current = performance.now() + LOCK_MS;
            editorScroll.scrollTop = block.top;
          }
        } catch {}
      }, DELAY_MS);
    };

    editorScroll.addEventListener("scroll", onEditorScroll, { passive: true });
    previewScroll.addEventListener("scroll", onPreviewScroll, { passive: true });

    return () => {
      editorScroll.removeEventListener("scroll", onEditorScroll);
      previewScroll.removeEventListener("scroll", onPreviewScroll);
      cancelPending();
    };
  }, [editorView, previewScroll, enabled]);
}