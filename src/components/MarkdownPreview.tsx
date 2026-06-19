import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Editor } from "@bytemd/react";
import gfm from "@bytemd/plugin-gfm";
import highlight from "@bytemd/plugin-highlight";
import frontmatter from "@bytemd/plugin-frontmatter";
import gemoji from "@bytemd/plugin-gemoji";
import math from "@bytemd/plugin-math";
import mediumZoom from "@bytemd/plugin-medium-zoom";
import mermaid from "@bytemd/plugin-mermaid";
import "bytemd/dist/index.css";
import "katex/dist/katex.min.css";
import type { LoadedFile } from "@/hooks/useFileLoader";
import { useSettings, getFontStack } from "@/hooks/useSettings";
import { useI18n } from "@/hooks/useI18n";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import { convertFileSrc } from "@tauri-apps/api/core";
import { WysiwygToc } from "@/components/WysiwygToc";
import type { BytemdPlugin } from "bytemd";

const zhLocale = {
  bold: "粗体", boldText: "粗体文本",
  cheatsheet: "Markdown 速查表", closeHelp: "关闭帮助", closeToc: "关闭目录",
  code: "行内代码", codeBlock: "代码块", codeLang: "语言", codeText: "代码",
  exitFullscreen: "退出全屏", exitPreviewOnly: "退出仅预览", exitWriteOnly: "退出仅编辑",
  fullscreen: "全屏",
  h1: "标题 1", h2: "标题 2", h3: "标题 3", h4: "标题 4", h5: "标题 5", h6: "标题 6",
  headingText: "标题", help: "帮助", hr: "分割线",
  image: "图片", imageAlt: "替代文本", imageTitle: "标题",
  italic: "斜体", italicText: "斜体文本",
  limited: "已达到最大字符限制", lines: "行",
  link: "链接", linkText: "链接文本",
  ol: "有序列表", olItem: "项目",
  preview: "预览", previewOnly: "仅预览",
  quote: "引用", quotedText: "引用文本",
  shortcuts: "快捷键", source: "源码", sync: "滚动同步",
  toc: "目录", top: "回到顶部",
  ul: "无序列表", ulItem: "项目",
  words: "字", write: "编辑", writeOnly: "仅编辑",
  // GFM plugin
  strike: "删除线", strikeText: "删除线文本",
  table: "表格", tableHeading: "表头",
  task: "任务列表", taskText: "任务",
  // Math plugin
  inline: "行内公式", inlineText: "公式",
  block: "块级公式", blockText: "公式",
  // Mermaid plugin
  mermaid: "Mermaid 图表",
  flowchart: "流程图", sequence: "时序图", class: "类图",
  state: "状态图", er: "ER 图", gantt: "甘特图",
  pie: "饼图", mindmap: "思维导图", timeline: "时间线", uj: "用户旅程图",
};

interface Props {
  file: LoadedFile;
  setContent: (s: string) => void;
  /**
   * Optional callback invoked whenever the editor selection changes.
   * Receives the selected text, or an empty string when the selection
   * is collapsed. Used by the plugin system to expose selection state.
   */
  onSelectionChange?: (text: string) => void;
}

// ── themes ───────────────────────────────────────────────────────────

const THEMES = [
  "default",
  "juejin", "github", "smartblue", "vuepress", "channing-cyan",
  "arknights", "awesome-green", "Chinese-red", "condensed-night-purple",
  "cyanosis", "devui-blue", "fancy", "geek-black", "greenwillow",
  "healer-readable", "hydrogen", "jzman", "keepnice", "koi",
  "lilsnake", "minimalism", "mk-cute", "nico", "orange",
  "qklhk-chocolate", "scrolls-light", "serene-rose", "simplicity-green",
  "v-green", "vue-pro", "yu", "z-blue",
] as const;

const STORAGE_KEY = "fview-md-theme";

function loadTheme(name: string) {
  const id = "md-theme-link";
  const existing = document.getElementById(id) as HTMLLinkElement | null;
  if (existing) {
    if (existing.dataset.theme === name) return;
    existing.remove();
  }
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `/themes/${name}.min.css`;
  link.dataset.theme = name;
  document.head.appendChild(link);
}

// ── plugins ──────────────────────────────────────────────────────────

// ── mode button ──────────────────────────────────────────────────────

