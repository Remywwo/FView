export type FileKind =
  | "markdown"
  | "pdf"
  | "html"
  | "text"
  | "code"
  | "image"
  | "unknown";

export interface CodeLanguage {
  id: string;
  label: string;
  extensions: string[];
}

export const CODE_LANGUAGES: CodeLanguage[] = [
  { id: "javascript", label: "JavaScript", extensions: ["js", "mjs", "cjs", "jsx"] },
  { id: "typescript", label: "TypeScript", extensions: ["ts", "mts", "cts", "tsx"] },
  { id: "python", label: "Python", extensions: ["py", "pyi"] },
  { id: "rust", label: "Rust", extensions: ["rs"] },
  { id: "json", label: "JSON", extensions: ["json", "jsonc"] },
  { id: "css", label: "CSS", extensions: ["css", "scss", "sass", "less"] },
  { id: "html", label: "HTML", extensions: ["html", "htm", "xml", "svg", "vue", "svelte"] },
  { id: "yaml", label: "YAML", extensions: ["yml", "yaml"] },
  { id: "shell", label: "Shell", extensions: ["sh", "bash", "zsh", "fish"] },
  { id: "sql", label: "SQL", extensions: ["sql"] },
  { id: "java", label: "Java", extensions: ["java"] },
  { id: "go", label: "Go", extensions: ["go"] },
  { id: "c", label: "C", extensions: ["c", "h"] },
  { id: "cpp", label: "C++", extensions: ["cpp", "cc", "cxx", "hpp", "hh", "hxx"] },
  { id: "csharp", label: "C#", extensions: ["cs"] },
  { id: "markdown", label: "Markdown", extensions: ["md", "markdown"] },
  { id: "ini", label: "INI/TOML", extensions: ["ini", "toml", "cfg", "conf"] },
  { id: "dockerfile", label: "Dockerfile", extensions: ["dockerfile"] },
  { id: "plaintext", label: "Plain Text", extensions: ["txt", "log"] },
];

const CODE_LANG_BY_EXT: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const lang of CODE_LANGUAGES) {
    for (const ext of lang.extensions) {
      map[ext.toLowerCase()] = lang.id;
    }
  }
  return map;
})();

const IMAGE_EXTS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "ico", "tiff", "tif",
]);

const MD_EXTS = new Set(["md", "markdown", "mdx", "mdown"]);
const PDF_EXTS = new Set(["pdf"]);
const HTML_EXTS = new Set(["html", "htm", "xhtml"]);
const TEXT_EXTS = new Set(["txt", "log"]);

function getExtension(path: string): string {
  const lastDot = path.lastIndexOf(".");
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  if (lastDot < 0 || lastDot < lastSlash) return "";
  return path.slice(lastDot + 1).toLowerCase();
}

function getBasename(path: string): string {
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
}

export interface DetectedFile {
  kind: FileKind;
  extension: string;
  basename: string;
  language?: string;
  isEditable: boolean;
}

export function detectFile(path: string): DetectedFile {
  const ext = getExtension(path);
  const basename = getBasename(path);
  const lowerName = basename.toLowerCase();

  if (MD_EXTS.has(ext)) {
    return { kind: "markdown", extension: ext, basename, language: "markdown", isEditable: true };
  }
  if (PDF_EXTS.has(ext)) {
    return { kind: "pdf", extension: ext, basename, isEditable: false };
  }
  if (HTML_EXTS.has(ext)) {
    return { kind: "html", extension: ext, basename, language: "html", isEditable: true };
  }
  if (IMAGE_EXTS.has(ext)) {
    return { kind: "image", extension: ext, basename, isEditable: false };
  }
  if (TEXT_EXTS.has(ext)) {
    return { kind: "text", extension: ext, basename, language: "plaintext", isEditable: true };
  }
  if (CODE_LANG_BY_EXT[ext]) {
    return {
      kind: "code",
      extension: ext,
      basename,
      language: CODE_LANG_BY_EXT[ext],
      isEditable: true,
    };
  }
  if (lowerName === "dockerfile" || lowerName.startsWith("dockerfile.")) {
    return { kind: "code", extension: "", basename, language: "dockerfile", isEditable: true };
  }
  if (lowerName === "makefile" || lowerName.endsWith(".mk")) {
    return { kind: "code", extension: "", basename, language: "plaintext", isEditable: true };
  }
  if (lowerName.endsWith(".lock")) {
    return { kind: "code", extension: ext, basename, language: "plaintext", isEditable: true };
  }
  return { kind: "unknown", extension: ext, basename, isEditable: false };
}

export function mimeForImage(ext: string): string {
  switch (ext.toLowerCase()) {
    case "png": return "image/png";
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    case "bmp": return "image/bmp";
    case "svg": return "image/svg+xml";
    case "avif": return "image/avif";
    case "ico": return "image/x-icon";
    case "tiff":
    case "tif": return "image/tiff";
    default: return "application/octet-stream";
  }
}
