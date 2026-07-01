import { useEffect, useMemo, useRef } from "react";
import { CodeHighlightNode, CodeNode, registerCodeHighlighting } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertFromMarkdownString, $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import { TableCellNode, TableNode, TableRowNode } from "@lexical/table";
import type { LexicalEditor } from "lexical";
import { $getRoot } from "lexical";
import { SlashCommandPlugin } from "./SlashCommandPlugin";
import { TableActionPlugin } from "./TableActionPlugin";

export type MarkdownEditorHandle = LexicalEditor;

interface LexicalMarkdownEditorProps {
  content: string;
  onContentChange: (markdown: string) => void;
  editorRef?: React.MutableRefObject<LexicalEditor | null>;
  onEditorReady?: (editor: LexicalEditor) => void;
}

const lexicalTheme = {
  ltr: "ltr",
  rtl: "rtl",
  paragraph: "md-paragraph",
  quote: "md-quote",
  heading: {
    h1: "md-heading md-heading-h1",
    h2: "md-heading md-heading-h2",
    h3: "md-heading md-heading-h3",
    h4: "md-heading md-heading-h4",
    h5: "md-heading md-heading-h5",
    h6: "md-heading md-heading-h6",
  },
  list: {
    ul: "md-list-ul",
    ol: "md-list-ol",
    listitem: "md-list-item",
    nested: {
      listitem: "md-list-item-nested",
    },
  },
  link: "md-link",
  text: {
    bold: "md-text-bold",
    code: "md-text-code",
    italic: "md-text-italic",
    strikethrough: "md-text-strikethrough",
    underline: "md-text-underline",
  },
  code: "md-code-block",
  table: "md-table",
  tableCell: "md-table-cell",
  tableCellHeader: "md-table-cell-header",
  tableRow: "md-table-row",
};

function MarkdownSyncPlugin({
  content,
  onContentChange,
  editorRef,
  onEditorReady,
}: LexicalMarkdownEditorProps) {
  const [editor] = useLexicalComposerContext();
  const onChangeRef = useRef(onContentChange);
  const lastMarkdownRef = useRef(content);
  const applyingExternalChangeRef = useRef(false);

  onChangeRef.current = onContentChange;

  useEffect(() => {
    if (editorRef) editorRef.current = editor;
    onEditorReady?.(editor);
    return () => {
      if (editorRef?.current === editor) editorRef.current = null;
    };
  }, [editor, editorRef, onEditorReady]);

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      if (applyingExternalChangeRef.current) return;
      editorState.read(() => {
        const markdown = $convertToMarkdownString(TRANSFORMERS);
        if (markdown === lastMarkdownRef.current) return;
        lastMarkdownRef.current = markdown;
        onChangeRef.current(markdown);
      });
    });
  }, [editor]);

  useEffect(() => {
    if (content === lastMarkdownRef.current) return;
    applyingExternalChangeRef.current = true;
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      $convertFromMarkdownString(content, TRANSFORMERS);
      lastMarkdownRef.current = content;
    }, {
      onUpdate: () => {
        applyingExternalChangeRef.current = false;
      },
    });
  }, [content, editor]);

  return null;
}

function CodeHighlightPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return registerCodeHighlighting(editor);
  }, [editor]);

  return null;
}

export function useLexicalMarkdownEditor({
  content,
  onContentChange,
  editorRef,
  onEditorReady,
}: LexicalMarkdownEditorProps) {
  const initialContentRef = useRef(content);
  const initialConfig = useMemo(() => {
    return {
      namespace: "FViewMarkdownEditor",
      theme: lexicalTheme,
      nodes: [
        HeadingNode,
        QuoteNode,
        ListNode,
        ListItemNode,
        CodeNode,
        CodeHighlightNode,
        LinkNode,
        AutoLinkNode,
        TableNode,
        TableCellNode,
        TableRowNode,
      ],
      onError(error: Error) {
        console.error("[lexical] editor error:", error);
      },
      editorState: () => {
        $convertFromMarkdownString(initialContentRef.current, TRANSFORMERS);
      },
    };
  }, []);

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <RichTextPlugin
        contentEditable={
          <div
            data-md-preview=""
            className="md-prose-root"
          >
            <ContentEditable
              className="md-prose lexical-editor"
              spellCheck={false}
            />
          </div>
        }
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <TablePlugin hasCellMerge={false} />
      <TableActionPlugin />
      <CodeHighlightPlugin />
      <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
      <SlashCommandPlugin />
      <MarkdownSyncPlugin
        content={content}
        onContentChange={onContentChange}
        editorRef={editorRef}
        onEditorReady={onEditorReady}
      />
    </LexicalComposer>
  );
}
