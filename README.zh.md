# FView Power

> [English](./README.md) | 中文

一个极简的跨平台桌面文件预览器与编辑器，支持 macOS、Windows 和 Linux。

- **可编辑**：Markdown、TXT、HTML、源代码（20+ 种语言）
- **只读预览**：PDF、图片
- **文件夹浏览**：树形侧边栏，文件类型彩色图标
- **设置**：明暗主题、字体/字号/行高、English/中文
- **AI 助手**（Markdown & PDF）：总结文档、翻译、解释代码。自动读取文件内容、PDF 目录和页面文本。可配置任意兼容 API（OpenAI / Anthropic），支持自定义 Key、Base URL 和模型。详见 [AI 助手](#ai-助手)
- **插件可扩展**（见 [插件系统](#插件系统)）：内置扩展通过统一 API 注册命令、工具栏按钮、通知，无需修改核心组件

## 支持的文件类型

| 类型 | 可编辑 | 预览方式 |
|---|---|---|
| Markdown | 是 | bytemd（CodeMirror 5）编辑器 + 渲染预览（GFM、表格、任务列表、代码高亮、Math、Mermaid、frontmatter、emoji） |
| 代码（JS/TS/Python/Rust/Go/Java/C/C++/JSON/CSS/YAML/Shell/SQL 等） | 是 | CodeMirror 6 + `@uiw/react-codemirror`，自动识别语言并高亮 |
| HTML | 是 | CodeMirror 6 编辑器 + iframe 沙箱实时预览（Rust `tiny_http` 起本地服务器） |
| TXT / Log | 是 | 可调节排版样式 |
| PDF | 否 | pdfjs-dist canvas 渲染，支持缩放、翻页、目录浮动面板 |
| 图片（PNG/JPG/GIF/WebP/SVG/AVIF/BMP/TIFF/ICO） | 否 | 缩放、重置、适应 |

### 视图模式（Markdown & HTML）
- **分屏** — 编辑器 + 预览并排（可拖拽调整宽度）
- **仅编辑** — 全宽 bytemd 编辑器
- **仅预览** — 全宽渲染输出
- `⌘P` 循环切换

## 快捷键

### 全局
| 按键 | 操作 |
|---|---|
| `⌘O` | 打开文件 |
| `⇧⌘O` | 打开文件夹 |
| `⌘S` | 保存 |
| `⇧⌘S` | 另存为 |
| `⌘W` | 关闭当前文件 |
| `⌘.` | 切换明暗主题 |
| `Esc` | 关闭弹窗 / 菜单 |

所有全局快捷键由 `CommandProvider` 统一分发（见 [插件系统](#插件系统)）。插件可通过同一个注册中心添加自己的快捷键。

### Markdown
| 按键 | 操作 |
|---|---|
| `⌘P` | 切换分屏 / 编辑 / 预览模式 |

### PDF（组件级快捷键，尚未迁移到命令系统）
| 按键 | 操作 |
|---|---|
| `⌘G` | 聚焦"跳转到指定页"输入框 |
| `←` / `→` | 上一页 / 下一页 |
| `PageUp` / `PageDown` | 上一页 / 下一页 |
| `↑` / `↓` | 滚动当前焦点区域（画布或目录） |
| `Shift+↑` / `↓` | 按一屏滚动 |
| `Home` / `End` | 首页 / 末页 |

> 在 Windows / Linux 上，将 `⌘` 替换为 `Ctrl`。

## 功能特性

- **拖拽打开** — 将文件或文件夹拖入窗口任意位置即可打开
- **命令行支持** — `fview path/to/file.md` 启动时直接打开文件
- **Markdown**：分屏/编辑/预览三种视图，滚动同步，浮动目录自动高亮，30+ 主题切换
- **PDF**：翻页导航，缩放（0.5x–4x），浮动目录面板自动高亮
- **文件夹浏览**：左侧侧边栏（260px），自动展开父目录，跳过 `node_modules`/`.git`/`target`/`dist` 等
- **脏标记**：Markdown 编辑未保存时显示指示
- **设置** 持久化到 `localStorage`：语言（en/zh）、主题、字体、字号（8–72px）、行高
- **外部链接** 在 Markdown 预览中点击会在系统浏览器中打开
- **AI 上下文感知**：PDF 自动识别章节结构和页面文本；Markdown 自动将全文注入提示词

## AI 助手

FView 内置 AI 助手扩展（`extensions/ai-assistant`），支持 Markdown 和 PDF 文件。

### 配置

1. 打开 **Settings → AI** 标签页。
2. 选择提供商：**OpenAI / Compatible**（OpenAI、Ollama、DeepSeek、Groq 等）或 **Anthropic (Claude)**。
3. 填入 **API Key**、**Model** 名称，可选自定义 **Base URL**。
4. 点击 **Done** — toast 提示保存成功。

### 使用方式

| 触发方式 | 行为 |
|---|---|
| 工具栏 **✨ AI** 按钮 | 打开 AI 面板（底部居中），自动识别当前文件类型 |
| 打开 PDF | 面板自动以紧凑模式展示（仅输入框 + 预设命令），发送后展开 |
| `⌘⇧Y` | AI：总结文档 |
| `⌘⇧E` | AI：解释代码（需有选中内容） |

### 上下文注入

| 文件类型 | AI 自动获取的信息 |
|---|---|
| **Markdown** | 文件全文（前 4000 字）+ 当前选中文本 |
| **PDF** | 文档目录（章节标题 + 页码）+ 当前页文本（前 3000 字） |
| 其他类型 | AI 提示「仅支持 Markdown 和 PDF」，面板不会打开 |

### 预设命令

| 按钮 | 功能 |
|---|---|
| 总结文档 | 注入全文内容，请求生成摘要 |
| 总结选中 | 使用当前选中的文本 |
| 翻译 | 翻译选中的文本或整个文档 |
| 解释代码 | 解释选中的代码块 |

### 提供商兼容性

支持所有 OpenAI 兼容接口（`/v1/chat/completions`）和 Anthropic Messages API。Base URL 对所有提供商可见，可使用代理或自部署模型。

## 插件系统

FView 自带一套轻量扩展 API。插件系统位于核心 React 组件与扩展功能之间——新增命令、工具栏按钮或面板时不需要修改核心组件。

### 架构

```
┌──────────────────────────────────────────────────────────────┐
│ src/plugins/                                                  │
│ ├── types.ts          ExtensionManifest、CommandContribution、│
│ │                      ToolbarContribution、HostAPI 协议定义    │
│ ├── registry.ts       内存注册中心 + 变更事件发射器             │
│ ├── host.ts           ConcreteHostAPI（createHostAPI 工厂）    │
│ └── extensions/       内置扩展模块                             │
│     ├── index.ts          builtInExtensions 入口              │
│     └── ai-assistant/     AI 对话、总结、翻译                  │
├──────────────────────────────────────────────────────────────┤
│ src/hooks/                                                    │
│ ├── useCommands.tsx   CommandProvider + useCommand / register │
│ ├── usePlugin.tsx     PluginProvider + useExtensionContext    │
│ └── useSelection.tsx  选区 store（useSyncExternalStore）       │
├──────────────────────────────────────────────────────────────┤
│ src/components/                                               │
│ ├── Slot.tsx          <Slot name="..."> 渲染原语              │
│ └── ToastHost.tsx     订阅 host.notify() 事件                  │
└──────────────────────────────────────────────────────────────┘
```

### 扩展能做什么

| 能力 | API | 示例 |
|---|---|---|
| 注册键盘快捷键 | `host.commands.register({ id, label, shortcut, run })` | `shortcut: "Mod+Shift+Y"` 触发"总结选中" |
| 添加工具栏按钮 | `host.registry.registerToolbar({ id, slot: "toolbar-end", render })` | `extensions/ai-assistant` 中的 "✨ AI" |
| 弹出通知 | `host.notify(message, level?)` | 右下角 toast（info/warn/error 颜色区分） |
| 读取当前文件 | `host.file.get()` / `host.file.subscribe(cb)` | 监听文件变化而不强制 re-render |
| 读取当前选区 | `host.selection.get()` / `host.selection.subscribe(cb)` | Markdown (CM5) + Code (CM6) 选区 |
| 读取应用设置 | `host.settings.get()` / `host.settings.update(patch)` | 持久化的字体/行高 |
| 翻译 UI 文案 | `host.i18n.t(key)` | 内置 en/zh 字典，缺失时回退英文 |

### 编写一个扩展

1. 创建 `src/plugins/extensions/<name>/index.tsx`（如果扩展渲染 JSX 则必须用 `.tsx`）。
2. 导出一个默认 `ExtensionManifest`：
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
3. 在 `src/plugins/extensions/index.ts` 中注册：
   ```ts
   import myExt from "./my-feature";
   export const builtInExtensions = [myExt];
   ```
4. `App.tsx` 内部的 `PluginProvider` 在 mount 时激活所有 `builtInExtensions`。

### Host API

| 表面 | 方法 | 备注 |
|---|---|---|
| `host.file` | `get()`、`subscribe(cb)`、`setContent(text)` | 返回 `LoadedFile` 快照；订阅后再读 |
| `host.selection` | `get()`、`subscribe(cb)` | `{ markdown, code, html }` 选区文本快照 |
| `host.theme` | `isDark()`、`toggle()` | |
| `host.i18n` | `t(key)`、`lang()` | 缺失 key 时回退到英文 |
| `host.settings` | `get()`、`update(patch)` | 与 `SettingsModal` 同一套边界校验 |
| `host.commands` | `register(cmd)`、`execute(id, ...args)` | 无 shortcut 的命令也能通过 `execute` 触发 |
| `host.registry` | `registerToolbar`、`registerPanel`、`listToolbar(slot)` | |
| `host.events` | `subscribe(cb)` | 宿主状态变化（主题、设置等），独立 bus，不会被 `notify` 触发 |
| `host.onNotification` | `subscribe(cb)` | 通知专用 bus，`<ToastHost />` 使用 |
| `host.notify(message, level?)` | 返回通知 id | 通过 `<ToastHost />` 渲染（info/warn/error 颜色区分） |

### 约束

- 扩展**静态导入**，没有运行时从磁盘或网络加载的机制。要发布新扩展，请加到 `builtInExtensions` 然后重新构建。
- 插件与宿主页运行在同一个 JS 上下文（没有 worker / 沙箱边界）。请勿在扩展中执行不可信代码。
- React 18 StrictMode 下，`activate()` 在 dev 模式会被调用两次。确保你的 cleanup 是幂等的。

## 开发

环境要求：Node.js 18+ 和 Rust stable（1.77+）。

```bash
npm install
npm run tauri:dev
```

如果只想验证插件系统、不想编译 Rust：

```bash
npm run dev   # 仅 vite，浏览器打开 http://localhost:1420
```

页面加载完成后，工具栏会出现 "✨ AI" 按钮。在 Settings → AI 中配置 API Key 后，打开 Markdown 或 PDF 文件即可体验上下文感知的 AI 问答。

## 打包

```bash
npm run tauri:build
```

## 清理构建缓存

Rust / Tauri 的构建产物会膨胀到几 GB。在以下情况清理：

- 构建报错提示产物损坏
- 磁盘空间不足
- 切换 Rust 工具链或 Tauri 版本

```bash
# 项目级产物（可安全删除，下次会重新构建）
rm -rf src-tauri/target dist node_modules/.tauri

# Cargo 全局依赖缓存（重新下载较慢，一般保留）
cargo clean

# npm 缓存
npm cache clean --force
```

典型节省空间：`src-tauri/target` 在一次 debug build 后约 **2.5 GB**。
