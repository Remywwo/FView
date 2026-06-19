import { useI18n } from "@/hooks/useI18n";
import type { ChatMessage } from "../types";

export function ChatBubble({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  const isUser = message.role === "user";

  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", marginBottom: 12 }}>
      <div
        style={{
          maxWidth: "85%",
          padding: "8px 14px",
          borderRadius: 12,
          borderBottomRightRadius: isUser ? 4 : 12,
          borderBottomLeftRadius: isUser ? 12 : 4,
          background: isUser ? "var(--md-link)" : "var(--md-code-bg)",
          color: isUser ? "#fff" : "var(--md-fg)",
          fontSize: 13,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {message.error ? (
          <span style={{ color: isUser ? "rgba(255,255,255,0.85)" : "var(--md-accent)", fontStyle: "italic" }}>
            {t("ai.apiError")}: {message.error}
          </span>
        ) : (
          message.content || (message.role === "assistant" ? <span style={{ opacity: 0.4 }}>…</span> : null)
        )}
      </div>
    </div>
  );
}
