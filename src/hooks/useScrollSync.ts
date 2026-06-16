import { useEffect, useRef } from "react";
import type { EditorView } from "@codemirror/view";

const DEBOUNCE_MS = 30;
const LOCK_MS = 120;

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

    // markdown-it `t.map[0]` is 0-indexed; CodeMirror `doc.lineAt().number` is 1-indexed.
    // Block at editor line N has data-source-line = N-1.

    const findBlockContainingLine = (mdLine: number): HTMLElement | null => {
      const blocks = previewScroll.querySelectorAll<HTMLElement>("[data-source-line]");
      let best: HTMLElement | null = null;
      let bestLine = -1;
      for (const el of Array.from(blocks)) {
        const ln = parseInt(el.getAttribute("data-source-line") || "0", 10);
        if (ln <= mdLine && ln > bestLine) {
          best = el;
          bestLine = ln;
        }
      }
      return best;
    };

    const findBlockAtTop = (): HTMLElement | null => {
      const containerTop = previewScroll.getBoundingClientRect().top;
      const blocks = previewScroll.querySelectorAll<HTMLElement>("[data-source-line]");
      if (blocks.length === 0) return null;
      // Topmost block whose top edge is within or below container top
      let best: HTMLElement | null = null;
      let bestTop = Infinity;
      for (const el of Array.from(blocks)) {
        const r = el.getBoundingClientRect();
        if (r.top >= containerTop - 1 && r.top < bestTop) {
          best = el;
          bestTop = r.top;
        }
      }
      if (best) return best;
      // All blocks above viewport — return the last one
      return blocks[blocks.length - 1];
    };

    const onEditorScroll = () => {
      if (isLocked()) return;
      cancelPending();
      timerRef.current = window.setTimeout(() => {
        const block = editorView.lineBlockAtHeight(editorScroll.scrollTop);
        if (!block) return;
        const cmLine = editorView.state.doc.lineAt(block.from).number;
        // Convert CodeMirror (1-indexed) to markdown-it (0-indexed)
        const target = findBlockContainingLine(cmLine - 1);
        if (target) {
          lockUntilRef.current = performance.now() + LOCK_MS;
          target.scrollIntoView({ block: "start" });
        }
      }, DEBOUNCE_MS);
    };

    const onPreviewScroll = () => {
      if (isLocked()) return;
      cancelPending();
      timerRef.current = window.setTimeout(() => {
        const target = findBlockAtTop();
        if (!target) return;
        // data-source-line is markdown-it (0-indexed); CodeMirror is 1-indexed
        const mdLine = parseInt(target.getAttribute("data-source-line") || "0", 10);
        const cmLine = mdLine + 1;
        if (cmLine < 1) return;

        try {
          const line = editorView.state.doc.line(cmLine);
          const block = editorView.lineBlockAt(line.from);
          if (block) {
            lockUntilRef.current = performance.now() + LOCK_MS;
            editorScroll.scrollTop = block.top;
          }
        } catch {}
      }, DEBOUNCE_MS);
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