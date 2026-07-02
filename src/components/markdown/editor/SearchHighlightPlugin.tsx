import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createRangeSelection,
  $getRoot,
  $isElementNode,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_LOW,
  createCommand,
  type LexicalEditor,
  type LexicalNode,
  type TextNode,
} from "lexical";

/**
 * DOM-range-driven search highlight for the active Lexical editor.
 *
 * The switcher searches markdown source for snippets, but jump/selection
 * must target the rendered editor text. Ranges are rebuilt from the live
 * ContentEditable DOM so markdown syntax does not skew the scroll target.
 *
 * Click-to-jump is exposed as a module-level imperative API so
 * DocumentSwitcher (which lives outside the editor subtree) can call
 * into the editor without prop-drilling.
 */

let activeEditor: LexicalEditor | null = null;

export function setSearchHighlightTerm(term: string | null) {
  const editor = activeEditor;
  if (!editor) return;
  editor.dispatchCommand(SET_TERM_COMMAND, term ?? "");
}

export function jumpToCharOffset(charOffset: number) {
  const editor = activeEditor;
  if (!editor) return;
  editor.dispatchCommand(JUMP_TO_OFFSET_COMMAND, String(charOffset));
}

export function jumpToSearchMatch(matchIndex: number) {
  const editor = activeEditor;
  if (!editor) return;
  editor.dispatchCommand(JUMP_TO_MATCH_COMMAND, String(matchIndex));
}

export const SET_TERM_COMMAND = createCommand<string>();
export const JUMP_TO_OFFSET_COMMAND = createCommand<string>();
export const JUMP_TO_MATCH_COMMAND = createCommand<string>();

export function SearchHighlightPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    activeEditor = editor;
    return () => {
      if (activeEditor === editor) activeEditor = null;
    };
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      SET_TERM_COMMAND,
      (payload) => {
        currentTerm = payload;
        refreshHighlights(editor);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      JUMP_TO_OFFSET_COMMAND,
      (payload) => {
        const target = Number(payload);
        if (!Number.isFinite(target)) return false;
        jumpToRenderedOffset(editor, target);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  useEffect(() => {
    return editor.registerCommand(
      JUMP_TO_MATCH_COMMAND,
      (payload) => {
        const target = Number(payload);
        if (!Number.isFinite(target)) return false;
        jumpToMatch(editor, target);
        return true;
      },
      COMMAND_PRIORITY_LOW,
    );
  }, [editor]);

  return null;
}

// ---------------------------------------------------------------------------
// Internal: term state + style-based highlighting
// ---------------------------------------------------------------------------

let currentTerm = "";
let activeRanges: Range[] = [];

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getEditorRoot(editor: LexicalEditor): HTMLElement | null {
  return editor.getRootElement();
}

function refreshHighlights(editor: LexicalEditor) {
  activeRanges = [];
  const root = getEditorRoot(editor);
  clearCssHighlight();
  if (!root || !currentTerm) return;

  activeRanges = collectRanges(root, currentTerm);
  const HighlightCtor = getHighlightConstructor();
  if (!HighlightCtor || !("highlights" in CSS)) return;

  const highlight = new HighlightCtor(...activeRanges);
  CSS.highlights.set("fview-search", highlight);
}

function clearCssHighlight() {
  if ("highlights" in CSS) {
    CSS.highlights.delete("fview-search");
  }
}

function getHighlightConstructor(): (new (...ranges: Range[]) => Highlight) | null {
  return typeof Highlight === "undefined" ? null : Highlight;
}

function collectRanges(root: HTMLElement, term: string): Range[] {
  const ranges: Range[] = [];
  const textNodes = collectTextNodes(root);
  if (!textNodes.length) return ranges;

  const fullText = textNodes.map((node) => node.nodeValue ?? "").join("");
  const re = new RegExp(escapeRegExp(term), "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(fullText)) !== null) {
    const start = locateTextPosition(textNodes, match.index);
    const end = locateTextPosition(textNodes, match.index + match[0].length);
    if (start && end) {
      const range = document.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      ranges.push(range);
    }
    if (match.index === re.lastIndex) re.lastIndex++;
  }
  return ranges;
}

function collectTextNodes(root: HTMLElement): Text[] {
  const out: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });

  let node = walker.nextNode();
  while (node) {
    out.push(node as Text);
    node = walker.nextNode();
  }
  return out;
}

