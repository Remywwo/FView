/**
 * Build a context-aware system prompt for the chat session.
 *
 * Injects information about the currently open file and any active
 * selection so the model can reference them without the user having
 * to re-paste.
 */
export function buildChatSystemPrompt(context: {
  fileName?: string;
  fileKind?: string;
  hasSelection: boolean;
  selectionText?: string;
}): string {
  const lines: string[] = [
    "You are an AI assistant embedded inside FView, a desktop file viewer and editor.",
    "You help users understand, summarize, translate, and work with their files.",
    "Be concise, helpful, and neutral. Use Markdown formatting when it improves readability.",
  ];

  if (context.fileName) {
    const kind = context.fileKind ? ` (${context.fileKind})` : "";
    lines.push(`\nThe user currently has a file open: "${context.fileName}"${kind}.`);
  }

  if (context.hasSelection && context.selectionText) {
    const preview = context.selectionText.length > 2000
      ? context.selectionText.slice(0, 2000) + "\n… (truncated)"
      : context.selectionText;
    lines.push(`\nThe user has selected the following text — they may ask about it without re-pasting:\n\`\`\`\n${preview}\n\`\`\``);
  }

  return lines.join("\n");
}
