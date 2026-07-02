import { useEffect } from "react";
import { version as appVersion } from "../../package.json";
import { useI18n } from "@/hooks/useI18n";
import { isMacPlatform } from "@/utils/platform";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Renders a keyboard shortcut label that adapts to the host platform.
 * Mac users see glyphs (⌘, ⇧); everyone else sees text (Ctrl, Shift).
 * The actual key binding is registered through `Mod+` in useCommands and
 * is unaffected by what label we render here.
 */
function Kbd({ mac, win }: { mac: string; win: string }) {
  return <kbd>{isMacPlatform() ? mac : win}</kbd>;
}

export function HelpModal({ open, onClose }: Props) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm p-6"
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 w-[720px] max-w-[95vw] max-h-[88vh] flex flex-col"
        style={{ background: "var(--md-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: "var(--md-border)" }}
        >
          <h2 className="text-base font-semibold flex items-center gap-2" style={{ color: "var(--md-fg)" }}>
            {t("help.title")}
            <span className="help-version">v{appVersion}</span>
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-xl leading-none"
            style={{ color: "var(--md-muted)" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-auto px-6 py-5 help-content">
          <p style={{ color: "var(--md-muted)", fontSize: "0.92em", margin: 0 }}>
            {t("help.intro")}
          </p>

          <h2>{t("help.hOpening")}</h2>
          <ol>
            <li>{t("help.liOpenFile")}</li>
            <li>{t("help.liOpenFolder")}</li>
            <li dangerouslySetInnerHTML={{ __html: t("help.liDrop") }} />
          </ol>

          <h2>{t("help.hShortcuts")}</h2>
          <h3>{t("help.hGlobal")}</h3>
          <table>
            <thead>
              <tr><th>{t("help.colShortcut")}</th><th>{t("help.colAction")}</th></tr>
            </thead>
            <tbody>
              <tr><td><Kbd mac="⌘O" win="Ctrl+O" /></td><td>{t("app.openFile")}</td></tr>
              <tr><td><Kbd mac="⇧⌘O" win="Ctrl+Shift+O" /></td><td>{t("app.openFolder")}</td></tr>
              <tr><td><Kbd mac="⌘P" win="Ctrl+P" /></td><td>{t("help.switchDoc")}</td></tr>
              <tr><td><Kbd mac="⌘F" win="Ctrl+F" /></td><td>{t("help.findInDoc")}</td></tr>
              <tr><td><Kbd mac="⌘S" win="Ctrl+S" /></td><td>{t("app.save")}</td></tr>
              <tr><td><Kbd mac="⇧⌘S" win="Ctrl+Shift+S" /></td><td>{t("app.saveAs")}</td></tr>
              <tr><td><Kbd mac="⌘W" win="Ctrl+W" /></td><td>{t("app.close")}</td></tr>
              <tr><td><Kbd mac="⌘." win="Ctrl+." /></td><td>{t("app.toggleTheme")}</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>{t("help.escClose")}</td></tr>
            </tbody>
          </table>

          <h3>{t("help.hMd")}</h3>
          <table>
            <thead>
              <tr><th>{t("help.colShortcut")}</th><th>{t("help.colAction")}</th></tr>
            </thead>
            <tbody>
              <tr><td><kbd>/</kbd></td><td>{t("help.slashCmd")}</td></tr>
            </tbody>
          </table>
          <p>{t("help.mdHint")}</p>
          <p>{t("help.mdPlugins")}</p>

          <h3>{t("help.hPdf")}</h3>
          <table>
            <thead>
              <tr><th>{t("help.colShortcut")}</th><th>{t("help.colAction")}</th></tr>
            </thead>
            <tbody>
              <tr><td><Kbd mac="⌘G" win="Ctrl+G" /></td><td>{t("pdf.gotoTitle")}</td></tr>
              <tr><td><kbd>←</kbd> / <kbd>→</kbd></td><td>{t("help.pdfPrevPage")} / {t("help.pdfNextPage")}</td></tr>
              <tr><td><kbd>PageUp</kbd> / <kbd>PageDown</kbd></td><td>{t("help.pdfPrevPage")} / {t("help.pdfNextPage")}</td></tr>
              <tr><td><kbd>↑</kbd> / <kbd>↓</kbd></td><td>{t("help.pdfScroll")}</td></tr>
              <tr><td><Kbd mac="⇧↑ / ⇧↓" win="Shift+↑ / Shift+↓" /></td><td>{t("help.pdfScrollByScreen")}</td></tr>
              <tr><td><kbd>Home</kbd> / <kbd>End</kbd></td><td>{t("help.pdfFirstLast")}</td></tr>
            </tbody>
          </table>
          <p>{t("help.pdfHint")}</p>

          <h3>{t("help.hCode")}</h3>
          <p>{t("help.codeHint")}</p>

          <h3>{t("help.hImage")}</h3>
          <p>{t("help.imageHint")}</p>

          <h3>{t("help.hAi")}</h3>
          <table>
            <thead>
              <tr><th>{t("help.colShortcut")}</th><th>{t("help.colAction")}</th></tr>
            </thead>
            <tbody>
              <tr><td><Kbd mac="⌘⇧Y" win="Ctrl+Shift+Y" /></td><td>{t("help.aiSummary")}</td></tr>
              <tr><td><Kbd mac="⌘⇧E" win="Ctrl+Shift+E" /></td><td>{t("help.aiExplain")}</td></tr>
              <tr><td><Kbd mac="⌘⇧A" win="Ctrl+Shift+A" /></td><td>{t("help.aiToggle")}</td></tr>
            </tbody>
          </table>
          <p style={{ color: "var(--md-muted)", fontSize: "0.92em" }}>
            {t("help.aiNote")}
          </p>

          <h2>{t("help.hLayout")}</h2>
          <p>{t("help.layoutP1")}</p>
          <p>{t("help.layoutP2")}</p>
          <p>{t("help.layoutP3")}</p>

          <h2>{t("help.hTypes")}</h2>
          <table>
            <thead>
              <tr><th>{t("help.colType")}</th><th>{t("help.colExtensions")}</th><th>{t("help.colEdit")}</th></tr>
            </thead>
            <tbody>
              <tr><td>{t("help.mdRow")}</td><td><code>.md</code> <code>.markdown</code> <code>.mdx</code></td><td>✓</td></tr>
              <tr><td>{t("help.codeRow")}</td><td><code>.js</code> <code>.ts</code> <code>.jsx</code> <code>.tsx</code> <code>.py</code> <code>.rs</code> <code>.go</code> <code>.java</code> <code>.c</code> <code>.cpp</code> <code>.cs</code> <code>.json</code> <code>.css</code> <code>.scss</code> <code>.yaml</code> <code>.xml</code> <code>.sh</code> <code>.sql</code> …</td><td>✓</td></tr>
              <tr><td>{t("help.htmlRow")}</td><td><code>.html</code> <code>.htm</code></td><td>{t("help.htmlEdit")}</td></tr>
              <tr><td>{t("help.textRow")}</td><td><code>.txt</code> <code>.log</code></td><td>✓</td></tr>
              <tr><td>{t("help.pdfRow")}</td><td><code>.pdf</code></td><td>{t("help.pdfEdit")}</td></tr>
              <tr><td>{t("help.imageRow")}</td><td><code>.png</code> <code>.jpg</code> <code>.jpeg</code> <code>.gif</code> <code>.webp</code> <code>.svg</code> <code>.avif</code> <code>.bmp</code> <code>.tiff</code> <code>.ico</code></td><td>{t("help.pdfEdit")}</td></tr>
              <tr><td>{t("help.docxRow")}</td><td><code>.docx</code></td><td>{t("help.pdfEdit")}</td></tr>
            </tbody>
          </table>
          <p>{t("help.unknownNote")}</p>

          <h2>{t("help.hFolder")}</h2>
          <p>{t("help.folderP1")}</p>
          <p>
            {t("help.folderP2")} <code>node_modules</code>、<code>.git</code>、<code>target</code>、<code>dist</code>、<code>build</code>、<code>out</code>、<code>.next</code>、<code>.nuxt</code>、<code>.cache</code>、<code>.parcel-cache</code>、<code>__pycache__</code>、<code>.venv</code>、<code>venv</code>。
          </p>

          <h2>{t("help.hSettings")}</h2>
          <p>{t("help.settingsP1")}</p>
          <ol>
            <li><strong>{t("settings.theme")}</strong> — {t("help.settingsLi1").replace("Theme — ", "")}</li>
            <li><strong>{t("settings.font")}</strong> — {t("help.settingsLi2").replace("Font — ", "")}</li>
            <li><strong>{t("settings.size")}</strong> — {t("help.settingsLi3").replace("Size — ", "")}</li>
            <li><strong>{t("settings.lineHeight")}</strong> — {t("help.settingsLi4").replace("Line height — ", "")}</li>
            <li><strong>{t("help.settingsLi5")}</strong></li>
          </ol>
          <p>{t("help.settingsP2")}</p>
          <p>{t("help.settingsP3")}</p>

          <h2>{t("help.hTips")}</h2>
          <ol>
            <li>{t("help.tip1")}</li>
            <li>{t("help.tip2")}</li>
            <li>{t("help.tip3")}</li>
            <li>{t("help.tip4")}</li>
            <li>{t("help.tip5")}</li>
            <li>{t("help.tip6")}</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
