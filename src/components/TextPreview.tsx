import type { LoadedFile } from "@/hooks/useFileLoader";
import { useSettings, getFontStack } from "@/hooks/useSettings";
import { useI18n } from "@/hooks/useI18n";

export function TextPreview({ file }: { file: LoadedFile }) {
  const { settings } = useSettings();
  const { t } = useI18n();
  const lines = file.content.split(/\r?\n/);
  const fontStack = getFontStack(settings.fontFamily);
  return (
    <div className="flex flex-col h-full">
      <div className="toolbar">
        <span className="file-info">{file.content.length.toLocaleString()} chars · {lines.length.toLocaleString()} lines</span>
        <div className="spacer" />
        <span className="file-info">{t("text.readOnly")}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto" style={{ background: "var(--md-bg)" }}>
        <pre
          className="m-0 px-6 py-4"
          style={{
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontFamily: fontStack,
            fontSize: `${settings.fontSize}px`,
            lineHeight: settings.lineHeight,
            color: "var(--md-fg)",
          }}
        >
          {file.content}
        </pre>
      </div>
    </div>
  );
}
