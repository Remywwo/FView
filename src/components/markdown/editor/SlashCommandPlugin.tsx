import { useCallback, useMemo, useState } from "react";
import { $createCodeHighlightNode, $createCodeNode } from "@lexical/code";
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from "@lexical/list";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  type MenuTextMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, $createQuoteNode } from "@lexical/rich-text";
import { INSERT_TABLE_COMMAND } from "@lexical/table";
import {
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  type LexicalNode,
  type TextNode,
} from "lexical";
import ReactDOM from "react-dom";

type SlashCommandId =
  | "paragraph"
  | "heading-1"
  | "heading-2"
  | "heading-3"
  | "quote"
  | "bullet-list"
  | "number-list"
  | "inline-code"
  | "code-block"
  | "table"
  | "image"
  | "math";

interface SlashCommand {
  id: SlashCommandId;
  title: string;
  description: string;
  keywords: string[];
}

class SlashCommandOption extends MenuOption {
  command: SlashCommand;

  constructor(command: SlashCommand) {
    super(command.id);
    this.command = command;
  }
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "paragraph",
    title: "Text",
    description: "Plain paragraph",
    keywords: ["p", "paragraph", "text", "正文", "段落"],
  },
  {
    id: "heading-1",
    title: "Heading 1",
    description: "Large section heading",
    keywords: ["h1", "title", "heading", "标题", "一级标题"],
  },
  {
    id: "heading-2",
    title: "Heading 2",
    description: "Medium section heading",
    keywords: ["h2", "subtitle", "heading", "标题", "二级标题"],
  },
  {
    id: "heading-3",
    title: "Heading 3",
    description: "Small section heading",
    keywords: ["h3", "heading", "标题", "三级标题"],
  },
  {
    id: "quote",
    title: "Quote",
    description: "Call out quoted text",
    keywords: ["quote", "blockquote", "引用"],
  },
  {
    id: "bullet-list",
    title: "Bulleted List",
    description: "Start an unordered list",
    keywords: ["ul", "bullet", "list", "无序列表", "列表"],
  },
  {
    id: "number-list",
    title: "Numbered List",
    description: "Start an ordered list",
    keywords: ["ol", "number", "list", "有序列表", "列表"],
  },
  {
    id: "inline-code",
    title: "Inline Code",
    description: "Insert code inside the current line",
    keywords: ["inline", "code", "codespan", "行内代码", "代码"],
  },
  {
    id: "code-block",
    title: "Code Block",
    description: "Insert a fenced code block",
    keywords: ["block", "code", "pre", "fence", "代码", "代码块"],
  },
  {
    id: "table",
    title: "Table",
    description: "Insert a 3 x 3 table",
    keywords: ["table", "grid", "表格"],
  },
  {
    id: "image",
    title: "Image",
    description: "Insert markdown image syntax",
    keywords: ["image", "img", "picture", "图片", "图像"],
  },
  {
    id: "math",
    title: "Math",
    description: "Insert display math syntax",
    keywords: ["math", "latex", "formula", "公式", "数学"],
  },
];

function getSlashCommandMatch(text: string): MenuTextMatch | null {
  const match = /(^|\s)\/([^\s/]*)$/.exec(text);
  if (!match) return null;

  const leading = match[1] ?? "";
  const matchingString = match[2] ?? "";
  const replaceableString = `/${matchingString}`;

  return {
    leadOffset: match.index + leading.length,
    matchingString,
    replaceableString,
  };
}

function createBlockNode(commandId: SlashCommandId): LexicalNode | null {
  switch (commandId) {
    case "paragraph":
      return $createParagraphNode();
    case "heading-1":
      return $createHeadingNode("h1");
    case "heading-2":
      return $createHeadingNode("h2");
    case "heading-3":
      return $createHeadingNode("h3");
    case "quote":
      return $createQuoteNode();
    case "code-block":
      return $createCodeNode().append($createCodeHighlightNode(""));
    case "image":
      return $createParagraphNode().append($createTextNode("![alt](path/to/image.png)"));
    case "math":
      return $createParagraphNode().append($createTextNode("$$\n\n$$"));
    default:
      return null;
  }
}

function removeSlashQuery(textNodeContainingQuery: TextNode | null) {
  if (textNodeContainingQuery?.isAttached()) {
    textNodeContainingQuery.remove();
  }
}

function insertInlineCode(textNodeContainingQuery: TextNode | null) {
  const codeText = $createTextNode("code");
  codeText.toggleFormat("code");

  if (textNodeContainingQuery?.isAttached()) {
    textNodeContainingQuery.replace(codeText);
  } else {
    const selection = $getSelection();
    if (!$isRangeSelection(selection)) return;
    selection.insertNodes([codeText]);
  }

  codeText.select(0, codeText.getTextContentSize());
}

function insertBlock(commandId: SlashCommandId, textNodeContainingQuery: TextNode | null) {
  removeSlashQuery(textNodeContainingQuery);
  const node = createBlockNode(commandId);
  if (!node) return;

  const selection = $getSelection();
  if ($isRangeSelection(selection)) {
    selection.insertNodes([node]);
    node.selectStart();
  }
}

export function SlashCommandPlugin() {
  const [editor] = useLexicalComposerContext();
  const [query, setQuery] = useState<string | null>(null);

  const options = useMemo(() => {
    const normalizedQuery = (query ?? "").trim().toLowerCase();
    const commands = normalizedQuery
      ? SLASH_COMMANDS.filter((command) => {
          const haystack = [
            command.title,
            command.description,
            ...command.keywords,
          ].join(" ").toLowerCase();
          return haystack.includes(normalizedQuery);
        })
      : SLASH_COMMANDS;

    return commands.slice(0, 8).map((command) => new SlashCommandOption(command));
  }, [query]);

  const onSelectOption = useCallback((
    selectedOption: SlashCommandOption,
    textNodeContainingQuery: TextNode | null,
    closeMenu: () => void,
  ) => {
    const commandId = selectedOption.command.id;

    if (commandId === "inline-code") {
      insertInlineCode(textNodeContainingQuery);
    } else if (commandId === "table") {
      removeSlashQuery(textNodeContainingQuery);
      editor.dispatchCommand(INSERT_TABLE_COMMAND, {
        columns: "3",
        rows: "3",
        includeHeaders: {
          rows: true,
          columns: false,
        },
      });
    } else if (commandId === "bullet-list") {
      removeSlashQuery(textNodeContainingQuery);
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    } else if (commandId === "number-list") {
      removeSlashQuery(textNodeContainingQuery);
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    } else {
      insertBlock(commandId, textNodeContainingQuery);
    }

    closeMenu();
  }, [editor]);

  return (
    <LexicalTypeaheadMenuPlugin<SlashCommandOption>
      onQueryChange={setQuery}
      onSelectOption={onSelectOption}
      options={options}
      triggerFn={getSlashCommandMatch}
      commandPriority={COMMAND_PRIORITY_LOW}
      anchorClassName="slash-command-anchor"
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) => {
        if (anchorElementRef.current === null || options.length === 0) return null;

        return ReactDOM.createPortal(
          <div className="slash-command-menu">
            {options.map((option, index) => (
              <button
                key={option.key}
                ref={option.setRefElement}
                type="button"
                className={`slash-command-item${selectedIndex === index ? " active" : ""}`}
                onMouseEnter={() => setHighlightedIndex(index)}
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectOptionAndCleanUp(option);
                }}
              >
                <span className="slash-command-title">{option.command.title}</span>
                <span className="slash-command-description">{option.command.description}</span>
              </button>
            ))}
          </div>,
          anchorElementRef.current,
        );
      }}
    />
  );
}
