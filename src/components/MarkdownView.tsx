import { useEffect, useMemo, useRef, useState } from "react";
import MarkdownIt from "markdown-it";
import type { Token, Renderer, Options } from "markdown-it/index.js";
// @ts-expect-error
import taskLists from "markdown-it-task-lists";
import anchor from "markdown-it-anchor";
import hljs from "highlight.js";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import { readFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";

interface Props {
  content: string;
  fileDir?: string;
}

interface MarkdownEnv {
  fileDir?: string;
}

const SOURCE_LINE_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "ul", "ol", "pre", "blockquote",
  "table", "hr", "li", "details",
]);

const MIME: Record<string, string> = {
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
  gif: "image/gif", svg: "image/svg+xml", webp: "image/webp",
  bmp: "image/bmp", ico: "image/x-icon",
};

function ext(name: string) {
  const i = name.lastIndexOf(".");
  return i === -1 ? "" : name.slice(i + 1).toLowerCase();
}

function cleanupRel(s: string) {
  let r = s;
  try { r = decodeURIComponent(r); } catch {}
  return r.replace(/^\.[/\\]/, "");
}

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
md.renderer.render = (tokens: Token[], options: Options, env: MarkdownEnv) => {
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

const LOCAL_IMG_RE = /src="((?!https?:|data:|blob:|asset:|file:|#|\/)[^"]+)"/g;

function bytesToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + CHUNK)));
  }
  return btoa(parts.join(""));
}

/** Read image bytes and return a data: URI */
async function imageDataUri(absPath: string): Promise<string | null> {
  try {
    const bytes = await readFile(absPath);
    const mime = MIME[ext(absPath)] || "image/png";
    return `data:${mime};base64,${bytesToBase64(bytes)}`;
  } catch {
    return null;
  }
}

export function MarkdownView({ content, fileDir }: Props) {
  const [blobs, setBlobs] = useState<Record<string, string>>({});
  const pending = useRef<Set<string>>(new Set());

  const stripped = useMemo(() => stripFrontmatter(content), [content]);
  const rawHtml = useMemo(() => md.render(stripped, { fileDir }), [stripped, fileDir]);

  // Pre-load local images as data URIs
  useEffect(() => {
    if (!fileDir) return;
    LOCAL_IMG_RE.lastIndex = 0;
    const srcs: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = LOCAL_IMG_RE.exec(rawHtml)) !== null) {
      if (!pending.current.has(m[1])) {
        pending.current.add(m[1]);
        srcs.push(m[1]);
      }
    }
    console.log("[md-img] found", srcs.length, "local images:", srcs);
    if (srcs.length === 0) return;

    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      for (const src of srcs) {
        if (cancelled) break;
        const rel = cleanupRel(src);
        const abs = await join(fileDir, rel);
        console.log("[md-img] src:", src, "→ rel:", rel, "→ abs:", abs);
        const uri = await imageDataUri(abs);
        console.log("[md-img] uri:", uri ? `${uri.slice(0, 50)}...` : "FAILED");
        if (uri) map[src] = uri;
      }
      if (!cancelled) setBlobs((prev) => ({ ...prev, ...map }));
    })();
    return () => { cancelled = true; };
  }, [rawHtml, fileDir]);

  // Substitute local images
  const html = useMemo(() => {
    if (Object.keys(blobs).length === 0) return rawHtml;
    LOCAL_IMG_RE.lastIndex = 0;
    return rawHtml.replace(LOCAL_IMG_RE, (match, src) => {
      const uri = blobs[src];
      return uri ? `src="${uri}"` : match;
    });
  }, [rawHtml, blobs]);

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
