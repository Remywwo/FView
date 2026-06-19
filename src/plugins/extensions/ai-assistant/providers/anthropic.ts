import type { AIProvider, CompletionRequest } from "../types";

/**
 * Anthropic Messages API provider.
 *
 * Uses the native Anthropic streaming protocol, which is different
 * from the OpenAI-compatible SSE format. The `baseUrl` setting is
 * ignored — Anthropic always talks to `api.anthropic.com`.
 */
export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly baseUrl: string,
  ) {}

  async *stream(req: CompletionRequest, signal?: AbortSignal): AsyncIterable<string> {
    const system = req.system ? [{ type: "text" as const, text: req.system }] : undefined;
    const userContent = req.input ? `${req.user}\n\n---\n${req.input}\n---` : req.user;

    const url = `${this.baseUrl.replace(/\/$/, "")}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: this.model,
        system,
        messages: [{ role: "user", content: userContent }],
        max_tokens: req.maxTokens ?? 4096,
        stream: true,
      }),
      signal,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Anthropic ${response.status}: ${text.slice(0, 300)}`);
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

          try {
            const event = JSON.parse(data);
            if (event.type === "content_block_delta") {
              const text = event.delta?.text;
              if (text) yield text;
            } else if (event.type === "error") {
              throw new Error(event.error?.message ?? "Unknown Anthropic error");
            }
            // message_start / content_block_start / message_delta / ping
            // are metadata events — skip.
          } catch (err: unknown) {
            if (err instanceof Error && !(err as { code?: string }).code) {
              // Re-throw actual errors (not JSON parse failures).
              throw err;
            }
          }
        }
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  }
}
