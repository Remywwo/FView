import { useEffect, useState } from "react";
import {
  FONT_FAMILIES,
  LINE_HEIGHTS,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  useSettings,
  type FontFamily,
  type FontSize,
  type LineHeight,
} from "@/hooks/useSettings";
import { useTheme } from "@/hooks/useTheme";
import { useI18n, type Lang } from "@/hooks/useI18n";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: Props) {
  const { settings, update, reset } = useSettings();
  const { isDark, setDark } = useTheme();
  const { lang, setLang, t } = useI18n();
  const [sizeInput, setSizeInput] = useState(String(settings.fontSize));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    setSizeInput(String(settings.fontSize));
  }, [settings.fontSize]);

  if (!open) return null;

  const commitSize = (raw: string) => {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n >= MIN_FONT_SIZE && n <= MAX_FONT_SIZE) {
      update({ fontSize: n as FontSize });
    } else {
      setSizeInput(String(settings.fontSize));
    }
  };

  const liveSize = (() => {
    const n = parseInt(sizeInput, 10);
    return Number.isFinite(n) && n >= MIN_FONT_SIZE && n <= MAX_FONT_SIZE ? n : settings.fontSize;
  })();
  const chevron = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20' fill='%236b7280'><path fill-rule='evenodd' d='M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z' clip-rule='evenodd'/></svg>\")";

  const localizedFonts = FONT_FAMILIES.map((f) => ({
    ...f,
    label: localizedFontLabel(f.value, t),
  }));
  const localizedHeights = LINE_HEIGHTS.map((h) => ({
    ...h,
    label: localizedHeightLabel(h.value, t),
  }));
  const currentStack = localizedFonts.find((f) => f.value === settings.fontFamily)?.stack
    ?? FONT_FAMILIES.find((f) => f.value === settings.fontFamily)?.stack;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-6 w-[460px] max-w-[92vw]"
        style={{ background: "var(--md-bg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold" style={{ color: "var(--md-fg)" }}>
            {t("settings.title")}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-xl leading-none"
            style={{ color: "var(--md-muted)" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="mb-5">
          <label
            className="block text-xs font-medium mb-2 uppercase tracking-wide"
            style={{ color: "var(--md-muted)" }}
          >
            {t("settings.language")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setLang("en")}
              className={
                "px-3 py-2.5 rounded-md border text-sm transition-colors " +
                (lang === "en"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800")
              }
              style={{ color: lang === "en" ? "var(--md-link)" : "var(--md-fg)" }}
            >
              English
            </button>
            <button
              onClick={() => setLang("zh")}
              className={
                "px-3 py-2.5 rounded-md border text-sm transition-colors " +
                (lang === "zh"
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800")
              }
              style={{ color: lang === "zh" ? "var(--md-link)" : "var(--md-fg)" }}
            >
              中文
            </button>
          </div>
        </div>

        <div className="mb-5">
          <label
            className="block text-xs font-medium mb-2 uppercase tracking-wide"
            style={{ color: "var(--md-muted)" }}
          >
            {t("settings.theme")}
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setDark(false)}
              className={
                "px-3 py-2.5 rounded-md border text-sm transition-colors flex items-center justify-center gap-2 " +
                (!isDark
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800")
              }
              style={{ color: !isDark ? "var(--md-link)" : "var(--md-fg)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="4" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
              </svg>
              {t("settings.themeLight")}
            </button>
            <button
              onClick={() => setDark(true)}
              className={
                "px-3 py-2.5 rounded-md border text-sm transition-colors flex items-center justify-center gap-2 " +
                (isDark
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                  : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800")
              }
              style={{ color: isDark ? "var(--md-link)" : "var(--md-fg)" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              {t("settings.themeDark")}
            </button>
          </div>
        </div>

        <div className="mb-5">
          <label
            htmlFor="fview-font-select"
            className="block text-xs font-medium mb-2 uppercase tracking-wide"
            style={{ color: "var(--md-muted)" }}
          >
            {t("settings.font")}
          </label>
          <select
            id="fview-font-select"
            value={settings.fontFamily}
            onChange={(e) => update({ fontFamily: e.target.value as FontFamily })}
            className="w-full appearance-none cursor-pointer rounded-md border border-gray-200 dark:border-gray-700 pl-3 pr-9 py-2.5 text-sm transition-colors hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{
              background: "var(--md-bg)",
              color: "var(--md-fg)",
              fontFamily: currentStack,
              backgroundImage: chevron,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.65rem center",
              backgroundSize: "1.1em 1.1em",
            }}
          >
            {localizedFonts.map(({ value, label, stack }) => (
              <option key={value} value={value} style={{ fontFamily: stack, background: "var(--md-bg)", color: "var(--md-fg)" }}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-5">
          <label
            htmlFor="fview-size-input"
            className="block text-xs font-medium mb-2 uppercase tracking-wide"
            style={{ color: "var(--md-muted)" }}
          >
            {t("settings.size")}
          </label>
          <div className="flex items-center gap-2">
            <input
              id="fview-size-input"
              type="number"
              min={MIN_FONT_SIZE}
              max={MAX_FONT_SIZE}
              step={1}
              value={sizeInput}
              onChange={(e) => setSizeInput(e.target.value)}
              onBlur={(e) => commitSize(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitSize(sizeInput);
                  e.currentTarget.blur();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setSizeInput("");
                  e.currentTarget.blur();
                }
              }}
              className="w-24 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{
                background: "var(--md-bg)",
                color: "var(--md-fg)",
              }}
            />
            <span className="text-sm" style={{ color: "var(--md-muted)" }}>
              px
            </span>
            <span className="text-xs ml-auto" style={{ color: "var(--md-muted)" }}>
              {MIN_FONT_SIZE}–{MAX_FONT_SIZE}
            </span>
          </div>
        </div>

        <div className="mb-5">
          <label
            htmlFor="fview-lineheight-select"
            className="block text-xs font-medium mb-2 uppercase tracking-wide"
            style={{ color: "var(--md-muted)" }}
          >
            {t("settings.lineHeight")}
          </label>
          <select
            id="fview-lineheight-select"
            value={settings.lineHeight}
            onChange={(e) => update({ lineHeight: parseFloat(e.target.value) as LineHeight })}
            className="w-full appearance-none cursor-pointer rounded-md border border-gray-200 dark:border-gray-700 pl-3 pr-9 py-2.5 text-sm transition-colors hover:border-gray-300 dark:hover:border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{
              background: "var(--md-bg)",
              color: "var(--md-fg)",
              backgroundImage: chevron,
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.65rem center",
              backgroundSize: "1.1em 1.1em",
            }}
          >
            {localizedHeights.map(({ value, label }) => (
              <option key={value} value={value} style={{ background: "var(--md-bg)", color: "var(--md-fg)" }}>
                {label} ({value})
              </option>
            ))}
          </select>
        </div>

        <div
          className="rounded-md border p-3"
          style={{
            background: "var(--md-code-bg)",
            borderColor: "var(--md-border)",
            color: "var(--md-fg)",
            fontSize: `${liveSize}px`,
            fontFamily: currentStack,
            lineHeight: settings.lineHeight,
          }}
        >
          The quick brown fox jumps over the lazy dog.
        </div>

        <p
          className="text-xs mt-4 leading-relaxed"
          style={{ color: "var(--md-muted)" }}
        >
          {t("settings.scopeNote")} <strong>{t("settings.scopeNoteBold")}</strong> {t("settings.scopeNoteAnd")} <strong>{t("settings.scopeNoteBold2")}</strong> {t("settings.scopeNoteRest")}
        </p>

        <div
          className="flex items-center justify-between mt-5 pt-4"
          style={{ borderTop: "1px solid var(--md-border)" }}
        >
          <button
            onClick={reset}
            className="text-xs px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
            style={{ color: "var(--md-muted)" }}
          >
            {t("settings.reset")}
          </button>
          <button
            onClick={onClose}
            className="text-sm px-4 py-1.5 rounded-md bg-blue-500 hover:bg-blue-600 text-white"
          >
            {t("settings.done")}
          </button>
        </div>
      </div>
    </div>
  );
}

function localizedFontLabel(value: FontFamily, t: (k: string) => string): string {
  switch (value) {
    case "system": return t("settings.fontSystem");
    case "sans": return t("settings.fontSans");
    case "serif": return t("settings.fontSerif");
    case "mono": return t("settings.fontMono");
    case "system-ui": return t("settings.fontSystemUI");
    case "humanist": return t("settings.fontHumanist");
    case "georgia": return t("settings.fontGeorgia");
    case "menlo": return t("settings.fontMenlo");
    case "newspaper": return t("settings.fontNewspaper");
    case "rounded": return t("settings.fontRounded");
  }
}

function localizedHeightLabel(value: number, t: (k: string) => string): string {
  if (value <= 1.4) return t("settings.lhCompact");
  if (value <= 1.55) return t("settings.lhDefault");
  if (value <= 1.7) return t("settings.lhComfortable");
  if (value <= 1.9) return t("settings.lhRelaxed");
  return t("settings.lhLoose");
}

export type { Lang };
