import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import type { LoadedFile } from "@/hooks/useFileLoader";
import type { FolderNode } from "@/utils/scanFolder";
import { FolderTree } from "@/components/FolderTree";
import { SidebarOutline } from "@/components/SidebarOutline";
import { PdfOutlineTree } from "@/components/PdfOutlineTree";
import type { PdfOutlineNode } from "@/components/PdfOutlineDrawer";
import { Slot } from "@/components/Slot";

const MIN_WIDTH = 290;
const MAX_WIDTH = 480;
const DEFAULT_WIDTH = 290;

function loadSidebarWidth(): number {
  try {
    const v = localStorage.getItem("fview:sidebar-width");
    if (v) { const n = parseInt(v, 10); if (n >= MIN_WIDTH && n <= MAX_WIDTH) return n; }
  } catch {}
  return DEFAULT_WIDTH;
}

interface SidebarProps {
  // Top action toolbar
  onOpen: () => void;
  onOpenFolder: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onClose: () => void;
  // Footer settings / help launchers
  onOpenSettings: () => void;
  onOpenHelp: () => void;
  // macOS traffic-light padding
  isMac?: boolean;
  // Current document
  current: LoadedFile | null;
  // Folder tree (passed through to <FolderTree />)
  folderRoot: FolderNode | null;
  onSelectFile: (path: string) => void;
  onCloseFolder: () => void;
  onRefreshFolder: () => void;
  onCreateFile: (dirPath: string, name: string) => void;
  onCreateFolder: (dirPath: string, name: string) => void;
  onDeleteItem: (path: string) => void;
  onRenameItem: (oldPath: string, newName: string) => void;
  folderLoading: boolean;
  folderError: string | null;
  // Outline tab — element to scan for headings (the markdown editor container)
  tocContainer: HTMLElement | null;
  tocScrollContainer: HTMLElement | null;
  // PDF outline — shown in the Outline tab when the current file is a PDF.
  pdfOutline: PdfOutlineNode[] | null;
  onPdfJump: (page: number) => void;
}

type TabKey = "files" | "outline";

/**
 * Persistent application sidebar.
 *
 * Structure:
 *   1. Top action toolbar  (centred: Open / Open folder / Save / Save As /
 *                           Close | Files-toggle | Outline-toggle)
 *   2. Body                 (FolderTree | SidebarOutline | PdfOutlineTree)
 *   3. Bottom actions       (left: Settings / Help — right: plugin Slot)
 *
 * Default tab: if a folder is open → Files; otherwise if a markdown or PDF
 * file is open → Outline; otherwise the body shows a placeholder.
 */
