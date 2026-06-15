import { useEffect, useRef } from "react";
import type { EditorView } from "@codemirror/view";

const DELAY_MS = 300;
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

    const onEditorScroll = () => {
      if (isLocked()) return;
      cancelPending();
      timerRef.current = window.setTimeout(() => {
        const eMax = editorScroll.scrollHeight - editorScroll.clientHeight;
        if (eMax <= 0) return;
        const pMax = previewScroll.scrollHeight - previewScroll.clientHeight;
        if (pMax <= 0) return;
        let progress = editorScroll.scrollTop / eMax;
        if (progress < 0.005) progress = 0;
        else if (progress > 0.995) progress = 1;
        lockUntilRef.current = performance.now() + LOCK_MS;
        previewScroll.scrollTop = Math.round(progress * pMax);
      }, DELAY_MS);
    };

    const onPreviewScroll = () => {
      if (isLocked()) return;
      cancelPending();
      timerRef.current = window.setTimeout(() => {
        const pMax = previewScroll.scrollHeight - previewScroll.clientHeight;
        if (pMax <= 0) return;
        const eMax = editorScroll.scrollHeight - editorScroll.clientHeight;
        if (eMax <= 0) return;
        let progress = previewScroll.scrollTop / pMax;
        if (progress < 0.005) progress = 0;
        else if (progress > 0.995) progress = 1;
        lockUntilRef.current = performance.now() + LOCK_MS;
        editorScroll.scrollTop = Math.round(progress * eMax);
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
