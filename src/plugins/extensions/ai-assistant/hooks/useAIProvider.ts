import { useMemo } from "react";
import type { AIProvider } from "../types";
import { useSettings } from "@/hooks/useSettings";
import { OpenAICompatProvider } from "../providers/openai-compat";
import { AnthropicProvider } from "../providers/anthropic";

/**
 * Returns an AIProvider instance based on the current Settings.
 *
 * Returns null when no provider is configured (aiProvider === "none"
 * or the API key is empty). The instance is memoized on the relevant
 * Settings fields so callers won't re-create the provider on every
 * keystroke.
 */
export function useAIProvider(): AIProvider | null {
  const { settings } = useSettings();

  return useMemo(() => {
    const key = (settings.aiApiKey || "").trim();
    if (settings.aiProvider === "none" || !key) return null;

    if (settings.aiProvider === "anthropic") {
      return new AnthropicProvider(
        key,
        (settings.aiModel || "claude-sonnet-4-6-20250601").trim(),
        (settings.aiBaseUrl || "https://api.anthropic.com").trim(),
      );
    }

    // openai-compat (default)
    return new OpenAICompatProvider(
      key,
      (settings.aiBaseUrl || "https://api.openai.com/v1").trim(),
      (settings.aiModel || "gpt-4o").trim(),
    );
  }, [settings.aiProvider, settings.aiApiKey, settings.aiBaseUrl, settings.aiModel]);
}
