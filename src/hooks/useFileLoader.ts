import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { detectFile, type DetectedFile, type FileKind } from "@/utils/fileDetector";
import { useRegisterCommand } from "@/hooks/useCommands";
import { isTauriRuntime } from "@/utils/platform";

export interface LoadedFile {
  path: string;
  name: string;
  kind: FileKind;
  language?: string;
  extension: string;
  isEditable: boolean;
  content: string;
  isBinary: boolean;
  binaryBytes?: Uint8Array;
  savedContent: string;
  dirty: boolean;
}

type NotifyLevel = "info" | "warn" | "error";

/**
 * Minimal i18n signature the loader needs. Mirrors `useI18n().t` but is
 * decoupled from React so this hook stays testable in isolation.
 */
type Translator = (key: string) => string;

interface UseFileLoaderApi {
  current: LoadedFile | null;
  loading: boolean;
  error: string | null;
  open: () => Promise<void>;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  loadFromPath: (path: string) => Promise<void>;
  setContent: (content: string) => void;
  markDirty: () => void;
  close: () => void;
  /** True when the buffer is dirty and the user has requested close —
   *  the host should render an inline Save / Discard / Cancel prompt. */
  closePending: boolean;
  confirmClose: () => Promise<void>;
  discardClose: () => void;
  cancelClose: () => void;
  setError: (e: string | null) => void;
}

function bytesToString(bytes: Uint8Array): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function isProbablyBinary(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.length, 8192));
  let suspicious = 0;
  for (const b of sample) {
    if (b === 0) return true;
    if (b < 7 || (b > 14 && b < 32 && b !== 27)) suspicious++;
  }
  return sample.length > 0 && suspicious / sample.length > 0.3;
}

async function readAnyFile(path: string): Promise<LoadedFile> {
  const detected: DetectedFile = detectFile(path);

  if (detected.kind === "image" || detected.kind === "pdf" || detected.kind === "docx" || detected.kind === "unknown") {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    const bytes = await readFile(path);
    return {
      path,
      name: detected.basename,
      kind: detected.kind,
      language: detected.language,
      extension: detected.extension,
      isEditable: false,
      content: "",
      isBinary: true,
      binaryBytes: bytes,
      savedContent: "",
      dirty: false,
    };
  }

  const text = await readTextFile(path);
  return {
    path,
    name: detected.basename,
    kind: detected.kind,
    language: detected.language,
    extension: detected.extension,
    isEditable: detected.isEditable,
    content: text,
    isBinary: false,
    savedContent: text,
    dirty: false,
  };
}

