import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/hooks/useI18n";

interface Heading {
  depth: number;
  text: string;
  id: string;
  el: HTMLElement;
}

interface SidebarOutlineProps {
  /** The container that holds the rendered headings (usually the markdown
   *  editor root). The component will scan headings inside this element. */
  container: HTMLElement | null;
  /** Ref to the scroll container used for scroll-into-view. */
  scrollContainerRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Always-visible outline (table of contents) for the markdown preview.
 * Designed to live inside the application sidebar; intentionally drops the
 * hover-drawer behaviour that the older `WysiwygToc` component implemented.
 */
export function SidebarOutline({ container, scrollContainerRef }: SidebarOutlineProps) {
  const { t } = useI18n();
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const scrollRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!container) return;
    const scan = () => {
      const hs = container.querySelectorAll<HTMLElement>(
        ".lexical-editor h1, .lexical-editor h2, .lexical-editor h3, .lexical-editor h4, .lexical-editor h5, .lexical-editor h6, .milkdown h1, .milkdown h2, .milkdown h3, .milkdown h4, .milkdown h5, .milkdown h6"
      );
      setHeadings(
        Array.from(hs).map((el) => ({
          depth: parseInt(el.tagName[1], 10),
          text: el.textContent || "",
          id: el.id,
          el,
        })),
      );
    };
    scan();
    const obs = new MutationObserver(scan);
    obs.observe(container, { childList: true, subtree: true });
    return () => obs.disconnect();
  }, [container]);

  // Resolve the scroll container — prefer explicit ref, then data-md-preview.
  const getScroller = (): HTMLElement | null => {
    if (scrollContainerRef?.current) return scrollContainerRef.current;
    return (container?.querySelector("[data-md-preview]") as HTMLElement | null)
      ?? (container?.querySelector(".bytemd-preview") as HTMLElement | null)
      ?? container;
  };

  useEffect(() => {
    if (scrollContainerRef) {
      scrollRef.current = scrollContainerRef.current;
    } else {
      scrollRef.current = getScroller();
    }
  }, [scrollContainerRef, container]);

  // Track the heading closest to the viewport top while the user scrolls.
  useEffect(() => {
    const scroller = scrollRef.current ?? getScroller();
    if (!scroller || headings.length === 0) return;
    const handler = () => {
      const scrollerTop = scroller.getBoundingClientRect().top;
      let best: Heading | null = null;
      let bestDist = Infinity;
      for (const h of headings) {
        const top = h.el.getBoundingClientRect().top;
        const dist = Math.abs(top - scrollerTop - 8);
        if (top <= scrollerTop + 32 && dist < bestDist) {
          best = h;
          bestDist = dist;
        }
      }
      if (!best) {
        for (const h of headings) {
          const top = h.el.getBoundingClientRect().top;
          if (top - scrollerTop < 32) best = h;
          else break;
        }
      }
      setActiveId(best ? best.id || null : null);
    };
    handler();
    scroller.addEventListener("scroll", handler, { passive: true });
    return () => scroller.removeEventListener("scroll", handler);
  }, [headings, container, scrollContainerRef]);

  const scrollTo = (el: HTMLElement) => {
    const scroller = scrollRef.current ?? getScroller();
    if (!scroller) return;
    const offset = el.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
    scroller.scrollBy({ top: offset - 16, behavior: "smooth" });
  };

  if (headings.length === 0) {
    return (
      <div className="sidebar-outline-empty">
        {t("md.toc")}
      </div>
    );
  }

  return (
    <ul ref={listRef} className="sidebar-outline">
      {headings.map((h) => {
        const isActive = h.id !== "" && h.id === activeId;
        return (
          <li
            key={h.id || h.text}
            className={`sidebar-outline-item depth-${h.depth}${isActive ? " is-active" : ""}`}
          >
            <button
              type="button"
              onClick={() => scrollTo(h.el)}
              title={h.text}
            >
              <span className="sidebar-outline-marker" aria-hidden="true" />
              <span className="sidebar-outline-text">{h.text}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
