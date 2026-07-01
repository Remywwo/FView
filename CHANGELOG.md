# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.8.0] - 2026-07-02

### Added
- **Two-pane layout** — resizable sidebar (290–480 px) with folder tree / document outline tabs, file actions, and settings/help/AI buttons.
- **Document Switcher** (`⌘P`) — floating toolbar pill for searching and switching files across open folder, recent files, and current path.
- **Floating toolbar** — frosted glass pill at the top of the content area, only visible when a file is open.
- **Native macOS File menu** — Open, Open Folder, Save, Save As, Close with standard keyboard shortcuts.
- **Sidebar outline** — persistent table of contents for Markdown headings and PDF bookmarks with active tracking.
- **Code editor context menu** — right-click for Format, Copy, Cut, Paste.
- **HTML editor context menu** — right-click for Copy Source, Reload; editor right-click for Format, Copy, Cut, Paste.
- **PDF bottom toolbar** — frosted glass pill with page navigation, go-to-page, and zoom controls.
- **Image bottom toolbar** — unified frosted glass pill with zoom controls and click-to-edit percentage.
- **DOCX AI support** — right-click selected text → Ask AI.
- **Resizable sidebar** — drag the right edge, width persisted to localStorage.
- **Apple-style Markdown theme** — SF Pro typography, frosted glass surfaces, layered shadows, accent tints.
- **Table of contents placeholder** — shows "No outline" when a file has no TOC data.

### Changed
- **AI Assistant** — panel repositions to bottom center of the content area; supports Markdown, PDF, and DOCX. Config validation on right-click Ask AI.
- **AI Assistant** — clears conversation context when switching files.
- **Sidebar** — folder header removed, tabs replaced with icon toggle button.
- **Toolbar** — simplified to floating translucent pill; background transparent, full-width, drag region for macOS.
- **Preview panels** — all preview types now have unified rounded corners (8px), padding, and layered shadows.
- **Folder tree** — root node shows close button on hover; taller row heights for readability.
- **Scrollbars hidden** in sidebar for cleaner look.
- **Markdown** — removed h1 top gradient divider; tables have soft double-layer shadows.
- **Website** — updated screenshots to reflect current UI; WebP format for performance.

### Fixed
- **Table header styling** — header cells now visually distinct from body cells.
- **TOC click navigation** — scroll target correctly resolves `.md-prose-root` instead of wrapper div.
- **Theme background** — body uses `var(--md-bg)` so transparent toolbar blends correctly in both light and dark modes.
- **AI button visibility** — relocated from toolbar to sidebar bottom with proper styling.

## [0.7.6] - 2026-07-01

### Fixed
- **SVG files now render as images** — SVG was previously mis-classified as HTML (`.svg` appeared in `CODE_LANGUAGES.html.extensions`) and opened in the HTML editor with iframe preview. Now correctly routed to `ImagePreview` with proper zoom/drag/reset toolbar.
- **SVG rendering via inline DOM** — Tauri/WKWebView cannot reliably decode `image/svg+xml` through `<img>` tag blob/data URLs (renders as broken image icon). SVG content is now injected directly into the DOM via `dangerouslySetInnerHTML`, bypassing URL/mime negotiation entirely. Nominal dimensions are parsed from the root `<svg>` element's `width`/`height`/`viewBox` attributes so the scale-to-fit logic works identically to raster images. Non-SVG images (PNG/JPG/GIF/WebP/AVIF/BMP/TIFF/ICO) are unaffected and remain on the `<img>` + blob URL path.

## [0.7.4] - 2026-06-28

### Fixed
- **Milkdown code block excess blank space** — empty code blocks rendered with ~778px of bottom padding, full blocks had too much vertical padding. Three root causes fixed:
  - `CodeMirror` writes `style.minHeight` inline on `.cm-gutters` (specificity 1,0,0,0); project overrides with `min-height: 0 !important`
  - `.milkdown-code-block .tools` was a flex container with opacity:0 buttons that still occupied ~28px of layout; switched to `position: absolute` so buttons float over the block without contributing height
  - Global `.cm-editor .cm-scroller { padding-bottom: calc(100vh - 22px) }` (meant for the standalone `CodePreview`) leaked into the milkdown-embedded cm-scroller; scoped the rule to `[data-cm-code-preview]` and added defensive `padding-bottom: 0 !important` on the milkdown side
- **Milkdown code block padding** — tightened from `8px 20px 20px` to `4px 12px`

