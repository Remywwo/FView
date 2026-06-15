import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile, BaseDirectory } from "@tauri-apps/plugin-fs";
import { detectFile, type DetectedFile, type FileKind } from "@/utils/fileDetector";

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
  dirty: boolean;
}

interface UseFileLoaderApi {
  current: LoadedFile | null;
  loading: boolean;
  error: string | null;
  open: () => Promise<void>;
  save: () => Promise<void>;
  saveAs: () => Promise<void>;
  loadFromPath: (path: string) => Promise<void>;
  setContent: (content: string) => void;
  close: () => void;
  toggleTheme: () => void;
  isDark: boolean;
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

  if (detected.kind === "image" || detected.kind === "pdf" || detected.kind === "unknown") {
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
    dirty: false,
  };
}

export function useFileLoader(): UseFileLoaderApi {
  const [current, setCurrent] = useState<LoadedFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDark, setIsDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("fview:theme");
    if (stored) return stored === "dark";
    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
  });
  const currentRef = useRef<LoadedFile | null>(null);
  currentRef.current = current;

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem("fview:theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("fview:theme", "light");
    }
  }, [isDark]);

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
          { name: "All Supported", extensions: ["md", "markdown", "pdf", "txt", "html", "htm", "json", "js", "ts", "tsx", "jsx", "py", "rs", "go", "java", "c", "cpp", "css", "scss", "yml", "yaml", "xml", "sh", "bash", "sql", "png", "jpg", "jpeg", "gif", "webp", "svg"] },
          { name: "Markdown", extensions: ["md", "markdown"] },
          { name: "PDF", extensions: ["pdf"] },
          { name: "Text", extensions: ["txt", "log"] },
          { name: "Code", extensions: ["json", "js", "ts", "tsx", "jsx", "py", "rs", "go", "java", "c", "cpp", "css", "scss", "yml", "yaml", "xml", "sh", "bash", "sql"] },
          { name: "Image", extensions: ["png", "jpg", "jpeg", "gif", "webp", "svg"] },
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
      const target = await saveDialog({
        defaultPath: cur.path || cur.name,
        title: "Save As",
        filters: [{ name: "All Files", extensions: ["*"] }],
      });
      if (!target) return;
      await writeTextFile(target, cur.content);
      setCurrent({ ...cur, path: target, name: target.split(/[\\/]/).pop() || cur.name, dirty: false });
    } catch (e: any) {
      setError(e?.message || String(e));
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
      setCurrent({ ...cur, dirty: false });
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, [saveAs]);

  const setContent = useCallback((content: string) => {
    setCurrent((prev) => {
      if (!prev) return prev;
      if (prev.content === content) return prev;
      return { ...prev, content, dirty: true };
    });
  }, []);

  const close = useCallback(() => {
    setCurrent(null);
    setError(null);
  }, []);

  const toggleTheme = useCallback(() => {
    setIsDark((d) => !d);
  }, []);

  // CLI args: read first positional file argument on startup
  useEffect(() => {
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

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "o") {
        e.preventDefault();
        open();
      } else if (meta && e.key.toLowerCase() === "s" && !e.shiftKey) {
        e.preventDefault();
        save();
      } else if (meta && e.key.toLowerCase() === "s" && e.shiftKey) {
        e.preventDefault();
        saveAs();
      } else if (meta && e.key.toLowerCase() === "w") {
        e.preventDefault();
        close();
      } else if (meta && e.key === ".") {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, save, saveAs, close, toggleTheme]);

  return { current, loading, error, open, save, saveAs, loadFromPath, setContent, close, toggleTheme, isDark };
}