export function useFileLoader(opts?: {
  /**
   * Optional toast/notification sink. Called when Save As produces a copy.
   * Kept optional so the hook stays usable in tests and non-React contexts.
   */
  notify?: (message: string, level?: NotifyLevel) => void;
  /**
   * Optional i18n translator. Defaults to a passthrough that returns the
   * key itself when no translator is wired in.
   */
  t?: Translator;
}): UseFileLoaderApi {
  const [current, setCurrent] = useState<LoadedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [closePending, setClosePending] = useState(false);
  const currentRef = useRef<LoadedFile | null>(null);
  currentRef.current = current;
  const notifyRef = useRef(opts?.notify);
  notifyRef.current = opts?.notify;
  const tRef = useRef<Translator>(opts?.t ?? ((key: string) => key));
  tRef.current = opts?.t ?? tRef.current;

  const loadFromPath = useCallback(async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      const loaded = await readAnyFile(path);
      setCurrent(loaded);
    } catch (e: any) {
      console.error("Failed to load file", e);
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const open = useCallback(async () => {
    try {
      const selected = await openDialog({
        multiple: false,
        directory: false,
        title: "Open File",
        filters: [
          { name: "All Supported", extensions: ["md", "markdown", "pdf", "txt", "html", "htm", "json", "js", "ts", "tsx", "jsx", "py", "rs", "go", "java", "c", "cpp", "css", "scss", "yml", "yaml", "xml", "sh", "bash", "sql", "png", "jpg", "jpeg", "gif", "webp", "svg", "docx"] },
          { name: "Markdown", extensions: ["md", "markdown"] },
          { name: "PDF", extensions: ["pdf"] },
          { name: "Text", extensions: ["txt", "log"] },
          { name: "Code", extensions: ["json", "js", "ts", "tsx", "jsx", "py", "rs", "go", "java", "c", "cpp", "css", "scss", "yml", "yaml", "xml", "sh", "bash", "sql"] },
          { name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] },
          { name: "Word", extensions: ["docx"] },
        ],
      });
      if (typeof selected === "string") {
        await loadFromPath(selected);
      } else if (Array.isArray(selected) && (selected as string[]).length > 0) {
        await loadFromPath((selected as string[])[0]);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, [loadFromPath]);

  const saveAs = useCallback(async () => {
    const cur = currentRef.current;
    if (!cur || !cur.isEditable) return;
    try {
      const ext = cur.extension;
      const filters = [];
      if (ext) {
        filters.push({ name: `${ext.toUpperCase()} (.${ext})`, extensions: [ext] });
      }
      filters.push({ name: "All Files", extensions: ["*"] });
      const target = await saveDialog({
        defaultPath: cur.path || cur.name,
        title: "Save As",
        filters,
      });
      if (!target) return;
      await writeTextFile(target, cur.content);
      // Save As produces a copy. Keep the originally opened file as the
      // active buffer (path/name unchanged, dirty stays true if edits are
      // still unsaved) so the user keeps editing the source they opened.
      const newName = target.split(/[\\/]/).pop() || cur.name;
      notifyRef.current?.(
        tRef.current("app.savedAsCopy").replace("{name}", newName),
        "info",
      );
    } catch (e: any) {
      setError(e?.message || String(e));
      notifyRef.current?.(e?.message || String(e), "error");
    }
  }, []);

  const save = useCallback(async () => {
    const cur = currentRef.current;
    if (!cur || !cur.isEditable) return;
    if (!cur.path) {
      await saveAs();
      return;
    }
    try {
      await writeTextFile(cur.path, cur.content);
      setCurrent({ ...cur, savedContent: cur.content, dirty: false });
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, [saveAs]);

  const setContent = useCallback((content: string) => {
    setCurrent((prev) => {
      if (!prev) return prev;
      const dirty = content !== prev.savedContent;
      if (prev.content === content && prev.dirty === dirty) return prev;
      return { ...prev, content, dirty };
    });
  }, []);

  const markDirty = useCallback(() => {
    setCurrent((prev) => {
      if (!prev || prev.dirty) return prev;
      return { ...prev, dirty: true };
    });
  }, []);

  const close = useCallback(() => {
    const cur = currentRef.current;
    if (cur?.dirty) {
      setClosePending(true);
      return;
    }
    setCurrent(null);
    setError(null);
  }, []);

  const confirmClose = useCallback(async () => {
    const cur = currentRef.current;
    if (!cur) return;
    if (cur.dirty) {
      if (!cur.path) {
        await saveAs();
      } else {
        try {
          await writeTextFile(cur.path, cur.content);
          setCurrent({ ...cur, savedContent: cur.content, dirty: false });
        } catch (e: any) {
          setError(e?.message || String(e));
          return; // keep the dialog open so the user can retry
        }
      }
    }
    setClosePending(false);
    setCurrent(null);
    setError(null);
  }, [saveAs]);

  const discardClose = useCallback(() => {
    setClosePending(false);
    setCurrent(null);
    setError(null);
  }, []);

  const cancelClose = useCallback(() => {
    setClosePending(false);
  }, []);

  // CLI args: read first positional file argument on startup
  useEffect(() => {
    if (!isTauriRuntime()) return;
    (async () => {
      try {
        const cliFile = await invoke<string | null>("get_cli_file");
        if (cliFile) {
          await loadFromPath(cliFile);
        }
      } catch (e) {
        // ignore - probably not running in Tauri context
      }
    })();
  }, [loadFromPath]);

  // Register file commands via the centralized command system.
  // Each useRegisterCommand is keyed on the command id, so re-renders
  // don't churn the registry — the latest `run` closure is read
  // through the ref inside useRegisterCommand.
  useRegisterCommand({
    id: "file.open",
    label: "Open File",
    shortcut: "Mod+O",
    run: open,
  });
  useRegisterCommand({
    id: "file.save",
    label: "Save",
    shortcut: "Mod+S",
    run: save,
  });
  useRegisterCommand({
    id: "file.saveAs",
    label: "Save As",
    shortcut: "Mod+Shift+S",
    run: saveAs,
  });
  useRegisterCommand({
    id: "file.close",
    label: "Close",
    shortcut: "Mod+W",
    run: close,
  });

  return { current, loading, error, open, save, saveAs, loadFromPath, setContent, markDirty, close, closePending, confirmClose, discardClose, cancelClose, setError };
}
