import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readDir, stat } from "@tauri-apps/plugin-fs";
import { useFileLoader } from "@/hooks/useFileLoader";
import { useFolder } from "@/hooks/useFolder";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/hooks/useI18n";
import { useSettings } from "@/hooks/useSettings";
import { useCommand, useCommandContext } from "@/hooks/useCommands";
import { useRecents, type RecentItem } from "@/hooks/useRecents";
import { isMacPlatform } from "@/utils/platform";
import { setEditorSelection } from "@/hooks/useSelection";
import { createHostAPI, type ConcreteHostAPI } from "@/plugins/host";
import { PluginProvider } from "@/hooks/usePlugin";
import { DropZone } from "@/components/DropZone";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { DocumentSwitcher } from "@/components/DocumentSwitcher";
import { Sidebar } from "@/components/Sidebar";
import { CodePreview } from "@/components/CodePreview";
import { HtmlPreview } from "@/components/HtmlPreview";
import { PdfPreview } from "@/components/PdfPreview";
import type { PdfOutlineNode } from "@/components/PdfOutlineDrawer";
import { DocxPreview } from "@/components/DocxPreview";
import { ImagePreview } from "@/components/ImagePreview";
import { TextPreview } from "@/components/TextPreview";
import { SettingsModal } from "@/components/SettingsModal";
import { HelpModal } from "@/components/HelpModal";
import { Slot } from "@/components/Slot";
import { ToastHost } from "@/components/ToastHost";
import { builtInExtensions } from "@/plugins/extensions";

