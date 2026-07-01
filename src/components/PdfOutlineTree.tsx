import { useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import type { PdfOutlineNode } from "@/components/PdfOutlineDrawer";

interface Props {
  outline: PdfOutlineNode[] | null;
  currentPage: number;
  onJump: (page: number) => void;
  loading?: boolean;
}

/**
 * Sidebar-friendly PDF outline tree. Renders the same outline data that
 * `PdfOutlineDrawer` used to show in a floating drawer, but as a plain
 * scrollable list designed to live inside the sidebar's Outline tab.
 */
export function PdfOutlineTree({ outline, currentPage, onJump, loading }: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (!outline) return new Set();
    return new Set(outline.map((n) => n.id));
  });

  useEffect(() => {
    if (outline) setExpanded(new Set(outline.map((n) => n.id)));
  }, [outline]);

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activeId = findActiveOutlineId(outline, currentPage);

  const renderNodes = (nodes: PdfOutlineNode[], depth: number): JSX.Element => (
    <ul className="pdf-outline-list">
      {nodes.map((node) => {
        const isExpanded = expanded.has(node.id);
        const hasChildren = node.items.length > 0;
        const isActive = node.id === activeId;
        const hasPage = node.page !== null;
        return (
          <li key={node.id}>
            <div
              className={`pdf-outline-row${isActive ? " is-active" : ""}${!hasPage ? " is-disabled" : ""}`}
              style={{ paddingLeft: `${0.5 + depth * 0.7}rem` }}
            >
              {hasChildren ? (
                <button
                  className="pdf-outline-toggle"
                  onClick={() => toggle(node.id)}
                  aria-label={isExpanded ? "Collapse" : "Expand"}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
                    style={{ transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}
                  >
                    <polyline points="9 6 15 12 9 18" />
                  </svg>
                </button>
              ) : (
                <span className="pdf-outline-toggle-spacer" />
              )}
              <button
                type="button"
                className={`pdf-outline-link${hasPage ? "" : " no-page"}`}
                title={node.title}
                disabled={!hasPage}
                onClick={() => hasPage && onJump(node.page!)}
              >
                <span className="pdf-outline-title">{node.title}</span>
                {hasPage && <span className="pdf-outline-page">{node.page}</span>}
              </button>
            </div>
            {hasChildren && isExpanded && renderNodes(node.items, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <div className="pdf-outline">
      {loading && <div className="sidebar-outline-empty">{t("pdf.loadingOutline")}</div>}
      {!loading && (outline === null || outline.length === 0) && (
        <div className="sidebar-outline-empty">{t("pdf.noOutline")}</div>
      )}
      {!loading && outline && outline.length > 0 && renderNodes(outline, 0)}
    </div>
  );
}

function findActiveOutlineId(outline: PdfOutlineNode[] | null, currentPage: number): string | null {
  if (!outline) return null;
  let result: string | null = null;
  const walk = (nodes: PdfOutlineNode[]) => {
    for (const node of nodes) {
      if (node.page !== null && node.page > currentPage) continue;
      if (node.page !== null) result = node.id;
      walk(node.items);
    }
  };
  walk(outline);
  return result;
}
