import type { CompletionRequest } from "../types";

export type SummarizeKind = "document" | "selection" | "pdfPage";

const SYSTEM_EN = "You are a professional document summarization assistant. Be concise, accurate, and neutral. Extract the core points without adding external knowledge.";
const SYSTEM_ZH = "你是一个专业的文档总结助手。回答简洁、准确、中立。提取核心要点，不引入外部知识。";

const LENGTH_HINTS: Record<string, { en: string; zh: string }> = {
  brief: { en: "in 1-2 sentences", zh: "用 1-2 句话" },
  standard: { en: "with 3-5 bullet points", zh: "用 3-5 个 bullet points" },
  detailed: { en: "as a structured paragraph summary", zh: "作为结构化的段落总结" },
};

export function buildSummarizePrompt(
  kind: SummarizeKind,
  opts: { input: string; targetLang: "zh" | "en"; length?: "brief" | "standard" | "detailed" },
): CompletionRequest {
  const isZh = opts.targetLang === "zh";
  const system = isZh ? SYSTEM_ZH : SYSTEM_EN;
  const hint = LENGTH_HINTS[opts.length ?? "standard"];

  let user: string;
  switch (kind) {
    case "document":
      user = isZh
        ? `请${hint.zh}总结以下文档：\n\n${opts.input}`
        : `Summarize the following document ${hint.en}:\n\n${opts.input}`;
      break;
    case "selection":
      user = isZh
        ? `请解释/总结以下选中的内容：\n\n${opts.input}`
        : `Explain or summarize the following selection:\n\n${opts.input}`;
      break;
    case "pdfPage":
      user = isZh
        ? `这是 PDF 文档中的一页内容。请总结这一页的核心信息：\n\n${opts.input}`
        : `This is a page from a PDF. Summarize its key points:\n\n${opts.input}`;
      break;
  }

  return { system, user, maxTokens: 1500 };
}
