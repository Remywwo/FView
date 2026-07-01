import { useCallback, useEffect, useState } from "react";
import {
  $deleteTableColumnAtSelection,
  $deleteTableRowAtSelection,
  $findCellNode,
  $findTableNode,
  $insertTableColumnAtSelection,
  $insertTableRowAtSelection,
} from "@lexical/table";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
  mergeRegister,
} from "lexical";
import ReactDOM from "react-dom";

interface ToolbarState {
  top: number;
  left: number;
  placement: "above" | "below";
}

type TableAction =
  | "insert-row-before"
  | "insert-row-after"
  | "delete-row"
  | "insert-column-before"
  | "insert-column-after"
  | "delete-column"
  | "delete-table";

function getTableToolbarState(editorRoot: HTMLElement | null, tableElement: HTMLElement): ToolbarState | null {
  if (!editorRoot) return null;
  const tableRect = tableElement.getBoundingClientRect();
  const rootRect = editorRoot.getBoundingClientRect();
  if (tableRect.bottom < rootRect.top || tableRect.top > rootRect.bottom) return null;

  const toolbarGap = 8;
  const estimatedToolbarHeight = 34;
  const hasRoomAbove = tableRect.top - toolbarGap - estimatedToolbarHeight >= rootRect.top;

  return {
    top: hasRoomAbove ? tableRect.top - toolbarGap : tableRect.bottom + toolbarGap,
    left: Math.min(tableRect.right, rootRect.right - 8),
    placement: hasRoomAbove ? "above" : "below",
  };
}

export function TableActionPlugin() {
  const [editor] = useLexicalComposerContext();
  const [toolbarState, setToolbarState] = useState<ToolbarState | null>(null);

  const updateToolbar = useCallback(() => {
    const editorState = editor.getEditorState();
    editorState.read(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) {
        setToolbarState(null);
        return;
      }

      const anchorNode = selection.anchor.getNode();
      const tableCellNode = $findCellNode(anchorNode);
      const tableNode = tableCellNode ? $findTableNode(tableCellNode) : null;
      if (!tableNode) {
        setToolbarState(null);
        return;
      }

      const tableElement = editor.getElementByKey(tableNode.getKey());
      setToolbarState(tableElement ? getTableToolbarState(editor.getRootElement(), tableElement) : null);
    });
  }, [editor]);

  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(() => {
        updateToolbar();
      }),
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          updateToolbar();
          return false;
        },
        COMMAND_PRIORITY_LOW,
      ),
      () => setToolbarState(null),
    );
  }, [editor, updateToolbar]);

  const runAction = useCallback((action: TableAction) => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;

      const anchorNode = selection.anchor.getNode();
      const tableCellNode = $findCellNode(anchorNode);
      const tableNode = tableCellNode ? $findTableNode(tableCellNode) : null;
      if (!tableNode) return;

      switch (action) {
        case "insert-row-before":
          $insertTableRowAtSelection(false);
          break;
        case "insert-row-after":
          $insertTableRowAtSelection(true);
          break;
        case "delete-row":
          $deleteTableRowAtSelection();
          break;
        case "insert-column-before":
          $insertTableColumnAtSelection(false);
          break;
        case "insert-column-after":
          $insertTableColumnAtSelection(true);
          break;
        case "delete-column":
          $deleteTableColumnAtSelection();
          break;
        case "delete-table":
          tableNode.selectPrevious();
          tableNode.remove();
          break;
      }
    });
  }, [editor]);

  if (!toolbarState) return null;

  return ReactDOM.createPortal(
    <div
      className={`table-action-toolbar ${toolbarState.placement}`}
      style={{ top: toolbarState.top, left: toolbarState.left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      <button type="button" onClick={() => runAction("insert-row-before")} title="Insert row above">+ Row ↑</button>
      <button type="button" onClick={() => runAction("insert-row-after")} title="Insert row below">+ Row ↓</button>
      <button type="button" onClick={() => runAction("delete-row")} title="Delete row">- Row</button>
      <span className="table-action-divider" />
      <button type="button" onClick={() => runAction("insert-column-before")} title="Insert column left">+ Col ←</button>
      <button type="button" onClick={() => runAction("insert-column-after")} title="Insert column right">+ Col →</button>
      <button type="button" onClick={() => runAction("delete-column")} title="Delete column">- Col</button>
      <span className="table-action-divider" />
      <button type="button" className="danger" onClick={() => runAction("delete-table")} title="Delete table">Delete</button>
    </div>,
    document.body,
  );
}
