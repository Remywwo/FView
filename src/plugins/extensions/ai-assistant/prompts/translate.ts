import type { CompletionRequest } from "../types";

const SYSTEM_EN = `You are a professional technical translator. Preserve all Markdown syntax exactly. Do NOT translate code inside code blocks — leave code as-is. Translate only comments inside code. Keep URLs unchanged. Use consistent terminology throughout.`;
const SYSTEM_ZH = `你是一个专业的技术翻译。严格保留所有 Markdown 语法。不翻译代码块内的代码——代码保持不变。只翻译代码内的注释。URL 不翻译。全文术语保持一致。`;

const LANG_NAME: Record<string, string> = { zh: "Simplified Chinese", en: "English" };

export function buildTranslatePrompt(opts: {
  input: string;
  targetLang: "zh" | "en";
}): CompletionRequest {
  const isZh = opts.targetLang === "zh";
  const system = isZh ? SYSTEM_ZH : SYSTEM_EN;
  const langName = LANG_NAME[opts.targetLang] ?? opts.targetLang;
  const user = isZh
    ? `将以下内容翻译为简体中文：\n\n${opts.input}`
    : `Translate the following into ${langName}:\n\n${opts.input}`;

  return { system, user, maxTokens: 4000 };
}
