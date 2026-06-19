import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRegisterCommand } from "@/hooks/useCommands";

export type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  isDark: boolean;
  setDark: (dark: boolean) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = "fview:theme";

function loadInitial(): boolean {
  if (typeof window === "undefined") return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark") return true;
  if (stored === "light") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(loadInitial);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      localStorage.setItem(STORAGE_KEY, "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem(STORAGE_KEY, "light");
    }
  }, [isDark]);

  const setDark = useCallback((dark: boolean) => setIsDark(dark), []);
  const toggleTheme = useCallback(() => setIsDark((d) => !d), []);

  // Register theme commands via the centralized command system.
  // ⌘. toggles dark/light — was inline in App.tsx previously.
  useRegisterCommand({
    id: "theme.toggle",
    label: "Toggle Theme",
    shortcut: "Mod+.",
    run: toggleTheme,
  });

  return (
    <ThemeContext.Provider value={{ isDark, setDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
