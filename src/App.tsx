import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readDir, stat } from "@tauri-apps/plugin-fs";
import { useFileLoader } from "@/hooks/useFileLoader";
import { useFolder } from "@/hooks/useFolder";
import { useTheme } from "@/hooks/useTheme";
import { useI18n } from "@/hooks/useI18n";
import { useSettings } from "@/hooks/useSettings";
import { useCommand, useCommandContext } from "@/hooks/useCommands";
import { setEditorSelection } from "@/hooks/useSelection";
import { createHostAPI, type ConcreteHostAPI } from "@/plugins/host";
import { PluginProvider } from "@/hooks/usePlugin";
import { DropZone } from "@/components/DropZone";
import { MarkdownPreview } from "@/components/MarkdownPreview";
import { CodePreview } from "@/components/CodePreview";
import { HtmlPreview } from "@/components/HtmlPreview";
import { PdfPreview } from "@/components/PdfPreview";
import { ImagePreview } from "@/components/ImagePreview";
import { TextPreview } from "@/components/TextPreview";
import { SettingsModal } from "@/components/SettingsModal";
import { HelpModal } from "@/components/HelpModal";
import { FolderTree } from "@/components/FolderTree";
import { Slot } from "@/components/Slot";
import { ToastHost } from "@/components/ToastHost";
import { builtInExtensions } from "@/plugins/extensions";

