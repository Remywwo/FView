# FView Power

> English | [中文](./README.zh.md)

A minimal cross-platform desktop file previewer & editor for macOS, Windows, and Linux.

- **Editable**: Markdown, TXT, HTML, source code (20+ languages)
- **Read-only preview**: PDF, images
- **Folder browsing**: tree sidebar with file type icons
- **Settings**: light/dark theme, font family/size/line-height, English/中文
- **Plugin-extensible** (see [Plugin System](#plugin-system)): built-in extensions register commands, toolbar items, and notifications through a unified API.

## Supported File Types

| Type | Edit | Preview |
|---|---|---|
| Markdown | Yes | CodeMirror editor + rendered preview (GFM, tables, task lists, code highlighting) |
| Code (JS/TS/Python/Rust/Go/Java/C/C++/JSON/CSS/YAML/Shell/SQL/etc.) | Yes | CodeMirror with language-specific syntax highlighting |
| HTML | Yes | CodeMirror editor + sandbox iframe live preview |
| TXT / Log | Yes | Configurable typography |
| PDF | No | pdfjs-dist canvas rendering with zoom, pagination, outline drawer |
| Images (PNG/JPG/GIF/WebP/SVG/AVIF/BMP/TIFF/ICO) | No | Zoom, reset, fit |

### View Modes (Markdown & HTML)
- **Split** — editor + preview side-by-side (resizable panels)
- **Editor-only** — full-width CodeMirror
- **Preview-only** — full-width rendered output
- Cycle with `⌘P`

## Keyboard Shortcuts

### Global
| Key | Action |
|---|---|
| `⌘O` | Open file |
| `⇧⌘O` | Open folder |
| `⌘S` | Save |
| `⇧⌘S` | Save As |
| `⌘W` | Close current file |
| `⌘.` | Toggle light/dark theme |
| `Esc` | Close popup / menu |

All global shortcuts are dispatched by a centralized `CommandProvider` (see [Plugin System](#plugin-system)). Plugins can register their own shortcuts through the same registry.

### Markdown
| Key | Action |
|---|---|
| `⌘P` | Cycle split/editor/preview mode |

### PDF (component-scoped, not yet migrated to the command system)
| Key | Action |
|---|---|
| `⌘G` | Focus "Go to page" input |
| `←` / `→` | Previous / next page |
| `PageUp` / `PageDown` | Previous / next page |
| `↑` / `↓` | Scroll focused area (canvas or outline) |
| `Shift+↑` / `↓` | Scroll by one screen |
| `Home` / `End` | First / last page |

> On Windows/Linux, replace `⌘` with `Ctrl`.

## Features

- **Drag & drop** — drop a file or folder anywhere on the window to open it
- **CLI support** — `fview path/to/file.md` opens the file directly
- **Markdown**: split/editor/preview views, scroll sync, floating TOC sidebar with auto-highlight
- **PDF**: page navigation, zoom (0.5x–4x), floating outline drawer with auto-highlight
- **Folder browsing**: left sidebar (260px), auto-expand ancestors, skip `node_modules`/`.git`/`target`/`dist` etc.
- **Dirty tracking**: unsaved indicator for Markdown edits
- **Settings** persisted to `localStorage`: language (en/zh), theme, font family, font size (8–72px), line height
- **External links** in Markdown open in the system browser

## Plugin System

FView ships with a lightweight extension API. The plugin system sits between the core React components and any user-contributed functionality, so adding a new command, toolbar button, or panel doesn't require modifying core components.

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ src/plugins/                                                  │
│ ├── types.ts          ExtensionManifest, CommandContribution, │
│ │                      ToolbarContribution, HostAPI protocol  │
│ ├── registry.ts       In-memory Registry + change emitter    │
│ ├── host.ts           ConcreteHostAPI (createHostAPI factory)  │
│ └── extensions/       Built-in extension modules              │
│     ├── index.ts          builtInExtensions entry              │
│     └── demo-hello/       Seed extension ("Say Hello" button)  │
├──────────────────────────────────────────────────────────────┤
│ src/hooks/                                                    │
│ ├── useCommands.tsx   CommandProvider + useCommand / register │
│ ├── usePlugin.tsx     PluginProvider + useExtensionContext    │
│ └── useSelection.tsx  Selection store (useSyncExternalStore)  │
├──────────────────────────────────────────────────────────────┤
│ src/components/                                               │
│ ├── Slot.tsx          <Slot name="..."> rendering primitive   │
│ └── ToastHost.tsx     Subscribes to host.notify() events      │
└──────────────────────────────────────────────────────────────┘
```

### What an extension can do

| Contribution | API | Example |
|---|---|---|
| Register a keyboard shortcut | `host.commands.register({ id, label, shortcut, run })` | `shortcut: "Mod+Shift+Y"` for "summarize selection" |
| Add a toolbar button | `host.registry.registerToolbar({ id, slot: "toolbar-end", render: () => <button> })` | "Say Hello" button in `extensions/demo-hello` |
| Show a notification | `host.notify(message, level?)` | Toast in bottom-right via `<ToastHost />` |
| Read the current file | `host.file.get()` / `host.file.subscribe(cb)` | Watch file changes without re-rendering |
| Read current editor selection | `host.selection.get()` / `host.selection.subscribe(cb)` | CM5 (Markdown) + CM6 (Code) selections |
| Read app settings | `host.settings.get()` / `host.settings.update(patch)` | Persisted font/line-height |
| Translate a UI key | `host.i18n.t(key)` | Built-in en/zh dictionaries |

### Writing an extension

1. Create `src/plugins/extensions/<name>/index.tsx` (`.tsx` is required if your extension renders JSX).
2. Export a default `ExtensionManifest`:
   ```tsx
   import type { ExtensionManifest } from "@/plugins/types";

   const manifest: ExtensionManifest = {
     id: "my.feature",
     name: "My Feature",
     version: "0.1.0",
     activate(ctx) {
       const cleanupCmd = ctx.host.commands.register({
         id: "my.run",
         label: "Run My Feature",
         shortcut: "Mod+Shift+M",
         run: () => ctx.host.notify("Hello from my extension!"),
       });

       const cleanupToolbar = ctx.host.registry.registerToolbar({
         id: "my.button",
         slot: "toolbar-end",
         order: 10,
         render: () => (
           <button onClick={() => ctx.host.commands.execute("my.run")}>
             My Button
           </button>
         ),
       });

       return () => { cleanupCmd(); cleanupToolbar(); };
     },
   };

   export default manifest;
   ```
3. Register it in `src/plugins/extensions/index.ts`:
   ```ts
   import myExt from "./my-feature";
   export const builtInExtensions = [myExt];
   ```
4. The `PluginProvider` mounted inside `App.tsx` activates all `builtInExtensions` on mount.

### Host API

| Surface | Methods | Notes |
|---|---|---|
| `host.file` | `get()`, `subscribe(cb)`, `setContent(text)` | `LoadedFile` snapshot; subscribe before reading on change |
| `host.selection` | `get()`, `subscribe(cb)` | `{ markdown, code, html }` snapshot of current selection text |
| `host.theme` | `isDark()`, `toggle()` | |
| `host.i18n` | `t(key)`, `lang()` | Falls back to English when a key is missing |
| `host.settings` | `get()`, `update(patch)` | Validated against the same bounds as `SettingsModal` |
| `host.commands` | `register(cmd)`, `execute(id, ...args)` | Commands without a shortcut still work via `execute` |
| `host.registry` | `registerToolbar`, `registerPanel`, `listToolbar(slot)` | |
| `host.events` | `subscribe(cb)` | Fires on file/theme/settings/notification changes |
| `host.notify(message, level?)` | Returns notification id | Renders via `<ToastHost />` (info/warn/error color) |

### Constraints

- Extensions are **statically imported** — there is no runtime loading from disk or network. To ship a new extension, add it to `builtInExtensions` and rebuild.
- Plugins run in the same JS context as the host (no worker / sandbox boundary). Do not run untrusted code in extensions.
- All extensions are activated on app mount under React 18 StrictMode. Each `activate()` is called twice in dev — make sure your cleanup is idempotent.

## Development

Requirements: Node.js 18+ and Rust stable (1.77+).

```bash
npm install
npm run tauri:dev
```

To work on the plugin system without Tauri/Rust:

```bash
npm run dev   # vite only — open http://localhost:1420
```

The dev toolbar shows a "Say Hello" demo button (from `extensions/demo-hello`) once the page loads. Click it to verify the registry → toast pipeline end-to-end.

## Build

```bash
npm run tauri:build
```

## Cleaning Build Cache

Rust / Tauri build output can grow to several GB. Clean it when:

- Build errors mention stale or corrupted artifacts
- Disk space is running low
- Switching Rust toolchain or Tauri version

```bash
# Project-level artifacts (safe to delete — will rebuild)
rm -rf src-tauri/target dist node_modules/.tauri

# Cargo global dependency cache (slower to rebuild — usually keep)
cargo clean

# npm cache
npm cache clean --force
```

Typical savings: `src-tauri/target` is **~2.5 GB** after a debug build.
