import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

export type FontFamily = "system" | "sans" | "serif" | "mono" | "system-ui" | "humanist" | "georgia" | "menlo" | "newspaper" | "rounded";
export type FontSize = number;
export type LineHeight = number;

export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 72;
export const DEFAULT_FONT_SIZE = 15;

export const MIN_LINE_HEIGHT = 1.1;
export const MAX_LINE_HEIGHT = 2.5;
export const DEFAULT_LINE_HEIGHT = 1.6;

export interface LineHeightOption {
  value: number;
  label: string;
}

export const LINE_HEIGHTS: LineHeightOption[] = [
  { value: 1.35, label: "Compact" },
  { value: 1.5, label: "Default" },
  { value: 1.6, label: "Comfortable" },
  { value: 1.8, label: "Relaxed" },
  { value: 2.0, label: "Loose" },
];

export type AIProviderChoice = "openai-compat" | "anthropic" | "none";
export type AITargetLang = "zh" | "en" | "auto";

export interface Settings {
  fontFamily: FontFamily;
  fontSize: FontSize;
  lineHeight: LineHeight;
  // ── AI ──
  aiProvider: AIProviderChoice;
  aiApiKey: string;
  aiBaseUrl: string;
  aiModel: string;
  aiTargetLang: AITargetLang;
}

const AI_TARGET_LANGS: readonly AITargetLang[] = ["zh", "en", "auto"];

const DEFAULT_SETTINGS: Settings = {
  fontFamily: "system",
  fontSize: DEFAULT_FONT_SIZE,
  lineHeight: DEFAULT_LINE_HEIGHT,
  aiProvider: "none",
  aiApiKey: "",
  aiBaseUrl: "https://api.openai.com/v1",
  aiModel: "gpt-4o",
  aiTargetLang: "auto",
};

const STORAGE_KEY = "fview:settings";

function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(stored);
    const size = Number(parsed.fontSize);
    const lh = Number(parsed.lineHeight);
    return {
      fontFamily: (parsed.fontFamily as FontFamily) || DEFAULT_SETTINGS.fontFamily,
      fontSize: Number.isFinite(size) && size >= MIN_FONT_SIZE && size <= MAX_FONT_SIZE
        ? size
        : DEFAULT_SETTINGS.fontSize,
      lineHeight: Number.isFinite(lh) && lh >= MIN_LINE_HEIGHT && lh <= MAX_LINE_HEIGHT
        ? lh
        : DEFAULT_SETTINGS.lineHeight,
      aiProvider: typeof parsed.aiProvider === "string" && ["openai-compat", "anthropic", "none"].includes(parsed.aiProvider)
        ? (parsed.aiProvider as AIProviderChoice)
        : DEFAULT_SETTINGS.aiProvider,
      aiApiKey: typeof parsed.aiApiKey === "string" ? parsed.aiApiKey : DEFAULT_SETTINGS.aiApiKey,
      aiBaseUrl: typeof parsed.aiBaseUrl === "string" && parsed.aiBaseUrl.length > 0
        ? parsed.aiBaseUrl
        : DEFAULT_SETTINGS.aiBaseUrl,
      aiModel: typeof parsed.aiModel === "string" && parsed.aiModel.length > 0
        ? parsed.aiModel
        : DEFAULT_SETTINGS.aiModel,
      aiTargetLang: typeof parsed.aiTargetLang === "string" && (AI_TARGET_LANGS as readonly string[]).includes(parsed.aiTargetLang)
        ? (parsed.aiTargetLang as AITargetLang)
        : DEFAULT_SETTINGS.aiTargetLang,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export interface FontOption {
  value: FontFamily;
  label: string;
  stack?: string;
}

export const FONT_FAMILIES: FontOption[] = [
  { value: "system", label: "System" },
  {
    value: "system-ui",
    label: "System UI",
    stack: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif',
  },
  {
    value: "sans",
    label: "Sans",
    stack: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif',
  },
  {
    value: "serif",
    label: "Serif",
    stack: 'Georgia, Cambria, "Times New Roman", Times, serif',
  },
  {
    value: "georgia",
    label: "Georgia",
    stack: 'Georgia, "Times New Roman", "Noto Serif", "Songti SC", serif',
  },
  {
    value: "newspaper",
    label: "Newspaper",
    stack: '"Charter", "Bitstream Charter", "Sitka Text", Cambria, serif',
  },
  {
    value: "mono",
    label: "Monospace",
    stack: '"JetBrains Mono", "SF Mono", Menlo, Monaco, Consolas, monospace',
  },
  {
    value: "menlo",
    label: "Menlo",
    stack: 'Menlo, "SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
  },
  {
    value: "humanist",
    label: "Humanist",
    stack: '"Optima", "Gill Sans", "Sitka UI", "Noto Sans", Candara, sans-serif',
  },
  {
    value: "rounded",
    label: "Rounded",
    stack: '"Nunito", "Comfortaa", "Varela Round", "M PLUS Rounded 1c", sans-serif',
  },
];

export function getFontStack(family: FontFamily): string | undefined {
  return FONT_FAMILIES.find((f) => f.value === family)?.stack;
}

interface SettingsContextValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(loadSettings);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // ignore
    }
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, update, reset }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
