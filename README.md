# FView

一个极简、Typora 风格的文件预览 & 编辑器，支持 macOS / Windows / Linux。

- **可编辑**：Markdown、TXT、HTML、源代码文件
- **只读预览**：PDF、图片

## 功能

- **Markdown** — CodeMirror 编辑器 + 实时预览（支持分屏 / 仅编辑 / 仅预览 三种模式，⌘P 切换）。支持 GitHub Flavored Markdown、表格、代码块语法高亮。
- **TXT / 代码** — CodeMirror 编辑器，自动识别语言（JS/TS、Python、Rust、JSON、CSS、HTML 等）并高亮，支持编辑。
- **HTML** — CodeMirror 编辑器 + 实时 iframe 预览（沙箱模式），支持编辑。
- **PDF** — 基于 `pdfjs-dist` canvas 渲染，支持翻页、缩放。
- **图片** — PNG / JPG / GIF / WebP / SVG / AVIF / BMP / TIFF / ICO，支持缩放。
- **拖拽** — 把文件拖到窗口任意位置即可打开。
- **打开 / 保存** — ⌘O 打开、⌘S 保存、⇧⌘S 另存为。
- **命令行参数** — `fview path/to/file.md` 启动时直接打开文件。
- **明暗主题** — ⌘. 切换，默认跟随系统，状态持久化。
- **极简 Typora 风格 UI** — 内容居中、舒适行高、克制配色。

## 技术栈

- **Tauri v2**（Rust）— 轻量、跨平台桌面外壳
- **React 18 + TypeScript** — UI
- **Tailwind CSS** — 原子化样式
- **Vite** — 开发与构建
- **CodeMirror 6** — 编辑器
- **react-markdown** + **remark-gfm** + **rehype-highlight** + **rehype-raw** — Markdown 渲染
- **pdfjs-dist** — PDF 渲染
- **highlight.js** — Markdown 中代码块的语法高亮

## 目录结构

```
FView/
├── src/                       # React + TS 前端
│   ├── components/
│   │   ├── App.tsx            # 主布局 + 工具栏 + 主题
│   │   ├── DropZone.tsx       # 全屏拖拽层
│   │   ├── MarkdownPreview.tsx
│   │   ├── CodePreview.tsx
│   │   ├── HtmlPreview.tsx
│   │   ├── PdfPreview.tsx
│   │   ├── ImagePreview.tsx
│   │   └── TextPreview.tsx
│   ├── hooks/
│   │   └── useFileLoader.ts   # 文件加载 / 保存 / 主题 / 快捷键
│   ├── utils/
│   │   └── fileDetector.ts    # 后缀名 → 文件类型
│   ├── styles/index.css       # Tailwind + Typora 排版
│   └── main.tsx
├── src-tauri/                 # Rust 后端
│   ├── src/
│   │   ├── lib.rs             # Tauri 构造、CLI 参数
│   │   └── main.rs            # 二进制入口
│   ├── capabilities/default.json
│   ├── tauri.conf.json
│   ├── icons/                 # Tauri 全部尺寸图标
│   ├── vendor/brotli/         # 本地 patch 的 brotli 8.0.3（见下方说明）
│   └── Cargo.toml
├── scripts/gen-icon.mjs       # 源 PNG 生成器（用于 `tauri icon`）
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

## 开发

环境要求：
- Node.js 18+ 与 npm
- Rust stable（1.77+）— 通过 [rustup](https://rustup.rs) 安装即可，无需手动把 `~/.cargo/bin` 加进 PATH。

> 如果遇到 `failed to run 'cargo metadata'` 错误，说明 shell 找不到 `cargo`。
> 原因是 rustup 安装时没有把 `~/.cargo/bin` 加入当前 shell 的 PATH。
> 本项目用 `scripts/with-path.mjs` 自动探测常见安装位置（`~/.cargo/bin`、`/opt/homebrew/bin`、`/usr/local/bin` 等），无需手动 export PATH。

```bash
npm install
npm run tauri:dev      # 启动开发模式（Vite + Tauri）
```

## 打包

```bash
npm run tauri:build    # 产出生产可分发包
```

## 快捷键

| 快捷键 | 动作 |
|---|---|
| `⌘O` / `Ctrl+O` | 打开文件 |
| `⌘S` / `Ctrl+S` | 保存 |
| `⇧⌘S` / `⇧Ctrl+S` | 另存为 |
| `⌘W` / `Ctrl+W` | 关闭当前文件 |
| `⌘P` / `Ctrl+P` | 切换 Markdown 分屏 / 仅编辑 / 仅预览 |
| `⌘.` / `Ctrl+.` | 切换明暗主题 |

## 关于 brotli 8.0.3 的 patch

`src-tauri/vendor/brotli/` 是一份打过补丁的 `brotli 8.0.3`（通过 `[patch.crates-io]` 替换 crates.io 版本）。补丁改了 `Cargo.toml` 中的两处：

| 字段 | 上游值 | patch 值 |
|---|---|---|
| `alloc-no-stdlib` | `"2.0"` | `"3.0"` |
| `alloc-stdlib` | `"~0.2"` | `"0.3"` |

**为什么需要这个 patch？**

`brotli 8.0.3` 上游的 `Cargo.toml` 把 `alloc-no-stdlib` 锁在 2.x（`"2.0"` ⇒ `>=2.0, <3.0`）、`alloc-stdlib` 锁在 `~0.2`（即 `0.2.x`）。但同一依赖树里 `brotli-decompressor 5.0.x` / `alloc-stdlib 0.3.0` 都接受 3.x 系列的 `alloc-no-stdlib`。Cargo 解析器会装两份 `alloc-no-stdlib`（一份 2.0.4 给 brotli 自己、一份 3.0.0 给其他消费者），两套 `Allocator` trait 在图中并存，导致稳定版 Rust 上的 `E0277: StandardAlloc: alloc::Allocator<ZopfliNode> is not satisfied`。

把 `brotli` 的依赖统一到 3.0.0 / 0.3.0，trait 一致，问题解决。详见 `src-tauri/Cargo.toml` 的 `[patch.crates-io]` 段。

> 待上游 `brotli` 发布 8.0.4 / 9.x 在自身依赖中解决此问题后，删掉 `[patch.crates-io]` 块和 `src-tauri/vendor/brotli/` 即可恢复原状。

## 图标

`scripts/gen-icon.mjs` 会生成一个简单的"MD"字样源 PNG，再用 `npx tauri icon src-tauri/icons/source.png` 一次性产出全部尺寸的图标。

## 权限

`src-tauri/capabilities/default.json` 当前对 fs 权限开得比较宽（`$HOME/**` 与 `**`），方便用户预览任意路径的文件。如要收紧用于正式发布，请按需调整 `fs:scope`。
