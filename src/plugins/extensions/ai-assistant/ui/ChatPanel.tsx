import { useCallback, useEffect, useRef, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useExtensionContext } from "@/hooks/usePlugin";
import { useChat } from "../hooks/useChat";
import { ChatBubble } from "./ChatBubble";
import { PresetCommands } from "./PresetCommands";
import { getPdfContext, getPdfCurrentPage } from "../pdfContext";
import type { AIProvider } from "../types";

interface Props {
  provider: () => AIProvider | null;
  onClose: () => void;
  /** Start in compact mode — only the input bar is visible. */
  compact?: boolean;
  /** Pre-filled question, auto-sent on mount. */
  initialQuestion?: string | null;
  /** When this changes, messages are cleared (e.g. file closed). */
  clearKey?: number;
}

export function ChatPanel({ provider, onClose, compact: startCompact, initialQuestion, clearKey }: Props) {
  const { t } = useI18n();
  const { host } = useExtensionContext();
  const { messages, loading, send, cancel, clear } = useChat({ provider });
  const [input, setInput] = useState("");
  const [compact, setCompact] = useState(startCompact ?? false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Clear messages when file is closed.
  useEffect(() => {
    if (clearKey && clearKey > 0) clear();
  }, [clearKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (initialQuestion) {
      setCompact(false);
      send(initialQuestion);
    } else if (!startCompact) {
      inputRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSend = useCallback(() => {
    if (!input.trim() || loading) return;
    if (compact) setCompact(false);

    // Inject file context so the AI always knows what the user is looking at.
    let system: string | undefined;
    const f = host.file.get();
    if (f) {
      const sel = host.selection.get();
      const selText = sel.markdown || sel.code || sel.html || "";

      if (f.kind === "pdf") {
        const ctx = getPdfContext(getPdfCurrentPage());
        if (ctx) {
          system = `You are reading a PDF document. Here is the structure and current page. Use this to answer:\n\n${ctx}`;
        }
      } else if (f.kind === "markdown" || f.kind === "text" || f.kind === "code") {
        const preview = f.content.slice(0, 4000);
        const lang = f.language ? ` (${f.language})` : "";
        system = `The user has a ${f.kind} file open${lang}: "${f.name}".\n\nFile content:\n${preview}${f.content.length > 4000 ? "\n…(truncated)" : ""}`;
        if (selText) {
          system += `\n\nThe user has selected this text — they may ask about it:\n\`\`\`\n${selText.slice(0, 1000)}\n\`\`\``;
        }
      }
    }

    send(input.trim(), { system });
    setInput("");
  }, [input, loading, send, compact, host]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        doSend();
      }
    },
    [doSend],
  );

  const p = provider();

  const inputBar = (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "var(--md-bg)", borderRadius: compact ? 8 : 12, padding: compact ? "6px 10px" : "8px 10px" }}>
      <textarea
        ref={inputRef}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={compact ? "Ask AI…" : t("ai.placeholder")}
        disabled={!p}
        rows={1}
        style={{ flex: 1, resize: "none", border: "none", borderRadius: 8, padding: "4px 4px", fontSize: 13, lineHeight: 1.5, background: "transparent", color: "var(--md-fg)", outline: "none", minHeight: compact ? 30 : 36, maxHeight: 120, fontFamily: "inherit" }}
        onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }}
      />
      {loading ? (
        <button onClick={cancel} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--md-border)", background: "var(--md-bg)", color: "var(--md-accent)", fontSize: 12, cursor: "pointer" }}>{t("ai.cancel")}</button>
      ) : (
        <button onClick={doSend} disabled={!input.trim() || !p} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: "none", background: input.trim() && p ? "var(--md-link)" : "var(--md-border)", color: input.trim() && p ? "#fff" : "var(--md-muted)", fontSize: 12, cursor: input.trim() && p ? "pointer" : "default" }}>{t("ai.send")}</button>
      )}
    </div>
  );

  if (compact) {
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "8px 14px 4px", flexShrink: 0 }}>
          <PresetCommands onSend={send} loading={loading} />
        </div>
        <div style={{ padding: "4px 10px 10px", flexShrink: 0 }}>{inputBar}</div>
      </div>
    );
  }

  const hasMessages = messages.length > 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: hasMessages ? "60vh" : "auto", maxHeight: "calc(100vh - 80px)", overflow: "hidden", background: "var(--md-code-bg)", borderRadius: 12 }}>
      {/* Header */}
      <div
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 14px", height: 48, flexShrink: 0,
          background: "var(--md-bg)",
          borderRadius: hasMessages ? "0 0 12px 12px" : "12px 12px 0 0",
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--md-fg)" }}>
          {t("ai.title")}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={clear} disabled={!hasMessages}
            title={t("ai.clearChat")}
            style={{ background: "none", border: "none", cursor: hasMessages ? "pointer" : "default", fontSize: 13, color: "var(--md-muted)", padding: "4px 8px", borderRadius: 4 }}
          >{t("ai.clearChat")}</button>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "var(--md-muted)", padding: "0 6px", lineHeight: 1 }}>×</button>
        </div>
      </div>

      {/* Preset commands */}
      <div style={{ padding: "8px 14px", flexShrink: 0, background: "var(--md-code-bg)" }}>
        <PresetCommands onSend={send} loading={loading} />
      </div>

      {/* Messages — only when there is content */}
      {hasMessages && (
        <div ref={listRef} style={{ flex: 1, overflow: "auto", padding: "12px 14px", minHeight: 0, background: "var(--md-bg)", borderRadius: "12px 12px 0 0" }}>
          {messages.map((msg) => <ChatBubble key={msg.id} message={msg} />)}
          {loading && <span style={{ display: "inline-block", width: 6, height: 14, background: "var(--md-link)", animation: "blink 1s step-end infinite", marginLeft: 4 }} />}
        </div>
      )}

      {/* Input */}
      <div style={{ padding: "8px 10px", flexShrink: 0, background: hasMessages ? "var(--md-code-bg)" : "var(--md-bg)", borderRadius: hasMessages ? 0 : "0 0 12px 12px" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end", background: "var(--md-bg)", borderRadius: 12, padding: "8px 10px" }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t("ai.placeholder")}
            disabled={!p}
            rows={1}
            style={{ flex: 1, resize: "none", border: "none", borderRadius: 8, padding: "4px 4px", fontSize: 13, lineHeight: 1.5, background: "transparent", color: "var(--md-fg)", outline: "none", minHeight: 36, maxHeight: 120, fontFamily: "inherit" }}
            onInput={(e) => { const el = e.currentTarget; el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 120) + "px"; }}
          />
          {loading ? (
            <button onClick={cancel} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--md-border)", background: "var(--md-bg)", color: "var(--md-accent)", fontSize: 13, cursor: "pointer" }}>{t("ai.cancel")}</button>
          ) : (
            <button onClick={doSend} disabled={!input.trim() || !p} style={{ flexShrink: 0, padding: "7px 14px", borderRadius: 8, border: "none", background: input.trim() && p ? "var(--md-link)" : "var(--md-border)", color: input.trim() && p ? "#fff" : "var(--md-muted)", fontSize: 13, cursor: input.trim() && p ? "pointer" : "default" }}>{t("ai.send")}</button>
          )}
        </div>
      </div>
    </div>
  );
}
