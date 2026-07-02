import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useI18n } from "@/hooks/useI18n";
import { useRegisterCommand } from "@/hooks/useCommands";
import type { LoadedFile } from "@/hooks/useFileLoader";
import type { FolderNode } from "@/utils/scanFolder";
import type { RecentItem } from "@/hooks/useRecents";
import {
  setSearchHighlightTerm,
  jumpToSearchMatch,
} from "@/components/markdown/editor/SearchHighlightPlugin";

interface DocumentSwitcherProps {
  current: LoadedFile | null;
  folderRoot: FolderNode | null;
  recents: RecentItem[];
  /** Resolve a path. Receives the empty string to mean "close current". */
  onSelect: (path: string) => void;
  /** Persist current buffer. Returns true if saved successfully. */
  onSave: () => Promise<boolean>;
  /** Opens the in-document search bar for the current file (cmd+f). */
  onOpenSearch?: () => void;
}

interface SwitcherEntry {
  path: string;
  name: string;
  /** Optional parent directory for the "In folder" group, omitted for recents */
  parent?: string;
  kind: "file" | "folder";
  /** Lowercased haystack for fuzzy matching */
  haystack: string;
  /** When present, this entry represents a content match inside the
   * current file rather than a navigable file path. */
  hit?: ContentHit;
}

type Group = {
  key: "path" | "folder" | "recents" | "content";
  label: string;
  entries: SwitcherEntry[];
};

/** A hit inside the currently-open file's content. */
interface ContentHit {
  /** What to display — short snippet around the match. */
  snippet: string;
  /** Offset into `current.content`, used for grouping source snippets. */
  offset: number;
  /** Zero-based match order in the currently rendered document text. */
  matchIndex: number;
  /** Where the matched term starts inside the snippet. */
  matchStart: number;
  /** Where the matched term ends inside the snippet. */
  matchEnd: number;
  /** Number of additional matches on the same line (0 = only this one). */
  extraCount?: number;
}

const SCORE_EXACT = 0;
const SCORE_PREFIX = 1;
const SCORE_SUBSTRING = 2;
const SCORE_FUZZY = 3;

/**
 * Score an entry against a query. Returns null if the entry doesn't match at all.
 * Matches in order: exact > prefix > substring > subsequence (fuzzy).
 */
function scoreEntry(entry: SwitcherEntry, query: string): number | null {
  if (!query) return SCORE_EXACT;
  const q = query.toLowerCase();
  const name = entry.name.toLowerCase();
  if (name === q) return SCORE_EXACT;
  if (name.startsWith(q)) return SCORE_PREFIX;
  if (name.includes(q) || entry.haystack.includes(q)) return SCORE_SUBSTRING;
  // Subsequence fuzzy match on the name only.
  let qi = 0;
  for (let i = 0; i < name.length && qi < q.length; i++) {
    if (name[i] === q[qi]) qi++;
  }
  if (qi === q.length) return SCORE_FUZZY;
  return null;
}

function collectFiles(node: FolderNode, parent: string, out: SwitcherEntry[]): void {
  if (!node.isDir) {
    out.push({
      path: node.path,
      name: node.name,
      parent,
      kind: "file",
      haystack: (parent ? parent + " " : "") + node.name,
    });
    return;
  }
  for (const child of node.children ?? []) {
    collectFiles(child, node.path, out);
  }
}

function basename(path: string): string {
  const i = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return i >= 0 ? path.slice(i + 1) : path;
}

/**
 * Find all matches of `term` in `text` (case-insensitive) and return a
 * short snippet that always contains the entire match. Multiple matches
 * on the same line are coalesced into a single hit (with `extraCount`
 * indicating how many additional matches live there).
 */
