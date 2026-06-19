/**
 * Provider-agnostic AI abstraction.
 *
 * Every AI provider (OpenAI-compatible, Anthropic, etc.) implements
 * this interface so the rest of the assistant can consume it
 * without knowing which backend is active at runtime.
 */
export interface AIProvider {
  /** Short identifier, e.g. "openai-compat", "anthropic". */
  readonly id: string;
  /**
   * Request a streaming completion. Yields text deltas as they arrive.
   * Throws on transport / auth / rate-limit errors — the caller is
   * responsible for surfacing the message to the user.
   *
   * @param signal — AbortSignal for cancellation (user clicks Cancel).
   */
  stream(req: CompletionRequest, signal?: AbortSignal): AsyncIterable<string>;
}

/** A single completion request sent to the LLM. */
export interface CompletionRequest {
  system?: string;
  user: string;
  input?: string;
  maxTokens?: number;
  temperature?: number;
}

/** A message in the chat panel. */
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Set only on the assistant message that failed. */
  error?: string;
  timestamp: number;
}
