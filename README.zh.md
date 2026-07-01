# FView Power

> [English](./README.md) | 中文

一个极简的跨平台桌面文件预览器与编辑器，支持 macOS、Windows 和 Linux。

- **可编辑**：Markdown、TXT、HTML、源代码（20+ 种语言）
- **只读预览**：PDF、DOCX、图片
- **文件夹浏览**：可调节宽度的侧边栏，包含文件树和文档大纲
- **AI 助手**（Markdown、PDF、DOCX）：总结、翻译、解释代码。右键选中文本 → AI 对话。支持 OpenAI 兼容 / Anthropic。
- **插件可扩展**：内置扩展通过统一 API 注册命令、工具栏按钮和通知

## 界面布局

FView Power 采用左右两栏布局：左侧为**可调节宽度的侧边栏**（290–480 px），右侧为主内容区。

- **侧边栏顶部**：文件操作按钮（打开、打开文件夹、保存、另存为、关闭）。当文件夹树和文档大纲同时存在时，工具栏中的切换按钮可在两者之间切换。
- **侧边栏底部**：设置、帮助、AI 按钮。
- **悬浮工具栏**：内容区顶部有一个悬浮胶囊，内含**文件切换器** — 一个可搜索的文件选择器（`⌘P`），支持在已打开文件夹、最近文件、当前路径之间快速切换。

## 支持的文件类型

| 类型 | 可编辑 | 预览方式 |
|---|---|---|
| Markdown | 是 | Lexical WYSIWYG 编辑器（GFM 表格、任务列表、代码高亮、KaTeX 数学、斜杠命令、表格工具栏） |
| 代码（JS/TS/Python/Rust/Go/Java/C/C++/JSON/CSS/YAML/Shell/SQL 等） | 是 | CodeMirror 语法高亮，右键菜单（格式化、复制、剪切、粘贴） |
| HTML | 是 | CodeMirror 编辑器 + iframe 实时预览（分屏/编辑/预览三种模式），右键菜单 |
| TXT / Log | 是 | 可调节排版样式 |
| PDF | 否 | pdfjs-dist canvas 渲染，底部浮动工具栏，侧边栏文档大纲 |
| DOCX | 否 | docx-preview 渲染，右键 → AI 对话 |
| 图片（PNG/JPG/GIF/WebP/SVG/AVIF/BMP/TIFF/ICO） | 否 | 缩放、重置、拖拽平移、浮动工具栏 |

## 快捷键

### 全局
| 按键 | 功能 |
|---|---|
| `⌘O` | 打开文件 |
| `⇧⌘O` | 打开文件夹 |
| `⌘P` | 切换文件 / 搜索文件 |
| `⌘S` | 保存 |
| `⇧⌘S` | 另存为 |
| `⌘W` | 关闭当前文件 |
| `⌘.` | 切换明暗主题 |
| `Esc` | 关闭弹窗 / 菜单 |

### Markdown
| 按键 | 功能 |
|---|---|
| `⌘F` | 文档内查找 |
| `Enter` | 下一个匹配 |
| `⇧Enter` | 上一个匹配 |
| `Esc` | 关闭查找 |
| `/` | 斜杠命令菜单 |

### PDF
| 按键 | 功能 |
|---|---|
| `⌘G` | 跳转到页面 |
| `←` / `→` | 上一页 / 下一页 |
| `PageUp` / `PageDown` | 上一页 / 下一页 |
| `↑` / `↓` | 滚动视图 |
| `Shift+↑` / `↓` | 按一屏滚动 |
| `Home` / `End` | 第一页 / 最后一页 |

### AI
| 按键 | 功能 |
|---|---|
| `⌘⇧Y` | 总结文档 / 选中内容 |
| `⌘⇧E` | 解释代码 |
| `⌘⇧A` | 切换 AI 面板 |

> Windows/Linux 用户请将 `⌘` 替换为 `Ctrl`。

## 功能特色