function searchContent(text: string, term: string): ContentHit[] {
  const hits: ContentHit[] = [];
  if (!term || !text) return hits;
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(escaped, "gi");
  const MAX_SNIPPET = 48;
  const PADDING = 12;

  const seenLineStarts = new Map<number, ContentHit>();
  const lineOrder: number[] = [];
  let matchIndex = 0;

  const pushHit = (hit: ContentHit) => {
    const lineStart = text.lastIndexOf("\n", hit.offset - 1) + 1;
    const existing = seenLineStarts.get(lineStart);
    if (existing) {
      existing.extraCount = (existing.extraCount ?? 0) + 1;
      matchIndex++;
      return;
    }
    seenLineStarts.set(lineStart, hit);
    lineOrder.push(lineStart);
    matchIndex++;
  };

  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const lineStart = text.lastIndexOf("\n", m.index - 1) + 1;
    const lineEndIdx = text.indexOf("\n", m.index);
    const lineEnd = lineEndIdx === -1 ? text.length : lineEndIdx;

    const termLen = m[0].length;
    const termStart = m.index;
    const termEnd = m.index + termLen;

    let start = Math.max(lineStart, termStart - PADDING);
    let end = Math.min(lineEnd, termEnd + PADDING);

    if (end - start < MAX_SNIPPET) {
      const used = end - start;
      const remaining = MAX_SNIPPET - used;
      const roomLeft = Math.max(0, termStart - PADDING - lineStart);
      const roomRight = Math.max(0, lineEnd - (termEnd + PADDING));
      const takeLeft = Math.min(remaining / 2, roomLeft);
      const takeRight = Math.min(remaining - takeLeft, roomRight);
      start -= Math.floor(takeLeft);
      end += Math.floor(takeRight);
    }

    if (end - start > MAX_SNIPPET) {
      const extra = (end - start) - MAX_SNIPPET;
      const takeFromLeft = Math.min(extra / 2, start - lineStart);
      const takeFromRight = Math.min(extra - takeFromLeft, lineEnd - end);
      start += Math.ceil(takeFromLeft);
      end -= Math.floor(takeFromRight);
    }

    const showLeft = start > lineStart;
    const showRight = end < lineEnd;
    const raw = text.slice(start, end);
    const prefix = showLeft ? "…" : "";
    const suffix = showRight ? "…" : "";
    const snippet = prefix + raw + suffix;
    const matchStart = prefix.length + Math.max(0, termStart - start);
    const matchEnd = matchStart + termLen;

    if (matchEnd > snippet.length) {
      if (m.index === re.lastIndex) re.lastIndex++;
      continue;
    }

    pushHit({ snippet, offset: m.index, matchIndex, matchStart, matchEnd });
    if (m.index === re.lastIndex) re.lastIndex++;
  }

  return lineOrder.map((k) => seenLineStarts.get(k)!);
}

/**
 * Scroll the editor to a rendered keyword match. Matching by order avoids
 * source/DOM offset drift from Markdown formatting syntax.
 */
function scrollEditorToMatch(matchIndex: number) {
  jumpToSearchMatch(matchIndex);
}

/**
 * Toolbar pill that shows the current document path (and an "Unsaved" chip
 * when the buffer is dirty). Clicking it transforms the pill into a search
 * box with three grouped result sources: the current path, the open folder,
 * and recent files. Selecting a result while the buffer is dirty raises an
 * inline Save / Discard / Cancel prompt before switching.
 */
