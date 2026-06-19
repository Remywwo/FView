import { useCallback, useRef, useState } from "react";
import { nanoid } from "nanoid";
import type { AIProvider, ChatMessage } from "../types";

interface UseChatOpts {
  /** A thunk that returns the current AI provider (or null). */
  provider: () => AIProvider | null;
}

interface UseChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  send: (userInput: string, opts?: { system?: string; input?: string }) => Promise<void>;
  cancel: () => void;
  clear: () => void;
}

export function useChat({ provider }: UseChatOpts): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (userInput: string, opts?: { system?: string; input?: string }) => {
      const controller = new AbortController();
      abortRef.current = controller;

      const userMsg: ChatMessage = {
        id: nanoid(),
        role: "user",
        content: userInput,
        timestamp: Date.now(),
      };
      const aiMsg: ChatMessage = {
        id: nanoid(),
        role: "assistant",
        content: "",
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg, aiMsg]);
      setLoading(true);

      try {
        const p = provider();
        if (!p) throw new Error("No AI provider configured");

        for await (const chunk of p.stream(
          { system: opts?.system, user: userInput, input: opts?.input },
          controller.signal,
        )) {
          aiMsg.content += chunk;
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsg.id ? { ...m, content: aiMsg.content } : m)),
          );
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — drop the incomplete assistant message.
          setMessages((prev) => prev.filter((m) => m.id !== aiMsg.id));
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        aiMsg.error = message;
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsg.id ? { ...m, error: message } : m)),
        );
      } finally {
        setLoading(false);
        abortRef.current = null;
      }
    },
    [provider],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, loading, send, cancel, clear };
}
