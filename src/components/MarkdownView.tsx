// @ts-expect-error - no type definitions for markdown-it-task-lists
import taskLists from "markdown-it-task-lists";
import { useMemo } from "react";
import MarkdownIt from "markdown-it";
import type { Token } from "markdown-it/index.js";
import anchor from "markdown-it-anchor";
import hljs from "highlight.js";
import { open as openExternal } from "@tauri-apps/plugin-shell";

interface Props {
  content: string;
}

const SOURCE_LINE_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "ul", "ol", "pre", "blockquote",
  "table", "hr", "li", "details",
]);

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(str: string, lang: string): string {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return `<pre class="hljs"><code>${hljs.highlight(str, { language: lang, ignoreIllegals: true }).value}</code></pre>`;
      } catch {}
    }
    return `<pre class="hljs"><code>${md.utils.escapeHtml(str)}</code></pre>`;
  },
})
  .use(taskLists, { enabled: true, label: true, labelAfter: true })
  .use(anchor, { permalink: false, slugify: (s: string) => s.toLowerCase().replace(/\s+/g, "-") });

const defaultRender = md.renderer.render.bind(md.renderer);
md.renderer.render = (tokens: Token[], options: object, env: object) => {
  for (const t of tokens) {
    if (t.type.endsWith("_open") && t.tag && SOURCE_LINE_TAGS.has(t.tag) && t.map) {
      t.attrSet("data-source-line", String(t.map[0]));
    }
  }
  return defaultRender(tokens, options, env);
};

function stripFrontmatter(s: string): string {
  return s.replace(/^---\n[\s\S]*?\n---\n?/, "");
}

export function MarkdownView({ content }: Props) {
  const html = useMemo(() => {
    const stripped = stripFrontmatter(content);
    return md.render(stripped);
  }, [content]);

  return (
    <div
      className="prose"
      onClick={(e) => {
        const a = (e.target as HTMLElement).closest("a");
        if (!(a instanceof HTMLAnchorElement)) return;
        const href = a.getAttribute("href") || "";
        if (href.startsWith("http://") || href.startsWith("https://")) {
          e.preventDefault();
          openExternal(href);
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
