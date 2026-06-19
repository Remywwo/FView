import { useSyncExternalStore } from "react";

/**
 * Snapshot of selection state across all editors in the app.
 *
 * Editors report their current selection (or empty string for a
 * collapsed caret) via `setEditorSelection`. Plugins and the host
 * read the snapshot via `useEditorSelection` and re-render when it
 * changes.
 */
export interface SelectionSnapshot {
  markdown: string;
  code: string;
  html: string;
}

export type EditorKind = keyof SelectionSnapshot;

const EMPTY: SelectionSnapshot = { markdown: "", code: "", html: "" };

let snapshot: SelectionSnapshot = EMPTY;
const subscribers = new Set<() => void>();

/**
 * Report the current selection of a named editor.
 *
 * No-op when the new value equals the existing one (by string compare),
 * so callers can invoke this on every cursor move without flooding
 * subscribers with no-change notifications.
 */
export function setEditorSelection(kind: EditorKind, text: string): void {
  if (snapshot[kind] === text) return;
  snapshot = { ...snapshot, [kind]: text };
  for (const cb of subscribers) cb();
}

/** Test/dev helper: clear all selection state. */
export function clearSelection(): void {
  snapshot = EMPTY;
  for (const cb of subscribers) cb();
}

/** Imperative read of the current snapshot (no subscription). */
export function getSelection(): SelectionSnapshot {
  return snapshot;
}

/**
 * React hook that re-renders when any editor's selection changes.
 *
 * Uses `useSyncExternalStore` so the snapshot is read concurrently
 * safely — important because CodeMirror 6 fires selection updates
 * synchronously from input events.
 */
export function useEditorSelection(): SelectionSnapshot {
  return useSyncExternalStore(
    (cb) => {
      subscribers.add(cb);
      return () => {
        subscribers.delete(cb);
      };
    },
    () => snapshot,
    () => EMPTY,
  );
}

/**
 * Subscribe imperatively (for use outside React render trees).
 * Returns an unsubscribe function.
 */
export function subscribeSelection(cb: () => void): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}