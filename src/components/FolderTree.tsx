import { useEffect, useState, useCallback, useRef } from "react";
import type { FolderNode } from "@/utils/scanFolder";
import { collectFolderPaths } from "@/utils/scanFolder";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  root: FolderNode;
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  onClose: () => void;
  onRefresh: () => void;
  onCreateFile: (dirPath: string, name: string) => void;
  onCreateFolder: (dirPath: string, name: string) => void;
  onDeleteItem: (path: string) => void;
  loading: boolean;
  error: string | null;
}

export function FolderTree({ root, selectedPath, onSelectFile, onClose, onRefresh, onCreateFile, onCreateFolder, onDeleteItem, loading, error }: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([root.path]));
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; path: string; isDir: boolean } | null>(null);
  const [createInput, setCreateInput] = useState<{ dirPath: string; kind: "file" | "folder" } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selectedPath) return;
    const allFolders = collectFolderPaths(root);
    const ancestors = new Set<string>([root.path]);
    for (const folderPath of allFolders) {
      if (selectedPath.startsWith(folderPath + "/") || selectedPath.startsWith(folderPath + "\\")) {
        ancestors.add(folderPath);
      }
    }
    setExpanded(ancestors);
  }, [selectedPath, root]);

  useEffect(() => {
    if (createInput && inputRef.current) inputRef.current.focus();
  }, [createInput]);

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleContextMenu = useCallback((e: React.MouseEvent, path: string, isDir: boolean) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY, path, isDir });
  }, []);

  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);

  const handleCreate = useCallback((kind: "file" | "folder") => {
    if (!ctxMenu) return;
    setCreateInput({ dirPath: ctxMenu.path, kind });
    setCtxMenu(null);
  }, [ctxMenu]);

  const handleDelete = useCallback(() => {
    if (!ctxMenu) return;
    setConfirmDelete(ctxMenu.path);
    setCtxMenu(null);
  }, [ctxMenu]);

  const confirmDeleteItem = useCallback(() => {
    if (!confirmDelete) return;
    onDeleteItem(confirmDelete);
    setConfirmDelete(null);
  }, [confirmDelete, onDeleteItem]);

  const commitCreate = useCallback(() => {
    if (!createInput || !inputRef.current) return;
    const name = inputRef.current.value.trim();
    if (!name) return;
    if (createInput.kind === "file") {
      onCreateFile(createInput.dirPath, name);
    } else {
      onCreateFolder(createInput.dirPath, name);
    }
    setCreateInput(null);
  }, [createInput, onCreateFile, onCreateFolder]);

  const handleCreateKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") commitCreate();
    if (e.key === "Escape") setCreateInput(null);
  }, [commitCreate]);

  return (
    <aside className="folder-sidebar" onClick={closeCtxMenu}>
      <div className="folder-sidebar-header">
        <span className="folder-sidebar-title" title={root.path}>{root.name}</span>
        <button onClick={onRefresh} disabled={loading} title={t("folder.refresh")} aria-label={t("folder.refresh")}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: loading ? "folder-spin 0.8s linear infinite" : undefined }}
          >
            <polyline points="23 4 23 10 17 10" />
            <polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
        <button onClick={onClose} title={t("folder.close")} aria-label={t("folder.close")}>×</button>
      </div>
      <div className="folder-sidebar-body">
        {error && <div className="folder-error">{error}</div>}
        <ul className="folder-tree">
          <TreeNode
            node={root}
            depth={0}
            expanded={expanded}
            selectedPath={selectedPath}
            onToggle={toggle}
            onSelectFile={onSelectFile}
            onContextMenu={handleContextMenu}
          />
        </ul>
      </div>

      {ctxMenu && (
        <div
          className="context-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y, position: "fixed" }}
          onClick={(e) => e.stopPropagation()}
        >
          {ctxMenu.isDir && (
            <>
              <button className="context-menu-item" onClick={() => handleCreate("file")}>
                {t("folder.newFile")}
              </button>
              <button className="context-menu-item" onClick={() => handleCreate("folder")}>
                {t("folder.newFolder")}
              </button>
              <div className="context-menu-divider" />
            </>
          )}
          <button className="context-menu-item context-menu-item--danger" onClick={handleDelete}>
            {t("folder.delete")}
          </button>
        </div>
      )}

      {createInput && (
        <div className="create-input-overlay" onClick={() => setCreateInput(null)}>
          <div className="create-input-box" onClick={(e) => e.stopPropagation()}>
            <div className="create-input-title">
              {createInput.kind === "file" ? t("folder.newFile") : t("folder.newFolder")}
            </div>
            <input
              ref={inputRef}
              className="create-input-field"
              placeholder={t("folder.enterName")}
              onKeyDown={handleCreateKeyDown}
            />
            <div className="create-input-actions">
              <button onClick={() => setCreateInput(null)}>{t("folder.cancel")}</button>
              <button className="primary" onClick={commitCreate}>{t("folder.ok")}</button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="create-input-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="create-input-box" onClick={(e) => e.stopPropagation()}>
            <div className="create-input-title">{t("folder.confirmDelete")}</div>
            <div className="create-input-title" style={{ fontWeight: 400, fontSize: "0.82em", color: "var(--md-muted)", wordBreak: "break-all" }}>
              {confirmDelete}
            </div>
            <div className="create-input-actions">
              <button onClick={() => setConfirmDelete(null)}>{t("folder.cancel")}</button>
              <button className="primary" style={{ background: "#ef4444", borderColor: "#ef4444" }} onClick={confirmDeleteItem}>{t("folder.delete")}</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}

interface NodeProps {
  node: FolderNode;
  depth: number;
  expanded: Set<string>;
  selectedPath: string | null;
  onToggle: (path: string) => void;
  onSelectFile: (path: string) => void;
  onContextMenu: (e: React.MouseEvent, path: string, isDir: boolean) => void;
}

function TreeNode({ node, depth, expanded, selectedPath, onToggle, onSelectFile, onContextMenu }: NodeProps) {
  if (!node.isDir) {
    return (
      <li>
        <div
          className={`tree-row file${selectedPath === node.path ? " selected" : ""}`}
          style={{ paddingLeft: `${0.4 + depth * 0.85}rem` }}
          onClick={() => onSelectFile(node.path)}
          onContextMenu={(e) => onContextMenu(e, node.path, false)}
          title={node.path}
        >
          <span className="tree-toggle-spacer" />
          <FileIcon name={node.name} />
          <span className="tree-name">{node.name}</span>
        </div>
      </li>
    );
  }

  const isExpanded = expanded.has(node.path);
  return (
    <li>
      <div
        className="tree-row folder"
        style={{ paddingLeft: `${0.4 + depth * 0.85}rem` }}
        onClick={() => onToggle(node.path)}
        onContextMenu={(e) => onContextMenu(e, node.path, true)}
        title={node.path}
      >
        <span className="tree-toggle" aria-hidden="true">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="10" height="10" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
          >
            <polyline points="9 6 15 12 9 18" />
          </svg>
        </span>
        <FolderIcon open={isExpanded} />
        <span className="tree-name">{node.name}</span>
      </div>
      {isExpanded && node.children.length > 0 && (
        <ul className="folder-tree">
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              selectedPath={selectedPath}
              onToggle={onToggle}
              onSelectFile={onSelectFile}
              onContextMenu={onContextMenu}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14" height="14" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      {open ? (
        <path d="M6 14l1.45-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.55 6a2 2 0 0 1-1.94 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H18a2 2 0 0 1 2 2v2" />
      ) : (
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
      )}
    </svg>
  );
}

function FileIcon({ name }: { name: string }) {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
  const colorMap: Record<string, string> = {
    md: "#60a5fa", markdown: "#60a5fa", pdf: "#ef4444", html: "#f97316", htm: "#f97316",
    json: "#eab308", js: "#fbbf24", ts: "#3b82f6", tsx: "#3b82f6", jsx: "#fbbf24",
    css: "#a855f7", scss: "#a855f7", png: "#22c55e", jpg: "#22c55e", jpeg: "#22c55e",
    gif: "#22c55e", svg: "#22c55e", txt: "#9ca3af",
  };
  const color = colorMap[ext] || "var(--md-muted)";
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke={color}
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
