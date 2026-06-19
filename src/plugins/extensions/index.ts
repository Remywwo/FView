import aiAssistant from "@/plugins/extensions/ai-assistant";
import type { ExtensionManifest } from "@/plugins/types";

/**
 * Built-in extensions activated at app startup.
 *
 * Add new ExtensionManifest entries here to ship them with the host.
 */
export const builtInExtensions: ExtensionManifest[] = [aiAssistant];