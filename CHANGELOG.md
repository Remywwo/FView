# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Font-family, font-size, line-height synced from Settings to ByteMD editor and preview
- External links in preview open via system browser
- Custom floating TOC sidebar (WysiwygToc) with right-edge hover handle + visible toggle
- ByteMD toolbar & status bar Chinese locale (48 keys + 21 plugin keys)
- Line numbers in editor (later removed)
- CodeMirror viewport margin fix for blank flicker during scroll
- GPU-accelerated CodeMirror rendering
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