export default function App() {
  // Forward-declared ref so the file loader can surface toasts via the
  // host even though the host object is built a few lines below.
  const hostRef = useRef<ConcreteHostAPI | null>(null);
  const folder = useFolder();
  const theme = useTheme();
  const i18n = useI18n();
  const settingsCtx = useSettings();
  const commandCtx = useCommandContext();
  const { t } = i18n;
  const loader = useFileLoader({
    notify: (msg, level) => hostRef.current?.notify(msg, level),
    t,
  });
  const { current, setContent, markDirty, loadFromPath, error, closePending, confirmClose, discardClose, cancelClose } = loader;
  const { isDark } = theme;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // Container element for the markdown editor — passed to the sidebar so
  // the outline tab can scan headings inside it.
  const [tocContainer, setTocContainer] = useState<HTMLDivElement | null>(null);
  // PDF outline data — forwarded to the sidebar's Outline tab.
  const [pdfOutline, setPdfOutline] = useState<PdfOutlineNode[] | null>(null);
  const pdfJumpRef = useRef<((page: number) => void) | null>(null);

  // Toolbar / menu actions are wired through the centralized command
  // system so that plugins can intercept or extend them later.
  const cmdOpen = useCommand("file.open");
  const cmdSave = useCommand("file.save");
  const cmdSaveAs = useCommand("file.saveAs");
  const cmdClose = useCommand("file.close");
  const cmdOpenFolder = useCommand("folder.openFolder");

  // The DocumentSwitcher prompts to save before navigating away when the
  // buffer is dirty. Execute the save command directly so we can await it
  // and surface failures, and treat synchronous plugins as auto-success.
  const switcherSave = useCallback(async (): Promise<boolean> => {
    try {
      const result = commandCtx.execute("file.save");
      if (result instanceof Promise) {
        await result;
      }
      return true;
    } catch {
      return false;
    }
  }, [commandCtx]);

  // ── Plugin HostAPI ────────────────────────────────────────────────
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const folderRef = useRef(folder);
  folderRef.current = folder;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const i18nRef = useRef(i18n);
  i18nRef.current = i18n;
  const settingsRef = useRef(settingsCtx);
  settingsRef.current = settingsCtx;

  const commandCtxRef = useRef(commandCtx);
  commandCtxRef.current = commandCtx;

  const host = useMemo<ConcreteHostAPI>(
    () =>
      createHostAPI({
        loader: {
          get: () => loaderRef.current.current,
          setContent: (text) => loaderRef.current.setContent(text),
        },
        folder: {
          openFolder: () => folderRef.current.openFolder(),
        },
        theme: {
          isDark: () => themeRef.current.isDark,
          toggle: () => themeRef.current.toggleTheme(),
        },
        i18n: {
          t: (key) => i18nRef.current.t(key),
          lang: () => i18nRef.current.lang,
        },
        settings: {
          get: () => settingsRef.current.settings,
          update: (patch) =>
            settingsRef.current.update(patch as Parameters<typeof settingsRef.current.update>[0]),
        },
        resolveCommand: (id) => commandCtxRef.current.getCommand(id),
        registerCommand: (cmd) => commandCtxRef.current.register(cmd),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  hostRef.current = host;

  // Unified drop handler: detect file vs folder
  const handleDropPath = useCallback(async (path: string) => {
    try {
      const info = await stat(path);
      if (info.isDirectory) {
        await folder.setFolderPath(path);
      } else {
        await loadFromPath(path);
      }
    } catch {
      try {
        await readDir(path);
        await folder.setFolderPath(path);
      } catch {
        await loadFromPath(path);
      }
    }
  }, [folder, loadFromPath]);

  // ── Recents ─────────────────────────────────────────────────────
  const recents = useRecents();
  const attemptedRecentRef = useRef<RecentItem | null>(null);

  useEffect(() => {
    if (current) {
      recents.recordOpen(current.path, "file", current.name);
      if (attemptedRecentRef.current?.path === current.path) {
        attemptedRecentRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.path]);

  useEffect(() => {
    if (folder.root) {
      recents.recordOpen(folder.root.path, "folder", folder.root.name);
      if (attemptedRecentRef.current?.path === folder.root.path) {
        attemptedRecentRef.current = null;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folder.root?.path]);

  useEffect(() => {
    const attempted = attemptedRecentRef.current;
    if (!attempted) return;
    if (attempted.kind === "file" && loader.error) {
      recents.removeRecent(attempted.path);
      attemptedRecentRef.current = null;
    } else if (attempted.kind === "folder" && folder.error) {
      recents.removeRecent(attempted.path);
      attemptedRecentRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loader.error, folder.error]);

  const handleOpenRecent = useCallback(
    (item: RecentItem) => {
      attemptedRecentRef.current = item;
      if (item.kind === "file") {
        void loadFromPath(item.path);
      } else {
        void folder.setFolderPath(item.path);
      }
    },
    [loadFromPath, folder],
  );

  // Extensions get a stable array reference so PluginProvider doesn't
  // re-activate them on every render.
  const currentRef = useRef(current);
  currentRef.current = current;
  useEffect(() => {
    host.file._emit();
  }, [current]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Native menu events ──────────────────────────────────────────
  useEffect(() => {
    const unlisteners: Array<() => void> = [];
    (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        unlisteners.push(await listen("menu-file-open", () => cmdOpen()));
        unlisteners.push(await listen("menu-file-open-folder", () => cmdOpenFolder()));
        unlisteners.push(await listen("menu-file-save", () => cmdSave()));
        unlisteners.push(await listen("menu-file-save-as", () => cmdSaveAs()));
        unlisteners.push(await listen("menu-file-close", () => cmdClose()));
      } catch { /* not a Tauri runtime */ }
    })();
    return () => { unlisteners.forEach((fn) => fn()); };
  }, [cmdOpen, cmdOpenFolder, cmdSave, cmdSaveAs, cmdClose]);

  const extensions = useMemo(() => builtInExtensions, []);

  return (
    <PluginProvider host={host} extensions={extensions}>
      <div className="app-layout">
        {/* ── Sidebar ──────────────────────────────────────────────── */}
        <Sidebar
          onOpen={cmdOpen}
          onOpenFolder={cmdOpenFolder}
          onSave={cmdSave}
          onSaveAs={cmdSaveAs}
          onClose={cmdClose}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenHelp={() => setHelpOpen(true)}
          current={current}
          folderRoot={folder.root}
          onSelectFile={loadFromPath}
          onCloseFolder={() => { folder.close(); cmdClose(); }}
          onRefreshFolder={folder.refresh}
          onCreateFile={folder.createFile}
          onCreateFolder={folder.createFolder}
          onDeleteItem={(path) => {
            folder.deleteItem(path);
            if (current?.path === path) cmdClose();
          }}
          onRenameItem={folder.renameItem}
          folderLoading={folder.loading}
          folderError={folder.error}
          tocContainer={tocContainer}
          tocScrollContainer={tocContainer}
          pdfOutline={pdfOutline}
          onPdfJump={(page) => pdfJumpRef.current?.(page)}
          isMac={isMacPlatform()}
        />

        {/* ── Main pane ────────────────────────────────────────────── */}
        <div className="main-pane">
          {/* Toolbar — always visible, document switcher only when a file is open */}
          <div className="toolbar app-toolbar" data-tauri-drag-region>
            {current && (
              <DocumentSwitcher
                current={current}
                folderRoot={folder.root}
                recents={recents.recents}
                onSelect={loadFromPath}
                onSave={switcherSave}
              />
            )}
          </div>

          <div className="main-pane-body">
            {!current && !folder.root && (
              <EmptyState
                onOpen={cmdOpen}
                onOpenFolder={() => cmdOpenFolder()}
                onHelp={() => setHelpOpen(true)}
                recents={recents.recents}
                onOpenRecent={handleOpenRecent}
                onRemoveRecent={recents.removeRecent}
                onClearRecents={recents.clearRecents}
              />
            )}
            {!current && folder.root && (
              <div className="empty-state">
                <div className="title">{t("app.selectFile")}</div>
                <div className="hint">{t("app.selectFileHint")}</div>
              </div>
            )}
            {error && !current && (
              <div className="empty-state">
                <div className="title" style={{ color: "#ef4444" }}>{t("app.error")}</div>
                <div className="hint">{error}</div>
              </div>
            )}
            {folder.error && !current && (
              <div className="empty-state">
                <div className="title" style={{ color: "#ef4444" }}>{t("app.error")}</div>
                <div className="hint">{folder.error}</div>
              </div>
            )}

            {current && current.kind === "markdown" && (
              <MarkdownPreview
                file={current}
                setContent={setContent}
                markDirty={markDirty}
                onSelectionChange={(t) => setEditorSelection("markdown", t)}
                onTocContainerReady={setTocContainer}
              />
            )}
            {current && current.kind === "html" && (
              <HtmlPreview file={current} setContent={setContent} isDark={isDark} />
            )}
            {current && (current.kind === "code" || (current.kind === "text" && current.isEditable)) && (
              <CodePreview file={current} setContent={setContent} isDark={isDark} onSelectionChange={(t) => setEditorSelection("code", t)} />
            )}
            {current && current.kind === "text" && !current.isEditable && (
              <TextPreview file={current} />
            )}
            {current && current.kind === "pdf" && (
              <PdfPreview file={current} onOutlineReady={setPdfOutline} jumpRef={pdfJumpRef} />
            )}
            {current && current.kind === "docx" && (
              <DocxPreview file={current} />
            )}
            {current && current.kind === "image" && (
              <ImagePreview file={current} />
            )}
            {current && current.kind === "unknown" && (
              <UnknownState name={current.name} />
            )}

            <DropZone onDropPath={handleDropPath} />
          </div>
        </div>
      </div>

      {closePending && (
        <div className="confirm-overlay" role="alertdialog" aria-modal="true">
          <div className="confirm-card">
            <div className="confirm-title">{t("app.closeUnsavedTitle")}</div>
            <div className="confirm-body">{t("app.closeUnsavedBody")}</div>
            <div className="confirm-actions">
              <button type="button" className="ghost" onClick={cancelClose}>
                {t("docSwitcher.cancel")}
              </button>
              <button type="button" onClick={discardClose}>
                {t("docSwitcher.discard")}
              </button>
              <button type="button" className="primary" onClick={confirmClose}>
                {t("docSwitcher.save")}
              </button>
            </div>
          </div>
        </div>
      )}
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      <ToastHost />
    </PluginProvider>
  );
}

function EmptyState({
  onOpen,
  onOpenFolder,
  onHelp,
  recents,
  onOpenRecent,
  onRemoveRecent,
  onClearRecents,
}: {
  onOpen: () => void;
  onOpenFolder: () => void;
  onHelp: () => void;
  recents: RecentItem[];
  onOpenRecent: (item: RecentItem) => void;
  onRemoveRecent: (path: string) => void;
  onClearRecents: () => void;
}) {
  const { t } = useI18n();
  const isMac = isMacPlatform();
  return (
    <div className="empty-state">
      <div className="title">{t("app.emptyTitle")}</div>
      <div className="hint">{t("app.emptySubtitle")}</div>
      <div className="empty-actions">
        <button type="button" onClick={onOpen} className="empty-action-row">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <span className="empty-action-label">{t("app.openFile")}</span>
          <span className="empty-action-shortcut" aria-hidden="true">
            {isMac ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
              </svg>
            ) : (
              <span className="shortcut-modifier">Ctrl</span>
            )}
            <span className="shortcut-letter">O</span>
          </span>
        </button>
        <button type="button" onClick={onOpenFolder} className="empty-action-row">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="empty-action-label">{t("app.openFolder")}</span>
          <span className="empty-action-shortcut" aria-hidden="true">
            {isMac ? (
              <svg className="shortcut-key-shift" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4L4 12h6v8h4v-8h6z" />
              </svg>
            ) : (
              <span className="shortcut-modifier">Shift</span>
            )}
            {isMac ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
              </svg>
            ) : (
              <span className="shortcut-modifier">Ctrl</span>
            )}
            <span className="shortcut-letter">O</span>
          </span>
        </button>
      </div>
      <div className="hint" style={{ marginTop: "1.4rem" }}>
        {t("app.emptyHelpHint")} <button onClick={onHelp} className="text-blue-500 hover:underline" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--md-link)", padding: 0 }}>{t("app.emptyHelpLink")}</button>
      </div>
      <div className="hint" style={{ fontSize: "0.8rem", opacity: 0.7 }}>
        {t("app.supports")}
      </div>
      {recents.length > 0 && (
        <div className="recents">
          <div className="recents-header">
            <span className="recents-header-title">{t("app.recent")}</span>
            <button
              type="button"
              className="recents-clear"
              onClick={onClearRecents}
              title={t("app.recentClearAll")}
            >
              {t("app.recentClearAll")}
            </button>
          </div>
          <ul className="recents-list">
            {recents.map((item) => {
              const parentDir = item.path
                .replace(/[\\/][^\\/]*$/, "")
                .replace(/\\/g, "/");
              return (
                <li key={item.path}>
                  <button
                    type="button"
                    className="recent-item"
                    onClick={() => onOpenRecent(item)}
                    title={item.path}
                  >
                    <span className="recent-item-icon" aria-hidden="true">
                      {item.kind === "folder" ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                        </svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      )}
                    </span>
                    <span className="recent-item-body">
                      <span className="recent-item-name">{item.name}</span>
                      <span className="recent-item-path">{parentDir}</span>
                    </span>
                    <span
                      className="recent-item-remove"
                      role="button"
                      tabIndex={0}
                      title={t("app.recentRemove")}
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveRecent(item.path);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          onRemoveRecent(item.path);
                        }
                      }}
                    >
                      ×
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function UnknownState({ name }: { name: string }) {
  const { t } = useI18n();
  return (
    <div className="empty-state">
      <div className="title">{t("app.unsupportedFile")}</div>
      <div className="hint">{name}</div>
    </div>
  );
}
