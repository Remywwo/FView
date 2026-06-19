import type { ExtensionManifest } from "@/plugins/types";

/**
 * Demo extension — proves the plugin system end-to-end.
 *
 * On activate it:
 *   1. Registers a `demo.sayHello` command that emits a notification.
 *   2. Registers a toolbar contribution at slot `toolbar-end` whose
 *      render() is a button that fires the command.
 *
 * Clicking the toolbar button in the running app should pop a toast
 * "Hello from the plugin system!" in the bottom-right.
 *
 * This extension is the seed consumer of the plugin infrastructure
 * and will be replaced/supplemented by real extensions (AI summary,
 * translation, etc.) in subsequent PRs.
 */
const manifest: ExtensionManifest = {
  id: "demo.hello",
  name: "Demo: Say Hello",
  version: "0.1.0",
  activate(ctx) {
    const cleanupCommand = ctx.host.commands.register({
      id: "demo.sayHello",
      label: "Say Hello",
      run: () => {
        ctx.host.notify("Hello from the plugin system!", "info");
      },
    });

    const cleanupToolbar = ctx.host.registry.registerToolbar({
      id: "demo.hello-button",
      slot: "toolbar-end",
      order: 0,
      render: () => (
        <button
          type="button"
          onClick={() => {
            void ctx.host.commands.execute("demo.sayHello");
          }}
          title="Demo: trigger a notification"
          style={{ fontSize: 13 }}
        >
          Say Hello
        </button>
      ),
    });

    return () => {
      cleanupCommand();
      cleanupToolbar();
    };
  },
};

export default manifest;