import helloDemo from "@/plugins/extensions/demo-hello";
import type { ExtensionManifest } from "@/plugins/types";

/**
 * Built-in extensions activated at app startup.
 *
 * Add new ExtensionManifest entries here to ship them with the host.
 * Third-party / dynamically-loaded extensions would be appended in
 * the same array (or supplied through a separate async loader) once
 * runtime plugin discovery is added in a future PR.
 */
export const builtInExtensions: ExtensionManifest[] = [helloDemo];