export function Sidebar(props: SidebarProps) {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabKey>("files");
  const [width, setWidth] = useState(loadSidebarWidth);
  const dragging = useRef(false);
  const widthRef = useRef(width);
  widthRef.current = width;

  // Expose sidebar width as a CSS variable for the AI panel positioning.
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", `${width}px`);
    return () => { document.documentElement.style.removeProperty("--sidebar-width"); };
  }, [width]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    const startX = e.clientX;
    const startW = widthRef.current;
    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startW + ev.clientX - startX));
      setWidth(next);
    };
    const onUp = () => {
      dragging.current = false;
      try { localStorage.setItem("fview:sidebar-width", String(widthRef.current)); } catch {}
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  const hasFolder = props.folderRoot !== null;
  const isMarkdown = props.current?.kind === "markdown";
  const isPdf = props.current?.kind === "pdf";
  const pdfHasOutline = isPdf && props.pdfOutline !== null && props.pdfOutline.length > 0;
  const hasOutline = (isMarkdown && props.tocContainer !== null) || pdfHasOutline;

  // Default tab: folder open → files; otherwise outline-capable file → outline.
  // Fall back to files if outline disappears while we're on it.
  useEffect(() => {
    if (hasFolder) {
      setTab("files");
    } else if (hasOutline) {
      setTab("outline");
    } else {
      setTab("files");
    }
  }, [hasFolder, hasOutline]);

  return (
    <aside className={`sidebar${props.isMac ? " sidebar-mac" : ""}`} style={{ width }}>
      {/* Titlebar spacer — keep content clear of the toolbar / traffic-light area */}
      <div className={`sidebar-top-spacer${props.isMac ? " sidebar-mac-spacer" : ""}`} />

      {/* ── Top action toolbar (centred) ──────────────────────────── */}
      <div className="sidebar-toolbar">
        <button type="button" className="sidebar-action" onClick={props.onOpen} title={`${t("app.openFile")} (⌘O)`} aria-label={t("app.openFile")}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
        </button>
        <button type="button" className="sidebar-action" onClick={props.onOpenFolder} title={`${t("app.openFolder")} (⇧⌘O)`} aria-label={t("app.openFolder")}>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
        </button>
        <button type="button" className="sidebar-action" onClick={props.onSave} disabled={!props.current?.isEditable || !props.current?.dirty} title={`${t("app.save")} (⌘S)`} aria-label={t("app.save")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /></svg>
        </button>
        <button type="button" className="sidebar-action" onClick={props.onSaveAs} disabled={!props.current?.isEditable} title={`${t("app.saveAs")} (⇧⌘S)`} aria-label={t("app.saveAs")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" /><polyline points="17 21 17 13 7 13 7 21" /><polyline points="7 3 7 8 15 8" /><line x1="17" y1="3" x2="17" y2="8" /><line x1="12" y1="3" x2="12" y2="8" /></svg>
        </button>
        <button type="button" className="sidebar-action" onClick={props.onClose} disabled={!props.current} title={`${t("app.close")} (⌘W)`} aria-label={t("app.close")}>
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        {/* Single view toggle — cycles Files ↔ Outline when both are available */}
        {hasFolder && hasOutline ? (
          <>
            <span className="sidebar-toolbar-divider" />
            <button
              type="button"
              className="sidebar-action"
              onClick={() => setTab(tab === "files" ? "outline" : "files")}
              title={tab === "files" ? t("sidebar.tabOutline") : t("sidebar.tabFiles")}
              aria-label={tab === "files" ? t("sidebar.tabOutline") : t("sidebar.tabFiles")}
            >
              {tab === "files" ? (
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" /></svg>
              ) : (
                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
              )}
            </button>
          </>
        ) : null}
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="sidebar-body">
        {hasFolder && tab === "files" && (
          <div className="sidebar-panel">
            <FolderTree
              root={props.folderRoot!}
              selectedPath={props.current?.path ?? null}
              onSelectFile={props.onSelectFile}
              onClose={props.onCloseFolder}
              onRefresh={props.onRefreshFolder}
              onCreateFile={props.onCreateFile}
              onCreateFolder={props.onCreateFolder}
              onDeleteItem={props.onDeleteItem}
              onRenameItem={props.onRenameItem}
              loading={props.folderLoading}
              error={props.folderError}
            />
          </div>
        )}
        {hasOutline && tab === "outline" && (
          <div className="sidebar-panel">
            {isMarkdown && (
              <SidebarOutline container={props.tocContainer} />
            )}
            {isPdf && (
              <PdfOutlineTree outline={props.pdfOutline} currentPage={1} onJump={props.onPdfJump} />
            )}
          </div>
        )}
        {(() => {
          if (!hasFolder && !hasOutline) {
            const isFileOpen = props.current !== null;
            return (
              <div className="sidebar-empty">
                <div className="sidebar-empty-title">
                  {isFileOpen ? t("sidebar.noOutline") : t("sidebar.emptyTitle")}
                </div>
                <div className="sidebar-empty-hint">
                  {isFileOpen ? t("sidebar.noOutlineHint") : t("sidebar.emptyHint")}
                </div>
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* ── Bottom actions (left + right) ─────────────────────────── */}
      <div className="sidebar-bottom">
        <div className="sidebar-bottom-left">
          <button type="button" className="sidebar-action" onClick={props.onOpenSettings} title={t("app.settings")} aria-label={t("app.settings")}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
          </button>
          <button type="button" className="sidebar-action" onClick={props.onOpenHelp} title={t("app.help")} aria-label={t("app.help")}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
          </button>
        </div>
        <div className="sidebar-bottom-right">
          <Slot name="sidebar-bottom" />
        </div>
      </div>
      <div className="sidebar-resize-handle" onMouseDown={onResizeStart} />
    </aside>
  );
}
