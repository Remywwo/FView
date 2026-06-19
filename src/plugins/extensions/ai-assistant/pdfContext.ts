import type { PdfOutlineNode } from "@/components/PdfOutlineDrawer";

/**
 * Module-level cache so PdfPreview can push page text and outline,
 * and the AI prompts can read them without wiring props through the
 * entire component tree.
 */

let pageTexts: Map<number, string> = new Map();
let outline: PdfOutlineNode[] | null = null;
let totalPages = 0;
let currentPage = 1;

export function setPdfPageText(page: number, text: string) {
  pageTexts.set(page, text);
}

export function setPdfOutline(nodes: PdfOutlineNode[] | null) {
  outline = nodes;
}

export function setPdfTotalPages(n: number) {
  totalPages = n;
}

export function setCurrentPdfPage(n: number) {
  currentPage = n;
}

export function clearPdfContext() {
  pageTexts = new Map();
  outline = null;
  totalPages = 0;
  currentPage = 1;
}

/** Get text for a specific page. */
export function getPageText(page: number): string {
  return pageTexts.get(page) ?? "";
}

/**
 * Get text for a range of pages, joined with page number markers.
 */
export function getPageRangeText(from: number, to: number): string {
  const parts: string[] = [];
  for (let p = from; p <= to; p++) {
    const t = pageTexts.get(p);
    if (t) parts.push(`[Page ${p}]\n${t}`);
  }
  return parts.join("\n\n");
}

/**
 * Get text for the pages covered by an outline node (best-effort).
 * Returns a concatenated string of all pages between this node's
 * start and the next sibling's start (or end of document).
 */
export function getChapterText(node: PdfOutlineNode): string {
  const start = resolveOutlinePage(node);
  const end = resolveOutlineEndPage(node);
  return getPageRangeText(start, end);
}

/** Build a human-readable outline string for AI context. */
export function getOutlineSummary(): string {
  if (!outline || outline.length === 0) return "";
  const lines: string[] = [`PDF has ${totalPages} pages. Outline:`];
  const walk = (nodes: PdfOutlineNode[], depth: number) => {
    for (const n of nodes) {
      const p = resolveOutlinePage(n);
      const prefix = "  ".repeat(depth) + "- ";
      lines.push(`${prefix}${n.title} (page ${p})`);
      if (n.items && n.items.length > 0) walk(n.items, depth + 1);
    }
  };
  walk(outline, 0);
  return lines.join("\n");
}

export function getPdfCurrentPage(): number {
  return currentPage;
}

/** Build full PDF context for AI prompts. */
export function getPdfContext(page: number): string {
  const parts: string[] = [];

  const outlineStr = getOutlineSummary();
  if (outlineStr) parts.push(outlineStr);

  const pageText = getPageText(currentPage);
  if (pageText) {
    parts.push(`\nCurrent page (${currentPage}) text:\n${pageText.slice(0, 3000)}`);
  }

  return parts.join("\n");
}

/** Find the starting page number for an outline node. */
function resolveOutlinePage(node: PdfOutlineNode): number {
  return node.page ?? 1;
}

/** Find the end page of an outline node (start of next sibling or end of doc). */
function resolveOutlineEndPage(node: PdfOutlineNode): number {
  const siblings = outline ?? [];
  const idx = siblings.indexOf(node);
  if (idx >= 0 && idx < siblings.length - 1) {
    return resolveOutlinePage(siblings[idx + 1]) - 1;
  }
  return totalPages;
}
