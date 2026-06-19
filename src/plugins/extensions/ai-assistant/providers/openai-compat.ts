import type { AIProvider, CompletionRequest } from "../types";

/**
 * OpenAI-compatible chat completions provider.
 *
 * Works with any endpoint that speaks the `/v1/chat/completions` protocol:
 * - OpenAI
 * - Ollama (http://localhost:11434/v1)
 * - DeepSeek (https://api.deepseek.com/v1)
 * - Groq (https://api.groq.com/openai/v1)
 * - Together AI, Fireworks, etc.
 */
export class OpenAICompatProvider implements AIProvider {
  readonly id = "openai-compat";

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    private readonly model: string,
  ) {}

  async *stream(req: CompletionRequest, signal?: AbortSignal): AsyncIterable<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (req.system) {
      messages.push({ role: "system", content: req.system });
    }
    const userContent = req.input ? `${req.user}\n\n---\n${req.input}\n---` : req.user;
    messages.push({ role: "user", content: userContent });

    const url = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        max_tokens: req.maxTokens ?? 4096,
        temperature: req.temperature ?? 0.3,
      }),
      signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`API ${response.status}: ${text.slice(0, 300)}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // Skip unparseable SSE chunks.
          }
        }
      }

      // Flush remaining buffer.
      if (buffer.trim()) {
        const trimmed = buffer.trim();
        if (trimmed.startsWith("data: ") && trimmed.slice(6) !== "[DONE]") {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch { /* ignore */ }
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  }
}