export function DocumentSwitcher({
  current,
  folderRoot,
  recents,
  onSelect,
  onSave,
}: DocumentSwitcherProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [pending, setPending] = useState<SwitcherEntry | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setHighlight(0);
    setPending(null);
  }, []);

  /* Outside-click / Escape-to-close */
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  /* Auto-focus input on open + reset highlight */
  useEffect(() => {
    if (open) {
      // microtask — ensure input is mounted
      queueMicrotask(() => inputRef.current?.focus());
      setHighlight(0);
    }
  }, [open]);

  /**
   * The Lexical plugin handles rendered text highlighting. We just push the
   * current term through the module-level API and clear it on panel close.
   */
  useEffect(() => {
    if (!open || current?.kind !== "markdown") { setSearchHighlightTerm(null); return; }
    const trimmed = query.trim();
    setSearchHighlightTerm(trimmed || null);
  }, [open, query, current?.kind]);

  const groups = useMemo<Group[]>(() => {
    const out: Group[] = [];

    const folderEntries: SwitcherEntry[] = [];
    if (folderRoot) collectFiles(folderRoot, "", folderEntries);
    const folderIndex = new Map<string, SwitcherEntry>();
    for (const e of folderEntries) folderIndex.set(e.path, e);

    const pathEntries: SwitcherEntry[] = [];
    if (current) {
      const name = basename(current.path || current.name);
      pathEntries.push({
        path: current.path,
        name,
        kind: "file",
        haystack: current.path.toLowerCase(),
      });
    }

    const recentEntries: SwitcherEntry[] = recents
      .filter((r) => r.kind === "file")
      .map((r) => ({
        path: r.path,
        name: r.name,
        kind: "file" as const,
        // If the path still exists in the open folder, prefer that to expose the parent.
        parent: folderIndex.get(r.path)?.parent,
        haystack: r.path.toLowerCase(),
      }));

    const score = (entry: SwitcherEntry) => scoreEntry(entry, query.trim());
    const filter = (entries: SwitcherEntry[]) =>
      entries
        .map((e) => ({ e, s: score(e) }))
        .filter((x): x is { e: SwitcherEntry; s: number } => x.s !== null)
        .sort((a, b) => a.s - b.s || a.e.name.localeCompare(b.e.name))
        .map((x) => x.e);

    const pathGroup = filter(pathEntries);
    const folderGroup = filter(folderEntries).slice(0, 12);
    const recentGroup = filter(recentEntries).slice(0, 8);

    if (pathGroup.length)
      out.push({ key: "path", label: t("docSwitcher.groupPath"), entries: pathGroup });
    if (folderGroup.length)
      out.push({ key: "folder", label: t("docSwitcher.groupFolder"), entries: folderGroup });
    if (recentGroup.length)
      out.push({ key: "recents", label: t("docSwitcher.groupRecents"), entries: recentGroup });

    // In-document content matches — only for Markdown, where the Lexical
    // search plugin can jump to rendered keyword positions.
    const trimmed = query.trim();
    if (trimmed && current && current.kind === "markdown") {
      const hits = searchContent(current.content, trimmed);
      if (hits.length) {
        out.push({
          key: "content",
          label: t("docSwitcher.groupContent"),
          entries: hits.map((hit, i) => ({
            // Synthetic unique "path" so React keys don't collide across
            // identical snippets.
            path: `__content:${i}:${hit.matchIndex}`,
            name: hit.snippet,
            kind: "file",
            parent: current.path || current.name,
            haystack: hit.snippet.toLowerCase(),
            hit,
          })),
        });
      }
    }

    return out;
  }, [current, folderRoot, recents, query, t]);

  const flatEntries = useMemo(
    () => groups.flatMap((g) => g.entries),
    [groups],
  );

  /* Clamp highlight when flatEntries shrinks */
  useEffect(() => {
    if (highlight >= flatEntries.length) setHighlight(Math.max(0, flatEntries.length - 1));
  }, [flatEntries.length, highlight]);

  /* Keep highlighted row in view */
  useEffect(() => {
    if (!open || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(
      `[data-idx="${highlight}"]`,
    );
    row?.scrollIntoView({ block: "nearest" });
  }, [highlight, open]);

  const commit = useCallback(
    async (entry: SwitcherEntry | null) => {
      if (!entry) return;

      // In-document content hit: don't switch files, scroll the editor
      // to the corresponding rendered keyword match and close the switcher.
      if (entry.hit) {
        close();
        scrollEditorToMatch(entry.hit.matchIndex);
        return;
      }

      const target = entry.path;
      const isDirty = current?.dirty ?? false;
      const samePath = current?.path && current.path === target;
      if (isDirty && !samePath) {
        setPending(entry);
        return;
      }
      close();
      if (!samePath) onSelect(target);
    },
    [current?.dirty, current?.path, onSelect, close],
  );

  const handleSaveAndCommit = useCallback(async () => {
    if (!pending) return;
    const ok = await onSave();
    const target = pending.path;
    close();
    if (ok && current?.path !== target) onSelect(target);
  }, [pending, onSave, close, onSelect, current?.path]);

  const handleDiscardAndCommit = useCallback(() => {
    if (!pending) return;
    const target = pending.path;
    close();
    if (current?.path !== target) onSelect(target);
  }, [pending, onSelect, close, current?.path]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(flatEntries.length - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const entry = flatEntries[highlight];
      if (entry) void commit(entry);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const pillPath = current?.path || current?.name || "";
  const isDirty = current?.dirty ?? false;

  /* ⌘P toggles the switcher (also accessible from the help/command palette) */
  useRegisterCommand({
    id: "doc.switcher.toggle",
    label: "Switch Document",
    shortcut: "Mod+P",
    run: () => setOpen((v) => !v),
  });

  /* ⌘F → open the switcher (the panel itself searches files + current
   * document content, replacing the old in-document search bar). */
  useRegisterCommand({
    id: "doc.switcher.search",
    label: "Search files & content",
    shortcut: "Mod+F",
    run: () => {
      setOpen(true);
      queueMicrotask(() => inputRef.current?.focus());
    },
  });

  /* Window-level fallback so other surfaces can trigger it too. */
  useEffect(() => {
    const onFocus = () => {
      setOpen(true);
      queueMicrotask(() => inputRef.current?.focus());
    };
    window.addEventListener("fview:focus-switcher", onFocus);
    return () => window.removeEventListener("fview:focus-switcher", onFocus);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`doc-switcher ${open ? "is-open" : ""}`}
      data-dirty={isDirty ? "true" : "false"}
      role="combobox"
      aria-expanded={open}
      aria-controls={open ? "doc-switcher-listbox" : undefined}
      aria-haspopup="listbox"
    >
      <div
        role="button"
        tabIndex={current ? 0 : -1}
        aria-disabled={!current}
        className="doc-switcher-pill"
        onClick={() => {
          if (!current) return;
          setOpen((v) => !v);
        }}
        onKeyDown={(e) => {
          if (!current) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
        title={t("docSwitcher.tooltip")}
      >
        <span className="doc-switcher-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </span>
        <span className="doc-switcher-path" title={pillPath}>
          {pillPath || (current?.name ?? "")}
        </span>
        {isDirty && (
          <>
            <span
              className="dirty-dot doc-switcher-dirty-dot"
              aria-hidden="true"
            >
              ●
            </span>
            <span className="doc-switcher-dirty-label">{t("app.unsaved")}</span>
          </>
        )}
      </div>

      {open && (
        <div className="doc-switcher-panel" role="dialog" aria-label={t("docSwitcher.tooltip")}>
          <div className="doc-switcher-search">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={inputRef}
              type="search"
              className="doc-switcher-input"
              placeholder={t("docSwitcher.placeholder")}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHighlight(0);
              }}
              onKeyDown={onKeyDown}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <ul
            ref={listRef}
            id="doc-switcher-listbox"
            role="listbox"
            className="doc-switcher-list"
          >
            {flatEntries.length === 0 && (
              <li className="doc-switcher-empty">{t("docSwitcher.empty")}</li>
            )}
            {(() => {
              let runningIdx = -1;
              return groups.map((group) => (
                <li key={group.key} className="doc-switcher-group">
                  <div className="doc-switcher-group-label">{group.label}</div>
                  <ul className="doc-switcher-group-items">
                    {group.entries.map((entry) => {
                      runningIdx += 1;
                      const idx = runningIdx;
                      const isCurrent = entry.path === current?.path;
                      return (
                        <li
                          key={`${group.key}:${entry.path}`}
                          data-idx={idx}
                          role="option"
                          aria-selected={idx === highlight}
                          className={`doc-switcher-item ${idx === highlight ? "is-active" : ""}`}
                          onMouseEnter={() => setHighlight(idx)}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            void commit(entry);
                          }}
                        >
                          <span className="doc-switcher-item-icon" aria-hidden="true">
                            {entry.hit ? (
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="11" cy="11" r="7" />
                                <line x1="21" y1="21" x2="16.65" y2="16.65" />
                              </svg>
                            ) : (
                              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                <polyline points="14 2 14 8 20 8" />
                              </svg>
                            )}
                          </span>
                          <span className="doc-switcher-item-body">
                            {entry.hit ? (
                              <span className="doc-switcher-item-snippet">
                                {entry.hit.snippet.slice(0, entry.hit.matchStart)}
                                <mark className="doc-switcher-item-mark">
                                  {entry.hit.snippet.slice(entry.hit.matchStart, entry.hit.matchEnd)}
                                </mark>
                                {entry.hit.snippet.slice(entry.hit.matchEnd)}
                                {entry.hit.extraCount ? (
                                  <span className="doc-switcher-item-extra">
                                    +{entry.hit.extraCount}
                                  </span>
                                ) : null}
                              </span>
                            ) : (
                              <>
                                <span className="doc-switcher-item-name">{entry.name}</span>
                                {entry.parent && (
                                  <span className="doc-switcher-item-parent" title={entry.parent}>
                                    {entry.parent}
                                  </span>
                                )}
                              </>
                            )}
                          </span>
                          {isCurrent && !entry.hit && (
                            <span className="doc-switcher-item-current" aria-hidden="true">
                              •
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ));
            })()}
          </ul>

          {pending && (
            <div className="doc-switcher-confirm" role="alertdialog" aria-modal="true">
              <div className="doc-switcher-confirm-title">
                {t("docSwitcher.unsavedTitle")}
              </div>
              <div className="doc-switcher-confirm-body">
                {t("docSwitcher.unsavedBody")}
              </div>
              <div className="doc-switcher-confirm-actions">
                <button type="button" className="primary" onClick={handleSaveAndCommit}>
                  {t("docSwitcher.save")}
                </button>
                <button type="button" onClick={handleDiscardAndCommit}>
                  {t("docSwitcher.discard")}
                </button>
                <button type="button" className="ghost" onClick={() => setPending(null)}>
                  {t("docSwitcher.cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