### Changed
- **Milkdown BlockEdit: hide drag handle** — keep only the `/` slash shortcut. The block prosemirror plugin still runs (mouse/drag event listeners stay bound) but its overhead is negligible; visual drag handle is removed per user preference

## [0.7.3] - 2026-06-27

### Fixed
- **Toolbar left padding on non-macOS** — Windows/Linux have window controls on the right side, so the 85px left padding that accommodates macOS traffic lights was unnecessary. Use `isMacPlatform()` to conditionally apply the padding via inline style

## [0.7.2] - 2026-06-27

### Fixed
- **Cross-platform build** — `title_bar_style`, `traffic_light_position`, `hidden_title` are macOS-only on `WebviewWindowBuilder`. Split setup into two `#[cfg]` blocks (macOS / non-macOS) so Windows/Linux CI builds compile

## [0.7.0] - 2026-06-27

### Added
- **Native macOS traffic lights in title bar** — switched from a custom HTML/CSS chrome to Tauri 2's `TitleBarStyle::Overlay` + `hiddenTitle` + `traffic_light_position(12, 24)`, so the window uses the real system red/yellow/green buttons positioned to align with the app toolbar
- **macOS-frameless window setup via Rust** — `WebviewWindowBuilder` now constructs the window at startup with `Overlay` title bar, `macOSPrivateApi` enabled
- **PDF text selection** — uses `pdfjs-dist` `TextLayer` to overlay transparent text on the PDF canvas; sync `--scale-factor` / `--scale-round-x/y` so spans stay aligned with canvas pixels at any zoom
- **PDF floating toolbar** — page navigation, jump-to-page input, and zoom controls moved to a centered bottom floating bar; content area gets `paddingBottom: 72px` to clear the bar
- **Image preview floating zoom bar** — fixed-width (220px) bottom floating bar with opaque background; auto-fit zoom on open, 999% max, drag-to-pan when image overflows, `Ctrl++ / Ctrl+- / Ctrl+0` shortcuts, click-to-edit zoom percentage
- **AI panel portal + per-area positioning** — AI panel renders via `createPortal` to `document.body` (escapes toolbar's `backdrop-filter` containing block); `PdfPreview` sets `--ai-panel-bottom: 100px` via `document.documentElement` so the panel sits above the floating toolbar without the AI plugin knowing about PDF
- **Frosted-glass app toolbar** — main toolbar uses `backdrop-filter: blur(12px)` with 75% translucent background; sits in the title-bar area (left padding 85px for traffic lights); `z-index: 100`; `data-tauri-drag-region` for window drag

### Changed
- **Toolbar CSS split** — base `.toolbar` (flex/gap/padding/height/font) shared by all previews; new `.app-toolbar` class for the main window's titlebar-integrated toolbar only
- **AI panel validation priority** — checks file-type support before checking API-key configuration, so unsupported files always notify "AI only supports Markdown and PDF" regardless of provider state
- **AI panel `compact` mode removed** — panel no longer auto-opens on PDF load; user clicks ✨ AI to open it

### Fixed
- **AI panel positioning** — was constrained to the toolbar due to `backdrop-filter` creating a new containing block; fixed by rendering to `document.body` via `createPortal`
- **Image preview scrolling at high zoom** — replaced CSS `transform: scale()` with explicit `width`/`height` from natural dimensions; overrode Tailwind's `img { max-width: 100% }` reset with `maxWidth: "none"`
- **Image preview drag-to-pan** — works in all four directions (was previously locked to vertical scrolling only because the scroll container's overflow wasn't being detected after CSS transform)
- **Save As** — `saveAs` no longer switches the active file to the copy; original stays active with dirty flag preserved and a toast confirms the new path
- **Markdown/ProseMirror vs external file drag-drop conflict** — `DropZone` now checks `isOverMarkdownEditor()` via `document.elementFromPoint` (with `devicePixelRatio` scaling) and skips forwarding drops that land on `[data-md-editor]`

## [0.6.0] - 2026-06-23

### Added
- **Recent files & folders on home screen** — up to 5 most-recently-opened items persisted in `localStorage`
  - New `useRecents` hook: record on every successful open (dialog, drag-drop, CLI, folder-tree), dedupe by path, evict oldest when cap is exceeded
  - Hover over any entry to reveal a `×` remove button; "Clear all" at the list bottom
  - Stale paths (deleted/moved) are auto-removed on click with an error toast
- **Platform-specific shortcut hints** — `EmptyState` and `HelpModal` detect macOS vs Windows/Linux and display the appropriate modifier key glyphs (`⌘` vs `Ctrl`)

### Changed
- Home screen subtitle: "A minimal file preview & editor" → "A minimal file previewer" (en) / "极简的文件预览器" (zh)
- `DocxPreview` container: removed hardcoded `padding: 1rem` (wrapper CSS handles spacing)
- Docs landing page:
  - Features cards: removed Chinese fallback text from all 6 cards; `i18n.js` is now the single source of truth
  - "Preview-first" wording: descriptions and feature card 01 place preview before editing
  - Fixed malformed nav HTML (unclosed `</div>` tags)
  - Added missing `alt` attributes to 3 `<img>` tags

### Fixed
- **CI**: download-link auto-updater rewrite — sed range-based editing kept overstepping into the next platform's `<a>` block, silently replacing the Linux `.deb` URL with the Windows `.exe` URL over multiple releases. Rewritten in Python (unambiguous per-block href replacement) with a post-rewrite validator that aborts the push on any platform/extension mismatch.
- **Release script**: added platform-link validation step after the version sed; aborts on mismatch with clear remediation hint.

## [0.5.0] - 2026-06-23

### Added
- **DOCX (Microsoft Word) preview** — read-only, supports inline images via base64
  - `docx-preview` rendered through a new `DocxPreview` component, dynamically imported (own Vite chunk: 172.86 KB / 50.70 KB gzip)
  - Renders headings, lists, tables, blockquotes, code, page chrome, headers/footers, footnotes/endnotes
  - Read-only convention: `Save` / `Save As` buttons disabled for .docx (mirrors PDF/Image)
  - New `Word` filter in the file-open dialog
  - File-type detection: `detectFile()` returns `kind: "docx"` for `.docx`
  - File loader: `.docx` files take the binary read path (`binaryBytes: Uint8Array`)
- Folder tree: `.docx` files render with the Microsoft Word brand-blue icon (`#2b579a`)
- i18n: en/zh `app.docxLoading`, `app.docxError`, `help.docxRow`; `app.supports` updated in both locales
- Help modal: new `Word · .docx · read-only` row in the Supported File Types table

### Changed
- Dark mode CSS for DOCX: overrides docx-preview's hardcoded white page chrome and inline `style="color:…"` run colors using `!important` plus higher-specificity selectors (`.docx-preview-container .docx-wrapper > section.docx`); spans/divs/strong/em/etc. covered

## [0.4.0] - 2026-06-20

### Changed
- **Markdown engine migrated to Milkdown Crepe** — WYSIWYG editor replacing ByteMD/TipTap
  - Floating formatting toolbar on text selection
  - Slash commands (`/`) to insert blocks, tables, code, math
  - Built-in tables, KaTeX math, code highlighting (CodeMirror)
  - Task lists, GFM support
  - Search & highlight (`⌘F`) with floating search bar and match navigation
- Settings UX: General tab auto-saves immediately (no confirm needed); AI tab defers to explicit confirm
- All HelpModal strings extracted to i18n; ordered lists with visible numbering
- Website docs updated for Milkdown features

### Added
- ProseMirror DecorationSet-based search match highlighting (yellow/orange)
- `coordsAtPos` scroll-to-match navigation
- Dynamic Milkdown theme switching (frame/frame-dark)
- Theme plugin registry (`registerTheme` / `unregisterTheme`) for extension-based themes

### Removed
- ByteMD editor and all 7 plugins (GFM, highlight, frontmatter, gemoji, math, medium-zoom, mermaid)
- TipTap editor and all custom extensions (Table, Math, Mermaid, Emoji, Frontmatter, Image, ZoomableImage)
- 14 `@tiptap/*` packages, `tiptap-markdown`, `lowlight`, `markdown-it-*` dependencies
- 32 theme CSS files (only GitHub theme kept for app chrome)
- View mode buttons (Split / Write / Preview) and `⌘P` cycle shortcut

## [0.3.2] - 2026-06-20

### Added
- Right-click "Ask AI" context menu on selected text in Markdown editor and preview
- Input auto-focus when opening AI panel via toolbar button or keyboard shortcut
- AI greetings/small-talk support (introduces itself, lists capabilities)
- PDF page context auto-injected into AI queries
- Image preview: default fit-to-viewport (`max-width:100%; max-height:100%`)

### Changed
- Preset commands simplified to: Summarize Page, Summarize Chapter, Summarize Document
- AI scope restricted to document analysis, summarization, and translation
- All AI notifications now support i18n (Chinese / English)
- AI response language follows UI locale when `aiTargetLang` is set to `auto`
- HTML preview toolbar button order matches Markdown (Preview → Editor → Split)
- Settings modal: click outside no longer closes the panel

### Removed
- Code file AI support (Explain Code command, `⌘⇧E` shortcut, code context injection)
- PDF text selection layer (reverted — canvas-only rendering)
- Demo "Say Hello" extension

## [0.3.1] - 2026-06-19

### Added
- AI panel toggle shortcut (`⌘⇧A`)

## [0.3.0] - 2026-06-19

### Added
- **AI Assistant extension** (`extensions/ai-assistant`) — context-aware chat for Markdown & PDF files
  - Configurable providers: OpenAI-compatible (OpenAI, Ollama, DeepSeek, Groq…) and Anthropic (Claude)
  - Custom API key, base URL, and model name in Settings → AI tab
  - Preset commands: summarize document, summarize selection, translate, explain code
  - Streaming responses with cancel support
  - Compact auto-open mode when viewing PDFs (input + presets only)
  - PDF context extraction: outline parsing, page text caching for AI prompt injection
  - Keyboard shortcuts: `⌘⇧Y` (summarize), `⌘⇧E` (explain code)
- **Plugin infrastructure** — extension API for commands, toolbar slots, panels, and notifications
  - `ExtensionManifest` / `HostAPI` / `Registry` / `CommandProvider` / `PluginProvider`
  - `Slot` primitive for plugin-injected toolbar items
  - `ToastHost` for transient notifications (info / warn / error)
  - Centralized command system: `CommandProvider` replaces 7 scattered `keydown` listeners
  - Selection store (`useSyncExternalStore`) exposes CM5/CM6 selection to plugins
  - Isolated event buses (`fileBus`, `notifyBus`, `eventsBus`) prevent cross-talk

### Changed
- **Settings modal**: split into General / AI tabs, fixed height (70vh), API key show/hide toggle, toast on save
- **Image preview**: default fit-to-viewport (`max-width:100%; max-height:100%`)
- **Help modal**: added AI shortcuts table, settings tab mention, AI setup tip
- **TOC**: tested left-side placement, reverted to right edge
- **Docs website**: refreshed Features grid (6 cards), AI screenshot, hero subtitle, download links

### Fixed
- `CommandProvider` moved to outermost layer — hooks inside `ThemeProvider` now find context
- Commands without shortcuts are now stored in registry (fixes toolbar-triggered commands)
- `HostAPI` stale closure: `commandCtx` routed through ref to survive StrictMode remounts
- Settings save now triggers a toast notification
- AI panel closes when switching to unsupported file type

### Fixed
- Local image plugin: broader URL match (`https:` + `try-catch` safety) for external images
- Docs Linux download link (.deb instead of .exe)

## [0.2.2] - 2026-06-17

### Added
- Line numbers (`editorConfig.lineNumbers: true`, later removed)

### Fixed
- CodeMirror gutter horizontal padding preserved (split `padding` shorthand)
- Explicit line numbers disable via `cm.setOption` (editorConfig changes not retroactive)
- Windows + macOS/Linux CI builds (Rust pattern fix + tauriScript)

### Removed
- Line numbers (CM5 gutter limitation — numbers inline with content, not in separate gutter)

## [0.2.1] - 2026-06-17

### Added
- Local image loading in ByteMD preview (rehype plugin + Tauri `convertFileSrc`)
- Active line highlighting (manual via CodeMirror `addLineClass`)
- **10 font styles** in Settings: System UI, Humanist, Georgia, Menlo, Newspaper, Rounded added
- Floating TOC toggle button (three-line icon on right edge)

### Changed
- **Default mode**: Preview (was Split); button order: Preview / Write / Split
- **Typora-style centered editing**: content max-width 860px, window bg vs content bg, transparent toolbar
- Selection color lightened (was dark blue, now code-bg)
- Toolbar background transparent (window bg shows through)
- Folder sidebar header height 48px, font-size 14px

### Fixed
- Windows build (Rust `unreachable-patterns` + `tauriScript: npx`)
- macOS/Linux build (Rust `#[allow(unreachable_patterns)]` on Port match)
- Dropdown scrollbar overflow, white background overrides
- TOC hidden in Write mode
- CodeMirror refresh on mode switch (fix blank editor)
- CodeMirror refresh on mount/resize (fix cursor offset)

## [0.2.0] - 2026-06-17

### Release Notes
- All four platform builds pass: macOS (x64 + aarch64), Windows, Linux
- CI auto-generates release notes from CHANGELOG

## [0.1.5] - 2026-06-17

### Added
- Custom floating TOC sidebar (WysiwygToc) with right-edge three-line toggle button
- ByteMD toolbar & status bar full Chinese locale (48 core keys + 21 plugin keys: GFM, math, mermaid)
- Font-family and line-height synced from Settings to ByteMD editor and preview
- Release CI now auto-generates release notes from CHANGELOG.md

### Changed
- PDF outline English title changed from "Outline" to "Table of contents"

### Fixed
- CodeMirror blank flicker during scroll (GPU acceleration + viewport margin fix)
- Dropdown/tooltip white background override for dark mode
- Dropdown scrollbar overflow on nested menus

### Removed
- Line numbers from markdown editor (added then removed in v0.1.5 cycle)

## [0.1.4] - 2026-06-17

### Changed
- **Markdown editor migrated to ByteMD** — split-view editor with 7 plugins (GFM, highlight, frontmatter, gemoji, KaTeX math, medium-zoom, Mermaid)
- Removed CodeMirror + markdown-it + useScrollSync in favor of ByteMD's built-in rendering and scroll sync
- Removed MarkdownView, TocSidebar, extractHeadings components
- Split / Write / Preview view mode toggle
- Toolbar font size unified to 14px, height to 48px, aligned with folder sidebar
- Folder sidebar width adjusted to 283px, header height 48px
- File path right-aligned in toolbar

### Added
- **33 markdown CSS themes** — 32 from juejin-markdown-themes + default (github-markdown-css light)
- Custom theme selector dropdown with FView styling
- Font size synced from Settings to ByteMD editor and preview
- External links in preview open via system browser
- i18n keys: `md.split`, `md.write`, `md.theme`, `md.toc`
- `public/themes/` — static theme CSS assets

### Removed
- `markdown-it`, `markdown-it-task-lists`, `markdown-it-anchor`, `unified`, `remark-parse`, `unist-util-visit`, `github-slugger` dependencies
- `MarkdownView.tsx`, `TocSidebar.tsx`, `extractHeadings.ts`, `useScrollSync.ts`

## [0.1.3] - 2026-06-15

### Added
- Folder tree right-click context menu: create file, create folder, rename, delete
- In-editor find (⌘F / Ctrl+F) — search panel and replace in all CodeMirror editors
- macOS "damaged app" workaround banner on the docs site
- npm run release `<version>` command for automated releases
- Markdown engine migrated from react-markdown to markdown-it
- local image paths in Markdown now resolve via Tauri `convertFileSrc` (asset://)

### Changed
- Cargo binary renamed from `fview` to `fview-power` (macOS Dock hover now shows "FView Power")
- Tauri release CI: switched to `actions-rust-lang/setup-rust-toolchain` for consistent installs
- Release workflow: publishes directly instead of draft
- `src-tauri/Cargo.toml`, `package.json`, `src-tauri/tauri.conf.json` versions now in sync
- Docs download links point directly to release assets

### Fixed
- Windows build: Tauri permissions for `mkdir`, `remove`, `rename` added to capabilities
- Folder tree context menu delete confirmation (closure bug)
- with-path.mjs: use `spawnSync` to locate cargo (works on Windows GitHub Actions runner)
- Auto-update workflow trigger: switched from `release:published` to `workflow_run`
- Auto-update workflow: `GH_TOKEN` moved to job level so `gh` CLI works in all steps

## [0.1.0] - 2026-06-15

### Added
- Initial public release
- Markdown preview with scroll sync, floating TOC, frontmatter support
- PDF outline navigation, ⌘G jump-to-page
- CodeMirror-based code editor for 30+ languages
- HTML live preview (split / editor / preview modes)
- Image preview with zoom controls
- Folder browser with tree sidebar (skips build artifacts)
- Drag-and-drop for files and folders
- Bilingual UI (English / 中文)
- Customisable typography (font, size, line height, theme)
- Settings persistence via localStorage
- Help modal with bilingual user guide
- Download links on the docs site
- GitHub Actions release workflow producing macOS (arm64 / x64), Windows, and Linux builds
- GitHub Pages site with official documentation

[Unreleased]: https://github.com/Remywwo/FView-Power/compare/v0.1.2...HEAD
[0.1.2]: https://github.com/Remywwo/FView-Power/compare/v0.1.0...v0.1.2
[0.1.0]: https://github.com/Remywwo/FView-Power/releases/tag/v0.1.0
