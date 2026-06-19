import { useI18n } from "@/hooks/useI18n";
import { useSettings } from "@/hooks/useSettings";
import { useExtensionContext } from "@/hooks/usePlugin";
import type { ConcreteHostAPI } from "@/plugins/host";
import { buildSummarizePrompt } from "../prompts/summarize";
import { buildTranslatePrompt } from "../prompts/translate";
import { buildExplainPrompt } from "../prompts/explain";

interface Props {
  onSend: (userInput: string, opts?: { system?: string; input?: string }) => void;
  loading: boolean;
}

export function PresetCommands({ onSend, loading }: Props) {
  const { t } = useI18n();
  const { host } = useExtensionContext();
  const concrete = host as ConcreteHostAPI;
  const { settings } = useSettings();

  const targetLang = settings.aiTargetLang === "auto"
    ? (concrete.i18n.lang() === "zh" ? "zh" : "en")
    : settings.aiTargetLang;

  const disabled = loading;

  const commands = [
    {
      label: t("ai.summarizeDoc"),
      action: () => {
        const file = concrete.file.get();
        if (!file) { concrete.notify("No file open", "warn"); return; }
        const req = buildSummarizePrompt("document", { input: file.content, targetLang });
        onSend(req.user, { system: req.system });
      },
    },
    {
      label: t("ai.summarizeSelection"),
      action: () => {
        const sel = concrete.selection.get();
        const text = sel.markdown || sel.code || sel.html;
        if (!text) { concrete.notify("No selection", "warn"); return; }
        const req = buildSummarizePrompt("selection", { input: text, targetLang });
        onSend(req.user, { system: req.system });
      },
    },
    {
      label: t("ai.translate"),
      action: () => {
        const file = concrete.file.get();
        const sel = concrete.selection.get();
        const text = (sel.markdown || sel.code || sel.html) || file?.content;
        if (!text) { concrete.notify("No file or selection", "warn"); return; }
        const req = buildTranslatePrompt({ input: text.slice(0, 8000), targetLang });
        onSend(req.user, { system: req.system });
      },
    },
    {
      label: t("ai.explain"),
      action: () => {
        const sel = concrete.selection.get();
        const text = sel.code || sel.markdown;
        const file = concrete.file.get();
        if (!text) { concrete.notify("Select some code first", "warn"); return; }
        const req = buildExplainPrompt({ input: text, language: file?.language });
        onSend(req.user, { system: req.system });
      },
    },
  ];

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {commands.map((cmd) => (
        <button
          key={cmd.label}
          onClick={cmd.action}
          disabled={disabled}
          style={{
            fontSize: 11,
            padding: "4px 12px",
            borderRadius: 14,
            border: "1px solid var(--md-border)",
            background: disabled ? "var(--md-code-bg)" : "var(--md-bg)",
            color: disabled ? "var(--md-muted)" : "var(--md-fg)",
            cursor: disabled ? "default" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          {cmd.label}
        </button>
      ))}
    </div>
  );
}
