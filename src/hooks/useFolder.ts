import { useCallback, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { writeTextFile, mkdir, remove, rename } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { scanFolder, type FolderNode } from "@/utils/scanFolder";
import { useRegisterCommand } from "@/hooks/useCommands";

export function useFolder() {
  const [root, setRoot] = useState<FolderNode | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openFolder = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const selected = await openDialog({ directory: true, multiple: false, title: "Open Folder" });
      if (typeof selected !== "string") {
        setLoading(false);
        return;
      }
      const tree = await scanFolder(selected);
      setRoot(tree);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const setFolderPath = useCallback(async (path: string) => {
    try {
      setLoading(true);
      setError(null);
      const tree = await scanFolder(path);
      setRoot(tree);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!root) return;
    try {
      setLoading(true);
      setError(null);
      const tree = await scanFolder(root.path);
      setRoot(tree);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [root]);

  const createFile = useCallback(async (dirPath: string, name: string) => {
    const fullPath = await join(dirPath, name);
    await writeTextFile(fullPath, "");
    await refresh();
  }, [refresh]);

  const createFolder = useCallback(async (dirPath: string, name: string) => {
    const fullPath = await join(dirPath, name);
    await mkdir(fullPath);
    await refresh();
  }, [refresh]);

  const deleteItem = useCallback(async (path: string) => {
    await remove(path);
    await refresh();
  }, [refresh]);

  const renameItem = useCallback(async (oldPath: string, newName: string) => {
    const dir = oldPath.substring(0, oldPath.lastIndexOf("/"));
    if (!dir && oldPath.includes("\\")) {
      const idx = oldPath.lastIndexOf("\\");
      const newPath = oldPath.substring(0, idx + 1) + newName;
      await rename(oldPath, newPath);
    } else {
      const newPath = dir ? `${dir}/${newName}` : newName;
      await rename(oldPath, newPath);
    }
    await refresh();
  }, [refresh]);

  const close = useCallback(() => {
    setRoot(null);
    setError(null);
  }, []);

  // Register folder commands via the centralized command system.
  // ⇧⌘O is preserved with capture:true to keep the original
  // App.tsx behavior of firing before any other listener.
  useRegisterCommand({
    id: "folder.openFolder",
    label: "Open Folder",
    shortcut: "Mod+Shift+O",
    capture: true,
    run: openFolder,
  });

  return { root, loading, error, openFolder, setFolderPath, refresh, createFile, createFolder, deleteItem, renameItem, close };
}