function locateTextPosition(nodes: Text[], offset: number): { node: Text; offset: number } | null {
  let consumed = 0;
  for (const node of nodes) {
    const length = node.nodeValue?.length ?? 0;
    if (offset <= consumed + length) {
      return { node, offset: Math.max(0, offset - consumed) };
    }
    consumed += length;
  }
  const last = nodes[nodes.length - 1];
  return last ? { node: last, offset: last.nodeValue?.length ?? 0 } : null;
}

function jumpToMatch(editor: LexicalEditor, matchIndex: number) {
  if (!activeRanges.length) refreshHighlights(editor);
  const range = activeRanges[matchIndex];
  if (!range) return;
  selectLexicalMatch(editor, matchIndex);
  scrollRangeIntoView(range);
}

function jumpToRenderedOffset(editor: LexicalEditor, offset: number) {
  const root = getEditorRoot(editor);
  if (!root) return;
  const nodes = collectTextNodes(root);
  const pos = locateTextPosition(nodes, offset);
  if (!pos) return;
  const range = document.createRange();
  range.setStart(pos.node, pos.offset);
  range.collapse(true);
  selectLexicalRange(editor, offset, offset);
  scrollRangeIntoView(range);
}

function scrollRangeIntoView(range: Range) {
  const rect = range.getBoundingClientRect();
  const element = range.startContainer.parentElement;
  const scroller = element?.closest("[data-md-preview]") as HTMLElement | null;
  if (!scroller) {
    element?.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }

  const sr = scroller.getBoundingClientRect();
  scroller.scrollTo({
    top: rect.top - sr.top + scroller.scrollTop - 120,
    behavior: "smooth",
  });
}

function selectLexicalMatch(editor: LexicalEditor, matchIndex: number) {
  if (!currentTerm) return;

  editor.update(() => {
    const textNodes = collectLexicalTextNodes($getRoot());
    const fullText = textNodes.map((node) => node.getTextContent()).join("");
    const re = new RegExp(escapeRegExp(currentTerm), "gi");
    let currentIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = re.exec(fullText)) !== null) {
      if (currentIndex === matchIndex) {
        selectLexicalRangeInNodes(textNodes, match.index, match.index + match[0].length);
        return;
      }
      currentIndex++;
      if (match.index === re.lastIndex) re.lastIndex++;
    }
  });
  editor.focus();
}

function selectLexicalRange(editor: LexicalEditor, startOffset: number, endOffset: number) {
  editor.update(() => {
    selectLexicalRangeInNodes(collectLexicalTextNodes($getRoot()), startOffset, endOffset);
  });
  editor.focus();
}

function collectLexicalTextNodes(node: LexicalNode): TextNode[] {
  if ($isTextNode(node)) return [node];
  if (!$isElementNode(node)) return [];
  return node.getChildren().flatMap(collectLexicalTextNodes);
}

function selectLexicalRangeInNodes(nodes: TextNode[], startOffset: number, endOffset: number) {
  const start = locateLexicalTextPosition(nodes, startOffset);
  const end = locateLexicalTextPosition(nodes, endOffset);
  if (!start || !end) return;

  const selection = $createRangeSelection();
  selection.anchor.set(start.node.getKey(), start.offset, "text");
  selection.focus.set(end.node.getKey(), end.offset, "text");
  $setSelection(selection);
}

function locateLexicalTextPosition(nodes: TextNode[], offset: number): { node: TextNode; offset: number } | null {
  let consumed = 0;
  for (const node of nodes) {
    const length = node.getTextContentSize();
    if (offset <= consumed + length) {
      return { node, offset: Math.max(0, offset - consumed) };
    }
    consumed += length;
  }
  const last = nodes[nodes.length - 1];
  return last ? { node: last, offset: last.getTextContentSize() } : null;
}
