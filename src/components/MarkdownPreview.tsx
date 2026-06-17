import { useCallback, useEffect, useRef, useState } from "react";
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
import { WysiwygToc } from "@/components/WysiwygToc";

interface Props {
  file: LoadedFile;
  setContent: (s: string) => void;
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

const plugins = [
  gfm(),
  highlight(),
  frontmatter(),
  gemoji(),
  math(),
  mediumZoom(),
  mermaid(),
];

// ── ThemeSwitcher ────────────────────────────────────────────────────

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

export function MarkdownPreview({ file, setContent }: Props) {
  const { settings } = useSettings();
  const { t } = useI18n();
  const [theme, setTheme] = useState(() => localStorage.getItem(STORAGE_KEY) || "default");
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const containerRef = useRef<HTMLDivElement>(null);
  const [tocContainer, setTocContainer] = useState<HTMLElement | null>(null);

  const MODES: { key: ViewMode; label: string }[] = [
    { key: "split", label: t("md.split") },
    { key: "write", label: t("md.write") },
    { key: "preview", label: t("md.preview") },
  ];
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
        cm.setOption("lineNumbers", true);
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
          editorConfig={{ lineNumbers: true }}
          onChange={(v) => setContent(v)}
        />
        <WysiwygToc container={tocContainer} hidden={viewMode === "write"} />
      </div>
    </div>
  );
}