- **拖拽打开** — 把文件或文件夹拖到窗口任意位置即可打开
- **命令行支持** — `fview path/to/file.md` 直接打开文件
- **Markdown**：Lexical WYSIWYG 编辑器，斜杠命令，GFM 表格（带行列工具栏），查找替换，外部链接在系统浏览器中打开
- **代码编辑器**：20+ 语言语法高亮，右键菜单（格式化 / 复制 / 剪切 / 粘贴）
- **HTML 编辑器**：内置本地服务器实时预览，分屏/编辑/预览三种模式，右键菜单
- **PDF**：翻页导航、缩放、底部浮动工具栏、侧边栏文档大纲自动高亮
- **DOCX**：渲染预览，右键选中文本 → AI 对话
- **图片**：缩放、重置、拖拽平移、点击百分比直接输入数值
- **文件夹浏览**：可调节宽度的侧边栏，右键菜单（新建文件/文件夹、重命名、删除），自动展开当前文件的目录层级
- **文档大纲**：侧边栏大纲标签页，显示 Markdown 标题或 PDF 书签，随阅读位置自动高亮
- **文件切换器**：`⌘P` 搜索并切换文件，支持已打开文件夹、最近文件、当前路径
- **未保存提示**：编辑后工具栏显示未保存标识
- **设置持久化**：语言（中文/英文）、主题、字体、字号（8–72px）、行高保存在 localStorage
- **侧边栏可调节**：拖拽右边缘 290–480 px 自由调节，宽度跨会话保存

## AI 助手

FView 内置 AI 助手扩展，支持 Markdown、PDF 和 DOCX 文件。

### 配置

1. 打开 **设置 → AI** 标签页。
2. 选择提供商：**OpenAI / 兼容**（OpenAI、Ollama、DeepSeek、Groq 等）或 **Anthropic（Claude）**。
3. 输入 **API Key**、**模型名称**，可选填自定义 **Base URL**。
4. 点击 **完成**。

### 使用方式

| 触发方式 | 行为 |
|---|---|
| 侧边栏 **✨ AI** 按钮 | 打开 AI 面板（内容区底部居中） |
| 选中文本后右键 → **AI 对话** | 用选中内容打开面板（Markdown、PDF、DOCX） |
| `⌘⇧Y` | AI：总结文档 |
| `⌘⇧E` | AI：解释代码 |
| `⌘⇧A` | AI：切换面板 |

### 预设命令

| 按钮 | 功能 |
|---|---|
| 总结文档 | 注入完整内容并请求总结 |
| 总结选中 | 仅使用选中的文本 |
| 翻译 | 翻译选中文本或整个文档 |
| 解释代码 | 解释选中的代码块 |

## 插件系统

FView 提供轻量级扩展 API。插件系统位于 React 核心组件与用户自定义功能之间，注册命令、工具栏按钮或面板无需修改核心代码。

### 架构

```
src/plugins/
├── types.ts          扩展清单、命令贡献、工具栏贡献、HostAPI 协议
├── registry.ts       内存注册表 + 变更通知
├── host.ts           ConcreteHostAPI 工厂
└── extensions/       内置扩展模块
    ├── index.ts          内置扩展入口
    └── ai-assistant/     AI 对话、总结、翻译、解释代码
```

### 扩展能力

| 能力 | API |
|---|---|
| 注册快捷键 | `host.commands.register({ id, label, shortcut, run })` |
| 添加工具栏/侧边栏按钮 | `host.registry.registerToolbar({ id, slot, order, render })` |
| 显示通知 | `host.notify(message, level?)` |
| 读取当前文件 | `host.file.get()` / `host.file.subscribe(cb)` |
| 读取编辑器选中内容 | `host.selection.get()` / `host.selection.subscribe(cb)` |
| 读取应用设置 | `host.settings.get()` / `host.settings.update(patch)` |
| 国际化 | `host.i18n.t(key)` |

## 开发

需要：Node.js 18+ 和 Rust stable（1.77+）。

```bash
npm install
npm run tauri:dev
```

不依赖 Tauri/Rust 开发插件系统：

```bash
npm run dev   # 仅 Vite — 打开 http://localhost:1420
```

## 构建

```bash
npm run tauri:build
```
