import { useEffect, useRef } from "react";
import type { EditorView } from "@codemirror/view";

const DELAY_MS = 50;
const LOCK_MS = 300;

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

    /** Find the first block element visible at the top of the viewport */
    const findBlockAtTop = (): HTMLElement | null => {
      const containerTop = previewScroll.getBoundingClientRect().top;
      const blocks = previewScroll.querySelectorAll<HTMLElement>("[data-source-line]");
      let best: HTMLElement | null = null;
      for (const el of Array.from(blocks)) {
        const r = el.getBoundingClientRect();
        if (r.bottom > containerTop + 1) return el;
      }
      // Fallback: last block (scrolled past everything)
      return blocks.length > 0 ? blocks[blocks.length - 1] : null;
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
          // scrollIntoView handles offsetParent math correctly
          target.scrollIntoView({ block: "start" });
        }
      }, DELAY_MS);
    };

    const onPreviewScroll = () => {
      if (isLocked()) return;
      cancelPending();
      timerRef.current = window.setTimeout(() => {
        const target = findBlockAtTop();
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