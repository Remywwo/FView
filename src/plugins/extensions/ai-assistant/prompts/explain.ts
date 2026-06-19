import type { CompletionRequest } from "../types";

export function buildExplainPrompt(opts: {
  input: string;
  language?: string;
  detail?: "simple" | "detailed";
}): CompletionRequest {
  const lang = opts.language ?? "";
  const depth = opts.detail === "simple" ? "simply" : "in detail";

  const system = `You are a professional code explanation assistant. Explain code ${depth}: its purpose, logic, key concepts, and potential pitfalls. When relevant, mention time complexity or edge cases. Use Markdown formatting for clarity. Keep explanations accessible to intermediate developers.`;
  const user = lang
    ? `Explain the following ${lang} code:\n\n\`\`\`${lang}\n${opts.input}\n\`\`\``
    : `Explain the following code:\n\n\`\`\`\n${opts.input}\n\`\`\``;

  return { system, user, maxTokens: 2000 };
}