function ThemeSwitcher({ value, onChange, label }: { value: string; onChange: (t: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (listRef.current?.contains(e.target as Node)) return;
      if (triggerRef.current?.contains(e.target as Node)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  const select = (t: string) => { onChange(t); close(); };

  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: "var(--md-muted)", fontSize: 14, whiteSpace: "nowrap" }}>{label}</span>
      <button
        ref={triggerRef}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          background: "var(--md-bg)", color: "var(--md-fg)",
          border: "1px solid var(--md-border)", borderRadius: 4,
          padding: "4px 8px", fontSize: 14, cursor: "pointer",
          minWidth: 130, justifyContent: "space-between",
        }}
      >
        <span>{value}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" stroke="var(--md-muted)" strokeWidth="1.5">
          <path d="M1 1l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div
          ref={listRef}
          style={{
            position: "absolute", top: "100%", left: 0, marginTop: 4, zIndex: 50,
            background: "var(--md-bg)", border: "1px solid var(--md-border)",
            borderRadius: 6, boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            maxHeight: 360, overflow: "auto", minWidth: 150,
            padding: "4px 0",
          }}
        >
          {THEMES.map((t) => (
            <div
              key={t}
              onClick={() => select(t)}
              style={{
                padding: "5px 12px", cursor: "pointer", fontSize: 14,
                color: t === value ? "var(--md-link)" : "var(--md-fg)",
                background: t === value ? "var(--md-code-bg)" : "transparent",
              }}
              onMouseEnter={(e) => { if (t !== value) (e.target as HTMLElement).style.background = "var(--md-code-bg)"; }}
              onMouseLeave={(e) => { if (t !== value) (e.target as HTMLElement).style.background = "transparent"; }}
            >
              {t}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── mode button ──────────────────────────────────────────────────────

type ViewMode = "split" | "write" | "preview";

// ── MarkdownPreview ──────────────────────────────────────────────────

export function MarkdownPreview({ file, setContent, onSelectionChange }: Props) {
  const { settings } = useSettings();
  const { t, lang } = useI18n();
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || "default");
  const [viewMode, setViewMode] = useState<ViewMode>("preview");
  const containerRef = useRef<HTMLDivElement>(null);
  const [tocContainer, setTocContainer] = useState<HTMLElement | null>(null);

  const editorConfig = useMemo(() => ({}), []);
  const locale = useMemo(() => (lang === "zh" ? zhLocale : undefined), [lang]);
  const fileDir = useMemo(() => file.path.replace(/[\\/][^\\/]*$/, ""), [file.path]);

  const localImagePlugin = useMemo((): BytemdPlugin => ({
    rehype: (processor) => processor.use(() => (tree: any) => {
      function walk(node: any) {
        if (node.tagName === "img" && node.properties?.src) {
          const src: string = String(node.properties.src || "");
          // Skip absolute URLs, data URIs, asset:// — leave them for the browser
          if (!src || /^(https?:|data:|asset:|\/)/.test(src)) return;
          try {
            let rel = src;
            try { rel = decodeURIComponent(rel); } catch {}
            rel = rel.replace(/^\.[/\\]/, "");
            const sep = fileDir.includes("\\") ? "\\" : "/";
            const abs = rel.split(/[\\/]/).reduce((a, s) => a + sep + s, fileDir);
            node.properties.src = convertFileSrc(abs);
          } catch { /* leave src unchanged on error */ }
        }
        if (node.children) for (const c of node.children) walk(c);
      }
      walk(tree);
    }),
  }), [fileDir]);

  const plugins = useMemo(() => [
    gfm(), highlight(), frontmatter(), gemoji(), math(), mediumZoom(), mermaid(),
    localImagePlugin,
  ], [localImagePlugin]);

  const MODES: { key: ViewMode; label: string }[] = [
    { key: "preview", label: t("md.preview") },
    { key: "write", label: t("md.write") },
    { key: "split", label: t("md.split") },
  ];
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const refresh = () => {
      const cm = (el.querySelector(".CodeMirror") as any)?.CodeMirror;
      cm?.refresh();
    };
    const t1 = setTimeout(refresh, 100);
    const t2 = setTimeout(refresh, 500);
    window.addEventListener("resize", refresh);
    return () => {
      clearTimeout(t1); clearTimeout(t2);
      window.removeEventListener("resize", refresh);
    };
  }, [fileDir]);

  useEffect(() => {
    if (viewMode !== "write" && viewMode !== "split") return;
    const el = containerRef.current;
    if (!el) return;
    // CodeMirror may be invisible during mode switch — refresh after layout
    setTimeout(() => {
      const cm = (el.querySelector(".CodeMirror") as any)?.CodeMirror;
      cm?.refresh();
    }, 50);
  }, [viewMode]);

  // ── Active line highlight (CodeMirror 5 may lack the addon) ──────────

  const activeLineRef = useRef<any>(null);
  // Keep the latest onSelectionChange in a ref so the cursorActivity
  // listener (registered once) always invokes the freshest callback
  // without needing to re-bind on every render.
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new MutationObserver(() => {
      const cm = (el.querySelector(".CodeMirror") as any)?.CodeMirror;
      if (!cm || activeLineRef.current === cm) return;
      // Clean up old instance
      if (activeLineRef.current) {
        activeLineRef.current.off("cursorActivity");
      }
      activeLineRef.current = cm;
      // Highlight current line on cursor activity, and report selection.
      const mark = () => {
        const cur = cm.getCursor();
        if (activeLineRef.current._activeLine)
          cm.removeLineClass(activeLineRef.current._activeLine, "background", "activeline");
        activeLineRef.current._activeLine = cm.addLineClass(cur.line, "background", "activeline");
        // Report selection state to the host (PR3a).
        const cb = onSelectionChangeRef.current;
        if (cb) cb(cm.getSelection() ?? "");
      };
      cm.on("cursorActivity", mark);
      mark();
    });
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // Load theme CSS
  useEffect(() => {
    loadTheme(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // ── Hide ByteMD's Write / Preview Only toolbar icons ────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new MutationObserver(() => {
      for (const btn of el.querySelectorAll<HTMLElement>(".bytemd-toolbar-icon[title]")) {
        const t = btn.getAttribute("title") || "";
        if (t === "Write only" || t === "Preview only") {
          btn.style.display = "none";
        }
      }
    });
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // ── Increase CodeMirror viewport margin + enable line numbers ──────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new MutationObserver(() => {
      const cm = (el.querySelector(".CodeMirror") as any)?.CodeMirror;
      if (cm) {
        if (cm.defaults && cm.defaults.viewportMargin < 500) {
          cm.defaults.viewportMargin = 500;
        }
        observer.disconnect();
      }
    });
    observer.observe(el, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  // ── Open preview links in default browser ────────────────────────────

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>(".markdown-body a");
      if (!a) return;
      const href = a.getAttribute("href") || "";
      if (href.startsWith("http://") || href.startsWith("https://")) {
        e.preventDefault();
        e.stopPropagation();
        openExternal(href);
      }
    };
    el.addEventListener("click", onClick);
    return () => el.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    const id = "md-font-style";
    const existing = document.getElementById(id);
    if (existing) existing.remove();
    const fontFamily = getFontStack(settings.fontFamily) || settings.fontFamily;
    const style = document.createElement("style");
    style.id = id;
    style.textContent = `
      .bytemd .CodeMirror,
      .bytemd .markdown-body { font-size: ${settings.fontSize}px; font-family: ${fontFamily}; line-height: ${settings.lineHeight}; }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(id);
      if (el) el.remove();
    };
  }, [settings.fontSize, settings.fontFamily, settings.lineHeight]);

  // View mode → CSS class on container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.classList.remove("md-write", "md-preview");
    if (viewMode === "write") el.classList.add("md-write");
    else if (viewMode === "preview") el.classList.add("md-preview");
  }, [viewMode]);

  return (
    <div className="flex flex-col" style={{ position: "absolute", inset: 0 }}>
      {/* top bar: mode buttons + theme */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "0.5rem 1rem", borderBottom: "1px solid var(--md-border)",
        background: "var(--md-bg)", flexShrink: 0, minHeight: 48,
      }}>
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setViewMode(m.key)}
            className={viewMode === m.key ? "md-mode-btn md-mode-btn-active" : "md-mode-btn"}
          >
            {m.label}
          </button>
        ))}
        <ThemeSwitcher value={theme} onChange={setTheme} label={t("md.theme")} />
      </div>

      {/* ByteMD editor fills remaining space */}
      <div ref={(el) => { (containerRef as any).current = el; setTocContainer(el); }} className="flex-1" style={{ position: "relative", minHeight: 0 }}>
         <Editor
          value={file.content}
          plugins={plugins}
          editorConfig={editorConfig}
          locale={locale}
          onChange={(v) => setContent(v)}
        />
        <WysiwygToc container={tocContainer} hidden={viewMode === "write"} />
      </div>
    </div>
  );
}