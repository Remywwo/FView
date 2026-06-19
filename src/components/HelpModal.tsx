import { useEffect } from "react";
import { useI18n } from "@/hooks/useI18n";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function HelpModal({ open, onClose }: Props) {
  const { t, lang } = useI18n();

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
          <h2 className="text-base font-semibold" style={{ color: "var(--md-fg)" }}>
            {lang === "zh" ? "FView Power — 使用说明" : "FView Power — User Guide"}
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
          <ul>
            <li>{t("help.liOpenFile")}</li>
            <li>{t("help.liOpenFolder")}</li>
            <li dangerouslySetInnerHTML={{ __html: t("help.liDrop") }} />
          </ul>

          <h2>{t("help.hShortcuts")}</h2>
          <h3>{t("help.hGlobal")}</h3>
          <table>
            <thead>
              <tr><th>Shortcut</th><th>{lang === "zh" ? "动作" : "Action"}</th></tr>
            </thead>
            <tbody>
              <tr><td><kbd>⌘O</kbd></td><td>{t("app.openFile")}</td></tr>
              <tr><td><kbd>⇧⌘O</kbd></td><td>{t("app.openFolder")}</td></tr>
              <tr><td><kbd>⌘S</kbd></td><td>{t("app.save")}</td></tr>
              <tr><td><kbd>⇧⌘S</kbd></td><td>{t("app.saveAs")}</td></tr>
              <tr><td><kbd>⌘W</kbd></td><td>{t("app.close")}</td></tr>
              <tr><td><kbd>⌘.</kbd></td><td>{t("app.toggleTheme")}</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>{lang === "zh" ? "关闭任何弹窗 / 菜单" : "Close any open dialog / menu"}</td></tr>
            </tbody>
          </table>

          <h3>{t("help.hMd")}</h3>
          <table>
            <thead>
              <tr><th>Shortcut</th><th>{lang === "zh" ? "动作" : "Action"}</th></tr>
            </thead>
            <tbody>
              <tr><td><kbd>⌘P</kbd></td><td>{lang === "zh" ? "切换视图：Split → Write → Preview" : "Cycle view: Split → Write → Preview"}</td></tr>
            </tbody>
          </table>
          <p>{t("help.mdHint")}</p>
          <p>{t("help.mdPlugins")}</p>

          <h3>{t("help.hPdf")}</h3>
          <table>
            <thead>
              <tr><th>Shortcut</th><th>{lang === "zh" ? "动作" : "Action"}</th></tr>
            </thead>
            <tbody>
              <tr><td><kbd>⌘G</kbd></td><td>{t("pdf.gotoTitle")}</td></tr>
              <tr><td><kbd>←</kbd> / <kbd>→</kbd></td><td>{t("pdf.prevTitle")} / {t("pdf.nextTitle")}</td></tr>
              <tr><td><kbd>PageUp</kbd> / <kbd>PageDown</kbd></td><td>{t("pdf.prevTitle")} / {t("pdf.nextTitle")}</td></tr>
              <tr><td><kbd>↑</kbd> / <kbd>↓</kbd></td><td>{lang === "zh" ? "滚动当前视图（画布或目录）" : "Scroll the hovered view (canvas or outline)"}</td></tr>
              <tr><td><kbd>Shift</kbd> + <kbd>↑</kbd> / <kbd>↓</kbd></td><td>{lang === "zh" ? "按一屏滚动" : "Scroll by one screen"}</td></tr>
              <tr><td><kbd>Home</kbd> / <kbd>End</kbd></td><td>{lang === "zh" ? "第一页 / 最后一页" : "First / last page"}</td></tr>
            </tbody>
          </table>
          <p>{t("help.pdfHint")}</p>

          <h3>{t("help.hAi")}</h3>
          <table>
            <thead>
              <tr><th>Shortcut</th><th>{lang === "zh" ? "动作" : "Action"}</th></tr>
            </thead>
            <tbody>
              <tr><td><kbd>⌘⇧Y</kbd></td><td>{lang === "zh" ? "AI：总结文档 / 选中内容" : "AI: Summarize document / selection"}</td></tr>
              <tr><td><kbd>⌘⇧E</kbd></td><td>{lang === "zh" ? "AI：解释代码" : "AI: Explain code"}</td></tr>
            </tbody>
          </table>
          <p style={{ color: "var(--md-muted)", fontSize: "0.92em" }}>
            {lang === "zh"
              ? "AI 助手仅支持 Markdown 和 PDF 文件。打开这两种文件时，AI 会自动读取文档内容和结构（PDF 的目录、当前页文本），无需手动粘贴。工具栏的 ✨ AI 按钮可以随时打开面板；PDF 打开时面板会自动以紧凑模式展示在底部。"
              : "AI Assistant supports Markdown and PDF files only. When viewing these file types, the AI automatically reads the document content and structure (PDF outlines, current page text) — no need to copy-paste. Click ✨ AI in the toolbar to open the panel; it auto-appears in compact mode when viewing a PDF."}
          </p>

          <h2>{t("help.hTypes")}</h2>
          <table>
            <thead>
              <tr><th>{lang === "zh" ? "类型" : "Type"}</th><th>{lang === "zh" ? "扩展名" : "Extensions"}</th><th>{lang === "zh" ? "编辑" : "Edit"}</th></tr>
            </thead>
            <tbody>
              <tr><td>{t("help.mdRow")}</td><td><code>.md</code> <code>.markdown</code> <code>.mdx</code></td><td>✓</td></tr>
              <tr><td>{t("help.codeRow")}</td><td><code>.js</code> <code>.ts</code> <code>.jsx</code> <code>.tsx</code> <code>.py</code> <code>.rs</code> <code>.go</code> <code>.java</code> <code>.c</code> <code>.cpp</code> <code>.cs</code> <code>.json</code> <code>.css</code> <code>.scss</code> <code>.yaml</code> <code>.xml</code> <code>.sh</code> <code>.sql</code> …</td><td>✓</td></tr>
              <tr><td>{t("help.htmlRow")}</td><td><code>.html</code> <code>.htm</code></td><td>{t("help.htmlEdit")}</td></tr>
              <tr><td>{t("help.textRow")}</td><td><code>.txt</code> <code>.log</code></td><td>✓</td></tr>
              <tr><td>{t("help.pdfRow")}</td><td><code>.pdf</code></td><td>{t("help.pdfEdit")}</td></tr>
              <tr><td>{t("help.imageRow")}</td><td><code>.png</code> <code>.jpg</code> <code>.jpeg</code> <code>.gif</code> <code>.webp</code> <code>.svg</code> <code>.avif</code> <code>.bmp</code> <code>.tiff</code> <code>.ico</code></td><td>{t("help.pdfEdit")}</td></tr>
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
          <ul>
            <li><strong>{t("settings.theme")}</strong> — {t("help.settingsLi1").replace("Theme — ", "")}</li>
            <li><strong>{t("settings.font")}</strong> — {t("help.settingsLi2").replace("Font — ", "")}</li>
            <li><strong>{t("settings.size")}</strong> — {t("help.settingsLi3").replace("Size — ", "")}</li>
            <li><strong>{t("settings.lineHeight")}</strong> — {t("help.settingsLi4").replace("Line height — ", "")}</li>
            <li><strong>{t("help.settingsLi5")}</strong></li>
          </ul>
          <p>{t("help.settingsP2")}</p>
          <p>{t("help.settingsP3")}</p>

          <h2>{t("help.hTips")}</h2>
          <ul>
            <li>{t("help.tip1")}</li>
            <li>{t("help.tip2")}</li>
            <li>{t("help.tip3")}</li>
            <li>{t("help.tip4")}</li>
            <li>{t("help.tip5")}</li>
            <li>{t("help.tip6")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
