/**
 * Type declarations for markdown-it plugins without @types packages.
 */

declare module "markdown-it-footnote" {
  const plugin: import("markdown-it").PluginSimple;
  export default plugin;
}

declare module "markdown-it-task-lists" {
  interface Options {
    disabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
  }
  const plugin: import("markdown-it").PluginWithOptions<Options>;
  export default plugin;
}
