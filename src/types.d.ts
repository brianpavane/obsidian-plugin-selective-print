// esbuild bundles .css imports as text (see esbuild.config.mjs).
declare module "*.css" {
  const content: string;
  export default content;
}

// Starter presets are bundled as text (see esbuild.config.mjs).
declare module "*.md" {
  const content: string;
  export default content;
}