export default function App() {
  const loader = useFileLoader();
  const folder = useFolder();
  const theme = useTheme();
  const i18n = useI18n();
  const settingsCtx = useSettings();
  const commandCtx = useCommandContext();
  const { t } = i18n;
  const { current, setContent, loadFromPath, error } = loader;
  const { isDark } = theme;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [openMenuOpen, setOpenMenuOpen] = useState(false);
  const openMenuRef = useRef<HTMLDivElement>(null);

  // Toolbar / menu actions are wired through the centralized command
  // system so that plugins can intercept or extend them later.
  const cmdOpen = useCommand("file.open");
  const cmdSave = useCommand("file.save");
  const cmdSaveAs = useCommand("file.saveAs");
  const cmdClose = useCommand("file.close");
  const cmdOpenFolder = useCommand("folder.openFolder");

  // ── Plugin HostAPI ────────────────────────────────────────────────
  // Construct a stable host object that plugins can consume. The host
  // captures the latest loader/folder/theme/i18n/settings via refs so
  // its identity never changes — plugins re-render only when they
  // explicitly subscribe to a slice.
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
        resolveCommand: (id) => commandCtx.getCommand(id),
        registerCommand: commandCtx.register,
      }),
    // Intentionally empty — host is stable; captured refs read latest values.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

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
      // stat failed — unknown type. Use readDir as definitive directory test.
      try {
        await readDir(path);
        await folder.setFolderPath(path);
      } catch {
        await loadFromPath(path);
      }
    }
  }, [folder, loadFromPath]);

  // Close open menu on outside click or Esc
  useEffect(() => {
    if (!openMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (openMenuRef.current && !openMenuRef.current.contains(e.target as Node)) {
        setOpenMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [openMenuOpen]);

  // Extensions get a stable array reference so PluginProvider doesn't
  // re-activate them on every render.
  const extensions = useMemo(() => builtInExtensions, []);

  return (
    <PluginProvider host={host} extensions={extensions}>
      <div className="flex flex-col h-full">
        <div className="toolbar">
        <div className="open-menu" ref={openMenuRef}>
          <button
            onClick={() => setOpenMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={openMenuOpen}
            title={t("app.openFile") + " / " + t("app.openFolder")}
          >
            {t("app.open")}
          </button>
          {openMenuOpen && (
            <div className="dropdown-menu" role="menu">
              <button
                className="dropdown-item"
                role="menuitem"
                onClick={() => { setOpenMenuOpen(false); cmdOpen(); }}
              >
                <svg className="dropdown-item-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span className="dropdown-item-label">{t("app.openFile")}</span>
                <span className="dropdown-item-shortcut" aria-hidden="true">
                  <svg className="shortcut-key" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
                  </svg>
                  <span className="shortcut-letter">O</span>
                </span>
              </button>
              <button
                className="dropdown-item"
                role="menuitem"
                onClick={() => { setOpenMenuOpen(false); cmdOpenFolder(); }}
              >
                <svg className="dropdown-item-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="dropdown-item-label">{t("app.openFolder")}</span>
                <span className="dropdown-item-shortcut" aria-hidden="true">
                  <svg className="shortcut-key shortcut-key-shift" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 4L4 12h6v8h4v-8h6z" />
                  </svg>
                  <svg className="shortcut-key" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
                  </svg>
                  <span className="shortcut-letter">O</span>
                </span>
              </button>
            </div>
          )}
        </div>
        <button onClick={cmdSave} disabled={!current?.isEditable || !current?.dirty} title={`${t("app.save")} (⌘S)`}>{t("app.save")}</button>
        <button onClick={cmdSaveAs} disabled={!current?.isEditable} title={`${t("app.saveAs")} (⇧⌘S)`}>{t("app.saveAs")}</button>
          <button onClick={cmdClose} disabled={!current} title={`${t("app.close")} (⌘W)`}>{t("app.close")}</button>
        <div style={{ flex: 1, textAlign: "right" }}>
        {current && <span className="file-info">{current.path || current.name}</span>}
        {current?.dirty && <span className="dirty-dot" title="Unsaved changes">●</span>}
                 </div>
        <button onClick={() => setHelpOpen(true)} title={t("app.help")} className="flex items-center justify-center p-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </button>
        <button onClick={() => setSettingsOpen(true)} title={t("app.settings")} className="flex items-center justify-center p-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
        {/* Plugin injection point — empty when no plugin contributes. */}
        <Slot name="toolbar-end" />
      </div>

      <div className="flex-1 min-h-0 flex">
        {folder.root && (
          <FolderTree
            root={folder.root}
            selectedPath={current?.path ?? null}
            onSelectFile={loadFromPath}
            onClose={() => { folder.close(); cmdClose(); }}
            onRefresh={folder.refresh}
            onCreateFile={folder.createFile}
            onCreateFolder={folder.createFolder}
            onDeleteItem={(path) => {
              folder.deleteItem(path);
              if (current?.path === path) cmdClose();
            }}
            onRenameItem={folder.renameItem}
            loading={folder.loading}
            error={folder.error}
          />
        )}
        <div className="flex-1 min-h-0 relative">
          {!current && !folder.root && (
            <EmptyState
              onOpen={cmdOpen}
              onOpenFolder={() => cmdOpenFolder()}
              onHelp={() => setHelpOpen(true)}
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
            <MarkdownPreview file={current} setContent={setContent} onSelectionChange={(t) => setEditorSelection("markdown", t)} />
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
            <PdfPreview file={current} />
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

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      </div>
      <ToastHost />
    </PluginProvider>
  );
}

function EmptyState({ onOpen, onOpenFolder, onHelp }: { onOpen: () => void; onOpenFolder: () => void; onHelp: () => void }) {
  const { t } = useI18n();
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
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
            </svg>
            <span className="shortcut-letter">O</span>
          </span>
        </button>
        <button type="button" onClick={onOpenFolder} className="empty-action-row">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="empty-action-label">{t("app.openFolder")}</span>
          <span className="empty-action-shortcut" aria-hidden="true">
            <svg className="shortcut-key-shift" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4L4 12h6v8h4v-8h6z" />
            </svg>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z" />
            </svg>
            <span className="shortcut-letter">O</span>
          </span>
        </button>
      </div>
      <div className="hint" style={{ marginTop: "1.4rem" }}>
        {t("app.emptyHelpHint")} <button onClick={onHelp} className="text-blue-500 hover:underline" style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--md-link)", padding: 0 }}>{t("app.emptyHelpLink")}</button>
      </div>
      <div className="hint" style={{ marginTop: "2rem", fontSize: "0.8rem", opacity: 0.7 }}>
        {t("app.supports")}
      </div>
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
