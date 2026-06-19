import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { SettingsProvider } from "./hooks/useSettings";
import { ThemeProvider } from "./hooks/useTheme";
import { I18nProvider } from "./hooks/useI18n";
import { CommandProvider } from "./hooks/useCommands";
import "./styles/index.css";

// CommandProvider must wrap every Provider whose hook implementations
// register commands (useFileLoader, useFolder, useTheme, ...). Otherwise
// `useCommandContext` throws when those hooks mount inside a Provider
// that hasn't yet been wrapped by CommandProvider.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <CommandProvider>
      <I18nProvider>
        <ThemeProvider>
          <SettingsProvider>
            <App />
          </SettingsProvider>
        </ThemeProvider>
      </I18nProvider>
    </CommandProvider>
  </React.StrictMode>,
);
