# FView Power

> English | [中文](./README.zh.md)

A minimal cross-platform desktop file previewer & editor for macOS, Windows, and Linux.

- **Editable**: Markdown, TXT, HTML, source code (20+ languages)
- **Read-only preview**: PDF, DOCX, images
- **Folder browsing**: resizable sidebar with file tree and outline tabs
- **AI Assistant** (Markdown, PDF, DOCX): summarize, translate, explain. Right-click selection → Ask AI. Configurable provider (OpenAI-compatible / Anthropic).
- **Plugin-extensible**: built-in extensions register commands, toolbar items, and notifications through a unified API.

## Layout

FView Power has a two-pane layout: a **resizable sidebar** (290–480 px) on the left, and the **main content area** on the right.

- **Sidebar top**: file actions (Open, Open Folder, Save, Save As, Close). A toggle button switches between the folder tree and document outline when both are available.
- **Sidebar bottom**: Settings, Help, and AI buttons.
- **Floating toolbar**: a pill at the top of the content area holds the **Document Switcher** — a searchable file picker (`⌘P`) that lets you switch between files in the open folder, recent files, and the current path.

## Supported File Types

| Type | Edit | Preview |
|---|---|---|
| Markdown | Yes | Lexical WYSIWYG editor (GFM tables, task lists, code highlighting, KaTeX math, slash commands, table toolbar) |
| Code (JS/TS/Python/Rust/Go/Java/C/C++/JSON/CSS/YAML/Shell/SQL/etc.) | Yes | CodeMirror with language-specific syntax highlighting, right-click context menu (Format, Copy, Cut, Paste) |
| HTML | Yes | CodeMirror editor + sandbox live preview (split / editor / preview modes), right-click menu |
| TXT / Log | Yes | Configurable typography |
| PDF | No | pdfjs-dist canvas rendering with zoom, pagination, floating toolbar, sidebar outline |
| DOCX | No | docx-preview rendered content, right-click → Ask AI |
| Images (PNG/JPG/GIF/WebP/SVG/AVIF/BMP/TIFF/ICO) | No | Zoom, reset, drag-to-pan, floating toolbar |

## Keyboard Shortcuts

### Global
| Key | Action |
|---|---|
| `⌘O` | Open file |
| `⇧⌘O` | Open folder |
| `⌘P` | Switch document / search files |
| `⌘S` | Save |
| `⇧⌘S` | Save As |
| `⌘W` | Close current file |
| `⌘.` | Toggle light/dark theme |
| `Esc` | Close popup / menu |

### Markdown
| Key | Action |
|---|---|
| `⌘F` | Find in document |
| `Enter` | Next match |
| `⇧Enter` | Previous match |
| `Esc` | Close search |
| `/` | Slash command menu |

### PDF
| Key | Action |
|---|---|
| `⌘G` | Focus "Go to page" input |
| `←` / `→` | Previous / next page |
| `PageUp` / `PageDown` | Previous / next page |
| `↑` / `↓` | Scroll view |
| `Shift+↑` / `↓` | Scroll by one screen |
| `Home` / `End` | First / last page |

### AI
| Key | Action |
|---|---|
| `⌘⇧Y` | Summarize document / selection |
| `⌘⇧E` | Explain code |
| `⌘⇧A` | Toggle AI panel |

> On Windows/Linux, replace `⌘` with `Ctrl`.

## Features

- **Drag & drop** — drop a file or folder anywhere on the window to open it
- **CLI support** — `fview path/to/file.md` opens the file directly
- **Markdown**: Lexical WYSIWYG editor, slash commands, GFM tables with toolbar, find & replace, external links open in system browser
- **Code editor**: syntax highlighting for 20+ languages, right-click context menu (Format / Copy / Cut / Paste)
- **HTML editor**: live preview with built-in server, split/editor/preview modes, right-click menus
- **PDF**: page navigation, zoom, floating toolbar, sidebar outline with auto-highlight
- **DOCX**: rendered preview with right-click → Ask AI
- **Images**: zoom, reset, drag-to-pan, click-to-edit zoom percentage
- **Folder browsing**: resizable sidebar with file tree, right-click context menu (new file/folder, rename, delete), auto-expand ancestors, skip `node_modules`/`.git`/`target`/`dist` etc.
- **Document outline**: sidebar tab shows markdown headings or PDF bookmarks with active tracking
- **Document Switcher**: `⌘P` to search and switch files across open folder, recents, and current path
- **Dirty tracking**: unsaved indicator with floating pill in the toolbar
- **Settings** persisted to `localStorage`: language (en/zh), theme, font family, font size (8–72px), line height
- **Resizable sidebar**: drag the right edge (290–480 px), width persisted across sessions

## AI Assistant

FView ships with a built-in AI assistant extension that supports Markdown, PDF, and DOCX files.

### Setup

1. Open **Settings → AI** tab.
2. Choose a provider: **OpenAI / Compatible** (OpenAI, Ollama, DeepSeek, Groq…) or **Anthropic (Claude)**.
3. Enter your **API Key**, **Model** name, and optionally a custom **Base URL**.
4. Click **Done**.

### Usage

| Trigger | Behavior |
|---|---|
| Sidebar **✨ AI** button | Opens the AI panel (bottom center of content area) |
| Right-click selection → **Ask AI** | Opens panel with selected text as context (Markdown, PDF, DOCX) |
| `⌘⇧Y` | AI: Summarize |
| `⌘⇧E` | AI: Explain Code |
| `⌘⇧A` | AI: Toggle panel |

### Preset commands

| Button | What it does |
|---|---|
| Summarize Document | Injects full content and asks for a summary |
| Summarize Selection | Uses the current text selection |
| Translate | Translates selected text or entire document |
| Explain Code | Explains the selected code block |

## Plugin System

FView ships with a lightweight extension API. The plugin system sits between the core React components and any user-contributed functionality.

### Architecture

```
src/plugins/
├── types.ts          ExtensionManifest, CommandContribution, ToolbarContribution, HostAPI
├── registry.ts       In-memory Registry + change emitter
├── host.ts           ConcreteHostAPI factory
└── extensions/       Built-in extension modules
    ├── index.ts          builtInExtensions entry
    └── ai-assistant/     AI chat, summarize, translate, explain
```

### What an extension can do

| Contribution | API |
|---|---|
| Keyboard shortcut | `host.commands.register({ id, label, shortcut, run })` |
| Toolbar/sidebar button | `host.registry.registerToolbar({ id, slot, order, render })` |
| Notification toast | `host.notify(message, level?)` |
| Read current file | `host.file.get()` / `host.file.subscribe(cb)` |
| Read editor selection | `host.selection.get()` / `host.selection.subscribe(cb)` |
| Read settings | `host.settings.get()` / `host.settings.update(patch)` |
| i18n | `host.i18n.t(key)` |

### Writing an extension

1. Create `src/plugins/extensions/<name>/index.tsx`.
2. Export a default `ExtensionManifest` with `id`, `name`, `version`, and `activate(ctx)`.
3. Register it in `src/plugins/extensions/index.ts`.
4. The `PluginProvider` inside `App.tsx` activates all `builtInExtensions` on mount.

See the [Plugin System section](#plugin-system) above for the full API reference.

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

## Build

```bash
npm run tauri:build
```
